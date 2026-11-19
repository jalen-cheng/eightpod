import { isAxiosError } from 'axios';
import axios from './api';
import { useQuery } from '@tanstack/react-query';
import type { AutopilotSnapshot } from '../../../server/src/autopilot/autopilotSnapshot.ts';

import type { NightDetail, NightSummary } from '../../../server/src/autopilot/nightRecord.ts';

export type { AutopilotSnapshot, NightDetail, NightSummary };

// While a test run is under way the bed changes every minute, so it is asked more often
const TEST_REFRESH_MS = 10_000;

// What the autopilot sees and has done. `available` is false on Pods without the sensors.
export const useAutopilot = (refetchInterval?: number) => {
  return useQuery<AutopilotSnapshot>({
    queryKey: ['useAutopilot'],
    queryFn: async () => {
      const response = await axios.get<AutopilotSnapshot>('/autopilot');
      return response.data;
    },
    refetchInterval: refetchInterval === undefined
      ? undefined
      : query => (query.state.data?.rehearsal ? Math.min(refetchInterval, TEST_REFRESH_MS) : refetchInterval),
  });
};

// Starts the 20-minute test run of a night's plan. Resolves to the Pod's reason when it
// refuses (the autopilot is off, the bed is off, a night is under way), or nothing once started.
export const startRehearsal = async (): Promise<string | undefined> => {
  try {
    await axios.post('/autopilot/rehearsal');
    return undefined;
  } catch (error: unknown) {
    const refusal = isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined;
    if (refusal) return refusal;
    throw error;
  }
};

// Stops the test run; the bed goes back to where it began within a minute
export const stopRehearsal = async (): Promise<undefined> => {
  await axios.delete('/autopilot/rehearsal');
  return undefined;
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
