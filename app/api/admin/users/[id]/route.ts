import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const PORTAL_ID = process.env.PORTAL_ID || 'unknown';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as { role?: string; banned?: boolean; displayName?: string };
  const supabase = getAdminClient();
  const updates: Record<string, unknown> = {};
  if (body.role !== undefined || body.displayName !== undefined) {
    const { data: existing } = await supabase.auth.admin.getUserById(id);
    const currentMeta = existing?.user?.user_metadata ?? {};
    updates.user_metadata = {
      ...currentMeta,
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.displayName !== undefined ? { display_name: body.displayName } : {}),
    };
  }
  if (body.banned === true) {
    updates.ban_duration = '876000h';
  } else if (body.banned === false) {
    updates.ban_duration = 'none';
  }
  const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { id: data.user.id } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getAdminClient();

  // Get the user first to check their portal memberships
  const { data: userData, error: fetchError } = await supabase.auth.admin.getUserById(id);
  if (fetchError || !userData?.user) {
    return NextResponse.json({ error: fetchError?.message || 'User not found' }, { status: 500 });
  }

  const currentPortals: string[] = Array.isArray(userData.user.user_metadata?.portals)
    ? (userData.user.user_metadata.portals as string[])
    : [];

  // Remove this portal from the user's portals array
  const updatedPortals = currentPortals.filter(p => p !== PORTAL_ID);

  if (updatedPortals.length > 0) {
    // User still belongs to other portals — just remove this portal tag
    const { error } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: { ...userData.user.user_metadata, portals: updatedPortals },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    console.log(`[admin] Removed portal ${PORTAL_ID} from user ${userData.user.email} — still in: ${updatedPortals.join(', ')}`);
    return NextResponse.json({ success: true, removed: true, deleted: false });
  }

  // User has no other portals — fully delete them
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  console.log(`[admin] Fully deleted user ${userData.user.email} — no remaining portals`);
  return NextResponse.json({ success: true, removed: true, deleted: true });
}
