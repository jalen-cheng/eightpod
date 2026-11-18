import { Box } from '@mui/material';

export type StatusTone = 'good' | 'warning' | 'bad' | 'info' | 'neutral';

const TONE_COLORS: Record<StatusTone, string> = {
  good: 'success.main',
  warning: 'warning.main',
  bad: 'error.main',
  info: 'info.main',
  neutral: 'text.disabled',
};

type StatusTagProps = {
  tone: StatusTone;
  label: string;
  // What a screen reader says, when the colour carries meaning the words do not
  ariaLabel?: string;
};

// A state in a few words: a small coloured dot and plain text, with no box around it. Used
// wherever the app says how something is doing (Wi-Fi, a service, a side of the bed).
export default function StatusTag({ tone, label, ariaLabel }: StatusTagProps) {
  return (
    <Box
      component="span"
      aria-label={ ariaLabel }
      sx={ {
        display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0, whiteSpace: 'nowrap',
        fontSize: 12.5, fontWeight: 500, lineHeight: 1.6, color: 'text.secondary',
      } }
    >
      <Box component="span" aria-hidden sx={ { width: 7, height: 7, borderRadius: '50%', bgcolor: TONE_COLORS[tone] } }/>
      { label }
    </Box>
  );
}
