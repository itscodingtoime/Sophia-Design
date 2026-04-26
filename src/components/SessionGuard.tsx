import { Navigate } from 'react-router-dom';

/**
 * SessionGuard — renders when Clerk's <SignedOut> fires on private routes.
 *
 * Simply redirects to /login. If the user is actually signed in (transient
 * JWT refresh blip), /login's <SignedIn> wrapper redirects back to /chat
 * immediately. If truly signed out, they see the login page.
 *
 * No timers, no toasts, no white screens.
 */
export default function SessionGuard() {
  return <Navigate to="/login" replace />;
}
