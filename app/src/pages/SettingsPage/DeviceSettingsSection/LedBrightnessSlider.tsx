import { useEffect, useState } from 'react';
import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus.ts';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import _ from 'lodash';
import { useAppStore } from '@state/appStore.tsx';
import { Box, Slider, Typography } from '@mui/material';

export default function LedBrightnessSlider() {
  const { isUpdating, setIsUpdating } = useAppStore();
  const { data: deviceStatus, refetch } = useDeviceStatus();
  const [settingsCopy, setSettingsCopy] = useState<undefined | DeviceStatus['settings']>();
  useEffect(() => {
    if (!deviceStatus) return;
    const newDeviceStatus = _.cloneDeep(deviceStatus) as DeviceStatus;
    setSettingsCopy(newDeviceStatus.settings);
  }, [deviceStatus]);

  const handleChange = (settings: Partial<DeviceStatus['settings']>) => {
    const newSettings = _.merge({}, settingsCopy, settings);
    setSettingsCopy(newSettings);
  };

  const handleSave = () => {
    setIsUpdating(true);
    postDeviceStatus({
      settings: settingsCopy,
    })
      .then(() => {
        // Wait 1 second before refreshing the device status
        return new Promise((resolve) => setTimeout(resolve, 1_000));
      })
      .then(() => refetch())
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1, width: '100%' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }>
        <Typography variant="body2" sx={ { fontWeight: 500 } }>
        LED Brightness
        </Typography>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>
          { settingsCopy?.ledBrightness ? `${settingsCopy.ledBrightness}%` : 'Off' }
        </Typography>
      </Box>
      <Slider
        aria-label="LED Brightness"
        value={ settingsCopy?.ledBrightness || 0 }
        onChangeCommitted={ handleSave }
        onChange={ (_, newValue) => {
          handleChange({
            ledBrightness: newValue as number,
          });
        } }
        min={ 0 }
        max={ 100 }
        step={ 1 }
        disabled={ isUpdating }
        // Inset by half the handle so it stays inside the row at both ends
        sx={ { width: 'calc(100% - 24px)', mx: 1.5, display: 'block' } }
      />
    </Box>
  );
}
