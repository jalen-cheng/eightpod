import { PaletteMode, alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

const FONT_FAMILY = '"Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
// One size for the text inside every field, select and button, so controls on a line match
const CONTROL_FONT_SIZE = 14;

// Neutral greys, like the chat apps this follows: dark grey surfaces, near-white text, and
// near-white as the accent (a filled button is white with dark text). Colour is kept for meaning:
// blue and coral for cooling and warming (see lib/temperatureConversions.ts), green, amber and
// red for state.
const DARK_COLORS = {
  background: '#141414', surface: '#1b1b1b', raised: '#262626', line: '#2b2b2b', track: '#3f3f3f',
  text: '#ececec', mutedText: '#9b9b9b', accent: '#ececec', onAccent: '#141414',
  success: '#6fcf9f', info: '#8ab4f8', warning: '#e0b877', error: '#ef8a8a',
};
const LIGHT_COLORS: typeof DARK_COLORS = {
  background: '#f7f7f7', surface: '#ffffff', raised: '#efefef', line: '#e3e3e3', track: '#cfcfcf',
  text: '#1a1a1a', mutedText: '#6b6b6b', accent: '#1a1a1a', onAccent: '#ffffff',
  success: '#23805b', info: '#3a6fc4', warning: '#946c1c', error: '#c9505a',
};

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_FAMILY,
  fontSize: 14,
  h1: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.035em' },
  h2: { fontSize: '1.875rem', fontWeight: 600, letterSpacing: '-0.03em' },
  h3: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.025em' },
  h4: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' },
  h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' },
  h6: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' },
  body1: { fontSize: '0.875rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.55 },
  button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none' },
  caption: { fontSize: '0.75rem', lineHeight: 1.5 },
  overline: { fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.12em', lineHeight: 2 },
};

const getChipStyles = (theme: Theme, paletteKey: 'success' | 'info' | 'warning' | 'secondary') => ({
  backgroundColor: alpha(theme.palette[paletteKey].main, 0.12),
  color: theme.palette[paletteKey].main,
  border: 0,
});

// Shared styles give controls and surfaces a consistent appearance across every screen.
const buildComponents = (colors: typeof DARK_COLORS): ThemeOptions['components'] => ({
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      body: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', fontFeatureSettings: '"tnum"' },
      '#root': { minHeight: '100dvh' },
      '::selection': { background: alpha(theme.palette.primary.main, 0.3) },
      ':focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 },
      '*': { scrollbarWidth: 'thin', scrollbarColor: `${theme.palette.divider} transparent` },
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': { animation: 'none !important', transition: 'none !important' },
      },
    }),
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: { borderRadius: 12, padding: '10px 18px', minHeight: 44, transition: 'background-color 150ms ease, border-color 150ms ease' },
      sizeSmall: { minHeight: 36, padding: '6px 12px', borderRadius: 10 },
      outlined: ({ theme }) => ({
        borderColor: theme.palette.divider,
        backgroundColor: colors.raised,
        color: theme.palette.text.primary,
        '&:hover': { borderColor: colors.track, backgroundColor: colors.line },
      }),
      contained: ({ theme }) => ({
        '&.MuiButton-colorPrimary': {
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#ffffff' : '#333333' },
        },
      }),
    },
  },
  MuiIconButton: { styleOverrides: { root: { borderRadius: 10, minWidth: 44, minHeight: 44 } } },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({ backgroundImage: 'none', border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }),
    },
  },
  MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
  MuiDialogTitle: { styleOverrides: { root: { fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' } } },
  MuiCardContent: { styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } } },
  // A small square switch: a dark slot that turns to the accent, with a square knob
  MuiSwitch: {
    styleOverrides: {
      root: { width: 34, height: 20, padding: 0, overflow: 'visible', flexShrink: 0 },
      switchBase: ({ theme }) => ({
        padding: 3,
        color: theme.palette.text.secondary,
        '&:hover': { backgroundColor: 'transparent' },
        '&.Mui-checked': {
          transform: 'translateX(14px)', color: theme.palette.primary.contrastText,
          '&:hover': { backgroundColor: 'transparent' },
          '& + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main, opacity: 1 },
        },
        '&.Mui-disabled': { color: theme.palette.text.secondary, '& + .MuiSwitch-track': { opacity: 0.4 } },
        '&.Mui-disabled .MuiSwitch-thumb': { opacity: 0.6 },
      }),
      thumb: { width: 14, height: 14, borderRadius: 3, backgroundColor: 'currentColor', boxShadow: 'none' },
      track: { borderRadius: 5, backgroundColor: colors.track, opacity: 1, transition: 'background-color 200ms ease' },
    },
  },
  MuiSlider: {
    styleOverrides: {
      root: { height: 6 },
      rail: { backgroundColor: colors.track, opacity: 1 },
      track: { border: 0 },
      thumb: {
        width: 22, height: 22, backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
        '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)' },
        '&::before': { display: 'none' },
      },
    },
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: { padding: 4, gap: 4, border: 0, borderRadius: 14, backgroundColor: colors.surface },
      grouped: { border: '0 !important', borderRadius: '10px !important', margin: '0 !important' },
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        textTransform: 'none', color: theme.palette.text.secondary, padding: '8px 16px', minHeight: 40, lineHeight: 1.5,
        fontSize: CONTROL_FONT_SIZE, border: 0, borderRadius: 14, backgroundColor: colors.surface,
        '&.Mui-selected': {
          backgroundColor: colors.line, color: theme.palette.text.primary,
          '&:hover': { backgroundColor: colors.track },
        },
      }),
    },
  },
  MuiTab: { styleOverrides: { root: { textTransform: 'none', fontSize: 13, minHeight: 44 } } },
  MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2 } } },
  MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
  // Fields are filled blocks without an outline; the outline appears on hover and focus
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 10, fontSize: CONTROL_FONT_SIZE, backgroundColor: colors.raised,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent', transition: 'border-color 150ms ease' },
        '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: colors.track },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main, borderWidth: 1 },
        '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.error.main },
        '&.Mui-disabled': { opacity: 0.55 },
        '& .MuiInputBase-inputSizeSmall': { paddingTop: 9, paddingBottom: 9 },
      }),
    },
  },
  MuiSelect: { styleOverrides: { icon: ({ theme }) => ({ color: theme.palette.text.secondary, fontSize: 20 }) } },
  MuiMenuItem: { styleOverrides: { root: { fontSize: CONTROL_FONT_SIZE, minHeight: 40 } } },
  MuiInput: {
    styleOverrides: {
      root: { fontSize: CONTROL_FONT_SIZE },
      underline: ({ theme }) => ({ '&:before': { borderBottomColor: theme.palette.divider } }),
    },
  },
  MuiFormHelperText: { styleOverrides: { root: { fontSize: 12 } } },
  MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
  MuiAccordion: {
    defaultProps: { disableGutters: true, elevation: 0 },
    styleOverrides: {
      root: { borderRadius: '16px !important', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } },
    },
  },
  MuiAccordionSummary: { styleOverrides: { root: { minHeight: 56, padding: '0 20px' } } },
  MuiAccordionDetails: { styleOverrides: { root: { padding: '8px 20px 20px' } } },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 14, fontSize: 14, alignItems: 'center' },
      standard: ({ theme }) => ({
        '&.MuiAlert-colorWarning': { backgroundColor: alpha(theme.palette.warning.main, 0.08), color: theme.palette.text.primary },
        '&.MuiAlert-colorInfo': { backgroundColor: alpha(theme.palette.info.main, 0.08), color: theme.palette.text.primary },
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { height: 26, borderRadius: 13, fontSize: 12, fontWeight: 500 },
      colorDefault: ({ theme }) => ({ backgroundColor: colors.raised, color: theme.palette.text.secondary }),
      colorSuccess: ({ theme }) => getChipStyles(theme, 'success'),
      colorInfo: ({ theme }) => getChipStyles(theme, 'info'),
      colorWarning: ({ theme }) => getChipStyles(theme, 'warning'),
      colorSecondary: ({ theme }) => getChipStyles(theme, 'secondary'),
    },
  },
  MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12, borderRadius: 8 } } },
});

export const buildTheme = (mode: PaletteMode = 'dark') => {
  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  return createTheme({
    typography,
    palette: {
      mode,
      primary: { main: colors.accent, contrastText: colors.onAccent },
      secondary: { main: colors.mutedText },
      success: { main: colors.success },
      info: { main: colors.info },
      warning: { main: colors.warning },
      error: { main: colors.error },
      divider: colors.line,
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.text, secondary: colors.mutedText },
      action: { hover: alpha(colors.text, 0.04), selected: alpha(colors.text, 0.08) },
    },
    shape: { borderRadius: 12 },
    components: buildComponents(colors),
  });
};

export const theme = buildTheme('dark');
