import { useState, useEffect, useCallback } from 'react';
import { useOrganization, useClerk, useOrganizationList, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import {
  SpacesOverview,
  SpaceDetail,
  RainbowOrb,
  TrendDetailCard,
  STUDIOS, STUDIO_DATA, STUDIO_FEATURES,
  DIMENSION_LETTER_TO_KEY, KEY_TO_DIMENSION_LETTER,
  setStudios, setStudioData, setStudioFeatures,
  mapDimensionLettersToKeys,
} from '../components/culture-health';
import type { Studio, StudioDataEntry } from '../components/culture-health';
import { getTeamHealth, deleteTeam as deleteTeamApi, getTrendDetail, getTeamWeights, updateTeamWeights, getBatchVoiceprintStatus } from '../services/api';
import type { TrendMeetingDetail } from '../services/api';
import { updateRole, getTeamRoles } from '../services/coach';
import AddMemberModal from '../components/teams/AddMemberModal';
import MemberTable from '../components/teams/MemberTable';

export default function CultureHealth() {
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const { getApiToken, isLoaded, isSignedIn } = useSophiaAuth();
  const { organization, membership } = useOrganization();
  const { createOrganization, setActive } = useClerk();
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });

  // ─── State ───
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [healthLoaded, setHealthLoaded] = useState(false);
  const [showManageTeam, setShowManageTeam] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [showClerkCreateOrg, setShowClerkCreateOrg] = useState(false);

  // Phase 8.5: Trend detail card state
  const [trendDetailKey, setTrendDetailKey] = useState<string | null>(null);
  const [trendDetailData, setTrendDetailData] = useState<TrendMeetingDetail[] | null>(null);
  const [trendDetailLoading, setTrendDetailLoading] = useState(false);

  // Phase 8.8: Configurable scoring weights
  const [teamWeights, setTeamWeights] = useState<Record<string, number> | null>(null);
  const [weightUpdatedBy, setWeightUpdatedBy] = useState<string | null>(null);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const isAdmin = membership?.role === 'org:admin';

  // Per-team role state
  const [teamRoleData, setTeamRoleData] = useState<Record<string, { role_title: string; role_description: string }>>({});
  const [myTeamRoleTitle, setMyTeamRoleTitle] = useState('');
  const [myTeamRoleDesc, setMyTeamRoleDesc] = useState('');
  const [teamRoleEditing, setTeamRoleEditing] = useState(false);
  const [teamRoleTitleDraft, setTeamRoleTitleDraft] = useState('');
  const [teamRoleDescDraft, setTeamRoleDescDraft] = useState('');
  const [teamRoleSaving, setTeamRoleSaving] = useState(false);

  // Team name/description inline edit state
  const [teamNameEditing, setTeamNameEditing] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [teamDescEditing, setTeamDescEditing] = useState(false);
  const [teamDescDraft, setTeamDescDraft] = useState('');
  const [teamDescSaved, setTeamDescSaved] = useState('');
  const [teamMetaSaving, setTeamMetaSaving] = useState(false);

  // Local state tracking for re-renders (mutable module state won't trigger re-render)
  const [studios, setLocalStudios] = useState<Record<string, Studio>>(STUDIOS);
  const [studioData, setLocalStudioData] = useState<Record<string, StudioDataEntry>>(STUDIO_DATA);
  const [, setLocalStudioFeatures] = useState<Record<string, Record<string, number>>>(STUDIO_FEATURES);

  // ─── Build studios from Clerk org memberships (no backend needed) ───
  useEffect(() => {
    if (!userMemberships?.data) return;
    let cancelled = false;

    const orbPresets = [
      { primary: 20, secondary: 280, accent: 40 },
      { primary: 210, secondary: 45, accent: 170 },
      { primary: 270, secondary: 350, accent: 170 },
      { primary: 140, secondary: 30, accent: 200 },
      { primary: 320, secondary: 60, accent: 180 },
    ];
    // Deterministic orb color from org ID hash so colors survive reordering/renames
    const hashOrbPreset = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
      return orbPresets[Math.abs(h) % orbPresets.length];
    };

    const orgs = userMemberships.data;
    const newStudios: Record<string, Studio> = {};
    const newStudioData: Record<string, StudioDataEntry> = {};

    orgs.forEach((mem) => {
      const org = mem.organization;
      const orgId = org.id;
      const count = org.membersCount ?? 0;
      newStudios[orgId] = {
        id: orgId,
        name: org.name,
        description: `${count} member${count !== 1 ? 's' : ''}`,
        members: [{ name: `${count} member${count !== 1 ? 's' : ''}`, role: '' }],
        warmth: 0.25,
        trend: 'flat',
        orbColors: hashOrbPreset(orgId),
        latestObs: 'Upload a meeting to start tracking culture health',
        lastMeeting: 'No meetings yet',
      };
      newStudioData[orgId] = { weeks: [], months: [], quarters: [] };
    });

    if (!cancelled) {
      setStudios(newStudios);
      setStudioData(newStudioData);
      setLocalStudios(newStudios);
      setLocalStudioData(newStudioData);
      setTeamsLoaded(true);
    }

    const newFeatures: Record<string, Record<string, number>> = {};

    // Enrich with backend health data (best-effort)
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        await Promise.all(orgs.map(async (mem) => {
          const orgId = mem.organization.id;
          try {
            const health = await getTeamHealth(orgId, token);
            if (cancelled) return;
            const warmth = health.warmth ?? 0;
            const direction = health.direction ?? 'flat';
            const latestObs = health.qualitative_observations || 'Upload a meeting to start tracking culture health';
            newStudios[orgId] = {
              ...newStudios[orgId],
              warmth,
              trend: direction,
              latestObs,
            };
            // Map features from health response (API returns letter keys A-J, gradient needs word keys)
            if (health.features && Object.keys(health.features).length > 0) {
              newFeatures[orgId] = mapDimensionLettersToKeys(health.features);
            }
          } catch { /* health unavailable -- keep defaults */ }
        }));
        if (!cancelled) {
          setStudios({ ...newStudios });
          setStudioData({ ...newStudioData });
          setLocalStudios({ ...newStudios });
          setLocalStudioData({ ...newStudioData });
          setStudioFeatures({ ...newFeatures });
          setLocalStudioFeatures({ ...newFeatures });
          setHealthLoaded(true);
        }
      } catch {
        /* backend unavailable -- still mark health as loaded to show orbs with defaults */
        if (!cancelled) setHealthLoaded(true);
      }

      // Enrich with org members from Clerk
      try {
        await Promise.all(orgs.map(async (mem) => {
          const orgId = mem.organization.id;
          try {
            const orgObj = mem.organization;
            const membershipsRes = await orgObj.getMemberships();
            const membersList = (membershipsRes.data || []).map((m: any) => ({
              name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || 'Team Member',
              role: m.role === 'org:admin' ? 'Admin' : 'Member',
              userId: m.publicUserData?.userId,
            }));
            const memberCount = membersList.length;
            newStudios[orgId] = {
              ...newStudios[orgId],
              members: membersList,
              description: `${memberCount} member${memberCount !== 1 ? 's' : ''}`,
            };
          } catch { /* member fetch failed for this org */ }
        }));
        if (!cancelled) {
          setStudios({ ...newStudios });
          setLocalStudios({ ...newStudios });
        }
      } catch { /* member enrichment failed */ }

      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userMemberships?.data, getApiToken]);

  // ─── Fetch team weights when a team is selected ───
  useEffect(() => {
    if (!selectedStudioId) { setTeamWeights(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const resp = await getTeamWeights(selectedStudioId, token);
        if (cancelled) return;
        // Convert letter keys (A-J) to word keys (ownership, inquiry, ...)
        const wordWeights: Record<string, number> = {};
        for (const [letter, value] of Object.entries(resp.weights)) {
          const wordKey = DIMENSION_LETTER_TO_KEY[letter];
          if (wordKey) wordWeights[wordKey] = value;
        }
        setTeamWeights(wordWeights);
        setWeightUpdatedBy(resp.updated_by);
      } catch {
        // Default weights if API unavailable
        const defaultW: Record<string, number> = {};
        Object.values(DIMENSION_LETTER_TO_KEY).forEach(k => { defaultW[k] = 0.10; });
        if (!cancelled) setTeamWeights(defaultW);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStudioId, getApiToken, weightRefreshKey]);

  const handleSaveWeights = useCallback(async (wordWeights: Record<string, number>) => {
    if (!selectedStudioId) return;
    const token = await getApiToken();
    if (!token) return;
    const letterWeights: Record<string, number> = {};
    for (const [wordKey, value] of Object.entries(wordWeights)) {
      const letter = KEY_TO_DIMENSION_LETTER[wordKey];
      if (letter) letterWeights[letter] = value;
    }
    await updateTeamWeights(selectedStudioId, letterWeights, token);
    setTeamWeights(wordWeights);
    setWeightRefreshKey(prev => prev + 1);  // Triggers trend re-fetch in SpaceDetail
  }, [selectedStudioId, getApiToken]);

  // ─── Handlers ───
  const handleSelectStudio = (id: string) => {
    setSelectedStudioId(id);
    setShowManageTeam(false);
  };

  const handleClose = useCallback(() => {
    if (closing) return;  // Already closing
    setClosing(true);
    // If orb was never expanded to donut, onCollapseComplete won't fire from animation.
    // Use a timeout fallback to ensure cleanup always happens.
    setTimeout(() => {
      setSelectedStudioId(null);
      setClosing(false);
      setShowManageTeam(false);
      setTrendDetailKey(null);
      setTrendDetailData(null);
    }, 700);
  }, [closing]);

  const handleCollapseComplete = useCallback(() => {
    setSelectedStudioId(null);
    setClosing(false);
    setShowManageTeam(false);
    setTrendDetailKey(null);
    setTrendDetailData(null);
  }, []);

  const handleTrendClick = async (periodKey: string) => {
    if (!selectedStudioId) return;
    setTrendDetailKey(periodKey);
    setTrendDetailLoading(true);
    try {
      const token = await getApiToken();
      if (!token) return;
      const data = await getTrendDetail(selectedStudioId, periodKey, token);
      setTrendDetailData(data.meetings);
    } catch (err) {
      console.error('Failed to load trend detail:', err);
      setTrendDetailData([]);
    } finally {
      setTrendDetailLoading(false);
    }
  };

  const allStudios = Object.values(studios);
  const hasTeams = allStudios.length > 0;

  // ─── Create team state ───
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // ─── Clerk membership data for MemberTable ───
  const [memberships, setMemberships] = useState<any[]>([]);
  useEffect(() => {
    if (!organization) return;
    organization.getMemberships().then(res => setMemberships(res.data || [])).catch(() => {});
  }, [organization]);

  // ─── Voiceprint enrollment status for team members ───
  const [memberVoiceprintStatus, setMemberVoiceprintStatus] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (memberships.length === 0) return;
    const userIds = memberships
      .map((m: any) => m.publicUserData?.userId)
      .filter(Boolean) as string[];
    if (userIds.length === 0) return;
    getApiToken().then(token => {
      if (!token) return;
      getBatchVoiceprintStatus(userIds, token)
        .then(setMemberVoiceprintStatus)
        .catch(() => {});
    });
  }, [memberships, getApiToken]);
  const { user: clerkUser } = useUser();
  const currentUserId = clerkUser?.id || membership?.publicUserData?.userId;

  // ─── Fetch team roles when a team is selected ───
  useEffect(() => {
    if (!selectedStudioId || !memberships.length) return;
    const userIds = memberships
      .map((m: any) => m.publicUserData?.userId)
      .filter(Boolean);
    if (!userIds.length) return;

    getTeamRoles(selectedStudioId, userIds)
      .then(roles => {
        setTeamRoleData(roles);
        const myRole = roles[currentUserId || ''];
        if (myRole) {
          setMyTeamRoleTitle(myRole.role_title);
          setMyTeamRoleDesc(myRole.role_description || '');
        } else {
          setMyTeamRoleTitle('');
          setMyTeamRoleDesc('');
        }
      })
      .catch(() => { /* silently fail -- roles are non-critical */ });
  }, [selectedStudioId, memberships, currentUserId]);

  // ─── Fetch team description when a team is selected ───
  useEffect(() => {
    if (!selectedStudioId) { setTeamDescSaved(''); return; }
    (async () => {
      try {
        const token = await getApiToken();
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/teams/${selectedStudioId}/description`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTeamDescSaved(data.description || '');
        }
      } catch { /* non-critical */ }
    })();
  }, [selectedStudioId, getApiToken]);

  // ─── Enrich studio members with roleTitle from teamRoleData ───
  useEffect(() => {
    if (!selectedStudioId || !Object.keys(teamRoleData).length) return;
    const studio = studios[selectedStudioId];
    if (!studio) return;
    // Only enrich if we have real members (not the synthetic "N members" placeholder)
    if (studio.members.length === 1 && studio.members[0].name.includes('member')) return;
    const enriched = studio.members.map(m => {
      // Match by name to find the userId from memberships, then look up roleTitle
      const match = memberships.find((mem: any) => {
        const fullName = [mem.publicUserData?.firstName, mem.publicUserData?.lastName].filter(Boolean).join(' ');
        return fullName === m.name;
      });
      const userId = match?.publicUserData?.userId;
      const roleTitle = userId ? teamRoleData[userId]?.role_title : undefined;
      return { ...m, roleTitle: roleTitle || m.roleTitle };
    });
    const updated = { ...studios, [selectedStudioId]: { ...studio, members: enriched } };
    setStudios(updated);
    setLocalStudios(updated);
  }, [teamRoleData, selectedStudioId]);

  // ─── Team role save handler ───
  const handleTeamRoleSave = async () => {
    if (!selectedStudioId) return;
    setTeamRoleSaving(true);
    try {
      await updateRole(teamRoleTitleDraft, teamRoleDescDraft, selectedStudioId);
      setMyTeamRoleTitle(teamRoleTitleDraft);
      setMyTeamRoleDesc(teamRoleDescDraft);
      setTeamRoleEditing(false);
      toast.success('Role updated');
      // Refresh team roles to update displays
      const userIds = memberships.map((m: any) => m.publicUserData?.userId).filter(Boolean);
      if (userIds.length) {
        const roles = await getTeamRoles(selectedStudioId, userIds);
        setTeamRoleData(roles);
      }
    } catch {
      toast.error('Failed to update role -- try again');
    } finally {
      setTeamRoleSaving(false);
    }
  };

  // ─── Team name/description save handlers ───
  const getSelectedOrg = () => {
    const mem = userMemberships?.data?.find(m => m.organization.id === selectedStudioId);
    return mem?.organization ?? null;
  };

  const handleTeamNameSave = async () => {
    const org = getSelectedOrg();
    if (!org || !teamNameDraft.trim()) return;
    setTeamMetaSaving(true);
    try {
      await org.update({ name: teamNameDraft.trim() });
      await userMemberships?.revalidate?.();
      setTeamNameEditing(false);
      toast.success('Team name updated');
    } catch {
      toast.error('Failed to update team name');
    } finally {
      setTeamMetaSaving(false);
    }
  };

  const handleTeamDescSave = async () => {
    if (!selectedStudioId) return;
    setTeamMetaSaving(true);
    try {
      const token = await getApiToken();
      if (!token) throw new Error('No token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/teams/${selectedStudioId}/description`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: teamDescDraft.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setTeamDescSaved(teamDescDraft.trim());
      setTeamDescEditing(false);
      toast.success('Description updated');
    } catch {
      toast.error('Failed to update description');
    } finally {
      setTeamMetaSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organization) return;
    const isLeaving = userId === currentUserId;
    const msg = isLeaving ? 'Leave this team?' : 'Remove this member from the team?';
    if (!confirm(msg)) return;
    try {
      await organization.removeMember(userId);
      // Refresh membership list
      const res = await organization.getMemberships();
      setMemberships(res.data || []);
      await organization.reload();
      await userMemberships?.revalidate?.();
      toast.success(isLeaving ? 'You left the team' : 'Member removed');
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast.error('Failed to remove member. Please try again.');
    }
  };

  const handleCreateTeam = useCallback(async () => {
    if (!newTeamName.trim()) return;
    setIsCreatingTeam(true);
    try {
      const org = await createOrganization({ name: newTeamName.trim() });
      await setActive({ organization: org.id });
      await userMemberships?.revalidate?.();
      toast.success(`Team "${org.name}" created!`);
      setNewTeamName('');
      setShowCreateTeam(false);
    } catch (err) {
      console.error('Failed to create team:', err);
      toast.error('Failed to create team. Please try again.');
    } finally {
      setIsCreatingTeam(false);
    }
  }, [newTeamName, createOrganization, setActive, userMemberships]);

  const handleDeleteTeam = useCallback(async () => {
    if (!selectedStudioId) return;
    setIsDeletingTeam(true);
    try {
      // Delete backend data (meetings, scores, etc.)
      const token = await getApiToken();
      if (token) {
        await deleteTeamApi(selectedStudioId, token);
      }
      // Delete the Clerk organization
      const orgMem = userMemberships?.data?.find(m => m.organization.id === selectedStudioId);
      if (orgMem) {
        try {
          await orgMem.organization.destroy();
        } catch (err) {
          console.error('Failed to delete Clerk org (may require admin):', err);
        }
      }
      // Remove from local state
      const newStudios = { ...studios };
      delete newStudios[selectedStudioId];
      setStudios(newStudios);
      setLocalStudios(newStudios);
      toast.success(`Team deleted`);
      setConfirmDeleteTeam(false);
      handleClose();
      await userMemberships?.revalidate?.();
    } catch (err) {
      console.error('Failed to delete team:', err);
      toast.error('Failed to delete team. Please try again.');
    } finally {
      setIsDeletingTeam(false);
    }
  }, [selectedStudioId, getApiToken, studios, userMemberships, handleClose]);

  // ─── Skeleton loading cards ───
  const SkeletonCard = () => (
    <div style={{
      display: 'flex', alignItems: 'stretch', width: '100%',
      borderRadius: 20, background: C.card,
      border: `1px solid ${C.border}`, overflow: 'hidden',
      height: 140,
    }}>
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minWidth: 140 }}>
        <div style={{ width: 88, height: 88, borderRadius: '50%', background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 80, height: 12, borderRadius: 6, background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ width: 1, background: C.border, margin: '16px 0' }} />
      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <div style={{ width: '40%', height: 10, borderRadius: 5, background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '90%', height: 10, borderRadius: 5, background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '70%', height: 10, borderRadius: 5, background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ width: 1, background: C.border, margin: '16px 0' }} />
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 100 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.hoverBg, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>

      {/* ── Main area: overview dashboard or empty state ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        filter: (selectedStudioId || closing) ? (closing ? 'blur(0px)' : 'blur(4px)') : 'none',
        opacity: (selectedStudioId || closing) ? (closing ? 1 : 0.4) : 1,
        transition: 'filter 0.6s ease, opacity 0.6s ease',
        pointerEvents: (selectedStudioId || closing) ? 'none' : 'auto',
      }}>
        {isLoading && !hasTeams ? (
          /* ── Skeleton loading state ── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '36px 32px' }}>
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
              <div style={{ marginBottom: 32 }}>
                <div style={{ width: 160, height: 20, borderRadius: 8, background: C.hoverBg, marginBottom: 8 }} />
                <div style={{ width: 280, height: 12, borderRadius: 6, background: C.hoverBg }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
          </div>
        ) : teamsLoaded && !hasTeams ? (
          /* ── Empty state ── */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <RainbowOrb studioId="demo" warmth={0.5} size={96} />
              <div style={{ marginTop: 24, fontSize: 22, fontWeight: 500, color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>
                No teams yet
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: C.textDim, lineHeight: 1.6 }}>
                Create your first team to start tracking culture health and team dynamics across your organisation.
              </div>

              {!showCreateTeam ? (
                <button
                  onClick={() => setShowCreateTeam(true)}
                  style={{
                    marginTop: 24, padding: '14px 32px', borderRadius: 14,
                    background: C.teal, border: 'none', cursor: 'pointer',
                    color: '#0A0A0C', fontSize: 15, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif", transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${C.tealGlow}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Create your first team
                </button>
              ) : (
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newTeamName.trim()) handleCreateTeam(); }}
                    placeholder="Team name"
                    style={{
                      width: '100%', maxWidth: 320, padding: '12px 16px', borderRadius: 12,
                      background: C.inputBg, border: `1px solid ${C.tealBorder}`,
                      color: C.text, fontSize: 14, outline: 'none',
                      fontFamily: "'Tomorrow', sans-serif", boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleCreateTeam}
                      disabled={isCreatingTeam || !newTeamName.trim()}
                      style={{
                        padding: '10px 24px', borderRadius: 10,
                        background: newTeamName.trim() ? C.teal : C.border,
                        border: 'none', cursor: newTeamName.trim() ? 'pointer' : 'default',
                        color: newTeamName.trim() ? '#0A0A0C' : C.textDim,
                        fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                        opacity: isCreatingTeam ? 0.6 : 1,
                      }}
                    >
                      {isCreatingTeam ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => { setShowCreateTeam(false); setNewTeamName(''); }}
                      disabled={isCreatingTeam}
                      style={{
                        padding: '10px 24px', borderRadius: 10,
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.textDim, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Create Team button above overview */}
            <div style={{ padding: '16px 32px 0', maxWidth: 860, margin: '0 auto', width: '100%' }}>
              <button
                onClick={() => setShowClerkCreateOrg(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10,
                  background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                  color: C.teal, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                  transition: 'all 0.2s', marginBottom: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.activeBg; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.tealGlow; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Team
              </button>
            </div>
            <SpacesOverview
              studios={studios}
              studioData={studioData as any}
              onSelect={handleSelectStudio}
              healthLoaded={healthLoaded}
            />
          </div>
        )}
      </div>

      {/* ── Popout modal: SpaceDetail with settings gear for team management ── */}
      {(selectedStudioId || closing) && (
        <div
          onClick={handleClose}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
            zIndex: 55,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeSlide 0.25s ease',
            opacity: closing ? 0 : 1,
            transition: 'opacity 600ms ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(1080px, calc(100% - 48px))',
              maxHeight: 'calc(100% - 48px)',
              background: isDark ? C.bg : '#ffffff', borderRadius: 12,
              border: `1px solid ${C.border}`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
              overflowY: 'auto', overflowX: 'hidden',
              position: 'relative',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header buttons: settings gear + close */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              display: 'flex', gap: 6,
            }}>
              {/* Settings gear for team management */}
              <button
                onClick={() => setShowManageTeam(!showManageTeam)}
                title="Team settings"
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: showManageTeam ? C.activeBg : C.hoverBg, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.elevated; }}
                onMouseLeave={e => { e.currentTarget.style.background = showManageTeam ? C.activeBg : C.hoverBg; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showManageTeam ? C.teal : C.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={showManageTeam ? () => setShowManageTeam(false) : handleClose}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: C.hoverBg, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.elevated; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.hoverBg; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSec} strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {showManageTeam ? (
                /* ── Team Management Panel ── */
                <div style={{ padding: '32px 32px 32px', maxWidth: 780, margin: '0 auto' }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 500, color: C.text,
                      fontFamily: "'Josefin Sans', sans-serif", letterSpacing: 0.3,
                    }}>
                      Team Settings
                    </div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                      Manage members and settings for {selectedStudioId ? studios[selectedStudioId]?.name : 'this team'}
                    </div>
                  </div>

                  {/* Team Name (inline editable) */}
                  <div style={{
                    background: C.card, backdropFilter: 'blur(20px) saturate(1.2)',
                    borderRadius: 18, padding: 28, border: `1px solid ${C.border}`, marginBottom: 24,
                  }}>
                    <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>
                      TEAM NAME
                    </div>
                    {!teamNameEditing ? (
                      <div
                        onClick={() => { if (isAdmin) { setTeamNameDraft(getSelectedOrg()?.name || ''); setTeamNameEditing(true); } }}
                        style={{ cursor: isAdmin ? 'pointer' : 'default', fontSize: 15, fontWeight: 500, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}
                      >
                        {selectedStudioId ? studios[selectedStudioId]?.name : 'Team'}
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={teamNameDraft}
                          onChange={e => setTeamNameDraft(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                            color: C.text, fontSize: 13, fontFamily: "'Tomorrow', sans-serif",
                            outline: 'none', boxSizing: 'border-box' as const,
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setTeamNameEditing(false)} style={{
                            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                            background: 'transparent', border: `1px solid ${C.border}`,
                            color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                          }}>Discard Changes</button>
                          <button onClick={handleTeamNameSave} disabled={teamMetaSaving} style={{
                            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                            background: C.teal, border: 'none', color: '#0A0A0C',
                            fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                            opacity: teamMetaSaving ? 0.6 : 1,
                          }}>Save Name</button>
                        </div>
                      </div>
                    )}

                    {/* Team Description */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>
                        DESCRIPTION
                      </div>
                      {!teamDescEditing ? (
                        <div
                          onClick={() => { if (isAdmin) { setTeamDescDraft(teamDescSaved); setTeamDescEditing(true); } }}
                          style={{ cursor: isAdmin ? 'pointer' : 'default', fontSize: 13, color: teamDescSaved ? C.text : C.textDim, fontFamily: "'Tomorrow', sans-serif", opacity: teamDescSaved ? 1 : 0.5 }}
                        >
                          {teamDescSaved || (isAdmin ? '+ Add a team description' : 'No description set')}
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={teamDescDraft}
                            onChange={e => setTeamDescDraft(e.target.value)}
                            placeholder="What does this team do?"
                            rows={2}
                            autoFocus
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 10,
                              background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                              color: C.text, fontSize: 13, resize: 'none' as const,
                              fontFamily: "'Tomorrow', sans-serif", outline: 'none', boxSizing: 'border-box' as const,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <button onClick={() => setTeamDescEditing(false)} style={{
                              padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                              background: 'transparent', border: `1px solid ${C.border}`,
                              color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                            }}>Discard Changes</button>
                            <button onClick={handleTeamDescSave} disabled={teamMetaSaving} style={{
                              padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                              background: C.teal, border: 'none', color: '#0A0A0C',
                              fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                              opacity: teamMetaSaving ? 0.6 : 1,
                            }}>Save Description</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per-team role override */}
                  <div style={{
                    background: C.card, backdropFilter: 'blur(20px) saturate(1.2)',
                    borderRadius: 18, padding: 28, border: `1px solid ${C.border}`, marginBottom: 24,
                  }}>
                    <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>
                      YOUR ROLE IN {(selectedStudioId && studios[selectedStudioId]?.name ? studios[selectedStudioId].name : 'THIS TEAM').toUpperCase()}
                    </div>
                    {!teamRoleEditing ? (
                      <div
                        onClick={() => {
                          setTeamRoleTitleDraft(myTeamRoleTitle);
                          setTeamRoleDescDraft(myTeamRoleDesc);
                          setTeamRoleEditing(true);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamRoleTitleDraft(myTeamRoleTitle); setTeamRoleDescDraft(myTeamRoleDesc); setTeamRoleEditing(true); } }}
                        style={{ cursor: 'pointer' }}
                      >
                        {myTeamRoleTitle ? (
                          <div style={{ fontSize: 13, color: C.tealMuted, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif" }}>
                            {myTeamRoleTitle}
                            {myTeamRoleDesc && <div style={{ fontSize: 12, color: C.textDim, fontWeight: 400, marginTop: 4 }}>{myTeamRoleDesc}</div>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.textDim, opacity: 0.5, fontFamily: "'Tomorrow', sans-serif" }}>
                            + Set your role for this team
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={teamRoleTitleDraft}
                            onChange={e => setTeamRoleTitleDraft(e.target.value.slice(0, 60))}
                            placeholder="Your role title (e.g. Product Manager)"
                            maxLength={60}
                            aria-label="Role title"
                            autoFocus
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 10,
                              background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                              color: C.text, fontSize: 13, fontFamily: "'Tomorrow', sans-serif",
                              outline: 'none', boxSizing: 'border-box' as const,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                          />
                          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.textDim }}>
                            {teamRoleTitleDraft.length}/60
                          </div>
                        </div>
                        <div style={{ position: 'relative', marginTop: 8 }}>
                          <textarea
                            value={teamRoleDescDraft}
                            onChange={e => setTeamRoleDescDraft(e.target.value.slice(0, 250))}
                            placeholder="Brief description of what you do"
                            maxLength={250}
                            rows={2}
                            aria-label="Role description"
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 10,
                              background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                              color: C.text, fontSize: 13, resize: 'none' as const,
                              fontFamily: "'Tomorrow', sans-serif", outline: 'none', boxSizing: 'border-box' as const,
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                          />
                          <div style={{ position: 'absolute', right: 14, bottom: 10, fontSize: 10, color: C.textDim }}>
                            {teamRoleDescDraft.length}/250
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setTeamRoleEditing(false)} style={{
                            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                            background: 'transparent', border: `1px solid ${C.border}`,
                            color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                          }}>Discard Changes</button>
                          <button onClick={handleTeamRoleSave} disabled={teamRoleSaving} style={{
                            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                            background: C.teal, border: 'none', color: '#0A0A0C',
                            fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                            opacity: teamRoleSaving ? 0.6 : 1,
                          }}>{myTeamRoleTitle ? 'Update Role' : 'Save Role'}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Member button */}
                  <div style={{ marginBottom: 20 }}>
                    <button
                      onClick={() => setShowAddMember(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 10,
                        background: C.tealGlow, border: `1px solid ${C.tealBorder}`,
                        color: C.teal, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        fontFamily: "'Tomorrow', sans-serif",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.activeBg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.tealGlow; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Member
                    </button>
                  </div>

                  {/* Member Table */}
                  <div style={{
                    background: C.card, backdropFilter: 'blur(20px) saturate(1.2)',
                    borderRadius: 14, border: `1px solid ${C.border}`,
                    overflow: 'hidden',
                  }}>
                    {memberships.length > 0 ? (
                      <MemberTable
                        memberships={memberships as any}
                        currentUserId={currentUserId}
                        onRemove={handleRemoveMember}
                        roleData={teamRoleData}
                        voiceprintStatus={memberVoiceprintStatus}
                      />
                    ) : (
                      <div style={{
                        padding: '40px 24px', textAlign: 'center',
                        color: C.textDim, fontSize: 13,
                      }}>
                        {organization
                          ? 'No members found. Invite team members to get started.'
                          : 'Select an organization to manage team members.'}
                      </div>
                    )}
                  </div>

                  {/* Delete Team */}
                  <div style={{ marginTop: 32 }}>
                    {!confirmDeleteTeam ? (
                      <button
                        onClick={() => setConfirmDeleteTeam(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 20px', borderRadius: 10,
                          background: 'rgba(212,90,90,0.08)', border: '1px solid rgba(212,90,90,0.2)',
                          color: C.red, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,90,90,0.15)'; e.currentTarget.style.borderColor = 'rgba(212,90,90,0.35)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,90,90,0.08)'; e.currentTarget.style.borderColor = 'rgba(212,90,90,0.2)'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                        Delete Team
                      </button>
                    ) : (
                      <div style={{
                        padding: '16px', borderRadius: 12,
                        background: 'rgba(212,90,90,0.06)', border: '1px solid rgba(212,90,90,0.2)',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                          Delete {selectedStudioId ? studios[selectedStudioId]?.name : 'this team'}?
                        </div>
                        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 14 }}>
                          All meetings and data will be permanently removed. This cannot be undone.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={handleDeleteTeam}
                            disabled={isDeletingTeam}
                            style={{
                              flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                              background: C.red, border: 'none',
                              color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                              opacity: isDeletingTeam ? 0.6 : 1,
                            }}
                          >
                            {isDeletingTeam ? 'Deleting...' : 'Yes, delete permanently'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTeam(false)}
                            disabled={isDeletingTeam}
                            style={{
                              flex: 1, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                              background: 'transparent', border: `1px solid ${C.border}`,
                              color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (<>
                <SpaceDetail
                  studioId={selectedStudioId!}
                  voiceprintStatus={memberVoiceprintStatus}
                  onTrendClick={handleTrendClick}
                  selectedPeriodKey={trendDetailKey}
                  trendDetailSlot={
                    trendDetailLoading ? (
                      <div style={{ padding: '16px 0', textAlign: 'center', color: C.textDim, fontSize: 11 }}>
                        Loading period details...
                      </div>
                    ) : trendDetailKey && trendDetailData ? (
                      <TrendDetailCard
                        periodLabel={trendDetailKey}
                        meetings={trendDetailData}
                        onClose={() => { setTrendDetailKey(null); setTrendDetailData(null); }}
                      />
                    ) : null
                  }
                  teamWeights={teamWeights || undefined}
                  isAdmin={isAdmin}
                  weightUpdatedBy={weightUpdatedBy}
                  onSaveWeights={handleSaveWeights}
                  refreshKey={weightRefreshKey}
                  isClosing={closing}
                  onCollapseComplete={handleCollapseComplete}
                />
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* AddMemberModal */}
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onMemberAdded={async () => {
          if (organization) {
            const res = await organization.getMemberships();
            setMemberships(res.data || []);
          }
          await userMemberships?.revalidate?.();
        }}
      />

      {/* Create Team modal — custom form, no Clerk component */}
      {showClerkCreateOrg && (
        <div
          onClick={() => setShowClerkCreateOrg(false)}
          style={{
            position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
            zIndex: 9998, background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, margin: '0 16px',
              background: C.card, borderRadius: 16,
              border: `1px solid ${C.border}`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              padding: 24,
              animation: 'scaleIn 0.2s ease',
            }}
          >
            <h2 style={{
              fontSize: 18, fontWeight: 600, color: C.text,
              fontFamily: "'Josefin Sans', sans-serif", marginBottom: 16,
            }}>
              Create Team
            </h2>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.textDim, marginBottom: 6 }}>
              Team Name
            </label>
            <input
              type="text"
              placeholder="e.g. Product, Engineering, Sales"
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newTeamName.trim()) handleCreateTeam(); }}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: C.inputBg, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 14, fontFamily: "'Tomorrow', sans-serif",
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setShowClerkCreateOrg(false); setNewTeamName(''); }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.textDim, fontSize: 13, fontWeight: 500,
                  fontFamily: "'Tomorrow', sans-serif", cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim() || isCreatingTeam}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: newTeamName.trim() ? C.teal : C.border,
                  color: newTeamName.trim() ? '#fff' : C.textDim,
                  fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
                  cursor: newTeamName.trim() ? 'pointer' : 'not-allowed',
                  opacity: isCreatingTeam ? 0.6 : 1,
                }}
              >
                {isCreatingTeam ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
