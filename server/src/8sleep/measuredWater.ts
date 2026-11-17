// The water temperature the bed actually measures on each side, as last reported by the
// firmware. Separate from what the firmware is aiming for: a side set to its coldest level was
// measured 13°F warmer than its target after 20 minutes.
// Keep this file free of runtime imports so it can be read from anywhere without import cycles.
import type { Side } from '../db/schedulesSchema.js';

// The firmware reports hundredths of a degree Celsius
const REPORTED_UNITS_PER_DEGREE_C = 100;
// A reading older than this is not shown as current
const STALE_READING_MS = 60_000;

type WaterReading = { temperatureF: number; receivedAtMs: number };
const latestReadings: Partial<Record<Side, WaterReading>> = {};

export const reportedWaterToF = (reportedValue: number) => (reportedValue / REPORTED_UNITS_PER_DEGREE_C) * 9 / 5 + 32;

// Stores one side's reading as it arrives (in the firmware's units)
export function recordWaterReading(side: Side, reportedValue: number, nowMs: number = Date.now()) {
  latestReadings[side] = { temperatureF: reportedWaterToF(reportedValue), receivedAtMs: nowMs };
}

// A side's measured water temperature in °F to one decimal, or undefined when there is no
// recent reading (for example on a Pod whose firmware does not report it)
export function getMeasuredWaterF(side: Side, nowMs: number = Date.now()): number | undefined {
  const reading = latestReadings[side];
  if (!reading || nowMs - reading.receivedAtMs > STALE_READING_MS) return undefined;
  return Math.round(reading.temperatureF * 10) / 10;
}
