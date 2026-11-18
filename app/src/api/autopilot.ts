import axios from './api';
import { useQuery } from '@tanstack/react-query';
import type { AutopilotSnapshot } from '../../../server/src/autopilot/autopilotSnapshot.ts';

export type { AutopilotSnapshot };

// What the autopilot sees and has done. `available` is false on Pods without the sensors.
export const useAutopilot = (refetchInterval?: number) => {
  return useQuery<AutopilotSnapshot>({
    queryKey: ['useAutopilot'],
    queryFn: async () => {
      const response = await axios.get<AutopilotSnapshot>('/autopilot');
      return response.data;
    },
    refetchInterval,
  });
};
