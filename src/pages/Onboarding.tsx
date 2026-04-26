/**
 * Onboarding -- Multi-step onboarding flow for new users.
 *
 * 5 steps:
 * 1. Profile: Pre-fill name/email/photo from Clerk, collect role/team_size/industry/key_goal
 * 2. Team: Create a Clerk org or skip
 * 3. Consent: 4 toggles calling POST /api/v1/users/consent
 * 4. Voiceprint: Embed VoiceprintEnrolment component
 * 5. Done: Submit profile via submitOnboarding() and navigate to /chat
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk, useOrganizationList } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { C, useThemeMode } from '../theme';
import { useSophiaAuth } from '../hooks/useSophiaAuth';
import VoiceprintEnrolment from '../components/VoiceprintEnrolment';
import { submitOnboarding } from '../services/coach';

// ─── Constants ───

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type OnboardingStep = 'profile' | 'team' | 'consent' | 'voiceprint' | 'done';

const STEPS: OnboardingStep[] = ['profile', 'team', 'consent', 'voiceprint', 'done'];

// ─── Toggle Component ───

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  useThemeMode();
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative inline-flex items-center shrink-0 cursor-pointer"
      style={{
        width: 44,
        height: 24,
        borderRadius: 9999,
        background: on ? C.teal : C.border,
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          background: on ? C.bg : C.text,
          transform: on ? 'translateX(22px)' : 'translateX(2px)',
          transition: 'transform 0.2s, background 0.2s',
          display: 'block',
        }}
      />
    </button>
  );
}

// ─── Main Component ───

export default function Onboarding() {
  useThemeMode();
  const navigate = useNavigate();
  const { user } = useUser();
  const { createOrganization, setActive } = useClerk();
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });
  const { getApiToken } = useSophiaAuth();

  // Step state
  const [step, setStep] = useState<OnboardingStep>('profile');

  // Profile data
  const [profileData, setProfileData] = useState({
    role: '',
    keyGoal: '',
  });

  // Team state
  const [teamName, setTeamName] = useState('');
  const [teamCreated, setTeamCreated] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Consent state (all default to true)
  const [consent, setConsent] = useState({
    recording: true,
    patterns: true,
    coaching: true,
    aggregation: true,
  });
  const [consentGranted, setConsentGranted] = useState(false);
  const [isPostingConsent, setIsPostingConsent] = useState(false);

  // Voiceprint state
  const [voiceprintDone, setVoiceprintDone] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Helpers ───

  const currentStepIndex = STEPS.indexOf(step);

  const profileComplete =
    profileData.role.trim() !== '' &&
    profileData.keyGoal.trim() !== '';

  const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const userAvatar = user?.imageUrl || '';

  const hasExistingOrg = (userMemberships?.data?.length ?? 0) > 0;
  const existingOrgName = userMemberships?.data?.[0]?.organization?.name || '';

  // ─── Handlers ───

  async function handleCreateTeam() {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }
    try {
      setIsCreatingTeam(true);
      const org = await createOrganization({ name: teamName.trim() });
      await setActive({ organization: org.id });
      await userMemberships?.revalidate?.();
      toast.success(`Team "${org.name}" created!`);
      setTeamCreated(true);
      setStep('consent');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create team');
    } finally {
      setIsCreatingTeam(false);
    }
  }

  async function handlePostConsent() {
    try {
      setIsPostingConsent(true);
      const token = await getApiToken();
      const res = await fetch(`${API_BASE}/api/v1/users/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(consent),
      });
      if (!res.ok) throw new Error('Failed to update consent');
      setConsentGranted(true);
      setStep('voiceprint');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save consent preferences');
    } finally {
      setIsPostingConsent(false);
    }
  }

  async function handleSubmit() {
    try {
      setIsSubmitting(true);
      await submitOnboarding({
        role: profileData.role,
        key_goal: profileData.keyGoal,
      });
      navigate('/chat');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Shared styles ───

  const cardStyle: React.CSSProperties = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 32,
    maxWidth: 512,
    width: '100%',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.inputBg,
    color: C.text,
    fontFamily: "'Tomorrow', sans-serif",
    fontSize: 14,
    outline: 'none',
  };

  const buttonPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 24px',
    borderRadius: 8,
    background: C.teal,
    color: '#fff',
    fontFamily: "'Tomorrow', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Josefin Sans', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: C.text,
    marginBottom: 8,
  };

  const subtextStyle: React.CSSProperties = {
    fontFamily: "'Tomorrow', sans-serif",
    fontSize: 14,
    color: C.textDim,
    marginBottom: 24,
    lineHeight: 1.6,
  };

  // ─── Progress dots ───

  function ProgressDots() {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i === currentStepIndex ? C.teal : C.border,
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    );
  }

  // ─── Step 1: Profile ───

  function ProfileStep() {
    return (
      <div style={cardStyle}>
        <h2 style={headingStyle}>Tell us about you</h2>
        <p style={subtextStyle}>Help Sophia understand your role and what you're working toward.</p>

        {/* Clerk pre-filled info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {userAvatar && (
            <img
              src={userAvatar}
              alt="Profile"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
            />
          )}
          <div>
            <div style={{ color: C.text, fontWeight: 600, fontFamily: "'Tomorrow', sans-serif", fontSize: 16 }}>
              {userName || 'User'}
            </div>
            <div style={{ color: C.textDim, fontFamily: "'Tomorrow', sans-serif", fontSize: 13 }}>
              {userEmail}
            </div>
          </div>
        </div>

        {/* Input fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 13, marginBottom: 6 }}>
              Your role or title
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. Engineering Manager"
              value={profileData.role}
              onChange={(e) => setProfileData((prev) => ({ ...prev, role: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 13, marginBottom: 6 }}>
              What are you working on or want to improve?
            </label>
            <textarea
              style={{ ...inputStyle, resize: 'none' }}
              rows={3}
              placeholder="e.g. Improving team psychological safety"
              value={profileData.keyGoal}
              onChange={(e) => setProfileData((prev) => ({ ...prev, keyGoal: e.target.value }))}
            />
          </div>
        </div>

        <button
          style={{
            ...buttonPrimaryStyle,
            marginTop: 24,
            opacity: profileComplete ? 1 : 0.5,
            cursor: profileComplete ? 'pointer' : 'not-allowed',
          }}
          disabled={!profileComplete}
          onClick={() => setStep('team')}
        >
          Continue Setup
        </button>
      </div>
    );
  }

  // ─── Step 2: Team ───

  function TeamStep() {
    // User already has an org
    if (hasExistingOrg) {
      return (
        <div style={cardStyle}>
          <h2 style={headingStyle}>Create or join a team</h2>
          <p style={subtextStyle}>Teams share meeting insights. You can skip this and join a team later.</p>

          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: C.tealDeep,
              border: `1px solid ${C.tealBorder}`,
              marginBottom: 24,
            }}
          >
            <div style={{ color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 14 }}>
              You're already part of a team
            </div>
            <div style={{ color: C.teal, fontFamily: "'Tomorrow', sans-serif", fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {existingOrgName}
            </div>
          </div>

          <button style={buttonPrimaryStyle} onClick={() => setStep('consent')}>
            Continue
          </button>
        </div>
      );
    }

    return (
      <div style={cardStyle}>
        <h2 style={headingStyle}>Create or join a team</h2>
        <p style={subtextStyle}>Teams share meeting insights. You can skip this and join a team later.</p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 13, marginBottom: 6 }}>
            Team name
          </label>
          <input
            style={inputStyle}
            placeholder="Enter your team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && teamName.trim() && !isCreatingTeam) {
                handleCreateTeam();
              }
            }}
          />
        </div>

        <button
          style={{
            ...buttonPrimaryStyle,
            opacity: teamName.trim() && !isCreatingTeam ? 1 : 0.5,
            cursor: teamName.trim() && !isCreatingTeam ? 'pointer' : 'not-allowed',
          }}
          disabled={!teamName.trim() || isCreatingTeam}
          onClick={handleCreateTeam}
        >
          {isCreatingTeam ? 'Creating...' : 'Create Team'}
        </button>

        <button
          type="button"
          onClick={() => setStep('consent')}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'none',
            border: 'none',
            color: C.textDim,
            fontFamily: "'Tomorrow', sans-serif",
            fontSize: 13,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Skip for now
        </button>
      </div>
    );
  }

  // ─── Step 3: Consent ───

  function ConsentStep() {
    const toggles: { key: keyof typeof consent; label: string }[] = [
      { key: 'recording', label: 'Recording consent' },
      { key: 'patterns', label: 'Meeting analysis' },
      { key: 'coaching', label: 'AI coaching' },
      { key: 'aggregation', label: 'Aggregated team data' },
    ];

    return (
      <div style={cardStyle}>
        <h2 style={headingStyle}>Privacy & Consent</h2>
        <p style={subtextStyle}>
          SOPHIA is here to support how your team works together, not to judge it. She observes meeting language to offer coaching, and your individual data is always private.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {toggles.map(({ key, label }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.text, fontFamily: "'Tomorrow', sans-serif", fontSize: 14 }}>
                {label}
              </span>
              <Toggle
                on={consent[key]}
                onToggle={() => setConsent((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
            </div>
          ))}
        </div>

        <button
          style={{
            ...buttonPrimaryStyle,
            marginTop: 24,
            opacity: isPostingConsent ? 0.5 : 1,
            cursor: isPostingConsent ? 'not-allowed' : 'pointer',
          }}
          disabled={isPostingConsent}
          onClick={handlePostConsent}
        >
          {isPostingConsent ? 'Saving...' : 'Continue'}
        </button>
      </div>
    );
  }

  // ─── Step 4: Voiceprint ───

  function VoiceprintStep() {
    return (
      <div style={cardStyle}>
        <h2 style={headingStyle}>Set up your voice</h2>
        <p style={subtextStyle}>
          Record a short sample so SOPHIA can identify you in meetings.
        </p>

        <VoiceprintEnrolment
          isEnrolled={false}
          enrolledAt={null}
          onStatusChange={() => {
            setVoiceprintDone(true);
            setStep('done');
          }}
        />

        <button
          type="button"
          onClick={() => setStep('done')}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'none',
            border: 'none',
            color: C.textDim,
            fontFamily: "'Tomorrow', sans-serif",
            fontSize: 13,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Skip for now
        </button>
      </div>
    );
  }

  // ─── Step 5: Done ───

  function DoneStep() {
    return (
      <div style={cardStyle}>
        <h2 style={{ ...headingStyle, color: C.teal }}>You're all set!</h2>
        <p style={{ ...subtextStyle, color: C.text }}>
          SOPHIA is ready to coach you.
        </p>

        <button
          style={{
            ...buttonPrimaryStyle,
            opacity: isSubmitting ? 0.5 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Setting up...' : 'Start chatting'}
        </button>
      </div>
    );
  }

  // ─── Render ───

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: C.bg,
        fontFamily: "'Tomorrow', sans-serif",
      }}
    >
      <ProgressDots />

      {step === 'profile' && ProfileStep()}
      {step === 'team' && TeamStep()}
      {step === 'consent' && ConsentStep()}
      {step === 'voiceprint' && VoiceprintStep()}
      {step === 'done' && DoneStep()}
    </div>
  );
}
