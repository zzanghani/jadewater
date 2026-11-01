import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import BrandModulesPanel from "@/components/BrandModulesPanel";

// 브랜드별 기능 모듈 켜고 끄기 — 본사 마스터 전용.
// 결제가 붙기 전까지의 수동 운영 화면이고, 결제가 붙으면 이 표가 "결제 상태"를 보여주는 화면이 된다.
export default async function ModulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("store_id, department")
    .eq("id", user.id)
    .single();
  const isMaster = !!profile && !profile.store_id && !profile.department;
  if (!isMaster) redirect("/");

  const [{ data: brands }, { data: rows }, { data: stores }] = await Promise.all([
    supabase.from("brands").select("id, name, sort_order").order("sort_order"),
    supabase.from("brand_modules").select("brand_id, module_key, status, trial_ends_at, note, updated_at"),
    supabase.from("stores").select("id, brand_id"),
  ]);

  const storeCountByBrand = new Map<string, number>();
  for (const s of stores ?? []) storeCountByBrand.set(s.brand_id, (storeCountByBrand.get(s.brand_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">기능 구독</h1>
        <p className="mt-1 text-sm text-muted">
          기본 기능은 누구나 무료이고, 추가 기능만 브랜드마다 여기서 켜고 끕니다. 끄면 그 브랜드 매장 계정(지점장·직원)의
          메뉴에서 바로 사라지고, 주소로 들어가도 안내 화면이 나와요. 본사 계정은 항상 전부 봅니다.
          결제 기능이 붙기 전까지는 이 화면이 결제 대신이에요.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-3 text-xs text-muted">
        <p className="font-semibold text-foreground">기본 기능(무료)</p>
        <p className="mt-1">
          마감입력 · 입고 · 현장지출 · 입금요청 · 재고 · 스케줄러 · 매출 분석 · 매출 목표 · 게시판 · 메시지 ·
          주간보고 · 월간계획 · 포스(토스) 연동
        </p>
      </section>

      <BrandModulesPanel
        brands={(brands ?? []).map((b) => ({ ...b, storeCount: storeCountByBrand.get(b.id) ?? 0 }))}
        modules={MODULES.map(({ key, name, summary, priceMonthly }) => ({ key, name, summary, priceMonthly }))}
        rows={rows ?? []}
      />
    </div>
  );
}
