import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import MeetingIntelligence from '../components/MeetingIntelligence';
import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { useMeeting } from '../context/MeetingContext';
import { C } from '../theme';
import { SophiaPageHeader, EmptyStateCard, SectionCard } from '@/components/composition';
import { Skeleton } from '@/components/ui/skeleton';

// MeetingViewPage for displaying single live meeting and associated "MeetingIntelligence" component
// retrieve meeting id, org id and render the live meeting.

const MeetingViewPage = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgFromUrl = searchParams.get('org');
  const titleFromUrl = searchParams.get('title');
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { setActive } = useOrganizationList();
  const { clearMeetingData, selectedMeetingTitle } = useMeeting();
  const [orgSwitchDone, setOrgSwitchDone] = useState(false);
  // switch team context
  useEffect(() => {
    if (!orgFromUrl || !setActive || !orgLoaded) return;
    if (organization?.id === orgFromUrl) {
      setOrgSwitchDone(true);
      return;
    }
    setActive({ organization: orgFromUrl }).catch(() => setOrgSwitchDone(true));
  }, [orgFromUrl, organization?.id, setActive, orgLoaded]);

  useEffect(() => {
    if (!orgFromUrl) setOrgSwitchDone(true);
    else if (organization?.id === orgFromUrl) setOrgSwitchDone(true);
  }, [orgFromUrl, organization?.id]);

  const waitingForOrg = orgFromUrl && (!orgSwitchDone || organization?.id !== orgFromUrl);

  if (!orgLoaded || waitingForOrg) {
    return (
      <div className="max-w-6xl mx-auto">
        <SophiaPageHeader title="Loading..." />
        <SectionCard><Skeleton className="h-64 w-full" /></SectionCard>
      </div>
    );
  }

  if (!organization && !meetingId) {
    return (
      <div className="max-w-6xl mx-auto">
        <EmptyStateCard
          icon={<Users size={48} />}
          title="No team selected"
          description="Select a team to view meetings"
        />
      </div>
    );
  }

  const backButton = (
    <button
      type="button"
      onClick={() => {
        clearMeetingData();
        navigate('/meetings?tab=meetings');
      }}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover-bg"
      style={{ borderColor: C.border, background: C.card, color: C.text }}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SophiaPageHeader
        title={titleFromUrl || selectedMeetingTitle || 'Live Meeting'}
        actions={backButton}
      />
      <section id="live-meeting-recorder">
        <MeetingIntelligence initialMeetingId={meetingId ?? null} />
      </section>
    </div>
  );
};

export default MeetingViewPage;
