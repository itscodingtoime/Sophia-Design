import { useOrganization } from '@clerk/clerk-react';
import TeamTranscripts from '../components/files/TeamView/TeamTranscripts';
import AllTranscripts from '../components/files/AllTeamsView/AllTranscripts';
import { C } from '../theme';

const FilesTab = () => {
  const { organization } = useOrganization();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {organization ? <TeamTranscripts /> : <AllTranscripts />}
    </div>
  );
};

export default FilesTab;

