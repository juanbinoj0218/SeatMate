import type { MetadataRoute } from "next";

import { CONSUMER_SITE_URL } from "@seatmate/shared/site-urls";

import { listCitiesServer, listPlacesServer } from "@/lib/places-server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, cities] = await Promise.all([listPlacesServer(), listCitiesServer()]);
  const url = (path: string) => `${CONSUMER_SITE_URL}${path}`;

  return [
    ...["/", "/search", "/places", "/about", "/faq", "/contact", "/suggest", "/privacy", "/terms"].map(
      (path) => ({ url: url(path) })
    ),
    ...cities.map((city) => ({ url: url(`/places/${city.slug}`) })),
    ...places.map((place) => ({ url: url(`/place/${place.slug}`) })),
  ];
}
