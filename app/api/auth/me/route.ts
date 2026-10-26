import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  canEdit: boolean; // mj_admin or mj_supervisor
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const role = (user.user_metadata?.role as string) ?? 'employee';
  const canEdit = role === 'mj_admin' || role === 'mj_supervisor';

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.display_name as string) ?? user.email?.split('@')[0] ?? 'User',
      role,
      canEdit,
    } satisfies CurrentUser,
  });
}
