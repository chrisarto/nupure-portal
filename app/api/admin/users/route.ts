import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendInviteEmail } from '@/lib/email';

const PORTAL_ID = process.env.PORTAL_ID || 'unknown';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getUserPortals(user: { user_metadata?: Record<string, unknown> }): string[] {
  const portals = user.user_metadata?.portals;
  if (Array.isArray(portals)) return portals as string[];
  return [];
}

function userBelongsToPortal(user: { user_metadata?: Record<string, unknown> }): boolean {
  const portals = getUserPortals(user);
  // Show user if they have this portal tag, OR if they have no portals tag at all (legacy users)
  return portals.length === 0 || portals.includes(PORTAL_ID);
}

export async function GET() {
  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users
    .filter(userBelongsToPortal)
    .map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.user_metadata?.display_name ?? u.email?.split('@')[0] ?? 'Unknown',
      role: (u.user_metadata?.role as string) ?? 'inspector',
      portals: getUserPortals(u),
      banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
      lastSignIn: u.last_sign_in_at,
      createdAt: u.created_at,
    }));

  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { email: string; role: string; displayName: string };
  const supabase = getAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(
    u => u.email?.toLowerCase() === body.email.toLowerCase()
  );

  if (existingUser) {
    // User exists — just add this portal to their portals array
    const currentPortals = getUserPortals(existingUser);
    if (!currentPortals.includes(PORTAL_ID)) {
      const updatedPortals = [...currentPortals, PORTAL_ID];
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, portals: updatedPortals },
      });
    }
    return NextResponse.json({
      data: { id: existingUser.id, email: existingUser.email },
      message: 'User already exists — added to this portal',
    });
  }

  // New user — generate invite link (does NOT send Supabase's own email)
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: body.email,
    options: {
      data: {
        role: body.role,
        display_name: body.displayName,
        portals: [PORTAL_ID],
      },
      redirectTo: `${siteUrl}/login`
    }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Append apikey to bypass Supabase Edge gateway issues
  let actionLink = data.properties.action_link;
  if (actionLink && !actionLink.includes('apikey=')) {
    const separator = actionLink.includes('?') ? '&' : '?';
    actionLink = `${actionLink}${separator}apikey=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`;
  }

  console.log(`[invite] Generated link for ${body.email} on portal ${PORTAL_ID}`);

  // Send our own branded email
  const emailResult = await sendInviteEmail(body.email, actionLink);
  if (!emailResult.success) {
    console.error('[invite] Email send failed:', emailResult.error);
    return NextResponse.json({ error: 'Failed to send invite email: ' + emailResult.error }, { status: 500 });
  }

  console.log(`[invite] Email sent successfully to ${body.email}`);
  return NextResponse.json({ data: { id: data.user.id, email: data.user.email } });
}
