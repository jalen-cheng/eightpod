import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Chip, ChipProps } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

const WEAK_WIFI_PERCENT = 40;
const FAIR_WIFI_PERCENT = 70;

// A small chip with the Pod's Wi-Fi signal, coloured by how good it is. Nothing while unknown.
export default function WifiStrength() {
  const { data: deviceStatus } = useDeviceStatus();
  if (!deviceStatus || deviceStatus.wifiStrength === 0) return null;
  let color: ChipProps['color'] = 'success';
  let icon = <CheckCircleIcon />;
  let quality = 'good';
  if (deviceStatus.wifiStrength < WEAK_WIFI_PERCENT) {
    color = 'error';
    icon = <ErrorIcon />;
    quality = 'weak';
  } else if (deviceStatus.wifiStrength < FAIR_WIFI_PERCENT) {
    color = 'warning';
    icon = <WarningIcon />;
    quality = 'fair';
  }
  return (
    <Chip
      icon={ icon }
      color={ color }
      label={ `Wi-Fi ${deviceStatus.wifiStrength}%` }
      // The colour alone does not reach a screen reader
      aria-label={ `Wi-Fi signal ${deviceStatus.wifiStrength} percent, ${quality}` }
      size='small'
    />
  );
}
