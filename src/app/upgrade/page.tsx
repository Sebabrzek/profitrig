import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardHeader, PageHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription } from "@/lib/subscription";
import { isPro } from "@/lib/subscription";
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
    <AppShell
      width="form"
      account={{
        email: user.email ?? "",
        isPro: alreadyPro,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        {canceled && !alreadyPro && (
          <Notice className="mb-4">Checkout canceled — no charges made.</Notice>
        )}

        <PageHeader
          eyebrow="ProfitRig Pro"
          title="Track every load. Know every dollar."
          description={
            <>
            The free Calculator tells you what your cost per mile{" "}
            <em>should</em> be. ProfitRig Pro adds the{" "}
            <span className="font-semibold text-foreground">
              Loads tracker
            </span>{" "}
            so you can record every trip, see actual profit per load, and
            export a clean week-by-week ledger to your accountant.
            </>
          }
        />

        {alreadyPro ? (
          <ProActive sub={sub} />
        ) : (
          <>
            <FeatureList />
            <UpgradeCard hasExistingCustomer={Boolean(sub?.stripe_customer_id)} />
          </>
        )}
    </AppShell>
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
    <Card as="ul" className="mb-4 flex flex-col gap-2">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-sm">
          <span className="text-brand font-bold mt-0.5">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </Card>
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
    <Card as="div" className="mb-4">
      <CardHeader
        className="mb-0"
        eyebrow="You're on ProfitRig Pro"
        title={isTrial ? "Free trial active" : "Subscription active"}
      />
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
    </Card>
  );
}
