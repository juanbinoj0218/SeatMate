import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

// Pulsing green dot next to live numbers.
export default function LiveDot({ size = 8, color = "#22c55e" }: { size?: number; color?: string }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }]} />
    </View>
  );
}
