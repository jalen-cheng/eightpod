import { PropsWithChildren, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import SettingLabel from './SettingLabel.tsx';

// Every dropdown on the page is this wide, so their right edges and arrows line up
export const CONTROL_WIDTH_PX = 148;

type SettingRowProps = PropsWithChildren<{
  label: ReactNode;
  // A sentence of explanation, shown from an "i" beside the label instead of taking a line
  info?: string;
}>;

// One setting on one line: its name on the left, its control on the right. The name wraps
// between words if it must. When there is not room for even its longest word beside the
// control (the narrowest phones), the control moves to a line of its own, still at the right.
export default function SettingRow({ label, info, children }: SettingRowProps) {
  return (
    <Box
      sx={ {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        columnGap: 2, rowGap: 0.75, minHeight: 40,
      } }
    >
      <Typography sx={ { fontSize: 14, fontWeight: 500, flex: '1 1 0', minWidth: 'min-content', overflowWrap: 'normal', textWrap: 'balance' } }>
        <SettingLabel label={ label } info={ info }/>
      </Typography>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 'auto' } }>{ children }</Box>
    </Box>
  );
}
