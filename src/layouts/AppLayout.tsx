import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useOrganizationList } from '@clerk/clerk-react';
import { toast } from 'sonner';

import { C, useThemeMode } from '../theme';
import { listSessions, deleteSession as apiDeleteSession, startSession, type CoachSession } from '../services/coach';
import AppSidebar, { toSidebarSessions } from './AppSidebar';
import { useIdleWarning } from '../hooks/useIdleWarning';

/**
 * AppLayout -- App shell replacing DashboardLayout.
 *
 * Renders the custom AppSidebar on the left and the page Outlet on the right.
 * Lifts session list state here so both sidebar and SophiaChat stay in sync
 * (prevents stale sidebar per RESEARCH pitfall 3).
 */
export default function AppLayout() {
  useThemeMode(); // subscribe to theme changes so C.* inline styles re-render
  // useIdleWarning(); // DISABLED — caused data loss during active recordings (BUG-46)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();

  // ─── Pending org invitations (BUG-59) ───
  const { userInvitations } = useOrganizationList({
    userInvitations: { infinite: true },
  });
  const pendingInvitations = userInvitations?.data?.filter(
    (inv: { status: string }) => inv.status === 'pending'
  ) || [];

  // ─── Session state (lifted) ───
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const currentSessionId = searchParams.get('session') || undefined;

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ─── Session callbacks ───
  const handleNewConversation = useCallback(async () => {
    try {
      const newSession = await startSession('sophia', 'coaching');
      await fetchSessions();
      navigate(`/chat?session=${newSession.id}`);
    } catch (err) {
      console.error('Failed to create new session:', err);
      navigate('/chat');
    }
  }, [navigate, fetchSessions]);

  const handleSelectSession = useCallback((id: string) => {
    navigate(`/chat?session=${id}`);
  }, [navigate]);

  const handleDeleteSession = useCallback(async (id: string) => {
    // Optimistic removal
    const removed = sessions.find(s => s.id === id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      navigate('/chat');
    }

    // Show undo toast -- delay actual API delete by 3s for undo
    const undoTimeout = setTimeout(async () => {
      try {
        await apiDeleteSession(id);
      } catch (err) {
        console.error('Failed to delete session:', err);
        if (removed) setSessions(prev => [...prev, removed]);
      }
    }, 3000);

    toast('Session deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(undoTimeout);
          if (removed) setSessions(prev => [...prev, removed].sort((a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          ));
        },
      },
      duration: 3000,
    });
  }, [sessions, currentSessionId, navigate]);

  // ─── User info (from Clerk directly, no backend call) ───
  const userName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User'
    : 'User';
  const userRole = 'Founder & CEO';

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      fontFamily: "'Tomorrow', sans-serif",
      background: C.bg, color: C.text,
      transition: "background 0.35s ease, color 0.35s ease",
    }}>
      <AppSidebar
        sessions={toSidebarSessions(sessions)}
        currentSessionId={currentSessionId}
        onNewConversation={handleNewConversation}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        userName={userName}
        userRole={userRole}
        userImageUrl={user?.imageUrl}
      />

      {/* Main content area */}
      <main style={{
        flex: 1, overflow: "auto", display: "flex", flexDirection: "column",
        position: "relative",
      }}>
        {/* Pending invitation banner (BUG-59) */}
        {pendingInvitations.length > 0 && (
          <div style={{
            margin: '12px 16px 0',
            padding: '12px 16px',
            borderRadius: 10,
            background: `${C.teal}10`,
            border: `1px solid ${C.tealBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ fontSize: 13, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>
              You have {pendingInvitations.length} pending team invitation{pendingInvitations.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pendingInvitations.map((inv: { id: string; accept: () => Promise<unknown>; publicOrganizationData?: { name?: string } }) => (
                <button
                  key={inv.id}
                  onClick={async () => {
                    try {
                      await inv.accept();
                      toast.success(`Joined ${inv.publicOrganizationData?.name || 'team'}`);
                    } catch {
                      toast.error('Failed to accept invitation');
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: C.teal,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  Join {inv.publicOrganizationData?.name || 'Team'}
                </button>
              ))}
            </div>
          </div>
        )}

        <Outlet context={{ refreshSessions: fetchSessions }} />
      </main>
    </div>
  );
}
