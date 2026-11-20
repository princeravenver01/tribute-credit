'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, UserCheck, Users, Building2, ArrowRight } from 'lucide-react';

export default function CentralPortalHub() {
  const portals = [
    {
      title: 'Administrator Console',
      role: 'Super Admin',
      description: 'Manage cooperative policies, interest rates, approvals, loan products, and financial auditing.',
      href: '/admin/login',
      icon: ShieldCheck,
      color: '#dc2626',
      bgColor: '#fee2e2',
      badge: 'High Security'
    },
    {
      title: 'Account Officer Desk',
      role: 'Loan Underwriting',
      description: 'Evaluate member loan applications, verify credit ratings, and endorse recommendations.',
      href: '/officer/login',
      icon: UserCheck,
      color: '#0284c7',
      bgColor: '#e0f2fe',
      badge: 'Operations'
    },
    {
      title: 'Disbursement Hub',
      role: 'Cashier & Payouts',
      description: 'Dual-control loan release vouchers, cash counter payouts, and automated digital disbursements.',
      href: '/disbursement/login',
      icon: Building2,
      color: '#7c3aed',
      bgColor: '#ede9fe',
      badge: 'Treasury'
    },
    {
      title: 'Member / Borrower Portal',
      role: 'Borrower / Member',
      description: 'Apply for cooperative credit, simulate amortization schedules, and track payment dues.',
      href: '/borrower/login',
      icon: Users,
      color: '#059669',
      bgColor: '#d1fae5',
      badge: 'Member Self-Service'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      padding: '40px 20px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '640px', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          backgroundColor: '#0284c7',
          padding: '14px',
          borderRadius: '18px',
          color: '#fff',
          marginBottom: '16px',
          boxShadow: '0 8px 16px -4px rgba(2, 132, 199, 0.3)'
        }}>
          <Building2 size={36} />
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
          Tribute Credit Cooperative
        </h1>
        <p style={{ fontSize: '15px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' }}>
          Select your portal to proceed to your dedicated authentication workspace.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        maxWidth: '1060px',
        width: '100%'
      }}>
        {portals.map((portal) => {
          const Icon = portal.icon;
          return (
            <Link
              key={portal.href}
              href={portal.href}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                padding: '32px 28px',
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{
                    backgroundColor: portal.bgColor,
                    color: portal.color,
                    padding: '14px',
                    borderRadius: '16px'
                  }}>
                    <Icon size={28} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: portal.bgColor,
                    color: portal.color
                  }}>
                    {portal.badge}
                  </span>
                </div>

                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                  {portal.title}
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                  {portal.description}
                </p>
              </div>

              <div style={{
                marginTop: '28px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '700',
                color: portal.color
              }}>
                <span>Go to {portal.role} Login</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
