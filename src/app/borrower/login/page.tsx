'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Lock, Mail, ArrowRight, AlertCircle, Building2, HelpCircle } from 'lucide-react';

export default function BorrowerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('borrower@tribute.coop');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, requiredRole: 'borrower' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Member authentication failed');
      }

      router.push('/borrower/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.35)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            backgroundColor: '#d1fae5',
            color: '#059669',
            padding: '16px',
            borderRadius: '20px',
            marginBottom: '16px',
            boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.2)'
          }}>
            <Users size={36} />
          </div>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: '800',
            color: '#059669',
            backgroundColor: '#ecfdf5',
            padding: '4px 10px',
            borderRadius: '12px',
            marginBottom: '8px'
          }}>
            Member Access
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Member & Borrower Portal
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
            Apply for loans, view your amortization schedule and check payments.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
              Registered Member Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="borrower@tribute.coop"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                Account Password
              </label>
              <a href="#" style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                Forgot?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              padding: '14px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '15px',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 8px 16px -4px rgba(5, 150, 105, 0.4)'
            }}
          >
            {loading ? 'Logging in...' : 'Sign In to Member Portal'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '13px',
          color: '#64748b'
        }}>
          Staff Member? Go to{' '}
          <Link href="/officer/login" style={{ color: '#0284c7', fontWeight: '600' }}>
            Officer Desk
          </Link>{' '}
          or{' '}
          <Link href="/admin/login" style={{ color: '#dc2626', fontWeight: '600' }}>
            Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
