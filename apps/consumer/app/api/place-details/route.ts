import { NextRequest, NextResponse } from "next/server";

type GoogleReviewResponse = {
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
  rating?: number;
  text?: {
    text?: string;
  };
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
};

type GooglePlaceResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GoogleReviewResponse[];
};

export async function GET(
  request: NextRequest
) {
  const placeId =
    request.nextUrl.searchParams
      .get("placeId")
      ?.trim();

  if (!placeId) {
    return NextResponse.json(
      {
        error: "Missing placeId.",
      },
      {
        status: 400,
      }
    );
  }

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Google Places is not configured yet.",
      },
      {
        status: 503,
      }
    );
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(
        placeId
      )}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "rating,userRatingCount,reviews,googleMapsUri",
        },
        cache: "no-store",
      }
    );

    const data =
      (await response.json()) as GooglePlaceResponse & {
        error?: unknown;
      };

    if (!response.ok) {
      console.error(
        "Google Places error:",
        data.error || data
      );

      return NextResponse.json(
        {
          error:
            "Could not load Google place details.",
        },
        {
          status: 502,
        }
      );
    }

    const reviews =
      Array.isArray(data.reviews)
        ? data.reviews.map(
            (review) => ({
              authorName:
                review.authorAttribution
                  ?.displayName ||
                "Google Maps user",
              authorUri:
                review.authorAttribution?.uri,
              authorPhotoUri:
                review.authorAttribution
                  ?.photoUri,
              rating:
                typeof review.rating ===
                "number"
                  ? review.rating
                  : 0,
              text:
                review.text?.text || "",
              relativeTime:
                review.relativePublishTimeDescription,
              googleMapsUri:
                review.googleMapsUri,
            })
          )
        : [];

    return NextResponse.json({
      rating:
        typeof data.rating === "number"
          ? data.rating
          : undefined,
      userRatingCount:
        typeof data.userRatingCount ===
        "number"
          ? data.userRatingCount
          : undefined,
      googleMapsUri:
        data.googleMapsUri,
      reviews,
    });
  } catch (error) {
    console.error(
      "Google Places request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not load Google place details.",
      },
      {
        status: 500,
      }
    );
  }
}
