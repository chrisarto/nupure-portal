'use client';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      gap: '1rem',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <div style={{ fontSize: '2.5rem' }}>⚠️</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.9rem' }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.6rem 1.5rem',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
