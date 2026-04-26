import { useAuth } from '@clerk/clerk-react';
import { createClient } from '@supabase/supabase-js';
import { useMemo, useRef } from 'react';

export const useSupabase = () => {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const supabase = useMemo(() => {
    return createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        accessToken: async () => {
          try {
            const token = await getTokenRef.current({ template: 'supabase' });
            return token;
          } catch (error) {
            console.error('Error getting Clerk token for Supabase:', error);
            return null;
          }
        },
      }
    );
  }, []); // Empty deps -- getTokenRef.current always has latest

  return supabase;
};

