import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import MeetingIntelligence from '../components/MeetingIntelligence';
import FileUpload from '../components/files/FileUpload';
import FilesTab from './FilesTab';
import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { C } from '../theme';
import { SophiaPageHeader } from '../components/composition';

const MeetingsPage = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { setActive } = useOrganizationList();

  const activeTab = searchParams.get('tab') || 'meetings';
  const meetingIdFromUrl = searchParams.get('meetingId');
  const orgFromUrl = searchParams.get('org');

  // When ?org= is present (e.g. from Files "View" without UUID), switch team context
  useEffect(() => {
    if (!orgFromUrl || !setActive) return;
    if (organization?.id === orgFromUrl) return;
    setActive({ organization: orgFromUrl }).catch(console.error);
  }, [orgFromUrl, organization?.id, setActive]);

  // Redirect to dedicated view page when meetingId is in URL (include org so team context is set)
  useEffect(() => {
    if (!meetingIdFromUrl) return;
    const url = organization
      ? `/meetings/view/${meetingIdFromUrl}?org=${encodeURIComponent(organization.id)}`
      : `/meetings/view/${meetingIdFromUrl}`;
    navigate(url, { replace: true });
  }, [meetingIdFromUrl, organization?.id, navigate]);

  // Set default tab if not present
  useEffect(() => {
    if (organization && !searchParams.get('tab')) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'meetings');
        return next;
      }, { replace: true });
    }
  }, [organization, searchParams, setSearchParams]);

  // No organization: still show tabs; Meeting Intelligence needs a team, Files works for All Teams
  if (!organization) {
    return (
      <div className="space-y-6">
        <SophiaPageHeader title="Meetings" />
        <FilesTab />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
      <div className="max-w-6xl mx-auto space-y-6">
        <SophiaPageHeader
          title="Meetings"
          actions={
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors whitespace-nowrap hover-teal"
              style={{ background: C.teal, color: C.white }}
            >
              <Upload className="h-4 w-4" />
              Upload transcript
            </button>
          }
        />

        <TabsList>
          <TabsTrigger value="meetings"> Live Meetings </TabsTrigger>
          <TabsTrigger value="files"> Files</TabsTrigger>
        </TabsList>

        {/* Upload Modal portaled so overlay fills entire viewport */}
        {showUploadModal &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="w-full max-w-md mx-4">
                <FileUpload
                  onClose={() => setShowUploadModal(false)}
                  onSuccess={() => {
                    setShowUploadModal(false);
                  }}
                />
              </div>
            </div>,
            document.body
          )}

        <TabsContent value="meetings" className="mt-6">
          <section id="live-meeting-recorder">
            <MeetingIntelligence />
          </section>
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <FilesTab />
        </TabsContent>
      </div>
    </Tabs>
  );
};

export default MeetingsPage;
