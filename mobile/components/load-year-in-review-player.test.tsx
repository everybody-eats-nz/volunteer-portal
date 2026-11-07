import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
let os = 'ios';

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return os;
    },
  },
  TurboModuleRegistry: { get: (name: string) => get(name) },
}));

// The module evaluates the real loader on import; with no WebView module it
// returns null without requiring the player, so importing it here is safe.
const loader = async () => {
  get.mockReturnValue(null);
  const mod = await import('@/components/load-year-in-review-player');
  get.mockReset();
  return mod;
};

describe('Year in mahi player loader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    get.mockReset();
    os = 'ios';
  });

  // App Store 1.0.10 (52) took the screen over the air without the native
  // module, and importing react-native-webview there closed the app.
  it('is null without the WebView module, and never loads the player', async () => {
    const { chooseYearInReviewPlayer } = await loader();
    const load = vi.fn(() => 'player');
    get.mockReturnValue(null);

    expect(chooseYearInReviewPlayer(load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('RNCWebViewModule');
  });

  it('loads the player when the binary has the WebView module', async () => {
    const { chooseYearInReviewPlayer } = await loader();
    const load = vi.fn(() => 'player');
    get.mockReturnValue({});

    expect(chooseYearInReviewPlayer(load)).toBe('player');
    expect(load).toHaveBeenCalledOnce();
  });

  it('is null on web, where there is no native WebView', async () => {
    const { chooseYearInReviewPlayer } = await loader();
    const load = vi.fn(() => 'player');
    os = 'web';
    get.mockReturnValue({});

    expect(chooseYearInReviewPlayer(load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('exports no player when imported on a binary without the module', async () => {
    const { YearInReviewPlayer } = await loader();

    expect(YearInReviewPlayer).toBeNull();
  });
});
