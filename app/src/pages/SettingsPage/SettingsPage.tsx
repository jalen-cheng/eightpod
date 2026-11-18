import { DeepPartial } from 'ts-essentials';
import { Box, Divider, Switch } from '@mui/material';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import SideSettings from './SideSettings.tsx';
import SettingToggle from './SettingToggle.tsx';
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
import DeviceSettingsSection from './DeviceSettingsSection/DeviceSettingsSection.tsx';
import DeviceInfo from './DeviceSettingsSection/DeviceInfo.tsx';
import DailyReboot from './DeviceSettingsSection/DailyReboot.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageHeader from '@components/PageHeader.tsx';
import ConnectionBadge from '@components/ConnectionBadge.tsx';

const FLIP_SIDES_INFO = 'Swaps which side of the bed the app calls left and right, everywhere: controls, schedules, buttons '
  + 'and in-bed detection. Each side keeps its name, schedule and settings.';

export default function SettingsPage() {
  const { data: settings, refetch } = useSettings();
  const { isUpdating, setIsUpdating } = useAppStore();

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
      <PageHeader title="Settings">
        <Box sx={ { display: { xs: 'flex', md: 'none' } } }><ConnectionBadge/></Box>
      </PageHeader>
      <ErrorBoundary componentName="Device settings">
        <DeviceSettingsSection updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Side settings">
        <Section title="Side settings" icon={ <BedOutlinedIcon/> }>
          <Box sx={ { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 } }>
            <SideSettings side="left" settings={ settings } updateSettings={ updateSettings }/>
            <SideSettings side="right" settings={ settings } updateSettings={ updateSettings }/>
          </Box>
          <Box sx={ { mt: 2 } }>
            <SettingToggle
              label="Flip left and right"
              info={ FLIP_SIDES_INFO }
              control={
                <Switch
                  disabled={ isUpdating }
                  checked={ settings?.swapSides || false }
                  onChange={ (event) => updateSettings({ swapSides: event.target.checked }) }
                />
              }
            />
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="Tap gestures">
        <TapGesturesSection settings={ settings } updateSettings={ updateSettings }/>
      </ErrorBoundary>
      <ErrorBoundary componentName="Priming settings">
        <Section title="Priming" icon={ <WaterDropOutlinedIcon/> }>
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
        <Section title="Device" icon={ <MemoryOutlinedIcon/> }>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
            <DeviceInfo/>
            <Divider/>
            <DailyReboot settings={ settings } updateSettings={ updateSettings }/>
          </Box>
        </Section>
      </ErrorBoundary>
      <ErrorBoundary componentName="Info section">
        <DiscordLink/>
        <Donate/>
        <LicenseModal/>
      </ErrorBoundary>
    </PageContainer>
  );
}
