import axios from './api';
import { useQuery } from '@tanstack/react-query';
import type { PresenceSnapshot } from '../../../server/src/8sleep/presenceDetector.ts';

export type { PresenceSnapshot };

// Says the bed is empty right now, so in-bed detection learns the empty bed again
export const postBedIsEmpty = () => axios.post('/metrics/presence/sensors/empty');

// What the bed's own presence sensors say right now. Not available on Pods without them.
export const usePresenceSensors = (refetchInterval?: number) => {
  return useQuery<PresenceSnapshot>({
    queryKey: ['usePresenceSensors'],
    queryFn: async () => {
      const response = await axios.get<PresenceSnapshot>('/metrics/presence/sensors');
      return response.data;
    },
    refetchInterval,
  });
};
