import { Chip } from '@mui/material';
import { useServerInfo } from '@api/serverInfo.ts';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UpdateIcon from '@mui/icons-material/Update';

// One small chip saying whether EightPod is up to date, for use in a line of chips
export default function VersionStatus() {
  const { data: serverInfo, isLoading, isError } = useServerInfo();
  if (isError || isLoading) return null;

  return serverInfo?.updateAvailable
    ? <Chip icon={ <UpdateIcon/> } label="Update available" color="info" size="small"/>
    : <Chip icon={ <CheckCircleIcon/> } label="Up to date" color="success" size="small"/>;
}
