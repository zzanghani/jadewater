"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LAYOUT_MODE_COOKIE, isDesktopMode } from "@/lib/layoutMode";

export async function toggleLayoutMode() {
  const cookieStore = await cookies();
  const current = cookieStore.get(LAYOUT_MODE_COOKIE)?.value;
  const next = isDesktopMode(current) ? "mobile" : "desktop";

  cookieStore.set(LAYOUT_MODE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
