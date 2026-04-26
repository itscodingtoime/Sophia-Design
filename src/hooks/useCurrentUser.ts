import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { UserProfile, getCurrentUser } from '../services/api';

export const useCurrentUser = () => {
  const { getToken, isLoaded } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isLoaded) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        const profile = await getCurrentUser(token);
        setUserProfile(profile);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch user profile'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [getToken, isLoaded]);

  return { userProfile, isLoading, error };
};

