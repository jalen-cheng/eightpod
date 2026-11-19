import { Badge, Box, Button, ButtonBase, LinearProgress, Typography } from '@mui/material';
import { SIDEBAR_WIDTH_PX } from './pageFrame.ts';
import { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '@state/appStore.tsx';
import { useServerInfo } from '@api/serverInfo.ts';
import { PAGES, getPageForPath } from './pages';
import StatusLink, { FLOATING_STATUS_QUERY, STATUS_ROUTE } from './StatusLink.tsx';

export default function Navbar() {
  const { pathname } = useLocation();
  const { isUpdating } = useAppStore();
  const { data: serverInfo, isError: versionError } = useServerInfo();
  const updateAvailable = Boolean(serverInfo?.updateAvailable) && !versionError;
  const activePage = getPageForPath(pathname);

  // Use the same cached version check as Settings for both navigation layouts.
  const navigationIcon = (route: string, icon: ReactElement) => (
    <Badge
      variant="dot"
      color="info"
      invisible={ route !== '/settings' || !updateAvailable }
      sx={ theme => ({ '& .MuiBadge-badge': { boxShadow: `0 0 0 2px ${theme.palette.background.default}` } }) }
    >
      { icon }
    </Badge>
  );

  return (
    <>
      { isUpdating && <LinearProgress sx={ { position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 1400 } }/> }
      <Box
        component="aside"
        sx={ {
          display: { xs: 'none', md: 'flex' }, position: 'fixed', inset: '0 auto 0 0', width: SIDEBAR_WIDTH_PX, p: 2,
          flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.default', zIndex: 1100,
        } }
      >
        <Box component={ Link } to="/" sx={ { display: 'flex', justifyContent: 'center', p: 1, mb: 3, textDecoration: 'none' } }>
          <Box component="img" src="/sevensleep-logo.png" alt="SevenSleep" sx={ { width: 104, height: 'auto' } }/>
        </Box>
        <Box component="nav" aria-label="Main navigation" sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
          { PAGES.map(({ title, route, icon }) => (
            <Button
              key={ route }
              component={ Link }
              to={ route }
              startIcon={ navigationIcon(route, icon) }
              aria-current={ activePage?.route === route ? 'page' : undefined }
              aria-label={ route === '/settings' && updateAvailable ? 'Settings, update available' : title }
              sx={ {
                justifyContent: 'flex-start', px: 1.5, py: 1.15,
                color: activePage?.route === route ? 'text.primary' : 'text.secondary',
                bgcolor: activePage?.route === route ? 'action.selected' : 'transparent',
                '& .MuiButton-startIcon': { mr: 1.5, color: activePage?.route === route ? 'primary.main' : 'text.secondary' },
                '& .MuiSvgIcon-root': { fontSize: 19 },
              } }
            >
              { title }
            </Button>
          )) }
        </Box>
      </Box>
      { /* The Pod's health, and the way to the Status page: bottom right on a wide screen. A
           phone or a narrow window has no free corner, so there it sits beside the heading of
           Data and Settings. */ }
      { pathname !== STATUS_ROUTE && (
        <Box sx={ { display: 'none', [FLOATING_STATUS_QUERY]: { display: 'block' }, position: 'fixed', right: 20, bottom: 16, zIndex: 1100 } }>
          <StatusLink/>
        </Box>
      ) }
      <Box
        component="nav"
        aria-label="Mobile navigation"
        sx={ {
          display: { xs: 'block', md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default', zIndex: 1100,
          pb: 'env(safe-area-inset-bottom)',
        } }
      >
        { /* Equal columns, each an icon over its name, so the tabs sit at even distances */ }
        <Box sx={ { display: 'grid', gridTemplateColumns: `repeat(${PAGES.length}, 1fr)`, height: 60 } }>
          { PAGES.map(({ title, route, icon }) => {
            const isActive = activePage?.route === route;
            return (
              <ButtonBase
                key={ route }
                component={ Link }
                to={ route }
                aria-current={ isActive ? 'page' : undefined }
                aria-label={ route === '/settings' && updateAvailable ? 'Settings, update available' : title }
                sx={ {
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  color: isActive ? 'text.primary' : 'text.secondary', '& .MuiSvgIcon-root': { fontSize: 22 },
                } }
              >
                { navigationIcon(route, icon) }
                <Typography component="span" sx={ { fontSize: 10.5, fontWeight: 500, lineHeight: 1 } }>{ title }</Typography>
              </ButtonBase>
            );
          }) }
        </Box>
      </Box>
    </>
  );
}
