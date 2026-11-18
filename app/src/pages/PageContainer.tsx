import { PropsWithChildren } from 'react';
import { Container, ContainerProps, SxProps, Theme } from '@mui/material';
import ErrorBoundary from '@components/ErrorBoundary.tsx';

type PageContainerProps = { containerProps?: ContainerProps; sx?: SxProps<Theme> };

// Every page shares this width and padding, so a heading is in the same place on every tab
export const PAGE_MAX_WIDTH_PX = 760;

export default function PageContainer({ children, sx = [], containerProps }: PropsWithChildren<PageContainerProps>) {
  return (
    <ErrorBoundary componentName="Page container">
      <Container
        { ...containerProps }
        id="PageContainer"
        maxWidth={ false }
        sx={ [
          { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2.5,
            width: '100%', maxWidth: PAGE_MAX_WIDTH_PX, mx: 'auto', px: { xs: 2.5, sm: 4, lg: 5 }, pt: { xs: 3, md: 5 },
            // Room at the foot on a computer for the status link fixed in the corner
            pb: { xs: 3, md: 9 } },
          ...(Array.isArray(sx) ? sx : [sx]),
        ] }
      >
        { children }
      </Container>
    </ErrorBoundary>
  );
}
