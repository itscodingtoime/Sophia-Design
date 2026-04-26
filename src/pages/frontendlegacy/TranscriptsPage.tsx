import AllTranscripts from '../components/files/AllTeamsView/AllTranscripts';
import { useOrganization } from '@clerk/clerk-react';
import TeamTranscripts from '../components/files/TeamView/TeamTranscripts';
import { C } from '../theme';

const TranscriptsPage = () => {
  const { organization } = useOrganization();
  return (
    <div className="max-w-6xl">
      {organization ? <TeamTranscripts /> : <AllTranscripts />}
    </div>
  );
};

export default TranscriptsPage;