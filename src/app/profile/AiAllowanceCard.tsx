import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import {
  AI_TIER_LABEL,
  aiUpgradeFor,
  formatResetDate,
  type AiBudgetStatus,
} from "@/lib/aiGuard";

/**
 * How much of this month's AI allowance the driver has used — as a
 * percentage, never dollars. The allowance itself is enforced on the server;
 * this only shows where they stand.
 */
export function AiAllowanceCard({
  status,
  proPlusOnSale,
}: {
  status: AiBudgetStatus;
  proPlusOnSale: boolean;
}) {
  const when = formatResetDate(status.resetsAt);
  const upgrade = aiUpgradeFor(status.tier, proPlusOnSale);
  return (
    <Card>
      <CardHeader
        title="AI this month"
        description={`Ask ProfitRig is included with your plan, up to a monthly allowance. Your plan: ${AI_TIER_LABEL[status.tier]}.`}
      />
      <div
        className="pr-meter"
        role="meter"
        aria-label="AI allowance used this month"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.usedPercent}
        aria-valuetext={`${status.usedPercent}% used`}
      >
        <span
          className="pr-meter-fill"
          style={{ width: `${status.usedPercent}%` }}
        />
      </div>
      <p className="mt-2 text-sm">
        <span className="pr-figure font-semibold">{status.usedPercent}%</span>{" "}
        used · resets {when}
      </p>
      {status.out ? (
        <p className="mt-2 text-sm leading-snug">
          {status.tier === "trial"
            ? "You've used the AI included with your free trial. Your full monthly allowance starts when your plan does."
            : `You've used this month's allowance, so AI help is paused until ${when}.`}
        </p>
      ) : status.nearlyOut ? (
        <p className="mt-2 text-sm leading-snug">
          Heads-up: you&apos;re close to this month&apos;s allowance.
        </p>
      ) : null}
      {upgrade && (
        <p className="mt-3 text-sm">
          <Link href="/upgrade" className="pr-link font-semibold">
            {upgrade === "pro" ? "Go Pro for more AI" : "Get more AI with Pro Plus"}
          </Link>
        </p>
      )}
    </Card>
  );
}
