import React, { useEffect } from 'react';
import { create } from 'zustand';
import moment from 'moment-timezone';

import { postSettings, useSettings } from '@api/settings.ts';
import { useServices } from '@api/services.ts';
import { closeSentry, initSentryTags } from '../sentry.tsx';
import { useDeviceStatus } from '@api/deviceStatus.ts';

export type Side = 'left' | 'right';

type AppState = {
  isUpdating: boolean;
  setIsUpdating: (isUpdating: boolean) => void;
  side: Side;
  setSide: (side: Side) => void;
  // When true, temperature, power and schedule changes apply to both sides. Saved in the Pod's
  // settings, so every device and the buttons at the bed agree on it.
  linkSides: boolean;
  setLinkSides: (linkSides: boolean) => void;
  // Takes the value from the Pod's settings without writing it back
  syncLinkSides: (linkSides: boolean) => void;
};

const SIDE_KEY = 'side';
export const USER_ID_KEY = 'user_id';
export const HUB_VERSION_KEY = 'pod_version';
export const COVER_VERSION_KEY = 'cover_version';

// Create Zustand store
export const useAppStore = create<AppState>((set) => ({
  isUpdating: false,
  setIsUpdating: (isUpdating: boolean) => set({ isUpdating }),
  side: localStorage.getItem(SIDE_KEY) as Side || 'left',
  setSide: (side: Side) => {
    set({ side });
    localStorage.setItem(SIDE_KEY, side);
  },
  linkSides: false,
  setLinkSides: (linkSides: boolean) => {
    set({ linkSides });
    postSettings({ linkSides }).catch(error => console.error(error));
  },
  syncLinkSides: (linkSides: boolean) => set({ linkSides }),
}));

// AppStoreProvider to sync Zustand with react-query's isFetching
export function AppStoreProvider({ children }: React.PropsWithChildren) {
  const { data: settings } = useSettings();
  const { data: services } = useServices();
  const { data: deviceStatus } = useDeviceStatus();

  const syncLinkSides = useAppStore(state => state.syncLinkSides);
  useEffect(() => {
    if (!settings) return;
    moment.tz.setDefault(settings.timeZone);
    syncLinkSides(settings.linkSides);
  }, [settings, syncLinkSides]);

  useEffect(() => {
    if (!settings || !deviceStatus || !services) return;
    localStorage.setItem(USER_ID_KEY, settings.id);
    localStorage.setItem(HUB_VERSION_KEY, deviceStatus.hubVersion);
    localStorage.setItem(COVER_VERSION_KEY, deviceStatus.coverVersion);

    if (services.sentryLogging) {
      initSentryTags(settings, deviceStatus);
    } else {
      closeSentry();
    }
  }, [settings, deviceStatus, services]);

  return <>{ children }</>;
}
