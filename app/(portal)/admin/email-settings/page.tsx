'use client';

import { useEffect, useState, useCallback } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import styles from './EmailSettings.module.css';

interface Recipient {
  name: string;
  email: string;
}

interface EmailSetting {
  id: string;
  report_type: string;
  report_label: string;
  recipients: Recipient[];
  send_on_submit: boolean;
  send_on_fail_only: boolean;
  fail_threshold: number;
  updated_at: string | null;
  updated_by: string | null;
}

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which card is expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Draft state for the expanded editor
  const [draft, setDraft] = useState<Partial<EmailSetting> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Test email state
  const [testName, setTestName] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/email-settings');
      const json = await res.json() as { data?: EmailSetting[]; error?: string };
      if (json.error) throw new Error(json.error);
      setSettings(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openEdit(s: EmailSetting) {
    if (expandedId === s.id) {
      setExpandedId(null);
      setDraft(null);
      return;
    }
    setExpandedId(s.id);
    setDraft({
      report_type: s.report_type,
      report_label: s.report_label,
      recipients: s.recipients.map(r => ({ ...r })),
      send_on_submit: s.send_on_submit,
      send_on_fail_only: s.send_on_fail_only,
      fail_threshold: s.fail_threshold,
    });
    setSaveError(null);
    setSaveSuccess(false);
  }

  function addRecipient() {
    if (!draft) return;
    const recips = draft.recipients ?? [];
    if (recips.length >= 15) return;
    setDraft({ ...draft, recipients: [...recips, { name: '', email: '' }] });
  }

  function updateRecipient(idx: number, field: 'name' | 'email', value: string) {
    if (!draft) return;
    const recips = (draft.recipients ?? []).map((r, i) =>
      i === idx ? { ...r, [field]: value } : r,
    );
    setDraft({ ...draft, recipients: recips });
  }

  function removeRecipient(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, recipients: (draft.recipients ?? []).filter((_, i) => i !== idx) });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json() as { data?: EmailSetting; error?: string };
      if (json.error) throw new Error(json.error);
      setSaveSuccess(true);
      setSettings(prev => prev.map(s =>
        s.report_type === draft.report_type ? { ...s, ...(json.data ?? draft) } as EmailSetting : s,
      ));
      setTimeout(() => {
        setExpandedId(null);
        setDraft(null);
        setSaveSuccess(false);
      }, 1200);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, name: testName }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (json.error) throw new Error(json.error);
      setTestResult({ ok: true, msg: `Test email sent to ${testEmail}` });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed to send' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={shared.pageContainer} style={{ padding: '2rem' }}>
      {/* Page header */}
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>📧 Email Notification Settings</h1>
          <p className={shared.pageSubtitle}>
            Configure who receives compliance report notifications and when they are sent.
          </p>
        </div>
      </div>

      {loading && <div className={shared.loadingState}>Loading email settings…</div>}
      {error && <div className={shared.errorState}><p className={shared.errorText}>{error}</p></div>}

      {/* Settings cards */}
      {!loading && !error && (
        <div className={styles.cardList}>
          {settings.map(s => {
            const isOpen = expandedId === s.id;
            const recips = draft?.recipients ?? s.recipients;
            const recipCount = s.recipients.length;

            return (
              <div key={s.id} className={`${styles.settingCard} ${isOpen ? styles.settingCardOpen : ''}`}>
                {/* Card summary row */}
                <div className={styles.cardSummary}>
                  <div className={styles.cardLeft}>
                    <span className={styles.reportLabel}>{s.report_label}</span>
                    <span className={styles.recipientBadge}>
                      {recipCount === 0
                        ? 'No recipients'
                        : `${recipCount} recipient${recipCount === 1 ? '' : 's'}`}
                    </span>
                    {s.send_on_submit && (
                      <span className={styles.tagActive}>On Submit</span>
                    )}
                    {s.send_on_fail_only && (
                      <span className={styles.tagWarn}>Fail Only ≤{s.fail_threshold}%</span>
                    )}
                  </div>
                  <button
                    id={`edit-${s.report_type}`}
                    className={`${styles.editBtn} ${isOpen ? styles.editBtnActive : ''}`}
                    onClick={() => openEdit(s)}
                  >
                    {isOpen ? '✕ Cancel' : '✎ Edit'}
                  </button>
                </div>

                {/* Expanded editor */}
                {isOpen && draft && (
                  <div className={styles.editor}>
                    {/* Toggles */}
                    <div className={styles.toggleRow}>
                      <div className={styles.toggleItem}>
                        <Toggle
                          id={`toggle-submit-${s.report_type}`}
                          checked={draft.send_on_submit ?? true}
                          onChange={v => setDraft({ ...draft, send_on_submit: v })}
                        />
                        <div>
                          <div className={styles.toggleLabel}>Send on every submission</div>
                          <div className={styles.toggleHint}>Recipients get an email each time this form is submitted</div>
                        </div>
                      </div>
                      <div className={styles.toggleItem}>
                        <Toggle
                          id={`toggle-fail-${s.report_type}`}
                          checked={draft.send_on_fail_only ?? false}
                          onChange={v => setDraft({ ...draft, send_on_fail_only: v })}
                        />
                        <div>
                          <div className={styles.toggleLabel}>Only send when score is below threshold</div>
                          <div className={styles.toggleHint}>Skip notification if the score meets or exceeds the threshold</div>
                        </div>
                      </div>
                    </div>

                    {/* Threshold input */}
                    {draft.send_on_fail_only && (
                      <div className={styles.thresholdRow}>
                        <label htmlFor={`threshold-${s.report_type}`} className={styles.thresholdLabel}>
                          Alert threshold (send only if score &lt;
                        </label>
                        <input
                          id={`threshold-${s.report_type}`}
                          type="number"
                          min={1}
                          max={100}
                          value={draft.fail_threshold ?? 85}
                          onChange={e => setDraft({ ...draft, fail_threshold: Number(e.target.value) })}
                          className={styles.thresholdInput}
                        />
                        <span className={styles.thresholdLabel}>%)</span>
                      </div>
                    )}

                    {/* Recipients */}
                    <div className={styles.recipientsSection}>
                      <div className={styles.recipientsHeader}>
                        <span className={styles.recipientsTitle}>Recipients</span>
                        <span className={styles.recipientsCount}>
                          {recips.length}/15
                        </span>
                      </div>

                      {recips.length === 0 && (
                        <div className={styles.noRecipients}>
                          No recipients yet. Add one below.
                        </div>
                      )}

                      {recips.map((r, idx) => (
                        <div key={idx} className={styles.recipientRow}>
                          <input
                            id={`recip-name-${s.report_type}-${idx}`}
                            type="text"
                            placeholder="Full name"
                            value={r.name}
                            onChange={e => updateRecipient(idx, 'name', e.target.value)}
                            className={styles.recipientInput}
                          />
                          <input
                            id={`recip-email-${s.report_type}-${idx}`}
                            type="email"
                            placeholder="email@example.com"
                            value={r.email}
                            onChange={e => updateRecipient(idx, 'email', e.target.value)}
                            className={`${styles.recipientInput} ${styles.recipientEmailInput}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeRecipient(idx)}
                            className={styles.removeBtn}
                            aria-label="Remove recipient"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addRecipient}
                        disabled={recips.length >= 15}
                        className={styles.addRecipientBtn}
                        id={`add-recipient-${s.report_type}`}
                      >
                        {recips.length >= 15 ? '⊘ Max 15 reached' : '+ Add Recipient'}
                      </button>
                    </div>

                    {/* Save / Cancel */}
                    <div className={styles.editorActions}>
                      {saveError && <span className={styles.saveError}>{saveError}</span>}
                      {saveSuccess && <span className={styles.saveOk}>✓ Saved</span>}
                      <button
                        type="button"
                        onClick={() => { setExpandedId(null); setDraft(null); }}
                        className={styles.cancelBtn}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => { void save(); }}
                        className={styles.saveBtn}
                        disabled={saving}
                        id={`save-${s.report_type}`}
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Test Email Section */}
      <div className={styles.testCard}>
        <h2 className={styles.testTitle}>🔬 Send Test Email</h2>
        <p className={styles.testSubtitle}>
          Verify your SMTP configuration is working correctly. A test email will be sent immediately.
        </p>
        <form className={styles.testForm} onSubmit={(e) => { void sendTest(e); }}>
          <input
            id="test-email-name"
            type="text"
            placeholder="Recipient name (optional)"
            value={testName}
            onChange={e => setTestName(e.target.value)}
            className={styles.testInput}
          />
          <input
            id="test-email-address"
            type="email"
            placeholder="Email address"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            required
            className={styles.testInput}
          />
          <button
            id="send-test-email-btn"
            type="submit"
            disabled={testing}
            className={styles.testBtn}
          >
            {testing ? 'Sending…' : '✉ Send Test'}
          </button>
        </form>
        {testResult && (
          <div className={`${styles.testResult} ${testResult.ok ? styles.testResultOk : styles.testResultErr}`}>
            {testResult.ok ? '✓' : '✕'} {testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}
