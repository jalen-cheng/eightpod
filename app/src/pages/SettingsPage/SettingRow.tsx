import { PropsWithChildren, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

type SettingRowProps = PropsWithChildren<{
  label: ReactNode;
  // A few words under the label
  detail?: ReactNode;
}>;

// One setting: its name (and a word about it) on the left, its control on the right. On a phone a
// wide control drops under the name.
export default function SettingRow({ label, detail, children }: SettingRowProps) {
  return (
    <Box
      sx={ {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        columnGap: 2, rowGap: 1, minHeight: 36,
      } }
    >
      <Box sx={ { minWidth: 0 } }>
        <Typography variant="body2" sx={ { fontWeight: 500 } }>{ label }</Typography>
        { detail && <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block' } }>{ detail }</Typography> }
      </Box>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, maxWidth: '100%' } }>{ children }</Box>
    </Box>
  );
}
