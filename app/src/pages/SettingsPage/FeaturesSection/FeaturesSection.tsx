import { SENTRY_DSN } from '../../../sentry.tsx';
import { Box, CircularProgress, Switch } from '@mui/material';
import Section from '../Section.tsx';
import SettingToggle from '../SettingToggle.tsx';
import { Services, useServices, postServices } from '@api/services.ts';
import { useAppStore } from '@state/appStore.tsx';
import { DeepPartial } from 'ts-essentials';

export default function FeaturesSection() {
  const { data: services, refetch, isLoading } = useServices();
  const setIsUpdating = useAppStore(state => state.setIsUpdating);
  const isUpdating = useAppStore(state => state.isUpdating);

  const updateServices = (services: DeepPartial<Services>) => {
    setIsUpdating(true);

    postServices(services)
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  if (isLoading || !services) return <CircularProgress />;

  return (
    <Section title="Features">
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
        <SettingToggle
          control={
            <Switch
              disabled={ isUpdating || services?.biometrics.jobs.installation.status !== 'healthy' }
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
        { /* Only offered in a build that has somewhere to send reports */ }
        { SENTRY_DSN && (
          <Box sx={ { borderTop: '1px solid', borderColor: 'divider', pt: 2 } }>
            <SettingToggle
              control={
                <Switch
                  disabled={ isUpdating }
                  checked={ services.sentryLogging.enabled }
                  onChange={ (event) => updateServices({ sentryLogging: { enabled: event.target.checked } }) }
                />
              }
              label="Enable Sentry error reporting"
              info="Sends anonymous error reports. Nothing is sent while the internet block is on."
            />
          </Box>
        ) }
      </Box>
    </Section>
  );
}
