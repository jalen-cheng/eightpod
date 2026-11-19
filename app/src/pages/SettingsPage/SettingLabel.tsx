import { ReactNode } from 'react';
import { Box } from '@mui/material';
import InfoTip from '@components/InfoTip.tsx';

type SettingLabelProps = {
  label: ReactNode;
  // A sentence of explanation, shown from an "i" after the name
  info?: string;
};

// A setting's name with its "i". The name's last word and the "i" are kept together, so on a
// narrow screen the "i" never ends up on a line of its own.
export default function SettingLabel({ label, info }: SettingLabelProps) {
  if (!info) return <>{ label }</>;
  if (typeof label !== 'string') return <>{ label }{ ' ' }<InfoTip text={ info }/></>;
  const lastSpace = label.lastIndexOf(' ');
  return (
    <>
      { label.slice(0, lastSpace + 1) }
      <Box component="span" sx={ { whiteSpace: 'nowrap' } }>{ label.slice(lastSpace + 1) }{ ' ' }<InfoTip text={ info }/></Box>
    </>
  );
}
