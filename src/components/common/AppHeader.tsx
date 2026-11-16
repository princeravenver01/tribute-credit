'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Menu } from 'lucide-react';
import { SyncStatusBar } from './SyncStatusBar';
import styles from './AppHeader.module.css';

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
    <header className={`no-print ${styles.headerBase} ${isSuperAdmin ? styles.headerAdmin : styles.headerAO}`}>
      {/* Decorative top accent line */}
      <div className={isSuperAdmin ? styles.topAccentAdmin : styles.topAccentAO} />

      {/* Main Top Navigation Row */}
      <div className={isSuperAdmin ? styles.topRowAdmin : styles.topRowAO}>
        {/* Left: Brand Identity & Portal Context */}
        <div className={styles.brandGroup}>
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className={`officer-menu-toggle-btn ${isSuperAdmin ? styles.menuToggleBtnAdmin : styles.menuToggleBtnAO}`}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
          )}

          <Link
            href={isSuperAdmin ? '/admin/dashboard' : '/officer/dashboard'}
            className={styles.brandLink}
          >
            {/* Logo Container */}
            <div className={isSuperAdmin ? styles.logoBoxAdmin : styles.logoBoxAO}>
              <img
                src="/tribute-credit-logo.png"
                alt="Tribute Credit Cooperative"
                className={styles.logoImg}
              />
            </div>

            {/* Typography Hierarchy */}
            <div className={isSuperAdmin ? styles.brandTextColAdmin : styles.brandTextColAO}>
              <div className={styles.brandTitleWrap}>
                <span className={isSuperAdmin ? styles.coopNameAdmin : styles.coopNameAO}>
                  Tribute Credit Cooperative
                </span>

                {/* Role Pill Badge */}
                <div className={isSuperAdmin ? styles.roleBadgeAdmin : styles.roleBadgeAO}>
                  <span className={isSuperAdmin ? styles.roleDotAdmin : styles.roleDotAO} />
                  {badgeLabel}
                </div>
              </div>

              <div className={isSuperAdmin ? styles.brandMetaRowAdmin : styles.brandMetaRowAO}>
                <span className={isSuperAdmin ? styles.regCodeAdmin : styles.regCodeAO}>
                  CDA REG: NCR-COOP-88219
                </span>
                <span style={{ color: isSuperAdmin ? '#284237' : '#cbd5e1' }}>&bull;</span>
                <span className={isSuperAdmin ? styles.verifiedTagAdmin : styles.verifiedTagAO}>
                  <ShieldCheck size={12} color={isSuperAdmin ? '#4ade80' : '#15803d'} /> Financial Services & Credit Operations
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Right: Actions Slot, Sync Status, and User Identity Profile */}
        <div className={styles.rightGroup}>
          <SyncStatusBar />

          {actions && (
            <div className={styles.actionsSlot}>
              {actions}
            </div>
          )}

          {/* Profile Pill */}
          <div className={isSuperAdmin ? styles.userPillAdmin : styles.userPillAO}>
            <div className={isSuperAdmin ? styles.userAvatarAdmin : styles.userAvatarAO}>
              {userName.charAt(0)}
            </div>

            <div style={{ lineHeight: 1.25 }}>
              <div className={isSuperAdmin ? styles.userNameAdmin : styles.userNameAO}>
                {userName}
              </div>
              <div className={isSuperAdmin ? styles.userRoleAdmin : styles.userRoleAO}>
                {isSuperAdmin ? 'Dual-Control Approver' : 'Certified Account Officer'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-bar: Clean Page Title & Context Header */}
      {(pageTitle || pageSubtitle) && (
        <div className={isSuperAdmin ? styles.subBannerAdmin : styles.subBannerAO}>
          <div>
            {pageTitle && (
              <h1 className={isSuperAdmin ? styles.pageTitleAdmin : styles.pageTitleAO}>
                {pageTitle}
              </h1>
            )}
            {pageSubtitle && (
              <p className={isSuperAdmin ? styles.pageSubtitleAdmin : styles.pageSubtitleAO}>
                {pageSubtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
