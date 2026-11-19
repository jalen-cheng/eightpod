import { create } from 'zustand';

// Which folding sections are open, by title, remembered on this device so the page comes back
// the way it was left
const STORAGE_KEY = 'open_sections';

// Browser storage can be unavailable (a private window); the page then starts folded each time
const readSaved = (): string[] => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((title): title is string => typeof title === 'string') : [];
  } catch {
    return [];
  }
};

const save = (openTitles: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openTitles));
  } catch {
    // Not remembered this time
  }
};

type OpenSections = {
  openTitles: string[];
  toggle: (title: string) => void;
};

export const useOpenSections = create<OpenSections>((set, get) => ({
  openTitles: readSaved(),
  toggle: (title: string) => {
    const { openTitles } = get();
    const next = openTitles.includes(title) ? openTitles.filter(openTitle => openTitle !== title) : [...openTitles, title];
    set({ openTitles: next });
    save(next);
  },
}));
