import { Box, Link, Typography } from '@mui/material';

const API_REFERENCE_URL = 'https://github.com/jalen-cheng/eightpod/blob/main/server/API.md';

// The requests most things need. The reference lists the rest.
const REQUESTS = [
  { method: 'GET', path: '/api/deviceStatus', use: 'Everything about the bed: on or off, temperatures, water, priming' },
  { method: 'POST', path: '/api/deviceStatus', use: 'Turn a side on or off, set its temperature, stop an alarm, start priming' },
  { method: 'GET', path: '/api/deviceStatus/dial', use: 'The bed in one sentence, on the -10 to +10 scale' },
  { method: 'POST', path: '/api/deviceStatus/dial', use: 'Set the temperature on the -10 to +10 scale' },
  { method: 'POST', path: '/api/alarm/time', use: 'A one-time alarm, a weekly alarm, or move the next alarm' },
  { method: 'GET', path: '/api/schedules', use: 'The weekly schedule (POST changes it)' },
  { method: 'GET', path: '/api/settings', use: 'Every setting on this page (POST changes them)' },
  { method: 'GET', path: '/api/metrics/presence/sensors', use: 'Whether someone is in bed (Pod 5)' },
];

// Requests worth trying first: one that reads the bed and one that changes it
const getExamples = (podAddress: string) => [
  { label: 'Read the bed', command: `curl ${podAddress}/api/deviceStatus/dial` },
  {
    label: 'Set the left side to 70°F',
    command: `curl -X POST ${podAddress}/api/deviceStatus -H 'Content-Type: application/json' -d '{"left":{"targetTemperatureF":70}}'`,
  },
];

const codeSx = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 };

// What the Pod's API is and how to start using it: the common requests, two to copy, and a link to
// the rest. The address is the one this page was opened at (http://eightpod.local on a Pod), so
// the examples work as shown from the same network.
export default function ApiGuide() {
  const podAddress = window.location.origin;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
      <Typography variant="body2" sx={ { color: 'text.secondary' } }>
        Everything this app does is a request to the Pod
        at <Box component="span" sx={ { ...codeSx, color: 'text.primary' } }>{ podAddress }</Box>.
        There is no login and no key: it works from your home network, with the internet down.
      </Typography>

      <Box component="ul" sx={ { listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' } }>
        { REQUESTS.map(({ method, path, use }) => (
          <Box
            component="li"
            key={ `${method} ${path}` }
            sx={ {
              display: 'grid', gridTemplateColumns: { xs: '44px 1fr', sm: '44px minmax(0, 250px) 1fr' }, columnGap: 1.5, rowGap: 0.25,
              alignItems: 'baseline', py: 1, borderTop: '1px solid', borderColor: 'divider',
            } }
          >
            <Typography sx={ { ...codeSx, fontSize: 11, color: method === 'GET' ? 'success.main' : 'warning.main' } }>{ method }</Typography>
            <Typography sx={ codeSx }>{ path }</Typography>
            <Typography variant="body2" sx={ { color: 'text.secondary', gridColumn: { xs: '2', sm: 'auto' } } }>{ use }</Typography>
          </Box>
        )) }
      </Box>

      { getExamples(podAddress).map(({ label, command }) => (
        <Box key={ label }>
          <Typography variant="body2" sx={ { fontWeight: 500, mb: 0.75 } }>{ label }</Typography>
          <Box
            component="code"
            // One tap selects the whole command; the clipboard is not available on a plain http page
            sx={ {
              ...codeSx, display: 'block', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1,
              userSelect: 'all', overflowWrap: 'anywhere',
            } }
          >
            { command }
          </Box>
        </Box>
      )) }
      <Link href={ API_REFERENCE_URL } target="_blank" rel="noreferrer" variant="body2" sx={ { alignSelf: 'flex-start' } }>
        Every request and its fields, in the API reference
      </Link>
    </Box>
  );
}
