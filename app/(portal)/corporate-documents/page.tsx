'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import shared from '../shared.module.css';
import { useCurrentUser } from '@/lib/useCurrentUser';

interface CorporateDocument {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  file_type: string | null;
  version: number;
  uploaded_by: string | null;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'ISO Certificates': '🏅',
  'PPE': '🦺',
  'Lockout/Tagout': '🔒',
  'HR Policies': '📜',
  'WHS / Safety': '⚠️',
  'Environmental': '🌿',
  'Quality': '✅',
  'General': '📁',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getExpiryInfo(expiryDate: string | null): { text: string; color: string; badgeClass: string } {
  if (!expiryDate) return { text: 'No expiry', color: 'var(--text-secondary)', badgeClass: shared.badgeGray };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `Expired ${Math.abs(days)}d ago`, color: '#dc2626', badgeClass: shared.badgeRed };
  if (days === 0) return { text: 'Expires today', color: '#f59e0b', badgeClass: shared.badgeAmber };
  if (days <= 30) return { text: `${days}d until expiry`, color: '#f59e0b', badgeClass: shared.badgeAmber };
  return { text: `${days}d`, color: '#10b981', badgeClass: shared.badgeGreen };
}

export default function CorporateDocumentsPage() {
  const { user } = useCurrentUser();
  const canEdit = user?.canEdit ?? false;

  const [documents, setDocuments] = useState<CorporateDocument[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/corporate-documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const json = await res.json() as { data: CorporateDocument[]; categories: string[] };
      setDocuments(json.data ?? []);
      setCategories(json.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        doc.title.toLowerCase().includes(q) ||
        doc.file_name.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q);
      const matchCategory = !categoryFilter || doc.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [documents, search, categoryFilter]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: Record<string, CorporateDocument[]> = {};
    for (const doc of filtered) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  async function handleDownload(docId: string) {
    setDownloadingId(docId);
    try {
      const res = await fetch(`/api/corporate-documents/${docId}`);
      const json = await res.json() as { download_url?: string };
      if (json.download_url) {
        window.open(json.download_url, '_blank');
      }
    } catch {
      // silent fail
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Remove this document? It will be hidden but not permanently deleted.')) return;
    const res = await fetch(`/api/corporate-documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle || !uploadCategory) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle);
    formData.append('category', uploadCategory);
    if (uploadDescription) formData.append('description', uploadDescription);
    if (uploadExpiry) formData.append('expiry_date', uploadExpiry);

    try {
      const res = await fetch('/api/corporate-documents', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Upload failed');
      }
      // Reset form and refresh
      setUploadTitle('');
      setUploadCategory('');
      setUploadDescription('');
      setUploadExpiry('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowUpload(false);
      await fetchData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const getCategoryAccent = (cat: string): string => {
    switch (cat) {
      case 'ISO Certificates': return shared.cardAccentGreen;
      case 'PPE': case 'WHS / Safety': return shared.cardAccentAmber;
      case 'Lockout/Tagout': return shared.cardAccentRed;
      case 'HR Policies': return shared.cardAccentBlue;
      default: return shared.cardAccentBlue;
    }
  };

  return (
    <>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Corporate Documents</h1>
            <p className={shared.pageDescription}>ISO certificates, policies, procedures and compliance documents</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={shared.recordCount}>{filtered.length} documents</span>
            {canEdit && (
              <button
                className={shared.downloadBtn}
                onClick={() => setShowUpload(!showUpload)}
              >
                {showUpload ? '✕ Cancel' : '📤 Upload Document'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div style={{
          background: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Upload New Document</h3>
          <form onSubmit={(e) => { void handleUpload(e); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Title *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. ISO 22000:2018 Certificate"
                required
                className={shared.searchInput}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Category *</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                required
                className={shared.filterSelect}
                style={{ width: '100%' }}
              >
                <option value="">Select category...</option>
                {categories.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || '📁'} {c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Expiry Date</label>
              <input
                type="date"
                value={uploadExpiry}
                onChange={(e) => setUploadExpiry(e.target.value)}
                className={shared.filterSelect}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Description</label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Optional notes about this document"
                className={shared.searchInput}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>File *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
                style={{ fontSize: '0.9rem' }}
              />
            </div>
            {uploadError && (
              <div style={{ gridColumn: '1 / -1', color: '#dc2626', fontSize: '0.9rem', background: 'rgba(239,68,68,0.08)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                ⚠️ {uploadError}
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <button
                type="submit"
                disabled={uploading || !uploadFile || !uploadTitle || !uploadCategory}
                className={shared.downloadBtn}
                style={{ opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? '⏳ Uploading...' : '📤 Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="🔍  Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={shared.filterPills}>
        <button
          className={`${shared.filterPill} ${categoryFilter === '' ? shared.filterPillActive : ''}`}
          onClick={() => setCategoryFilter('')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${shared.filterPill} ${categoryFilter === cat ? shared.filterPillActive : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {CATEGORY_ICONS[cat] || '📁'} {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className={shared.tableWrapper}>
          <div className={shared.skeleton} style={{ height: '200px' }} />
        </div>
      ) : error ? (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Failed to load documents</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchData()}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📁</div>
          <div className={shared.emptyTitle}>No corporate documents found</div>
          <div className={shared.emptyText}>
            {documents.length === 0
              ? 'Upload your first document to get started.'
              : 'Try adjusting your search or filters.'}
          </div>
        </div>
      ) : (
        <div>
          {grouped.map(([category, docs]) => (
            <div key={category} style={{ marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                margin: '0 0 1rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-primary)',
              }}>
                {CATEGORY_ICONS[category] || '📁'} {category}
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  ({docs.length})
                </span>
              </h2>
              <div className={shared.cardGrid}>
                {docs.map((doc) => {
                  const expiry = getExpiryInfo(doc.expiry_date);
                  return (
                    <div key={doc.id} className={shared.card}>
                      <div className={`${shared.cardAccentLeft} ${getCategoryAccent(doc.category)}`} />
                      <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 }}>{doc.title}</h3>
                          <span className={`${shared.badge} ${expiry.badgeClass}`} style={{ flexShrink: 0, marginLeft: '0.5rem' }}>
                            {expiry.text}
                          </span>
                        </div>
                        {doc.description && (
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {doc.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                          <span>📄 {doc.file_name}</span>
                          <span>💾 {formatFileSize(doc.file_size)}</span>
                          {doc.expiry_date && <span>📅 Expires: {formatDate(doc.expiry_date)}</span>}
                          <span>v{doc.version}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>Uploaded {formatDate(doc.created_at)}</span>
                          {doc.uploaded_by && <span>by {doc.uploaded_by}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <button
                            className={shared.downloadBtn}
                            onClick={() => { void handleDownload(doc.id); }}
                            disabled={downloadingId === doc.id}
                            style={{ fontSize: '0.85rem' }}
                          >
                            {downloadingId === doc.id ? '⏳ Loading...' : '📥 Download'}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => { void handleDelete(doc.id); }}
                              style={{
                                padding: '0.35rem 0.75rem',
                                background: 'rgba(239,68,68,0.08)',
                                color: '#dc2626',
                                border: '1px solid rgba(239,68,68,0.25)',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🗑 Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
