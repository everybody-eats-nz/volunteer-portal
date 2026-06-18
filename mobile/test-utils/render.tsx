/**
 * Thin wrapper over react-test-renderer so component tests stay terse.
 * Renders inside `act` (silences the React update warning) and returns the
 * renderer — use `.root` to query and `.toJSON()` for snapshots.
 *
 * Pair with `vi.mock('react-native', () => import('@/test-utils/react-native'))`
 * in the test file so native primitives resolve to lightweight stubs.
 */
import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

export function render(element: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}
