'use client';

import { useEffect, useState } from 'react';
import type { CurrentUser } from '@/app/api/auth/me/route';

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j: { data?: CurrentUser }) => setUser(j.data ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

export function canEditReports(role: string | undefined): boolean {
  return role === 'mj_admin' || role === 'mj_supervisor';
}
