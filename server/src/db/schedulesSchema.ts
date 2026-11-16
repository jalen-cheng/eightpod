// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

import { z } from 'zod';
import { MIN_TEMPERATURE_F } from './temperatureCurve.js';
const timeRegexFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const SideSchema = z.enum(['right', 'left']);


// Reusable Zod type for time
export const TimeSchema = z.string().regex(timeRegexFormat, 'Invalid time format, must be HH:mm');
// 50°F is the coldest the Pod can be set to. Up to 110 is accepted (the old maximum) and treated as the hottest.
export const TemperatureSchema = z.number().int().min(MIN_TEMPERATURE_F).max(110);


// The longest alarm that can be asked for. The firmware runs at most MAX_FIRMWARE_ALARM_SECONDS
// at a time, so a longer alarm is sent as several stretches (see alarmSession).
export const MAX_ALARM_SECONDS = 1800;
export const MAX_FIRMWARE_ALARM_SECONDS = 180;
// An alarm set for after the schedule's off time keeps the bed on until it has gone off, as long
// as it is within this many hours of the off time. Later than that it belongs to another night.
export const LATE_ALARM_WINDOW_HOURS = 6;

export const AlarmSchema = z.object({
  vibrationIntensity: z.number().int().min(1).max(100),
  vibrationPattern: z.enum(['double', 'rise']),
  duration: z.number().int().positive().min(0).max(MAX_ALARM_SECONDS),
}).strict();

export const AlarmJobSchema = AlarmSchema.extend({
  side: SideSchema,
  force: z.boolean().optional(),
  // Set by the server on the later stretches of a ramp-up alarm: how many ramp steps are done
  rampStep: z.number().int().min(0).optional(),
  // Switch the side off when this alarm is dismissed (not when it runs out)
  turnOffAfterDismiss: z.boolean().optional(),
}).strict();

export const AlarmScheduleSchema = AlarmSchema.extend({
  time: TimeSchema,
  enabled: z.boolean(),
  alarmTemperature: TemperatureSchema,
  // Minutes before the alarm to start warming the side to alarmTemperature. 0 or missing: no warm-up.
  // Optional so schedules saved before this existed stay valid.
  preWarmMinutes: z.number().int().min(0).max(60).optional(),
  turnOffAfterDismiss: z.boolean().optional(),
}).strict();



export const DailyScheduleSchema = z.object({
  temperatures: z.record(
    TimeSchema,
    TemperatureSchema,
  ),
  alarm: AlarmScheduleSchema,
  power: z.object({
    on: TimeSchema,
    off: TimeSchema,
    onTemperature: TemperatureSchema,
    enabled: z.boolean(),
  }),
}).strict();

// Define the SideSchedule schema
export const SideScheduleSchema = z.object({
  sunday: DailyScheduleSchema,
  monday: DailyScheduleSchema,
  tuesday: DailyScheduleSchema,
  wednesday: DailyScheduleSchema,
  thursday: DailyScheduleSchema,
  friday: DailyScheduleSchema,
  saturday: DailyScheduleSchema,
}).strict();


// Define the Schedules schema
export const SchedulesSchema = z.object({
  left: SideScheduleSchema,
  right: SideScheduleSchema,
}).strict();

export type DailySchedule = z.infer<typeof DailyScheduleSchema>;
export type SideSchedule = z.infer<typeof SideScheduleSchema>;
export type Schedules = z.infer<typeof SchedulesSchema>;
export type Alarm = z.infer<typeof AlarmSchema>;
export type AlarmJob = z.infer<typeof AlarmJobSchema>;
export type AlarmSchedule = z.infer<typeof AlarmScheduleSchema>;
export type Time = z.infer<typeof TimeSchema>;

// eslint-disable-next-line @typescript-eslint/no-type-alias
export type DayOfWeek = keyof SideSchedule;
// eslint-disable-next-line @typescript-eslint/no-type-alias
// export type Side = keyof Schedules;
export type Side = z.infer<typeof SideSchema>;
