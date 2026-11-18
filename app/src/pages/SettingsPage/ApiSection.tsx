import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { API_GUIDE_ROUTE } from '@components/apiGuideRoute.ts';
import Section from './Section.tsx';
import SettingRow from './SettingRow.tsx';

const API_INFO = 'Shortcuts, Home Assistant, scripts and AI assistants can send the same requests this app does.';

// The way to the API guide, which has no tab of its own
export default function ApiSection() {
  return (
    <Section title="API">
      <SettingRow label="Requests and examples" info={ API_INFO }>
        <Button size="small" component={ Link } to={ API_GUIDE_ROUTE } endIcon={ <ArrowForwardIcon/> }>Open</Button>
      </SettingRow>
    </Section>
  );
}
