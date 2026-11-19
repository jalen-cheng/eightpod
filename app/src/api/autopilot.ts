import { isAxiosError } from 'axios';
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

// The stays in bed that ended on a day (YYYY-MM-DD), in full, longest first: one side's own, or
// without a side the bed's as one sleeper's
export const useNightsOn = (date: string, side: 'left' | 'right' | undefined, refetchInterval?: number) => {
  return useQuery<NightDetail[]>({
    queryKey: ['useNightsOn', date, side ?? 'bed'],
    queryFn: async () => {
      const response = await axios.get<NightDetail[]>('/autopilot/nights', { params: side ? { date, side } : { date } });
      // Anything but a list (a Pod on an older version answers with a page) is a failure to load
      if (!Array.isArray(response.data)) throw new Error('The Pod did not send a list of nights');
      return response.data;
    },
    refetchInterval,
  });
};

type SleepTimes = { source: string; asleepAt: string; awakeAt: string };

// Files when the sleeper slept (their own account, or a tracker's) with the stays in bed it
// overlaps. Resolves to the Pod's reason when it refuses the times, or nothing once saved.
export const postSleepTimes = async (sleepTimes: SleepTimes): Promise<string | undefined> => {
  try {
    await axios.post('/autopilot/sleepTimes', sleepTimes);
    return undefined;
  } catch (error: unknown) {
    const refusal = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
    if (refusal) return refusal;
    throw error;
  }
};
