import { IconButton, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type InfoTipProps = {
  // The extra detail, shown in a small bubble
  text: string;
};

// A small "i" beside a label. Its text shows on hover, on keyboard focus, and on a tap on a
// phone. For detail that is worth having but would clutter the page as a permanent line.
export default function InfoTip({ text }: InfoTipProps) {
  return (
    <Tooltip title={ text } arrow describeChild enterTouchDelay={ 0 } leaveTouchDelay={ 6_000 }>
      <IconButton size="small" aria-label="More information" sx={ { p: 0.25, color: 'text.secondary', verticalAlign: 'middle' } }>
        <InfoOutlinedIcon sx={ { fontSize: 16 } }/>
      </IconButton>
    </Tooltip>
  );
}
