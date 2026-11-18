import { Box, Typography } from '@mui/material';
import { ReactNode } from 'react';
import StatusLink from './StatusLink.tsx';

type PageHeaderProps = {
  title: string;
  children?: ReactNode;
  // On a phone, show the Pod's status at the right of the heading. (On a computer it is always
  // at the bottom right of the window.) For the pages about the Pod, not the ones used in bed.
  showStatusOnPhone?: boolean;
};

// The heading of a page
export default function PageHeader({ title, children, showStatusOnPhone }: PageHeaderProps) {
  return (
    <Box sx={ { width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
      <Typography variant="h2" component="h1" sx={ { fontSize: { xs: 27, md: 30 } } }>{ title }</Typography>
      { children }
      { showStatusOnPhone && <Box sx={ { display: { xs: 'flex', md: 'none' } } }><StatusLink/></Box> }
    </Box>
  );
}
