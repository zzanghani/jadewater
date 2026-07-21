import { formatWon } from "@/lib/format";

export function buildKakaoMessage(params: {
  vendorName: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  date: string;
}): string {
  const { vendorName, amount, bankName, accountNumber, date } = params;
  const lines = [
    "📌 입금요청",
    `거래처: ${vendorName || "-"}`,
    `금액: ${amount > 0 ? formatWon(amount) : "-"}`,
  ];

  if (bankName?.trim()) {
    lines.push(`은행: ${bankName.trim()}`);
  }
  if (accountNumber?.trim()) {
    lines.push(`계좌번호: ${accountNumber.trim()}`);
  }

  lines.push(`요청일: ${date}`);
  lines.push("");
  lines.push("위 내용 확인 후 입금 부탁드립니다 🙏");

  return lines.join("\n");
}
