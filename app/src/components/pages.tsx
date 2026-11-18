import { ReactElement } from 'react';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

type Page = { title: string; route: string; icon: ReactElement };

// The tabs. The Status page has none: it opens from the "Status" link (see StatusLink.tsx).
export const PAGES: Page[] = [
  { title: 'Temperature', route: '/temperature', icon: <ThermostatOutlinedIcon/> },
  { title: 'Schedules', route: '/schedules', icon: <ScheduleOutlinedIcon/> },
  { title: 'Data', route: '/data', icon: <BarChartOutlinedIcon/> },
  { title: 'Settings', route: '/settings', icon: <SettingsOutlinedIcon/> },
];

// The tab a path belongs to, or undefined for a page that has none
export const getPageForPath = (pathname: string): Page | undefined => {
  if (['/', '/left', '/right'].includes(pathname)) return PAGES[0];
  return PAGES.find(page => pathname === page.route || pathname.startsWith(`${page.route}/`));
};
