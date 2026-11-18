import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import { Box, Link, Typography } from '@mui/material';
import Section from './Section.tsx';

const API_REFERENCE_URL = 'https://github.com/jalen-cheng/eightpod/blob/main/server/API.md';

// Requests worth trying first: one that reads the bed and one that changes it
const getExamples = (podAddress: string) => [
  { label: 'Read the bed', command: `curl ${podAddress}/api/deviceStatus/dial` },
  {
    label: 'Set the left side to 70°F',
    command: `curl -X POST ${podAddress}/api/deviceStatus -H 'Content-Type: application/json' -d '{"left":{"targetTemperatureF":70}}'`,
  },
];

// Tells people the Pod can be driven by other things, with two requests to copy. The address is
// the one this page was opened at, so the examples work as shown from the same network.
export default function ApiSection() {
  const podAddress = window.location.origin;

  return (
    <Section title="API" icon={ <ApiOutlinedIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          Everything this app does is a request to the Pod. Shortcuts, Home Assistant, scripts and AI assistants can send the same ones.
        </Typography>
        { getExamples(podAddress).map(({ label, command }) => (
          <Box key={ label }>
            <Typography variant="body2" sx={ { fontWeight: 500, mb: 0.75 } }>{ label }</Typography>
            <Box
              component="code"
              // One tap selects the whole command; the clipboard is not available on a plain http page
              sx={ {
                display: 'block', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                fontSize: 12, userSelect: 'all', overflowWrap: 'anywhere',
              } }
            >
              { command }
            </Box>
          </Box>
        )) }
        <Link href={ API_REFERENCE_URL } target="_blank" rel="noreferrer" variant="body2" sx={ { alignSelf: 'flex-start' } }>
          Every request, in the API reference
        </Link>
      </Box>
    </Section>
  );
}
