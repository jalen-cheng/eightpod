import { useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { baseURL } from '@api/api';

// How far back an export can reach; the Pod keeps about three months
const EXPORT_RANGES = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

// Downloads the saved nights of the chosen stretch, minute rows included, as one JSON file
export default function ExportMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={ <FileDownloadOutlinedIcon/> }
        onClick={ (event) => setAnchor(event.currentTarget) }
        sx={ { flexShrink: 0, mt: 0.5 } }
      >
        Export
      </Button>
      <Menu anchorEl={ anchor } open={ anchor !== null } onClose={ close }>
        { EXPORT_RANGES.map(({ label, days }) => (
          <MenuItem key={ days } component="a" href={ `${baseURL}/api/autopilot/nights/export?days=${days}` } download onClick={ close }>
            { label }
          </MenuItem>
        )) }
      </Menu>
    </>
  );
}
