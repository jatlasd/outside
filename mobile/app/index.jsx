import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { hourReadoutEntries, yesterdayComparisonLine } from "../lib/formatImperial";
import { getWeather } from "../lib/getWeather";
import {
  filterHoursByDatePrefix,
  normalizeHourly,
  todayDatePrefixInTimeZone,
  calendarDatePrefixInTimeZone,
  sameClockHourOnDatePrefix,
  currentHourPrefixInTimeZone,
} from "../lib/normalizeHourly";
import {
  DEFAULT_LOCATION,
  defaultParamWeights,
  getActiveProfile,
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
import { formatTimeKey12Hour } from "../lib/time";
import { formatLocationCoordinates } from "../lib/locationFormat";

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
  const [weatherNormalizedHours, setWeatherNormalizedHours] = useState(null);
  const [weatherTimezone, setWeatherTimezone] = useState(null);
  const [viewedDayOffset, setViewedDayOffset] = useState(0);
  const [selectedHourTime, setSelectedHourTime] = useState(null);
  const [showAllHours, setShowAllHours] = useState(false);
  const [showDayBreakdown, setShowDayBreakdown] = useState(false);
  const [flags, setFlags] = useState(() => ({ ...DEFAULT_FLAGS }));
  const [weights, setWeights] = useState(() => defaultParamWeights());
  const [location, setLocation] = useState(() => ({ ...DEFAULT_LOCATION }));
  const loadRequestIdRef = useRef(0);
  const preferencesSignatureRef = useRef(null);
  const preferencesProfileRef = useRef(null);

  const preferencesSignature = useCallback(
    (f, w, loc, profileId) => JSON.stringify({ f, w, loc, profileId }),
    []
  );

  const invalidateReadoutState = useCallback(() => {
    setError(null);
    setWeatherNormalizedHours(null);
    setWeatherTimezone(null);
    setViewedDayOffset(0);
    setSelectedHourTime(null);
    setShowAllHours(false);
    setShowDayBreakdown(false);
  }, []);

  const loadPreferences = useCallback(async () => {
    const profileId = await getActiveProfile();
    const [f, w, loc] = await Promise.all([
      loadParamFlags(profileId),
      loadParamWeights(profileId),
      loadLocationPreference(profileId),
    ]);
    setFlags(f);
    setWeights(w);
    setLocation(loc);
    return { f, w, loc, profileId };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { f, w, loc, profileId } = await loadPreferences();
      if (!active) return;
      preferencesSignatureRef.current = preferencesSignature(f, w, loc, profileId);
      preferencesProfileRef.current = profileId;
    })();
    return () => {
      active = false;
    };
  }, [loadPreferences, preferencesSignature]);

  const load = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const { f, w, loc } = await loadPreferences();
    if (requestId !== loadRequestIdRef.current) return;
    setLoading(true);
    invalidateReadoutState();
    try {
      if (!hasAnyParamEnabled(f)) {
        if (requestId !== loadRequestIdRef.current) return;
        setError("Turn on at least one parameter in Settings.");
        return;
      }
      const { forecast, air, timezone } = await getWeather(f, loc, { pastDays: 2 });
      if (requestId !== loadRequestIdRef.current) return;
      const hours = normalizeHourly(forecast, air, f);
      const todayPrefix = todayDatePrefixInTimeZone(timezone);
      const todayHours = filterHoursByDatePrefix(hours, todayPrefix);
      if (!todayHours.length) {
        setError("No usable hourly readings are available for today at this location.");
        return;
      }
      setWeatherNormalizedHours(hours);
      setWeatherTimezone(timezone);
      setViewedDayOffset(0);
    } catch (e) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
    }
  }, [invalidateReadoutState, loadPreferences]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const { f, w, loc, profileId } = await loadPreferences();
        if (!active) return;
        const nextSignature = preferencesSignature(f, w, loc, profileId);
        const previousSignature = preferencesSignatureRef.current;
        const previousProfile = preferencesProfileRef.current;
        if (previousSignature && previousSignature !== nextSignature) {
          invalidateReadoutState();
          if (previousProfile != null && previousProfile !== profileId) {
            void load();
          }
        }
        preferencesSignatureRef.current = nextSignature;
        preferencesProfileRef.current = profileId;
      })();
      return () => {
        active = false;
      };
    }, [invalidateReadoutState, load, loadPreferences, preferencesSignature])
  );

  const viewedDatePrefix = useMemo(() => {
    if (!weatherTimezone) return null;
    return calendarDatePrefixInTimeZone(weatherTimezone, viewedDayOffset);
  }, [weatherTimezone, viewedDayOffset]);

  const allScored = useMemo(() => {
    if (!viewedDatePrefix || !weatherNormalizedHours?.length) return null;
    const dayHours = filterHoursByDatePrefix(weatherNormalizedHours, viewedDatePrefix);
    const scored = scoreHours(dayHours, flags, weights);
    return scored.length ? scored : null;
  }, [weatherNormalizedHours, viewedDatePrefix, flags, weights]);

  const rollup = useMemo(() => {
    if (!allScored?.length) return null;
    return rollupHours(allScored);
  }, [allScored]);

  const hourByTime = useMemo(() => {
    if (!weatherNormalizedHours?.length) return new Map();
    return new Map(weatherNormalizedHours.map((h) => [h.time, h]));
  }, [weatherNormalizedHours]);

  const priorDayComparisonLabel = useMemo(() => {
    if (viewedDayOffset === 0) return "Yesterday";
    if (viewedDayOffset === 1) return "Today";
    return "2 days ago";
  }, [viewedDayOffset]);

  const readoutCache = useMemo(() => {
    if (!allScored?.length || !weatherTimezone) return null;
    const priorPrefix = calendarDatePrefixInTimeZone(weatherTimezone, viewedDayOffset - 1);
    const m = new Map();
    for (const row of allScored) {
      const offenders = topBreakdownContributors(row.breakdown, 2);
      const offenderById = new Map(offenders.map((item) => [item.id, item]));
      const yKey = sameClockHourOnDatePrefix(row.time, priorPrefix);
      const yRow = yKey ? hourByTime.get(yKey) : null;
      const compareYesterday = new Map();
      if (yRow) {
        for (const id of Object.keys(flags)) {
          if (!flags[id]) continue;
          const line = yesterdayComparisonLine(id, row, yRow, priorDayComparisonLabel);
          if (line) compareYesterday.set(id, line);
        }
      }
      m.set(row.time, hourReadoutEntries(row, flags, { offenderById, compareYesterday }));
    }
    return m;
  }, [allScored, flags, hourByTime, weatherTimezone, viewedDayOffset, priorDayComparisonLabel]);

  useEffect(() => {
    if (!allScored?.length) {
      setSelectedHourTime(null);
      return;
    }
    setSelectedHourTime((prev) => {
      if (prev && viewedDatePrefix) {
        const mapped = sameClockHourOnDatePrefix(prev, viewedDatePrefix);
        if (mapped && allScored.some((h) => h.time === mapped)) return mapped;
      }
      if (viewedDayOffset === 0 && weatherTimezone) {
        const nowPrefix = currentHourPrefixInTimeZone(weatherTimezone);
        const hit = allScored.find((h) => h.time === nowPrefix);
        if (hit) return hit.time;
      }
      return allScored[0].time;
    });
  }, [allScored, viewedDatePrefix, viewedDayOffset, weatherTimezone]);

  const yesterdayPrefix = useMemo(() => {
    if (!weatherTimezone) return null;
    return calendarDatePrefixInTimeZone(weatherTimezone, -1);
  }, [weatherTimezone]);

  const tomorrowPrefix = useMemo(() => {
    if (!weatherTimezone) return null;
    return calendarDatePrefixInTimeZone(weatherTimezone, 1);
  }, [weatherTimezone]);

  const hasYesterdayHours = useMemo(() => {
    if (!yesterdayPrefix || !weatherNormalizedHours?.length) return false;
    return weatherNormalizedHours.some((h) => h.time.startsWith(yesterdayPrefix));
  }, [yesterdayPrefix, weatherNormalizedHours]);

  const hasTomorrowHours = useMemo(() => {
    if (!tomorrowPrefix || !weatherNormalizedHours?.length) return false;
    return weatherNormalizedHours.some((h) => h.time.startsWith(tomorrowPrefix));
  }, [tomorrowPrefix, weatherNormalizedHours]);

  const currentHour = useMemo(() => {
    if (viewedDayOffset !== 0 || !allScored?.length || !weatherTimezone) return null;
    const nowPrefix = currentHourPrefixInTimeZone(weatherTimezone);
    return allScored.find((h) => h.time === nowPrefix) ?? null;
  }, [viewedDayOffset, allScored, weatherTimezone]);

  const viewedDayShortLabel = useMemo(() => {
    if (!viewedDatePrefix) return "";
    const parts = viewedDatePrefix.split("-").map(Number);
    const y = parts[0];
    const mo = parts[1];
    const d = parts[2];
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return viewedDatePrefix;
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    try {
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return viewedDatePrefix;
    }
  }, [viewedDatePrefix]);

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
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.settingsBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
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
        <Button
          onPress={load}
          disabled={loading || !canLoad}
          accessibilityLabel={loading ? "Loading readout" : "Load readout"}
        >
          {loading ? "Loading\u2026" : "Load readout"}
        </Button>
      </Animated.View>

      {weatherNormalizedHours && !error ? (
        <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.dayNav}>
          <Text style={styles.dayNavLabel}>Day</Text>
          <Pressable
            onPress={() => setViewedDayOffset(-1)}
            disabled={!hasYesterdayHours}
            style={[styles.dayNavBtn, viewedDayOffset === -1 && styles.dayNavBtnActive, !hasYesterdayHours && styles.dayNavBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="View yesterday"
          >
            <Text style={[styles.dayNavBtnText, viewedDayOffset === -1 && styles.dayNavBtnTextActive]}>Yesterday</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewedDayOffset(0)}
            style={[styles.dayNavBtn, viewedDayOffset === 0 && styles.dayNavBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="View today"
          >
            <Text style={[styles.dayNavBtnText, viewedDayOffset === 0 && styles.dayNavBtnTextActive]}>Today</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewedDayOffset(1)}
            disabled={!hasTomorrowHours}
            style={[styles.dayNavBtn, viewedDayOffset === 1 && styles.dayNavBtnActive, !hasTomorrowHours && styles.dayNavBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="View tomorrow"
          >
            <Text style={[styles.dayNavBtnText, viewedDayOffset === 1 && styles.dayNavBtnTextActive]}>Tomorrow</Text>
          </Pressable>
          {viewedDatePrefix ? (
            <Text style={styles.dayNavDate}>
              {viewedDayShortLabel} · {viewedDatePrefix}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {weatherNormalizedHours && !error && !allScored?.length ? (
        <Text style={styles.emptyDayText}>
          No hourly readings for this day in the loaded window. Try another day or refresh.
        </Text>
      ) : null}

      {!canLoad && (
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.emptyNotice}>
          <Text style={styles.emptyNoticeText}>
            Nothing is included yet. Choose what outside means for you in Settings,
            set how strongly each factor counts, then load today\u2019s hours.
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => router.push("/settings")}
            style={{ marginTop: 12 }}
            accessibilityLabel="Open settings"
          >
            Open Settings
          </Button>
        </Animated.View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && !weatherNormalizedHours && (
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
            {viewedDayOffset === 0
              ? "No matching current-hour reading yet. Refresh the readout to evaluate immediate outside impact."
              : "Live \u201cright now\u201d impact is for today only. Use Today above to jump back."}
          </ImpactCard>
          <DayImpactCard rollup={rollup} />
        </Animated.View>
      )}

      {rollup && (
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Pressable
            onPress={() => setShowDayBreakdown((v) => !v)}
            style={styles.breakdownToggle}
            accessibilityRole="button"
            accessibilityLabel={showDayBreakdown ? "Hide day breakdown" : "Show day breakdown"}
          >
            <Text style={styles.breakdownToggleText}>
              {showDayBreakdown ? "Hide day breakdown" : "Why this day looks this way"}
            </Text>
          </Pressable>
          {showDayBreakdown ? <BreakdownSection rollup={rollup} /> : null}
        </Animated.View>
      )}

      {allScored?.length > 0 && (
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <Text style={styles.logTitle}>
            Hourly timeline{viewedDayShortLabel ? ` · ${viewedDayShortLabel}` : ""}
          </Text>
          <Text style={styles.logDescription}>
            Pick an hour first. Scroll sideways; each column is one hour. Darker fills mean stronger outside pressure. Values show in °F; trend thresholds use °C steps internally, then your sensitivity weights apply. Open details to compare the same clock hour to the prior calendar day when data is available.
          </Text>
          <DayStrip
            scored={allScored}
            selectedTime={selectedHour?.time}
            onSelect={(time) => setSelectedHourTime(time)}
          />
          <Pressable
            onPress={() => setShowAllHours((v) => !v)}
            style={styles.hourToggleBtn}
            accessibilityRole="button"
            accessibilityLabel={showAllHours ? "Show selected hour only" : "Show all hours"}
          >
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
            key={`${item.time}-${showAllHours}`}
            row={item}
            readoutEntries={readoutCache?.get(item.time) ?? []}
            isEven={index % 2 === 1}
            defaultExpanded={!showAllHours}
            hideSummaryTap={!showAllHours}
            showYesterdayHint={Boolean(readoutCache?.get(item.time)?.some((e) => e.yesterdayLine))}
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
          <Text style={breakdownStyles.sectionTitle}>TOP DRIVERS THIS DAY</Text>
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
              {formatTimeKey12Hour(rollup.worst.time)}
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
    borderLeftColor: colors.borderWarm,
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
  dayNav: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayNavLabel: {
    fontFamily: fontFamilies.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: colors.mutedForeground,
    textTransform: "uppercase",
  },
  dayNavBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  dayNavBtnActive: {
    borderColor: colors.foreground,
    backgroundColor: colors.foreground,
  },
  dayNavBtnDisabled: {
    opacity: 0.4,
  },
  dayNavBtnText: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },
  dayNavBtnTextActive: {
    color: colors.background,
  },
  dayNavDate: {
    fontFamily: fontFamilies.data,
    fontSize: 11,
    color: colors.mutedForeground,
    flexBasis: "100%",
    marginTop: 4,
  },
  emptyDayText: {
    fontFamily: fontFamilies.sans,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
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
    backgroundColor: colors.surfaceCard,
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
