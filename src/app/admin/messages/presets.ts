import type { Preset } from "./Composer";

/** Messages Sebastian can start from. Edit before sending. */
export const PRESETS: Preset[] = [
  {
    label: "October update",
    subject: "New in ProfitRig: scan rate cons, email loads in, invoice brokers",
    banner:
      "New: snap a rate con and ProfitRig fills in the load. You can also email rate cons in, and invoice brokers from any load.",
    body: `Hi {{first_name}},

Three new things in ProfitRig this month, all built to cut your paperwork:

**1. Scan a rate con.** Take a photo or pick a PDF of a rate con or load ticket, and ProfitRig fills in the load for you: date, broker, load #, pickup and delivery, pay, and miles when they're printed. You check it and tap Save.
Loads → + Add a Load → Scan a document

**2. Email loads in.** Pick your own address, like yourname@in.profitrig.com, and forward rate cons to it, or set Gmail or Outlook to forward them for you. They show up on your Loads page, filled in and ready to check.
Profile → Email loads to ProfitRig

**3. Invoices (own authority).** Make an invoice from any load, with the broker's load number taken straight from your rate con. Download one PDF with the invoice, the rate con and your signed BOL, and see what's owed and overdue.
Profile → Invoice details, then Create invoice on any load

**Also new:** ProfitRig now points out likely mistakes ("Worth a look"), you can add partial loads under the load they ride with, and Profile shows how much of your monthly AI allowance you've used.

Scanned and emailed loads are drafts. Your numbers only change when you tap Save.

These are part of ProfitRig Pro, including the 7-day free trial. Questions? Just reply to this email.

Sebastian`,
  },
];
