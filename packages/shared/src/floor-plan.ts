// Floor-plan marker types (outlets, windows, doors…) shared by the public
// place page and the business floor-plan editor.

export type MarkerType =
  | "outlet"
  | "window"
  | "register"
  | "counter"
  | "barCounter"
  | "door"
  | "entrance"
  | "restroom"
  | "wall"
  | "poolTable"
  | "darts"
  | "bowlingLane";

export type FloorMarker = {
  id: string;
  type: MarkerType;
  label: string;
  xPct: number;
  yPct: number;
  scale: number;
  rotation: number;
  // Pool tables, darts and bowling lanes can be marked as in use, like a seat.
  status?: "available" | "occupied";
};

// Label and base size (px, before the marker's own scale).
export const MARKERS: Record<
  MarkerType,
  {
    label: string;
    width: number;
    height: number;
  }
> = {
  outlet: {
    label: "Outlet",
    width: 54,
    height: 54,
  },
  window: {
    label: "Window",
    width: 120,
    height: 36,
  },
  register: {
    label: "Cash Register",
    width: 92,
    height: 66,
  },
  counter: {
    label: "Counter",
    width: 135,
    height: 54,
  },
  barCounter: {
    label: "Bar Counter",
    width: 240,
    height: 50,
  },
  door: {
    label: "Door",
    width: 82,
    height: 42,
  },
  entrance: {
    label: "Entrance",
    width: 110,
    height: 44,
  },
  restroom: {
    label: "Restroom",
    width: 90,
    height: 62,
  },
  wall: {
    label: "Wall",
    width: 150,
    height: 26,
  },
  poolTable: {
    label: "Pool Table",
    width: 150,
    height: 86,
  },
  darts: {
    label: "Darts",
    width: 92,
    height: 70,
  },
  bowlingLane: {
    label: "Bowling Lane",
    width: 72,
    height: 190,
  },
};

// Markers that staff can mark as open or in use.
export const GAME_MARKERS: MarkerType[] = ["poolTable", "darts", "bowlingLane"];
export const isGameMarker = (type: MarkerType) => GAME_MARKERS.includes(type);

export const markerStatus = (value: unknown): "available" | "occupied" =>
  value === "occupied" ? "occupied" : "available";

const typeIs = (businessType: unknown, ...names: string[]) =>
  typeof businessType === "string" &&
  names.includes(businessType.trim().toLowerCase());

export const isBar = (businessType: unknown) => typeIs(businessType, "bar");

export const isBarbershop = (businessType: unknown) =>
  typeIs(businessType, "barbershop", "barber shop", "barber");

export const isBowlingAlley = (businessType: unknown) =>
  typeIs(businessType, "bowling alley", "bowling");

// Whether the editor offers a marker type to this kind of business.
// Pool tables and darts are for bars and bowling alleys; lanes are for
// bowling alleys. Everything else is offered to every business.
export const markerAllowed = (type: MarkerType, businessType: unknown) => {
  switch (type) {
    case "poolTable":
    case "darts":
      return isBar(businessType) || isBowlingAlley(businessType);
    case "bowlingLane":
      return isBowlingAlley(businessType);
    default:
      return true;
  }
};

// Every business type a place can pick, in the order shown.
export const BUSINESS_TYPES = [
  "Cafe",
  "Restaurant",
  "Coffee Shop",
  "Bakery",
  "Bar",
  "Barbershop",
  "Bowling Alley",
  "Food Hall",
  "Other",
];

export const businessTypeLabel = (type: string) =>
  type === "Cafe" ? "Café" : type;

// Colors for a marker on the floor plan (editor and public page).
export const markerClassName = (type: MarkerType) => {
  switch (type) {
    case "wall":
      return "bg-gray-700 border-gray-800 text-white";
    case "window":
      return "bg-sky-50 border-sky-300 text-sky-800";
    case "outlet":
      return "bg-amber-50 border-amber-300 text-amber-800 rounded-xl";
    case "barCounter":
      return "bg-amber-800 border-amber-950 text-amber-50 rounded-xl shadow-sm";
    case "poolTable":
      return "bg-emerald-700 border-[6px] border-amber-900 text-white rounded-lg shadow-sm";
    case "darts":
      return "bg-rose-50 border-rose-300 text-rose-800 rounded-full";
    case "bowlingLane":
      return "bg-amber-100 border-amber-300 text-amber-900 rounded-md shadow-sm";
    default:
      return "bg-white border-gray-300 text-[#101811] rounded-xl shadow-sm";
  }
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
