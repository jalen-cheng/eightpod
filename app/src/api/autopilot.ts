import axios from './api';
import { useQuery } from '@tanstack/react-query';
import type { AutopilotSnapshot } from '../../../server/src/autopilot/autopilotSnapshot.ts';

import type { NightDetail, NightSummary } from '../../../server/src/autopilot/nightRecord.ts';

export type { AutopilotSnapshot, NightDetail, NightSummary };

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

// One side's stays in bed that ended on a day (YYYY-MM-DD), in full, longest first
export const useNightsOn = (date: string, side: 'left' | 'right') => {
  return useQuery<NightDetail[]>({
    queryKey: ['useNightsOn', date, side],
    queryFn: async () => {
      const response = await axios.get<NightDetail[]>('/autopilot/nights', { params: { date, side } });
      return response.data;
    },
  });
};
