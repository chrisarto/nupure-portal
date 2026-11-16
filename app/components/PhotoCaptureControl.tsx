'use client';

import React, { useRef, useState } from 'react';
import { uploadOrStagePhoto } from '@/lib/offline-cleaning-db';

export interface PhotoCaptureControlProps {
  label: string;
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  uploadEndpoint?: string;
  disabled?: boolean;
}

export function PhotoCaptureControl({
  label,
  photos,
  onChange,
  uploadEndpoint = '/api/cleaning-records/upload',
  disabled = false,
}: PhotoCaptureControlProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setBusy(true);
    try {
      const addedUrls: string[] = [];
      for (const file of Array.from(fileList)) {
        const { url } = await uploadOrStagePhoto(file, uploadEndpoint);
        if (url) {
          addedUrls.push(url);
        }
      }
      if (addedUrls.length > 0) {
        onChange([...photos, ...addedUrls]);
      }
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    onChange(photos.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: '1px dashed #94a3b8',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 12.5, fontWeight: 800, color: '#334155' }}>
          {label} ({photos.length})
        </label>
        {busy && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7' }}>
            ⏳ Processing photo...
          </span>
        )}
      </div>

      {/* Hidden File Inputs: 1 for Direct Camera Capture, 1 for Saved Photo Library */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        disabled={disabled || busy}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        disabled={disabled || busy}
        style={{ display: 'none' }}
      />

      {/* Dual Touch-Friendly Action Buttons (Ideal for iPad / iPhone / Android) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: 8,
        }}
      >
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => cameraInputRef.current?.click()}
          style={{
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid #0284c7',
            background: '#0284c7',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 800,
            cursor: disabled || busy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>📷</span>
          <span>Take Photo (Camera)</span>
        </button>

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => galleryInputRef.current?.click()}
          style={{
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: 13,
            fontWeight: 800,
            cursor: disabled || busy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>🖼️</span>
          <span>Saved Photos</span>
        </button>
      </div>

      {/* Thumbnail Previews with Offline/Uploaded Badge & Remove Button */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {photos.map((u, i) => {
            const isOfflineDataUrl = u.startsWith('data:image/');
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  width: 78,
                  height: 78,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: isOfflineDataUrl ? '2px solid #f59e0b' : '2px solid #16a34a',
                  background: '#ffffff',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`${label} ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(i)}
                  title="Remove photo"
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(15, 23, 42, 0.78)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: isOfflineDataUrl
                      ? 'rgba(217, 119, 6, 0.88)'
                      : 'rgba(22, 163, 74, 0.88)',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: '2px 0',
                  }}
                >
                  {isOfflineDataUrl ? 'Offline Ready' : 'Uploaded ✓'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
