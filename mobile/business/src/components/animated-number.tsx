import { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Close to critically damped: each digit rolls to its place with a hint of
// settle, like the floor plan's springs.
const ROLL = { damping: 20, stiffness: 210, mass: 0.7 };

// A live count whose digits roll to the new value, odometer style. `style`
// is for text only (font, color, letter spacing); put margins on
// `containerStyle`. Digits use tabular figures so the width stays put.
export function AnimatedNumber({
  value,
  style,
  containerStyle,
  accessibilityLabel,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = flat.fontSize ?? 14;
  const lineHeight = flat.lineHeight ?? Math.round(fontSize * 1.25);
  const text = String(Number.isFinite(value) ? Math.round(value) : 0);
  const chars = text.split("");
  const textStyle = [style, styles.digit, { lineHeight, height: lineHeight }];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={[styles.row, containerStyle]}
    >
      {chars.map((char, index) => {
        // Keyed from the right, so the ones column stays the ones column
        // when the number grows a digit.
        const place = chars.length - index;
        return /\d/.test(char) ? (
          <DigitColumn key={`d${place}`} digit={Number(char)} lineHeight={lineHeight} textStyle={textStyle} />
        ) : (
          <Text key={`c${place}`} style={textStyle}>
            {char}
          </Text>
        );
      })}
    </View>
  );
}

function DigitColumn({
  digit,
  lineHeight,
  textStyle,
}: {
  digit: number;
  lineHeight: number;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(digit);

  useEffect(() => {
    position.set(reduceMotion ? digit : withSpring(digit, ROLL));
  }, [digit, position, reduceMotion]);

  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: -position.get() * lineHeight }] }));

  return (
    <View style={{ height: lineHeight, overflow: "hidden" }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={roll}>
        {DIGITS.map((d) => (
          <Text key={d} style={textStyle} accessibilityElementsHidden>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  digit: { fontVariant: ["tabular-nums"], textAlign: "center", margin: 0, padding: 0 },
});

// The filled part of a meter. Its width springs to `percent` when a live
// count changes instead of jumping.
export function SpringFill({
  percent,
  color,
  style,
}: {
  percent: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(percent);

  useEffect(() => {
    width.set(reduceMotion ? percent : withSpring(percent, FILL));
  }, [percent, width, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ width: `${Math.min(100, Math.max(0, width.get()))}%` }));

  return <Animated.View style={[style, { backgroundColor: color }, animated]} />;
}

const FILL = { damping: 24, stiffness: 180, mass: 0.9 };
