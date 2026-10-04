import {
  AppWindow,
  Banknote,
  Beer,
  CircleDot,
  Disc3,
  DoorOpen,
  LogIn,
  Martini,
  PartyPopper,
  PlugZap,
  RectangleHorizontal,
  Smile,
  Target,
  Toilet,
  type LucideIcon,
} from "lucide-react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import type { CrowdLevel } from "@seatmate/shared/door-crowd";
import type { MarkerType } from "@seatmate/shared/floor-plan";
import { SEATMATE_MARK_PATH, SEATMATE_MARK_VIEWBOX } from "@seatmate/shared/seatmate-mark";

// The web portal's line icons (apps/business/components/portal-icons.tsx)
// and the SeatMate mark, drawn with react-native-svg.

type IconProps = { size?: number; color?: string };

const line = (color: string) => ({
  fill: "none",
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function SeatMateMark({ size = 32, color = "#101811" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={SEATMATE_MARK_VIEWBOX}>
      <Path d={SEATMATE_MARK_PATH} fill={color} />
    </Svg>
  );
}

export function FloorPlanIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect {...l} x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <Rect {...l} x="7" y="7" width="4" height="4" rx="1" />
      <Circle {...l} cx="16" cy="9" r="2" />
      <Rect {...l} x="7" y="14" width="10" height="3" rx="1" />
    </Svg>
  );
}

export function SeatIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M7 4v8a2 2 0 0 0 2 2h7" />
      <Path {...l} d="M7 14l-1 6M16 14l1 6M9 10h6" />
    </Svg>
  );
}

export function StaffIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="9" cy="8" r="3" />
      <Path {...l} d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <Circle {...l} cx="17" cy="9" r="2.3" />
      <Path {...l} d="M16 14.2a4.5 4.5 0 0 1 4.5 4.8" />
    </Svg>
  );
}

export function ClockIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="12" cy="12" r="8.5" />
      <Path {...l} d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function StorefrontIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M4 9.5 5.5 4h13L20 9.5" />
      <Path {...l} d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <Path {...l} d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function ChartIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M4 20h16" />
      <Rect {...l} x="6" y="11" width="3" height="6" rx="1" />
      <Rect {...l} x="11" y="6" width="3" height="11" rx="1" />
      <Rect {...l} x="16" y="9" width="3" height="8" rx="1" />
    </Svg>
  );
}

export function QrIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect {...l} x="4" y="4" width="6" height="6" rx="1" />
      <Rect {...l} x="14" y="4" width="6" height="6" rx="1" />
      <Rect {...l} x="4" y="14" width="6" height="6" rx="1" />
      <Path {...l} d="M14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2" />
    </Svg>
  );
}

export function EyeIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <Circle {...l} cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

export function HeartIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />
    </Svg>
  );
}

export function BellIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
      <Path {...l} d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function ShieldIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Z" />
      <Path {...l} d="m9 12 2 2 4-4" />
    </Svg>
  );
}

// Not on the web portal: a door, for the bouncer counter.
export function DoorIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M5 20.5h14M7 20.5V4.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <Circle {...l} cx="14" cy="12.5" r="0.6" />
    </Svg>
  );
}

// Floor-plan markers, from Lucide (lucide.dev), matching the websites and the
// consumer app (mobile/consumer/src/components/icons.tsx).
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

// How busy the door counter says it is, as customers see it.
const CROWD_ICONS: Record<CrowdLevel, LucideIcon> = { quiet: Smile, usual: Beer, busy: PartyPopper };

export function CrowdIcon({ level, size = 28, color = "#fff" }: { level: CrowdLevel | null; size?: number; color?: string }) {
  const Icon = level ? CROWD_ICONS[level] : DoorOpen;
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}
