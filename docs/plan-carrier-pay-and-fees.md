# Plan — Carrier pay, fees, and settlement reconciliation

Status: **planning only, nothing built.** Written 26 Aug 2026.
Supersedes section 0 of `docs/audit-2026-08-25.md`, which described the
percentage-pay gap before the fee problem was understood.

---

## The real problem

Leased-on owner-operators are paid a percentage of the load — but the
percentage is only half of what happens to their money. Carriers vary in what
the split applies to (D. Lewis Transport: 80/20 on the **all-in** rate; others:
80/20 on **linehaul only**, then fees on top), and **most carriers do not
disclose the fees up front**. The owner-operator finds out what they are really
being charged when the first settlement arrives.

So "what percentage do you get?" is the wrong question to build around. The
right one is: **what did the load pay, and what actually reached your account?**

## The insight this turns on

With both source documents, the app does not need to trust anything the carrier
said:

```
Rate confirmation:   $2,000.00     what the load paid
Settlement net:      $1,437.50     what hit the account
─────────────────────────────
Unexplained:           $562.50
  20% split             $400.00    disclosed
  insurance              $85.00    discovered week 1
  trailer rent           $50.00    discovered week 1
  ELD                    $12.50    discovered week 2
  ???                    $15.00    <-- still unidentified
```

Two things fall out of this that no simple calculator can do:

1. **Fee discovery.** Deductions the driver never agreed to become visible and
   named, week over week.
2. **Gross verification.** If the rate con says the load paid $2,000 and the
   settlement claims the load's gross was $1,900, the carrier shaved $100. This
   is the single most valuable thing ProfitRig could tell a leased driver, and
   it is only possible because both documents are in one place.

This is also the honest marketing story: *know what you are really being paid.*

---

## Phases

Each phase is useful on its own. Do not jump ahead — extraction has nowhere to
put data until the model exists.

### Phase 0 — Learn (no code)

Collect **real documents** before designing anything:

- 3–5 real settlement statements, ideally from more than one carrier
- The matching rate confirmations for those same loads
- D. Lewis's actual lease agreement / fee schedule if obtainable

Read them and answer: what line items appear, what are they called, is the
split shown or only implied, are loads itemized, are miles listed, is escrow
shown separately. Everything below is provisional until this is done — settlement
formats are the whole ballgame and guessing at them wastes the build.

### Phase 1 — Carrier + fees, entered by hand

Two new records:

**Carrier** — one per driver (they are leased to one at a time; keep history)
- name (`driver_profiles.carrier_name` already exists — migrate or link)
- pay basis: percentage of **all-in** vs percentage of **linehaul only**
- percentage
- how fuel surcharge is treated (in the split / passed through 100%)
- how accessorials are treated (detention, layover, tarping)

**Carrier fees** — the discovered deductions
- label, amount, cadence (per week / per load / per mile / one-off)
- `is_escrow` flag (see decisions — escrow is not an expense)
- date first seen, date ended
- `disclosed_up_front` boolean — this is the honesty ledger and, aggregated
  across users later, is genuinely valuable data

Wire the carrier's pay basis into `computeLoadEconomics` so a leased driver's
load revenue is their share, not the load's gross. This alone fixes the
overstated-profit bug (audit section 0).

### Phase 2 — Settlement record + reconciliation view

**Settlement** — one per pay period
- period start/end, carrier, gross, itemized deductions, net deposited
- links to the loads it paid for

The **reconciliation screen** is the payoff: rate-con gross down to net
deposited, every dollar accounted for, with anything unexplained called out by
name. This is the screen a driver shows another driver.

### Phase 3 — Upload and extract

**Settlements first, not rate cons.** Better target in every way: more tabular,
identical format week over week per carrier, contains the numbers that matter
most, and it is **one document per week** rather than one per load — a habit
instead of a chore. A single settlement upload could populate a whole week.

Rate confirmations second, to supply the gross for the verification above and
the trip details.

Same pattern already decided for rate cons: in-app upload → Claude extraction →
**review queue**, never silent auto-create.

---

## Decisions to settle before code

1. **What the split applies to.** All-in vs linehaul-only, and whether FSC and
   accessorials pass through. Must be per-carrier — it genuinely varies. Confirm
   D. Lewis is all-in from a real settlement, not from memory.

2. **Escrow is not an expense.** Escrow is a refundable deposit. Treating it as
   a cost understates the driver's position and misreports to the accountant. It
   needs its own treatment and a running balance — drivers routinely lose track
   of escrow they are owed.

3. **DOUBLE-COUNT GUARD — carrier deductions vs. calculator fixed costs.** If
   the carrier deducts insurance $85/wk and the driver also typed insurance
   $370/mo into the calculator, they are charged twice. This is the same shape
   as the meals/per-diem and fuel double-counts. Two options, pick before
   building: (a) carrier fees *replace* the matching fixed-cost fields for
   leased drivers, or (b) both exist and the app detects the overlap and asks.
   Leaning (a) with a migration prompt — for many leased drivers, most fixed
   costs ARE carrier deductions, and having the app fill them in is a feature.

4. **Two lenses.** Management: net revenue drives profit. Tax: the settlement
   statement is the source document the accountant needs, deductions itemized —
   and the app still states no deductibility. Note the 1099 question from audit
   section 0 remains: a leased driver's reported revenue must reconcile with the
   carrier's 1099, not with load gross.

5. **Free vs Pro.** Tracking is Pro. Consider whether a free "what is my carrier
   really charging me?" calculator is an acquisition hook the way the CPM
   calculator is — it is the question every leased driver has.

---

## What this connects to

- **Audit section 0** (overstated revenue) is fixed by Phase 1.
- **Settlement entry** was already flagged in the competitive report as the
  biggest conversion blocker vs ProfitGauges. Same feature.
- **Invoicing** is the mirror image: own-MC drivers invoice, leased drivers get
  settlements. The "By authority" split on /admin sizes both — get that number
  before committing to either.
- **Rate-con upload** (audit suggestions) is Phase 3 here, not a separate
  effort.

## First action

Collect the documents. Everything else is guessing until then.
