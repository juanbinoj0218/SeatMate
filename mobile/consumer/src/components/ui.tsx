import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { tap } from "@/lib/haptics";

// Colors from the customer website (seatmate360.com).
export const colors = {
  ink: "#101811",
  page: "#f7f8f5",
  card: "#ffffff",
  border: "#e3e7e2",
  line: "#eef0ec",
  chip: "#f2f4f0",
  muted: "#6b7280",
  faint: "#9ca3af",
  green: "#16a34a",
  greenBright: "#22c55e",
  greenSoft: "#ecfdf5",
  greenText: "#047857",
  red: "#ef4444",
  redSoft: "#fef2f2",
  redText: "#b91c1c",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  amberBorder: "#fde68a",
  amberText: "#92400e",
};

export const shadow: ViewStyle = {
  shadowColor: "#101811",
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={[styles.fill, styles.center]}>
      <ActivityIndicator color={colors.ink} />
      <Text style={[styles.muted, { marginTop: 12 }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Eyebrow({ children, color = colors.green }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

// A section heading with an optional action on the right ("See all").
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "green" | "danger" | "light";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const look = buttonLooks[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.background, borderColor: look.border },
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, { color: look.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const buttonLooks: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: { background: colors.ink, border: colors.ink, text: "#fff" },
  secondary: { background: "#fff", border: "#e5e7eb", text: colors.ink },
  green: { background: colors.greenBright, border: colors.greenBright, text: colors.ink },
  danger: { background: "#fff", border: "#fecaca", text: colors.redText },
  light: { background: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.25)", text: "#fff" },
};

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} style={styles.input} {...input} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Banner({
  tone,
  children,
  style,
}: {
  tone: "error" | "success" | "warning";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const look =
    tone === "error"
      ? { backgroundColor: colors.redSoft, borderColor: "#fecaca", color: colors.redText }
      : tone === "success"
        ? { backgroundColor: colors.greenSoft, borderColor: "#a7f3d0", color: colors.greenText }
        : { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder, color: colors.amberText };

  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.banner, { backgroundColor: look.backgroundColor, borderColor: look.borderColor }, style]}
    >
      <Text style={{ color: look.color, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

// Rounded filter pill, as on the website's search page.
export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.8 }]}
    >
      {icon}
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

// A tappable row in a grouped list (account settings, links).
export function ListRow({
  title,
  detail,
  onPress,
  icon,
  danger = false,
  last = false,
  right,
}: {
  title: string;
  detail?: string;
  onPress?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  last?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, !last && styles.listRowBorder, pressed && { backgroundColor: "#fafbf9" }]}
    >
      {icon ? <View style={styles.listIcon}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.listTitle, danger && { color: colors.redText }]}>{title}</Text>
        {detail ? <Text style={styles.listDetail}>{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  color = colors.ink,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.stat, dark && styles.statDark]}>
      <Text style={[styles.statLabel, dark && { color: "rgba(255,255,255,0.45)" }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// Big friendly empty state with an optional action.
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>{text}</Text>
      {action && onAction ? <Button title={action} onPress={onAction} style={{ marginTop: 18, alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink, letterSpacing: -0.8 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: "900", color: colors.ink, letterSpacing: -0.4 },
  sectionAction: { fontSize: 14, fontWeight: "800", color: colors.green },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#fff",
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontSize: 16, fontWeight: "800" },
  banner: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontWeight: "800", color: colors.ink },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  listDetail: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.faint, marginTop: -2 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  statDark: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "transparent" },
  statLabel: { fontSize: 11, fontWeight: "800", color: colors.faint, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 26, fontWeight: "900", marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#eceee9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: colors.ink, marginTop: 12, textAlign: "center" },
});
