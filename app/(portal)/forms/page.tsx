'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import shared from '@/app/(portal)/shared.module.css';
import styles from './Forms.module.css';
import type { FormSubmission } from '@/lib/types';

interface TemplateCard {
  id: string;
  name: string;
  slug: string;
  description: string;
  form_type: string;
  is_active: boolean;
  version: number;
  created_at: string;
}

function getBadgeInfo(form_type: string): { label: string; cls: string; accent: string } {
  switch (form_type) {
    case 'pre_op':
      return { label: 'Pre-Op Check', cls: styles.badgeBlue, accent: styles.accentBlue };
    case 'handover':
      return { label: 'Handover', cls: styles.badgeAmber, accent: styles.accentAmber };
    default:
      return { label: form_type, cls: styles.badgeTeal, accent: styles.accentTeal };
  }
}

/** Maps a form slug/type to its reports page */
function getReportsUrl(slug: string, form_type: string): string {
  if (form_type === 'handover' || slug.includes('handover')) return '/reports/handover';
  if (form_type === 'pre_op' || slug.includes('pre-op') || slug.includes('weekly')) return '/reports/pre-op';
  return '/reports/pre-op';
}

function getThisWeekCount(submissions: FormSubmission[], slug: string): number {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return submissions.filter((s) => {
    if (s.template_slug !== slug) return false;
    const created = new Date(s.created_at);
    return created >= weekAgo;
  }).length;
}

export default function FormsPage() {
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch('/api/forms/templates'),
          fetch('/api/forms/submissions'),
        ]);

        if (!tRes.ok) throw new Error('Failed to load form templates');
        const tJson = await tRes.json() as { data: TemplateCard[] };
        setTemplates(tJson.data ?? []);

        if (sRes.ok) {
          const sJson = await sRes.json() as { data: FormSubmission[] };
          setSubmissions(sJson.data ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>📋 Inspection Forms</h1>
            <p className={shared.pageDescription}>
              Replace JotForm — fill out inspections directly in the portal
            </p>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Could not load forms</div>
          <div className={shared.errorText}>{error}</div>
        </div>
      )}

      {/* ── Loading skeletons ───────────────────────────────────── */}
      {loading && !error && (
        <div className={styles.formGrid}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!loading && !error && templates.length === 0 && (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📋</div>
          <div className={shared.emptyTitle}>No forms available</div>
          <div className={shared.emptyText}>
            No active form templates found. Ask an admin to create one.
          </div>
        </div>
      )}

      {/* ── Form Grid ───────────────────────────────────────────── */}
      {!loading && templates.length > 0 && (
        <div className={styles.formGrid}>
          {templates.map((template) => {
            const { label, cls, accent } = getBadgeInfo(template.form_type);
            const weekCount = getThisWeekCount(submissions, template.slug);

            return (
              <article key={template.id} className={`${styles.formCard} ${accent}`}>
                <span className={`${styles.cardBadge} ${cls}`}>{label}</span>

                <h2 className={styles.cardTitle}>{template.name}</h2>

                {template.description && (
                  <p className={styles.cardDesc}>{template.description}</p>
                )}

                <p className={styles.cardMeta}>
                  <span>📊</span>
                  <span>
                    {weekCount > 0
                      ? `${weekCount} submission${weekCount !== 1 ? 's' : ''} this week`
                      : 'No submissions this week'}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>v{template.version}</span>
                </p>

                <div className={styles.cardActions}>
                  <Link href={`/forms/${template.slug}`} className={styles.startBtn}>
                    ▶ Start Form
                  </Link>
                  <Link
                    href={getReportsUrl(template.slug, template.form_type)}
                    className={styles.submissionsLink}
                  >
                    View results →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
