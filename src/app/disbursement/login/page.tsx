'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

export default function DisbursementLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('disbursement@tribute.coop');
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
        body: JSON.stringify({ email, password, requiredRole: 'disbursement' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Disbursement Officer authentication failed');
      }

      router.push('/disbursement');
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
      background: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #1e1b4b 100%)',
      padding: '24px',
      position: 'relative'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(76, 29, 149, 0.45)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            backgroundColor: '#7c3aed',
            padding: '14px',
            borderRadius: '16px',
            color: '#fff',
            marginBottom: '16px',
            boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)'
          }}>
            <CreditCard size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Disbursement Desk Login
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
            Dual-control cash voucher and digital payout authorization
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
            padding: '12px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Disbursement Officer Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '13px' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="disbursement@tribute.coop"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '13px' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
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
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              border: 'none',
              padding: '12px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              transition: 'background 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            <span>{loading ? 'Authenticating...' : 'Access Disbursement Hub'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Demo Credentials Box */}
        <div style={{
          marginTop: '24px',
          padding: '14px',
          backgroundColor: '#f5f3ff',
          borderRadius: '12px',
          border: '1px solid #ddd6fe',
          fontSize: '12px',
          color: '#5b21b6'
        }}>
          <strong>Demo Disbursement Credentials:</strong>
          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>Email: <code>disbursement@tribute.coop</code></span>
            <span>Password: <code>Password123!</code></span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/login" style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
            ← Back to Central Portals
          </Link>
        </div>
      </div>
    </div>
  );
}
