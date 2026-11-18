'use client';

import React, { useRef, useState, useEffect } from 'react';
import { uploadOrStagePhoto } from '@/lib/offline-cleaning-db';

export interface PhotoCaptureControlProps {
  label: string;
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  uploadEndpoint?: string;
  disabled?: boolean;
}

const VISUALLY_HIDDEN_INPUT_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
  opacity: 0,
};

export function PhotoCaptureControl({
  label,
  photos,
  onChange,
  uploadEndpoint = '/api/cleaning-records/upload',
  disabled = false,
}: PhotoCaptureControlProps) {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const photosRef = useRef<string[]>(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0 || disabled || busy) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const addedUrls: string[] = [];
      let offlineCount = 0;

      for (const file of files) {
        const { url, storedOffline } = await uploadOrStagePhoto(file, uploadEndpoint);
        if (url) {
          addedUrls.push(url);
          if (storedOffline) offlineCount++;
        }
      }

      if (addedUrls.length > 0) {
        const nextList = [...photosRef.current, ...addedUrls];
        photosRef.current = nextList;
        onChange(nextList);
        setStatusMessage({
          type: 'ok',
          text:
            offlineCount > 0
              ? `✓ Loaded ${addedUrls.length} photo${addedUrls.length > 1 ? 's' : ''} (staged on device)`
              : `✓ Uploaded ${addedUrls.length} photo${addedUrls.length > 1 ? 's' : ''} to report`,
        });
      } else {
        setStatusMessage({
          type: 'err',
          text: '⚠️ Could not load selected photo file. Please try another image.',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text: `⚠️ Photo load error: ${err instanceof Error ? err.message : 'Unable to read image'}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';
    await processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled || busy) return;
    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(
      f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif|bmp|gif)$/i.test(f.name)
    );
    if (droppedFiles.length > 0) {
      await processFiles(droppedFiles);
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    const nextList = photosRef.current.filter((_, idx) => idx !== indexToRemove);
    photosRef.current = nextList;
    onChange(nextList);
  };

  const isDisabled = disabled || busy;

  return (
    <div
      onDragOver={e => {
        e.preventDefault();
        if (!isDisabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => void handleDrop(e)}
      style={{
        padding: 14,
        borderRadius: 12,
        border: dragOver ? '2px dashed #0284c7' : '1px dashed #94a3b8',
        background: dragOver ? '#f0f9ff' : '#f8fafc',
        transition: 'background 0.15s, border-color 0.15s',
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
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#334155' }}>
          {label} ({photos.length})
        </span>
        {busy ? (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0284c7' }}>
            ⏳ Loading &amp; uploading photo...
          </span>
        ) : statusMessage ? (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: statusMessage.type === 'ok' ? '#15803d' : '#dc2626',
            }}
          >
            {statusMessage.text}
          </span>
        ) : null}
      </div>

      {/* Dual Native <label> Action Buttons (100% Reliable on Android, iPad, iPhone & Desktop PC) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        <label
          style={{
            position: 'relative',
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid #0284c7',
            background: isDisabled ? '#94a3b8' : '#0284c7',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 800,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFilesSelected}
            disabled={isDisabled}
            style={VISUALLY_HIDDEN_INPUT_STYLE}
          />
          <span>📷</span>
          <span>Take Photo (Camera)</span>
        </label>

        <label
          style={{
            position: 'relative',
            minHeight: 44,
            padding: '10px 12px',
            borderRadius: 9,
            border: '1px solid #0f3460',
            background: isDisabled ? '#f1f5f9' : '#ffffff',
            color: '#0f172a',
            fontSize: 13,
            fontWeight: 800,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            userSelect: 'none',
            textAlign: 'center',
          }}
        >
          <input
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp"
            multiple
            onChange={handleFilesSelected}
            disabled={isDisabled}
            style={VISUALLY_HIDDEN_INPUT_STYLE}
          />
          <span>🖼️</span>
          <span>Load Saved Photo(s)</span>
        </label>
      </div>

      {/* Thumbnail Previews with Offline/Uploaded Badge & Remove Button */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {photos.map((u, i) => {
            const isOfflineDataUrl = u.startsWith('data:image/') || u.startsWith('blob:');
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  width: 84,
                  height: 84,
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
                    background: 'rgba(15, 23, 42, 0.82)',
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
                      ? 'rgba(217, 119, 6, 0.9)'
                      : 'rgba(22, 163, 74, 0.9)',
                    color: '#ffffff',
                    fontSize: 9.5,
                    fontWeight: 800,
                    textAlign: 'center',
                    padding: '2px 0',
                  }}
                >
                  {isOfflineDataUrl ? 'Staged ✓' : 'Uploaded ✓'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
