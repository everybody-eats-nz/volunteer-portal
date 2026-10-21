import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { Colors } from "@/constants/theme";

import { styles as feedStyles } from "./feed-card";

const SKELETON_ROWS: { title: number; body: number[] }[] = [
  { title: 55, body: [92, 68] },
  { title: 45, body: [88] },
  { title: 60, body: [94, 74, 40] },
];

export function FeedSkeleton({ colors }: { colors: (typeof Colors)["light"] }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View accessibilityLabel="Loading activity feed">
      {SKELETON_ROWS.map((row, i) => (
        <View
          key={i}
          style={[
            feedStyles.feedCard,
            i < SKELETON_ROWS.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Animated.View
            style={[
              feedStyles.feedIcon,
              { backgroundColor: colors.border, opacity: pulse },
            ]}
          />
          <View style={[feedStyles.feedBody, { gap: 8, paddingTop: 4 }]}>
            <Animated.View
              style={[
                styles.skeletonBar,
                {
                  width: `${row.title}%`,
                  height: 13,
                  backgroundColor: colors.border,
                  opacity: pulse,
                },
              ]}
            />
            {row.body.map((w, j) => (
              <Animated.View
                key={j}
                style={[
                  styles.skeletonBar,
                  {
                    width: `${w}%`,
                    height: 11,
                    backgroundColor: colors.border,
                    opacity: pulse,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBar: {
    borderRadius: 4,
  },
});
