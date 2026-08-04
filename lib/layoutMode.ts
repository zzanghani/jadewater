export const LAYOUT_MODE_COOKIE = "layout_mode";

export type LayoutMode = "mobile" | "desktop";

export function isDesktopMode(value: string | undefined): boolean {
  return value === "desktop";
}
