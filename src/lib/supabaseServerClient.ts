import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from './database.types';

// Server Component client
export const createServerClient = () => {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });
};

// Route Handler client
export const createRouteClient = () => {
  const cookieStore = cookies();
  return createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  });
};
