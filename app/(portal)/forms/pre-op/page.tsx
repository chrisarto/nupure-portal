import Link from 'next/link';
import shared from '@/app/(portal)/shared.module.css';

export default function PreOpLandingPage() {
  return (
    <div className={shared.pageContainer}>
      <div className={shared.pageHeader}>
        <div>
          <h1 className={shared.pageTitle}>Daily Pre-Op Checks</h1>
          <p className={shared.pageDescription}>
            Select a department to begin the Daily Pre-Operational monitoring form.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        
        {/* High Risk Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '0.5rem'
          }}>
            🔴
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
            High Risk Pre-Op
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Complete the daily pre-op checks for all High Risk areas and equipment.
          </p>
          <Link
            href="/forms/pre-op-high-risk"
            style={{
              background: 'var(--brand-primary)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontWeight: '500',
              width: '100%'
            }}
          >
            Start High Risk Check
          </Link>
        </div>

        {/* Low Risk Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '0.5rem'
          }}>
            🔵
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
            Low Risk Pre-Op
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Complete the daily pre-op checks for all Low Risk areas and equipment.
          </p>
          <Link
            href="/forms/pre-op-low-risk"
            style={{
              background: 'var(--brand-primary)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontWeight: '500',
              width: '100%'
            }}
          >
            Start Low Risk Check
          </Link>
        </div>

      </div>
    </div>
  );
}
