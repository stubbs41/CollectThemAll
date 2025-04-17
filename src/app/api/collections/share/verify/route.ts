import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { shareId, password } = await request.json();
    
    if (!shareId || !password) {
      return NextResponse.json({ 
        error: 'Share ID and password are required' 
      }, { status: 400 });
    }
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    
    // Get the share record
    const { data: shareRecord, error } = await supabase
      .from('shared_collections')
      .select('share_id, password_hash, password_protected')
      .eq('share_id', shareId)
      .eq('status', 'active')
      .single();
    
    if (error || !shareRecord) {
      return NextResponse.json({ 
        error: 'Share not found or inactive' 
      }, { status: 404 });
    }
    
    if (!shareRecord.password_protected || !shareRecord.password_hash) {
      return NextResponse.json({ 
        error: 'This share is not password protected' 
      }, { status: 400 });
    }
    
    // Hash the provided password
    const passwordHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(password)
    ).then(hash => {
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    });
    
    // Check if the password matches
    if (passwordHash !== shareRecord.password_hash) {
      return NextResponse.json({ 
        error: 'Incorrect password' 
      }, { status: 401 });
    }
    
    // Generate a verification token
    const verificationToken = crypto.randomUUID();
    
    // Store the token in a cookie
    const response = NextResponse.json({ 
      verified: true,
      shareId: shareRecord.share_id
    });
    
    // Set a cookie with the verification token
    // This cookie will be used to verify access to the share
    response.cookies.set({
      name: `share_access_${shareId}`,
      value: verificationToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });
    
    return response;
    
  } catch (error) {
    console.error('Error verifying share password:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
