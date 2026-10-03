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
  type LucideProps,
} from "lucide-react";

import type { CrowdLevel } from "../door-crowd";
import type { MarkerType } from "../floor-plan";

// Lucide icons for floor-plan markers and bar crowd levels, used by every
// website in place of the emoji in floor-plan.ts and door-crowd.ts.

export const MARKER_ICONS: Record<MarkerType, LucideIcon | null> = {
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

export const CROWD_ICONS: Record<CrowdLevel, LucideIcon> = {
  quiet: Smile,
  usual: Beer,
  busy: PartyPopper,
};

export function MarkerIcon({ type, ...props }: LucideProps & { type: MarkerType }) {
  const Icon = MARKER_ICONS[type];
  return Icon ? <Icon aria-hidden {...props} /> : null;
}

export function CrowdIcon({ level, ...props }: LucideProps & { level: CrowdLevel | null }) {
  const Icon = level ? CROWD_ICONS[level] : DoorOpen;
  return <Icon aria-hidden {...props} />;
}
