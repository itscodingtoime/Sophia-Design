/**
 * CoachGate - Redirects users who haven't completed coach onboarding
 *
 * Wrap dashboard routes with this component to ensure users complete
 * the coach onboarding questionnaire before accessing the app.
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
import { checkProfileExists } from '../services/coach';
import { C, useThemeMode } from '../theme';

interface CoachGateProps {
    children: React.ReactNode;
    /** If true, skip the gate (for routes that don't require onboarding) */
    skipGate?: boolean;
}

export default function CoachGate({ children, skipGate = false }: CoachGateProps) {
    useThemeMode();
    const { isSignedIn, isLoaded } = useAuth();
    const { organization } = useOrganization();
    const location = useLocation();
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        async function checkProfile() {
            if (!isSignedIn || skipGate) {
                setHasProfile(true); // Skip check
                setIsChecking(false);
                return;
            }

            // Reset state when org changes or on mount to force a fresh check
            setIsChecking(true);
            setHasProfile(null);

            try {
                const result = await checkProfileExists();
                setHasProfile(result.has_completed_onboarding);
            } catch (err) {
                console.error('Failed to check profile:', err);
                // On error, let them through (don't block the app)
                setHasProfile(true);
            } finally {
                setIsChecking(false);
            }
        }

        if (isLoaded) {
            checkProfile();
        }
    }, [isSignedIn, isLoaded, skipGate, organization?.id]); // Re-run when org changes

    // Still loading auth
    if (!isLoaded || isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.teal }} />
            </div>
        );
    }

    // Not signed in, let normal auth flow handle it
    if (!isSignedIn) {
        return <>{children}</>;
    }

    // No profile and not already on onboarding page
    if (hasProfile === false && !location.pathname.startsWith('/chat/onboarding')) {
        return <Navigate to="/chat/onboarding" replace state={{ from: location }} />;
    }

    return <>{children}</>;
}
