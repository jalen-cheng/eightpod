import _ from 'lodash';
import { create } from 'zustand';
import { DailySchedule, DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days';
import { isPowerScheduleDurationValid } from './scheduleValidation';
import { getOtherSide } from '@lib/sides.ts';
import { DayMode, detectDayMode, getDayGroup } from './scheduleDays.ts';

type Validations = {
  alarmTimeIsValid: boolean;
};

const DEFAULT_VALIDATIONS: Validations = {
  alarmTimeIsValid: true,
};

type ScheduleStore = {
  // The day whose schedule is loaded for editing
  selectedDay: DayOfWeek;
  selectedDayIndex: number;
  selectDay: (selectedDayIndex: number) => void;
  reloadScheduleData: () => void;

  // How the week is split into schedules. A save writes the schedule on screen to every day in
  // the selected day's group: all seven, the weekdays or the weekend, or just that day.
  dayMode: DayMode;
  setDayMode: (dayMode: DayMode) => void;
  getSaveDays: () => DayOfWeek[];

  // True when a save would change something on the Pod
  changesPresent: boolean;
  // True when the schedule on screen differs from the opened day's saved one, i.e. there are
  // edits that opening another day would throw away
  hasEdits: boolean;
  checkForChanges: () => void;

  validations: Validations;
  setValidations: (newValidations: DeepPartial<Validations>) => void;
  isValid: () => boolean;

  selectedSchedule: DailySchedule | undefined;
  updateSelectedSchedule: (dailySchedule: DeepPartial<DailySchedule>) => void;
  updateSelectedTemperatures: (temperatures: DailySchedule['temperatures']) => void;

  // The schedules as last loaded from the Pod
  originalSchedules: Schedules | undefined;
  setOriginalSchedules: (originalSchedules: Schedules) => void;
};

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  selectedDay: 'sunday',
  selectedDayIndex: 0,
  selectedSchedule: undefined,

  // Loads the selected day's saved schedule, dropping anything unsaved
  reloadScheduleData: () => {
    const { side } = useAppStore.getState();
    const { originalSchedules, selectedDay } = get();
    if (!originalSchedules) return;

    set({
      validations: { ...DEFAULT_VALIDATIONS },
      selectedSchedule: _.cloneDeep(originalSchedules[side][selectedDay]),
      changesPresent: false,
      hasEdits: false,
    });
    // A day in the group that differs (or the other side, when linked) is itself something to save
    get().checkForChanges();
  },

  selectDay: (newSelectedDayIndex) => {
    const { originalSchedules, reloadScheduleData } = get();
    if (!originalSchedules) return;
    const selectedDay = LOWERCASE_DAYS[newSelectedDayIndex];
    set({ selectedDay, selectedDayIndex: newSelectedDayIndex });
    reloadScheduleData();
  },

  dayMode: 'eachDay',
  setDayMode: (dayMode) => {
    set({ dayMode });
    get().checkForChanges();
  },
  getSaveDays: () => {
    const { selectedDay, dayMode } = get();
    return getDayGroup(selectedDay, dayMode);
  },

  validations: { ...DEFAULT_VALIDATIONS },
  setValidations: (newValidations) => {
    const { validations } = get();
    set({ validations: _.merge({}, validations, newValidations) });
  },
  isValid: () => {
    const { validations, selectedSchedule } = get();
    return _.every(validations)
      && !!selectedSchedule
      && isPowerScheduleDurationValid(selectedSchedule.power.on, selectedSchedule.power.off);
  },

  hasEdits: false,
  changesPresent: false,
  // There is something to save when any day the save would write to (on this side, or on the
  // other side too when the sides are linked) does not already hold the schedule on screen.
  checkForChanges: () => {
    const { selectedSchedule, selectedDay, originalSchedules, getSaveDays } = get();
    if (!originalSchedules) return;
    const { side, linkSides } = useAppStore.getState();
    const sides = linkSides ? [side, getOtherSide(side)] : [side];
    const changesPresent = sides.some(saveSide => (
      getSaveDays().some(day => !_.isEqual(originalSchedules[saveSide][day], selectedSchedule))
    ));
    set({ changesPresent, hasEdits: !_.isEqual(originalSchedules[side][selectedDay], selectedSchedule) });
  },

  updateSelectedSchedule: (newSelectedSchedule) => {
    const { selectedSchedule, checkForChanges } = get();
    const selectedScheduleCopy = _.cloneDeep(selectedSchedule);
    _.merge(selectedScheduleCopy, newSelectedSchedule);

    set({ selectedSchedule: selectedScheduleCopy });
    checkForChanges();
  },
  // The temperature changes are replaced as a whole: merging would keep times that were removed
  updateSelectedTemperatures: (temperatures) => {
    const { selectedSchedule, checkForChanges } = get();
    if (!selectedSchedule) return;
    set({ selectedSchedule: { ..._.cloneDeep(selectedSchedule), temperatures } });
    checkForChanges();
  },

  originalSchedules: undefined,
  // Takes schedules freshly loaded from the Pod. The first time, the week's split is worked out
  // from what is saved; after that the user's choice of split is kept.
  setOriginalSchedules: (originalSchedules) => {
    const { side } = useAppStore.getState();
    const { selectedDay, originalSchedules: previousSchedules } = get();
    if (originalSchedules[side] === undefined) return;
    const selectedSchedule = _.cloneDeep(originalSchedules[side][selectedDay]);

    set({ originalSchedules, selectedSchedule });
    if (!previousSchedules) set({ dayMode: detectDayMode(originalSchedules[side]) });
  },
}));
