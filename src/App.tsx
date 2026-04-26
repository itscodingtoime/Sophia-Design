import React, { lazy, Suspense, useState, useEffect } from 'react';
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
  Outlet,
} from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  ClerkLoaded,
  ClerkLoading,
  useAuth,
} from '@clerk/clerk-react';
import { Toaster } from 'sonner';

import { ThemeProvider, C } from './theme';
import './theme/theme.css';
import { TeamProvider } from './context/TeamContext';
import { ActiveTeamProvider } from './context/ActiveTeamContext';
import { MeetingProvider } from './context/MeetingContext';

import AppLayout from './layouts/AppLayout';
import CoachGate from './components/CoachGate';
import SessionGuard from './components/SessionGuard';
import { ProcessingStatusProvider } from './providers/ProcessingStatusProvider';

// lazy load routes
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const SophiaChat = lazy(() => import('./pages/SophiaChat'));
const Home = lazy(() => import('./pages/Home'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const RecordStudio = lazy(() => import('./pages/Studio'));
const MeetingDetailPage = lazy(() => import('./pages/MeetingDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
// SophiaV2 archived to pages/frontendlegacy/

// prevents loader flash
const DelayedLoader = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  return show ? (
    <div className="p-8 text-gray-400">Loading content...</div>
  ) : null;
};

// auth loading -- returns null for clean UX during brief Clerk init
const AuthLoadingFallback = () => {
  const location = useLocation();
  const isPublicRoute = ['/login', '/register'].includes(location.pathname);
  if (isPublicRoute) return null;
  return null;
};

const RootRedirect = () => {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.bg,
        color: 'white',
      }}>
        <div>Loading...</div>
      </div>
    );
  }
  if (isSignedIn) {
    return <Navigate to="/home" replace />
  } else {
    return <Navigate to="/login" replace />
  };
};

const SignedOutRoutes = () => {
  return (
    <>
      <SignedIn>
        <Navigate to="/home" replace />
      </SignedIn>
      <SignedOut>
        <Outlet />
      </SignedOut>
    </>
  );
};

const App = () => {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Toaster />

      {/* auth loading */}
      <ClerkLoading>
        <AuthLoadingFallback />
      </ClerkLoading>

      <ClerkLoaded>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          {/* Public routes */}
          <Route element={<SignedOutRoutes />}>
            <Route
              path="/login"
              element={
                <Suspense fallback={<AuthLoadingFallback />}>
                  <LoginPage />
                </Suspense>
              }
            />
            <Route
              path="/register"
              element={
                <Suspense fallback={<AuthLoadingFallback />}>
                  <RegisterPage />
                </Suspense>
              } />
          </Route>

          {/* Private routes with AppLayout */}
          <Route
            element={
              <>
                <SignedIn>
                  <ProcessingStatusProvider>
                    <TeamProvider>
                      <ActiveTeamProvider>
                        <MeetingProvider>
                          <AppLayout />
                        </MeetingProvider>
                      </ActiveTeamProvider>
                    </TeamProvider>
                  </ProcessingStatusProvider>
                </SignedIn>
                <SignedOut>
                  <Navigate to="/login" replace />
                </SignedOut>
              </>
            }
          >
            <Route
              path="/chat"
              element={
                <CoachGate>
                  <Suspense fallback={<DelayedLoader />}>
                    <SophiaChat />
                  </Suspense>
                </CoachGate>
              }
            />
            <Route
              path="/chat/onboarding"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <Onboarding />
                </Suspense>
              }
            />
            <Route
              path="/home"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <Home />
                </Suspense>
              }
            />
            <Route
              path="/team/:teamId"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <Home />
                </Suspense>
              }
            />
            <Route
              path="/calendar"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <CalendarView />
                </Suspense>
              }
            />
            <Route
              path="/studio"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <RecordStudio />
                </Suspense>
              }
            />
            <Route
              path="/studio/:meetingId"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <RecordStudio />
                </Suspense>
              }
            />
            <Route
              path="/profile"
              element={
                <Suspense fallback={<DelayedLoader />}>
                  <ProfilePage />
                </Suspense>
              }
            />
          </Route>

          {/* SOPHIA V2 reference route -- kept for design comparison */}
          <Route
            element={
              <SignedIn>
                <TeamProvider>
                  <MeetingProvider>
                    <Outlet />
                  </MeetingProvider>
                </TeamProvider>
              </SignedIn>
            }
          >
          </Route>

          <Route path="/culture-health" element={<Navigate to="/home" replace />} />
          <Route
            path="*"
            element={<div className="p-20 text-red-500">404: Not Found</div>}
          />
        </Routes>
      </ClerkLoaded>
    </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
