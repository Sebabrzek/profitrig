import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { Load } from "@/lib/loads";
import {
  TAX_PACK_DISCLAIMER,
  aggregateLoadActuals,
  aggregateRevenue,
  buildScheduleCGroups,
} from "@/lib/tax/report";
import { CATEGORIES } from "@/lib/tax/categories";
import { computePerDiem } from "@/lib/tax/perDiem";
import {
  driverPayTreatment,
  entityTypeLabel,
  truckFinancingLabel,
  type CapitalAsset,
  type EntityType,
  type Expense,
  type ExpenseCategory,
  type PerDiemRate,
  type PerDiemSummary,
  type TaxProfile,
  type TruckFinancing,
} from "@/lib/tax/types";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

const thisYear = () => new Date().getFullYear();

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number.parseInt(
    url.searchParams.get("year") ?? String(thisYear()),
    10
  );
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) {
    return new Response("Tax Pack requires ProfitRig Pro.", { status: 402 });
  }

  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;

  const [
    profileRes,
    loadsRes,
    expensesRes,
    assetsRes,
    perDiemRes,
    ratesRes,
  ] = await Promise.all([
    supabase
      .from("tax_profiles")
      .select("entity_type,has_hired_driver,truck_financing")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select(
        "load_date,broker,origin,destination,loaded_miles,deadhead_miles,linehaul_pay,fuel_surcharge,accessorials,fuel_actual,tolls_actual,lumpers_actual,notes"
      )
      .eq("user_id", user.id)
      .gte("load_date", yStart)
      .lte("load_date", yEnd)
      .order("load_date", { ascending: true }),
    supabase
      .from("expenses")
      .select("id,expense_date,category,amount,vendor,note")
      .eq("user_id", user.id)
      .gte("expense_date", yStart)
      .lte("expense_date", yEnd)
      .order("expense_date", { ascending: true }),
    supabase
      .from("capital_assets")
      .select("id,description,placed_in_service,cost")
      .eq("user_id", user.id)
      .gte("placed_in_service", yStart)
      .lte("placed_in_service", yEnd)
      .order("placed_in_service", { ascending: true }),
    supabase
      .from("per_diem_summary")
      .select("tax_year,period_a_nights,period_b_nights")
      .eq("user_id", user.id)
      .eq("tax_year", year)
      .maybeSingle(),
    supabase
      .from("per_diem_rates")
      .select("effective_date,conus_rate,ooc_rate,notice")
      .order("effective_date", { ascending: true }),
  ]);

  const profile: TaxProfile = profileRes.data
    ? {
        entity_type: (profileRes.data.entity_type as EntityType | null) ?? null,
        has_hired_driver: Boolean(profileRes.data.has_hired_driver),
        truck_financing:
          (profileRes.data.truck_financing as TruckFinancing | null) ?? null,
      }
    : { entity_type: null, has_hired_driver: false, truck_financing: null };

  const loads: Load[] = (loadsRes.data ?? []).map((r) => ({
    load_date: r.load_date,
    broker: r.broker ?? "",
    origin: r.origin ?? "",
    destination: r.destination ?? "",
    loaded_miles: Number(r.loaded_miles) || 0,
    deadhead_miles: Number(r.deadhead_miles) || 0,
    linehaul_pay: Number(r.linehaul_pay) || 0,
    fuel_surcharge: Number(r.fuel_surcharge) || 0,
    accessorials: Number(r.accessorials) || 0,
    fuel_actual: r.fuel_actual == null ? null : Number(r.fuel_actual),
    tolls_actual: r.tolls_actual == null ? null : Number(r.tolls_actual),
    lumpers_actual: r.lumpers_actual == null ? null : Number(r.lumpers_actual),
    notes: r.notes ?? "",
  }));

  const expenses: Expense[] = (expensesRes.data ?? []).map((r) => ({
    id: r.id,
    expense_date: r.expense_date,
    category: r.category as ExpenseCategory,
    amount: Number(r.amount) || 0,
    vendor: r.vendor ?? "",
    note: r.note ?? "",
  }));

  const assets: CapitalAsset[] = (assetsRes.data ?? []).map((r) => ({
    id: r.id,
    description: r.description ?? "",
    placed_in_service: r.placed_in_service,
    cost: Number(r.cost) || 0,
  }));

  const perDiemSummary: PerDiemSummary = perDiemRes.data
    ? {
        tax_year: year,
        period_a_nights: Number(perDiemRes.data.period_a_nights) || 0,
        period_b_nights: Number(perDiemRes.data.period_b_nights) || 0,
      }
    : { tax_year: year, period_a_nights: 0, period_b_nights: 0 };

  const rates: PerDiemRate[] = (ratesRes.data ?? []).map((r) => ({
    effective_date: r.effective_date,
    conus_rate: Number(r.conus_rate) || 0,
    ooc_rate: Number(r.ooc_rate) || 0,
    notice: r.notice ?? "",
  }));

  const revenue = aggregateRevenue(loads);
  const loadActuals = aggregateLoadActuals(loads);
  const scheduleCGroups = buildScheduleCGroups(expenses, loadActuals);
  const perDiem = computePerDiem(perDiemSummary, rates, year);
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const assetTotal = assets.reduce((s, a) => s + a.cost, 0);
  const driverPay = driverPayTreatment(profile);

  const filenameStem = `ProfitRig-Tax-Pack-${year}`;

  if (format === "html") {
    return new Response(buildHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // ---- CSV --------------------------------------------------------------

  const rows: string[] = [];

  rows.push(csvRow([`ProfitRig Tax Pack — ${year}`]));
  rows.push(csvRow([TAX_PACK_DISCLAIMER]));
  rows.push("");

  rows.push(csvRow(["TAX PROFILE"]));
  rows.push(csvRow(["Entity type", entityTypeLabel(profile.entity_type)]));
  rows.push(
    csvRow(["Has hired driver", profile.has_hired_driver ? "Yes" : "No"])
  );
  rows.push(
    csvRow(["Truck financing", truckFinancingLabel(profile.truck_financing)])
  );
  rows.push(
    csvRow([
      "Driver-pay treatment",
      driverPay === "owner_draw_excluded"
        ? "Owner pay = draw (EXCLUDED from this Tax Pack)"
        : driverPay === "wages_or_1099"
        ? "Hired driver — W-2 or 1099 (enter as Expenses)"
        : "S-corp owner W-2 wages (enter as Expenses)",
    ])
  );
  rows.push("");

  rows.push(csvRow(["GROSS REVENUE"]));
  rows.push(csvRow(["Linehaul", num(revenue.linehaul)]));
  rows.push(csvRow(["Fuel Surcharge", num(revenue.fuel_surcharge)]));
  rows.push(csvRow(["Accessorials", num(revenue.accessorials)]));
  rows.push(csvRow(["TOTAL REVENUE", num(revenue.total)]));
  rows.push("");

  rows.push(csvRow(["BUSINESS MILES"]));
  rows.push(csvRow(["Loaded miles", num(loadActuals.loadedMiles)]));
  rows.push(csvRow(["Deadhead miles", num(loadActuals.deadheadMiles)]));
  rows.push(csvRow(["Total miles", num(loadActuals.totalMiles)]));
  rows.push("");

  rows.push(csvRow(["DEDUCTIBLE EXPENSES (grouped by Schedule C line)"]));
  rows.push(csvRow(["Line", "Schedule C", "Description", "Amount"]));
  for (const g of scheduleCGroups) {
    for (const item of g.items) {
      rows.push(csvRow([g.line, g.label, item.description, num(item.amount)]));
    }
    rows.push(csvRow([g.line, g.label, `LINE ${g.line} TOTAL`, num(g.amount)]));
    rows.push("");
  }

  rows.push(csvRow(["PER-DIEM WORKSHEET (DOT meals — Schedule C line 24b)"]));
  rows.push(csvRow(["Period", "Nights", "Rate", "Notice", "Gross", "Deductible (80%)"]));
  for (const p of perDiem.periods) {
    rows.push(
      csvRow([
        p.label,
        p.nights,
        num(p.rate),
        p.notice,
        num(p.gross),
        num(p.deductible),
      ])
    );
  }
  rows.push(
    csvRow([
      "TOTAL PER-DIEM",
      perDiem.totalNights,
      "",
      "",
      num(perDiem.totalGross),
      num(perDiem.totalDeductible),
    ])
  );
  rows.push("");

  rows.push(
    csvRow([
      "CAPITAL ASSETS — listed separately, NEVER added to expense totals (CPA depreciates / §179)",
    ])
  );
  rows.push(csvRow(["Description", "Placed in service", "Cost"]));
  for (const a of assets) {
    rows.push(csvRow([a.description, a.placed_in_service, num(a.cost)]));
  }
  rows.push(csvRow(["TOTAL CAPITAL ASSETS (informational only)", "", num(assetTotal)]));
  rows.push("");

  rows.push(csvRow(["NON-LOAD EXPENSES — raw detail"]));
  rows.push(csvRow(["Date", "Category", "Amount", "Vendor", "Note"]));
  for (const e of expenses) {
    const cat = CATEGORIES.find((c) => c.key === e.category);
    rows.push(
      csvRow([
        e.expense_date,
        cat?.label ?? e.category,
        num(e.amount),
        e.vendor,
        e.note,
      ])
    );
  }
  rows.push(csvRow(["TOTAL NON-LOAD EXPENSES", "", num(expenseTotal), "", ""]));
  rows.push("");

  rows.push(csvRow(["LOADS — raw detail (actuals only)"]));
  rows.push(
    csvRow([
      "Date",
      "Broker",
      "Origin",
      "Destination",
      "Loaded mi",
      "Deadhead mi",
      "Linehaul",
      "FSC",
      "Accessorials",
      "Fuel actual",
      "Tolls actual",
      "Lumpers actual",
    ])
  );
  for (const l of loads) {
    rows.push(
      csvRow([
        l.load_date,
        l.broker,
        l.origin,
        l.destination,
        num(l.loaded_miles),
        num(l.deadhead_miles),
        num(l.linehaul_pay),
        num(l.fuel_surcharge),
        num(l.accessorials),
        l.fuel_actual == null ? "" : num(l.fuel_actual),
        l.tolls_actual == null ? "" : num(l.tolls_actual),
        l.lumpers_actual == null ? "" : num(l.lumpers_actual),
      ])
    );
  }

  // BOM so Excel detects UTF-8.
  const csv = "﻿" + rows.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameStem}.csv"`,
      "Cache-Control": "no-store",
    },
  });

  // ---- HTML helper (closure over computed values) ---------------------

  function buildHtml(): string {
    const sectionStyle =
      "background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 12px;";
    const h2Style = "font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:0 0 4px;";
    const bigStyle = "font-size:32px;font-weight:900;margin:0;";
    const tableStyle =
      "width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;";
    const thStyle =
      "text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 8px;color:#6b7280;font-weight:600;";
    const tdStyle = "border-bottom:1px solid #f3f4f6;padding:6px 8px;";
    const tdRightStyle =
      "border-bottom:1px solid #f3f4f6;padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums;";

    const scheduleRows = scheduleCGroups
      .map(
        (g) => `
        <tr>
          <td style="${tdStyle}font-weight:700;">${htmlEscape(g.line)}</td>
          <td style="${tdStyle}">${htmlEscape(g.label)}</td>
          <td style="${tdRightStyle}font-weight:700;">${money(g.amount)}</td>
        </tr>
        ${g.items
          .map(
            (it) =>
              `<tr><td style="${tdStyle}"></td><td style="${tdStyle}color:#6b7280;font-size:12px;">${htmlEscape(it.description)}</td><td style="${tdRightStyle}color:#6b7280;font-size:12px;">${money(it.amount)}</td></tr>`
          )
          .join("")}
      `
      )
      .join("");

    const perDiemRows = perDiem.periods
      .map(
        (p) => `
        <tr>
          <td style="${tdStyle}">${htmlEscape(p.label)}</td>
          <td style="${tdRightStyle}">${p.nights}</td>
          <td style="${tdRightStyle}">${money(p.rate)}</td>
          <td style="${tdStyle}">${htmlEscape(p.notice)}</td>
          <td style="${tdRightStyle}">${money(p.gross)}</td>
          <td style="${tdRightStyle}font-weight:700;">${money(p.deductible)}</td>
        </tr>
      `
      )
      .join("");

    const assetRows = assets
      .map(
        (a) => `
        <tr>
          <td style="${tdStyle}">${htmlEscape(a.description)}</td>
          <td style="${tdStyle}">${a.placed_in_service}</td>
          <td style="${tdRightStyle}">${money(a.cost)}</td>
        </tr>
      `
      )
      .join("");

    return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>ProfitRig Tax Pack — ${year}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#f9fafb;color:#0a1f14;margin:0;padding:24px;max-width:780px;margin:0 auto;}
  h1{font-size:24px;font-weight:900;margin:0 0 4px;}
  .subtitle{color:#6b7280;font-size:13px;margin:0 0 16px;}
  .disclaimer{background:#fef3c7;border:1px solid #fde68a;color:#78350f;font-size:12px;padding:8px 12px;border-radius:8px;margin-bottom:16px;line-height:1.4;}
  @media print { body{background:#fff;} .noprint{display:none;} }
</style></head><body>
<button class="noprint" onclick="window.print()" style="float:right;background:#16a34a;color:#fff;border:0;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
<h1>ProfitRig Tax Pack — ${year}</h1>
<p class="subtitle">Records to give to your tax professional. Tax lens only — no estimates or reserves.</p>
<p class="disclaimer">${htmlEscape(TAX_PACK_DISCLAIMER)}</p>

<div style="${sectionStyle}">
  <p style="${h2Style}">Tax profile</p>
  <p style="margin:0;font-size:14px;line-height:1.6;">
    <strong>Entity:</strong> ${htmlEscape(entityTypeLabel(profile.entity_type))}<br/>
    <strong>Hired driver:</strong> ${profile.has_hired_driver ? "Yes" : "No"}<br/>
    <strong>Truck financing:</strong> ${htmlEscape(truckFinancingLabel(profile.truck_financing))}<br/>
    <strong>Driver-pay treatment:</strong> ${
      driverPay === "owner_draw_excluded"
        ? "Owner pay = draw (EXCLUDED)"
        : driverPay === "wages_or_1099"
        ? "Hired driver — W-2 or 1099"
        : "S-corp owner W-2 wages"
    }
  </p>
</div>

<div style="${sectionStyle}">
  <p style="${h2Style}">Gross revenue</p>
  <p style="${bigStyle}">${money(revenue.total)}</p>
  <table style="${tableStyle}">
    <tr><td style="${tdStyle}">Linehaul</td><td style="${tdRightStyle}">${money(revenue.linehaul)}</td></tr>
    <tr><td style="${tdStyle}">Fuel surcharge</td><td style="${tdRightStyle}">${money(revenue.fuel_surcharge)}</td></tr>
    <tr><td style="${tdStyle}">Accessorials</td><td style="${tdRightStyle}">${money(revenue.accessorials)}</td></tr>
  </table>
</div>

<div style="${sectionStyle}">
  <p style="${h2Style}">Business miles</p>
  <p style="margin:0;font-size:14px;">${loadActuals.totalMiles.toLocaleString()} total — ${loadActuals.loadedMiles.toLocaleString()} loaded · ${loadActuals.deadheadMiles.toLocaleString()} deadhead</p>
</div>

<div style="${sectionStyle}">
  <p style="${h2Style}">Deductible expenses — grouped by Schedule C line (CPA-confirmable)</p>
  <table style="${tableStyle}">
    <thead><tr><th style="${thStyle}">Line</th><th style="${thStyle}">Suggested line</th><th style="${thStyle}text-align:right;">Amount</th></tr></thead>
    <tbody>${scheduleRows || `<tr><td style="${tdStyle}" colspan="3">No expenses recorded.</td></tr>`}</tbody>
  </table>
</div>

<div style="${sectionStyle}">
  <p style="${h2Style}">Per-diem worksheet — Schedule C line 24b (DOT 80%)</p>
  <table style="${tableStyle}">
    <thead><tr><th style="${thStyle}">Period</th><th style="${thStyle}text-align:right;">Nights</th><th style="${thStyle}text-align:right;">Rate</th><th style="${thStyle}">Notice</th><th style="${thStyle}text-align:right;">Gross</th><th style="${thStyle}text-align:right;">Deductible</th></tr></thead>
    <tbody>${perDiemRows || `<tr><td style="${tdStyle}" colspan="6">No nights recorded.</td></tr>`}
      <tr><td style="${tdStyle}font-weight:700;">TOTAL</td><td style="${tdRightStyle}font-weight:700;">${perDiem.totalNights}</td><td></td><td></td><td style="${tdRightStyle}font-weight:700;">${money(perDiem.totalGross)}</td><td style="${tdRightStyle}font-weight:700;">${money(perDiem.totalDeductible)}</td></tr>
    </tbody>
  </table>
</div>

<div style="${sectionStyle}">
  <p style="${h2Style}">Capital assets — listed separately (NOT in expense totals)</p>
  <p style="font-size:12px;color:#6b7280;margin:0 0 4px;">CPA depreciates / applies §179.</p>
  <table style="${tableStyle}">
    <thead><tr><th style="${thStyle}">Description</th><th style="${thStyle}">Placed in service</th><th style="${thStyle}text-align:right;">Cost</th></tr></thead>
    <tbody>${assetRows || `<tr><td style="${tdStyle}" colspan="3">No capital assets recorded.</td></tr>`}
      <tr><td style="${tdStyle}font-weight:700;">TOTAL (informational only)</td><td></td><td style="${tdRightStyle}font-weight:700;">${money(assetTotal)}</td></tr>
    </tbody>
  </table>
</div>

</body></html>`;
  }
}
