'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCheck, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

export default function OfficerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('officer@tribute.coop');
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
        body: JSON.stringify({ email, password, requiredRole: 'account_officer' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Account Officer authentication failed');
      }

      router.push('/officer/dashboard');
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
      background: 'radial-gradient(circle at 10% 20%, #1e293b 0%, #0b1320 100%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(22, 163, 74, 0.15) 0%, rgba(22, 163, 74, 0) 70%)',
        top: '-10%',
        right: '-10%',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        zIndex: 1,
        border: '1px solid rgba(226, 232, 240, 0.8)'
      }}>
        {/* Brand Header with Tribute Grace Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            padding: '12px 20px',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: '1.5px solid #e2e8f0'
          }}>
            <img
              src="/tribute-grace-logo.png"
              alt="Tribute Grace Social Welfare Services"
              style={{
                height: '48px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>

          <div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              fontWeight: '800',
              color: '#15803d',
              backgroundColor: '#f0fdf4',
              padding: '4px 12px',
              borderRadius: '20px',
              border: '1px solid #bbf7d0',
              marginBottom: '8px'
            }}>
              <ShieldCheck size={12} color="#16a34a" /> Account Officer Portal
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.4px' }}>
              Field Underwriting Desk
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Member borrower CI verification, assessments & contract execution.
            </p>
          </div>
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
            borderRadius: '12px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              Officer Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="officer@tribute.coop"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              Account Password
            </label>
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
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '13px',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '14.5px',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 8px 18px -4px rgba(22, 163, 74, 0.45)',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Review Desk'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          paddingTop: '18px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '12.5px',
          color: '#64748b'
        }}>
          Need another portal? Switch to{' '}
          <Link href="/admin/login" style={{ color: '#dc2626', fontWeight: '700' }}>
            Admin Portal
          </Link>{' '}
          or{' '}
          <Link href="/borrower/login" style={{ color: '#16a34a', fontWeight: '700' }}>
            Member Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
