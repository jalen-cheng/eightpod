import { PropsWithChildren, ReactNode } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema';
import { useServerInfo } from '@api/serverInfo.ts';
import { Settings } from '@api/settingsSchema.ts';
import WifiStrength from '@components/WifiStrength.tsx';
import DailyReboot from './DailyReboot.tsx';
import RebootButton from './RebootButton.tsx';
import UpdateButton from './UpdateButton.tsx';

type InfoRowProps = PropsWithChildren<{ title: string; detail?: ReactNode }>;

// One line of the section: what it is and a word about it on the left, its control on the right
const InfoRow = ({ title, detail, children }: InfoRowProps) => (
  <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 36 } }>
    <Box sx={ { minWidth: 0 } }>
      <Typography variant="body2" sx={ { fontWeight: 500 } }>{ title }</Typography>
      { detail && <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block' } }>{ detail }</Typography> }
    </Box>
    <Box sx={ { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.75 } }>{ children }</Box>
  </Box>
);

type DeviceInfoProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

// The Pod itself, top to bottom: what it is, whether its software is current, and restarting it
// eslint-disable-next-line react/no-multi-comp
export default function DeviceInfo({ settings, updateSettings }: DeviceInfoProps) {
  const { data: deviceStatus, isLoading } = useDeviceStatus();
  const { data: latest } = useServerInfo();
  if (isLoading || !deviceStatus) return null;

  const { coverVersion, hubVersion, sevenSleep } = deviceStatus;
  // A cover and hub of the same model are named once
  const models = [coverVersion, hubVersion].filter(version => version !== Version.NotFound);
  const podName = models.length === 0 ? 'Pod'
    : models[0] === models[1] || models.length === 1 ? models[0]
      : `${coverVersion} cover, ${hubVersion} hub`;
  const branchNote = sevenSleep.branch && sevenSleep.branch !== 'main' ? ` (${sevenSleep.branch})` : '';

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
      <InfoRow title={ podName } detail="Connected to your Wi-Fi">
        <WifiStrength/>
      </InfoRow>
      <InfoRow
        title={ `SevenSleep ${sevenSleep.version}${branchNote}` }
        detail={ latest?.updateAvailable ? `Version ${latest.version} is available` : latest ? 'Up to date' : undefined }
      >
        { latest?.updateAvailable && <UpdateButton/> }
      </InfoRow>
      <Divider/>
      <DailyReboot settings={ settings } updateSettings={ updateSettings }/>
      <InfoRow title="Reboot now" detail="Takes about three minutes. The bed turns off until it is back.">
        <RebootButton/>
      </InfoRow>
    </Box>
  );
}
