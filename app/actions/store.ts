"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { STORE_COOKIE } from "@/lib/store";

export async function selectStore(formData: FormData) {
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return;

  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, storeId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
