import { Link } from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import Section from './Section.tsx';

// Where problems with this fork are reported. (The original project's Discord supports the
// original, whose behaviour differs from this fork's.)
const ISSUES_LINK = 'https://github.com/jalen-cheng/free-sleep/issues';

export default function DiscordLink() {
  return (
    <Section title="Support & Feature Requests" icon={ <ForumOutlinedIcon/> }>
      <Link
        href={ ISSUES_LINK }
        target="_blank"
        rel="noopener noreferrer"
        underline="none"
        sx={ { display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, fontSize: 13 } }
      >
        Report a problem or ask for a feature on GitHub
        <ArrowOutwardIcon sx={ { fontSize: 16, color: 'text.secondary' } }/>
      </Link>
    </Section>
  );
}
