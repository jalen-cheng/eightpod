import { PropsWithChildren, ReactNode, useId } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

// `action` sits at the right of the title line, for a section's live state or one control
type SectionProps = PropsWithChildren<{ title?: string; icon?: ReactNode; action?: ReactNode }>;

export default function Section({ title, icon, action, children }: SectionProps) {
  const titleId = useId();

  return (
    <Card
      component="section"
      aria-labelledby={ title ? titleId : undefined }
      sx={ {
        width: '100%', minWidth: 0, overflowWrap: 'anywhere',
        bgcolor: { xs: 'transparent', sm: 'background.paper' },
        borderWidth: { xs: 0, sm: 1 }, borderBottomWidth: { xs: 1 },
        borderRadius: { xs: 0, sm: 3 }, pb: { xs: 3, sm: 0 },
      } }
    >
      { title && (
        <Box
          sx={ {
            display: 'flex', alignItems: 'center', gap: 1,
            px: { xs: 0, sm: 2.5 }, pt: { xs: 0.5, sm: 2 }, pb: { xs: 2.5, sm: 2 },
            borderBottom: { xs: 0, sm: '1px solid' }, borderColor: 'divider',
          } }>
          { icon && <Box sx={ { display: 'flex', color: 'text.secondary', '& .MuiSvgIcon-root': { fontSize: 18 } } }>{ icon }</Box> }
          <Typography id={ titleId } component="h2" variant="h6" sx={ { fontSize: 15 } }>{ title }</Typography>
          { action && <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 } }>{ action }</Box> }
        </Box>
      ) }
      <CardContent sx={ { p: { xs: 0, sm: 2.5 }, '&:last-child': { pb: { xs: 0, sm: 2.5 } } } }>{ children }</CardContent>
    </Card>
  );
}
