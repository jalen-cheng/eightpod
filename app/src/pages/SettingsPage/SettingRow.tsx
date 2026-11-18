import { PropsWithChildren, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InfoTip from '@components/InfoTip.tsx';

// Every dropdown on the page is this wide, so their right edges and arrows line up
export const CONTROL_WIDTH_PX = 148;

type SettingRowProps = PropsWithChildren<{
  label: ReactNode;
  // A sentence of explanation, shown from an "i" beside the label instead of taking a line
  info?: string;
}>;

// One setting on one line: its name on the left, its control on the right. The name wraps if it
// must; the control never drops under it.
export default function SettingRow({ label, info, children }: SettingRowProps) {
  return (
    <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 40 } }>
      <Typography sx={ { fontSize: 14, fontWeight: 500, minWidth: 0 } }>
        { label }{ info && <>{ ' ' }<InfoTip text={ info }/></> }
      </Typography>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 } }>{ children }</Box>
    </Box>
  );
}
