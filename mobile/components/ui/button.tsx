import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, FontFamily, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'primary' | 'ghost' | 'accent' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Optional trailing Ionicon name (e.g. "arrow-forward"). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Place the icon before the label instead of after. */
  iconLeading?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Light fire-and-forget haptic on press (iOS). Default true. */
  haptic?: boolean;
  /** Stretch to fill the parent width. */
  fullWidth?: boolean;
  /** Render light-on-dark (use inside a forest panel). */
  onPanel?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

const SIZES: Record<Size, { padV: number; padH: number; font: number; icon: number; minH: number }> = {
  // sm draws at 40pt; SM_HIT_SLOP takes its touch target to 44pt.
  sm: { padV: 9, padH: 16, font: 13, icon: 15, minH: 40 },
  md: { padV: 13, padH: 22, font: 15, icon: 17, minH: 48 },
  lg: { padV: 16, padH: 26, font: 16, icon: 18, minH: 54 },
};

const SM_HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };

/**
 * Pill button matching the marketing site's btn-primary / btn-ghost / btn-accent.
 * Fully rounded, subtle press feedback (opacity + scale on iOS, a ripple on
 * Android), ≥44pt touch target. `destructive` is the hairline outline in the
 * destructive colour, for decline / cancel / leave actions.
 *
 * The label wraps rather than truncates, so it stays whole at the largest
 * Dynamic Type sizes.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconLeading = false,
  disabled = false,
  loading = false,
  haptic = true,
  fullWidth = false,
  onPanel = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const scheme = useColorScheme();
  const c = Colors[scheme];
  const s = SIZES[size];

  const fill =
    variant === 'primary'
      ? c.primary
      : variant === 'accent'
        ? Palette.sun200
        : 'transparent';

  const fg =
    variant === 'primary'
      ? Palette.cream50
      : variant === 'accent'
        ? Palette.ink
        : variant === 'destructive'
          ? c.destructive
          : onPanel
            ? Palette.cream50
            : c.tint;

  const outlined = variant === 'ghost' || variant === 'destructive';
  const borderColor =
    variant === 'destructive'
      ? c.border
      : variant === 'ghost'
        ? onPanel
          ? 'rgba(253,248,239,0.3)'
          : scheme === 'dark'
            ? 'rgba(253,248,239,0.25)'
            : 'rgba(29,83,55,0.3)'
        : 'transparent';

  const rippleColor =
    variant === 'primary' || onPanel
      ? 'rgba(253,248,239,0.22)'
      : variant === 'accent'
        ? 'rgba(26,20,16,0.12)'
        : scheme === 'dark'
          ? 'rgba(253,248,239,0.12)'
          : 'rgba(29,83,55,0.12)';

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic && Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const iconNode = icon ? (
    <Ionicons name={icon} size={s.icon} color={fg} />
  ) : null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={loading ? { disabled: true, busy: true } : { disabled }}
      testID={testID}
      hitSlop={size === 'sm' ? SM_HIT_SLOP : undefined}
      android_ripple={{ color: rippleColor, foreground: true }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: fill,
          borderColor,
          borderWidth: outlined ? 1 : 0,
          paddingVertical: s.padV,
          paddingHorizontal: s.padH,
          minHeight: s.minH,
          // Android shows the ripple instead of the iOS dim-and-shrink.
          opacity: disabled ? 0.45 : pressed && Platform.OS === 'ios' ? 0.9 : 1,
          transform: [{ scale: pressed && Platform.OS === 'ios' ? 0.98 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.row}>
          {iconLeading && iconNode}
          <Text style={[styles.label, { color: fg, fontSize: s.font }]}>{label}</Text>
          {!iconLeading && iconNode}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the Android ripple to the pill.
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.1,
    textAlign: 'center',
    flexShrink: 1,
  },
});
