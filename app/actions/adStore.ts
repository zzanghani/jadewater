"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AD_STORE_COOKIE, adCanView } from "@/lib/adAccess";

// 광고 화면 머리글의 매장 선택. 볼 수 있는 매장(마스터 전부·지점장은 같은 브랜드)만 받아 쿠키에 적는다.
export async function selectAdStore(formData: FormData) {
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase.from("profiles").select("role, store_id, department").eq("id", user.id).maybeSingle();
  if (!(await adCanView(createServiceClient(), profile, storeId))) return;

  const cookieStore = await cookies();
  cookieStore.set(AD_STORE_COOKIE, storeId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/ad-report", "layout");
}
