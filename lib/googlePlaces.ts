export type GooglePlaceReview = {
  sourceId: string;
  rating: number;
  body: string;
};

export type GooglePlaceSnapshot = {
  rating: number;
  reviewCount: number;
  reviews: GooglePlaceReview[];
};

export type GooglePlaceResult =
  | { ok: true; snapshot: GooglePlaceSnapshot }
  | { ok: false; error: string };

// Google Places API (New)에서 매장의 평점/리뷰수/최신 리뷰(최대 5개, "관련도순")를 가져온다.
// 실패하면 null 대신 이유(HTTP 상태 + 구글이 준 메시지)를 돌려준다. 예전엔 null 만 돌려줘서
// 구글 쪽 키·결제 문제로 수집이 통째로 멈춰도(2026-10-21~) 어디서도 이유가 안 보였다.
// 키 값은 절대 로그에 남기지 않는다.
export async function fetchGooglePlaceSnapshot(
  placeId: string,
  apiKey: string
): Promise<GooglePlaceResult> {
  let res: Response;
  try {
    res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=ko`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `구글 요청 실패: ${msg}` };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { status?: string; message?: string } };
      detail = [body.error?.status, body.error?.message].filter(Boolean).join(" ");
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 남긴다.
    }
    return { ok: false, error: `구글 HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ""}` };
  }

  const data = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    reviews?: { name: string; rating: number; text?: { text: string } }[];
  };

  return {
    ok: true,
    snapshot: {
      rating: data.rating ?? 0,
      reviewCount: data.userRatingCount ?? 0,
      reviews: (data.reviews ?? []).map((r) => ({
        sourceId: r.name,
        rating: r.rating,
        body: r.text?.text ?? "",
      })),
    },
  };
}
