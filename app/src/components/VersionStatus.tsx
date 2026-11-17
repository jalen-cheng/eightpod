import { Alert, AlertTitle, Chip, Typography } from '@mui/material';
import { useServerInfo } from '@api/serverInfo.ts';
import currentServerInfo from '../../../server/src/serverInfo.json';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UpdateIcon from '@mui/icons-material/Update';
import UpdateFreeSleepButton from '../pages/SettingsPage/DeviceSettingsSection/UpdateFreeSleepButton.tsx';

type VersionStatusProps = {
  // "chip": one small chip saying whether Free Sleep is up to date, for use in a line of chips.
  // "alert": the update notice with its button, shown only when an update is available.
  variant: 'chip' | 'alert';
};

export default function VersionStatus({ variant }: VersionStatusProps) {
  const { data: serverInfo, isLoading, isError } = useServerInfo();
  if (isError || isLoading) return null;
  const updateAvailable = Boolean(serverInfo?.updateAvailable);

  if (variant === 'chip') {
    return updateAvailable
      ? <Chip icon={ <UpdateIcon/> } label="Update available" color="info" size="small"/>
      : <Chip icon={ <CheckCircleIcon/> } label="Up to date" color="success" size="small"/>;
  }
  if (!updateAvailable) return null;

  return (
    <Alert severity="info">
      <AlertTitle>
        Free-sleep update available!
      </AlertTitle>
      <Typography variant="body2">
        Latest version: { serverInfo?.version }
      </Typography>
      <Typography variant="body2" sx={ { mb: 1 } }>
        Current version: { currentServerInfo.version }
      </Typography>
      <UpdateFreeSleepButton/>
    </Alert>
  );
}
