// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a2bf272c-d78d-568c-b1c9-ecda4b6ceb4a")}catch(e){}}();
import { z } from 'zod';
const timeRegexFormat = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const SideSchema = z.enum(['right', 'left']);
// Reusable Zod type for time
export const TimeSchema = z.string().regex(timeRegexFormat, 'Invalid time format, must be HH:mm');
export const TemperatureSchema = z.number().int().min(55).max(110);
// The longest alarm that can be asked for. The firmware runs at most MAX_FIRMWARE_ALARM_SECONDS
// at a time, so a longer alarm is sent as several stretches (see alarmSession).
export const MAX_ALARM_SECONDS = 1800;
export const MAX_FIRMWARE_ALARM_SECONDS = 180;
export const AlarmSchema = z.object({
    vibrationIntensity: z.number().int().min(1).max(100),
    vibrationPattern: z.enum(['double', 'rise']),
    duration: z.number().int().positive().min(0).max(MAX_ALARM_SECONDS),
}).strict();
export const AlarmJobSchema = AlarmSchema.extend({
    side: SideSchema,
    force: z.boolean().optional(),
    // Switch the side off when this alarm is dismissed (not when it is snoozed or runs out)
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
    temperatures: z.record(TimeSchema, TemperatureSchema),
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
//# sourceMappingURL=schedulesSchema.js.map
//# debugId=a2bf272c-d78d-568c-b1c9-ecda4b6ceb4a
