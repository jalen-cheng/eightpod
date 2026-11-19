import { useServerInfo } from '@api/serverInfo.ts';
import StatusTag from './StatusTag.tsx';

// Whether SevenSleep is up to date, in two words
export default function VersionStatus() {
  const { data: serverInfo, isLoading, isError } = useServerInfo();
  if (isError || isLoading) return null;
  return serverInfo?.updateAvailable ? <StatusTag tone="info" label="Update available"/> : <StatusTag tone="good" label="Up to date"/>;
}
