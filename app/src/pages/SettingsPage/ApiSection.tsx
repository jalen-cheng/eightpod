import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import { Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { API_ROUTE } from '@components/pages.tsx';
import Section from './Section.tsx';

// Points at the API page. On a phone that page has no tab of its own, so this is the way to it.
export default function ApiSection() {
  return (
    <Section
      title="API"
      icon={ <ApiOutlinedIcon/> }
      action={ <Button size="small" component={ Link } to={ API_ROUTE }>Open the guide</Button> }
    >
      <Typography variant="body2" sx={ { color: 'text.secondary' } }>
        Everything this app does is a request to the Pod. Shortcuts, Home Assistant, scripts and AI assistants can send the same ones.
      </Typography>
    </Section>
  );
}
