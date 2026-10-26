'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import shared from '@/app/(portal)/shared.module.css';
import styles from './FormRenderer.module.css';
import { computeScores } from '@/lib/scoring';
import type { SubmissionScores } from '@/lib/scoring';
import type {
  FormTemplate,
  FormSection,
  FormResponses,
  ItemResult,
} from '@/lib/types';

/* ── Supabase browser client (for Storage uploads) ──────────────── */
function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function uploadPhoto(file: File, slug: string, itemId: string): Promise<string> {
  const supabase = getSupabase();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${slug}/${itemId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('form-photos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('form-photos').getPublicUrl(path);
  return data.publicUrl;
}

/* ── Draft helpers ──────────────────────────────────────────────── */
interface DraftData {
  inspector: string;
  area: string;
  notes: string;
  responses: FormResponses;
  savedAt: string;
}

function draftKey(slug: string) {
  return `nupure_draft_${slug}`;
}

function saveDraftLocal(slug: string, data: DraftData) {
  try {
    localStorage.setItem(draftKey(slug), JSON.stringify(data));
  } catch {
    // Storage may be unavailable
  }
}

function loadDraftLocal(slug: string): DraftData | null {
  try {
    const raw = localStorage.getItem(draftKey(slug));
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch {
    return null;
  }
}

function clearDraftLocal(slug: string) {
  try {
    localStorage.removeItem(draftKey(slug));
  } catch {
    // ignore
  }
}

/* ── Section progress helper ────────────────────────────────────── */

function sectionProgress(section: FormSection, responses: FormResponses) {
  const assessed = section.items.filter((item) => responses[item.id]?.result !== undefined && responses[item.id]?.result !== null).length;
  return { assessed, total: section.items.length };
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function FormRendererPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const draftId = searchParams.get('draftId');

  // ── Remote data ───────────────────────────────────────────────
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Form state ────────────────────────────────────────────────
  const [inspector, setInspector] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState<FormResponses>({});

  // ── UI state ──────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitScore, setSubmitScore] = useState<SubmissionScores | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // ── Draft restore ─────────────────────────────────────────────
  const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);

  // Auto-save ref to avoid stale closures
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load template ──────────────────────────────────────────── */
  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/forms/templates/${slug}`);
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          throw new Error(json.error ?? 'Template not found');
        }
        const json = await res.json() as { data: FormTemplate };
        setTemplate(json.data);

        // Check for saved draft
        const draft = loadDraftLocal(slug);
        if (draft) {
          setPendingDraft(draft);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug]);

  /* ── Load draft from backend ────────────────────────────────── */
  useEffect(() => {
    if (!draftId) return;
    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/forms/submissions/${draftId}`);
        if (!res.ok) throw new Error('Could not load draft');
        const { data } = await res.json();
        if (data) {
          setInspector(data.submitted_by || '');
          setArea(data.area || '');
          setNotes(data.notes || '');
          setResponses(data.responses || {});
        }
      } catch (err) {
        console.error('Draft load error:', err);
      }
    };
    void loadDraft();
  }, [draftId]);

  /* ── Auto-save on state changes ─────────────────────────────── */
  useEffect(() => {
    if (!slug || loading) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);

    autoSaveRef.current = setTimeout(() => {
      saveDraftLocal(slug, {
        inspector,
        area,
        notes,
        responses,
        savedAt: new Date().toISOString(),
      });
    }, 600);

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [slug, inspector, area, notes, responses, loading]);

  /* ── Draft restore handlers ──────────────────────────────────── */
  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    setInspector(pendingDraft.inspector);
    setArea(pendingDraft.area);
    setNotes(pendingDraft.notes);
    setResponses(pendingDraft.responses);
    setPendingDraft(null);
  }, [pendingDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearDraftLocal(slug);
    setPendingDraft(null);
  }, [slug]);

  /* ── Result toggle ───────────────────────────────────────────── */
  const setItemResult = useCallback((itemId: string, result: ItemResult) => {
    setResponses((prev) => {
      const existing = prev[itemId] ?? { result: null };
      const newResult = existing.result === result ? null : result;
      return { ...prev, [itemId]: { ...existing, result: newResult } };
    });
  }, []);

  const setItemComment = useCallback((itemId: string, comment: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { result: null }), comment },
    }));
  }, []);

  /* ── Photo upload per item ───────────────────────────────────── */
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const handlePhotoUpload = useCallback(
    async (itemId: string, file: File) => {
      setUploadingItem(itemId);
      try {
        const url = await uploadPhoto(file, slug, itemId);
        setResponses((prev) => {
          const current = prev[itemId] ?? { result: null };
          const newUrls = [...(current.photoUrls || [])];
          if (current.photoUrl) {
            newUrls.push(current.photoUrl);
          }
          newUrls.push(url);
          return {
            ...prev,
            [itemId]: { ...current, photoUrls: newUrls, photoUrl: undefined },
          };
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Photo upload failed');
      } finally {
        setUploadingItem(null);
      }
    },
    [slug]
  );

  const removePhoto = (itemId: string, indexToRemove?: number) => {
    setResponses((prev) => {
      const existing = { ...(prev[itemId] ?? { result: null }) };
      if (indexToRemove !== undefined) {
        const newUrls = [...(existing.photoUrls || [])];
        if (existing.photoUrl) {
          newUrls.unshift(existing.photoUrl);
        }
        if (newUrls.length > indexToRemove) {
          newUrls.splice(indexToRemove, 1);
        }
        existing.photoUrls = newUrls;
        delete existing.photoUrl;
      } else {
        delete existing.photoUrl;
      }
      return { ...prev, [itemId]: existing };
    });
  };

  /* ── Pass All for a section ──────────────────────────────────── */
  const handlePassAll = useCallback(
    (section: FormSection) => {
      setResponses((prev) => {
        const next = { ...prev };
        section.items.forEach((item) => {
          next[item.id] = { ...(next[item.id] ?? {}), result: 'pass' };
        });
        return next;
      });
    },
    []
  );

  /* ── Section collapse toggle ─────────────────────────────────── */
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  /* ── Save (draft or submit) ──────────────────────────────────── */
  const handleSave = useCallback(
    async (status: 'draft' | 'submitted') => {
      if (!template) return;
      setSaving(true);
      setSaveError(null);

      try {
        const scores = computeScores(template.sections, responses);

        const payload = {
          template_id: template.id,
          template_slug: template.slug,
          template_name: template.name,
          submitted_by: inspector,
          site: '',
          area,
          responses,
          notes,
          status,
          score_total: scores.total,
          score_pass: scores.pass,
          score_fail: scores.fail,
          score_reclean: scores.reclean,
          overall_score: scores.overallScore,
          section_scores: Object.fromEntries(
            scores.sectionScores.map((s) => [
              s.sectionId,
              { pass: s.pass, fail: s.fail, reclean: s.reclean, score: s.score },
            ])
          ),
        };

        const url = draftId ? `/api/forms/submissions/${draftId}` : '/api/forms/submissions';
        const method = draftId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const resJson = await res.json() as { data?: { id: string }; error?: string };

        if (!res.ok) {
          throw new Error(resJson.error ?? 'Save failed');
        }

        // Clear draft on successful submit
        if (status === 'submitted') {
          setSubmitScore(scores);
          setSubmittedId(resJson.data?.id ?? null);
          clearDraftLocal(slug);
        } else {
          saveDraftLocal(slug, {
            inspector,
            area,
            notes,
            responses,
            savedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [template, inspector, area, responses, notes, slug]
  );

  /* ── Loading state ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span>Loading form…</span>
      </div>
    );
  }

  if (loadError || !template) {
    return (
      <div className={shared.errorState}>
        <div className={shared.errorIcon}>⚠️</div>
        <div className={shared.errorTitle}>Form not found</div>
        <div className={shared.errorText}>{loadError ?? 'The requested form template does not exist.'}</div>
        <Link href="/forms" className={shared.retryButton} style={{ display: 'inline-block', marginTop: '1.5rem' }}>
          ← Back to Forms
        </Link>
      </div>
    );
  }

  const liveScores = computeScores(template.sections, responses);

  return (
    <div className={styles.page}>
      {/* ── Floating Score Card (desktop) ──────────────────────── */}
      <div className={styles.scoreCard}>
        <div className={styles.scoreTitle}>Live Score</div>
        <div className={`${styles.scoreStat} ${styles.scorePass}`}>
          <span>✓ Pass</span><strong>{liveScores.pass}</strong>
        </div>
        <div className={`${styles.scoreStat} ${styles.scoreFail}`}>
          <span>✗ Fail</span><strong>{liveScores.fail}</strong>
        </div>
        <div className={`${styles.scoreStat} ${styles.scoreReclean}`}>
          <span>↺ Re-Clean</span><strong>{liveScores.reclean}</strong>
        </div>
        <div className={`${styles.scoreStat} ${styles.scoreTotal}`}>
          <span>Assessed</span>
          <strong>{liveScores.total}/{template.sections.reduce((acc, s) => acc + s.items.length, 0)}</strong>
        </div>
      </div>

      <div className={styles.pageInner}>
        {/* ── Page Header ──────────────────────────────────────── */}
        <div className={shared.pageHeader}>
          <div className={shared.pageHeaderTop}>
            <div>
              <h1 className={shared.pageTitle}>{template.name}</h1>
              {template.description && (
                <p className={shared.pageDescription}>{template.description}</p>
              )}
            </div>
            <Link href="/forms" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
              ← Forms
            </Link>
          </div>
        </div>

        {/* ── Draft Restore Banner ──────────────────────────────── */}
        {pendingDraft && (
          <div className={styles.draftBanner}>
            <span>💾</span>
            <span className={styles.draftBannerText}>
              A saved draft was found from{' '}
              {new Date(pendingDraft.savedAt).toLocaleString()}. Restore it?
            </span>
            <div className={styles.draftBannerActions}>
              <button className={styles.draftRestoreBtn} onClick={handleRestoreDraft}>
                Restore
              </button>
              <button className={styles.draftDiscardBtn} onClick={handleDiscardDraft}>
                Discard
              </button>
            </div>
          </div>
        )}

        {/* ── Save Error ────────────────────────────────────────── */}
        {saveError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1.25rem',
            marginBottom: '1rem',
            color: '#f87171',
            fontSize: '0.88rem',
          }}>
            ⚠️ {saveError}
          </div>
        )}

        {/* ── Meta Fields ───────────────────────────────────────── */}
        <div className={styles.metaSection}>
          <div className={styles.metaField}>
            <label className={styles.metaLabel} htmlFor="inspector">Inspector</label>
            <input
              id="inspector"
              type="text"
              className={styles.metaInput}
              placeholder="Your name"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
            />
          </div>
          <div className={styles.metaField}>
            <label className={styles.metaLabel} htmlFor="area">Area / Location</label>
            <input
              id="area"
              type="text"
              className={styles.metaInput}
              placeholder="e.g. Production Floor B"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
          <div className={styles.metaField}>
            <label className={styles.metaLabel} htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              className={styles.metaTextarea}
              placeholder="Any general observations or context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── Sections ─────────────────────────────────────────── */}
        {template.sections.map((section) => {
          const isOpen = collapsed[section.id] !== true;
          const { assessed, total } = sectionProgress(section, responses);
          const isDone = assessed === total && total > 0;

          return (
            <div key={section.id} className={styles.section}>
              {/* Section Header */}
              <div
                className={styles.sectionHeader}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.id)}
                onKeyDown={(e) => e.key === 'Enter' && toggleSection(section.id)}
              >
                <h2 className={styles.sectionTitle}>{section.title}</h2>

                <span className={`${styles.progressText} ${isDone ? styles.progressDone : ''}`}>
                  {assessed}/{total}
                </span>

                <button
                  className={styles.passAllBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePassAll(section);
                  }}
                  type="button"
                >
                  ✓ Pass All
                </button>

                <span
                  className={`${styles.collapseToggle} ${isOpen ? styles.collapseToggleOpen : ''}`}
                >
                  ▼
                </span>
              </div>

              {/* Section Body */}
              {isOpen && (
                <div className={styles.sectionBody}>
                  {section.items.map((item) => {
                    const resp = responses[item.id];
                    const result = resp?.result ?? null;
                    const comment = resp?.comment ?? '';

                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemRowTop}>
                          <span className={styles.itemLabel}>{item.label}</span>

                          <div className={styles.itemButtons}>
                            <button
                              type="button"
                              className={`${styles.itemBtn} ${result === 'pass' ? styles.itemBtnPass : ''}`}
                              onClick={() => setItemResult(item.id, 'pass')}
                              aria-label="Pass"
                            >
                              ✓ Pass
                            </button>
                            <button
                              type="button"
                              className={`${styles.itemBtn} ${result === 'fail' ? styles.itemBtnFail : ''}`}
                              onClick={() => setItemResult(item.id, 'fail')}
                              aria-label="Fail"
                            >
                              ✗ Fail
                            </button>
                            <button
                              type="button"
                              className={`${styles.itemBtn} ${result === 'reclean' ? styles.itemBtnReclean : ''}`}
                              onClick={() => setItemResult(item.id, 'reclean')}
                              aria-label="Re-Clean"
                            >
                              ↺ Re-Clean
                            </button>
                          </div>
                        </div>

                        {/* Comment + Photo — appear when item is assessed */}
                        {result !== null && (
                          <div className={styles.itemExtras}>
                            <input
                              type="text"
                              className={styles.itemComment}
                              placeholder="Add a comment (optional)…"
                              value={comment}
                              onChange={(e) => setItemComment(item.id, e.target.value)}
                            />

                            {/* Photo upload */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                              {(() => {
                                const urls = [...(resp?.photoUrls || [])];
                                if (resp?.photoUrl) urls.unshift(resp.photoUrl);
                                return urls.map((url, i) => (
                                  <div key={i} className={styles.photoPreview}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt="Inspection photo"
                                      className={styles.photoThumb}
                                    />
                                    <button
                                      type="button"
                                      className={styles.photoRemoveBtn}
                                      onClick={() => removePhoto(item.id, i)}
                                      title="Remove photo"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ));
                              })()}
                              
                              <label
                                className={`${styles.photoUploadLabel} ${uploadingItem === item.id ? styles.photoUploading : ''}`}
                                title="Attach photo"
                              >
                                {uploadingItem === item.id ? (
                                  <span className={styles.photoSpinner} />
                                ) : (
                                  '📷'
                                )}
                                <span className={styles.photoUploadText}>
                                  {uploadingItem === item.id ? 'Uploading...' : 'Add Photo'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  disabled={uploadingItem !== null}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handlePhotoUpload(item.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Submit Success Screen ─────────────────────────────── */}
      {submitScore && (
        <div className={styles.successOverlay}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✅</div>
            <h2 className={styles.successTitle}>Report Submitted</h2>
            <div
              className={styles.successScore}
              style={{
                color: submitScore.overallScore >= 95 ? '#10b981'
                  : submitScore.overallScore >= 85 ? '#f59e0b'
                  : '#ef4444',
              }}
            >
              {submitScore.overallScore}%
            </div>
            <p className={styles.successScoreLbl}>Overall Score</p>
            <div className={styles.successStats}>
              <span className={styles.successStatPass}>✓ {submitScore.pass} Pass</span>
              <span className={styles.successStatReclean}>↺ {submitScore.reclean} Re-Clean</span>
              <span className={styles.successStatFail}>✗ {submitScore.fail} Fail</span>
            </div>

            <div className={styles.successActions}>
              {submittedId && (
                <>
                  <a
                    href={`/reports/submissions/${submittedId}`}
                    className={styles.successBtnPrimary}
                  >
                    📋 View Report
                  </a>
                  <a
                    href={`/api/forms/submissions/${submittedId}/pdf`}
                    className={styles.successBtnSecondary}
                    download
                  >
                    📄 Download PDF
                  </a>
                </>
              )}
              <a href="/forms" className={styles.successBtnGhost}>
                ← Back to Forms
              </a>
              <button
                className={styles.successBtnGhost}
                onClick={() => {
                  setSubmitScore(null);
                  setSubmittedId(null);
                  setInspector('');
                  setArea('');
                  setNotes('');
                  setResponses({});
                }}
              >
                + New Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Action Bar ─────────────────────────────────── */}
      <div className={styles.stickyBar}>
        <button
          type="button"
          className={styles.saveDraftBtn}
          disabled={saving}
          onClick={() => handleSave('draft')}
        >
          {saving ? 'Saving…' : '💾 Save Progress'}
        </button>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={saving}
          onClick={() => handleSave('submitted')}
        >
          {saving ? 'Submitting…' : '✅ Submit Report'}
        </button>
      </div>
    </div>
  );
}
