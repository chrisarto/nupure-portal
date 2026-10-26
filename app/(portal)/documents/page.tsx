'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import shared from '../shared.module.css';
import styles from './Documents.module.css';
import type { TrainingDocument } from '@/lib/types';
import { CSVExportButton } from '@/app/components/ui/CSVExportButton';
import AttachmentLink from '@/app/components/AttachmentLink';

/* ── Cover image mapping by normalised document type ──────────── */
const COVER_MAP: Record<string, string> = {
  'work method statement': '/covers/procedures.jpg',
  'client training': '/covers/training.jpg',
  'induction': '/covers/inductions.jpg',
  'certificate': '/covers/certificates.jpg',
  'insurance': '/covers/other.jpg',
  'manual': '/covers/other.jpg',
};

/* ── Category tabs ────────────────────────────────────────────── */
interface TabDef { label: string; match: (t: string) => boolean }
const TABS: TabDef[] = [
  { label: 'All', match: () => true },
  { label: 'Procedures', match: (t) => t === 'work method statement' },
  { label: 'Training', match: (t) => t === 'client training' },
  { label: 'Inductions', match: (t) => t === 'induction' },
  { label: 'Certificates', match: (t) => t === 'certificate' },
  { label: 'Other', match: (t) => ['insurance', 'manual', ''].includes(t) },
];

function normType(raw: string | undefined): string {
  return (raw || '').trim().toLowerCase();
}

function getCover(docType: string): string {
  return COVER_MAP[normType(docType)] || '/covers/procedures.jpg';
}

function getCategoryLabel(docType: string): string {
  const t = normType(docType);
  if (t === 'work method statement') return 'Procedure';
  if (t === 'client training') return 'Client Training';
  if (t === 'induction') return 'Induction';
  if (t === 'certificate') return 'Certificate';
  if (t === 'insurance') return 'Insurance';
  if (t === 'manual') return 'Manual';
  return docType || 'Document';
}

function getStatusBadge(status: string): { cls: string; label: string } {
  const s = (status || '').toLowerCase();
  if (s.includes('control document')) return { cls: styles.badgeControlled, label: '✓ Controlled' };
  if (s.includes('review')) return { cls: styles.badgeReview, label: '⟳ Under Review' };
  if (s.includes('out of date')) return { cls: styles.badgeOutdated, label: '⚠ Out of Date' };
  return { cls: styles.badgeDefault, label: status || 'Unknown' };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [areaFilter, setAreaFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const json: { data: TrainingDocument[] } = await res.json();
      setDocuments(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const onSync = () => void fetchData();
    window.addEventListener('gotzinger-sync-complete', onSync);
    return () => window.removeEventListener('gotzinger-sync-complete', onSync);
  }, [fetchData]);

  /* ── Derived data ──────────────────────────────────────────── */
  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) {
      if (d.roomArea && Array.isArray(d.roomArea)) {
        for (const a of d.roomArea) set.add(a);
      }
    }
    return Array.from(set).sort();
  }, [documents]);

  const tabCounts = useMemo(() => {
    return TABS.map((tab) =>
      documents.filter((d) => tab.match(normType(d.documentType))).length
    );
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const tab = TABS[activeTab];

    return documents.filter((doc) => {
      // Tab filter
      if (!tab.match(normType(doc.documentType))) return false;

      // Search
      if (q && !(
        doc.longName?.toLowerCase().includes(q) ||
        doc.documentCode?.toLowerCase().includes(q)
      )) return false;

      // Area filter
      if (areaFilter) {
        const docAreas = Array.isArray(doc.roomArea) ? doc.roomArea : [];
        if (!docAreas.some((a) => a.toLowerCase().includes(areaFilter.toLowerCase()))) return false;
      }

      return true;
    });
  }, [documents, search, activeTab, areaFilter]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <>
      {/* Page header */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Document Library</h1>
            <p className={shared.pageDescription}>
              Browse Nu-Pure procedures, training materials, certificates and policies
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={shared.recordCount}>{filtered.length} documents</span>
            <CSVExportButton
              filename={`documents-${new Date().toISOString().split('T')[0]}.csv`}
              rows={filtered.map((d) => ({
                Code: d.documentCode,
                Name: d.longName,
                Type: d.documentType,
                Status: d.status,
                Version: d.versionNumber,
                Reviewed: d.reviewedDate,
                'Next Review': d.nextReviewDate,
              }))}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {TABS.map((tab, idx) => (
          <button
            key={tab.label}
            className={`${styles.tab} ${activeTab === idx ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            {tab.label}
            <span className={styles.tabCount}>{tabCounts[idx]}</span>
          </button>
        ))}
      </div>

      {/* Search & area filter */}
      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="🔍  Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {areas.length > 0 && (
          <select
            className={shared.filterSelect}
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="">All Areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className={styles.tileGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tileSkeleton}>
              <div className={styles.tileSkeletonCover} />
              <div className={styles.tileSkeletonBody}>
                <div className={shared.skeleton} style={{ width: '40%', height: 12, marginBottom: 8 }} />
                <div className={shared.skeleton} style={{ width: '90%', height: 16, marginBottom: 6 }} />
                <div className={shared.skeleton} style={{ width: '70%', height: 12, marginBottom: 16 }} />
                <div className={shared.skeleton} style={{ width: '100%', height: 36, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Failed to load documents</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchData()}>Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📋</div>
          <div className={shared.emptyTitle}>No documents found</div>
          <div className={shared.emptyText}>Try adjusting your search or switching tabs.</div>
        </div>
      )}

      {/* Tile grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className={styles.tileGrid}>
          {filtered.map((doc) => {
            const badge = getStatusBadge(doc.status);
            const hasAttachment = doc.documentUpload && doc.documentUpload.length > 0;
            const hasScorm = !!(doc as unknown as Record<string, unknown>).scormUrl;

            return (
              <div key={doc.id} className={styles.tile}>
                {/* Cover image */}
                <div className={styles.tileCover}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCover(doc.documentType)}
                    alt=""
                    className={styles.tileCoverImg}
                    loading="lazy"
                  />
                  <span className={`${styles.tileBadge} ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Card body */}
                <div className={styles.tileBody}>
                  {/* Category eyebrow */}
                  <span className={styles.tileCategory}>
                    {getCategoryLabel(doc.documentType)}
                  </span>

                  {/* Title */}
                  <h3 className={styles.tileTitle}>
                    {doc.documentCode ? `${doc.documentCode}` : ''}{doc.documentCode && doc.longName ? ' — ' : ''}{doc.longName?.trim() || 'Untitled'}
                  </h3>

                  {/* Meta row */}
                  <div className={styles.tileMeta}>
                    {doc.versionNumber && (
                      <span className={styles.tileMetaItem}>
                        📋 v{doc.versionNumber}
                      </span>
                    )}
                    {doc.nextReviewDate && (
                      <span className={styles.tileMetaItem}>
                        🕐 Review: {formatDate(doc.nextReviewDate)}
                      </span>
                    )}
                    {doc.roomArea && doc.roomArea.length > 0 && (
                      <span className={styles.tileMetaItem}>
                        📍 {Array.isArray(doc.roomArea) ? doc.roomArea.join(', ') : doc.roomArea}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div className={styles.tileCta}>
                    {hasAttachment && (
                      <AttachmentLink
                        attachment={doc.documentUpload![0]}
                        label="📄 View Document"
                        className={styles.tileBtn}
                      />
                    )}
                    {!hasAttachment && hasScorm && (
                      <a
                        href={(doc as unknown as Record<string, unknown>).scormUrl as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.tileBtn}
                      >
                        🎓 Open Course
                      </a>
                    )}
                    {!hasAttachment && !hasScorm && (
                      <span className={styles.tileBtnDisabled}>No attachment</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
