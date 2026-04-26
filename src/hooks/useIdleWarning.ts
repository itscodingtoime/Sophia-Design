import { useEffect, useRef, useCallback } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { toast } from 'sonner';

const WARNING_AT_MS = 25 * 60 * 1000;  // 25 minutes -- warn 5 min before logout
const LOGOUT_AT_MS = 30 * 60 * 1000;   // 30 minutes -- sign out
const CHECK_INTERVAL_MS = 60 * 1000;    // Check every 60 seconds
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'click'] as const;

export function useIdleWarning() {
  const { signOut } = useClerk();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningShownRef.current) {
      toast.dismiss('idle-warning');
      warningShownRef.current = false;
    }
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity));

    const timer = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= LOGOUT_AT_MS) {
        // 30 min idle -- sign out and redirect to login with return URL
        toast.dismiss('idle-warning');
        clearInterval(timer);
        signOut({ redirectUrl: '/login' });
      } else if (idle >= WARNING_AT_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        toast.warning(
          'Your session will expire in 5 minutes due to inactivity. Move your mouse to stay signed in.',
          { id: 'idle-warning', duration: Infinity }
        );
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(timer);
    };
  }, [onActivity, signOut]);
}
