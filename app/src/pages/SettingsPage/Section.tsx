import { PropsWithChildren, ReactNode, createContext, useContext, useId } from 'react';
import { Box, ButtonBase, Card, CardContent, Collapse, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useOpenSections } from './openSections.ts';

// `action` is a section's live state or one control: at the right of the title line, or at the
// top of the section when it folds
type SectionProps = PropsWithChildren<{ title?: string; action?: ReactNode }>;

// A page whose sections fold down to their titles wraps them in this with `true`
export const FoldingSectionsContext = createContext(false);

const cardSx = { width: '100%', minWidth: 0, overflowWrap: 'anywhere', borderRadius: '12px', bgcolor: 'background.paper' };
const contentSx = { p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } };

// A group of settings under its name. On a page of folding sections it is a card that shows
// only its name until pressed, and the page remembers which ones were left open. Elsewhere, or
// without a name, the name is plain text above a card that is always open.
export default function Section({ title, action, children }: SectionProps) {
  const titleId = useId();
  const contentId = useId();
  const isFolding = useContext(FoldingSectionsContext) && title !== undefined;
  const { openTitles, toggle } = useOpenSections();

  if (!isFolding) {
    return (
      <Box component="section" aria-labelledby={ title ? titleId : undefined } sx={ { width: '100%', minWidth: 0 } }>
        { title && (
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 32, mb: 1, px: 0.5 } }>
            <Typography id={ titleId } component="h2" variant="h6" sx={ { fontSize: 15 } }>{ title }</Typography>
            { action && <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 } }>{ action }</Box> }
          </Box>
        ) }
        <Card sx={ cardSx }>
          <CardContent sx={ contentSx }>{ children }</CardContent>
        </Card>
      </Box>
    );
  }

  const isOpen = openTitles.includes(title);
  return (
    <Card component="section" aria-labelledby={ titleId } sx={ cardSx }>
      <ButtonBase
        onClick={ () => toggle(title) }
        aria-expanded={ isOpen }
        aria-controls={ contentId }
        sx={ {
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
          px: { xs: 2, sm: 2.5 }, minHeight: 52, textAlign: 'left',
          '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: -2 },
        } }
      >
        <Typography id={ titleId } component="h2" variant="h6" sx={ { fontSize: 15 } }>{ title }</Typography>
        <ExpandMoreIcon
          aria-hidden
          sx={ { color: 'text.secondary', transition: 'transform 150ms ease', transform: isOpen ? 'rotate(180deg)' : 'none' } }
        />
      </ButtonBase>
      <Collapse in={ isOpen } id={ contentId } unmountOnExit>
        <CardContent sx={ { ...contentSx, pt: { xs: 0.5, sm: 0.5 } } }>
          { action && <Box sx={ { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mb: 1.5 } }>{ action }</Box> }
          { children }
        </CardContent>
      </Collapse>
    </Card>
  );
}
