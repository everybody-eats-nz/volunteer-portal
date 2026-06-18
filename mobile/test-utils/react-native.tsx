/**
 * Minimal `react-native` stand-in for vitest component tests.
 *
 * The real react-native package can't be imported in the node test runner
 * (it pulls in native modules + Flow source). These tests only need the JS
 * surface the shared UI primitives touch, so each native primitive is a tiny
 * composite component that renders its children into a host node — enough for
 * react-test-renderer to build a queryable tree and for snapshots to be
 * meaningful (the `type`, label and key style props survive).
 *
 * Activate it from a test file with:
 *   vi.mock('react-native', () => import('@/test-utils/react-native'));
 */
import React, { type ReactNode } from 'react';

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/** Build a passthrough composite that renders to a named host node. */
function host(name: string) {
  const Component = ({ children, ...props }: AnyProps) =>
    React.createElement(name, props, children as ReactNode);
  Component.displayName = name;
  return Component;
}

export const View = host('View');
export const Text = host('Text');
export const Pressable = host('Pressable');
export const ActivityIndicator = host('ActivityIndicator');

export const StyleSheet = {
  create: <T extends Record<string, object>>(styles: T): T => styles,
  flatten: (style: unknown) =>
    Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style,
  hairlineWidth: 1,
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
};

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T,>(spec: { ios?: T; android?: T; web?: T; default?: T }): T | undefined =>
    spec.ios ?? spec.default,
};

// Colour scheme is a plain (non-hook) function so the real useColorScheme /
// useThemeColor logic runs against a value the test can flip.
let scheme: 'light' | 'dark' = 'light';
export const useColorScheme = (): 'light' | 'dark' => scheme;
export const __setColorScheme = (next: 'light' | 'dark') => {
  scheme = next;
};
export const __resetColorScheme = () => {
  scheme = 'light';
};
