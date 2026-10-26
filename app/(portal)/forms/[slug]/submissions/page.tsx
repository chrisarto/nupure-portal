'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import shared from '@/app/(portal)/shared.module.css';
import { SortableTable } from '@/app/components/ui/SortableTable';
import { CSVExportButton } from '@/app/components/ui/CSVExportButton';
import type { Column } from '@/app/components/ui/SortableTable';
import type { FormSubmission } from '@/lib/types';

type StatusFilter = 'all' | 'draft' | 'submitted';

interface SubmissionRow extends Record<string, unknown> {
  id: string;
  date: string;
  inspector: string;
  area: string;
  score: string;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreDisplay(overall: number | null): string {
  if (overall === null) return '—';
  return `${overall}%`;
}

function toRows(submissions: FormSubmission[]): SubmissionRow[] {
  return submissions.map((s) => ({
    id: s.id,
    date: formatDate(s.submitted_at ?? s.created_at),
    inspector: s.submitted_by || s.submitted_by_email || '—',
    area: s.area || '—',
    score: scoreDisplay(s.overall_score),
    status: s.status,
    pdf_url: s.pdf_url,
    created_at: s.created_at,
  }));
}

const COLUMNS: Column<SubmissionRow>[] = [
  { key: 'date',      label: 'Date',       sortable: true },
  { key: 'inspector', label: 'Inspector',   sortable: true },
  { key: 'area',      label: 'Area',        sortable: true },
  {
    key: 'score',
    label: 'Score',
    sortable: true,
    render: (row) => {
      const val = parseFloat(row.score as string);
      const color = isNaN(val) ? 'var(--text-muted)'
        : val >= 90 ? '#10b981'
        : val >= 70 ? '#f59e0b'
        : '#ef4444';
      return <strong style={{ color }}>{row.score as string}</strong>;
    },
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (row) => {
      const isDraft = (row.status as string) === 'draft';
      return (
        <span
          className={`${shared.badge} ${isDraft ? shared.badgeAmber : shared.badgeGreen}`}
        >
          {isDraft ? 'Draft' : 'Submitted'}
        </span>
      );
    },
  },
  {
    key: 'pdf_url',
    label: 'PDF',
    render: (row) =>
      row.pdf_url ? (
        <a
          href={row.pdf_url as string}
          target="_blank"
          rel="noopener noreferrer"
          className={shared.downloadBtn}
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', marginTop: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          ↓ PDF
        </a>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
      ),
  },
];

export default function SubmissionsPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      try {
        // Fetch template name for heading
        const tRes = await fetch(`/api/forms/templates/${slug}`);
        if (tRes.ok) {
          const tJson = await tRes.json() as { data: { name: string } };
          setTemplateName(tJson.data?.name ?? slug);
        }

        // Fetch all submissions (filter client-side for flexibility)
        const sRes = await fetch('/api/forms/submissions');
        if (!sRes.ok) throw new Error('Failed to load submissions');
        const sJson = await sRes.json() as { data: FormSubmission[] };
        const forSlug = (sJson.data ?? []).filter((s) => s.template_slug === slug);
        setSubmissions(forSlug);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  const rows = useMemo(() => toRows(filtered), [filtered]);

  const csvRows = useMemo(
    () =>
      filtered.map((s) => ({
        Date: formatDate(s.submitted_at ?? s.created_at),
        Inspector: s.submitted_by || s.submitted_by_email,
        Area: s.area,
        Score: scoreDisplay(s.overall_score),
        Pass: s.score_pass ?? 0,
        Fail: s.score_fail ?? 0,
        ReClean: s.score_reclean ?? 0,
        Total: s.score_total ?? 0,
        Status: s.status,
        Notes: s.notes,
      })),
    [filtered]
  );

  const PILLS: { label: string; value: StatusFilter }[] = [
    { label: `All (${submissions.length})`, value: 'all' },
    { label: `Submitted (${submissions.filter((s) => s.status === 'submitted').length})`, value: 'submitted' },
    { label: `Drafts (${submissions.filter((s) => s.status === 'draft').length})`, value: 'draft' },
  ];

  return (
    <div>
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>
              📋 {templateName ? `${templateName} — History` : 'Submission History'}
            </h1>
            <p className={shared.pageDescription}>
              Past inspection submissions for this form template
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <CSVExportButton
              filename={`${slug}-submissions`}
              rows={csvRows as Record<string, unknown>[]}
              disabled={filtered.length === 0}
            />
            <Link
              href={`/forms/${slug}`}
              className={shared.downloadBtn}
              style={{ marginTop: 0 }}
            >
              ＋ New Inspection
            </Link>
          </div>
        </div>
      </div>

      {/* ── Status Filter Pills ─────────────────────────────────── */}
      <div className={shared.filterPills}>
        {PILLS.map((pill) => (
          <button
            key={pill.value}
            className={`${shared.filterPill} ${statusFilter === pill.value ? shared.filterPillActive : ''}`}
            onClick={() => setStatusFilter(pill.value)}
            type="button"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Could not load submissions</div>
          <div className={shared.errorText}>{error}</div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && !error && (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading submissions…
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      {!loading && !error && (
        <SortableTable<SubmissionRow>
          columns={COLUMNS}
          data={rows}
          rowKey={(row) => row.id}
          emptyIcon="📋"
          emptyTitle="No submissions yet"
          emptyText={
            statusFilter === 'all'
              ? 'Start a new inspection to see results here.'
              : `No ${statusFilter} submissions found.`
          }
        />
      )}

      {/* ── Back link ───────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem' }}>
        <Link
          href="/forms"
          style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          ← All Forms
        </Link>
      </div>
    </div>
  );
}
