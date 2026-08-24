import { createClient } from "@/lib/supabase/server";
import { getStoreContext } from "@/lib/store";
import { kstDateString } from "@/lib/date";
import PeerFeedbackPageClient from "@/components/PeerFeedbackPageClient";
import type { Employee } from "@/lib/types";

export default async function PeerFeedbackPage() {
  const supabase = await createClient();
  const { storeId, storeName } = await getStoreContext(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const period = kstDateString(0).slice(0, 7);

  const [{ data: employees }, { data: mySubmissions }] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .eq("store_id", storeId)
      .is("resigned_at", null)
      .order("name", { ascending: true }),
    user
      ? supabase
          .from("peer_feedback")
          .select("employee_id")
          .eq("period", period)
          .eq("created_by", user.id)
      : { data: [] as { employee_id: string }[] },
  ]);

  const submittedIds = new Set((mySubmissions ?? []).map((r) => r.employee_id));

  return (
    <PeerFeedbackPageClient
      storeName={storeName}
      period={period}
      employees={(employees ?? []) as Employee[]}
      submittedIds={[...submittedIds]}
    />
  );
}
