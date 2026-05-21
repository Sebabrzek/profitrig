import "server-only";
import type Stripe from "stripe";
import {
  getStripe,
  STRIPE_WEBHOOK_SECRET,
} from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getPlanFromSubscription(sub: Stripe.Subscription): string | null {
  const monthlyId = process.env.STRIPE_PRICE_MONTHLY;
  const yearlyId = process.env.STRIPE_PRICE_YEARLY;
  const priceId = sub.items.data[0]?.price.id;
  if (!priceId) return null;
  if (priceId === monthlyId) return "monthly";
  if (priceId === yearlyId) return "yearly";
  return sub.items.data[0]?.price.recurring?.interval ?? null;
}

async function upsertFromSubscription(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  sub: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  if (!admin) return;
  const userId =
    (sub.metadata?.user_id as string | undefined) ?? fallbackUserId ?? null;
  if (!userId) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Stripe types call this `current_period_end` (epoch seconds). Cast to
  // unknown then number so TS doesn't fight us about API version drift.
  const periodEnd = (sub as unknown as { current_period_end?: number })
    .current_period_end;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      plan: getPlanFromSubscription(sub),
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(
      `Webhook signature verification failed: ${
        err instanceof Error ? err.message : "unknown"
      }`,
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return new Response("Admin client unavailable", { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId =
            (session.metadata?.user_id as string | undefined) ??
            session.client_reference_id ??
            null;
          await upsertFromSubscription(admin, sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(admin, sub);
        break;
      }
      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    return new Response(
      `Handler error: ${err instanceof Error ? err.message : "unknown"}`,
      { status: 500 }
    );
  }

  return new Response("ok", { status: 200 });
}
