import { redirect } from "next/navigation";

// Snapshot history moved to the bottom of Profile, and the History tab became
// Fuel. Old links and home-screen shortcuts land on the history there instead
// of a dead page.
export default function HistoryPage() {
  redirect("/profile#history");
}
