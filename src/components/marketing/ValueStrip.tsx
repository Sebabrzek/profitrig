/**
 * The five things ProfitRig does, said in five words. Level 0 engraving:
 * type and a Sage rule, nothing else. It is the first clean breath after
 * the hero, and it sets up the four product sections that follow.
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
    <section className="pr-mk-band">
      <div className="pr-mk-inner py-10 sm:py-14">
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
      </div>
    </section>
  );
}
