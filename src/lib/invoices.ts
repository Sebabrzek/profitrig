/**
 * Invoicing: a driver with their own authority bills a broker (or the
 * factoring company they sell invoices to) for a load they hauled.
 *
 * THE RULE: an invoice is its own document. It starts as a copy of the
 * load's pay and the driver may edit it, but nothing here ever changes the
 * load — the Loads tab, the week and the Tax tab keep reading the load.
 * When the two disagree the invoice page says so, in dollars.
 *
 * An issued invoice keeps the business details it was issued with (a
 * snapshot), so changing the address later never rewrites an old invoice.
 *
 * Pure functions only — no database, no network — so every rule is tested
 * (npm test).
 */
import { cleanScanReading } from "./scan";
import type { Load } from "./loads";

/** Leased drivers are paid by their carrier; everyone else may invoice. */
export function canInvoice(authorityType: string | null | undefined): boolean {
  return authorityType !== "leased";
}

export const DEFAULT_NET_DAYS = 30;
export const MAX_NET_DAYS = 180;
export const FIRST_INVOICE_NUMBER = 1001;
export const MAX_INVOICE_NUMBER = 99_999_999;
/** The most an invoice line may say, as a typo guard. */
export const MAX_INVOICE_AMOUNT = 1_000_000;

export type InvoiceSettings = {
  company_name: string;
  mc_number: string;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  net_days: number;
  next_number: number;
  factor_name: string;
  factor_address: string;
};

export const EMPTY_INVOICE_SETTINGS: InvoiceSettings = {
  company_name: "",
  mc_number: "",
  address_line: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  net_days: DEFAULT_NET_DAYS,
  next_number: FIRST_INVOICE_NUMBER,
  factor_name: "",
  factor_address: "",
};

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\r\t]/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) : "";
const multiline = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/\r/g, "")
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 5)
        .join("\n")
        .slice(0, max)
    : "";

/** "4.5 days" → 4; a blank or nonsense number → null. */
function wholeNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : null;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SettingsCheck =
  | { ok: true; settings: InvoiceSettings }
  | { ok: false; error: string };

/** The business details as the driver typed them, checked and tidied. */
export function checkInvoiceSettings(raw: Record<string, unknown>): SettingsCheck {
  const s: InvoiceSettings = {
    company_name: text(raw.company_name, 120),
    mc_number: text(raw.mc_number, 20).replace(/^mc[\s#-]*/i, ""),
    address_line: text(raw.address_line, 120),
    city: text(raw.city, 80),
    state: text(raw.state, 2).toUpperCase(),
    zip: text(raw.zip, 10),
    phone: text(raw.phone, 30),
    email: text(raw.email, 200).toLowerCase(),
    net_days: wholeNumber(raw.net_days) ?? DEFAULT_NET_DAYS,
    next_number: wholeNumber(raw.next_number) ?? FIRST_INVOICE_NUMBER,
    factor_name: text(raw.factor_name, 120),
    factor_address: multiline(raw.factor_address, 300),
  };
  if (!s.company_name) return { ok: false, error: "Add your company name — it's who the broker pays." };
  if (s.mc_number && !/^\d{1,10}$/.test(s.mc_number)) return { ok: false, error: "MC number is digits only." };
  if (s.state && !/^[A-Z]{2}$/.test(s.state)) return { ok: false, error: "State is two letters, like TX." };
  if (s.zip && !/^\d{5}(-\d{4})?$/.test(s.zip)) return { ok: false, error: "ZIP is 5 digits." };
  if (s.email && !EMAIL_PATTERN.test(s.email)) return { ok: false, error: "That email doesn't look right." };
  if (s.net_days < 0 || s.net_days > MAX_NET_DAYS) {
    return { ok: false, error: `Payment terms are 0 to ${MAX_NET_DAYS} days.` };
  }
  if (s.next_number < 1 || s.next_number > MAX_INVOICE_NUMBER) {
    return { ok: false, error: "The next invoice number has to be a whole number above 0." };
  }
  if (s.factor_name && !s.factor_address) {
    return { ok: false, error: "Add the factoring company's remit-to address." };
  }
  return { ok: true, settings: s };
}

export function invoiceSettingsFromRow(r: Record<string, unknown> | null | undefined): InvoiceSettings | null {
  if (!r) return null;
  return {
    company_name: String(r.company_name ?? ""),
    mc_number: String(r.mc_number ?? ""),
    address_line: String(r.address_line ?? ""),
    city: String(r.city ?? ""),
    state: String(r.state ?? ""),
    zip: String(r.zip ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    net_days: wholeNumber(r.net_days) ?? DEFAULT_NET_DAYS,
    next_number: wholeNumber(r.next_number) ?? FIRST_INVOICE_NUMBER,
    factor_name: String(r.factor_name ?? ""),
    factor_address: String(r.factor_address ?? ""),
  };
}

/** "Austin, TX 78701" — the city line of an address, skipping what's blank. */
export function cityLine(s: Pick<InvoiceSettings, "city" | "state" | "zip">): string {
  const cs = [s.city, s.state].filter(Boolean).join(", ");
  return [cs, s.zip].filter(Boolean).join(" ");
}

/** The issuer block printed at the top of the invoice: company only, never a person's name. */
export function fromBlock(s: InvoiceSettings): {
  company: string;
  mc: string;
  address: string;
  phone: string;
  email: string;
} {
  return {
    company: s.company_name,
    mc: s.mc_number,
    address: [s.address_line, cityLine(s)].filter(Boolean).join("\n"),
    phone: s.phone,
    email: s.email,
  };
}

/** Where the broker sends the money: the factoring company when there is one. */
export function remitBlock(s: InvoiceSettings): string {
  if (s.factor_name && s.factor_address) return `${s.factor_name}\n${s.factor_address}`;
  return [s.company_name, s.address_line, cityLine(s)].filter(Boolean).join("\n");
}

/** The next invoice number: the driver's chosen next number, or one past the highest used. */
export function nextInvoiceNumber(settingsNext: number, highestUsed: number | null): number {
  return Math.max(settingsNext, (highestUsed ?? 0) + 1);
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** What a load paid in full, before any carrier split: what an invoice bills. */
export function loadGross(load: Pick<Load, "linehaul_pay" | "fuel_surcharge" | "accessorials">): number {
  return cents(
    (Number(load.linehaul_pay) || 0) + (Number(load.fuel_surcharge) || 0) + (Number(load.accessorials) || 0)
  );
}

/** YYYY-MM-DD + days, on the calendar (no time zones). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from one calendar date to another. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T12:00:00Z`).getTime() - new Date(`${fromIso}T12:00:00Z`).getTime()) / 86_400_000
  );
}

/** The editable fields of an invoice. */
export type InvoiceInput = {
  bill_to_name: string;
  bill_to_email: string;
  bill_to_address: string;
  broker_load_number: string;
  invoice_date: string;
  net_days: number;
  pickup_date: string;
  origin: string;
  destination: string;
  linehaul: number;
  fuel_surcharge: number;
  accessorials: number;
  notes: string;
};

/**
 * A new invoice for a load: the broker as bill-to, the load's pay as it
 * stands, the broker's load number from the rate con when the load was
 * scanned, and the billing email last used for this broker.
 */
export function draftInvoice(
  load: Pick<Load, "broker" | "origin" | "destination" | "load_date" | "linehaul_pay" | "fuel_surcharge" | "accessorials">,
  settings: Pick<InvoiceSettings, "net_days">,
  opts: { today: string; scanExtracted?: unknown; lastBillToEmail?: string | null; lastBillToAddress?: string | null }
): InvoiceInput {
  const reading = opts.scanExtracted ? cleanScanReading(opts.scanExtracted, opts.today) : null;
  return {
    bill_to_name: load.broker.trim(),
    bill_to_email: opts.lastBillToEmail ?? "",
    bill_to_address: opts.lastBillToAddress ?? "",
    broker_load_number: reading?.loadNumber ?? "",
    invoice_date: opts.today,
    net_days: settings.net_days,
    pickup_date: load.load_date,
    origin: load.origin.trim(),
    destination: load.destination.trim(),
    linehaul: cents(Number(load.linehaul_pay) || 0),
    fuel_surcharge: cents(Number(load.fuel_surcharge) || 0),
    accessorials: cents(Number(load.accessorials) || 0),
    notes: "",
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) =>
  ISO_DATE.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) &&
  new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export type InvoiceCheck = { ok: true; invoice: InvoiceInput } | { ok: false; error: string };

/** An invoice as the driver filled it in, checked and tidied. */
export function checkInvoice(raw: Record<string, unknown>): InvoiceCheck {
  const amount = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[$,\s]/g, "")) : 0;
    return Number.isFinite(n) ? cents(n) : NaN;
  };
  const inv: InvoiceInput = {
    bill_to_name: text(raw.bill_to_name, 120),
    bill_to_email: text(raw.bill_to_email, 200).toLowerCase(),
    bill_to_address: multiline(raw.bill_to_address, 300),
    broker_load_number: text(raw.broker_load_number, 60),
    invoice_date: text(raw.invoice_date, 10),
    net_days: wholeNumber(raw.net_days) ?? DEFAULT_NET_DAYS,
    pickup_date: text(raw.pickup_date, 10),
    origin: text(raw.origin, 120),
    destination: text(raw.destination, 120),
    linehaul: amount(raw.linehaul),
    fuel_surcharge: amount(raw.fuel_surcharge),
    accessorials: amount(raw.accessorials),
    notes: multiline(raw.notes, 500),
  };
  if (!inv.bill_to_name) return { ok: false, error: "Who is this invoice to? Add the broker's name." };
  if (inv.bill_to_email && !EMAIL_PATTERN.test(inv.bill_to_email)) {
    return { ok: false, error: "The billing email doesn't look right." };
  }
  if (!validDate(inv.invoice_date)) return { ok: false, error: "Pick the invoice date." };
  if (inv.pickup_date && !validDate(inv.pickup_date)) return { ok: false, error: "The pickup date isn't a real date." };
  if (inv.net_days < 0 || inv.net_days > MAX_NET_DAYS) {
    return { ok: false, error: `Payment terms are 0 to ${MAX_NET_DAYS} days.` };
  }
  for (const [label, v] of [
    ["Line haul", inv.linehaul],
    ["Fuel surcharge", inv.fuel_surcharge],
    ["Other pay", inv.accessorials],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: `${label} can't be negative.` };
    if (v > MAX_INVOICE_AMOUNT) return { ok: false, error: `${label} looks too big — check it.` };
  }
  if (invoiceTotal(inv) <= 0) return { ok: false, error: "The invoice needs an amount." };
  return { ok: true, invoice: inv };
}

export function invoiceTotal(i: Pick<InvoiceInput, "linehaul" | "fuel_surcharge" | "accessorials">): number {
  return cents((Number(i.linehaul) || 0) + (Number(i.fuel_surcharge) || 0) + (Number(i.accessorials) || 0));
}

export type InvoiceStatus = "open" | "paid" | "void";

export type InvoiceListItem = {
  status: InvoiceStatus;
  total: number;
  invoice_date: string;
  due_date: string;
  paid_at: string | null;
};

/** Where an invoice stands today, in the words the list shows. */
export function invoiceStanding(
  inv: Pick<InvoiceListItem, "status" | "invoice_date" | "due_date">,
  today: string
): { label: "Paid" | "Cancelled" | "Overdue" | "Open"; daysOut: number | null; daysLate: number | null } {
  if (inv.status === "paid") return { label: "Paid", daysOut: null, daysLate: null };
  if (inv.status === "void") return { label: "Cancelled", daysOut: null, daysLate: null };
  const daysOut = Math.max(0, daysBetween(inv.invoice_date, today));
  const late = daysBetween(inv.due_date, today);
  return late > 0
    ? { label: "Overdue", daysOut, daysLate: late }
    : { label: "Open", daysOut, daysLate: null };
}

/** The top of the invoices list: what is owed, what is late, what came in lately. */
export function summarizeInvoices(list: InvoiceListItem[], today: string) {
  let owed = 0;
  let openCount = 0;
  let overdue = 0;
  let overdueCount = 0;
  let paid30 = 0;
  for (const inv of list) {
    const s = invoiceStanding(inv, today);
    if (s.label === "Open" || s.label === "Overdue") {
      owed += inv.total;
      openCount++;
      if (s.label === "Overdue") {
        overdue += inv.total;
        overdueCount++;
      }
    } else if (s.label === "Paid" && inv.paid_at && daysBetween(inv.paid_at, today) <= 30) {
      paid30 += inv.total;
    }
  }
  return {
    owed: cents(owed),
    openCount,
    overdue: cents(overdue),
    overdueCount,
    paidLast30: cents(paid30),
  };
}

/**
 * How an invoice differs from its load's pay, if it does — so an edit made
 * on the invoice is never silently out of step with the books.
 */
export function differenceFromLoad(invoiceTotalUsd: number, loadGrossUsd: number): number {
  return cents(invoiceTotalUsd - loadGrossUsd);
}
