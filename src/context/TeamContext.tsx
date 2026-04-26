import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useOrganization } from '@clerk/clerk-react';

import { Team } from '../services/api';

interface TeamContextType {
  teams: Team[];
  activeTeam: Team | null;
  isLoading: boolean;
  setActiveTeam: (team: Team | null) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

interface TeamProviderProps {
  children: ReactNode;
}

export const TeamProvider = ({ children }: TeamProviderProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);
  const [isLoading] = useState(false);

  // Sync with Clerk
  const { organization, isLoaded } = useOrganization();

  useEffect(() => {
    if (isLoaded) {
      if (organization) {
        // Map Clerk Organization to Team interface
        const mappedTeam: Team = {
          team_id: organization.id,
          team_name: organization.name,
          created_at: organization.createdAt.toISOString()
        };
        setActiveTeamState(mappedTeam);
        console.log("TeamProvider Synced. Current Team:", mappedTeam.team_id);
      } else {
        setActiveTeamState(null);
        console.log("TeamProvider Synced. No Team Selected.");
      }
    }
  }, [organization, isLoaded]);

  const setActiveTeam = (team: Team | null) => {
    // This is now mostly an alias, but we keep it for backward compat if needed.
    // Ideally, we solely rely on Clerk.
    setActiveTeamState(team);
  };

  // Never return null - always render children, even if loading
  return (
    <TeamContext.Provider value={{ teams, activeTeam, isLoading, setActiveTeam }}>
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: 0,
          zIndex: 9998,
          background: 'orange',
          color: 'white',
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}>
          CONTEXT LOADING...
        </div>
      )}
      {children}
    </TeamContext.Provider>
  );
};

