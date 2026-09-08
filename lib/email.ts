// Resend HTTP API로 메일을 보낸다. bestmateco.com 도메인은 Resend에 인증돼 있어서
// 그 도메인의 아무 주소나 보내는 사람으로 쓸 수 있다.
const FROM = "베스트메이트컴퍼니 앱 <app@bestmateco.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "메일 발송 설정(RESEND_API_KEY)이 아직 안 돼 있어요." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[sendEmail] Resend 실패", res.status, detail);
    return { error: "메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }
  return {};
}
