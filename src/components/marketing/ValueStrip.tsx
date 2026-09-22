/**
 * The five things ProfitRig does, said in five words.
 *
 * It sits on the hero's ivory rather than the product's Off White, and close
 * under it, because the hero and this strip are one opening composition —
 * the statement, then what the statement is about. It is type and a Sage
 * rule and nothing else: no card, no shadow, no panel.
 *
 * The engraved rule at the foot of it is where the opening ends and the
 * product interface begins.
 */
const ITEMS = [
  { label: "Real costs", note: "What a mile actually costs you" },
  { label: "Load profit", note: "What each load truly cleared" },
  { label: "Fuel", note: "The MPG your truck really gets" },
  { label: "Tax ready", note: "Records your accountant can use" },
  { label: "On your phone", note: "In the cab, at the truck stop" },
];

export function ValueStrip() {
  return (
    <section className="pr-mk-band pr-opening">
      <div className="pr-mk-inner pt-7 pb-10 sm:pt-11 sm:pb-14">
        <ul className="pr-mk-strip">
          {ITEMS.map((i) => (
            <li key={i.label} className="pr-mk-strip-item">
              {i.label}
              <span className="mt-1.5 block text-[13px] font-medium normal-case tracking-normal text-muted font-sans">
                {i.note}
              </span>
            </li>
          ))}
        </ul>
        <div className="pr-opening-divider" aria-hidden="true" />
      </div>
    </section>
  );
}
