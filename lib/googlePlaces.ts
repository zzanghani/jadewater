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

// Google Places API (New)에서 매장의 평점/리뷰수/최신 리뷰(최대 5개, "관련도순")를 가져온다.
export async function fetchGooglePlaceSnapshot(
  placeId: string,
  apiKey: string
): Promise<GooglePlaceSnapshot | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=ko`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews",
      },
    }
  );

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    reviews?: { name: string; rating: number; text?: { text: string } }[];
  };

  return {
    rating: data.rating ?? 0,
    reviewCount: data.userRatingCount ?? 0,
    reviews: (data.reviews ?? []).map((r) => ({
      sourceId: r.name,
      rating: r.rating,
      body: r.text?.text ?? "",
    })),
  };
}
