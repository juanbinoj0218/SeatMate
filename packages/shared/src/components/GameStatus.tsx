// "Open" / "In use" pill shown on pool table, darts and bowling lane markers.
export default function GameStatus({
  status,
  size = 10,
}: {
  status: "available" | "occupied";
  size?: number;
}) {
  const open = status === "available";

  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-white shadow-sm ${
        open ? "bg-green-500" : "bg-red-500"
      }`}
      style={{ fontSize: size }}
    >
      {open ? "Open" : "In use"}
    </span>
  );
}
