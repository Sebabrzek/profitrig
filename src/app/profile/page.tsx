import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { EMPTY_DRIVER_PROFILE, type DriverProfile } from "@/lib/profile";
import { ProfileForm } from "./ProfileForm";
import { FeedbackCard } from "./FeedbackCard";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: DriverProfile = EMPTY_DRIVER_PROFILE;
  let email = "";
  let userIsPro = false;
  if (user) {
    email = user.email ?? "";
    userIsPro = isPro(await fetchSubscription(supabase, user.id));
    const { data } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      initial = {
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        phone: data.phone ?? "",
        company_name: data.company_name ?? "",
        domicile_city: data.domicile_city ?? "",
        domicile_state: data.domicile_state ?? "",
        carrier_name: data.carrier_name ?? "",
        authority_type: data.authority_type ?? "",
        trailer_type: data.trailer_type ?? "",
        marketing_opt_in: Boolean(data.marketing_opt_in),
      };
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="profile"
            email={email}
            isAdmin={isAdminEmail(email)}
            isPro={userIsPro}
          />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
        <h1 className="text-2xl font-black mb-1">Your Profile</h1>
        <p className="text-sm text-muted mb-5">
          Quick info about you and your operation. All optional. Helps us send
          tips that actually match what you haul.
        </p>
        <ProfileForm initial={initial} email={email} />
        <div className="mt-4">
          <FeedbackCard />
        </div>
      </div>
    </main>
  );
}
