/**
 * @deprecated This static Supabase client is deprecated.
 * Use the `useSupabase()` hook from `src/hooks/useSupabase.ts` instead.
 * The hook provides authenticated Supabase clients with Clerk JWT tokens.
 * 
 * Example:
 * ```tsx
 * import { useSupabase } from '../hooks/useSupabase';
 * 
 * const MyComponent = () => {
 *   const supabase = useSupabase();
 *   // Use supabase client...
 * };
 * ```
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key not found in environment variables');
}

/**
 * @deprecated Use `useSupabase()` hook instead for authenticated clients.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

