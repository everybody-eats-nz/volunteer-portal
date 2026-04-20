import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, ApiError } from './api';

/**
 * Show heads-up alerts + play sound even when the app is foregrounded.
 * Called once at module load so it's registered before any notification
 * arrives (the handler must be set before the first notification event).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#0e3a23',
  });
}

async function getProjectId(): Promise<string | undefined> {
  // Works for both EAS-built and dev-client builds
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId
  );
}

/**
 * Request notification permission and return the Expo push token.
 * Returns null if permission is denied, the device is a simulator without
 * push capability, or the project isn't configured for push.
 */
export async function registerForPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications require a physical device (APNs/FCM don't deliver to
    // simulators).
    return null;
  }

  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = await getProjectId();
  if (!projectId) {
    console.warn('[PUSH] No EAS projectId configured, skipping token fetch');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (err) {
    console.warn('[PUSH] Failed to fetch Expo push token:', err);
    return null;
  }
}

/**
 * Register the device's push token with the web API.
 * Safe to call on every login / app start — the server upserts.
 */
export async function syncPushTokenWithServer(): Promise<string | null> {
  const token = await registerForPushTokenAsync();
  if (!token) return null;

  try {
    await api('/api/mobile/push-tokens', {
      method: 'POST',
      body: {
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Device.deviceName ?? undefined,
      },
    });
    return token;
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn(
        `[PUSH] Token sync failed (${err.status}): ${err.message}`,
      );
    } else {
      console.warn('[PUSH] Token sync failed:', err);
    }
    return null;
  }
}

/**
 * Ask the server to forget this device's push token. Call on logout.
 * Falls back silently — if this fails the server will clean up the token
 * the next time Expo reports it as DeviceNotRegistered.
 */
export async function unregisterPushTokenFromServer(
  token: string,
): Promise<void> {
  try {
    await api('/api/mobile/push-tokens', {
      method: 'DELETE',
      body: { token },
    });
  } catch (err) {
    console.warn('[PUSH] Token unregister failed:', err);
  }
}
