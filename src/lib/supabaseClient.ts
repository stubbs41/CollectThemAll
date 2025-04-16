import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './database.types';

// Singleton instance for client-side
let clientInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null;

// Client-side Supabase client (for use in browser components)
export const createClient = () => {
  if (typeof window !== 'undefined') {
    // Only create a new instance if one doesn't exist and we're in the browser
    if (!clientInstance) {
      clientInstance = createClientComponentClient<Database>({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      });
    }
    return clientInstance;
  }

  // If we're not in the browser, create a new instance each time
  // This is necessary for server-side rendering
  return createClientComponentClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
};
