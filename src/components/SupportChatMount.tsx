import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupportChat } from "./SupportChat";

// Server wrapper: the chat is a signed-in feature. Visitors on "/" and the
// login page never see it.
export async function SupportChatMount() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return <SupportChat />;
}
