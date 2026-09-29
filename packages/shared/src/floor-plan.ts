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
  | "darts";

export type FloorMarker = {
  id: string;
  type: MarkerType;
  label: string;
  xPct: number;
  yPct: number;
  scale: number;
  rotation: number;
  // Pool tables and darts can be marked as in use, like a seat.
  status?: "available" | "occupied";
};

// Label, icon and base size (px, before the marker's own scale).
export const MARKERS: Record<
  MarkerType,
  {
    label: string;
    icon: string;
    width: number;
    height: number;
  }
> = {
  outlet: {
    label: "Outlet",
    icon: "⚡",
    width: 54,
    height: 54,
  },
  window: {
    label: "Window",
    icon: "▭",
    width: 120,
    height: 36,
  },
  register: {
    label: "Cash Register",
    icon: "▣",
    width: 92,
    height: 66,
  },
  counter: {
    label: "Counter",
    icon: "▰",
    width: 135,
    height: 54,
  },
  barCounter: {
    label: "Bar Counter",
    icon: "🍸",
    width: 240,
    height: 50,
  },
  door: {
    label: "Door",
    icon: "↪",
    width: 82,
    height: 42,
  },
  entrance: {
    label: "Entrance",
    icon: "⇥",
    width: 110,
    height: 44,
  },
  restroom: {
    label: "Restroom",
    icon: "",
    width: 90,
    height: 62,
  },
  wall: {
    label: "Wall",
    icon: "",
    width: 150,
    height: 26,
  },
  poolTable: {
    label: "Pool Table",
    icon: "🎱",
    width: 150,
    height: 86,
  },
  darts: {
    label: "Darts",
    icon: "🎯",
    width: 92,
    height: 70,
  },
};

// Markers only offered in the editor for bars.
export const BAR_ONLY_MARKERS: MarkerType[] = ["poolTable", "darts"];

// Markers that staff can mark as open or in use.
export const GAME_MARKERS: MarkerType[] = ["poolTable", "darts"];
export const isGameMarker = (type: MarkerType) => GAME_MARKERS.includes(type);

export const markerStatus = (value: unknown): "available" | "occupied" =>
  value === "occupied" ? "occupied" : "available";

const typeIs = (businessType: unknown, ...names: string[]) =>
  typeof businessType === "string" &&
  names.includes(businessType.trim().toLowerCase());

export const isBar = (businessType: unknown) => typeIs(businessType, "bar");

export const isBarbershop = (businessType: unknown) =>
  typeIs(businessType, "barbershop", "barber shop", "barber");

// Whether the editor offers a marker type to this kind of business.
export const markerAllowed = (type: MarkerType, businessType: unknown) =>
  !BAR_ONLY_MARKERS.includes(type) || isBar(businessType);

// Every business type a place can pick, in the order shown.
export const BUSINESS_TYPES = [
  "Cafe",
  "Restaurant",
  "Coffee Shop",
  "Bakery",
  "Bar",
  "Barbershop",
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
    default:
      return "bg-white border-gray-300 text-[#101811] rounded-xl shadow-sm";
  }
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
