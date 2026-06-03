import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { isAdminEmail, adminEmails } from "@/lib/admin";
import { signOutAction } from "../actions";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";

export const dynamic = "force-dynamic";

type DriverProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  domicile_city: string | null;
  domicile_state: string | null;
  carrier_name: string | null;
  authority_type: string | null;
  trailer_type: string | null;
  marketing_opt_in: boolean | null;
};

type FeedbackRow = {
  id: string;
  user_id: string | null;
  message: string;
  created_at: string;
};

const TRAILER_LABELS: Record<string, string> = {
  dry_van: "Dry Van",
  reefer: "Reefer",
  flatbed: "Flatbed",
  step_deck: "Step Deck",
  power_only: "Power Only",
  tanker: "Tanker",
  other: "Other",
};

const AUTHORITY_LABELS: Record<string, string> = {
  leased: "Leased",
  own_mc: "Own MC",
  both: "Both",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">
        {label}
      </p>
      <p className="text-3xl font-black mt-1 leading-none text-brand-dark">
        {value}
      </p>
      {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
    </div>
  );
}

function Bar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function AdminPage() {
  // Auth gate: must be signed in AND email in ADMIN_EMAILS allowlist.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const admin = createSupabaseAdminClient();
  const allowlistEmpty = adminEmails().length === 0;

  if (!admin) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Wordmark size="md" />
            <Link href="/" className="text-sm font-semibold text-brand">
              ← App
            </Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-black mb-4">Admin — setup needed</h1>
          <div className="bg-white border border-border rounded-2xl p-6 space-y-3">
            <p>
              Add these env vars in Vercel → Project → Settings → Environment
              Variables, then redeploy:
            </p>
            <pre className="bg-gray-50 border border-border rounded-xl p-3 text-xs overflow-x-auto">
{`SUPABASE_SERVICE_ROLE_KEY = <from Supabase: Project Settings → API → "service_role" secret>
ADMIN_EMAILS = ${user.email}`}
            </pre>
            <p className="text-sm text-muted">
              The service-role key bypasses row-level security so the admin
              page can read all users. Keep it on the server only — never
              prefix it with NEXT_PUBLIC_.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Pull all users (paginated by listUsers — bump perPage if you exceed it).
  const { data: usersData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const users = usersData?.users ?? [];

  const [profilesRes, feedbackRes, costProfilesCountRes, snapshotsCountRes] =
    await Promise.all([
      admin.from("driver_profiles").select("*"),
      admin
        .from("feedback")
        .select("id,user_id,message,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("cost_profiles").select("*", { count: "exact", head: true }),
      admin
        .from("cost_profile_snapshots")
        .select("*", { count: "exact", head: true }),
    ]);

  const profiles: DriverProfileRow[] = profilesRes.data ?? [];
  const feedback: FeedbackRow[] = feedbackRes.data ?? [];
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = users.filter(
    (u) => now - new Date(u.created_at).getTime() < 7 * day
  ).length;
  const last30 = users.filter(
    (u) => now - new Date(u.created_at).getTime() < 30 * day
  ).length;
  const confirmed = users.filter((u) => Boolean(u.email_confirmed_at)).length;
  const profileFilled = profiles.filter(
    (p) => (p.first_name?.trim() ?? "") && (p.phone?.trim() ?? "")
  ).length;
  const optIn = profiles.filter((p) => p.marketing_opt_in === true).length;

  // Distributions
  function tallyKey(key: keyof DriverProfileRow) {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const v = (p[key] as string | null)?.trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }
  const byState = tallyKey("domicile_state");
  const byTrailer = tallyKey("trailer_type");
  const byAuthority = tallyKey("authority_type");

  const sortedUsers = [...users].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const sumProfileForUser = (uid: string) => profileByUser.get(uid) ?? null;
  const emailByUser = new Map(users.map((u) => [u.id, u.email ?? ""]));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav variant="calculator" email={user.email ?? ""} isAdmin />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black">ProfitRig Admin</h1>
          <p className="text-sm text-muted mt-1">
            Live data from Supabase. Numbers update on every page refresh.
            {allowlistEmpty && (
              <span className="block text-red-600 mt-1">
                Warning: ADMIN_EMAILS env var is empty. Add it in Vercel so
                only you can see this page.
              </span>
            )}
          </p>
        </div>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total signups" value={users.length} />
          <StatCard label="Last 7 days" value={last7} />
          <StatCard label="Last 30 days" value={last30} />
          <StatCard
            label="Email confirmed"
            value={confirmed}
            sublabel={`${users.length - confirmed} pending`}
          />
          <StatCard
            label="Profile filled"
            value={profileFilled}
            sublabel={`of ${users.length}`}
          />
          <StatCard
            label="Marketing opt-in"
            value={optIn}
            sublabel={`of ${profiles.length} profiles`}
          />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard label="Cost profiles saved" value={costProfilesCountRes.count ?? 0} />
          <StatCard
            label="History snapshots"
            value={snapshotsCountRes.count ?? 0}
          />
        </section>

        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3">Recent signups</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Signed up</th>
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">State</th>
                  <th className="py-2 pr-3 font-semibold">Trailer</th>
                  <th className="py-2 pr-3 font-semibold">Authority</th>
                  <th className="py-2 pr-3 font-semibold">Opt-in</th>
                  <th className="py-2 pr-3 font-semibold">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.slice(0, 30).map((u) => {
                  const p = sumProfileForUser(u.id);
                  const name = [p?.first_name, p?.last_name]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-muted">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-2 pr-3 break-all">{u.email}</td>
                      <td className="py-2 pr-3">{name || "—"}</td>
                      <td className="py-2 pr-3">
                        {p?.domicile_state || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {p?.trailer_type
                          ? TRAILER_LABELS[p.trailer_type] ?? p.trailer_type
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {p?.authority_type
                          ? AUTHORITY_LABELS[p.authority_type] ??
                            p.authority_type
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {p?.marketing_opt_in ? "✓" : ""}
                      </td>
                      <td className="py-2 pr-3">
                        {u.email_confirmed_at ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted">
                      No signups yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedUsers.length > 30 && (
            <p className="text-xs text-muted mt-3">
              Showing latest 30 of {sortedUsers.length}.
            </p>
          )}
        </section>

        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3">
            Latest feedback{" "}
            <span className="text-sm text-muted font-normal">
              ({feedback.length})
            </span>
          </h2>
          {feedback.length === 0 ? (
            <p className="text-muted text-sm">No feedback yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {feedback.slice(0, 20).map((f) => (
                <li
                  key={f.id}
                  className="border border-border rounded-xl p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-xs text-muted mb-1">
                    <span>
                      {f.user_id
                        ? emailByUser.get(f.user_id) ?? "Unknown user"
                        : "(deleted user)"}
                    </span>
                    <span>{formatDate(f.created_at)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                </li>
              ))}
            </ul>
          )}
          {feedback.length > 20 && (
            <p className="text-xs text-muted mt-3">
              Showing latest 20 of {feedback.length}.
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold mb-3">By state</h3>
            <div className="flex flex-col gap-2.5">
              {byState.length === 0 && (
                <p className="text-xs text-muted">No data yet.</p>
              )}
              {byState.slice(0, 10).map(([k, v]) => (
                <Bar key={k} label={k} count={v} total={profiles.length} />
              ))}
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold mb-3">By trailer type</h3>
            <div className="flex flex-col gap-2.5">
              {byTrailer.length === 0 && (
                <p className="text-xs text-muted">No data yet.</p>
              )}
              {byTrailer.map(([k, v]) => (
                <Bar
                  key={k}
                  label={TRAILER_LABELS[k] ?? k}
                  count={v}
                  total={profiles.length}
                />
              ))}
            </div>
          </div>
          <div className="bg-white border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold mb-3">By authority</h3>
            <div className="flex flex-col gap-2.5">
              {byAuthority.length === 0 && (
                <p className="text-xs text-muted">No data yet.</p>
              )}
              {byAuthority.map(([k, v]) => (
                <Bar
                  key={k}
                  label={AUTHORITY_LABELS[k] ?? k}
                  count={v}
                  total={profiles.length}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
      <BottomNav isPro />
    </main>
  );
}
