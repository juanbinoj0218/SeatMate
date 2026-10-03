import { useCallback, useState } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/floor";

// iPads (and big phones on their side) get the side-by-side layout: the
// floor plan fills the screen with the controls in a panel next to it.
export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

// The size a view was laid out at, for fitting the floor plan into it.
export function useBox() {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }
    );
  }, []);
  return [box, onLayout] as const;
}

// Scale that fits the whole 1000 × 700 floor plan in a box (the frame's
// border included). Without a height, only the width counts.
export function fitScale(box: { width: number; height?: number } | null) {
  if (!box) return 0.35;
  const byWidth = (box.width - 4) / CANVAS_WIDTH;
  const byHeight = box.height ? (box.height - 4) / CANVAS_HEIGHT : byWidth;
  return Math.max(0.2, Math.min(byWidth, byHeight));
}
