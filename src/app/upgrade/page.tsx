import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription } from "@/lib/subscription";
import { isPro } from "@/lib/subscription";
import { BottomNav } from "@/components/BottomNav";
import { UpgradeCard } from "./UpgradeCard";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sub = await fetchSubscription(supabase, user.id);
  const alreadyPro = isPro(sub);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="upgrade"
            email={user.email ?? ""}
            isAdmin={isAdminEmail(user.email)}
            isPro={alreadyPro}
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-8">
        {canceled && !alreadyPro && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-4 text-sm">
            Checkout canceled — no charges made.
          </div>
        )}

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-brand font-bold">
            ProfitRig Pro
          </p>
          <h1 className="text-3xl font-black mt-1">
            Track every load. Know every dollar.
          </h1>
          <p className="text-sm text-muted mt-2 leading-snug">
            The free Calculator tells you what your cost per mile{" "}
            <em>should</em> be. ProfitRig Pro adds the{" "}
            <span className="font-semibold text-foreground">
              Loads tracker
            </span>{" "}
            so you can record every trip, see actual profit per load, and
            export a clean week-by-week ledger to your accountant.
          </p>
        </div>

        {alreadyPro ? (
          <ProActive sub={sub} />
        ) : (
          <>
            <FeatureList />
            <UpgradeCard hasExistingCustomer={Boolean(sub?.stripe_customer_id)} />
          </>
        )}
      </div>
      <BottomNav isPro={alreadyPro} />
    </main>
  );
}

function FeatureList() {
  const items = [
    "Track every load you run (loaded + deadhead miles)",
    "See per-load profit, RPM, and CPM live",
    "Weekly summary card with totals and averages",
    "Export to Sheets / Excel — weekly, monthly, all-time",
    "Past weeks always accessible — never lose a record",
    "Cancel anytime. 7-day free trial.",
  ];
  return (
    <ul className="bg-white border border-border rounded-2xl p-5 mb-4 flex flex-col gap-2">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-sm">
          <span className="text-brand font-bold mt-0.5">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

import { ProActiveControls } from "./UpgradeCard";
import type { SubscriptionRow } from "@/lib/subscription";

function ProActive({ sub }: { sub: SubscriptionRow | null }) {
  const ends = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const isTrial = sub?.status === "trialing";
  return (
    <div className="bg-white border border-border rounded-2xl p-5 mb-4">
      <p className="text-xs uppercase tracking-wider text-brand-dark font-bold">
        You&apos;re on ProfitRig Pro
      </p>
      <p className="text-2xl font-black mt-1">
        {isTrial ? "Free trial active" : "Subscription active"}
      </p>
      {ends && (
        <p className="text-sm text-muted mt-1">
          {sub?.cancel_at_period_end
            ? `Access ends ${ends}.`
            : `${isTrial ? "Trial converts" : "Renews"} ${ends}.`}
        </p>
      )}
      <p className="text-sm mt-3 leading-snug">
        Manage your plan, update your card, or cancel anytime through Stripe.
      </p>
      <div className="mt-4">
        <ProActiveControls />
      </div>
    </div>
  );
}
