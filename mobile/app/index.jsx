import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Settings2 } from "lucide-react-native";
import { Button } from "../components/Button";
import { ImpactCard, DayImpactCard } from "../components/ImpactCard";
import { DayStrip } from "../components/DayStrip";
import { HourRow } from "../components/HourRow";
import { hourReadoutEntries } from "../lib/formatImperial";
import { getWeather } from "../lib/getWeather";
import {
  filterHoursByDatePrefix,
  normalizeHourly,
  todayDatePrefixInTimeZone,
  currentHourPrefixInTimeZone,
} from "../lib/normalizeHourly";
import {
  DEFAULT_LOCATION,
  defaultParamWeights,
  hasAnyParamEnabled,
  loadLocationPreference,
  locationDisplayName,
  loadParamFlags,
  loadParamWeights,
} from "../lib/paramPreferences";
import { DEFAULT_FLAGS } from "../lib/paramConfig";
import {
  rollupHours,
  scoreHours,
  topBreakdownContributors,
} from "../lib/scoreHours";
import { colors } from "../constants/colors";
import { fontFamilies } from "../constants/fonts";

function formatLocationCoordinates(location) {
  const lat = Number(location?.latitude);
  const lon = Number(location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function nowImpactSummary(score) {
  if (!Number.isFinite(score)) return "Current outside impact is unavailable.";
  if (score <= 25) return "Outside looks like a minor share of how you feel right now.";
  if (score <= 50) return "Outside conditions are likely contributing a noticeable share right now.";
  if (score <= 75) return "Outside conditions look like a major part of how you feel right now.";
  return "Outside conditions may be the dominant driver of how you feel right now.";
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rollup, setRollup] = useState(null);
  const [allScored, setAllScored] = useState(null);
  const [currentHour, setCurrentHour] = useState(null);
  const [selectedHourTime, setSelectedHourTime] = useState(null);
  const [showAllHours, setShowAllHours] = useState(false);
  const [showDayBreakdown, setShowDayBreakdown] = useState(false);
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }));
  const [weights, setWeights] = useState(() => defaultParamWeights());
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }));

  const loadPreferences = useCallback(async () => {
    const [f, w, loc] = await Promise.all([
      loadParamFlags(),
      loadParamWeights(),
      loadLocationPreference(),
    ]);
    setFlags(f);
    setWeights(w);
    setLocation(loc);
    return { f, w, loc };
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  const readoutCache = useMemo(() => {
    if (!allScored?.length) return null;
    const m = new Map();
    for (const row of allScored) {
      const offenders = topBreakdownContributors(row.breakdown, 2);
      const offenderById = new Map(offenders.map((item) => [item.id, item]));
      m.set(row.time, hourReadoutEntries(row, flags, { offenderById }));
    }
    return m;
  }, [allScored, flags]);

  const load = useCallback(async () => {
    const { f, w, loc } = await loadPreferences();
    setLoading(true);
    setError(null);
    setRollup(null);
    setAllScored(null);
    setCurrentHour(null);
    setSelectedHourTime(null);
    setShowAllHours(false);
    setShowDayBreakdown(false);
    try {
      if (!hasAnyParamEnabled(f)) {
        setError("Turn on at least one parameter in Settings.");
        return;
      }
      const { forecast, air, timezone } = await getWeather(f, loc);
      const hours = normalizeHourly(forecast, air, f);
      const todayPrefix = todayDatePrefixInTimeZone(timezone);
      const todayHours = filterHoursByDatePrefix(hours, todayPrefix);
      const scored = scoreHours(todayHours, f, w);
      setAllScored(scored);
      setRollup(rollupHours(scored));
      const nowPrefix = currentHourPrefixInTimeZone(timezone);
      const current = scored.find((h) => h.time === nowPrefix) || null;
      setCurrentHour(current);
      setSelectedHourTime(current?.time ?? scored[0]?.time ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [loadPreferences]);

  const canLoad = hasAnyParamEnabled(flags);
  const selectedHour = useMemo(() => {
    if (!allScored?.length) return null;
    if (!selectedHourTime) return allScored[0];
    return allScored.find((item) => item.time === selectedHourTime) ?? allScored[0];
  }, [allScored, selectedHourTime]);

  const visibleHours = useMemo(() => {
    if (!allScored?.length) return [];
    if (showAllHours) return allScored;
    return selectedHour ? [selectedHour] : [];
  }, [allScored, showAllHours, selectedHour]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Animated.View entering={FadeInDown.duration(400).delay(0)} style={styles.titleSection}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Outside impact readout</Text>
          <Pressable onPress={() => router.push("/settings")} style={styles.settingsBtn} hitSlop={12}>
            <Settings2 size={16} color={colors.mutedForeground} strokeWidth={1.75} />
            <Text style={styles.settingsText}>Settings</Text>
          </Pressable>
        </View>
        <Text style={styles.description}>
          Answers two things: how much outside may be affecting you right now, and
          how hard outside is likely to push on you if you do outside things today.
        </Text>
        <Text style={styles.locationLine}>
          Location: {locationDisplayName(location)} ·{" "}
          <Text style={styles.coordText}>{formatLocationCoordinates(location)}</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(400).delay(50)}>
        <Button onPress={load} disabled={loading || !canLoad}>
          {loading ? "Loading\u2026" : "Load today"}
        </Button>
      </Animated.View>

      {!canLoad && (
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.emptyNotice}>
          <Text style={styles.emptyNoticeText}>
            Nothing is included yet. Choose what outside means for you in Settings,
            set how strongly each factor counts, then load today's hours.
          </Text>
          <Button variant="outline" size="sm" onPress={() => router.push("/settings")} style={{ marginTop: 12 }}>
            Open Settings
          </Button>
        </Animated.View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && !rollup && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {(currentHour || rollup) && (
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.cardsSection}>
          <ImpactCard
            title="How much of this might be outside right now?"
            score={currentHour?.score}
            subtitle={currentHour ? nowImpactSummary(currentHour.score) : null}
            reasons={currentHour?.reasons}
          >
            No matching current-hour reading yet. Load today to evaluate immediate outside impact.
          </ImpactCard>
          <DayImpactCard rollup={rollup} />
        </Animated.View>
      )}

      {rollup && (
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Pressable onPress={() => setShowDayBreakdown((v) => !v)} style={styles.breakdownToggle}>
            <Text style={styles.breakdownToggleText}>
              {showDayBreakdown ? "Hide day breakdown" : "Why today looks this way"}
            </Text>
          </Pressable>
          {showDayBreakdown ? <BreakdownSection rollup={rollup} /> : null}
        </Animated.View>
      )}

      {allScored?.length > 0 && (
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <Text style={styles.logTitle}>Hourly timeline</Text>
          <Text style={styles.logDescription}>
            Pick an hour first. Darker bars mean stronger outside pressure.
          </Text>
          <DayStrip
            scored={allScored}
            selectedTime={selectedHour?.time}
            onSelect={(time) => setSelectedHourTime(time)}
          />
          <Pressable onPress={() => setShowAllHours((v) => !v)} style={styles.hourToggleBtn}>
            <Text style={styles.hourToggleText}>
              {showAllHours ? "Show selected hour only" : "Show all hours"}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {renderHeader()}
        {visibleHours.map((item, index) => (
          <HourRow
            key={item.time}
            row={item}
            readoutEntries={readoutCache?.get(item.time) ?? []}
            isEven={index % 2 === 1}
            defaultExpanded={!showAllHours}
            hideSummaryTap={!showAllHours}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BreakdownSection({ rollup }) {
  return (
    <View style={breakdownStyles.card}>
      <Text style={breakdownStyles.heading}>Why this day looks this way</Text>
      <Text style={breakdownStyles.subheading}>
        Biggest contributors and the hardest window, without chart decoding.
      </Text>

      <View style={breakdownStyles.content}>
        <View style={breakdownStyles.driversSection}>
          <Text style={breakdownStyles.sectionTitle}>TOP DRIVERS TODAY</Text>
          {rollup.breakdown?.items?.length > 0 ? (
            <View style={breakdownStyles.driverList}>
              {rollup.breakdown.items.slice(0, 5).map((item) => (
                <View key={item.id} style={breakdownStyles.driverRow}>
                  <View style={breakdownStyles.driverHeader}>
                    <Text style={breakdownStyles.driverLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={breakdownStyles.driverPct}>
                      {Math.round(item.pct)}%
                    </Text>
                  </View>
                  <View style={breakdownStyles.barTrack}>
                    <View
                      style={[
                        breakdownStyles.barFill,
                        { width: `${Math.min(100, Math.max(0, item.pct))}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={breakdownStyles.noData}>No strong outside drivers were recorded.</Text>
          )}
        </View>

        <View style={breakdownStyles.divider} />

        <View style={breakdownStyles.worstSection}>
          <Text style={breakdownStyles.sectionTitle}>HARDEST OUTSIDE HOUR</Text>
          {rollup.worst?.time ? (
            <Text style={breakdownStyles.worstTime}>
              {rollup.worst.time.slice(11, 16)}
              <Text style={breakdownStyles.worstMeta}>
                {" "}\u00B7 impact{" "}
                <Text style={breakdownStyles.worstScore}>{rollup.worst.score}</Text>
              </Text>
            </Text>
          ) : (
            <Text style={breakdownStyles.noData}>No peak hour available.</Text>
          )}

          {rollup.worst?.reasons?.length > 0 && (
            <View style={breakdownStyles.worstReasons}>
              <Text style={breakdownStyles.sectionTitle}>MAIN SIGNALS AT THAT HOUR</Text>
              {rollup.worst.reasons.slice(0, 4).map((r, i) => (
                <View key={`${i}-${r}`} style={breakdownStyles.reasonRow}>
                  <View style={breakdownStyles.reasonDot} />
                  <Text style={breakdownStyles.reasonText}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    gap: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  titleSection: {
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: fontFamilies.heading,
    fontSize: 20,
    color: colors.foreground,
    flex: 1,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  settingsText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.mutedForeground,
  },
  description: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  locationLine: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  coordText: {
    fontFamily: fontFamilies.data,
    fontSize: 12,
  },
  emptyNotice: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(156, 68, 34, 0.4)",
    paddingLeft: 14,
  },
  emptyNoticeText: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  errorBox: {
    borderLeftWidth: 2,
    borderLeftColor: colors.destructive,
    paddingLeft: 14,
  },
  errorText: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    color: colors.destructive,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  cardsSection: {
    gap: 14,
  },
  logTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 18,
    color: colors.foreground,
    marginBottom: 4,
  },
  logDescription: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    marginBottom: 10,
  },
  hourToggleBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  hourToggleText: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    color: colors.foreground,
  },
  breakdownToggle: {
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  breakdownToggleText: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 12,
    color: colors.foreground,
  },
});

const breakdownStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(253, 252, 249, 0.82)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  heading: {
    fontFamily: fontFamilies.heading,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
  subheading: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  content: {
    gap: 16,
  },
  driversSection: {},
  sectionTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: colors.mutedForeground,
    marginBottom: 10,
  },
  driverList: {
    gap: 10,
  },
  driverRow: {},
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  driverLabel: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    color: colors.foreground,
    flex: 1,
    marginRight: 8,
  },
  driverPct: {
    fontFamily: fontFamilies.data,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  barTrack: {
    height: 6,
    backgroundColor: "rgba(221, 216, 206, 0.7)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    backgroundColor: "rgba(30, 36, 50, 0.45)",
    borderRadius: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  worstSection: {},
  worstTime: {
    fontFamily: fontFamilies.data,
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 4,
  },
  worstMeta: {
    color: colors.mutedForeground,
    fontFamily: fontFamilies.data,
  },
  worstScore: {
    fontFamily: fontFamilies.dataMedium,
    color: colors.foreground,
  },
  worstReasons: {
    marginTop: 12,
    gap: 6,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  reasonText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    flex: 1,
  },
  noData: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
