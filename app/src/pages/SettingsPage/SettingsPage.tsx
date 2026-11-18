import { DeepPartial } from 'ts-essentials';
import { Box, Divider } from '@mui/material';
import PageContainer from '../PageContainer.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import DailyPriming from './DailyPriming.tsx';
import LicenseModal from './LicenseModal.tsx';
import PrimeControl from './PrimeControl.tsx';
import Donate from './Donate.tsx';
import DiscordLink from './DiscordLink.tsx';
import FeaturesSection from './FeaturesSection/FeaturesSection.tsx';
import Section from './Section.tsx';
import TapGesturesSection from './TapGesturesSection/TapGesturesSection.tsx';
import PresenceSection from './PresenceSection.tsx';
import AlarmSection from './AlarmSection.tsx';
import ApiSection from './ApiSection.tsx';
import DeviceSettingsSection from './DeviceSettingsSection/DeviceSettingsSection.tsx';
import DeviceInfo from './DeviceSettingsSection/DeviceInfo.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageHeader from '@components/PageHeader.tsx';


export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { setIsUpdating } = useAppStore();

  const updateSettings = (settings: DeepPartial<Settings>) => {
    setIsUpdating(true);

    postSettings(settings)
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" showStatusOnPhone/>
      <ErrorBoundary componentName="Device settings">
        <DeviceSettingsSection updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Alarm settings">
        <AlarmSection/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Tap gestures">
        <TapGesturesSection settings={ settings } updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Priming settings">
        <Section title="Priming">
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
            <DailyPriming settings={ settings } updateSettings={ updateSettings }/>
            <Divider/>
            <Box sx={ { '& > .MuiButton-root': { width: '100%' } } }><PrimeControl/></Box>
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="In-bed detection">
        <PresenceSection settings={ settings } updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <FeaturesSection/>
      <ErrorBoundary componentName="Device info">
        <Section title="Pod">
          <DeviceInfo settings={ settings } updateSettings={ updateSettings }/>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="Info section">
        <ApiSection/>
        <DiscordLink/>
        <Donate/>
        <LicenseModal/>
      </ErrorBoundary>
    </PageContainer>
  );
}
