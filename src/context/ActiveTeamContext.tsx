import { createContext, useContext, useState, type ReactNode } from 'react';

import { teams as initialTeams, type Team, type TeamIcon } from '../mock-data';

export const OVERALL: Team = {
  team_id: 'overall',
  team_name: "Mikey's Growth",
  description: 'Personal growth across all teams',
  member_ids: [],
  health: 78,
  direction: 'rising',
  default_colour: '#C2F542',
  icon: 'sparkles',
  created_at: '2025-09-01T00:00:00Z',
};

interface ActiveTeamContextType {
  teams: Team[];
  activeTeamId: string;
  activeTeam: Team;
  isOverall: boolean;
  setActiveTeamId: (id: string) => void;
  updateTeam: (teamId: string, patch: Partial<Pick<Team, 'team_name' | 'default_colour' | 'icon' | 'description'>>) => void;
  updateTeamColour: (teamId: string, colour: string) => void;
  addTeam: (input: { name: string; colour: string; icon: TeamIcon }) => string;
  addMemberToTeam: (teamId: string, memberId: string) => void;
  removeMemberFromTeam: (teamId: string, memberId: string) => void;
}

const ActiveTeamContext = createContext<ActiveTeamContextType | undefined>(undefined);

export function ActiveTeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [activeTeamId, setActiveTeamId] = useState<string>('overall');

  const isOverall = activeTeamId === 'overall';
  const activeTeam = isOverall ? OVERALL : (teams.find((t) => t.team_id === activeTeamId) ?? OVERALL);

  const updateTeam: ActiveTeamContextType['updateTeam'] = (teamId, patch) => {
    setTeams((prev) => prev.map((t) => (t.team_id === teamId ? { ...t, ...patch } : t)));
  };

  const updateTeamColour = (teamId: string, colour: string) => updateTeam(teamId, { default_colour: colour });

  const addTeam: ActiveTeamContextType['addTeam'] = ({ name, colour, icon }) => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team';
    let id = slug;
    let i = 2;
    const existing = new Set(teams.map((t) => t.team_id));
    while (existing.has(id)) id = `${slug}-${i++}`;
    const newTeam: Team = {
      team_id: id,
      team_name: name.trim() || 'New team',
      description: '',
      member_ids: [],
      health: 70,
      direction: 'steady',
      default_colour: colour,
      icon,
      created_at: new Date().toISOString(),
    };
    setTeams((prev) => [...prev, newTeam]);
    return id;
  };

  const addMemberToTeam: ActiveTeamContextType['addMemberToTeam'] = (teamId, memberId) => {
    setTeams((prev) => prev.map((t) => {
      if (t.team_id !== teamId) return t;
      if (t.member_ids.includes(memberId)) return t;
      return { ...t, member_ids: [...t.member_ids, memberId] };
    }));
  };

  const removeMemberFromTeam: ActiveTeamContextType['removeMemberFromTeam'] = (teamId, memberId) => {
    setTeams((prev) => prev.map((t) => {
      if (t.team_id !== teamId) return t;
      return { ...t, member_ids: t.member_ids.filter((id) => id !== memberId) };
    }));
  };

  return (
    <ActiveTeamContext.Provider value={{ teams, activeTeamId, activeTeam, isOverall, setActiveTeamId, updateTeam, updateTeamColour, addTeam, addMemberToTeam, removeMemberFromTeam }}>
      {children}
    </ActiveTeamContext.Provider>
  );
}

export function useActiveTeam() {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) throw new Error('useActiveTeam must be used inside ActiveTeamProvider');
  return ctx;
}
