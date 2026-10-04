import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

// Layout for long text pages (privacy, terms).
export default function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8 md:pt-16">
        <h1 className="font-display text-5xl sm:text-6xl">{title}</h1>
        <p className="mt-4 text-sm text-gray-500">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-[17px] leading-8 text-gray-700 [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_a]:decoration-line [&_a]:underline-offset-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
