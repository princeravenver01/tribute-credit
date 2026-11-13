'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  ShieldCheck, 
  Bell, 
  User, 
  LogOut, 
  Menu,
  ChevronRight,
  Sparkles,
  Lock,
  Layers,
  Activity
} from 'lucide-react';
import { SyncStatusBar } from './SyncStatusBar';
import styles from '@/components/officer/OfficerChrome.module.css';

interface AppHeaderProps {
  panelType: 'admin' | 'officer';
  userName?: string;
  badgeLabel?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  onOpenMobileSidebar?: () => void;
  actions?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  panelType,
  userName = panelType === 'admin' ? 'Administrator' : 'Officer Juan',
  badgeLabel = panelType === 'admin' ? 'Super Admin Portal' : 'Field Underwriting Desk',
  pageTitle,
  pageSubtitle,
  onOpenMobileSidebar,
  actions
}) => {
  const isSuperAdmin = panelType === 'admin';

  return (
    <header
      className={`no-print ${!isSuperAdmin ? styles.officerHeader : ''}`}
      style={isSuperAdmin ? {
        position: 'relative',
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
        padding: '16px 24px',
        marginBottom: '26px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      } : undefined}
    >
      {/* Decorative top accent gradient line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: isSuperAdmin
            ? 'linear-gradient(90deg, #dc2626 0%, #ea580c 50%, #0284c7 100%)'
            : 'linear-gradient(90deg, #14532d 0%, #15803d 55%, #16a34a 100%)'
        }}
      />

      {/* Main Top Navigation Row */}
      <div
        className={!isSuperAdmin ? styles.officerHeaderTopRow : undefined}
        style={isSuperAdmin ? {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap'
        } : undefined}
      >
        {/* Left: Brand Identity & Verified Cooperative Status */}
        <div
          className={!isSuperAdmin ? styles.officerBrandGroup : undefined}
          style={isSuperAdmin ? { display: 'flex', alignItems: 'center', gap: '14px' } : undefined}
        >
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              style={isSuperAdmin ? {
                display: 'none',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                padding: '8px 10px',
                borderRadius: '10px',
                color: '#0f172a',
                cursor: 'pointer'
              } : undefined}
              className={`officer-menu-toggle-btn ${!isSuperAdmin ? styles.officerMenuToggleBtn : ''}`}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
          )}

          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/officer/dashboard'}
            className={!isSuperAdmin ? styles.officerBrandLink : undefined}
            style={isSuperAdmin ? {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textDecoration: 'none'
            } : undefined}
          >
            {/* Elevated Logo Container with subtle shadow and border */}
            <div
              className={!isSuperAdmin ? styles.officerLogoBox : undefined}
              style={isSuperAdmin ? {
                backgroundColor: '#ffffff',
                padding: '6px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
                transition: 'transform 0.15s ease',
              } : undefined}
            >
              <img
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                className={!isSuperAdmin ? styles.officerLogoImg : undefined}
                style={isSuperAdmin ? {
                  height: '46px',
                  width: 'auto',
                  objectFit: 'contain'
                } : undefined}
              />
            </div>

            {/* Typography Hierarchy */}
            <div
              className={!isSuperAdmin ? styles.officerBrandTextCol : undefined}
              style={isSuperAdmin ? { borderLeft: '1.5px solid #e2e8f0', paddingLeft: '14px' } : undefined}
            >
              <div
                className={!isSuperAdmin ? styles.officerBrandTitleWrap : undefined}
                style={isSuperAdmin ? { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } : undefined}
              >
                <span
                  className={!isSuperAdmin ? styles.officerCoopName : undefined}
                  style={isSuperAdmin ? {
                    fontSize: '15px',
                    fontWeight: '900',
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    lineHeight: 1.15
                  } : undefined}
                >
                  Tribute Credit Cooperative
                </span>

                {/* Role Pill Badge with Glass Accent */}
                <div
                  className={!isSuperAdmin ? styles.officerRoleBadge : undefined}
                  style={isSuperAdmin ? {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    padding: '2.5px 8px',
                    borderRadius: '20px',
                    letterSpacing: '0.04em',
                    backgroundColor: '#fef2f2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  } : undefined}
                >
                  <span
                    className={!isSuperAdmin ? styles.officerRoleDot : undefined}
                    style={isSuperAdmin ? {
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#dc2626',
                      boxShadow: '0 0 6px #dc2626'
                    } : undefined}
                  />
                  {badgeLabel}
                </div>
              </div>

              <div
                className={!isSuperAdmin ? styles.officerBrandMetaRow : undefined}
                style={isSuperAdmin ? {
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: '500',
                  marginTop: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap'
                } : undefined}
              >
                <span
                  className={!isSuperAdmin ? styles.officerRegCode : undefined}
                  style={isSuperAdmin ? { fontFamily: '"SFMono-Regular", Consolas, monospace', fontWeight: '600', color: '#475569' } : undefined}
                >
                  CDA REG: NCR-COOP-88219
                </span>
                <span style={{ color: '#cbd5e1' }}>&bull;</span>
                <span
                  className={!isSuperAdmin ? styles.officerVerifiedTag : undefined}
                  style={isSuperAdmin ? { color: '#047857', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' } : undefined}
                >
                  <ShieldCheck size={12} color={isSuperAdmin ? '#047857' : '#15803d'} /> Financial Services & Credit Operations
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Right: Actions, Sync Status, and Glass User Pill */}
        <div
          className={!isSuperAdmin ? styles.officerHeaderRightGroup : undefined}
          style={isSuperAdmin ? { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } : undefined}
        >
          <SyncStatusBar />

          {actions && (
            <div
              className={!isSuperAdmin ? styles.officerActionsSlot : undefined}
              style={isSuperAdmin ? { display: 'flex', alignItems: 'center', gap: '8px' } : undefined}
            >
              {actions}
            </div>
          )}

          {/* Modern Profile Pill */}
          <div
            className={!isSuperAdmin ? styles.officerUserPill : undefined}
            style={isSuperAdmin ? {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 14px 6px 8px',
              borderRadius: '24px',
              boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)'
            } : undefined}
          >
            {/* User Avatar with Initials & Gradient Ring */}
            <div
              className={!isSuperAdmin ? styles.officerUserAvatar : undefined}
              style={isSuperAdmin ? {
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)'
              } : undefined}
            >
              {userName.charAt(0)}
            </div>

            <div style={{ lineHeight: 1.25 }}>
              <div
                className={!isSuperAdmin ? styles.officerUserName : undefined}
                style={isSuperAdmin ? { fontSize: '12.5px', fontWeight: '800', color: '#0f172a' } : undefined}
              >
                {userName}
              </div>
              <div
                className={!isSuperAdmin ? styles.officerUserRole : undefined}
                style={isSuperAdmin ? { fontSize: '10.5px', color: '#64748b', fontWeight: '600' } : undefined}
              >
                {isSuperAdmin ? 'Dual-Control Approver' : 'Certified Account Officer'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-bar: Clean Breadcrumb & Page Focus Header */}
      {(pageTitle || pageSubtitle) && (
        <div
          className={!isSuperAdmin ? styles.officerForestBanner : undefined}
          style={isSuperAdmin ? {
            borderTop: '1px solid #f1f5f9',
            marginTop: '14px',
            paddingTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '8px'
          } : undefined}
        >
          <div>
            {pageTitle && (
              <h1
                className={!isSuperAdmin ? styles.officerPageTitle : undefined}
                style={isSuperAdmin ? {
                  fontSize: '21px',
                  fontWeight: '900',
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2
                } : undefined}
              >
                {pageTitle}
              </h1>
            )}
            {pageSubtitle && (
              <p
                className={!isSuperAdmin ? styles.officerPageSubtitle : undefined}
                style={isSuperAdmin ? {
                  fontSize: '12.5px',
                  color: '#64748b',
                  margin: '3px 0 0 0',
                  fontWeight: '500',
                  lineHeight: 1.4
                } : undefined}
              >
                {pageSubtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
