import SeatMateMark from "@seatmate/shared/components/SeatMateMark";
import BackButton from "@seatmate/shared/components/BackButton";

// Header for the smaller business pages (analytics, QR code).
export default function PortalHeader({ section }: { section: string }) {
  return (
    <header className="bg-white border-b border-gray-200 print:hidden">
      <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center text-[#101811]">
            <SeatMateMark className="h-[85%] w-[85%]" />
          </div>

          <div>
            <p className="font-bold">SeatMate</p>
            <p className="text-xs text-gray-400">{section}</p>
          </div>
        </div>

        <BackButton href="/business" label="Dashboard" />
      </div>
    </header>
  );
}
