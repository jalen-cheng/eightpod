
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2c847358-ab5c-520b-a74f-b7b51e34c4ab")}catch(e){}}();
import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TimeSchema } from './schedulesSchema.js';
// 'level' shows temperatures on Eight Sleep's own -10 to +10 scale. Temperatures are stored in °F whatever is chosen.
export const TEMPERATURES = ['celsius', 'fahrenheit', 'level'];
const Temperatures = z.enum(TEMPERATURES);
const TemperatureTapConfig = z.object({
    type: z.literal('temperature'),
    change: z.enum(['increment', 'decrement']),
    amount: z.number().min(0).max(10),
});
const AlarmTapConfig = z.object({
    type: z.literal('alarm'),
    behavior: z.enum(['snooze', 'dismiss']),
    snoozeDuration: z.number().min(60).max(600),
    inactiveAlarmBehavior: z.enum(['power', 'none'])
});
export const TapConfig = z.discriminatedUnion('type', [
    TemperatureTapConfig,
    AlarmTapConfig,
]);
export const GestureSchema = z.enum(['doubleTap', 'tripleTap', 'quadTap']);
const SideSettingsSchema = z.object({
    name: z.string().min(1).max(20),
    awayMode: z.boolean(),
    scheduleOverrides: z.object({
        temperatureSchedules: z.object({
            disabled: z.boolean(),
            expiresAt: z.string(),
        }),
        alarm: z.object({
            disabled: z.boolean(),
            timeOverride: z.string(),
            expiresAt: z.string(),
        })
    }),
    taps: z.object({
        doubleTap: TapConfig,
        tripleTap: TapConfig,
        quadTap: TapConfig,
    })
}).strict();
export const SettingsSchema = z.object({
    id: z.string(),
    timeZone: z.enum(TIME_ZONES),
    left: SideSettingsSchema,
    right: SideSettingsSchema,
    primePodDaily: z.object({
        enabled: z.boolean(),
        time: TimeSchema,
    }),
    temperatureFormat: Temperatures,
    rebootDaily: z.boolean(),
    // When true, temperature and power changes made for one side (in the app or at the bed) apply to both
    linkSides: z.boolean(),
    // What happens when a side is switched on by hand (app, shortcut, or the buttons on the bed)
    manualOn: z.object({
        // How long it stays on before turning itself off
        hours: z.union([z.literal(3), z.literal(6), z.literal(12)]),
        // When true the schedule leaves that side alone until it turns off: no scheduled power,
        // temperature changes or warm-up. Alarms still go off.
        overridesSchedule: z.boolean(),
    }),
}).strict();
export const MANUAL_ON_HOUR_CHOICES = [3, 6, 12];
//# sourceMappingURL=settingsSchema.js.map
//# debugId=2c847358-ab5c-520b-a74f-b7b51e34c4ab
