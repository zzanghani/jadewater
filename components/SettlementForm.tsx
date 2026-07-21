"use client";

import { forwardRef, useActionState, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { saveSettlement } from "@/app/(app)/settlement/actions";
import { formatPercent, formatWon } from "@/lib/format";
import type {
  LaborItem,
  LineItem,
  MonthlySettlement,
  UtilityCategory,
  UtilityItem,
} from "@/lib/types";

type AutoSales = {
  totalSales: number;
  foodSales: number;
  beverageSales: number;
  wineSales: number;
  rentalSales: number;
  coupangSales: number;
  baeminSales: number;
};

type SupplierRow = { supplier: string; amount: number };

const STAFF_TYPES = ["정직원", "파트타이머"];
const UTILITY_CATEGORIES: UtilityCategory[] = [
  "임대료(수수료)",
  "전기요금",
  "가스요금",
  "수도요금",
  "관리비",
  "기타",
];

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

let itemKeySeq = 0;
function nextKey() {
  itemKeySeq += 1;
  return itemKeySeq;
}

export default function SettlementForm({
  storeId,
  storeName,
  month,
  monthLabel,
  autoSales,
  supplierList,
  purchaseTotal,
  autoDiscountTotal,
  existing,
}: {
  storeId: string;
  storeName: string;
  month: string;
  monthLabel: string;
  autoSales: AutoSales;
  supplierList: SupplierRow[];
  purchaseTotal: number;
  autoDiscountTotal: number;
  existing?: MonthlySettlement;
}) {
  const [state, formAction, pending] = useActionState(saveSettlement, undefined);

  const [managerName, setManagerName] = useState(existing?.manager_name ?? "");
  const [laborItems, setLaborItems] = useState<(LaborItem & { key: number })[]>(
    () => (existing?.labor_items ?? []).map((i) => ({ ...i, key: nextKey() }))
  );
  const [utilityItems, setUtilityItems] = useState<(UtilityItem & { key: number })[]>(
    () => (existing?.utility_items ?? []).map((i) => ({ ...i, key: nextKey() }))
  );
  const [hqFeeItems, setHqFeeItems] = useState<(LineItem & { key: number })[]>(
    () => (existing?.hq_fee_items ?? []).map((i) => ({ ...i, key: nextKey() }))
  );

  const [reserveCarryover, setReserveCarryover] = useState(
    existing?.reserve_carryover ?? 0
  );
  const [reserveDeduction, setReserveDeduction] = useState(
    existing?.reserve_deduction ?? 0
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const reportRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const totalSales = autoSales.totalSales;

  const laborTotal = sum(laborItems.map((i) => i.amount));
  const utilityTotal = sum(utilityItems.map((i) => i.amount));
  const hqFeeTotal = sum(hqFeeItems.map((i) => i.amount));

  // 세금 및 유보금은 직접 입력하지 않고 위 집계값에서 자동 계산한다.
  const pensionReserve = Math.round(laborTotal * 0.1);
  const vatReserve = Math.round(totalSales * 0.06);
  const corpTaxReserve = Math.round(totalSales * 0.06);
  const taxReserveTotal = pensionReserve + vatReserve + corpTaxReserve;
  const totalExpense =
    purchaseTotal +
    laborTotal +
    utilityTotal +
    hqFeeTotal +
    taxReserveTotal +
    autoDiscountTotal;
  const netProfit = totalSales - totalExpense;
  const corpReserve =
    pensionReserve + vatReserve + corpTaxReserve + reserveCarryover - reserveDeduction;

  async function handleSaveImage() {
    if (!reportRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${storeName}_${monthLabel}_정산.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AutoSummary
        autoSales={autoSales}
        supplierList={supplierList}
        purchaseTotal={purchaseTotal}
        totalExpense={totalExpense}
        netProfit={netProfit}
        autoDiscountTotal={autoDiscountTotal}
      />

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="store_id" value={storeId} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="pension_reserve" value={pensionReserve} />
        <input type="hidden" name="vat_reserve" value={vatReserve} />
        <input type="hidden" name="corp_tax_reserve" value={corpTaxReserve} />
        <input type="hidden" name="discount_amount" value={autoDiscountTotal} />
        <input
          type="hidden"
          name="labor_items_json"
          value={JSON.stringify(laborItems.map(stripKey))}
          readOnly
        />
        <input
          type="hidden"
          name="utility_items_json"
          value={JSON.stringify(utilityItems.map(stripKey))}
          readOnly
        />
        <input
          type="hidden"
          name="hq_fee_items_json"
          value={JSON.stringify(hqFeeItems.map(stripKey))}
          readOnly
        />

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          담당자
          <input
            type="text"
            name="manager_name"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="예) 이창한 점장"
            className="rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        <ItemListEditor
          title="인건비 세부내역"
          total={laborTotal}
          items={laborItems}
          onChange={setLaborItems}
          showType
        />

        <ItemListEditor
          title="공과금"
          total={utilityTotal}
          items={utilityItems}
          onChange={setUtilityItems}
          showType
          typeOptions={UTILITY_CATEGORIES}
          namePlaceholder="메모 (선택)"
        />

        <ItemListEditor
          title="판관비"
          total={hqFeeTotal}
          items={hqFeeItems}
          onChange={setHqFeeItems}
        />

        <FieldGroup title="세금 및 유보금 (자동계산)" total={formatWon(taxReserveTotal)}>
          <ComputedRow
            label="퇴직연금(예상)"
            hint="인건비 합계의 10%"
            value={pensionReserve}
            percent={formatPercent(pensionReserve, totalSales)}
          />
          <ComputedRow
            label="부가가치세(예상)"
            hint="총매출의 6%"
            value={vatReserve}
            percent={formatPercent(vatReserve, totalSales)}
          />
          <ComputedRow
            label="법인세(예상)"
            hint="총매출의 6%"
            value={corpTaxReserve}
            percent={formatPercent(corpTaxReserve, totalSales)}
          />
        </FieldGroup>

        <FieldGroup title="유보금 조정" total={formatWon(reserveCarryover - reserveDeduction)}>
          <NumberField
            label="유보금 이월금액"
            name="reserve_carryover"
            value={reserveCarryover}
            onValueChange={setReserveCarryover}
            percentOf={totalSales}
          />
          <NumberField
            label="법인차감금액"
            name="reserve_deduction"
            value={reserveDeduction}
            onValueChange={setReserveDeduction}
            percentOf={totalSales}
          />
        </FieldGroup>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          특이사항
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예) 7월 임대료 인상 예정 등"
            className="resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-2xl bg-brand-light p-4 text-sm">
          <SummaryRow label="총매출" value={totalSales} percent={formatPercent(totalSales, totalSales)} />
          <SummaryRow
            label="총지출"
            value={totalExpense}
            percent={formatPercent(totalExpense, totalSales)}
          />
          <div className="flex items-center justify-between border-t border-brand/20 pt-2">
            <span className="font-semibold text-brand-dark">당기순이익</span>
            <span className="text-right">
              <span
                className={`block text-base font-bold ${netProfit >= 0 ? "text-brand-dark" : "text-red-600"}`}
              >
                {formatWon(netProfit)}
              </span>
              <span className="block text-[11px] text-brand-dark/70">
                {formatPercent(netProfit, totalSales)}
              </span>
            </span>
          </div>
          <SummaryRow
            label="법인유보금"
            value={corpReserve}
            percent={formatPercent(corpReserve, totalSales)}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            저장되었습니다.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/30 transition-opacity disabled:opacity-60"
        >
          {pending ? "저장 중..." : "정산 저장"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">정산 리포트</h2>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={capturing}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {capturing ? "생성 중..." : "이미지로 저장"}
          </button>
        </div>

        <SettlementReport
          ref={reportRef}
          storeName={storeName}
          monthLabel={monthLabel}
          managerName={managerName}
          autoSales={autoSales}
          supplierList={supplierList}
          purchaseTotal={purchaseTotal}
          laborItems={laborItems}
          laborTotal={laborTotal}
          utilityItems={utilityItems}
          utilityTotal={utilityTotal}
          hqFeeItems={hqFeeItems}
          hqFeeTotal={hqFeeTotal}
          pensionReserve={pensionReserve}
          vatReserve={vatReserve}
          corpTaxReserve={corpTaxReserve}
          discountAmount={autoDiscountTotal}
          totalExpense={totalExpense}
          netProfit={netProfit}
          corpReserve={corpReserve}
        />
      </section>
    </div>
  );
}

function stripKey<T extends { key: number }>(item: T): Omit<T, "key"> {
  const { key: _key, ...rest } = item;
  return rest;
}

function SummaryRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-dark/80">{label}</span>
      <span className="text-right">
        <span className="font-semibold text-brand-dark">{formatWon(value)}</span>
        <span className="ml-1.5 text-[11px] text-brand-dark/70">{percent}</span>
      </span>
    </div>
  );
}

function FieldGroup({
  title,
  total,
  children,
}: {
  title: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-sm font-bold text-brand">{total}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  name,
  value,
  onValueChange,
  percentOf,
}: {
  label: string;
  name?: string;
  value: number;
  onValueChange: (v: number) => void;
  percentOf?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="flex items-baseline justify-between">
        {label}
        {percentOf !== undefined && (
          <span className="text-[11px] font-normal text-muted">
            {formatPercent(value, percentOf)}
          </span>
        )}
      </span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          name={name}
          value={value ? String(value) : ""}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onValueChange(digits ? Number(digits) : 0);
          }}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-10 outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">
          원
        </span>
      </div>
    </label>
  );
}

function ComputedRow({
  label,
  hint,
  value,
  percent,
}: {
  label: string;
  hint: string;
  value: number;
  percent: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted">{hint}</p>
      </div>
      <span className="text-right">
        <span className="block text-sm font-semibold text-foreground">
          {formatWon(value)}
        </span>
        <span className="block text-[11px] text-muted">{percent}</span>
      </span>
    </div>
  );
}

function ItemListEditor<T extends LineItem & { key: number; type?: string }>({
  title,
  total,
  items,
  onChange,
  showType = false,
  typeOptions = STAFF_TYPES,
  namePlaceholder = "항목명",
}: {
  title: string;
  total: number;
  items: T[];
  onChange: (items: T[]) => void;
  showType?: boolean;
  typeOptions?: string[];
  namePlaceholder?: string;
}) {
  function updateItem(key: number, patch: Partial<T>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: number) {
    onChange(items.filter((item) => item.key !== key));
  }

  function addItem() {
    const base = { name: "", amount: 0, key: nextKey() } as T;
    onChange([...items, showType ? { ...base, type: typeOptions[0] } : base]);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-sm font-bold text-brand">{formatWon(total)}</span>
      </div>

      {items.length === 0 && (
        <p className="mb-2 text-xs text-muted">항목을 추가해 주세요.</p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {showType && (
                <select
                  value={item.type}
                  onChange={(e) => updateItem(item.key, { type: e.target.value } as Partial<T>)}
                  className="rounded-lg border border-border bg-card px-1.5 py-2 text-xs text-foreground outline-none"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(item.key, { name: e.target.value } as Partial<T>)}
                placeholder={namePlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-2 text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
              />
              <input
                type="text"
                inputMode="numeric"
                value={item.amount ? String(item.amount) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  updateItem(item.key, {
                    amount: digits ? Number(digits) : 0,
                  } as Partial<T>);
                }}
                placeholder="0"
                className="w-24 shrink-0 rounded-lg border border-border bg-card px-2.5 py-2 text-right text-sm outline-none ring-brand/30 placeholder:text-muted focus:ring-2"
              />
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                aria-label="삭제"
                className="shrink-0 rounded-lg p-2 text-muted hover:text-red-500"
              >
                ✕
              </button>
            </div>
            {item.amount > 0 && (
              <p className="pr-9 text-right text-[11px] text-muted">
                항목 합계 대비 {formatPercent(item.amount, total)}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="mt-3 w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
      >
        + 항목 추가
      </button>
    </div>
  );
}

function AutoSummary({
  autoSales,
  supplierList,
  purchaseTotal,
  totalExpense,
  netProfit,
  autoDiscountTotal,
}: {
  autoSales: AutoSales;
  supplierList: SupplierRow[];
  purchaseTotal: number;
  totalExpense: number;
  netProfit: number;
  autoDiscountTotal: number;
}) {
  const totalSales = autoSales.totalSales;

  return (
    <section className="flex flex-col gap-3">
      <BigStatCard label="이번달 총매출 (자동집계)" value={totalSales} tone="brand" />
      <BigStatCard
        label="이번달 총지출 (모든 지출의 합)"
        value={totalExpense}
        percent={formatPercent(totalExpense, totalSales)}
        tone="neutral"
      />
      <BigStatCard
        label="당기순이익"
        value={netProfit}
        percent={formatPercent(netProfit, totalSales)}
        tone="profit"
      />
      <BigStatCard
        label="이번달 할인금액 (자동집계)"
        value={autoDiscountTotal}
        percent={formatPercent(autoDiscountTotal, totalSales)}
        tone="neutral"
      />

      <div className="grid grid-cols-4 gap-2">
        <MiniStat
          label="음식"
          value={autoSales.foodSales}
          percent={formatPercent(autoSales.foodSales, totalSales)}
        />
        <MiniStat
          label="음료"
          value={autoSales.beverageSales}
          percent={formatPercent(autoSales.beverageSales, totalSales)}
        />
        <MiniStat
          label="와인"
          value={autoSales.wineSales}
          percent={formatPercent(autoSales.wineSales, totalSales)}
        />
        <MiniStat
          label="대관"
          value={autoSales.rentalSales}
          percent={formatPercent(autoSales.rentalSales, totalSales)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat
          label="쿠팡이츠"
          value={autoSales.coupangSales}
          percent={formatPercent(autoSales.coupangSales, totalSales)}
        />
        <MiniStat
          label="배달의민족"
          value={autoSales.baeminSales}
          percent={formatPercent(autoSales.baeminSales, totalSales)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            거래처별 매입 (자동집계)
          </h3>
          <span className="text-sm font-bold text-brand">{formatWon(purchaseTotal)}</span>
        </div>
        {supplierList.length === 0 ? (
          <p className="text-xs text-muted">이번달 등록된 입고 내역이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {supplierList.map((s) => (
              <li key={s.supplier} className="flex items-center justify-between text-xs">
                <span className="text-muted">{s.supplier}</span>
                <span className="text-right">
                  <span className="font-medium text-foreground">{formatWon(s.amount)}</span>
                  <span className="ml-1.5 text-muted">
                    {formatPercent(s.amount, purchaseTotal)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BigStatCard({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: number;
  percent?: string;
  tone: "brand" | "neutral" | "profit";
}) {
  if (tone === "brand") {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-4 text-white shadow-lg shadow-brand/25">
        <p className="text-sm text-white/85">{label}</p>
        <p className="mt-1 text-2xl font-bold">{formatWon(value)}</p>
      </div>
    );
  }

  const valueColor =
    tone === "profit" ? (value >= 0 ? "text-brand-dark" : "text-red-600") : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{formatWon(value)}</p>
      {percent && <p className="mt-0.5 text-xs text-muted">{percent}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{formatWon(value)}</p>
      <p className="text-[11px] text-muted">{percent}</p>
    </div>
  );
}

type ReportProps = {
  storeName: string;
  monthLabel: string;
  managerName: string;
  autoSales: AutoSales;
  supplierList: SupplierRow[];
  purchaseTotal: number;
  laborItems: (LaborItem & { key: number })[];
  laborTotal: number;
  utilityItems: (UtilityItem & { key: number })[];
  utilityTotal: number;
  hqFeeItems: (LineItem & { key: number })[];
  hqFeeTotal: number;
  pensionReserve: number;
  vatReserve: number;
  corpTaxReserve: number;
  discountAmount: number;
  totalExpense: number;
  netProfit: number;
  corpReserve: number;
};

const SettlementReport = forwardRef<HTMLDivElement, ReportProps>(function SettlementReport(
  {
    storeName,
    monthLabel,
    managerName,
    autoSales,
    supplierList,
    purchaseTotal,
    laborItems,
    laborTotal,
    utilityItems,
    utilityTotal,
    hqFeeItems,
    hqFeeTotal,
    pensionReserve,
    vatReserve,
    corpTaxReserve,
    discountAmount,
    totalExpense,
    netProfit,
    corpReserve,
  },
  ref
) {
  const totalSales = autoSales.totalSales;

  return (
    <div ref={ref} className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 text-[#1c2624]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <p className="text-lg font-bold">{storeName}</p>
          <p className="text-sm text-muted">{monthLabel} 결산보고</p>
        </div>
        <div className="text-right text-sm text-muted">
          <p>담당자</p>
          <p className="font-semibold text-foreground">{managerName || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <ReportStat label="총매출" value={totalSales} percent={formatPercent(totalSales, totalSales)} />
        <ReportStat
          label="총지출"
          value={totalExpense}
          percent={formatPercent(totalExpense, totalSales)}
        />
        <ReportStat
          label="당기순이익"
          value={netProfit}
          percent={formatPercent(netProfit, totalSales)}
          highlight
        />
      </div>

      <ReportSection
        title="카테고리별 매출"
        amount={
          autoSales.foodSales +
          autoSales.beverageSales +
          autoSales.wineSales +
          autoSales.rentalSales +
          autoSales.coupangSales +
          autoSales.baeminSales
        }
        percent={formatPercent(
          autoSales.foodSales +
            autoSales.beverageSales +
            autoSales.wineSales +
            autoSales.rentalSales +
            autoSales.coupangSales +
            autoSales.baeminSales,
          totalSales
        )}
      >
        <ReportRow
          label="음식"
          value={autoSales.foodSales}
          percent={formatPercent(autoSales.foodSales, totalSales)}
        />
        <ReportRow
          label="음료"
          value={autoSales.beverageSales}
          percent={formatPercent(autoSales.beverageSales, totalSales)}
        />
        <ReportRow
          label="와인"
          value={autoSales.wineSales}
          percent={formatPercent(autoSales.wineSales, totalSales)}
        />
        <ReportRow
          label="대관"
          value={autoSales.rentalSales}
          percent={formatPercent(autoSales.rentalSales, totalSales)}
        />
        <ReportRow
          label="쿠팡이츠"
          value={autoSales.coupangSales}
          percent={formatPercent(autoSales.coupangSales, totalSales)}
        />
        <ReportRow
          label="배달의민족"
          value={autoSales.baeminSales}
          percent={formatPercent(autoSales.baeminSales, totalSales)}
        />
      </ReportSection>

      <ReportSection
        title="거래처 매입"
        amount={purchaseTotal}
        percent={formatPercent(purchaseTotal, totalExpense)}
      >
        {supplierList.length === 0 ? (
          <p className="text-xs text-muted">내역 없음</p>
        ) : (
          supplierList.map((s) => (
            <ReportRow
              key={s.supplier}
              label={s.supplier}
              value={s.amount}
              percent={formatPercent(s.amount, purchaseTotal)}
            />
          ))
        )}
      </ReportSection>

      <ReportSection
        title="인건비"
        amount={laborTotal}
        percent={formatPercent(laborTotal, totalExpense)}
      >
        {laborItems.length === 0 ? (
          <p className="text-xs text-muted">내역 없음</p>
        ) : (
          laborItems.map((i) => (
            <ReportRow
              key={i.key}
              label={`${i.name} (${i.type})`}
              value={i.amount}
              percent={formatPercent(i.amount, laborTotal)}
            />
          ))
        )}
      </ReportSection>

      <ReportSection
        title="공과금"
        amount={utilityTotal}
        percent={formatPercent(utilityTotal, totalExpense)}
      >
        {utilityItems.length === 0 ? (
          <p className="text-xs text-muted">내역 없음</p>
        ) : (
          utilityItems.map((i) => (
            <ReportRow
              key={i.key}
              label={i.name ? `${i.type} - ${i.name}` : i.type}
              value={i.amount}
              percent={formatPercent(i.amount, utilityTotal)}
            />
          ))
        )}
      </ReportSection>

      <ReportSection
        title="판관비"
        amount={hqFeeTotal}
        percent={formatPercent(hqFeeTotal, totalExpense)}
      >
        {hqFeeItems.length === 0 ? (
          <p className="text-xs text-muted">내역 없음</p>
        ) : (
          hqFeeItems.map((i) => (
            <ReportRow
              key={i.key}
              label={i.name}
              value={i.amount}
              percent={formatPercent(i.amount, hqFeeTotal)}
            />
          ))
        )}
      </ReportSection>

      <ReportSection
        title="세금·유보금·할인"
        amount={pensionReserve + vatReserve + corpTaxReserve + discountAmount}
        percent={formatPercent(
          pensionReserve + vatReserve + corpTaxReserve + discountAmount,
          totalExpense
        )}
      >
        <ReportRow
          label="퇴직연금(예상)"
          value={pensionReserve}
          percent={formatPercent(pensionReserve, totalSales)}
        />
        <ReportRow
          label="부가가치세(예상)"
          value={vatReserve}
          percent={formatPercent(vatReserve, totalSales)}
        />
        <ReportRow
          label="법인세(예상)"
          value={corpTaxReserve}
          percent={formatPercent(corpTaxReserve, totalSales)}
        />
        <ReportRow
          label="할인금액"
          value={discountAmount}
          percent={formatPercent(discountAmount, totalSales)}
        />
        <ReportRow
          label="법인유보금"
          value={corpReserve}
          percent={formatPercent(corpReserve, totalSales)}
        />
      </ReportSection>
    </div>
  );
});

function ReportSection({
  title,
  amount,
  percent,
  children,
}: {
  title: string;
  amount?: number;
  percent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">{title}</p>
        {amount !== undefined && (
          <p className="text-xs font-semibold text-foreground">
            {formatWon(amount)}
            <span className="ml-1 font-normal text-muted">{percent}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function ReportRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-right">
        <span className="font-medium text-foreground">{formatWon(value)}</span>
        <span className="ml-1.5 text-muted">{percent}</span>
      </span>
    </div>
  );
}

function ReportStat({
  label,
  value,
  percent,
  highlight = false,
}: {
  label: string;
  value: number;
  percent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-2 ${highlight ? "bg-brand-light" : "bg-[#f5faf8]"}`}
    >
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          highlight ? (value >= 0 ? "text-brand-dark" : "text-red-600") : "text-foreground"
        }`}
      >
        {formatWon(value)}
      </p>
      <p className="text-[10px] text-muted">{percent}</p>
    </div>
  );
}
