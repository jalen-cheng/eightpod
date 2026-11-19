import { Box, Switch } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import SettingToggle from './SettingToggle.tsx';
import { useUpdateServices } from './useUpdateServices.ts';

// The older sleep analysis (heart rate, breathing and sleep stages worked out by the Python
// service). It has to be installed on the Pod before it can be switched on.
export default function BiometricsSetting() {
  const { services, updateServices } = useUpdateServices();
  const isUpdating = useAppStore(state => state.isUpdating);
  if (!services) return null;

  return (
    <SettingToggle
      control={
        <Switch
          disabled={ isUpdating || services.biometrics.jobs.installation.status !== 'healthy' }
          checked={ services.biometrics.enabled }
          onChange={ (event) => updateServices({ biometrics: { enabled: event.target.checked } }) }
        />
      }
      label="Biometrics"
    >
      Calculate biometrics for the pod. Does not work on the Pod 5 this version was tested on.
      Requires you to run this command on your pod. Once installation completes successfully, you can toggle this on/off.
      <Box
        component="code"
        sx={ { display: 'block', p: 1.5, mt: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, fontSize: 11 } }
      >
        sh /home/dac/free-sleep/scripts/enable_biometrics.sh
      </Box>
    </SettingToggle>
  );
}
