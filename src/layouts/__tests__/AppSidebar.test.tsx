import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar, { toSidebarSessions } from '../AppSidebar';
import type { CoachSession } from '../../services/coach';

// Mock the theme module to avoid ThemeContext issues in test
vi.mock('../../theme', () => ({
  C: {
    bg: '#231f20', bgSub: '#2a2526', card: 'rgba(42,37,38,0.8)',
    cardHover: 'rgba(58,52,53,0.88)', elevated: 'rgba(48,43,44,0.92)',
    input: 'rgba(58,52,53,0.75)', teal: '#C0E689', tealMuted: '#8DC65E',
    tealDeep: 'rgba(40,45,55,0.7)', tealGlow: 'rgba(192,230,137,0.06)',
    tealBorder: 'rgba(192,230,137,0.14)', amber: '#D4A34A', red: '#D45A5A',
    green: '#C0E689', text: '#FFFFFF', textSec: '#D4D2CE', textDim: '#8A8880',
    border: 'rgba(255,255,255,0.06)', white: '#FFFFFF',
    sidebarBg: 'rgba(30,26,27,0.95)', headerBg: 'rgba(35,31,32,0.8)',
    chatBubbleSophia: 'rgba(42,37,38,0.85)', chatBubbleUser: 'rgba(192,230,137,0.1)',
    panelBg: 'rgba(30,26,27,0.7)', inputBg: 'rgba(42,37,38,0.8)',
    hoverBg: 'rgba(255,255,255,0.04)', activeBg: 'rgba(192,230,137,0.06)',
    shadowColor: 'rgba(0,0,0,0.3)',
  },
  useThemeMode: () => ({ mode: 'dark' as const, toggle: vi.fn() }),
}));

// Mock the orbs component
vi.mock('../../components/orbs', () => ({
  SophiaWhiteOrb: ({ size }: { size: number }) => <div data-testid="sophia-orb" style={{ width: size }} />,
}));

const defaultProps = {
  sessions: [],
  onNewConversation: vi.fn(),
  onSelectSession: vi.fn(),
  onDeleteSession: vi.fn(),
  userName: 'Test User',
  userRole: 'Admin',
};

describe('toSidebarSessions', () => {
  it('omits sessions with no messages yet', () => {
    const sessions: CoachSession[] = [
      {
        id: 'empty',
        track: 'sophia',
        mode: 'coaching',
        started_at: new Date().toISOString(),
        message_count: 0,
      },
      {
        id: 'has-msgs',
        track: 'sophia',
        mode: 'coaching',
        started_at: new Date().toISOString(),
        message_count: 2,
        title: 'Leadership focus',
      },
    ];
    const out = toSidebarSessions(sessions);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('has-msgs');
    expect(out[0].title).toBe('Leadership focus');
  });
});

describe('AppSidebar', () => {
  it('renders exactly 4 navigation items with correct paths', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <AppSidebar {...defaultProps} />
      </MemoryRouter>
    );

    const links = screen.getAllByRole('link');
    const navPaths = ['/chat', '/culture-health', '/calendar', '/studio'];
    const navLinks = links.filter(link => navPaths.includes(link.getAttribute('href') || ''));
    expect(navLinks).toHaveLength(4);

    // Verify each path exists
    navPaths.forEach(path => {
      const link = links.find(l => l.getAttribute('href') === path);
      expect(link).toBeDefined();
    });
  });

  it('renders profile card with link to /profile', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <AppSidebar {...defaultProps} />
      </MemoryRouter>
    );

    const links = screen.getAllByRole('link');
    const profileLink = links.find(l => l.getAttribute('href') === '/profile');
    expect(profileLink).toBeDefined();
  });

  it('displays the user name in the profile card', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <AppSidebar {...defaultProps} userName="Jane Doe" />
      </MemoryRouter>
    );

    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('renders session list when sessions are provided', () => {
    const sessions = [
      { id: '1', title: 'Coaching Session', date: 'Today' },
      { id: '2', title: 'Review Session', date: 'Yesterday' },
    ];

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <AppSidebar {...defaultProps} sessions={sessions} />
      </MemoryRouter>
    );

    expect(screen.getByText('Coaching Session')).toBeDefined();
    expect(screen.getByText('Review Session')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Yesterday')).toBeDefined();
  });
});
