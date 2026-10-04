import Svg, { Path } from "react-native-svg";
import {
  AppWindow,
  Armchair,
  Banknote,
  Beer,
  Bell,
  ChevronLeft,
  CircleDot,
  Clock,
  Coffee,
  Compass,
  Disc3,
  DoorOpen,
  FileText,
  Heart,
  LayoutGrid,
  List,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Map as MapIcon,
  MapPin,
  Martini,
  Maximize,
  Minus,
  Navigation,
  PartyPopper,
  PlugZap,
  Plus,
  RectangleHorizontal,
  Scissors,
  Search,
  Share,
  ShieldCheck,
  Smile,
  Store,
  Target,
  Timer,
  Toilet,
  User,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react-native";

import type { CrowdLevel } from "@seatmate/shared/door-crowd";
import { isBar, isBarbershop, isBowlingAlley, type MarkerType } from "@seatmate/shared/floor-plan";
import { SEATMATE_MARK_PATH, SEATMATE_MARK_VIEWBOX } from "@seatmate/shared/seatmate-mark";

// Every icon in the app comes from Lucide (lucide.dev), with the same
// choices as the websites and the business app, plus the SeatMate mark.

export type IconProps = { size?: number; color?: string; filled?: boolean; strokeWidth?: number };

// A Lucide icon with the app's defaults; `filled` fills the shape (a saved
// heart, the active tab).
function lucide(Icon: LucideIcon, defaultSize = 22) {
  function AppIcon({ size = defaultSize, color = "#101811", filled = false, strokeWidth = 1.9 }: IconProps) {
    return <Icon size={size} color={color} strokeWidth={strokeWidth} fill={filled ? color : "none"} />;
  }
  return AppIcon;
}

export function SeatMateMark({ size = 32, color = "#101811" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={SEATMATE_MARK_VIEWBOX}>
      <Path d={SEATMATE_MARK_PATH} fill={color} />
    </Svg>
  );
}

export const CompassIcon = lucide(Compass, 24);
export const SearchIcon = lucide(Search, 24);
export const HeartIcon = lucide(Heart, 24);
export const UserIcon = lucide(User, 24);
export const ShareIcon = lucide(Share, 20);
export const DirectionsIcon = lucide(Navigation, 20);
export const PinIcon = lucide(MapPin, 16);
export const BackIcon = lucide(ChevronLeft, 22);
export const CloseIcon = lucide(X, 18);
export const BellIcon = lucide(Bell, 20);
export const ClockIcon = lucide(Clock, 20);
export const FloorPlanIcon = lucide(MapIcon, 20);
export const StorefrontIcon = lucide(Store, 20);
export const MailIcon = lucide(Mail, 20);
export const DocIcon = lucide(FileText, 20);
export const ShieldIcon = lucide(ShieldCheck, 20);
export const PlusIcon = lucide(Plus, 20);
export const MinusIcon = lucide(Minus, 20);
export const FitIcon = lucide(Maximize, 18);
export const ListIcon = lucide(List, 18);
export const SignOutIcon = lucide(LogOut, 20);
export const TimerIcon = lucide(Timer, 14);
export const ChairIcon = lucide(Armchair, 20);
export const ScissorsIcon = lucide(Scissors, 20);

// Floor-plan markers, matching the websites (packages/shared Icons.tsx).
const MARKER_ICONS: Record<MarkerType, LucideIcon | null> = {
  outlet: PlugZap,
  window: AppWindow,
  register: Banknote,
  counter: RectangleHorizontal,
  barCounter: Martini,
  door: DoorOpen,
  entrance: LogIn,
  restroom: Toilet,
  wall: null,
  poolTable: CircleDot,
  darts: Target,
  bowlingLane: Disc3,
};

export function MarkerIcon({ type, size = 18, color = "#101811" }: { type: MarkerType; size?: number; color?: string }) {
  const Icon = MARKER_ICONS[type];
  return Icon ? <Icon size={size} color={color} strokeWidth={1.9} /> : null;
}

const CROWD_ICONS: Record<CrowdLevel, LucideIcon> = { quiet: Smile, usual: Beer, busy: PartyPopper };

export function CrowdIcon({ level, size = 28, color = "#fff" }: { level: CrowdLevel | null; size?: number; color?: string }) {
  const Icon = level ? CROWD_ICONS[level] : DoorOpen;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}

// The category a place's type falls under, for its icon.
export function placeCategory(type: string): keyof typeof CATEGORY_ICONS {
  const lower = type.toLowerCase();
  if (isBarbershop(type)) return "barbershop";
  if (isBowlingAlley(type)) return "bowling";
  if (isBar(type)) return "bar";
  if (lower.includes("cafe") || lower.includes("café") || lower.includes("coffee")) return "cafe";
  return "restaurant";
}

export function CategoryIcon({ category, ...props }: IconProps & { category: keyof typeof CATEGORY_ICONS }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon {...props} />;
}

// One icon per kind of place.
export function PlaceTypeIcon({ type, ...props }: IconProps & { type: string }) {
  return <CategoryIcon category={placeCategory(type)} {...props} />;
}

export const CATEGORY_ICONS = {
  all: lucide(LayoutGrid),
  available: lucide(Armchair),
  cafe: lucide(Coffee),
  restaurant: lucide(UtensilsCrossed),
  bar: lucide(Martini),
  barbershop: lucide(Scissors),
  bowling: lucide(Disc3),
};

export const BigIcons = {
  chair: lucide(Armchair, 44),
  noResults: lucide(Search, 44),
  heart: lucide(Heart, 44),
  sent: lucide(PartyPopper, 48),
  target: lucide(Target, 20),
  disc: lucide(Disc3, 20),
};

export const MailCheckIcon = lucide(MailCheck, 48);
