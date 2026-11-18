import { ReactElement } from 'react';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';

// Not "/api": the server answers everything under that path itself
export const API_ROUTE = '/developer';

type Page = {
  title: string;
  route: string;
  icon: ReactElement;
  // Pages about the Pod itself sit at the foot of the computer's sidebar, apart from the bed's own
  isAboutThePod?: boolean;
  // Left out of the phone's tab bar, which has room for five. Reached from Settings there.
  isComputerOnly?: boolean;
};

export const PAGES: Page[] = [
  { title: 'Temperature', route: '/temperature', icon: <ThermostatOutlinedIcon/> },
  { title: 'Schedules', route: '/schedules', icon: <ScheduleOutlinedIcon/> },
  { title: 'Data', route: '/data', icon: <BarChartOutlinedIcon/> },
  { title: 'Settings', route: '/settings', icon: <SettingsOutlinedIcon/>, isAboutThePod: true },
  { title: 'Status', route: '/status', icon: <GraphicEqOutlinedIcon/>, isAboutThePod: true },
  { title: 'API', route: API_ROUTE, icon: <ApiOutlinedIcon/>, isAboutThePod: true, isComputerOnly: true },
];

export const PHONE_PAGES = PAGES.filter(page => !page.isComputerOnly);

export const getPageForPath = (pathname: string) => {
  if (['/', '/left', '/right'].includes(pathname)) return PAGES[0];
  return PAGES.find(page => pathname === page.route || pathname.startsWith(`${page.route}/`)) ?? PAGES[0];
};
