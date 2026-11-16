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
    <header className={`no-print ${styles.officerHeader}`}>
      {/* Decorative top accent gradient line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #14532d 0%, #15803d 55%, #16a34a 100%)'
        }}
      />

      {/* Main Top Navigation Row */}
      <div className={styles.officerHeaderTopRow}>
        {/* Left: Brand Identity & Verified Cooperative Status */}
        <div className={styles.officerBrandGroup}>
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className={`officer-menu-toggle-btn ${styles.officerMenuToggleBtn}`}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
          )}

          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/officer/dashboard'}
            className={styles.officerBrandLink}
          >
            {/* Elevated Logo Container */}
            <div className={styles.officerLogoBox}>
              <img
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                className={styles.officerLogoImg}
              />
            </div>

            {/* Typography Hierarchy */}
            <div className={styles.officerBrandTextCol}>
              <div className={styles.officerBrandTitleWrap}>
                <span className={styles.officerCoopName}>
                  Tribute Credit Cooperative
                </span>

                {/* Role Pill Badge */}
                <div className={isSuperAdmin ? styles.adminRoleBadge : styles.officerRoleBadge}>
                  <span className={isSuperAdmin ? styles.adminRoleDot : styles.officerRoleDot} />
                  {badgeLabel}
                </div>
              </div>

              <div className={styles.officerBrandMetaRow}>
                <span className={styles.officerRegCode}>
                  CDA REG: NCR-COOP-88219
                </span>
                <span style={{ color: '#cbd5e1' }}>&bull;</span>
                <span className={styles.officerVerifiedTag}>
                  <ShieldCheck size={12} color="#15803d" /> Financial Services & Credit Operations
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Right: Actions, Sync Status, and User Pill */}
        <div className={styles.officerHeaderRightGroup}>
          <SyncStatusBar />

          {actions && (
            <div className={styles.officerActionsSlot}>
              {actions}
            </div>
          )}

          {/* Profile Pill */}
          <div className={styles.officerUserPill}>
            <div className={isSuperAdmin ? styles.adminUserAvatar : styles.officerUserAvatar}>
              {userName.charAt(0)}
            </div>

            <div style={{ lineHeight: 1.25 }}>
              <div className={styles.officerUserName}>
                {userName}
              </div>
              <div className={styles.officerUserRole}>
                {isSuperAdmin ? 'Dual-Control Approver' : 'Certified Account Officer'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-bar: Clean Page Focus Header */}
      {(pageTitle || pageSubtitle) && (
        <div className={styles.officerForestBanner}>
          <div>
            {pageTitle && (
              <h1 className={styles.officerPageTitle}>
                {pageTitle}
              </h1>
            )}
            {pageSubtitle && (
              <p className={styles.officerPageSubtitle}>
                {pageSubtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
