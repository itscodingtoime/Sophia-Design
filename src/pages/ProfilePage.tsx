import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { toast } from 'sonner';

import { C, useThemeMode } from '../theme';
import { Avatar, InfoTransparency } from '../components/shared';
import {
  getProfile,
  updatePreference,
  updateRole,
  getConsentStatus,
  revokeConsent,
  grantConsent,
  getCalibration,
  updateCalibration,
  type ConsentStatus,
  type CalibrationResponse,
} from '../services/coach';
import { getVoiceprintStatus } from '../services/api';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import VoiceprintEnrolment from '../components/VoiceprintEnrolment';
import { VoiceprintQualityBadge } from '../components/VoiceprintQualityBadge';

// ─── Inline sub-components ───

const MicIcon = ({ size = 20, color }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || C.textDim} strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const Toggle = ({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) => (
  <div
    onClick={disabled ? undefined : onToggle}
    style={{
      width: 48, height: 26, borderRadius: 13, cursor: disabled ? 'not-allowed' : 'pointer',
      background: on ? C.teal : C.hoverBg, position: 'relative',
      transition: 'background 0.25s', border: `1px solid ${on ? C.teal : C.border}`,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <div style={{
      width: 20, height: 20, borderRadius: '50%', background: on ? C.bg : C.text,
      position: 'absolute', top: 2, left: on ? 25 : 3, transition: 'left 0.25s',
    }} />
  </div>
);

// ─── Main Component ───

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { mode, toggle: toggleTheme } = useThemeMode();

  // ─── Local state ───
  const [coachingOn, setCoachingOn] = useState(true);
  const [notifOn, setNotifOn] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [proactiveEnabled, setProactiveEnabled] = useState<boolean>(true);
  const [proactiveSaving, setProactiveSaving] = useState<boolean>(false);

  // ─── Role state ───
  const [roleTitle, setRoleTitle] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleEditing, setRoleEditing] = useState(false);
  const [roleTitleDraft, setRoleTitleDraft] = useState('');
  const [roleDescDraft, setRoleDescDraft] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  // ─── Voiceprint state ───
  const [vpEnrolled, setVpEnrolled] = useState(false);
  const [vpEnrolledAt, setVpEnrolledAt] = useState<string | null>(null);
  const [vpLoading, setVpLoading] = useState(true);
  const { getApiToken } = useSophiaAuth();

  // ─── Coaching Style state (Phase 20) ───
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
  const [consentInfo, setConsentInfo] = useState<ConsentStatus | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [memoryDowngradeWarning, setMemoryDowngradeWarning] = useState<string | null>(null);
  const [pendingMemoryLevel, setPendingMemoryLevel] = useState<string | null>(null);
  const calibrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User' : 'User';
  const email = user?.emailAddresses?.[0]?.emailAddress || '';

  // Avatar handled by Clerk user.imageUrl

  // ─── Load notification preferences from localStorage ───
  useEffect(() => {
    try {
      const storedEmail = localStorage.getItem('sophia_notif_email');
      const storedPush = localStorage.getItem('sophia_notif_push');
      const storedReminders = localStorage.getItem('sophia_notif_reminders');
      if (storedEmail !== null) setEmailNotif(storedEmail === 'true');
      if (storedPush !== null) setNotifOn(storedPush === 'true');
      if (storedReminders !== null) setMeetingReminders(storedReminders === 'true');
    } catch {
      // localStorage unavailable
    }
  }, []);

  // ─── Load coaching preferences from coach profile ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        const prefs = profile.preferences?.custom_preferences as Record<string, boolean> | undefined;
        if (prefs) {
          if (typeof prefs.insights_after_meetings === 'boolean') setCoachingOn(prefs.insights_after_meetings);
          if (typeof prefs.notifications === 'boolean') setNotifOn(prefs.notifications);
        }
        // Phase 21: sync proactive toggle from preferences_json.proactive_enabled
        if (typeof (profile.preferences as any)?.proactive_enabled === 'boolean') {
          setProactiveEnabled((profile.preferences as any).proactive_enabled);
        }
        // Load role data from profile (maps to profile_json on backend)
        const pj = profile.profile as Record<string, string> | undefined;
        if (pj) {
          setRoleTitle(pj.role_title || '');
          setRoleDesc(pj.role_description || '');
        }
      } catch {
        // Profile may not exist yet
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load voiceprint status ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        const status = await getVoiceprintStatus(token);
        if (!cancelled) {
          setVpEnrolled(status.enrolled);
          setVpEnrolledAt(status.enrolled_at);
        }
      } catch {
        // API may not be available yet
      } finally {
        if (!cancelled) setVpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getApiToken]);

  // ─── Load coaching consent + calibration (Phase 20) ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getConsentStatus();
        if (!cancelled) setConsentInfo(status);
      } catch {
        // Consent endpoint may not exist yet
      }
      try {
        const cal = await getCalibration();
        if (!cancelled) setCalibration(cal);
      } catch {
        // Calibration endpoint may not exist yet
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshVoiceprintStatus = useCallback(async () => {
    try {
      const token = await getApiToken();
      const status = await getVoiceprintStatus(token);
      setVpEnrolled(status.enrolled);
      setVpEnrolledAt(status.enrolled_at);
    } catch {
      // Silently ignore
    }
  }, [getApiToken]);

  // ─── Handlers ───

  const handleToggleCoaching = async () => {
    const newVal = !coachingOn;
    setCoachingOn(newVal);
    try {
      await updatePreference('insights_after_meetings', newVal, 'global');
      toast.success(newVal ? 'Coaching insights enabled' : 'Coaching insights disabled');
    } catch (err) {
      console.error('Failed to save preference:', err);
      setCoachingOn(!newVal);
      toast.error('Failed to save preference');
    }
  };

  const handleToggleProactive = useCallback(async () => {
    if (proactiveSaving) return;
    const next = !proactiveEnabled;
    setProactiveSaving(true);
    try {
      await updatePreference('proactive_enabled', next);
      setProactiveEnabled(next);
    } catch (err) {
      console.error('Failed to update proactive toggle:', err);
    } finally {
      setProactiveSaving(false);
    }
  }, [proactiveEnabled, proactiveSaving]);

  const handleToggleNotif = async () => {
    const newVal = !notifOn;
    setNotifOn(newVal);
    try {
      await updatePreference('notifications', newVal, 'global');
      toast.success(newVal ? 'Notifications enabled' : 'Notifications disabled');
    } catch (err) {
      console.error('Failed to save preference:', err);
      setNotifOn(!newVal);
      toast.error('Failed to save preference');
    }
  };

  const handleToggleEmailNotif = () => {
    const newVal = !emailNotif;
    setEmailNotif(newVal);
    try { localStorage.setItem('sophia_notif_email', String(newVal)); } catch { /* noop */ }
    toast.success(newVal ? 'Email notifications enabled' : 'Email notifications disabled');
  };

  const handleToggleMeetingReminders = () => {
    const newVal = !meetingReminders;
    setMeetingReminders(newVal);
    try { localStorage.setItem('sophia_notif_reminders', String(newVal)); } catch { /* noop */ }
    toast.success(newVal ? 'Meeting reminders enabled' : 'Meeting reminders disabled');
  };

  const handleRoleSave = async () => {
    setRoleSaving(true);
    try {
      await updateRole(roleTitleDraft, roleDescDraft);
      setRoleTitle(roleTitleDraft);
      setRoleDesc(roleDescDraft);
      setRoleEditing(false);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role -- try again');
    } finally {
      setRoleSaving(false);
    }
  };

  // ─── Coaching Style handlers (Phase 20) ───
  const MEMORY_LEVELS = ['session_only', 'commitments', 'commitments_preferences', 'full'];

  const handleCalibrationChange = (field: string, value: string) => {
    // Memory level downgrade check
    if (field === 'memory_level' && calibration) {
      const currentIdx = MEMORY_LEVELS.indexOf(calibration.memory_level);
      const newIdx = MEMORY_LEVELS.indexOf(value);
      if (newIdx < currentIdx) {
        setMemoryDowngradeWarning(value);
        setPendingMemoryLevel(value);
        return;
      }
    }

    // Optimistic update
    setCalibration(prev => prev ? { ...prev, [field]: value } : prev);

    // Debounced API call
    if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
    calibrationTimerRef.current = setTimeout(async () => {
      try {
        const result = await updateCalibration({ [field]: value });
        setCalibration(result);
        toast.success('Coaching style updated');
      } catch {
        toast.error('Failed to update coaching style');
      }
    }, 300);
  };

  const confirmMemoryDowngrade = async () => {
    if (!pendingMemoryLevel) return;
    setCalibration(prev => prev ? { ...prev, memory_level: pendingMemoryLevel as any } : prev);
    setMemoryDowngradeWarning(null);
    setPendingMemoryLevel(null);

    if (calibrationTimerRef.current) clearTimeout(calibrationTimerRef.current);
    try {
      const result = await updateCalibration({ memory_level: pendingMemoryLevel as any });
      setCalibration(result);
      toast.success('Coaching style updated');
    } catch {
      toast.error('Failed to update coaching style');
    }
  };

  const cancelMemoryDowngrade = () => {
    setMemoryDowngradeWarning(null);
    setPendingMemoryLevel(null);
  };

  const handleRevokeConsent = async () => {
    try {
      const result = await revokeConsent();
      setConsentInfo(result);
      setShowRevokeConfirm(false);
      toast.success('Coaching consent revoked');
    } catch {
      toast.error('Failed to revoke consent');
    }
  };

  const handleGrantConsent = async () => {
    try {
      const result = await grantConsent();
      setConsentInfo(result);
      toast.success('Coaching consent granted');
    } catch {
      toast.error('Failed to grant consent');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // ─── Loading state ───
  if (profileLoading && !user) {
    return (
      <div style={{ width: '100%', overflowY: 'auto', flex: 1 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px' }}>
          <div style={{ background: C.card, borderRadius: 18, padding: 28, border: `1px solid ${C.border}` }}>
            {[200, 160, 120].map((w, i) => (
              <div key={i} style={{ height: 16, width: w, background: C.hoverBg, borderRadius: 8, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowY: 'auto', flex: 1 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px' }}>

      {/* ── Section 1: User Profile ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.teal}, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <Avatar name={name} size={80} />
            )}
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>{name}</div>
              <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>{email}</div>
              {/* Role title display / editor toggle */}
              {!roleEditing ? (
                <div
                  onClick={() => {
                    setRoleTitleDraft(roleTitle);
                    setRoleDescDraft(roleDesc);
                    setRoleEditing(true);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRoleTitleDraft(roleTitle); setRoleDescDraft(roleDesc); setRoleEditing(true); } }}
                  style={{ cursor: 'pointer', marginTop: 4 }}
                >
                  {roleTitle ? (
                    <div style={{ fontSize: 12, color: C.tealMuted, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif" }}>
                      {roleTitle}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: C.textDim, opacity: 0.5, fontFamily: "'Tomorrow', sans-serif" }}>
                      + Add your role
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <button onClick={() => openUserProfile()} style={{
            padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${C.tealBorder}`,
            color: C.teal, fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif", transition: 'all 0.2s',
          }}>
            Edit Profile
          </button>
        </div>
        {/* Inline role editor */}
        {roleEditing && (
          <div style={{ marginTop: 16, overflow: 'hidden', transition: 'max-height 200ms ease-out' }}>
            <div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={roleTitleDraft}
                  onChange={e => setRoleTitleDraft(e.target.value.slice(0, 60))}
                  placeholder="Your role title (e.g. Product Manager)"
                  maxLength={60}
                  aria-label="Role title"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontWeight: 400,
                    fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                />
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.textDim }}>
                  {roleTitleDraft.length}/60
                </div>
              </div>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <textarea
                  value={roleDescDraft}
                  onChange={e => setRoleDescDraft(e.target.value.slice(0, 250))}
                  placeholder="Brief description of what you do"
                  maxLength={250}
                  rows={2}
                  aria-label="Role description"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: C.inputBg || C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontWeight: 400, resize: 'none' as const,
                    fontFamily: "'Tomorrow', sans-serif", outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.tealBorder; }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
                />
                <div style={{ position: 'absolute', right: 14, bottom: 10, fontSize: 10, color: C.textDim }}>
                  {roleDescDraft.length}/250
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setRoleEditing(false)}
                  style={{
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.textDim, fontSize: 12, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  Discard Changes
                </button>
                <button
                  onClick={handleRoleSave}
                  disabled={roleSaving}
                  style={{
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                    background: C.teal, border: 'none',
                    color: '#0A0A0C', fontSize: 12, fontWeight: 600,
                    fontFamily: "'Tomorrow', sans-serif",
                    opacity: roleSaving ? 0.6 : 1,
                  }}
                >
                  {roleTitle ? 'Update Role' : 'Save Role'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Coaching Preferences ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: '1px solid rgba(255,255,255,0.04)', marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Coaching Preferences</div>
        {[
          { label: 'Insights after meetings', desc: 'SOPHIA will offer reflections after each meeting', on: coachingOn, toggle: handleToggleCoaching },
        ].map((pref, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{pref.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{pref.desc}</div>
            </div>
            <Toggle on={pref.on} onToggle={pref.toggle} />
          </div>
        ))}
        {/* Phase 21: Proactive coaching toggle */}
        {(() => {
          const isProactiveDisabled = calibration?.memory_level === 'session_only';
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 0 14px 0',
                opacity: isProactiveDisabled ? 0.6 : 1,
                cursor: isProactiveDisabled ? 'not-allowed' : 'default',
                borderTop: `1px solid ${C.border}`,
                marginTop: 4,
              }}
            >
              <div style={{ maxWidth: '70%' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: isProactiveDisabled ? C.textDim : C.text,
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  Let SOPHIA reach out proactively
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: isProactiveDisabled ? C.textDim : C.textSec,
                    marginTop: 4,
                    lineHeight: 1.5,
                    fontFamily: "'Tomorrow', sans-serif",
                  }}
                >
                  {isProactiveDisabled
                    ? `Available once you turn on memory in Coaching Style above. SOPHIA can only reach out if she's allowed to remember between sessions.`
                    : `When enabled, SOPHIA may open a session with commitments, prep briefs, or patterns she's been sitting with. You'll see them as her first message \u2014 nothing pops up.`}
                </div>
              </div>
              <Toggle
                on={!isProactiveDisabled && proactiveEnabled}
                onToggle={isProactiveDisabled ? () => {} : handleToggleProactive}
              />
            </div>
          );
        })()}
      </div>

      {/* ── Section 3: Coaching Style (Phase 20) ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 32,
        border: `1px solid ${C.border}`, marginBottom: 24,
      }}>
        <h3 style={{
          fontFamily: "'Josefin Sans', sans-serif", fontSize: 16, fontWeight: 600,
          color: C.text, margin: 0, marginBottom: 4,
        }}>
          Coaching Style
        </h3>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 24 }}>
          How SOPHIA adapts to you
        </div>

        {/* Directness dropdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>Directness</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>How direct feedback should be</div>
          </div>
          <select
            value={calibration?.directness || 'balanced'}
            onChange={e => handleCalibrationChange('directness', e.target.value)}
            style={{
              background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '12px 16px', fontSize: 13, color: C.text, width: 220,
              fontFamily: "'Tomorrow', sans-serif", outline: 'none', cursor: 'pointer',
              appearance: 'auto' as any,
            }}
          >
            <option value="gentle">Gentle</option>
            <option value="balanced">Balanced</option>
            <option value="direct">Direct</option>
          </select>
        </div>

        {/* Accountability dropdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>Accountability</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>How SOPHIA follows up on actions</div>
          </div>
          <select
            value={calibration?.accountability || 'friendly'}
            onChange={e => handleCalibrationChange('accountability', e.target.value)}
            style={{
              background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '12px 16px', fontSize: 13, color: C.text, width: 220,
              fontFamily: "'Tomorrow', sans-serif", outline: 'none', cursor: 'pointer',
              appearance: 'auto' as any,
            }}
          >
            <option value="strict">Check in regularly</option>
            <option value="friendly">Friendly reminders</option>
            <option value="on_request">Only when you ask</option>
          </select>
        </div>

        {/* Memory Level dropdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, color: C.text, fontFamily: "'Tomorrow', sans-serif" }}>Memory Level</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>What SOPHIA remembers between sessions</div>
          </div>
          <select
            value={calibration?.memory_level || 'commitments'}
            onChange={e => handleCalibrationChange('memory_level', e.target.value)}
            style={{
              background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '12px 16px', fontSize: 13, color: C.text, width: 220,
              fontFamily: "'Tomorrow', sans-serif", outline: 'none', cursor: 'pointer',
              appearance: 'auto' as any,
            }}
          >
            <option value="session_only">This session only</option>
            <option value="commitments">My commitments</option>
            <option value="commitments_preferences">Commitments + preferences</option>
            <option value="full">Everything</option>
          </select>
        </div>

        {/* Memory level downgrade warning */}
        {memoryDowngradeWarning && (
          <div style={{
            background: 'rgba(212, 163, 74, 0.06)', border: '1px solid rgba(212, 163, 74, 0.15)',
            borderRadius: 12, padding: '12px 16px', marginTop: 8,
          }}>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: C.amber, marginBottom: 12 }}>
              Reducing memory level will hide stored data above this level. Data is kept for 30 days before permanent deletion.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmMemoryDowngrade}
                style={{
                  background: 'transparent', border: `1px solid ${C.amber}`, color: C.amber,
                  fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '8px 16px',
                  cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Confirm Change
              </button>
              <button
                onClick={cancelMemoryDowngrade}
                style={{
                  background: 'transparent', border: 'none', color: C.textDim,
                  fontSize: 12, fontWeight: 400, borderRadius: 10, padding: '8px 16px',
                  cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                }}
              >
                Keep Current
              </button>
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${C.border}`, margin: '24px 0' }} />

        {/* Consent status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: consentInfo?.consented ? '#34D399' : C.amber,
            boxShadow: consentInfo?.consented ? '0 0 6px rgba(52, 211, 153, 0.31)' : 'none',
          }} />
          <span style={{ fontSize: 13, color: C.textSec, fontFamily: "'Tomorrow', sans-serif" }}>
            {consentInfo?.consented
              ? `Coaching consent active since ${consentInfo.granted_at ? new Date(consentInfo.granted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown'}`
              : 'Coaching consent not granted'
            }
          </span>
        </div>

        {/* Revoke / Grant consent */}
        {consentInfo?.consented ? (
          <>
            {!showRevokeConfirm ? (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                style={{
                  background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                  fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '8px 16px',
                  cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif", marginTop: 4,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212, 90, 90, 0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Revoke Consent
              </button>
            ) : (
              <div style={{
                background: 'rgba(212, 90, 90, 0.06)', border: '1px solid rgba(212, 90, 90, 0.15)',
                borderRadius: 12, padding: '12px 16px', marginTop: 4,
              }}>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: C.textSec, marginBottom: 12 }}>
                  Revoke coaching consent? SOPHIA will stop coaching and your preferences will be hidden. You can re-enable anytime.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleRevokeConsent}
                    style={{
                      background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                      fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '8px 16px',
                      cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    Confirm Revoke
                  </button>
                  <button
                    onClick={() => setShowRevokeConfirm(false)}
                    style={{
                      background: 'transparent', border: 'none', color: C.textDim,
                      fontSize: 12, fontWeight: 400, borderRadius: 10, padding: '8px 16px',
                      cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={handleGrantConsent}
            style={{
              background: C.teal, border: 'none', color: '#0A0A0C',
              fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '8px 16px',
              cursor: 'pointer', fontFamily: "'Tomorrow', sans-serif", marginTop: 4,
            }}
          >
            Enable Coaching
          </button>
        )}
      </div>

      {/* ── Section 4: Voiceprint ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: `1px solid ${C.tealBorder}`, marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 20 }}>Voice Enrolment</div>
        {vpLoading ? (
          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: C.textDim, fontSize: 13 }}>Loading...</div>
          </div>
        ) : (
          <>
            <VoiceprintEnrolment
              isEnrolled={vpEnrolled}
              enrolledAt={vpEnrolledAt}
              onStatusChange={refreshVoiceprintStatus}
            />
            {vpEnrolled && (
              <div style={{ marginTop: 16 }}>
                <VoiceprintQualityBadge />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Section 5: Notification Preferences ── */}
      {/* TODO: Wire to backend notification preferences when endpoint exists */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: '1px solid rgba(255,255,255,0.04)', marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Notification Preferences</div>
        {[
          { label: 'Email notifications', desc: 'Receive coaching summaries via email', on: emailNotif, toggle: handleToggleEmailNotif },
          { label: 'Push notifications', desc: 'Get real-time alerts in the browser', on: notifOn, toggle: handleToggleNotif },
          { label: 'Meeting reminders', desc: 'Reminders before scheduled meetings', on: meetingReminders, toggle: handleToggleMeetingReminders },
        ].map((pref, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0',
            borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{pref.label}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{pref.desc}</div>
            </div>
            <Toggle on={pref.on} onToggle={pref.toggle} />
          </div>
        ))}
      </div>

      {/* ── Section 6: Transparency / About ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: '1px solid rgba(255,255,255,0.04)', marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Data Transparency</div>
        <InfoTransparency items={[
          { label: 'Your data is private', dest: 'You only' },
          { label: 'Individual scores visible only to you', dest: 'Private' },
          { label: 'Team scores are anonymised aggregations', dest: 'Team view' },
          { label: 'Voice prints cannot recreate your voice', dest: 'Encrypted' },
        ]} />
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textDim }}>SOPHIA v1.0 &middot; Last updated March 2026</div>
        </div>
      </div>

      {/* ── Section 7: Theme Toggle ── */}
      <div style={{
        background: C.card, backdropFilter: 'blur(20px) saturate(1.2)', borderRadius: 18, padding: 28,
        border: '1px solid rgba(255,255,255,0.04)', marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>Appearance</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Theme</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Currently using {mode} mode</div>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
              background: C.hoverBg, border: `1px solid ${C.tealBorder}`,
              color: C.teal, fontSize: 13, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif",
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {mode === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
            Switch to {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* ── Section 8: Sign Out ── */}
      <div style={{ padding: '24px 28px 32px' }}>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', padding: '12px 20px',
            background: 'rgba(212,90,90,0.08)',
            border: '1px solid rgba(212,90,90,0.2)',
            borderRadius: 12, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, color: '#D45A5A',
            fontFamily: "'Tomorrow', sans-serif",
            transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,90,90,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,90,90,0.08)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
      </div>
    </div>
  );
}
