import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { API_GUIDE_ROUTE } from '@components/apiGuideRoute.ts';
import LicenseModal from './LicenseModal.tsx';

// Where problems with this fork are reported. (The original project's Discord supports the
// original, whose behaviour differs from this fork's.)
const ISSUES_LINK = 'https://github.com/jalen-cheng/sevensleep/issues';

// Quiet enough to read as a footer, tall enough to press on a phone
const linkSx = { color: 'text.secondary', fontWeight: 400, minHeight: 44, px: 1.25 };

// The things that are looked up, not set, under the last section: the API guide (which has
// no tab of its own), where to report a problem, and the license
export default function SettingsFooter() {
  return (
    <Box component="footer" sx={ { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 0.5 } }>
      <Button size="small" color="inherit" component={ Link } to={ API_GUIDE_ROUTE } sx={ linkSx }>API guide</Button>
      <Button
        size="small"
        color="inherit"
        component="a"
        href={ ISSUES_LINK }
        target="_blank"
        rel="noopener noreferrer"
        endIcon={ <ArrowOutwardIcon/> }
        sx={ linkSx }
      >
        Help
      </Button>
      <LicenseModal buttonSx={ linkSx }/>
    </Box>
  );
}
