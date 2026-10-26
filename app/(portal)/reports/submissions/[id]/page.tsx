'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import shared from '@/app/(portal)/shared.module.css';
import styles from './SubmissionDetail.module.css';
import type { SubmissionDetail, FormSection, SectionScore } from '@/lib/types';
import type { AnalysisResult, TrendPoint } from '@/app/api/submissions/analysis/route';
import { useCurrentUser } from '@/lib/useCurrentUser';

const formatScore = (s: number | null | undefined) => (s == null ? '' : Number(s).toFixed(2).replace(/\\.00$/, ''));


/* ── Utilities ─────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 95) return '#10b981';
  if (score >= 85) return '#ca8a04';
  if (score >= 70) return '#ea580c';
  return '#dc2626';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

function scoreLabel(score: number): string {
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Good';
  if (score >= 70) return 'Needs Work';
  return 'Critical';
}

/* ── Inner chart components ────────────────────────────────── */

function SectionScoreChart({
  sections,
  sectionScores,
}: {
  sections: FormSection[];
  sectionScores: Record<string, SectionScore>;
}) {
  // Try matching by section ID first (portal forms)
  const scored = sections.filter((s) => sectionScores[s.id]);

  // Fallback: if no matches by ID, render directly from sectionScores keys (AI-ingested)
  const useDirectKeys = scored.length === 0 && Object.keys(sectionScores).length > 0;

  const barColor = (score: number) =>
    score >= 95 ? '#10b981' : score >= 85 ? '#f59e0b' : score >= 70 ? '#ea580c' : '#ef4444';

  if (scored.length === 0 && !useDirectKeys) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No section scores available.</p>;

  const entries = useDirectKeys
    ? Object.entries(sectionScores).map(([name, sc]) => ({ key: name, title: name, sc }))
    : scored.map((s) => ({ key: s.id, title: s.title, sc: sectionScores[s.id] }));

  return (
    <div>
      {entries.map(({ key, title, sc }) => {
        const score = sc?.score ?? 0;
        return (
          <div key={key} style={{ marginBottom: '0.6rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                marginBottom: '0.2rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  maxWidth: '65%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </span>
              <span style={{ fontWeight: 700, color: barColor(score) }}>{formatScore(score)}%</span>
            </div>
            <div
              style={{
                height: '8px',
                background: 'var(--bg-elevated, #1e2533)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${formatScore(score)}%`,
                  background: barColor(score),
                  borderRadius: '4px',
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({
  trend,
  currentScore,
}: {
  trend: TrendPoint[];
  currentScore: number | null;
}) {
  if (trend.length === 0 && currentScore === null) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
        No historical data yet
      </div>
    );
  }

  const points: TrendPoint[] = [
    ...trend,
    ...(currentScore !== null
      ? [{ date: new Date().toISOString(), score: currentScore, submissionId: 'current' }]
      : []),
  ];

  if (points.length < 2) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
        Submit more reports to see trends
      </div>
    );
  }

  const W = 280, H = 120, PAD = 16;
  const scores = points.map((p) => p.score);
  const minS = Math.max(0, Math.min(...scores) - 10);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const toY = (s: number) => H - PAD - ((s - minS) / (maxS - minS)) * (H - PAD * 2);
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.score).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = toY(v);
        if (y < PAD || y > H - PAD) return null;
        return (
          <line
            key={v}
            x1={PAD}
            y1={y}
            x2={W - PAD}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        );
      })}
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L${toX(points.length - 1).toFixed(1)},${H - PAD} L${toX(0)},${H - PAD} Z`}
        fill="url(#trendGrad)"
      />
      <path
        d={pathD}
        fill="none"
        stroke="#0d9488"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(p.score)}
          r={p.submissionId === 'current' ? 5 : 3}
          fill={p.submissionId === 'current' ? '#06b6d4' : '#0d9488'}
          stroke={p.submissionId === 'current' ? '#fff' : 'none'}
          strokeWidth="2"
        />
      ))}
      {currentScore !== null && (
        <text
          x={toX(points.length - 1)}
          y={toY(currentScore) - 8}
          textAnchor="middle"
          fontSize="10"
          fill="#06b6d4"
          fontWeight="700"
        >
          {formatScore(currentScore)}%
        </text>
      )}
    </svg>
  );
}

/* ── Template data interface ───────────────────────────────── */

interface TemplateData {
  sections: FormSection[];
}

/* ── Main page component ───────────────────────────────────── */

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const canEdit = user?.canEdit ?? false;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [fullReportOpen, setFullReportOpen] = useState(true);

  const [signature, setSignature] = useState('');
  const [signingOff, setSigningOff] = useState(false);

  useEffect(() => {
    async function loadAll() {
      try {
        const subRes = await fetch(`/api/submissions/${id}`);
        const subJson = (await subRes.json()) as { data?: SubmissionDetail; error?: string };
        if (subJson.error ?? !subJson.data) throw new Error(subJson.error ?? 'Not found');
        const sub = subJson.data as SubmissionDetail;
        setSubmission(sub);
        setNotesValue(sub.notes ?? '');

        // Fetch template + analysis concurrently
        // For AI-ingested forms (like client-pre-op), the template might not exist, so we catch errors gracefully
        const templatePromise = fetch(`/api/forms/templates/${sub.template_slug}`)
          .then(r => r.ok ? r.json() : { data: null })
          .catch(() => ({ data: null }));

        const analysisPromise = fetch(`/api/submissions/analysis?template_slug=${sub.template_slug}&exclude=${id}`)
          .then(r => r.ok ? r.json() : { data: null })
          .catch(() => ({ data: null }));

        const [templateJson, analysisJson] = await Promise.all([templatePromise, analysisPromise]);

        const templateData = (templateJson as { data?: TemplateData }).data ?? null;
        setTemplate(templateData);

        const analysisData = (analysisJson as { data?: AnalysisResult }).data ?? null;

        // Enrich pattern labels using template data or submission responses
        if (analysisData) {
          const labelMap: Record<string, { label: string; section: string }> = {};
          if (templateData) {
            templateData.sections.forEach((s) =>
              s.items.forEach((item) => {
                labelMap[item.id] = { label: item.label, section: s.title };
              })
            );
          } else if (sub.responses) {
            Object.entries(sub.responses).forEach(([k, v]) => {
              if (v && typeof v === 'object' && '_label' in (v as any)) {
                labelMap[k] = { label: (v as any)._label, section: (v as any)._area ?? '' };
              }
            });
          }
          const enriched = analysisData.patterns.map((p) => ({
            ...p,
            itemLabel: labelMap[p.itemId]?.label ?? p.itemId,
            sectionTitle: labelMap[p.itemId]?.section ?? '',
          }));
          setAnalysis({ ...analysisData, patterns: enriched });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, [id]);

  async function handleDelete() {
    if (!confirm('Permanently delete this report? This cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/forms/submissions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/reports/pre-op');
    } else {
      alert('Delete failed');
      setDeleting(false);
    }
  }

  async function handleSaveNotes() {
    await fetch(`/api/forms/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesValue }),
    });
    setSubmission((prev) => (prev ? { ...prev, notes: notesValue } : prev));
    setEditingNotes(false);
  }

  async function handleSignOff() {
    if (!signature.trim()) return alert('Please enter your name to sign off.');
    setSigningOff(true);
    try {
      const res = await fetch(`/api/forms/submissions/${id}/signoff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) throw new Error('Sign off failed');
      const json = await res.json();
      setSubmission(prev => prev ? { ...prev, reclean_signed_off_by: json.data.reclean_signed_off_by, reclean_signed_off_at: json.data.reclean_signed_off_at } : null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSigningOff(false);
    }
  }

  /* ── Loading / error states ──────────────────────────────── */

  if (loading) {
    return (
      <div className={shared.pageContainer}>
        <div className={shared.loadingState}>Loading submission…</div>
      </div>
    );
  }

  if (error ?? !submission) {
    return (
      <div className={shared.pageContainer}>
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Submission not found</div>
          <div className={shared.errorText}>{error ?? 'This submission could not be loaded.'}</div>
        </div>
      </div>
    );
  }

  /* ── Derived values ──────────────────────────────────────── */

  const sections = template?.sections ?? [];
  const responses = submission.responses ?? {};
  const sectionScores = submission.section_scores ?? {};
  const score = submission.overall_score;

  // Collect fail/reclean items across all sections
  interface IssueItem {
    sectionTitle: string;
    itemId: string;
    itemLabel: string;
    result: 'fail' | 'reclean';
    comment?: string;
    photoUrl?: string;
  }
  const issueItems: IssueItem[] = [];

  // Method 1: Match via template sections (for portal-submitted forms)
  for (const section of sections) {
    for (const item of section.items) {
      const resp = responses[item.id];
      if (resp?.result === 'fail' || resp?.result === 'reclean') {
        issueItems.push({
          sectionTitle: section.title,
          itemId: item.id,
          itemLabel: item.label,
          result: resp.result,
          comment: resp.comment,
          photoUrl: resp.photoUrl,
        });
      }
    }
  }

  // Method 2: For AI-ingested client-pre-op reports, scan all response keys
  // These have _area, _label, compliance, defect, correctiveAction fields
  if (issueItems.length === 0 && submission.template_slug === 'client-pre-op') {
    const rawResponses = responses as unknown as Record<string, Record<string, string>>;
    for (const [key, resp] of Object.entries(rawResponses)) {
      if (key.startsWith('_') || !resp || typeof resp !== 'object') continue;
      if (resp.result === 'fail' || resp.result === 'marginal' || resp.compliance === 'U' || resp.compliance === 'M') {
        const defectText = [resp.defect, resp.correctiveAction].filter(Boolean).join(' → ');
        issueItems.push({
          sectionTitle: resp._area || 'Unknown Area',
          itemId: key,
          itemLabel: resp._label || key,
          result: resp.compliance === 'U' ? 'fail' : 'reclean',
          comment: defectText || undefined,
        });
      }
    }
  }

  // Photo gallery from fail/reclean items
  const galleryPhotos = issueItems.filter((i) => i.photoUrl).map(i => ({ photoUrl: i.photoUrl!, itemLabel: i.itemLabel, sectionTitle: i.sectionTitle }));
  
  // Add globally extracted photos (from email scraping / photo PDF)
  const rawGlobalPhotos = (responses as unknown as Record<string, unknown>).global_photos;
  if (Array.isArray(rawGlobalPhotos)) {
    (rawGlobalPhotos as string[]).forEach((url, idx) => {
      galleryPhotos.push({
        photoUrl: url,
        itemLabel: `Photo ${idx + 1}`,
        sectionTitle: 'Pre-Op Photo Evidence',
      });
    });
  }

  // Worst-scoring section
  const sectionScoreEntries = sections
    .map((s) => ({ title: s.title, score: sectionScores[s.id]?.score ?? null }))
    .filter((s) => s.score !== null) as { title: string; score: number }[];
  const worstSection =
    sectionScoreEntries.length > 0
      ? sectionScoreEntries.reduce((a, b) => (a.score < b.score ? a : b))
      : null;

  // Pattern set for quick lookup
  const patternIds = new Set((analysis?.patterns ?? []).filter((p) => p.failRate >= 30).map((p) => p.itemId));

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className={shared.pageContainer}>

      {/* ── PAGE HEADER ────────────────────────────────────── */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div style={{ flex: 1 }}>
            <Link href="/reports/pre-op" className={styles.backLink}>← Back to Reports</Link>
            <h1 className={shared.pageTitle}>{submission.template_name}</h1>
            <p className={shared.pageSubtitle}>
              Submitted by {submission.submitted_by ?? 'Unknown'} ·{' '}
              {formatDate(submission.submitted_at ?? submission.created_at)}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={submission.pdf_url || `/api/forms/submissions/${id}/pdf`}
                className={styles.actionBtnPrimary}
                download
                target={submission.pdf_url ? '_blank' : undefined}
                rel={submission.pdf_url ? 'noopener noreferrer' : undefined}
              >
                📄 {submission.pdf_url ? 'View Original PDF' : 'Download PDF'}
              </a>
              {canEdit && (
                <button
                  className={styles.actionBtnDanger}
                  onClick={() => { void handleDelete(); }}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : '🗑 Delete Report'}
                </button>
              )}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="MJ Hygiene Compliance Portal"
            style={{ height: '90px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '6px 12px', flexShrink: 0 }}
          />
        </div>
      </div>

      {/* ── SECTION 1: SUMMARY ─────────────────────────────── */}
      <div className={styles.summaryGrid}>
        {/* Score ring */}
        {score !== null && (
          <div className={styles.scoreRing}>
            <div
              className={styles.scoreRingCircle}
              style={
                {
                  '--ring-color': scoreColor(score),
                  '--score': score,
                } as React.CSSProperties
              }
            >
              <div className={styles.scoreRingInner}>
                <span className={styles.scoreRingValue} style={{ color: scoreColor(score) }}>
                  {formatScore(score)}%
                </span>
                <span className={styles.scoreRingLabel}>{scoreLabel(score)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Meta cards */}
        <div className={styles.summaryMeta}>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Inspector</div>
            <div className={styles.metaValue}>{submission.submitted_by ?? '—'}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Date</div>
            <div className={styles.metaValue}>
              {formatDate(submission.submitted_at ?? submission.created_at)}
              {analysis?.previousScore !== undefined && analysis.previousScore !== null && score !== null && (
                <span
                  className={`${styles.deltaChip} ${score >= analysis.previousScore ? styles.deltaPos : styles.deltaNeg}`}
                >
                  {score >= analysis.previousScore ? '▲' : '▼'}{' '}
                  {formatScore(Math.abs(score - analysis.previousScore))}% vs prev
                </span>
              )}
            </div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Area</div>
            <div className={styles.metaValue}>{submission.area ?? '—'}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>Form Type</div>
            <div className={styles.metaValue}>{submission.template_name}</div>
          </div>
        </div>

        {/* Stat strip */}
        <div className={styles.statStrip}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{submission.score_total ?? 0}</span>
            <span className={styles.statLbl}>Assessed</span>
          </div>
          <div className={`${styles.statCard} ${styles.statPass}`}>
            <span className={styles.statNum} style={{ color: '#10b981' }}>{submission.score_pass ?? 0}</span>
            <span className={styles.statLbl}>Pass</span>
          </div>
          <div className={`${styles.statCard} ${styles.statReclean}`}>
            <span className={styles.statNum} style={{ color: '#f59e0b' }}>{submission.score_reclean ?? 0}</span>
            <span className={styles.statLbl}>Re-Clean</span>
          </div>
          <div className={`${styles.statCard} ${styles.statFail}`}>
            <span className={styles.statNum} style={{ color: '#ef4444' }}>{submission.score_fail ?? 0}</span>
            <span className={styles.statLbl}>Fail</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CHARTS ──────────────────────────────── */}
      {(sections.length > 0 || Object.keys(sectionScores).length > 0) && (
        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <p className={styles.chartTitle}>Section Scores</p>
            <SectionScoreChart sections={sections} sectionScores={sectionScores} />
          </div>
          <div className={styles.chartCard}>
            <p className={styles.chartTitle}>Score Trend — Last {(analysis?.trend?.length ?? 0) + 1} Reports</p>
            <TrendChart trend={analysis?.trend ?? []} currentScore={score} />
            {analysis?.averageScore !== null && analysis?.averageScore !== undefined && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                Avg across {analysis.trend.length} prior submissions:{' '}
                <strong style={{ color: scoreColor(analysis.averageScore) }}>{formatScore(analysis.averageScore)}%</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 3: ISSUES & PHOTO GALLERY ──────────────── */}
      <div className={styles.issuesSectionWrap}>
        <div className={styles.issuesSectionHeader}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            ⚠️ Issues Requiring Attention
          </h2>
          {issueItems.length > 0 && (
            <span className={styles.issuesCount}>{issueItems.length}</span>
          )}
        </div>

        {issueItems.length === 0 ? (
          <div className={styles.noIssuesCard}>✓ No Issues Found — All items passed inspection</div>
        ) : (
          issueItems.map((issue, idx) => {
            const pattern = analysis?.patterns.find((p) => p.itemId === issue.itemId);
            const isRepeated = patternIds.has(issue.itemId);
            return (
              <div
                key={`${issue.itemId}-${idx}`}
                className={`${styles.issueCard} ${issue.result === 'fail' ? styles.issueFail : styles.issueReclean}`}
              >
                <span className={styles.issueSectionTag}>{issue.sectionTitle}</span>
                <span className={styles.issueLabel}>{issue.itemLabel}</span>
                <span
                  className={`${styles.issueResultBadge} ${issue.result === 'fail' ? styles.badgeFail : styles.badgeReclean}`}
                >
                  {issue.result === 'fail' ? '✗ FAIL' : '↺ RE-CLEAN'}
                </span>
                {issue.comment && <span className={styles.issueComment}>{issue.comment}</span>}
                {isRepeated && pattern && (
                  <span className={styles.repeatedFlag}>
                    🔁 Repeated Issue — failed in {pattern.failRate}% of last {pattern.totalCount} inspections
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Photo gallery */}
        {galleryPhotos.length > 0 && (
          <>
            <p className={styles.reportSectionHeading} style={{ marginTop: '1.25rem' }}>
              Photo Evidence ({galleryPhotos.length})
            </p>
            <div className={styles.photoGallery}>
              {galleryPhotos.map((photo, idx) => (
                <a
                  key={idx}
                  href={photo.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.photoItem}
                  style={{ textDecoration: 'none' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.photoUrl} alt={photo.itemLabel} className={styles.photoImg} />
                  <div className={styles.photoCaption}>
                    {photo.itemLabel} · {photo.sectionTitle}
                  </div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── SECTION 4: FULL INSPECTION REPORT (collapsible) ── */}
      <div
        className={styles.fullReportToggle}
        onClick={() => setFullReportOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFullReportOpen((v) => !v); }}
      >
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>📋 Full Inspection Report</span>
        <span className={`${styles.toggleIcon} ${fullReportOpen ? styles.toggleIconOpen : ''}`}>▼</span>
      </div>

      {fullReportOpen && (
        <div className={styles.fullReportContent}>
          {/* Standard template-based rendering */}
          {sections.map((section) => {
            const sc = sectionScores[section.id];
            const sectionItems = section.items.filter(
              (item) => responses[item.id]?.result !== undefined && responses[item.id]?.result !== null
            );
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.id} className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{section.title}</h2>
                  {sc && (
                    <span className={styles.sectionScore} style={{ color: scoreColor(sc.score) }}>
                      {formatScore(sc.score)}%
                    </span>
                  )}
                </div>
                <div className={styles.itemList}>
                  {section.items.map((item) => {
                    const resp = responses[item.id];
                    if (!resp?.result) return null;
                    return (
                      <div key={item.id} className={`${styles.itemRow} ${styles[`item_${resp.result}`]}`}>
                        <span className={styles.itemResultBadge}>
                          {resp.result === 'pass' ? '✓' : resp.result === 'fail' ? '✗' : '↺'}
                        </span>
                        <div className={styles.itemContent}>
                          <span className={styles.itemLabel}>{item.label}</span>
                          {resp.comment && <span className={styles.itemComment}>{resp.comment}</span>}
                        </div>
                        {resp.photoUrl && (
                          <a href={resp.photoUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={resp.photoUrl} alt="Evidence" className={styles.photoThumb} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* AI-ingested client-pre-op fallback: group by _area */}
          {sections.length === 0 && submission.template_slug === 'client-pre-op' && (() => {
            const rawResp = responses as unknown as Record<string, Record<string, string>>;
            const areaGroups: Record<string, Array<{ key: string; label: string; result: string; compliance: string; defect: string; correctiveAction: string }>> = {};
            for (const [key, resp] of Object.entries(rawResp)) {
              if (key.startsWith('_') || !resp || typeof resp !== 'object') continue;
              if (!resp.result && !resp.compliance) continue;
              const area = resp._area || 'Other';
              if (!areaGroups[area]) areaGroups[area] = [];
              areaGroups[area].push({
                key,
                label: resp._label || key,
                result: resp.result || (resp.compliance === 'U' ? 'fail' : resp.compliance === 'M' ? 'marginal' : 'pass'),
                compliance: resp.compliance || '',
                defect: resp.defect || '',
                correctiveAction: resp.correctiveAction || '',
              });
            }
            return Object.entries(areaGroups).map(([areaName, items]) => {
              const sc = sectionScores[areaName];
              return (
                <div key={areaName} className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{areaName}</h2>
                    {sc && (
                      <span className={styles.sectionScore} style={{ color: scoreColor(sc.score) }}>
                        {formatScore(sc.score)}%
                      </span>
                    )}
                  </div>
                  <div className={styles.itemList}>
                    {items.map((item) => {
                      const resultClass = item.result === 'pass' ? 'item_pass' : item.result === 'fail' ? 'item_fail' : 'item_reclean';
                      const badge = item.compliance === 'A' ? '✓ A' : item.compliance === 'M' ? '↺ M' : item.compliance === 'U' ? '✗ U' : '✓';
                      const defectText = [item.defect, item.correctiveAction].filter(Boolean).join(' → ');
                      return (
                        <div key={item.key} className={`${styles.itemRow} ${styles[resultClass] || ''}`}>
                          <span className={styles.itemResultBadge}>{badge}</span>
                          <div className={styles.itemContent}>
                            <span className={styles.itemLabel}>{item.label}</span>
                            {defectText && <span className={styles.itemComment}>{defectText}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {/* AI-ingested swab results: show all tested locations */}
          {submission.template_slug === 'daily-swabs' && (() => {
            const rawResp = responses as unknown as Record<string, Record<string, string>>;
            const swabItems: Array<{ key: string; location: string; result: string; notes: string }> = [];
            for (const [key, resp] of Object.entries(rawResp)) {
              if (!key.startsWith('swab_') || !resp || typeof resp !== 'object') continue;
              swabItems.push({
                key,
                location: resp.location || resp._label || key,
                result: resp.result || 'pass',
                notes: resp.notes || '',
              });
            }
            swabItems.sort((a, b) => a.location.localeCompare(b.location));
            if (swabItems.length === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No swab test data available.</p>;
            return (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Surface Monitoring — {swabItems.length} Locations Tested</h2>
                </div>
                <div className={styles.itemList}>
                  {swabItems.map((item) => {
                    const resultClass = item.result === 'fail' ? 'item_fail' : 'item_pass';
                    return (
                      <div key={item.key} className={`${styles.itemRow} ${styles[resultClass] || ''}`}>
                        <span className={styles.itemResultBadge}>
                          {item.result === 'fail' ? '✗' : '✓'}
                        </span>
                        <div className={styles.itemContent}>
                          <span className={styles.itemLabel}>{item.location}</span>
                          {item.notes && <span className={styles.itemComment}>{item.notes}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── SECTION 5: CONCLUSION & RECOMMENDATIONS ────────── */}
      <div className={styles.conclusionCard}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 0, marginBottom: '1rem' }}>
          📝 Conclusion &amp; Recommendations
        </h2>

        {score !== null && (
          <p className={styles.conclusionScore} style={{ color: scoreColor(score) }}>
            This inspection recorded an overall score of {formatScore(score)}%.
          </p>
        )}

        <p className={styles.conclusionText}>
          {score === null
            ? 'No score was calculated for this inspection.'
            : score >= 95
            ? 'The facility met or exceeded compliance standards. Excellent work — continue to maintain current practices.'
            : score >= 85
            ? 'Minor issues were identified requiring attention. Review flagged items and action within the next scheduled cleaning cycle.'
            : score >= 70
            ? 'Several areas require corrective action before next operation. Prioritise the items below and re-inspect promptly.'
            : 'Significant compliance failures detected. Immediate corrective action is required before resuming operations.'}
        </p>

        {/* Fail items */}
        {(() => {
          const failItems = issueItems.filter((i) => i.result === 'fail').slice(0, 3);
          if (failItems.length === 0) return null;
          return (
            <>
              <p className={styles.conclusionText}>
                <strong>{issueItems.filter((i) => i.result === 'fail').length} item(s)</strong> were
                marked as FAIL and require immediate corrective action:
              </p>
              <ul className={styles.conclusionList}>
                {failItems.map((item, i) => (
                  <li key={i}>{item.itemLabel} <em style={{ color: 'var(--text-secondary)' }}>({item.sectionTitle})</em></li>
                ))}
              </ul>
            </>
          );
        })()}

        {/* Reclean items */}
        {(() => {
          const recleanItems = issueItems.filter((i) => i.result === 'reclean').slice(0, 3);
          if (recleanItems.length === 0) return null;
          return (
            <>
              <p className={styles.conclusionText}>
                <strong>{issueItems.filter((i) => i.result === 'reclean').length} item(s)</strong> require re-cleaning:
              </p>
              <ul className={styles.conclusionList}>
                {recleanItems.map((item, i) => (
                  <li key={i}>{item.itemLabel} <em style={{ color: 'var(--text-secondary)' }}>({item.sectionTitle})</em></li>
                ))}
              </ul>
            </>
          );
        })()}

        {/* Worst section */}
        {worstSection && (
          <p className={styles.conclusionText}>
            The <strong>{worstSection.title}</strong> section scored lowest at{' '}
            <strong style={{ color: scoreColor(worstSection.score) }}>{formatScore(worstSection.score)}%</strong>.
          </p>
        )}

        {/* Pattern alerts */}
        {analysis && (
          <div className={styles.conclusionPatterns}>
            <p className={styles.conclusionPatternsTitle}>🔁 Recurring Issue Patterns</p>
            {analysis.patterns.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                No recurring issues detected across recent inspections.
              </p>
            ) : (
              analysis.patterns.map((p, i) => (
                <div key={i} className={styles.conclusionPatternItem}>
                  <span>
                    {p.itemLabel}
                    {p.sectionTitle && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {' '}— {p.sectionTitle}
                      </span>
                    )}
                  </span>
                  <span className={styles.conclusionPatternRate}>{p.failRate}% fail rate</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes */}
        <div className={styles.section} style={{ marginTop: '1.5rem', marginBottom: 0 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Notes
              {canEdit && !editingNotes && (
                <button
                  className={styles.editNotesBtn}
                  onClick={() => {
                    setNotesValue(submission.notes ?? '');
                    setEditingNotes(true);
                  }}
                >
                  Edit
                </button>
              )}
            </h2>
          </div>
          {editingNotes ? (
            <div style={{ padding: '1rem 1.25rem' }}>
              <textarea
                className={styles.notesEditArea}
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
              />
              <div className={styles.notesActions}>
                <button className={styles.notesSaveBtn} onClick={() => { void handleSaveNotes(); }}>
                  Save
                </button>
                <button className={styles.notesCancelBtn} onClick={() => setEditingNotes(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.notesText}>{submission.notes || '—'}</p>
          )}
        </div>

        {/* Reclean Sign Off Panel */}
        {submission.template_slug === 'client-pre-op' && submission.score_reclean !== null && submission.score_reclean > 0 && (
          <div className={styles.section} style={{ marginTop: '1.5rem', marginBottom: 0, border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle} style={{ color: '#f59e0b' }}>
                Supervisor Reclean Sign-Off
              </h2>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              {submission.reclean_signed_off_by ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Recleans Signed Off</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Signed by <strong>{submission.reclean_signed_off_by}</strong> on {formatDate(submission.reclean_signed_off_at)}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {submission.score_reclean} item(s) were marked for re-cleaning. Once resolved, a supervisor must sign off below.
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Supervisor Name..."
                      value={signature}
                      onChange={e => setSignature(e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', flex: 1 }}
                    />
                    <button
                      onClick={() => { void handleSignOff(); }}
                      disabled={signingOff}
                      style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {signingOff ? 'Signing...' : 'Sign Off'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
