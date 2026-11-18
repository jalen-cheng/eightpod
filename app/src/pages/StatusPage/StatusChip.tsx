import { StatusInfo, Status } from '@api/serverStatusSchema.ts';
import StatusTag, { StatusTone } from '@components/StatusTag.tsx';

const STATUS_LOOK: Record<Status, { tone: StatusTone; label: string }> = {
  not_started: { tone: 'neutral', label: 'Not started' },
  started: { tone: 'info', label: 'Started' },
  restarting: { tone: 'warning', label: 'Restarting' },
  retrying: { tone: 'warning', label: 'Retrying' },
  failed: { tone: 'bad', label: 'Failed' },
  healthy: { tone: 'good', label: 'Healthy' },
};

// How one service is doing
export default function StatusChip({ info }: { info: StatusInfo }) {
  const { tone, label } = STATUS_LOOK[info.status];
  return <StatusTag tone={ tone } label={ label }/>;
}
