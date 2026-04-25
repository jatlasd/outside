import { useCallback, useLayoutEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";
import { formatTimeKey12Hour } from "../lib/time";

const CELL_WIDTH = 74;
const BAR_HEIGHT = 40;
const GAP = 6;
const H_PADDING = 4;

export function DayStrip({ scored, selectedTime, onSelect }) {
  const scrollRef = useRef(null);
  const viewportWRef = useRef(0);
  const batchKeyRef = useRef(null);
  const pendingCenterRef = useRef(false);

  const scrollSelectedToCenter = useCallback(() => {
    if (!scored?.length || !selectedTime || !pendingCenterRef.current) return;
    const vw = viewportWRef.current;
    if (vw <= 0) return;
    const idx = scored.findIndex((r) => r.time === selectedTime);
    const i = idx >= 0 ? idx : 0;
    const cellStep = CELL_WIDTH + GAP;
    const contentWidth =
      H_PADDING * 2 + scored.length * CELL_WIDTH + Math.max(0, scored.length - 1) * GAP;
    const cellCenterX = H_PADDING + i * cellStep + CELL_WIDTH / 2;
    const x = cellCenterX - vw / 2;
    const maxScroll = Math.max(0, contentWidth - vw);
    scrollRef.current?.scrollTo({ x: Math.max(0, Math.min(x, maxScroll)), animated: false });
    pendingCenterRef.current = false;
  }, [scored, selectedTime]);

  useLayoutEffect(() => {
    if (!scored?.length || !selectedTime) return;
    const batchKey = scored.map((r) => r.time).join("|");
    if (batchKeyRef.current === batchKey) return;
    batchKeyRef.current = batchKey;
    pendingCenterRef.current = true;
    scrollSelectedToCenter();
  }, [scored, selectedTime, scrollSelectedToCenter]);

  const onStripLayout = useCallback(
    (e) => {
      viewportWRef.current = e.nativeEvent.layout.width;
      if (pendingCenterRef.current) scrollSelectedToCenter();
    },
    [scrollSelectedToCenter]
  );

  const onContentSizeChange = useCallback(() => {
    if (pendingCenterRef.current) scrollSelectedToCenter();
  }, [scrollSelectedToCenter]);

  if (!scored?.length) return null;

  return (
    <View style={styles.wrap} onLayout={onStripLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={onContentSizeChange}
      >
        {scored.map((r) => {
          const selected = selectedTime === r.time;
          const opacity = 0.15 + (r.score / 100) * 0.85;
          return (
            <Pressable
              key={r.time}
              onPress={() => onSelect?.(r.time)}
              style={[styles.cell, selected && styles.cellSelected]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${formatTimeKey12Hour(r.time)}`}
              accessibilityState={{ selected }}
            >
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { opacity, height: BAR_HEIGHT }]} />
              </View>
              <Text style={[styles.cellTime, selected && styles.cellTimeSelected]} numberOfLines={1}>
                {formatTimeKey12Hour(r.time)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginHorizontal: -4,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  cell: {
    width: CELL_WIDTH,
    alignItems: "center",
    borderRadius: 8,
    paddingBottom: 6,
    paddingTop: 4,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: colors.foreground,
    backgroundColor: "rgba(232, 228, 216, 0.35)",
  },
  barTrack: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  barFill: {
    width: Math.max(24, CELL_WIDTH - 8),
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cellTime: {
    fontFamily: fontFamilies.data,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  cellTimeSelected: {
    color: colors.foreground,
    fontFamily: fontFamilies.sans,
  },
});
