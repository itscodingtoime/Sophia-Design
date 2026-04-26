import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, X, ShieldAlert } from 'lucide-react';
import { useOrganization, useOrganizationList, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import Button from '@/generic/Button';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { C, useThemeMode } from '../theme';
import { SectionCard, EmptyStateCard, NoTeamState } from '@/components/composition';
import MemberTable from '@/components/teams/MemberTable';

const TeamSettingsTab = () => {
  useThemeMode();
  const { user } = useUser();
  const { userProfile } = useCurrentUser();
  const { organization, memberships } = useOrganization({
    memberships: { infinite: true },
  });
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [, setSearchParams] = useSearchParams();

  // Inline editing state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);

  // Hover state for pencil icons
  const [hoveringName, setHoveringName] = useState(false);
  const [hoveringDesc, setHoveringDesc] = useState(false);

  useEffect(() => {
    if (organization) {
      setNameDraft(organization.name || '');
      setDescDraft((organization.publicMetadata as any)?.description || '');
    }
  }, [organization]);

  const canManageTeam = () => {
    const isSystemAdmin = userProfile?.role === 'admin' || user?.primaryEmailAddress?.emailAddress === 'oliverdubois10@gmail.com';
    const currentMembership = memberships?.data?.find(m => m.publicUserData?.userId === user?.id);
    const isTeamAdmin = currentMembership?.role === 'org:admin';
    return isSystemAdmin || isTeamAdmin;
  };

  const handleClose = () => setSearchParams({ tab: 'management' });

  const handleSaveName = async () => {
    if (!organization || !nameDraft.trim()) return;
    setSavingName(true);
    try {
      await organization.update({ name: nameDraft.trim() });
      toast.success('Team name updated');
      setEditingName(false);
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!organization) return;
    setSavingDesc(true);
    try {
      const existingMeta = (organization.publicMetadata || {}) as Record<string, unknown>;
      await organization.update({
        publicMetadata: { ...existingMeta, description: descDraft.trim() },
      });
      toast.success('Team description updated');
      setEditingDesc(false);
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setSavingDesc(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!organization) return;
    if (!confirm(`Delete "${organization.name}"? This cannot be undone.`)) return;

    try {
      await organization.destroy();
      if (userMemberships?.revalidate) await userMemberships.revalidate();
      if (setActive) await setActive({ organization: null });
      toast.success('Team deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team');
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!membershipId || !organization || !memberships) return;
    const confirmed = confirm('Are you sure you want to remove this member?');
    if (!confirmed) return;

    try {
      const membership = memberships.data?.find((m) => m.id === membershipId);
      if (membership) {
        await membership.destroy();
        await organization.reload();
        toast.success('Member removed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  if (!organization) {
    return <NoTeamState />;
  }

  if (!canManageTeam()) {
    return (
      <SectionCard>
        <EmptyStateCard
          icon={<ShieldAlert size={48} />}
          title="No permission"
          description="You don't have permission to manage team settings."
        />
      </SectionCard>
    );
  }

  const descriptionValue = (organization.publicMetadata as any)?.description || '';

  return (
    <div style={{
      background: C.card, backdropFilter: 'blur(20px) saturate(1.2)',
      borderRadius: 18, padding: 24, border: `1px solid ${C.border}`,
      position: 'relative',
    }}>
      {/* Close button */}
      <button onClick={handleClose} aria-label="Back to team" title="Back to team" style={{
        position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none',
        cursor: 'pointer', padding: 4,
      }}>
        <X size={20} style={{ color: C.textDim }} />
      </button>

      {/* TEAM DETAILS section */}
      <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>
        Team Details
      </div>

      {/* Team Name */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Team Name</div>
        {editingName ? (
          <div>
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameDraft(organization.name || ''); } }}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
                border: `1px solid ${C.tealBorder}`, background: C.inputBg, color: C.text,
                fontFamily: "'Tomorrow', sans-serif", outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleSaveName} disabled={savingName} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: C.teal, color: '#0A0A0C', border: 'none', cursor: 'pointer',
                fontFamily: "'Tomorrow', sans-serif", opacity: savingName ? 0.6 : 1,
              }}>{savingName ? 'Saving...' : 'Save Name'}</button>
              <button onClick={() => { setEditingName(false); setNameDraft(organization.name || ''); }} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim,
                cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
              }}>Discard</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingName(true)}
            onMouseEnter={() => setHoveringName(true)}
            onMouseLeave={() => setHoveringName(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28 }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>
              {organization.name}
            </span>
            <Pencil size={14} style={{ color: C.textDim, opacity: hoveringName ? 1 : 0, transition: 'opacity 0.15s' }} />
          </div>
        )}
      </div>

      {/* Team Description */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Team Description</div>
        {editingDesc ? (
          <div>
            <textarea
              autoFocus
              rows={3}
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setEditingDesc(false); setDescDraft(descriptionValue); } }}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
                border: `1px solid ${C.tealBorder}`, background: C.inputBg, color: C.text,
                fontFamily: "'Tomorrow', sans-serif", outline: 'none', resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleSaveDescription} disabled={savingDesc} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: C.teal, color: '#0A0A0C', border: 'none', cursor: 'pointer',
                fontFamily: "'Tomorrow', sans-serif", opacity: savingDesc ? 0.6 : 1,
              }}>{savingDesc ? 'Saving...' : 'Save Description'}</button>
              <button onClick={() => { setEditingDesc(false); setDescDraft(descriptionValue); }} style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim,
                cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
              }}>Discard</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingDesc(true)}
            onMouseEnter={() => setHoveringDesc(true)}
            onMouseLeave={() => setHoveringDesc(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 28 }}
          >
            <span style={{ fontSize: 14, color: descriptionValue ? C.text : C.textDim, fontFamily: "'Tomorrow', sans-serif" }}>
              {descriptionValue || 'No description'}
            </span>
            <Pencil size={14} style={{ color: C.textDim, opacity: hoveringDesc ? 1 : 0, transition: 'opacity 0.15s' }} />
          </div>
        )}
      </div>

      {/* MEMBERS section */}
      <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16, marginTop: 24 }}>
        Members
      </div>
      <MemberTable memberships={memberships?.data || []} currentUserId={user?.id} onRemove={handleRemoveMember} />

      {/* Delete Team */}
      {canManageTeam() && (
        <div style={{ marginTop: 32 }}>
          <Button onClick={handleDeleteTeam} className="bg-red-600 hover:bg-red-700 border-none text-white" style={{ borderRadius: 8 }}>
            Delete Team
          </Button>
        </div>
      )}
    </div>
  );
};

export default TeamSettingsTab;
