import { useCallback } from 'react';
import { DeepPartial } from 'ts-essentials';
import { postSettings, useSettings } from '@api/settings.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';

// Saves a change to the Pod's settings and loads them again, with the app's "updating" bar
// showing meanwhile. For any page that has settings on it.
export function useUpdateSettings() {
  const { refetch } = useSettings();
  const setIsUpdating = useAppStore(state => state.setIsUpdating);

  return useCallback((changes: DeepPartial<Settings>) => {
    setIsUpdating(true);
    postSettings(changes)
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  }, [refetch, setIsUpdating]);
}
