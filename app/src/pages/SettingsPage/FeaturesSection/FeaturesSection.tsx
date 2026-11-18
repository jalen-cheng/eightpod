import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
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
    <Section title="Features" icon={ <ExtensionOutlinedIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
        { /* Greyed out: untested in this version. The switch only works to turn it off where it is already on. */ }
        <Box sx={ { opacity: services.biometrics.enabled ? 1 : 0.45 } }>
          <SettingToggle
            control={
              <Switch
                disabled={ isUpdating || !services.biometrics.enabled }
                checked={ services.biometrics.enabled }
                onChange={ (event) => updateServices({ biometrics: { enabled: event.target.checked } }) }
              />
            }
            label="Biometrics (sleep analysis)"
          >
            Not available: untested in this version, and it does not work on a Pod 5.
          </SettingToggle>
        </Box>
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
