import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveCarrierPct,
  parseWeekStart,
  type WeekStart,
} from "@/lib/loads";

export type DriverSettings = {
  weekStart: WeekStart;
  /** Default % the carrier keeps on new loads. null: independent, or not set yet. */
  carrierPct: number | null;
  carrierName: string;
  /** The driver's own answer: "leased", "own_mc", "both", or "" if never asked. */
  authorityType: string;
};

const DEFAULTS: DriverSettings = {
  weekStart: "monday",
  carrierPct: null,
  carrierName: "",
  authorityType: "",
};

/**
 * The profile settings that change how loads are counted. Reads the whole
 * row, so a column a migration hasn't added yet just comes back missing and
 * falls to its default — this ships safely before the migration runs.
 */
export async function fetchDriverSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<DriverSettings> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  const pct = effectiveCarrierPct(data.carrier_pct);
  return {
    weekStart: parseWeekStart(data.week_start),
    carrierPct: pct > 0 ? pct : null,
    carrierName: (data.carrier_name as string | null) ?? "",
    authorityType: (data.authority_type as string | null) ?? "",
  };
}
