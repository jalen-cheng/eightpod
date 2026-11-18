import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';
import StatusLink from './StatusLink.tsx';

type PageHeaderProps = {
  title: string;
  children?: ReactNode;
  // The Status page itself has no use for a link to it
  hideStatus?: boolean;
};

// The heading of a page. On a phone it also carries the Pod's status, which on a computer sits
// at the bottom right of the window.
export default function PageHeader({ title, children, hideStatus }: PageHeaderProps) {
  return (
    <Box
      sx={ {
        width: '100%', mb: 0.5, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
      } }
    >
      <Typography variant="h2" component="h1" sx={ { fontSize: { xs: 27, md: 30 } } }>{ title }</Typography>
      { children }
      { !hideStatus && !children && <Box sx={ { display: { xs: 'flex', md: 'none' } } }><StatusLink/></Box> }
    </Box>
  );
}
