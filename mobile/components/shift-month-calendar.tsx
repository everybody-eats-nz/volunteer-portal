import { Ionicons } from "@expo/vector-icons";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatNZT } from "@/lib/dates";
import { Brand, Colors, FontFamily } from "@/constants/theme";

type ShiftMonthCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** Key "YYYY-MM-DD" → count of available shifts that day */
  shiftCountByDate: Record<string, number>;
  /** Key "YYYY-MM-DD" → true if any friends are going that day */
  friendDates: Set<string>;
  /** Key "YYYY-MM-DD" → true if user is signed up for an upcoming shift that day */
  signedUpDates: Set<string>;
  /** Key "YYYY-MM-DD" → true if user attended a shift on that past day */
  pastAttendedDates: Set<string>;
  isDark: boolean;
  /** Force initial visible month (defaults to selectedDate's month) */
  initialMonth?: Date;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function formatDateKey(date: Date): string {
  return formatNZT(date, "yyyy-MM-dd");
}

export function ShiftMonthCalendar({
  selectedDate,
  onSelectDate,
  shiftCountByDate,
  friendDates,
  signedUpDates,
  pastAttendedDates,
  isDark,
  initialMonth,
}: ShiftMonthCalendarProps) {
  const colors = Colors[isDark ? "dark" : "light"];
  const [visibleMonth, setVisibleMonth] = useState(
    () => initialMonth ?? startOfMonth(selectedDate)
  );

  // When parent changes selectedDate to a different month (e.g. via quick chip),
  // flip the visible month to follow. Internal month nav stays independent.
  useEffect(() => {
    if (!isSameMonth(selectedDate, visibleMonth)) {
      setVisibleMonth(startOfMonth(selectedDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [visibleMonth]);

  const goToPrevMonth = () => {
    Haptics.selectionAsync();
    setVisibleMonth((m) => subMonths(m, 1));
  };

  const goToNextMonth = () => {
    Haptics.selectionAsync();
    setVisibleMonth((m) => addMonths(m, 1));
  };

  const handleSelectDay = (day: Date, hasContent: boolean) => {
    if (!hasContent) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // If user taps a faded day from the adjacent month, flip the visible month
    if (!isSameMonth(day, visibleMonth)) {
      setVisibleMonth(startOfMonth(day));
    }
    onSelectDate(day);
  };

  return (
    <View style={styles.container}>
      {/* Month header with prev/next */}
      <View style={styles.monthHeader}>
        <Pressable
          onPress={goToPrevMonth}
          hitSlop={12}
          style={({ pressed }) => [
            styles.monthNavButton,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(14, 58, 35, 0.06)",
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityLabel="Previous month"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>

        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {formatNZT(visibleMonth, "MMMM yyyy")}
        </Text>

        <Pressable
          onPress={goToNextMonth}
          hitSlop={12}
          style={({ pressed }) => [
            styles.monthNavButton,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(14, 58, 35, 0.06)",
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityLabel="Next month"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, idx) => (
          <Text
            key={`${label}-${idx}`}
            style={[styles.weekdayLabel, { color: colors.textSecondary }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {weeks.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.weekRow}>
            {week.map((day) => {
              const key = formatDateKey(day);
              const shiftCount = shiftCountByDate[key] ?? 0;
              const hasFriends = friendDates.has(key);
              const isSignedUp = signedUpDates.has(key);
              const isPastAttended = pastAttendedDates.has(key);
              const isSelected = isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, visibleMonth);
              const isTodayCell = isToday(day);

              const hasContent = shiftCount > 0 || isSignedUp || isPastAttended;

              return (
                <DayCell
                  key={key}
                  day={day}
                  shiftCount={shiftCount}
                  hasFriends={hasFriends}
                  isSignedUp={isSignedUp}
                  isPastAttended={isPastAttended}
                  isSelected={isSelected}
                  inMonth={inMonth}
                  isToday={isTodayCell}
                  hasContent={hasContent}
                  isDark={isDark}
                  onPress={() => handleSelectDay(day, hasContent)}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSquare,
              {
                backgroundColor: isDark
                  ? "rgba(134, 239, 172, 0.18)"
                  : Brand.greenLight,
                borderColor: isDark ? "rgba(134, 239, 172, 0.4)" : "#b8dbb8",
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            {"You're on"}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              {
                backgroundColor: isDark
                  ? "rgba(134, 239, 172, 0.55)"
                  : "#94a3b8",
              },
            ]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Past shift
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#f5c518" }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Friends going
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ── Day cell ── */

function DayCell({
  day,
  shiftCount,
  hasFriends,
  isSignedUp,
  isPastAttended,
  isSelected,
  inMonth,
  isToday,
  hasContent,
  isDark,
  onPress,
}: {
  day: Date;
  shiftCount: number;
  hasFriends: boolean;
  isSignedUp: boolean;
  isPastAttended: boolean;
  isSelected: boolean;
  inMonth: boolean;
  isToday: boolean;
  hasContent: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const dayNumber = formatNZT(day, "d");

  const pastDotColor = isDark ? "rgba(134, 239, 172, 0.55)" : "#94a3b8";
  const friendColor = "#f5c518"; // gold — distinct from green

  // Subtle tappable-target background for days that have shifts available
  const hasShiftsBg = shiftCount > 0 && !isSelected && !isSignedUp;

  const cellBg = isSelected
    ? Brand.green
    : isSignedUp
      ? isDark
        ? "rgba(134, 239, 172, 0.18)"
        : Brand.greenLight
      : hasShiftsBg
        ? isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(14, 58, 35, 0.04)"
        : "transparent";

  const cellBorderColor = isSelected
    ? Brand.green
    : isSignedUp
      ? isDark
        ? "rgba(134, 239, 172, 0.4)"
        : "#b8dbb8"
      : "transparent";

  // Dim empty days so shift days pop — still show today's accent regardless
  const emptyOpacity = hasContent ? 1 : 0.3;

  const numberColor = isSelected
    ? "#ffffff"
    : !inMonth
      ? colors.textSecondary
      : isToday
        ? isDark
          ? "#86efac"
          : Brand.green
        : colors.text;

  const numberWeight = isToday || isSelected || isSignedUp
    ? FontFamily.bold
    : FontFamily.medium;

  return (
    <Pressable
      onPress={onPress}
      disabled={!hasContent}
      style={({ pressed }) => [
        styles.cell,
        {
          opacity: pressed && hasContent ? 0.7 : inMonth ? 1 : 0.4,
        },
      ]}
      accessibilityLabel={`${formatNZT(day, "EEEE, d MMMM")}${
        shiftCount > 0 ? `, ${shiftCount} shifts` : ", no shifts"
      }${hasFriends ? ", friends going" : ""}${
        isSignedUp ? ", you're signed up" : ""
      }${isPastAttended ? ", shift attended" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: !hasContent }}
    >
      <View
        style={[
          styles.cellInner,
          {
            backgroundColor: cellBg,
            borderColor: cellBorderColor,
            borderWidth: isSelected || isSignedUp ? 1 : 0,
            opacity: emptyOpacity,
          },
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            {
              color: numberColor,
              fontFamily: numberWeight,
            },
          ]}
        >
          {dayNumber}
        </Text>

        {/* Past-attended + friend dots */}
        <View style={styles.dotRow}>
          {isPastAttended && (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isSelected ? "#ffffff" : pastDotColor,
                },
              ]}
            />
          )}
          {hasFriends && (
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isSelected ? Brand.accent : friendColor,
                },
              ]}
            />
          )}
        </View>

      </View>
    </Pressable>
  );
}

/* ── Styles ── */

const CELL_HEIGHT = 46;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
  },

  // Month header
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 17,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.2,
  },

  // Weekday row
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1,
  },

  // Grid
  grid: {
    gap: 2,
  },
  weekRow: {
    flexDirection: "row",
    gap: 2,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cellInner: {
    width: 38,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
    minHeight: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
});
