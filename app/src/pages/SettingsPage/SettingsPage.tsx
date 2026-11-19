import { Box, Divider } from '@mui/material';
import PageContainer from '../PageContainer.tsx';
import { useSettings } from '@api/settings.ts';
import { useUpdateSettings } from '@lib/useUpdateSettings.ts';
import DailyPriming from './DailyPriming.tsx';
import PrimeControl from './PrimeControl.tsx';
import Donate from './Donate.tsx';
import Section, { FoldingSectionsContext } from './Section.tsx';
import TapGesturesSection from './TapGesturesSection/TapGesturesSection.tsx';
import PresenceSection from './PresenceSection.tsx';
import AutopilotSection from './AutopilotSection.tsx';
import AlarmSection from './AlarmSection.tsx';
import SettingsFooter from './SettingsFooter.tsx';
import DeviceSettingsSection from './DeviceSettingsSection/DeviceSettingsSection.tsx';
import OtherSection from './OtherSection.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageHeader from '@components/PageHeader.tsx';

// Every setting, in sections that fold down to their names: General starts open, and the page
// remembers which were opened and closed. The Pod itself (its version, updating, restarting)
// is on the Status page; the API guide, help and the license are in the footer.
export default function SettingsPage() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  return (
    <PageContainer>
      <PageHeader title="Settings" showStatusOnPhone/>
      <FoldingSectionsContext.Provider value>
        <ErrorBoundary componentName="Device settings">
          <DeviceSettingsSection updateSettings={ updateSettings }/>
        </ErrorBoundary>
        <ErrorBoundary componentName="Autopilot">
          <AutopilotSection settings={ settings } updateSettings={ updateSettings }/>
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
        <ErrorBoundary componentName="Other settings">
          <OtherSection settings={ settings } updateSettings={ updateSettings }/>
        </ErrorBoundary>
        <ErrorBoundary componentName="Info section">
          <Donate/>
        </ErrorBoundary>
      </FoldingSectionsContext.Provider>
      <SettingsFooter/>
    </PageContainer>
  );
}
