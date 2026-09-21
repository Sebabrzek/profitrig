/**
 * Demonstration figures for the public homepage.
 *
 * These are invented example numbers used to show what the real ProfitRig
 * interface looks like with something in it. They are not a customer's
 * records, not an average, and not a claim about what anyone earns. Every
 * section that shows them carries a visible "Example data" marker.
 *
 * They are internally consistent — the profit is what the revenue, cost and
 * miles actually produce — so the interface reads truthfully. The product's
 * own calculation code is never involved here; nothing on the marketing page
 * computes anything.
 */

export const DEMO_MARKER = "Example data";

export type DemoLoad = {
  id: string;
  dateLabel: string;
  broker: string;
  origin: string;
  destination: string;
  economics: {
    totalMiles: number;
    deadheadPct: number;
    revenue: number;
    carrierPct: number;
    loadPay: number;
    rpm: number;
    totalCost: number;
    cpm: number;
    profit: number;
  };
};

/** Three loads: two that paid, one that did not. A real week has both. */
export const DEMO_LOADS: DemoLoad[] = [
  {
    id: "demo-1",
    dateLabel: "Thu 18 Sep",
    broker: "Example Brokerage",
    origin: "Laredo, TX",
    destination: "Memphis, TN",
    economics: {
      totalMiles: 1040,
      deadheadPct: 6,
      revenue: 2860,
      carrierPct: 0,
      loadPay: 2860,
      rpm: 2.75,
      totalCost: 1144,
      cpm: 1.1,
      profit: 1716,
    },
  },
  {
    id: "demo-2",
    dateLabel: "Tue 16 Sep",
    broker: "Example Logistics",
    origin: "Memphis, TN",
    destination: "Columbus, OH",
    economics: {
      totalMiles: 612,
      deadheadPct: 11,
      revenue: 1180,
      carrierPct: 0,
      loadPay: 1180,
      rpm: 1.93,
      totalCost: 703.8,
      cpm: 1.15,
      profit: 476.2,
    },
  },
  {
    id: "demo-3",
    dateLabel: "Mon 15 Sep",
    broker: "Example Freight Co.",
    origin: "Columbus, OH",
    destination: "Joliet, IL",
    economics: {
      totalMiles: 358,
      deadheadPct: 24,
      revenue: 392,
      carrierPct: 0,
      loadPay: 392,
      rpm: 1.09,
      totalCost: 451.08,
      cpm: 1.26,
      profit: -59.08,
    },
  },
];
