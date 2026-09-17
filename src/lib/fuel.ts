/**
 * Fuel tab: the driver's truck and a weekly odometer + gallons log, turned
 * into real miles per gallon. Deliberately connected to nothing else — the
 * calculator's MPG stays whatever the driver types there.
 */

export type Transmission = "automatic" | "manual";

export type Rig = {
  make: string;
  model: string;
  year: number | null;
  engine: string;
  transmission: Transmission | "";
  /** Odometer when the driver started tracking. MPG is measured from here. */
  starting_odometer: number | null;
};

export const EMPTY_RIG: Rig = {
  make: "",
  model: "",
  year: null,
  engine: "",
  transmission: "",
  starting_odometer: null,
};

export type FuelLog = {
  id?: string;
  logged_on: string; // YYYY-MM-DD
  odometer: number;
  /** Gallons bought since the previous reading. */
  gallons: number;
};

/**
 * Where an entry stands:
 *   baseline  first reading with no starting odometer — nothing to measure from
 *   ok        miles since the last reading ÷ gallons
 *   check     measured, but no semi gets that MPG — likely a typo or a partial fill
 *   odometer  reading is not higher than the one before it
 */
export type FuelEntryStatus = "baseline" | "ok" | "check" | "odometer";

export type FuelEntry = FuelLog & {
  miles: number | null;
  mpg: number | null;
  status: FuelEntryStatus;
};

export type FuelStats = {
  /** Newest (highest odometer) first. */
  entries: FuelEntry[];
  /** Miles tracked ÷ gallons tracked. null until there is a measured week. */
  averageMpg: number | null;
  milesTracked: number;
  gallonsTracked: number;
  /** MPG of the most recent measured week. */
  latestMpg: number | null;
  /** The reading a new entry is measured from: the highest odometer on file. */
  lastOdometer: number | null;
};

/** MPG a class 8 truck can plausibly get. Outside this, flag the week. */
export const MPG_PLAUSIBLE_MIN = 3;
export const MPG_PLAUSIBLE_MAX = 12;

export function isPlausibleMpg(mpg: number): boolean {
  return mpg >= MPG_PLAUSIBLE_MIN && mpg <= MPG_PLAUSIBLE_MAX;
}

/**
 * Real MPG from weekly readings.
 *
 * Weeks are ordered by odometer, not by date, so a week entered late still
 * measures from the right reading. The average is total miles ÷ total gallons
 * rather than an average of weekly MPGs: weekly numbers swing with how full
 * the tank was when the week closed, but those swings cancel out over the
 * whole run. For the same reason a flagged week still counts toward the
 * average — only readings that go backwards are left out.
 */
export function computeFuelStats(
  startingOdometer: number | null,
  logs: FuelLog[]
): FuelStats {
  const usable = logs
    .filter(
      (l) =>
        Number.isFinite(l.odometer) &&
        l.odometer >= 0 &&
        Number.isFinite(l.gallons) &&
        l.gallons > 0
    )
    .sort(
      (a, b) => a.odometer - b.odometer || a.logged_on.localeCompare(b.logged_on)
    );

  let previous =
    startingOdometer != null &&
    Number.isFinite(startingOdometer) &&
    startingOdometer >= 0
      ? startingOdometer
      : null;
  let milesTracked = 0;
  let gallonsTracked = 0;
  let latestMpg: number | null = null;

  const ascending: FuelEntry[] = usable.map((log) => {
    if (previous == null) {
      // Gallons at the very first reading fueled miles we never saw.
      previous = log.odometer;
      return { ...log, miles: null, mpg: null, status: "baseline" };
    }
    if (log.odometer <= previous) {
      return { ...log, miles: null, mpg: null, status: "odometer" };
    }
    const miles = log.odometer - previous;
    const mpg = miles / log.gallons;
    previous = log.odometer;
    milesTracked += miles;
    gallonsTracked += log.gallons;
    latestMpg = mpg;
    return { ...log, miles, mpg, status: isPlausibleMpg(mpg) ? "ok" : "check" };
  });

  return {
    entries: ascending.reverse(),
    averageMpg: gallonsTracked > 0 ? milesTracked / gallonsTracked : null,
    milesTracked,
    gallonsTracked,
    latestMpg,
    lastOdometer: previous,
  };
}
