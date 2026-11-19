import SearchIcon from '@mui/icons-material/Search';
import { Box, Button } from '@mui/material';
import { useState } from 'react';
import { Job, postJobs } from '@api/jobs.ts';
import { useServices } from '@api/services.ts';
import { useAppStore } from '@state/appStore.tsx';
import AnalyzeSleepNotification from './AnalyzeSleepNotification.tsx';

// How long the "analyzing" notice stays up; the analysis reports nothing back to the app
const ANALYZING_NOTICE_MS = 120_000;

type AnalyzeSleepPromptProps = {
  // True for a short while after the bed is turned off by hand
  isOffered: boolean;
}

// After the bed is turned off, offers to analyze the night that just ended (biometrics only)
export default function AnalyzeSleepPrompt({ isOffered }: AnalyzeSleepPromptProps) {
  const { side, isUpdating } = useAppStore();
  const { data: services } = useServices();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeSleep = () => {
    const sideJob = `analyzeSleep${side.charAt(0).toUpperCase()}${side.slice(1)}` as Job;
    setIsAnalyzing(true);
    postJobs([sideJob]).catch(error => console.error(error));
    setTimeout(() => setIsAnalyzing(false), ANALYZING_NOTICE_MS);
  };

  const showButton = isOffered && services?.biometrics?.enabled;
  if (!showButton && !isAnalyzing) return null;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 } }>
      { showButton && (
        <Button size="small" disabled={ isUpdating } onClick={ handleAnalyzeSleep } startIcon={ <SearchIcon sx={ { fontSize: 18 } }/> }>
          Analyze sleep (legacy)
        </Button>
      ) }
      { isAnalyzing && <AnalyzeSleepNotification/> }
    </Box>
  );
}
