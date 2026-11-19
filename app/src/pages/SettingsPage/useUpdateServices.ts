import { useCallback } from 'react';
import { DeepPartial } from 'ts-essentials';
import { Services, postServices, useServices } from '@api/services.ts';
import { useAppStore } from '@state/appStore.tsx';

// The Pod's optional services (biometrics, error reporting) and a way to switch them, with the
// app's "updating" bar showing while a change is saved
export function useUpdateServices() {
  const { data: services, refetch } = useServices();
  const setIsUpdating = useAppStore(state => state.setIsUpdating);

  const updateServices = useCallback((changes: DeepPartial<Services>) => {
    setIsUpdating(true);
    postServices(changes)
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  }, [refetch, setIsUpdating]);

  return { services, updateServices };
}
