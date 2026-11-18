import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import PageHeader from '@components/PageHeader.tsx';
import PageContainer from '../PageContainer.tsx';
import ApiGuide from '../SettingsPage/DeviceSettingsSection/ApiGuide.tsx';
import Section from '../SettingsPage/Section.tsx';

// The API guide. It has no tab: it opens from Settings, and its address can be bookmarked or sent.
export default function ApiPage() {
  return (
    <PageContainer>
      <Box>
        <Button component={ Link } to="/settings" size="small" startIcon={ <ArrowBackIcon/> } sx={ { ml: -1.5, mb: 0.5 } }>Settings</Button>
        <PageHeader title="API"/>
      </Box>
      <Section><ApiGuide/></Section>
    </PageContainer>
  );
}
