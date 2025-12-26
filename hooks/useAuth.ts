// hooks/useAuth.ts
// Wrapper hook that uses Supabase Auth with localStorage fallback

import { useSupabaseAuth } from './useSupabaseAuth';

// Re-export useSupabaseAuth as useAuth for backward compatibility
export function useAuth() {
    return useSupabaseAuth();
}
