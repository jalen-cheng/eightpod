import { Outlet, useLocation, Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import { useServices } from '@api/services.ts';

const SLEEP_ROUTE = '/data/sleep';
const DATA_PAGES = [
  { title: 'Sleep', route: SLEEP_ROUTE, icon: <BedOutlinedIcon/> },
  { title: 'Nights', route: '/data/nights', icon: <NightsStayOutlinedIcon/> },
  { title: 'Logs', route: '/data/logs', icon: <ArticleOutlinedIcon/> },
];

export default function DataPage() {
  const { pathname } = useLocation();
  const { data: services } = useServices();
  if (pathname.startsWith('/data/')) return <Outlet/>;
  // Sleep data only exists while biometrics is switched on in Settings
  const isSleepOff = services !== undefined && !services.biometrics.enabled;

  return (
    <PageContainer>
      <PageHeader title="Data" showStatusOnPhone/>
      { DATA_PAGES.map(({ title, route, icon }) => {
        const isOff = route === SLEEP_ROUTE && isSleepOff;
        return (
          <Paper
            key={ route }
            // An entry that is off is shown, dimmed, and leads nowhere
            { ...(isOff ? { 'aria-disabled': true } : { component: Link, to: route }) }
            sx={ {
              p: 2.5, display: 'flex', gap: 2, alignItems: 'center', color: 'inherit', textDecoration: 'none',
              ...(isOff ? { opacity: 0.45 } : { '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' } }),
            } }
          >
            <Box sx={ { display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: 'action.selected' } }>
              { icon }
            </Box>
            <Box sx={ { flex: 1 } }>
              <Typography variant="h6" sx={ { mb: 0.5 } }>{ title }</Typography>
              { isOff && (
                <Typography variant="body2" sx={ { color: 'text.secondary' } }>
                  Off. Biometrics is untested in this version; switch it on in Settings.
                </Typography>
              ) }
            </Box>
            { !isOff && <ArrowForwardIcon sx={ { fontSize: 18, color: 'text.secondary' } }/> }
          </Paper>
        );
      }) }
    </PageContainer>
  );
}
