'use client';

import { useState } from 'react';
import type { AirtableAttachment } from '@/lib/types';

interface Props {
  attachment: AirtableAttachment & { storagePath?: string };
  label?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Smart attachment link that handles:
 * - Supabase Storage paths (supabase-storage://...) → fetches a signed URL first
 * - Regular URLs (old Airtable or any https://) → links directly
 */
export default function AttachmentLink({ attachment, label = '📄 View / Download', className, onClick }: Props) {
  const [loading, setLoading] = useState(false);

  const isStoragePath = attachment.url?.startsWith('supabase-storage://') || !!attachment.storagePath;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick(e);

    if (!isStoragePath) {
      // Regular URL — just open
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Supabase Storage — fetch signed URL first
    setLoading(true);
    try {
      const path = attachment.storagePath ?? attachment.url.replace('supabase-storage://', '');
      const res = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to get download link');
      const { url } = await res.json() as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('AttachmentLink error:', err);
      alert('Could not open file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={loading}
      style={{ cursor: loading ? 'wait' : 'pointer' }}
    >
      {loading ? '⏳ Opening...' : label}
    </button>
  );
}
