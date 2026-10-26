'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import { useCurrentUser } from '@/lib/useCurrentUser';
import type { MeetingMinute } from '@/lib/types';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const localised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  const d = new Date(localised);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return iso;
}

export default function MeetingMinutesPage() {
  const { user } = useCurrentUser();
  const canEdit = user?.canEdit ?? false;

  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Upload modal state
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMinutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/management/meeting-minutes');
      if (!res.ok) throw new Error('Failed to load meeting minutes');
      const json = await res.json() as { data: MeetingMinute[] };
      setMinutes(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMinutes();
  }, [fetchMinutes]);

  // Extract available years for filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const m of minutes) {
      if (m.meeting_date) {
        const y = m.meeting_date.substring(0, 4);
        if (y) years.add(y);
      }
    }
    return Array.from(years).sort().reverse();
  }, [minutes]);

  // Filtered minutes list
  const filteredMinutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return minutes.filter((m) => {
      if (selectedYear !== 'all' && !m.meeting_date?.startsWith(selectedYear)) {
        return false;
      }
      if (!q) return true;
      const matchTitle = (m.title ?? '').toLowerCase().includes(q);
      const matchNotes = (m.notes ?? '').toLowerCase().includes(q);
      const matchFile = (m.file_name ?? '').toLowerCase().includes(q);
      const matchAuthor = (m.uploaded_by ?? '').toLowerCase().includes(q);
      const matchDate = (m.meeting_date ?? '').includes(q);
      return matchTitle || matchNotes || matchFile || matchAuthor || matchDate;
    });
  }, [minutes, search, selectedYear]);

  // Auto-generate title placeholder or suggestion when date changes
  const suggestedTitle = useMemo(() => {
    if (!meetingDate) return 'Monthly Client Meeting';
    const d = new Date(`${meetingDate}T00:00:00`);
    if (isNaN(d.getTime())) return 'Monthly Client Meeting';
    const monthYear = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    return `Monthly Client Meeting — ${monthYear}`;
  }, [meetingDate]);

  const handleOpenModal = () => {
    setUploadError(null);
    setSelectedFile(null);
    setNotes('');
    const today = new Date().toISOString().split('T')[0];
    setMeetingDate(today);
    const d = new Date(`${today}T00:00:00`);
    const monthYear = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    setTitle(`Monthly Client Meeting — ${monthYear}`);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (uploading) return;
    setShowModal(false);
    setSelectedFile(null);
    setUploadError(null);
  };

  const handleDateChange = (newDate: string) => {
    setMeetingDate(newDate);
    // If the title matches the old suggested pattern, update it automatically
    const d = new Date(`${newDate}T00:00:00`);
    if (!isNaN(d.getTime())) {
      const monthYear = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      setTitle(`Monthly Client Meeting — ${monthYear}`);
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!meetingDate) {
      setUploadError('Please select a meeting date.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('meeting_date', meetingDate);
      formData.append('title', title.trim() || suggestedTitle);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      const res = await fetch('/api/management/meeting-minutes', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json() as { data?: MeetingMinute; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }

      setShowModal(false);
      setSelectedFile(null);
      void fetchMinutes();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/management/meeting-minutes/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to delete');
      }
      setMinutes((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Top summary metrics
  const latestMeeting = minutes[0]?.meeting_date ? formatDate(minutes[0].meeting_date) : '—';
  const currentYearStr = new Date().getFullYear().toString();
  const thisYearCount = minutes.filter((m) => m.meeting_date?.startsWith(currentYearStr)).length;

  return (
    <div className={shared.pageContainer}>
      {/* Page Header */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Meeting Minutes</h1>
            <p className={shared.pageSubtitle}>
              Monthly client meeting records, minutes, and action items
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="MJ Hygiene Compliance Portal"
            style={{
              height: '90px',
              objectFit: 'contain',
              background: '#fff',
              borderRadius: '10px',
              padding: '6px 12px',
            }}
          />
        </div>
      </div>

      {/* Action Bar & Stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* KPI Mini-cards */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              padding: '0.85rem 1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Total Meetings
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f3460', marginTop: '0.2rem' }}>
              {minutes.length}
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              padding: '0.85rem 1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Latest Meeting
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981', marginTop: '0.35rem' }}>
              {latestMeeting}
            </div>
          </div>
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              padding: '0.85rem 1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              minWidth: '160px',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              {currentYearStr} Meetings
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.2rem' }}>
              {thisYearCount}
            </div>
          </div>
        </div>

        {/* Upload Button */}
        {canEdit && (
          <button
            onClick={handleOpenModal}
            className={shared.primaryButton}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              backgroundColor: '#0f3460',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(15,52,96,0.2)',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>📤</span> Upload Meeting Minutes
          </button>
        )}
      </div>

      {/* Search & Year Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          background: '#fff',
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Search by meeting title, notes, or file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </div>

        {availableYears.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Year:</span>
            <button
              onClick={() => setSelectedYear('all')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: selectedYear === 'all' ? '#0f3460' : '#f8fafc',
                color: selectedYear === 'all' ? '#fff' : '#475569',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              All
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: selectedYear === yr ? '#0f3460' : '#f8fafc',
                  color: selectedYear === yr ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* State Handlers */}
      {loading && <div className={shared.loadingState}>Loading meeting minutes…</div>}
      {error && !loading && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Error Loading Minutes</div>
          <div className={shared.errorText}>{error}</div>
          <button
            onClick={() => void fetchMinutes()}
            style={{
              marginTop: '1rem',
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              background: '#0f3460',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredMinutes.length === 0 && (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📋</div>
          <div className={shared.emptyTitle}>
            {search || selectedYear !== 'all' ? 'No matching meetings found' : 'No meeting minutes uploaded yet'}
          </div>
          <div className={shared.emptyText}>
            {search || selectedYear !== 'all'
              ? 'Try changing your search term or year filter.'
              : 'Upload the monthly client meeting minutes PDF or document to get started.'}
          </div>
          {canEdit && !search && selectedYear === 'all' && (
            <button
              onClick={handleOpenModal}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                background: '#0f3460',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upload Minutes Now
            </button>
          )}
        </div>
      )}

      {/* Meeting Minutes Table */}
      {!loading && !error && filteredMinutes.length > 0 && (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th style={{ minWidth: '130px' }}>Meeting Date</th>
                <th>Title / Notes</th>
                <th>File Document</th>
                <th>Uploaded By</th>
                <th>Uploaded Date</th>
                <th style={{ textAlign: 'right', minWidth: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMinutes.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700, color: '#0f3460' }}>
                    📅 {formatDate(m.meeting_date)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                      {m.title || 'Monthly Client Meeting'}
                    </div>
                    {m.notes && (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#64748b',
                          marginTop: '0.25rem',
                          maxWidth: '420px',
                          lineHeight: '1.4',
                        }}
                      >
                        {m.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>📄</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                        {m.file_name}
                      </span>
                    </div>
                    {m.file_size && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {formatFileSize(m.file_size)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                    {m.uploaded_by || '—'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {formatDate(m.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                      <a
                        href={m.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={shared.actionLink}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <span>📥</span> View PDF
                      </a>
                      {canEdit && (
                        <button
                          onClick={() => void handleDelete(m.id, m.file_name)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#dc2626',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Delete minute record"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f3460' }}>
                  Upload Monthly Meeting Minutes
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Select the meeting date and upload the client minutes document
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={uploading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={(e) => void handleSubmitUpload(e)} style={{ padding: '1.5rem' }}>
              {uploadError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                  }}
                >
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Meeting Date */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Meeting Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Meeting Title
                </label>
                <input
                  type="text"
                  placeholder={suggestedTitle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              {/* Notes / Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Attendees / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Attendees: Chris, Nu-Pure QA Team. Key discussions: Pre-op audit adherence, new allergen protocols."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* File Attachment */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.4rem',
                  }}
                >
                  Minutes Document (PDF, Word, Excel) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  required
                  accept=".pdf,.doc,.docx,.xlsx,.xls,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setSelectedFile(f ?? null);
                  }}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px dashed #94a3b8',
                    backgroundColor: '#f8fafc',
                    fontSize: '0.875rem',
                  }}
                />
                {selectedFile && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#059669',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1.25rem',
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={uploading}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#fff',
                    color: '#475569',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  style={{
                    padding: '0.65rem 1.5rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: uploading ? '#94a3b8' : '#0f3460',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {uploading ? 'Uploading...' : '📤 Upload Minutes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
