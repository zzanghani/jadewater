"use server";

// 월 매출 목표 표 (운영관리 앱 B 블록): 목표 · 누적(어제까지) · 달성률 · 월말 예상 · 예상 달성률 ·
// 남은 날 하루 필요 · 평소 하루 페이스 · 상태. 매출은 토스가 연결된 매장은 토스, 아니면 마감입력.
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addYmd, kstYmd } from "@/lib/adReport";

export type TargetRow = {
  storeId: string;
  name: string;
  target: number | null;
  mtd: number; // 이번 달 누적(어제까지)
  mtdDays: number;
  rate: number | null; // 달성률 %
  projected: number; // 월말 예상 = 누적 + 남은 날마다 최근 4주 같은 요일 평균
  projectedRate: number | null;
  needPerDay: number | null; // 남은 날 하루 필요
  pace: number; // 평소 하루 페이스(최근 28일 영업일 평균)
  remainingDays: number;
  status: "done" | "likely" | "close" | "behind" | "none";
  source: "toss" | "closing";
};
export type TargetsResult = { ok: true; month: string; rows: TargetRow[]; canEdit: boolean } | { ok: false; error: string };

const wd = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();

export async function loadMonthlyTargets(): Promise<TargetsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved") return { ok: false, error: "권한이 없어요." };
  const canEdit = p.role === "owner" && !p.store_id && !p.department;

  let sq = supabase.from("stores").select("id, name").order("name");
  if (p.store_id) sq = sq.eq("id", p.store_id);
  const { data: stores } = await sq;
  if (!stores?.length) return { ok: false, error: "매장이 없어요." };

  const service = createServiceClient();
  const today = kstYmd(0);
  const month = today.slice(0, 7);
  const monthStart = month + "-01";
  const nextMonth = addYmd(month + "-28", 4).slice(0, 7) + "-01";
  const monthEnd = addYmd(nextMonth, -1);
  const y = addYmd(today, -1);
  const from = addYmd(today, -35);
  const ids = stores.map((s) => s.id);
  const [{ data: targets }, { data: merchants }, { data: toss }, { data: closings }] = await Promise.all([
    service.from("store_monthly_targets").select("store_id, target").eq("month", month).in("store_id", ids),
    service.from("store_toss_merchants").select("store_id").in("store_id", ids),
    service.from("toss_daily_sales").select("store_id, date, sales").in("store_id", ids).gte("date", from).lte("date", y),
    service.from("daily_closings").select("store_id, date, grand_total").in("store_id", ids).gte("date", from).lte("date", y),
  ]);
  const targetBy = new Map((targets ?? []).map((t) => [t.store_id, t.target]));
  const tossStores = new Set((merchants ?? []).map((m) => m.store_id));
  const salesBy = new Map<string, Map<string, number>>();
  for (const r of closings ?? []) {
    if (tossStores.has(r.store_id) || !(r.grand_total > 0)) continue;
    (salesBy.get(r.store_id) ?? salesBy.set(r.store_id, new Map()).get(r.store_id)!).set(r.date, r.grand_total);
  }
  for (const r of toss ?? []) {
    if (!tossStores.has(r.store_id)) continue;
    (salesBy.get(r.store_id) ?? salesBy.set(r.store_id, new Map()).get(r.store_id)!).set(r.date, r.sales);
  }

  const rows: TargetRow[] = stores.map((s) => {
    const m = salesBy.get(s.id) ?? new Map<string, number>();
    let mtd = 0;
    let mtdDays = 0;
    for (let d = monthStart; d <= y; d = addYmd(d, 1)) {
      const v = m.get(d);
      if (v != null) {
        mtd += v;
        if (v > 0) mtdDays++;
      }
    }
    // 요일별 최근 4주 평균 (자료 있는 날만)
    const byWd: number[][] = Array.from({ length: 7 }, () => []);
    for (let d = addYmd(y, -27); d <= y; d = addYmd(d, 1)) {
      const v = m.get(d);
      if (v != null && v > 0) byWd[wd(d)].push(v);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((x, z) => x + z, 0) / a.length : 0);
    const wdAvg = byWd.map(avg);
    const all = byWd.flat();
    const pace = avg(all);
    let projected = mtd;
    let remainingDays = 0;
    for (let d = today; d <= monthEnd; d = addYmd(d, 1)) {
      remainingDays++;
      projected += wdAvg[wd(d)] || pace;
    }
    const target = targetBy.get(s.id) ?? null;
    const rate = target ? (mtd / target) * 100 : null;
    const projectedRate = target ? (projected / target) * 100 : null;
    const needPerDay = target && remainingDays ? Math.max(0, (target - mtd) / remainingDays) : null;
    const status: TargetRow["status"] = !target ? "none" : rate! >= 100 ? "done" : projectedRate! >= 100 ? "likely" : projectedRate! >= 90 ? "close" : "behind";
    return { storeId: s.id, name: s.name, target, mtd: Math.round(mtd), mtdDays, rate, projected: Math.round(projected), projectedRate, needPerDay: needPerDay == null ? null : Math.round(needPerDay), pace: Math.round(pace), remainingDays, status, source: tossStores.has(s.id) ? "toss" : "closing" };
  });
  return { ok: true, month, rows, canEdit };
}

export async function saveMonthlyTarget(storeId: string, month: string, target: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const { data: p } = await supabase.from("profiles").select("role, store_id, department, status").eq("id", user.id).maybeSingle();
  if (!p || p.status !== "approved" || p.role !== "owner" || p.store_id || p.department) return { ok: false, error: "목표는 본사 마스터만 바꿀 수 있어요." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "월이 올바르지 않아요." };
  const t = Math.round(Number(target));
  if (!isFinite(t) || t < 0) return { ok: false, error: "목표 금액을 숫자로 넣어 주세요." };
  const service = createServiceClient();
  if (t === 0) {
    const { error } = await service.from("store_monthly_targets").delete().eq("store_id", storeId).eq("month", month);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await service.from("store_monthly_targets").upsert({ store_id: storeId, month, target: t, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "store_id,month" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
