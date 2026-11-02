import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Timer } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import {
  type Barber,
  chairProgress,
  PROGRESS_STOPS,
  progressLabel,
  progressTextColor,
  usualLabel,
} from "@seatmate/shared/barbers";
import { elapsed, type TableSeat } from "@seatmate/shared/table-geometry";

const INK = "#101811";
const BAR_HEIGHT = 10;

// How far along the cut in a barber chair is: a ticking timer, "about 6 min
// left" and a bar that fills from red through orange and yellow to green as
// the cut nears its usual length. Green and full while the chair is open.
// Same as the websites' CutProgress.
export default function CutProgress({
  seat,
  barber,
  style,
}: {
  seat: TableSeat | undefined;
  barber?: Pick<Barber, "cutMinutes"> | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = chairProgress(seat, barber, now);
  const cutting = progress.state === "cutting";
  const fraction = cutting ? Math.max(0.03, progress.fraction) : 1;
  const label = progressLabel(progress);

  return (
    <View style={style}>
      <View style={styles.top}>
        <View style={styles.status}>
          {progress.state === "open" ? (
            <>
              <View style={styles.dot} />
              <Text style={styles.statusText}>Chair open</Text>
            </>
          ) : (
            <>
              <Timer size={15} color="#9ca3af" strokeWidth={2.2} />
              <Text style={styles.statusText}>
                In the chair
                {cutting && typeof seat?.occupiedSince === "number"
                  ? `  ${elapsed(seat.occupiedSince, Math.max(now, seat.occupiedSince))}`
                  : ""}
              </Text>
            </>
          )}
        </View>
        <Text style={[styles.left, { color: cutting ? progressTextColor(progress.fraction) : "#15803d" }]}>{label}</Text>
      </View>

      <View
        style={styles.track}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="How far along the current cut is"
        accessibilityValue={{ min: 0, max: 100, now: Math.round((cutting ? progress.fraction : 1) * 100), text: label }}
      >
        {progress.state === "taken" ? null : cutting ? (
          // The whole red-to-green gradient, revealed as the cut goes on.
          <View style={[styles.fill, { width: `${fraction * 100}%` }]}>
            {width > 0 && (
              <Svg width={width} height={BAR_HEIGHT}>
                <Defs>
                  <LinearGradient id="cut" x1="0" y1="0" x2="1" y2="0">
                    {PROGRESS_STOPS.map((color, index) => (
                      <Stop key={color} offset={index / (PROGRESS_STOPS.length - 1)} stopColor={color} />
                    ))}
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={BAR_HEIGHT} fill="url(#cut)" />
              </Svg>
            )}
          </View>
        ) : (
          <View style={[styles.fill, { width: "100%", backgroundColor: "#22c55e" }]} />
        )}
      </View>

      {cutting && <Text style={styles.usual}>{usualLabel(progress)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  status: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  statusText: { fontSize: 15, fontWeight: "800", color: INK, fontVariant: ["tabular-nums"] },
  left: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { marginTop: 10, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: "#f3f4f6", overflow: "hidden" },
  fill: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, overflow: "hidden" },
  usual: { marginTop: 8, fontSize: 13, color: "#6b7280" },
});
