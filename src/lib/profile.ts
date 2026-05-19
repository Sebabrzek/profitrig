export type DriverProfile = {
  first_name: string;
  last_name: string;
  phone: string;
  company_name: string;
  domicile_city: string;
  domicile_state: string;
  carrier_name: string;
  authority_type: string;
  trailer_type: string;
  marketing_opt_in: boolean;
};

export const EMPTY_DRIVER_PROFILE: DriverProfile = {
  first_name: "",
  last_name: "",
  phone: "",
  company_name: "",
  domicile_city: "",
  domicile_state: "",
  carrier_name: "",
  authority_type: "",
  trailer_type: "",
  marketing_opt_in: false,
};

export function isProfileComplete(p: DriverProfile | null): boolean {
  if (!p) return false;
  return Boolean(p.first_name.trim() && p.phone.trim());
}
