import { useEffect, useState, useRef } from 'react';
import { baseURL } from '@api/api';
import { Paper, Typography, Box, MenuItem, Select } from '@mui/material';
import PageContainer from '../../PageContainer.tsx';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import Header from '../Header.tsx';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';


export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<string>('');
  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const isUserAtBottom = useRef(true);
  const theme = useTheme();

  // Fetch available log files
  useEffect(() => {
    const fetchLogFiles = async () => {
      try {
        const response = await axios.get<{ logs: string[] }>(`${baseURL}/api/logs`);
        if (response.data.logs.length > 0) {
          setLogFiles(response.data.logs);
          setSelectedLog(response.data.logs[0]); // Default to the latest log file
        }
      } catch (error) {
        console.error('Error fetching log files:', error);
      }
    };

    fetchLogFiles();
  }, []);

  // Subscribe to log updates for the selected file
  useEffect(() => {
    if (!selectedLog) return;

    const eventSource = new EventSource(`${baseURL}/api/logs/${selectedLog}`);

    eventSource.onmessage = (event) => {
      const logData = JSON.parse(event.data);
      setLogs((prevLogs) => [...prevLogs.slice(-999), logData.message]); // Keep last 1000 logs
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedLog]); // Re-run when log file changes

  // Track if user is at the bottom
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    isUserAtBottom.current = scrollHeight - scrollTop <= clientHeight + 50; // 50px buffer
  };

  // Auto-scroll only if user is at the bottom
  useEffect(() => {
    // The list is scrolled, not the page: scrolling the last line into view moved the page as well
    const container = logsContainerRef.current;
    if (isUserAtBottom.current && container) container.scrollTop = container.scrollHeight;
  }, [logs]);

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <Header title="Logs" icon={ <ArticleOutlinedIcon/> }/>

      <Paper
        elevation={ 3 }
        sx={ {
          // height: '100%',
          // maxHeight: '100%',
          p: 2,
          width: '100%',
          bgcolor: theme.palette.background.paper,
          color: '#fff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          [theme.breakpoints.up('sm')]: {
            width: '100%',
          },
        } }
      >
        <Select
          size="small"
          value={ selectedLog }
          inputProps={ { 'aria-label': 'Log file' } }
          sx={ { alignSelf: 'flex-start', minWidth: 200, mb: 1.5 } }
          onChange={ (e) => {
            setLogs([]);
            setSelectedLog(e.target.value);
          } }
        >
          { logFiles.map((file) => (
            <MenuItem key={ file } value={ file }>
              { file }
            </MenuItem>
          )) }
        </Select>

        <Typography
          variant="h6"
          sx={ {
            fontWeight: 'bold',
            color: theme.palette.grey[100],
            pb: 1,
            borderBottom: `1px solid ${theme.palette.grey[700]}`,
            position: 'sticky',
            top: 0,
            zIndex: 1,
            paddingBottom: 1,
          } }
        >
          Live server logs
        </Typography>

        <Box
          ref={ logsContainerRef }
          onScroll={ handleScroll }
          sx={ {
            flex: 1,
            overflowY: 'auto',
            maxHeight: `${window.innerHeight - 300}px`,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            p: 1,
            '&::-webkit-scrollbar': {
              width: '10px',
            },
            '&::-webkit-scrollbar-track': {
              background: theme.palette.background.paper,
              borderRadius: '5px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.grey[600],
              borderRadius: '5px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.grey[500],
            },
          } }
        >
          <Typography sx={ { fontFamily: 'monospace', color: theme.palette.grey[200], fontSize: '12px' } }>
            { logs.join('\n') }
          </Typography>
          <div ref={ logsEndRef } />
        </Box>
      </Paper>
    </PageContainer>
  );
}
