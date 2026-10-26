"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteTossMerchant, saveTossKeys, saveTossMerchant } from "@/app/(app)/toss/actions";
import type { StoreTossMerchant, TossInstallation } from "@/lib/types";

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground";

export default function TossSettingsForm({
  stores,
  hasKeys,
  accessKeyMasked,
  merchants,
  installations,
  hasWebhookSecret,
  webhookUrl,
}: {
  stores: { id: string; name: string }[];
  hasKeys: boolean;
  accessKeyMasked: string | null;
  merchants: StoreTossMerchant[];
  /** 웹훅으로 들어온 "앱이 설치된 매장" 목록 */
  installations: TossInstallation[];
  hasWebhookSecret: boolean;
  webhookUrl: string;
}) {
  const [keyState, keyAction, keyPending] = useActionState(saveTossKeys, undefined);
  const byStore = new Map(merchants.map((m) => [m.store_id, m]));

  return (
    <div className="flex flex-col gap-4">
      <form action={keyAction} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">1. 앱 인증 키</p>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hasKeys ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {hasKeys ? `저장됨 · ${accessKeyMasked}` : "미등록"}
          </span>
        </div>
        <p className="text-[11px] text-muted">개발자센터 → 내 애플리케이션 → 제이드앤워터 매장관리 → 인증 정보. Secret은 발급 때 한 번만 보여요.</p>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Access Key
          <input name="access_key" className={inputClass} autoComplete="off" placeholder="AK로 시작" required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Access Secret{hasKeys && <span className="text-[10px]"> · 비워두면 기존 값 유지</span>}
          <input name="access_secret" type="password" className={inputClass} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          웹훅 서명 키 (Secret Key){hasWebhookSecret && <span className="text-[10px]"> · 저장됨, 비워두면 유지</span>}
          <input name="webhook_secret" type="password" className={inputClass} autoComplete="off" placeholder="개발자센터 웹훅 생성 때 넣은 값" />
        </label>
        <p className="rounded-lg bg-background px-3 py-2 text-[11px] text-muted">
          웹훅 수신 주소: <span className="break-all font-mono text-foreground">{webhookUrl}</span>
        </p>
        {keyState?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{keyState.error}</p>}
        {keyState?.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{keyState.info}</p>}
        <button type="submit" disabled={keyPending} className="rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {keyPending ? "확인 중..." : "키 저장"}
        </button>
      </form>

      <p className="text-sm font-bold">2. 매장별 가맹점 ID</p>
      <p className="-mt-2 text-[11px] text-muted">
        테스트 가맹점은 개발자센터 → 테스트 가맹점 관리의 &lsquo;가맹점 ID(MerchantId)&rsquo;. 실제 매장은 포스에 앱을 설치하면 ID가 생겨요.
      </p>
      {installations.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-xs">
          <p className="mb-1 font-semibold text-blue-800">포스에 앱이 설치된 매장 (토스에서 자동으로 들어옴)</p>
          <ul className="flex flex-col gap-0.5 text-blue-900">
            {installations.map((i) => (
              <li key={i.merchant_id} className="tabular-nums">
                {i.merchant_name ?? "(이름 없음)"} · ID <b>{i.merchant_id}</b>
                {i.business_number && ` · 사업자 ${i.business_number}`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-blue-800">아래 매장 칸에서 목록에서 골라 연결하세요.</p>
        </div>
      )}
      {stores.map((s) => (
        <MerchantForm key={s.id} store={s} merchant={byStore.get(s.id) ?? null} installations={installations} />
      ))}
    </div>
  );
}

function MerchantForm({
  store,
  merchant,
  installations,
}: {
  store: { id: string; name: string };
  merchant: StoreTossMerchant | null;
  installations: TossInstallation[];
}) {
  const [state, formAction, pending] = useActionState(saveTossMerchant, undefined);
  const [deleting, startDelete] = useTransition();
  const [merchantId, setMerchantId] = useState(merchant?.merchant_id ?? "");
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <input type="hidden" name="store_id" value={store.id} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{store.name}</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${merchant ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {merchant ? `${merchant.is_test ? "테스트 " : ""}연결됨${merchant.merchant_name ? ` · ${merchant.merchant_name}` : ""}` : "미연결"}
        </span>
      </div>
      {installations.length > 0 && (
        <select
          value={installations.some((i) => i.merchant_id === merchantId) ? merchantId : ""}
          onChange={(e) => setMerchantId(e.target.value)}
          className={inputClass}
        >
          <option value="">설치된 매장에서 고르기…</option>
          {installations.map((i) => (
            <option key={i.merchant_id} value={i.merchant_id}>
              {i.merchant_name ?? "(이름 없음)"} · {i.merchant_id}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <input
          name="merchant_id"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          className={inputClass}
          placeholder="가맹점 ID (MerchantId)"
          required
        />
        <button type="submit" disabled={pending} className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          {pending ? "확인 중..." : "연결"}
        </button>
        {merchant && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (!confirm(`${store.name} 토스 연결을 해제할까요?`)) return;
              startDelete(async () => {
                await deleteTossMerchant(store.id);
              });
            }}
            className="shrink-0 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-60"
          >
            해제
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" name="is_test" defaultChecked={merchant?.is_test ?? false} /> 테스트 가맹점
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{state.info}</p>}
    </form>
  );
}
