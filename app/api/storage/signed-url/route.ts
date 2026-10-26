/**
 * GET /api/storage/signed-url
 *
 * Generates a short-lived signed URL for a private Supabase Storage object.
 * Used to serve training certificates and document uploads stored in nupure-attachments.
 *
 * Query params:
 *   path - the storage path e.g. "training-certs/recXXX/attYYY-cert.pdf"
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'nupure-attachments';
const EXPIRY_SECONDS = 3600; // 1 hour

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  // Strip the supabase-storage:// prefix if present
  const storagePath = path.replace(/^supabase-storage:\/\//, '');

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to generate URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: EXPIRY_SECONDS });
}
