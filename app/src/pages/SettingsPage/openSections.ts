import { create } from 'zustand';

// Which folding sections the person has opened or closed, by title, remembered on this device
// so the page comes back the way it was left. A section not in here is as it starts out.
const STORAGE_KEY = 'open_sections';

type Choices = Record<string, boolean>;

// Browser storage can be unavailable (a private window); the page then starts afresh each time.
// An earlier version saved a list of the open titles, which is read as those having been opened.
const readSaved = (): Choices => {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (Array.isArray(saved)) {
      return Object.fromEntries(saved.filter((title): title is string => typeof title === 'string').map(title => [title, true]));
    }
    if (saved === null || typeof saved !== 'object') return {};
    return Object.fromEntries(
      Object.entries(saved).filter((choice): choice is [string, boolean] => typeof choice[1] === 'boolean'),
    );
  } catch {
    return {};
  }
};

const save = (choices: Choices) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Not remembered this time
  }
};

type OpenSections = {
  choices: Choices;
  // Opens a closed section or closes an open one. `startsOpen` is how it is before any choice.
  toggle: (title: string, startsOpen: boolean) => void;
};

export const useOpenSections = create<OpenSections>((set, get) => ({
  choices: readSaved(),
  toggle: (title: string, startsOpen: boolean) => {
    const { choices } = get();
    const next = { ...choices, [title]: !(choices[title] ?? startsOpen) };
    set({ choices: next });
    save(next);
  },
}));
