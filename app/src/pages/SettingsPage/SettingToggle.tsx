import { PropsWithChildren, ReactElement } from 'react';
import { Box, FormControlLabel } from '@mui/material';
import SettingLabel from './SettingLabel.tsx';

type SettingToggleProps = PropsWithChildren<{
  label: string;
  control: ReactElement;
  // A sentence of explanation, shown from an "i" beside the label instead of taking a line
  info?: string;
}>;

// A labelled switch. Children are for content that has to stay visible, such as a command to copy.
export default function SettingToggle({ label, control, info, children }: SettingToggleProps) {
  return (
    <Box sx={ { minWidth: 0 } }>
      <FormControlLabel
        label={ <SettingLabel label={ label } info={ info }/> }
        // A name that wraps is split evenly, not left with one word on its own line
        slotProps={ { typography: { sx: { textWrap: 'balance' } } } }
        labelPlacement="start"
        control={ control }
        sx={ {
          m: 0, width: '100%', justifyContent: 'space-between', gap: 2,
          minHeight: 32,
          '& .MuiFormControlLabel-label': { fontSize: 14, fontWeight: 500, color: 'text.primary' },
        } }
      />
      { children && <Box sx={ { mt: 0.5, color: 'text.secondary', fontSize: 12, lineHeight: 1.65 } }>{ children }</Box> }
    </Box>
  );
}
