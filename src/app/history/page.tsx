import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { HistoryList, type Snapshot } from "./HistoryList";

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let snapshots: Snapshot[] = [];
  const email = user?.email ?? "";
  if (user) {
    const { data } = await supabase
      .from("cost_profile_snapshots")
      .select(
        "id,label,total_cpm,required_rate,monthly_miles,desired_profit_per_mile,created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) snapshots = data as Snapshot[];
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="history"
            email={email}
            isAdmin={isAdminEmail(email)}
          />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-black mb-1">Save History</h1>
        <p className="text-sm text-muted mb-5">
          Every save is dated. Tap one to load it back into the calculator.
        </p>
        {snapshots.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-muted">
              You haven&apos;t saved a snapshot yet. Hit{" "}
              <Link href="/" className="text-brand font-semibold">
                Save
              </Link>{" "}
              on the calculator to record your first one.
            </p>
          </div>
        ) : (
          <HistoryList snapshots={snapshots} />
        )}
      </div>
    </main>
  );
}
