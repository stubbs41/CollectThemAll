import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './database.types'; // We'll create this later

// Client-side Supabase client (for use in browser components)
export const createClient = () =>
  createClientComponentClient<Database>({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });

// --- Optional: Server-side client examples (for API routes, Server Components) ---
// You might use these later depending on your specific needs.
// import { cookies } from 'next/headers'; // For Server Components / Actions

// Server Component/Action client
// export const createSupabaseServerClient = () => {
//   const cookieStore = cookies();
//   return createServerComponentClient<Database>({
//     cookies: () => cookieStore,
//   });
// };

// API Route Handler client (example - adjust based on how you handle cookies/sessions)
// import { cookies } from 'next/headers';

// export const createSupabaseRouteHandlerClient = () => {
//   const cookieStore = cookies();
//   return createServerComponentClient<Database>({
//     cookies: () => cookieStore,
//   });
// }; 