import axios from './api';
import type { AlarmJob } from '../../../server/src/db/schedulesSchema.ts';


export const postAlarm = (alarmJob: AlarmJob) => {
  return axios.post('/alarm', alarmJob);
};

type SideChoice = 'left' | 'right' | 'both';

// Sets a one-time alarm at the next time the clock shows `time` ("HH:mm")
export const postOneTimeAlarm = (side: SideChoice, time: string) => {
  return axios.post('/alarm/time', { side, time });
};

export const cancelOneTimeAlarm = (side: SideChoice) => {
  return axios.post('/alarm/time/cancel', { side });
};
