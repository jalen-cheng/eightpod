import axios from './api';
import { useQuery } from '@tanstack/react-query';
import type { AutopilotSnapshot } from '../../../server/src/autopilot/autopilotSnapshot.ts';

import type { NightSummary } from '../../../server/src/autopilot/nightRecord.ts';

export type { AutopilotSnapshot, NightSummary };

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

// The stays in bed the Pod has saved, newest first, without their minute rows
export const useAutopilotNights = (limit: number) => {
  return useQuery<NightSummary[]>({
    queryKey: ['useAutopilotNights', limit],
    queryFn: async () => {
      const response = await axios.get<NightSummary[]>('/autopilot/nights', { params: { limit } });
      return response.data;
    },
  });
};
