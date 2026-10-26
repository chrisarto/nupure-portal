'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get('url');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <img src="/images/mj-hygiene-logo.png" alt="MJ Hygiene" style={{ height: '50px', marginBottom: '20px' }} />
        <h1 style={{ fontSize: '20px', marginBottom: '10px', color: '#1f2937' }}>Secure Link Verification</h1>
        <p style={{ color: '#6b7280', marginBottom: '30px', fontSize: '14px', lineHeight: '1.5' }}>
          To protect your account from automated email scanners, please click the button below to securely continue to your destination.
        </p>
        {targetUrl ? (
          <a 
            href={targetUrl} 
            style={{ display: 'inline-block', backgroundColor: '#00ccff', color: '#0a0e1a', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}
          >
            Continue
          </a>
        ) : (
          <p style={{ color: 'red' }}>Invalid verification link.</p>
        )}
      </div>
    </div>
  );
}

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
