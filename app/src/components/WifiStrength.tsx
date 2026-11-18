import { useDeviceStatus } from '@api/deviceStatus.ts';
import StatusTag, { StatusTone } from './StatusTag.tsx';

const WEAK_WIFI_PERCENT = 40;
const FAIR_WIFI_PERCENT = 70;

// The Pod's Wi-Fi signal, coloured by how good it is. Nothing while unknown.
export default function WifiStrength() {
  const { data: deviceStatus } = useDeviceStatus();
  if (!deviceStatus || deviceStatus.wifiStrength === 0) return null;
  const strength = deviceStatus.wifiStrength;
  const [tone, quality]: [StatusTone, string] = strength < WEAK_WIFI_PERCENT ? ['bad', 'weak']
    : strength < FAIR_WIFI_PERCENT ? ['warning', 'fair'] : ['good', 'good'];
  // The colour alone does not reach a screen reader
  return <StatusTag tone={ tone } label={ `Wi-Fi ${strength}%` } ariaLabel={ `Wi-Fi signal ${strength} percent, ${quality}` }/>;
}
