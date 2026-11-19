import { Box, Switch } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import SettingToggle from './SettingToggle.tsx';
import { useUpdateServices } from './useUpdateServices.ts';

const BIOMETRICS_INFO = 'The older sleep analysis: heart rate, breathing and sleep stages worked out by a separate service '
  + 'and shown under Data > Biometrics. It cannot read a Pod 5\'s sensors; on a Pod 5 the bed\'s own record is Data > Sleep.';
const INSTALL_COMMAND = 'sh /home/dac/free-sleep/scripts/enable_biometrics.sh';

// The switch for the biometrics service. Until the service is installed on the Pod the switch
// is off limits and the command that installs it is shown; once it is, the command goes away.
export default function BiometricsSetting() {
  const { services, updateServices } = useUpdateServices();
  const isUpdating = useAppStore(state => state.isUpdating);
  if (!services) return null;
  const isInstalled = services.biometrics.jobs.installation.status === 'healthy';

  return (
    <SettingToggle
      label="Biometrics"
      info={ BIOMETRICS_INFO }
      control={
        <Switch
          disabled={ isUpdating || !isInstalled }
          checked={ services.biometrics.enabled }
          onChange={ (event) => updateServices({ biometrics: { enabled: event.target.checked } }) }
        />
      }
    >
      { !isInstalled && (
        <>
          Not installed. Run this on the Pod:
          <Box
            component="code"
            sx={ {
              display: 'block', p: 1.25, mt: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1,
              fontSize: 11, overflowWrap: 'anywhere', userSelect: 'all',
            } }
          >
            { INSTALL_COMMAND }
          </Box>
        </>
      ) }
    </SettingToggle>
  );
}
