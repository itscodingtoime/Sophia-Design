import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { EmptyStateCard } from '../EmptyStateCard';
import { C, useThemeMode } from '../../../theme';

export const NoTeamState: React.FC = () => {
  useThemeMode();
  const navigate = useNavigate();

  return (
    <EmptyStateCard
      icon={<Users size={48} />}
      title="No team selected"
      description="Create or join a team to get started"
      action={
        <button
          onClick={() => navigate('/teams')}
          className="px-4 py-2 rounded-lg transition hover-teal"
          style={{ background: C.teal, color: C.white }}
        >
          Go to Teams
        </button>
      }
    />
  );
};
