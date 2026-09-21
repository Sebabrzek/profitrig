import Image from "next/image";
import { Card } from "@/components/ui/Surfaces";
import { InstallCard } from "./InstallCard";
import { Band, Points, SectionTitle } from "./Parts";

/**
 * Section 8 — the phone. Level 0 engraving: this section is about a modern
 * app on a modern phone, and the artwork would only get in its way.
 *
 * The icon shown is the approved app icon the manifest already installs.
 */
export function InstallSection() {
  return (
    <Band>
      <div className="pr-mk-split">
        <div>
          <SectionTitle
            eyebrow="On your phone"
            title="Get ProfitRig on your phone."
            lead="ProfitRig installs straight from the browser — no app store, no download, no account required to try the calculator. It opens full screen and sits on your home screen with your other apps."
          />
          <Points
            items={[
              "Log a load at the dock, not at the kitchen table.",
              "Built for one hand and a cold morning: 44px targets throughout.",
              "Same numbers on the phone and the laptop.",
            ]}
          />
        </div>

        <Card className="lg:justify-self-end lg:max-w-[440px]">
          <div className="flex items-center gap-4">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={64}
              height={64}
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-[var(--pr-radius-card)]"
            />
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-snug text-[var(--pr-rig-green)]">
                ProfitRig
              </p>
              <p className="text-sm leading-snug text-muted">
                Know your real break-even rate per mile.
              </p>
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <InstallCard />
          </div>
        </Card>
      </div>
    </Band>
  );
}
