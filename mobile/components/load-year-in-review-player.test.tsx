import { afterEach, describe, expect, it, vi } from 'vitest';

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

const load = async () =>
  (await import('@/components/load-year-in-review-player')).YearInReviewPlayer;

describe('YearInReviewPlayer loader', () => {
  afterEach(() => {
    vi.resetModules();
    get.mockReset();
    os = 'ios';
  });

  // App Store 1.0.10 (52) took the screen over the air without the native
  // module, and importing react-native-webview there closed the app.
  it('is null when the binary has no WebView module, without loading the player', async () => {
    get.mockReturnValue(null);

    expect(await load()).toBeNull();
    expect(get).toHaveBeenCalledWith('RNCWebViewModule');
  });

  it('is null on web, where there is no native WebView', async () => {
    os = 'web';
    get.mockReturnValue({});

    expect(await load()).toBeNull();
  });
});
