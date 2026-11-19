import moment from 'moment-timezone';
import { useServerStatus } from '@api/serverStatus.ts';
import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';

import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import StatusRow from './StatusRow.tsx';
import DeviceInfo from './DeviceInfo.tsx';
import Section from '../SettingsPage/Section.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import { useSettings } from '@api/settings.ts';
import { useUpdateSettings } from '@lib/useUpdateSettings.ts';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';

// The Pod itself (what it is, its Wi-Fi, its software and updating it, restarting it) and the
// state of each of its services
export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useServerStatus(5_000);
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const updatedAt = moment(dataUpdatedAt);
  const formatted = updatedAt.format('YYYY-MM-DD HH:mm:ss z');
  return (
    <PageContainer>
      <Box>
        <PageHeader title="Status"/>
        <Typography
          variant="caption"
          sx={ {
            color: 'text.secondary',
            display: 'block',
            mt: 1,
            fontVariantNumeric: 'tabular-nums',
            overflowWrap: 'anywhere'
          } }>
          Updated at: { formatted }
        </Typography>
      </Box>
      <ErrorBoundary componentName="Device info">
        <Section title="Pod">
          <DeviceInfo settings={ settings } updateSettings={ updateSettings }/>
        </Section>
      </ErrorBoundary>
      { isLoading && <CircularProgress /> }

      {
        data && (
          <Box
            component="ul"
            aria-label="Service status"
            sx={ { listStyle: 'none', m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' } }
          >
            {
              // @ts-expect-error
              Object.keys(data).map((job: ServerStatusKey) => (
                <StatusRow
                  key={ job }
                  job={ job }
                  statusInfo={ data[job] as StatusInfo }
                />
              ))
            }
          </Box>
        )

      }

    </PageContainer>
  );
}
