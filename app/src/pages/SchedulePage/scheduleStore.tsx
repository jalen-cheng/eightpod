import _ from 'lodash';
import { create } from 'zustand';
import { DailySchedule, DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { DaysSelected } from './SchedulePage.types.ts';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days';
import { isPowerScheduleDurationValid } from './scheduleValidation';
import { getOtherSide } from '@lib/sides.ts';
import { findDaysWithSameSchedule } from './scheduleDays.ts';

type Validations = {
  alarmTimeIsValid: boolean;
};

export const DEFAULT_DAYS_SELECTED: DaysSelected = {
  sunday: false,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
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

  // The days a save writes to: the selected day plus every day marked here. Days that already
  // share the selected day's schedule start out marked, so editing "Monday" edits the weekdays
  // when they are all the same.
  selectedDays: Record<DayOfWeek, boolean>;
  getSaveDays: () => DayOfWeek[];
  // A tap on a day chip. With nothing unsaved it opens that day; with unsaved changes it adds
  // the day to (or removes it from) the days the changes are saved to.
  tapDay: (day: DayOfWeek) => void;

  changesPresent: boolean;
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

  reloadScheduleData: () => {
    const { side } = useAppStore.getState();
    const { originalSchedules, selectedDay } = get();
    if (!originalSchedules) return;
    const selectedSchedule = _.cloneDeep(originalSchedules[side][selectedDay]);
    const selectedDays = { ...DEFAULT_DAYS_SELECTED };
    findDaysWithSameSchedule(originalSchedules[side], selectedDay).forEach((day) => { selectedDays[day] = true; });

    set({
      selectedDays,
      validations: { ...DEFAULT_VALIDATIONS },
      selectedSchedule,
      changesPresent: false,
    });
    // With linked sides, a difference between the two sides is itself something to save
    get().checkForChanges();
  },

  selectDay: (newSelectedDayIndex) => {
    const { originalSchedules, reloadScheduleData } = get();
    if (!originalSchedules) return;
    const selectedDay = LOWERCASE_DAYS[newSelectedDayIndex];
    set({ selectedDay, selectedDayIndex: newSelectedDayIndex });
    reloadScheduleData();
  },

  selectedDays: { ...DEFAULT_DAYS_SELECTED },
  getSaveDays: () => {
    const { selectedDay, selectedDays } = get();
    return LOWERCASE_DAYS.filter(day => day === selectedDay || selectedDays[day]);
  },
  tapDay: (day) => {
    const { selectedDay, selectedDays, changesPresent, selectDay, checkForChanges } = get();
    if (day === selectedDay) return;
    if (!changesPresent) {
      selectDay(LOWERCASE_DAYS.indexOf(day));
      return;
    }
    set({ selectedDays: { ...selectedDays, [day]: !selectedDays[day] } });
    checkForChanges();
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

  changesPresent: false,
  // There is something to save when any day the save would write to (on this side, or on the
  // other side too when the sides are linked) does not already hold the schedule on screen.
  checkForChanges: () => {
    const { selectedSchedule, originalSchedules, getSaveDays } = get();
    if (!originalSchedules) return;
    const { side, linkSides } = useAppStore.getState();
    const sides = linkSides ? [side, getOtherSide(side)] : [side];
    const changesPresent = sides.some(saveSide => (
      getSaveDays().some(day => !_.isEqual(originalSchedules[saveSide][day], selectedSchedule))
    ));
    set({ changesPresent });
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
  setOriginalSchedules: (originalSchedules) => {
    const { side } = useAppStore.getState();
    const { selectedDay } = get();
    if (originalSchedules[side] === undefined) return;
    const selectedSchedule = _.cloneDeep(originalSchedules[side][selectedDay]);

    set({ originalSchedules, selectedSchedule });
  },
}));
