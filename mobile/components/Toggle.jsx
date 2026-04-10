import { Pressable, View, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { colors } from "../constants/colors";

export function Toggle({ active, onToggle, accessibilityLabel, accessibilityHint }) {
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? colors.primary : colors.muted, { duration: 200 }),
    borderColor: withTiming(active ? "rgba(156, 68, 34, 0.6)" : colors.border, { duration: 200 }),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(active ? 20 : 2, { duration: 200 }) }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
