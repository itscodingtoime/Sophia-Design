import { Calendar, Home, Users, ChevronDown, Loader2, FileText, Sparkles, Sun, Moon } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useUser, UserButton, useOrganization, useOrganizationList, useAuth } from '@clerk/clerk-react';

import { C, useThemeMode } from '../theme';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useMeeting } from '../context/MeetingContext';
import { checkProfileExists } from '../services/coach';
import logoWhite from '../assets/innersystems-primary-white.png';
import logoGreen from '../assets/innersystems-primary-green.png';
import CreateTeam from '../components/teams/CreateTeam';

// shadcn/ui imports
import { Separator } from "../components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../components/ui/sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  const { userProfile } = useCurrentUser();
  const { isLoaded, userMemberships, setActive, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization } = useOrganization();
  const { selectedMeetingTitle } = useMeeting();
  const { mode, toggle } = useThemeMode();
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [hasCoachProfile, setHasCoachProfile] = useState<boolean | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if user is admin
  const isAdmin = userProfile?.role === 'admin' || false;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTeamDropdown(false);
      }
    };

    if (showTeamDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTeamDropdown]);

  // Check coach profile status
  useEffect(() => {
    async function checkCoach() {
      try {
        const result = await checkProfileExists();
        setHasCoachProfile(result.has_completed_onboarding);
      } catch {
        setHasCoachProfile(false);
      }
    }
    if (authLoaded && userLoaded) {
      checkCoach();
    }
  }, [authLoaded, userLoaded]);

  // Show loading spinner if auth is not loaded
  if (!authLoaded || !userLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: C.bg }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: C.teal }} />
      </div>
    );
  }

  // Primary task-based navigation
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/teams', label: 'Teams', icon: Users },
    { path: '/meetings', label: 'Meetings', icon: FileText },
  ];

  const generalNavItems = [
    { path: '/calendar', label: 'Calendar', icon: Calendar },
  ];

  const handleCoachClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasCoachProfile === false) {
      navigate('/chat/onboarding');
    } else {
      navigate('/coach');
    }
  };

  const handleTeamChange = (orgId: string | null) => {
    if (setActive) {
      if (orgId === null) {
        setActive({ organization: null }).catch(console.error);
      } else {
        setActive({ organization: orgId }).catch(console.error);
        if (location.pathname !== '/dashboard') {
          navigate('/dashboard');
        }
      }
    }
    setShowTeamDropdown(false);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    if (!createOrganization || !setActive) {
      alert('Organization creation is not available');
      return;
    }

    try {
      setIsCreatingTeam(true);
      const newOrg = await createOrganization({ name: newTeamName.trim() });
      if (newOrg) {
        // Revalidate the organization list to update the sidebar immediately
        if (userMemberships?.revalidate) {
          await userMemberships.revalidate();
        }

        // Set the newly created organization as active
        await setActive({ organization: newOrg.id });
        setNewTeamName('');
        setShowCreateTeamDialog(false);
        alert('Team created successfully!');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Failed to create team. Please try again.');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // Build breadcrumb segments: team > sidebar item > sub tab (if applicable) > meeting title (if applicable)
  const getSidebarItemLabel = (): string => {
    if (location.pathname === '/dashboard' || location.pathname === '/') return 'Dashboard';
    if (location.pathname.startsWith('/teams')) return 'Teams';
    if (location.pathname.startsWith('/meetings')) return 'Meetings';
    if (location.pathname.startsWith('/calendar')) return 'Calendar';
    if (location.pathname.startsWith('/coach')) return 'AI Coach';
    return 'Dashboard';
  };

  const getTabsForRoute = (): Array<{ id: string; label: string; path?: string }> => {
    const hasTeamContext = !!organization;

    if (location.pathname === '/dashboard' && hasTeamContext) {
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'conversation-patterns', label: 'Conversation Patterns' },
        { id: 'interaction-dynamics', label: 'Interaction Dynamics' },
      ];
    }
    if (location.pathname === '/teams' && hasTeamContext) {
      return [
        { id: 'management', label: 'Team Management' },
        { id: 'settings', label: 'Team Settings' },
      ];
    }
    if (location.pathname === '/meetings' && hasTeamContext) {
      return [
        { id: 'meetings', label: 'Live meetings' },
        { id: 'files', label: 'Files' },
      ];
    }
    if (location.pathname.startsWith('/coach')) {
      return [
        { id: 'chat', label: 'Chat', path: '/coach' },
        { id: 'settings', label: 'Settings', path: '/coach/settings' },
      ];
    }
    return [];
  };

  const tabs = getTabsForRoute();
  const currentTabParam = searchParams.get('tab') || (tabs[0]?.id ?? '');
  const currentTabLabel = tabs.find((t) => t.id === currentTabParam)?.label ?? null;
  const sidebarItemLabel = getSidebarItemLabel();
  const teamLabel = organization?.name ?? 'All Teams';
  const meetingTitle =
    location.pathname === '/meetings' && currentTabParam === 'meetings' && selectedMeetingTitle
      ? selectedMeetingTitle
      : null;

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "14rem",
      } as React.CSSProperties}
    >
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-2" style={{ background: C.sidebarBg }}>
          {/* Logo Area */}
          <div className="flex items-center justify-center space-x-2 mb-6 mt-2 group-data-[collapsible=icon]:mb-0">
            <img
              src={mode === 'dark' ? logoWhite : logoGreen}
              alt="InnerSystems"
              style={{ height: 32, width: 'auto' }}
              className="shrink-0"
            />
            <span className="text-sm font-light tracking-wide group-data-[collapsible=icon]:hidden" style={{ color: C.text, fontFamily: "'Josefin Sans', sans-serif" }}>INNERSYSTEMS.AI</span>
          </div>

          {/* Team Switcher */}
          <div className="relative group-data-[collapsible=icon]:hidden">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[10px] font-bold tracking-wider" style={{ color: C.textDim, fontFamily: "'Josefin Sans', sans-serif" }}>
                TEAM CONTEXT
              </label>
              {isAdmin && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: C.teal, color: C.white }}>
                  Admin
                </span>
              )}
            </div>
            {!isLoaded ? (
              <div className="text-sm" style={{ color: C.textDim }}>Loading...</div>
            ) : (
              <div ref={dropdownRef}>
                <button
                  onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm shadow-sm"
                  style={{ background: C.card, color: C.text, border: `1px solid ${C.border}` }}
                >
                  <span className="truncate font-medium">
                    {organization?.name || 'All Teams'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`flex-shrink-0 transition-transform ${showTeamDropdown ? 'rotate-180' : ''}`}
                    style={{ color: C.textDim }}
                  />
                </button>
                {/* Dropdown Menu */}
                {showTeamDropdown && userMemberships.data && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <button
                      onClick={() => handleTeamChange(null)}
                      className="w-full px-3 py-2 text-left text-sm transition-colors"
                      style={!organization
                        ? { background: C.activeBg, color: C.teal, fontWeight: 500 }
                        : { color: C.text }
                      }
                    >
                      All Teams
                    </button>
                    {userMemberships.data.length > 0 && (
                      <Separator style={{ background: C.border }} />
                    )}
                    {userMemberships.data.map((membership) => (
                      <button
                        key={membership.organization.id}
                        onClick={() => handleTeamChange(membership.organization.id)}
                        className="w-full px-3 py-2 text-left text-sm transition-colors"
                        style={organization?.id === membership.organization.id
                          ? { background: C.activeBg, color: C.teal, fontWeight: 500 }
                          : { color: C.text }
                        }
                      >
                        {membership.organization.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 flex flex-col h-full" style={{ background: C.sidebarBg }}>
          <SidebarGroup>
            <SidebarGroupContent className="space-y-1">
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        className={`h-10 px-4 transition-all duration-200 ${isActive ? 'font-semibold' : 'hover-teal'}`}
                        style={isActive
                          ? { background: C.activeBg, color: C.teal }
                          : { color: C.text }
                        }
                      >
                        <Link to={item.path}>
                          <item.icon style={{ color: isActive ? C.teal : C.text }} />
                          <span style={{ fontFamily: "'Josefin Sans', sans-serif" }}>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="px-4 my-2 group-data-[collapsible=icon]:hidden">
            <Separator style={{ background: C.border }} />
          </div>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold tracking-wider" style={{ color: C.textDim, fontFamily: "'Josefin Sans', sans-serif" }}>
              GENERAL
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {generalNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        className={`h-10 px-4 transition-all duration-200 ${isActive ? 'font-semibold' : 'hover-teal'}`}
                        style={isActive
                          ? { background: C.activeBg, color: C.teal }
                          : { color: C.text }
                        }
                      >
                        <Link to={item.path}>
                          <item.icon style={{ color: isActive ? C.teal : C.text }} />
                          <span style={{ fontFamily: "'Josefin Sans', sans-serif" }}>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* Bottom Actions */}
          <div className="mt-auto px-2 pb-4 group-data-[collapsible=icon]:hidden">
            <CreateTeam />
          </div>
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <SidebarInset className="overflow-hidden flex flex-col h-screen" style={{ background: C.bg }}>
        {/* Header with Sidebar Trigger, Tabs, and User Profile */}
        <div className="flex flex-col" style={{ background: C.headerBg, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex w-full items-center justify-between p-2">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="hover-teal" style={{ color: C.text }} />

              <div className="h-6 w-px" style={{ background: C.border }} />

              {/* Breadcrumbs: team > sidebar item > sub tab (if applicable) > meeting title (if applicable) */}
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <span className="cursor-default" style={{ color: C.textSec }}>{teamLabel}</span>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {tabs.length > 0 ? (
                      <BreadcrumbLink asChild>
                        <Link to={location.pathname} style={{ color: C.textSec }}>{sidebarItemLabel}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage style={{ color: C.text }}>{sidebarItemLabel}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {currentTabLabel && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage style={{ color: C.text }}>{currentTabLabel}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                  {meetingTitle && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage style={{ color: C.text }}>{meetingTitle}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <div className="flex items-center gap-3">
              {organization && (
                <button
                  onClick={handleCoachClick}
                  className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ border: `1px solid ${C.tealBorder}`, background: C.tealGlow, color: C.teal }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>AI Coach</span>
                </button>
              )}
              <button
                onClick={toggle}
                className="hover-bg rounded-lg p-2"
                style={{ color: C.textSec }}
                aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'h-10 w-10',
                  },
                }}
                afterSignOutUrl="/"
              />
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6 m-0" style={{ background: C.bg }}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardLayout;
