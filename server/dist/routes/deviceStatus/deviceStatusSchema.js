// WARNING! - Any changes here MUST be the same between app/src/api & server/src/db/

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b3a34cde-fbe7-52fc-a23f-85a08c52775b")}catch(e){}}();
import { z } from 'zod';
import { MAX_TEMPERATURE_F, MIN_TEMPERATURE_F } from '../../db/temperatureCurve.js';
// The range the Pod can be set to, from the measured curve: 50°F to 108°F
export const MIN_TARGET_TEMPERATURE_F = MIN_TEMPERATURE_F;
export const MAX_TARGET_TEMPERATURE_F = MAX_TEMPERATURE_F;
// Requests up to the old maximum are still accepted and treated as the hottest setting
const MAX_ACCEPTED_TEMPERATURE_F = 110;
const SideStatusSchema = z.object({
    currentTemperatureLevel: z.number(),
    currentTemperatureF: z.number(),
    // The water temperature the bed measures on this side, where the firmware reports it (Pod 5)
    measuredTemperatureF: z.number().optional(),
    targetTemperatureF: z.number()
        .min(MIN_TARGET_TEMPERATURE_F, { message: `Temperature must be at least ${MIN_TARGET_TEMPERATURE_F}°F` })
        .max(MAX_ACCEPTED_TEMPERATURE_F, { message: `Temperature cannot exceed ${MAX_ACCEPTED_TEMPERATURE_F}°F` }),
    secondsRemaining: z.number(),
    isOn: z.boolean(),
    isAlarmVibrating: z.boolean(),
    taps: z.object({
        doubleTap: z.number(),
        tripleTap: z.number(),
        quadTap: z.number(),
    }).optional(),
}).strict();
export const DeviceStatusSchema = z.object({
    left: SideStatusSchema,
    right: SideStatusSchema,
    waterLevel: z.string(),
    isPriming: z.boolean(),
    settings: z.object({
        v: z.number(),
        gainLeft: z.number(),
        gainRight: z.number(),
        ledBrightness: z.number(),
    }),
    coverVersion: z.string(),
    hubVersion: z.string(),
    freeSleep: z.object({
        version: z.string(),
        branch: z.string(),
    }),
    wifiStrength: z.number(),
}).strict();
export var Version;
(function (Version) {
    Version["NotFound"] = "Version not found";
    Version["Pod3"] = "Pod 3";
    Version["Pod4"] = "Pod 4";
    Version["Pod5"] = "Pod 5";
})(Version || (Version = {}));
//# sourceMappingURL=deviceStatusSchema.js.map
//# debugId=b3a34cde-fbe7-52fc-a23f-85a08c52775b
