import { useEffect, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

// Colors from the web portal.
export const colors = {
  ink: "#101811",
  page: "#f7f8f5",
  card: "#ffffff",
  border: "#e3e7e2",
  muted: "#6b7280",
  faint: "#9ca3af",
  green: "#16a34a",
  greenSoft: "#ecfdf5",
  greenText: "#047857",
  red: "#ef4444",
  redSoft: "#fef2f2",
  redText: "#b91c1c",
  amberSoft: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",
};

export function Screen({
  children,
  scroll = true,
  edges = ["bottom", "left", "right"],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={colors.ink} />
      <Text style={[styles.muted, { marginTop: 12 }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Eyebrow({ children, color = colors.green }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type ButtonVariant = "primary" | "secondary" | "green" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const look = buttonLooks[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.background, borderColor: look.border },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <Text style={[styles.buttonText, { color: look.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const buttonLooks: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: colors.ink, border: colors.ink, text: "#fff" },
  secondary: { background: "#fff", border: "#e5e7eb", text: colors.ink },
  green: { background: colors.green, border: colors.green, text: "#fff" },
  danger: { background: "#fff", border: "#fecaca", text: colors.redText },
};

export function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} style={styles.input} {...input} />
    </View>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning";
  children: ReactNode;
}) {
  const look =
    tone === "error"
      ? { backgroundColor: colors.redSoft, borderColor: "#fecaca", color: colors.redText }
      : tone === "success"
        ? { backgroundColor: colors.greenSoft, borderColor: "#a7f3d0", color: colors.greenText }
        : { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder, color: colors.amberText };

  return (
    <View style={[styles.banner, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
      <Text style={{ color: look.color, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

// A row of options where one is picked, like the web's segmented buttons.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && { color: colors.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({ label, value, color = colors.ink }: { label: string; value: ReactNode; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// A neutral block that gently pulses while content loads. Size it with
// `style` (width, height, borderRadius) to match what it stands in for.
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.get() * 0.45 }));

  return <Animated.View style={[styles.skeleton, animated, style]} />;
}

// A whole screen of placeholder blocks (a title, then cards) for screens
// that are still loading.
export function SkeletonScreen({
  cards = 3,
  edges = ["bottom", "left", "right"],
}: {
  cards?: number;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <View style={styles.content} accessibilityLabel="Loading" accessibilityRole="progressbar">
        <Skeleton style={{ height: 30, width: "60%", borderRadius: 8 }} />
        <Skeleton style={{ height: 16, width: "40%", borderRadius: 6, marginTop: 12 }} />
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonCard key={index} style={{ marginTop: index === 0 ? 24 : 14 }} />
        ))}
      </View>
    </SafeAreaView>
  );
}

// A card-shaped placeholder: a heading line and two lines of text.
export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton style={{ height: 18, width: "45%", borderRadius: 6 }} />
      <Skeleton style={{ height: 14, width: "85%", borderRadius: 6, marginTop: 12 }} />
      <Skeleton style={{ height: 14, width: "65%", borderRadius: 6, marginTop: 8 }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
  banner: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  segmented: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  segmentSelected: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontWeight: "700", color: colors.muted },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: { fontSize: 11, fontWeight: "800", color: colors.faint, textTransform: "uppercase" },
  statValue: { fontSize: 24, fontWeight: "800", marginTop: 6 },
  row: { flexDirection: "row", gap: 10 },
  skeleton: { backgroundColor: "#e7eae5", borderRadius: 10 },
});
