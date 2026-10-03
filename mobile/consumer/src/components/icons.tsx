import Svg, { Circle, Path, Rect } from "react-native-svg";

import { SEATMATE_MARK_PATH, SEATMATE_MARK_VIEWBOX } from "@seatmate/shared/seatmate-mark";

// Line icons in the website's style, and the SeatMate mark, drawn with
// react-native-svg.

type IconProps = { size?: number; color?: string; filled?: boolean };

const line = (color: string, width = 1.8) => ({
  fill: "none",
  stroke: color,
  strokeWidth: width,
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

export function CompassIcon({ size = 24, color = "#101811", filled }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="12" cy="12" r="9" />
      <Path {...l} d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill={filled ? color : "none"} />
    </Svg>
  );
}

export function SearchIcon({ size = 24, color = "#101811" }: IconProps) {
  const l = line(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="11" cy="11" r="6.5" />
      <Path {...l} d="m20 20-4.2-4.2" />
    </Svg>
  );
}

export function HeartIcon({ size = 24, color = "#101811", filled }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        {...l}
        fill={filled ? color : "none"}
        d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"
      />
    </Svg>
  );
}

export function UserIcon({ size = 24, color = "#101811", filled }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="12" cy="8.5" r="3.8" fill={filled ? color : "none"} />
      <Path {...l} d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function ShareIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
      <Path {...l} d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
    </Svg>
  );
}

export function DirectionsIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M3.5 11 20.5 3.5 13 20.5l-2-7.5-7.5-2Z" />
    </Svg>
  );
}

export function PinIcon({ size = 16, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <Circle {...l} cx="12" cy="10" r="2.3" />
    </Svg>
  );
}

export function BackIcon({ size = 22, color = "#101811" }: IconProps) {
  const l = line(color, 2.2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M15 5 8 12l7 7" />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color = "#101811" }: IconProps) {
  const l = line(color, 2.2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = "#101811", filled }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} fill={filled ? color : "none"} d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
      <Path {...l} d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function ClockIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle {...l} cx="12" cy="12" r="8.5" />
      <Path {...l} d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function FloorPlanIcon({ size = 20, color = "#101811" }: IconProps) {
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

export function StorefrontIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M4 9.5 5.5 4h13L20 9.5" />
      <Path {...l} d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <Path {...l} d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </Svg>
  );
}

export function MailIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect {...l} x="3.5" y="5.5" width="17" height="13" rx="2" />
      <Path {...l} d="m4 7 8 6 8-6" />
    </Svg>
  );
}

export function DocIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z" />
      <Path {...l} d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" />
    </Svg>
  );
}

export function ShieldIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Z" />
      <Path {...l} d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function PlusIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color, 2);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function SignOutIcon({ size = 20, color = "#101811" }: IconProps) {
  const l = line(color);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...l} d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </Svg>
  );
}
