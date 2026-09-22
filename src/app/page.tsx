import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { ValueStrip } from "@/components/marketing/ValueStrip";
import {
  CpmSection,
  FuelSection,
  LoadsSection,
  TaxSection,
} from "@/components/marketing/ProductSections";
import { InstallSection } from "@/components/marketing/InstallSection";
import { ClosingCta } from "@/components/marketing/ClosingCta";

/**
 * The public homepage.
 *
 * A signed-in driver never sees this: the middleware sends them to
 * /calculator, which is where "/" used to take them. The calculator itself
 * is unchanged and still free and open to visitors at /calculator.
 *
 * The rhythm is deliberate, and it is the brief: a big American Iron hero,
 * then clean product, then clean product with the quietest of accents, then
 * a clean phone section, then American Iron again to close. The engraving
 * appears twice. Everything between is the actual ProfitRig interface.
 */
export const metadata: Metadata = {
  title: "ProfitRig — Know your numbers. Take control.",
  description:
    "ProfitRig shows an owner-operator what a mile really costs, what a load really paid, and what is left at the end of the week. Free rate-per-mile calculator, no account needed.",
};

export default function HomePage() {
  return (
    <main id="main-content" className="pr-mk-page">
      <Hero />
      <ValueStrip />
      <LoadsSection />
      <CpmSection />
      <FuelSection />
      <TaxSection />
      <InstallSection />
      <ClosingCta />
    </main>
  );
}
