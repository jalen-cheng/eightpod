import { ButtonBase } from '@mui/material';
import { Link } from 'react-router-dom';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { useServerInfo } from '@api/serverInfo.ts';
import { useServerStatus } from '@api/serverStatus.ts';
import { ServerStatus } from '@api/serverStatusSchema.ts';
import StatusTag, { StatusTone } from './StatusTag.tsx';

export const STATUS_ROUTE = '/status';
// From this width the link has a free corner at the bottom right of the window. Narrower, that
// corner is over the page's own controls, so the link sits beside a page's heading instead.
export const FLOATING_STATUS_QUERY = '@media (min-width: 1280px)';
// The check reads the Pod's database, so it is not asked for often
const SERVICE_CHECK_MS = 90_000;
// Sleep analysis and its jobs are untested here and off by default, so they do not count
const IGNORED_SERVICES = /^(biometrics|analyzeSleep)/;

// The Pod's health in a word, from whether it answers and whether any of its services has failed
const readHealth = (
  isReachable: boolean, isUnreachable: boolean, hasCheckFailed: boolean, services?: ServerStatus,
): { tone: StatusTone; word: string } => {
  if (isUnreachable) return { tone: 'bad', word: 'Offline' };
  if (!isReachable) return { tone: 'neutral', word: 'Connecting' };
  if (hasCheckFailed) return { tone: 'warning', word: 'Needs attention' };
  const failed = Object.entries(services ?? {}).filter(([name, info]) => !IGNORED_SERVICES.test(name) && info.status === 'failed');
  return failed.length > 0 ? { tone: 'warning', word: 'Needs attention' } : { tone: 'good', word: 'Healthy' };
};

// "Status: Healthy", and the way to the Status page: press it to see the Pod and every service.
// A healthy Pod with a newer version waiting says so instead, as updating is done on that page.
export default function StatusLink() {
  const { data: deviceStatus, isError } = useDeviceStatus();
  const { data: services, isError: hasCheckFailed } = useServerStatus(SERVICE_CHECK_MS);
  const { data: serverInfo, isError: hasVersionCheckFailed } = useServerInfo();
  const health = readHealth(Boolean(deviceStatus) && !isError, isError, hasCheckFailed, services);
  const isUpdateWaiting = health.tone === 'good' && Boolean(serverInfo?.updateAvailable) && !hasVersionCheckFailed;
  const tone: StatusTone = isUpdateWaiting ? 'info' : health.tone;
  const label = isUpdateWaiting ? 'Update available' : `Status: ${health.word}`;

  return (
    <ButtonBase
      component={ Link }
      to={ STATUS_ROUTE }
      aria-label={ `${label}. Open the status page` }
      sx={ {
        px: 1.25, py: 0.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.default',
        transition: 'border-color 150ms ease',
        '@media (hover: hover)': { '&:hover': { borderColor: 'text.secondary' } },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
      } }
    >
      <StatusTag tone={ tone } label={ label }/>
    </ButtonBase>
  );
}
