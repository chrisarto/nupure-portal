'use client';

import { useEffect, useState } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import styles from './AdminUsers.module.css';

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  role: string;
  banned: boolean;
  lastSignIn: string | null;
  createdAt: string;
}

const ROLES = [
  { value: 'mj_admin',          label: 'MJ Admin',          desc: 'Full portal access + user management' },
  { value: 'mj_supervisor',     label: 'MJ Supervisor',     desc: 'Fill forms, view all reports, manage schedule' },
  { value: 'employee',          label: 'Employee',          desc: 'Fill in inspection forms only' },
  { value: 'client_qa',         label: 'Client QA',         desc: 'Read-only access to reports and dashboard' },
  { value: 'client_qa_manager', label: 'Client QA Manager', desc: 'Read-only access + can export reports' },
] as const;
type Role = typeof ROLES[number]['value'];

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('employee');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((j) => setUsers(j.data ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId: string, role: string) {
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    setSaving(null);
  }

  async function handleBanToggle(userId: string, currentlyBanned: boolean) {
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !currentlyBanned }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned: !currentlyBanned } : u));
    setSaving(null);
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    setSaving(userId);
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setSaving(null);
  }

  async function handleBulkDeleteTestAccounts() {
    const testUsers = users.filter((u) => u.email.endsWith('@ptw.com'));
    if (testUsers.length === 0) return;
    if (!confirm(`Delete ${testUsers.length} test accounts (@ptw.com)? This cannot be undone.`)) return;
    setSaving('bulk');
    await Promise.all(
      testUsers.map((u) => fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' }))
    );
    setUsers((prev) => prev.filter((u) => !u.email.endsWith('@ptw.com')));
    setSaving(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, displayName: inviteName }),
      });
      const j = await res.json() as { error?: string };
      if (j.error) throw new Error(j.error);
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('employee');
      // Refresh user list
      const refreshed = await fetch('/api/admin/users').then((r) => r.json());
      setUsers(refreshed.data ?? []);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className={shared.pageContainer}>
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>User Management</h1>
          <p className={shared.pageSubtitle}>Invite team members and manage access roles</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {users.some((u) => u.email.endsWith('@ptw.com')) && (
            <button
              className={styles.actionBtn + ' ' + styles.actionDelete}
              disabled={saving === 'bulk'}
              onClick={() => { void handleBulkDeleteTestAccounts(); }}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
            >
              🗑 Remove {users.filter((u) => u.email.endsWith('@ptw.com')).length} test accounts
            </button>
          )}
          <span className={styles.userCount}>{users.length} members</span>
        </div>
      </div>

      {/* Invite Form */}
      <div className={styles.inviteCard}>
        <h2 className={styles.inviteTitle}>Invite New Member</h2>
        <form className={styles.inviteForm} onSubmit={handleInvite}>
          <input
            type="text"
            placeholder="Display name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            required
            className={styles.inviteInput}
          />
          <input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className={styles.inviteInput}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
            className={styles.inviteSelect}
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={inviting} className={styles.inviteBtn}>
            {inviting ? 'Sending…' : '✉ Send Invite'}
          </button>
        </form>
        {inviteSuccess && <p className={styles.inviteSuccess}>{inviteSuccess}</p>}
        {inviteError && <p className={styles.inviteError}>{inviteError}</p>}
      </div>

      {/* Users Table */}
      {loading && <div className={shared.loadingState}>Loading users…</div>}
      {error && <div className={shared.errorState}>Error: {error}</div>}
      {!loading && users.length > 0 && (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Sign In</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.banned ? styles.bannedRow : ''}>
                  <td>{u.displayName}</td>
                  <td className={styles.emailCell}>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => { void handleRoleChange(u.id, e.target.value); }}
                      disabled={saving === u.id}
                      className={styles.roleSelect}
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>{formatDate(u.lastSignIn)}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${u.banned ? styles.statusBanned : styles.statusActive}`}>
                      {u.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      onClick={() => { void handleBanToggle(u.id, u.banned); }}
                      disabled={saving === u.id}
                      className={`${styles.actionBtn} ${u.banned ? styles.actionUnban : styles.actionBan}`}
                    >
                      {u.banned ? 'Unban' : 'Ban'}
                    </button>
                    <button
                      onClick={() => { void handleDelete(u.id, u.email); }}
                      disabled={saving === u.id}
                      className={`${styles.actionBtn} ${styles.actionDelete}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
