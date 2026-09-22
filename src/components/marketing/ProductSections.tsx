import { LoadLedger, LoadRecord } from "@/app/loads/LoadRecord";
import {
  InstrumentPanel,
  PanelNote,
  Reading,
  ReadingGrid,
  StatTile,
} from "@/components/instruments/Instruments";
import { ButtonLink } from "@/components/ui/Button";
import { DEMO_LOADS } from "./demo";
import { Band, DemoMarker, Points, Screen, SectionTitle } from "./Parts";

/**
 * The four product sections: Loads, cost per mile, Fuel and Tax.
 *
 * Every panel below is the real ProfitRig interface — the same
 * InstrumentPanel, Reading and LoadRecord components the signed-in product
 * renders — filled with example figures and labelled as such. Nothing here
 * calculates anything; the numbers are constants in demo.ts, so the
 * marketing page can never disagree with the product about arithmetic.
 *
 * Engraving level 0 throughout. These sections earn trust by looking
 * exactly like the thing you are being sold.
 */

export function LoadsSection() {
  return (
    <Band>
      <div className="pr-mk-split pr-mk-split-ui-right">
        <div>
          <SectionTitle
            eyebrow="Loads"
            title={
              <>
                Every load has a number.
                <br />
                Know yours.
              </>
            }
            lead="Gross pay is not profit. ProfitRig takes the fuel, the tolls, the lumpers and that load's share of your monthly bills off the top, and shows you what was actually left."
          />
          <Points
            items={[
              "Log a load in under a minute, from the cab.",
              "A loss is named a loss — never hidden in a colour.",
              "Monday-to-Sunday weeks that match how you get settled.",
            ]}
          />
          <ButtonLink href="/login" variant="dark" className="mt-8">
            Start Free
          </ButtonLink>
        </div>

        <Screen caption="The Loads ledger, as it appears on a wide screen. On a phone each load becomes a card.">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-sm font-bold text-[var(--pr-rig-green)]">
              This week
            </p>
            <DemoMarker />
          </div>
          <LoadLedger>
            {DEMO_LOADS.map((l) => (
              <LoadRecord
                key={l.id}
                id={l.id}
                href="/login"
                dateLabel={l.dateLabel}
                broker={l.broker}
                origin={l.origin}
                destination={l.destination}
                economics={l.economics}
              />
            ))}
          </LoadLedger>
        </Screen>
      </div>
    </Band>
  );
}

export function CpmSection() {
  return (
    <Band dark>
      <div className="pr-mk-split">
        <div>
          <SectionTitle
            dark
            eyebrow="Cost per mile"
            title="Run your truck like a business."
            lead="Put in what you really pay — the truck, the insurance, the permits, the fuel, the maintenance — and ProfitRig works out the lowest rate you can haul for without losing money."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/calculator" variant="primary">
              Use Free Calculator
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-[var(--pr-sage)]">
            Free, and no account needed.
          </p>
        </div>

        <div>
          <div className="mb-3 flex justify-end">
            <DemoMarker dark />
          </div>
          <InstrumentPanel>
            <Reading
              size="hero"
              label="Your true cost per mile"
              value="$0.95"
              context="Everything it costs to turn a wheel, per mile."
            />
            <ReadingGrid>
              <Reading
                label="Minimum target rate"
                value="$1.45"
                context="cost + $0.50 profit"
              />
              <Reading
                label="Break-even monthly revenue"
                value="$9,454"
                context="at 10,000 mi"
              />
              <Reading
                label="Projected monthly profit"
                value="+$5,000"
                context="at target rate"
              />
            </ReadingGrid>
            <PanelNote>
              The same panel the calculator shows you, with example figures.
            </PanelNote>
          </InstrumentPanel>
        </div>
      </div>
    </Band>
  );
}

export function FuelSection() {
  return (
    <Band>
      <div className="pr-mk-split pr-mk-split-ui-left">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-sm font-bold text-[var(--pr-rig-green)]">
              Fuel
            </p>
            <DemoMarker />
          </div>
          <Screen>
            <InstrumentPanel>
              <Reading
                size="hero"
                label="Your average"
                value="6.4"
                unit="MPG"
                context="Across every week you have logged."
              />
              <ReadingGrid>
                <Reading label="Latest week" value="6.7" unit="MPG" />
                <Reading label="Miles tracked" figure={false} value="18,420" />
                <Reading label="Gallons" figure={false} value="2,878" />
              </ReadingGrid>
            </InstrumentPanel>
          </Screen>
        </div>

        <div>
          <SectionTitle
            eyebrow="Fuel"
            title="Every tenth of an MPG matters."
            lead="Log your odometer and the gallons you bought. ProfitRig works out the miles per gallon your truck really gets — not the number on the spec sheet — and feeds it straight into your cost per mile."
          />
          <Points
            items={[
              "One entry a week is enough.",
              "A tenth of an MPG is real money at 10,000 miles a month.",
              "Your real MPG, not an estimate, behind every load's cost.",
            ]}
          />
        </div>
      </div>
    </Band>
  );
}

export function TaxSection() {
  return (
    <Band>
      <div className="pr-mk-split pr-mk-split-ui-left">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-sm font-bold text-[var(--pr-rig-green)]">
              Tax · 2026
            </p>
            <DemoMarker />
          </div>
          <Screen>
            <InstrumentPanel>
              <Reading
                size="hero"
                label={<>Gross revenue · 2026</>}
                value="$184,260"
              />
              <ReadingGrid>
                <Reading label="Linehaul" value="$162,400" />
                <Reading label="FSC" value="$18,910" />
                <Reading label="Accessorials" value="$2,950" />
              </ReadingGrid>
              <PanelNote>
                147 loads · 128,400 total miles (119,600 loaded + 8,800
                deadhead)
              </PanelNote>
            </InstrumentPanel>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Deductible expenses" value="$41,380" />
              <StatTile label="Per diem nights" figure={false} value="214" />
            </div>
          </Screen>
        </div>

        <div>
          <SectionTitle
            eyebrow="Tax"
            title="Tax time shouldn't be a scavenger hunt."
            lead="Expenses categorised as you go, per diem nights counted, and capital purchases kept separate — so the year-end report is something you hand over, not something you assemble."
          />
          <Points
            items={[
              "Receipts logged in the cab, not in a shoebox.",
              "Capital purchases kept apart from running costs.",
              "A clean year-end report to hand your accountant.",
            ]}
          />
          <p className="mt-6 text-sm leading-snug text-muted">
            ProfitRig keeps organised records. It is not tax advice, and it
            does not file anything for you.
          </p>
        </div>
      </div>
    </Band>
  );
}
