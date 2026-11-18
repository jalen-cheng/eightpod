import _ from 'lodash';
import { create } from 'zustand';
import { DailySchedule, DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days';
import { isChangeBeforeWake, isNightLengthValid } from './scheduleValidation';
import { getOtherSide } from '@lib/sides.ts';

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

  // True when saving the open day would change something on the Pod
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
    // The other side differing, when linked, is itself something to save
    get().checkForChanges();
  },

  selectDay: (newSelectedDayIndex) => {
    const { originalSchedules, reloadScheduleData } = get();
    if (!originalSchedules) return;
    const selectedDay = LOWERCASE_DAYS[newSelectedDayIndex];
    set({ selectedDay, selectedDayIndex: newSelectedDayIndex });
    reloadScheduleData();
  },

  validations: { ...DEFAULT_VALIDATIONS },
  setValidations: (newValidations) => {
    const { validations } = get();
    set({ validations: _.merge({}, validations, newValidations) });
  },
  isValid: () => {
    const { validations, selectedSchedule } = get();
    if (!_.every(validations) || !selectedSchedule) return false;
    const { power, alarm, temperatures } = selectedSchedule;
    return isNightLengthValid(power.on, alarm.time)
      && Object.keys(temperatures).every(time => isChangeBeforeWake(time, power.on, alarm.time));
  },

  hasEdits: false,
  changesPresent: false,
  // There is something to save when the open day (on this side, or on the other side too when
  // the sides are linked) does not already hold the schedule on screen.
  checkForChanges: () => {
    const { selectedSchedule, selectedDay, originalSchedules } = get();
    if (!originalSchedules) return;
    const { side, linkSides } = useAppStore.getState();
    const sides = linkSides ? [side, getOtherSide(side)] : [side];
    const changesPresent = sides.some(saveSide => !_.isEqual(originalSchedules[saveSide][selectedDay], selectedSchedule));
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
  // Takes schedules freshly loaded from the Pod
  setOriginalSchedules: (originalSchedules) => {
    const { side } = useAppStore.getState();
    const { selectedDay } = get();
    if (originalSchedules[side] === undefined) return;
    const selectedSchedule = _.cloneDeep(originalSchedules[side][selectedDay]);

    set({ originalSchedules, selectedSchedule });
  },
}));
