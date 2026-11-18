import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import serverInfo from '../../../server/src/serverInfo.json';
import semver from 'semver';

export type ServerInfo = {
  version: string;
  branch: string;
  updateAvailable: boolean;
}

type LatestVersion = {
  version: string;
  branch: string;
}

// Where updates come from: this repository, the same place scripts/update.sh installs from by default
const LATEST_VERSION_URL = 'https://raw.githubusercontent.com/jalen-cheng/eightpod/main/server/src/serverInfo.json';

export const getLatestVersion = async () => {
  return axios.get<LatestVersion>(LATEST_VERSION_URL);
};


export const useServerInfo = () => useQuery<ServerInfo>({
  queryKey: ['useServerInfo'],
  queryFn: async () => {
    const response = await getLatestVersion();
    const updateAvailable = semver.gt(response.data.version, serverInfo.version);
    return {
      ...response.data,
      updateAvailable
    };
  },
  staleTime: 60_000,
});

