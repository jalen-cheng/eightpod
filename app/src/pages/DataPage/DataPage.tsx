import { Outlet, useLocation, Link } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import { useServices } from '@api/services.ts';

// Sleep is the bed's own record of each night. Biometrics is the older page fed by the
// biometrics service, which only has anything to show where that service is switched on.
const SLEEP_PAGE = { title: 'Sleep', route: '/data/nights', icon: <BedOutlinedIcon/> };
const BIOMETRICS_PAGE = { title: 'Biometrics', route: '/data/sleep', icon: <MonitorHeartOutlinedIcon/> };
const LOGS_PAGE = { title: 'Logs', route: '/data/logs', icon: <ArticleOutlinedIcon/> };

export default function DataPage() {
  const { pathname } = useLocation();
  const { data: services } = useServices();
  if (pathname.startsWith('/data/')) return <Outlet/>;
  const dataPages = [SLEEP_PAGE, ...(services?.biometrics.enabled ? [BIOMETRICS_PAGE] : []), LOGS_PAGE];

  return (
    <PageContainer>
      <PageHeader title="Data" showStatusOnPhone/>
      { dataPages.map(({ title, route, icon }) => (
        <Paper
          key={ route }
          component={ Link }
          to={ route }
          sx={ {
            p: 2.5, display: 'flex', gap: 2, alignItems: 'center', color: 'inherit', textDecoration: 'none',
            '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
          } }
        >
          <Box sx={ { display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: 'action.selected' } }>
            { icon }
          </Box>
          <Typography variant="h6" sx={ { flex: 1 } }>{ title }</Typography>
          <ArrowForwardIcon sx={ { fontSize: 18, color: 'text.secondary' } }/>
        </Paper>
      )) }
    </PageContainer>
  );
}
