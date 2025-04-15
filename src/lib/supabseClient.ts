import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { createServerClient } from '@supabase/auth-helpers-nextjs'; // We might need this later for server actions/components
import { Database } from './database.types'; // We'll create this later

// Client-side Supabase client (for use in browser components)
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// --- Optional: Server-side client examples (for API routes, Server Components) ---
// You might use these later depending on your specific needs.
// import { cookies } from 'next/headers'; // For Server Components / Actions

// Server Component/Action client
// export const createSupabaseServerClient = () => {
//   const cookieStore = cookies();
//   return createServerClient<Database>(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         get(name: string) {
//           return cookieStore.get(name)?.value;
//         },
//       },
//     }
//   );
// };

// API Route Handler client (example - adjust based on how you handle cookies/sessions)
// import type { NextApiRequest, NextApiResponse } from 'next'; // Or NextRequest/NextResponse from next/server
// import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'; // Different import for Pages Router style

// export const createSupabaseApiRouteClient = (req: NextApiRequest, res: NextApiResponse) => {
//    return createServerSupabaseClient<Database>({ req, res });
// };
