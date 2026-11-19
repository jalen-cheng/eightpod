import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { Box, Button } from '@mui/material';
import { DOCS_URL, ISSUES_URL, LICENSE_URL } from '@lib/docsLinks.ts';

// The things that are looked up, not set, under the last section. Each opens outside the app:
// the documentation site (the guides and the API), the license on GitHub, and where to report
// a problem.
const FOOTER_LINKS = [
  { label: 'Documentation', href: DOCS_URL },
  { label: 'License', href: LICENSE_URL },
  { label: 'Help', href: ISSUES_URL },
];

export default function SettingsFooter() {
  return (
    <Box component="footer" sx={ { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 0.5 } }>
      { FOOTER_LINKS.map(({ label, href }) => (
        <Button
          key={ label }
          size="small"
          color="inherit"
          component="a"
          href={ href }
          target="_blank"
          rel="noopener noreferrer"
          endIcon={ <ArrowOutwardIcon/> }
          // Quiet enough to read as a footer, tall enough to press on a phone
          sx={ { color: 'text.secondary', fontWeight: 400, minHeight: 44, px: 1.25 } }
        >
          { label }
        </Button>
      )) }
    </Box>
  );
}
