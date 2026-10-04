"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import { consumerUrl } from "@seatmate/shared/site-urls";

import PortalHeader from "@/components/portal-header";
import { useOwnedBusiness } from "@/lib/use-business";

const INK = "#101811";

// Printable sign with a QR code that opens the business's live seating page.
// Scans are tagged ?ref=qr so they show up in Analytics.
export default function QrCodePage() {
  const { business, loading, error } = useOwnedBusiness();
  const [svg, setSvg] = useState("");

  const slug = business?.status === "approved" ? business.slug : undefined;
  const url = slug ? consumerUrl(`/place/${slug}?ref=qr`) : "";

  useEffect(() => {
    if (!url) return;

    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 0,
      color: { dark: INK, light: "#ffffff" },
    }).then(setSvg);
  }, [url]);

  const downloadPng = async () => {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1200,
      color: { dark: INK, light: "#ffffff" },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `seatmate-${slug}-qr.png`;
    link.click();
  };

  if (loading || !business) {
    return (
      <main className="min-h-screen bg-[#f7f8f5]">
        <PortalHeader section="QR code" />
        <p className="max-w-4xl mx-auto px-5 sm:px-8 py-12 text-gray-500">{error || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] print:bg-white">
      <PortalHeader section="QR code" />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 print:p-0">
        <div className="print:hidden">
          <h1 className="text-4xl font-bold tracking-tight">Put SeatMate on your door</h1>
          <p className="text-gray-500 mt-2 max-w-xl">
            Print this sign for your window, counter or tables. Customers scan it to see open seats
            and save your place for next time.
          </p>
        </div>

        {!slug ? (
          <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 print:hidden">
            Your QR code will be ready once your business is approved and live on SeatMate.
          </p>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_240px] md:items-start print:block print:mt-0">
            {/* The printable sign */}
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-gray-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
              <div className="bg-[#101811] px-8 py-6 text-white">
                <div className="flex items-center gap-2.5">
                  <SeatMateMark className="h-7 w-7 text-white" />
                  <span className="text-lg font-bold">SeatMate</span>
                </div>
                <p className="mt-5 text-3xl font-bold leading-tight tracking-tight print:text-5xl">
                  See open seats before you sit down.
                </p>
              </div>

              <div className="px-8 pb-8 pt-7 text-center">
                <div
                  className="mx-auto aspect-square w-full max-w-[260px] print:mt-6 print:max-w-[420px] [&>svg]:h-full [&>svg]:w-full"
                  role="img"
                  aria-label={`QR code for ${business.name} on SeatMate`}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />

                <p className="mt-6 text-xl font-bold print:text-3xl">{business.name}</p>
                <p className="mt-1 text-sm text-gray-500 print:text-lg">
                  Scan with your phone camera for live seating
                </p>

                <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
                  {["bg-emerald-500", "bg-emerald-500", "bg-rose-400", "bg-emerald-500", "bg-rose-400"].map(
                    (color, index) => (
                      <span key={index} className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full rounded-xl bg-[#101811] px-5 py-3 font-semibold text-white transition hover:bg-black"
              >
                Print sign
              </button>
              <button
                type="button"
                onClick={downloadPng}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 font-semibold transition hover:bg-gray-50"
              >
                Download QR image
              </button>

              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <p className="font-semibold">Links to</p>
                <a href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-gray-500 hover:text-[#101811]">
                  {url.replace(/^https?:\/\//, "")}
                </a>
              </div>

              <p className="text-xs text-gray-400">
                Scans show up as &ldquo;QR scans&rdquo; in Analytics.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
