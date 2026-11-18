import { PropsWithChildren, ReactNode, useId } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

// `action` sits at the right of the title line, for a section's live state or one control
type SectionProps = PropsWithChildren<{ title?: string; action?: ReactNode }>;

// A group of settings: its name above a card. The name is plain text outside the card, so the
// card holds only the settings.
export default function Section({ title, action, children }: SectionProps) {
  const titleId = useId();

  return (
    <Box component="section" aria-labelledby={ title ? titleId : undefined } sx={ { width: '100%', minWidth: 0 } }>
      { title && (
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 32, mb: 1, px: { xs: 0, sm: 0.5 } } }>
          <Typography id={ titleId } component="h2" variant="h6" sx={ { fontSize: 15 } }>{ title }</Typography>
          { action && <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 } }>{ action }</Box> }
        </Box>
      ) }
      <Card
        sx={ {
          width: '100%', minWidth: 0, overflowWrap: 'anywhere', borderRadius: '12px',
          // On a phone the card has no box of its own: a line under it separates it from the next
          bgcolor: { xs: 'transparent', sm: 'background.paper' },
          borderWidth: { xs: 0, sm: 1 }, borderBottomWidth: { xs: 1 }, pb: { xs: 2.5, sm: 0 },
          '@media (max-width: 599.95px)': { borderRadius: 0 },
        } }
      >
        <CardContent sx={ { p: { xs: 0, sm: 2.5 }, '&:last-child': { pb: { xs: 0, sm: 2.5 } } } }>{ children }</CardContent>
      </Card>
    </Box>
  );
}
