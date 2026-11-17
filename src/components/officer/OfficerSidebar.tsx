'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut,
  X,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import styles from './OfficerChrome.module.css';
import { OFFICER_NAV_ITEMS } from './officer-nav-items';

interface OfficerSidebarProps {
  userName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const OfficerSidebar: React.FC<OfficerSidebarProps> = ({
  userName = 'Officer Juan',
  isMobileOpen = false,
  onCloseMobile
}) => {
  const pathname = usePathname();

  const navigationItems = OFFICER_NAV_ITEMS;
  const isSettingsActive = pathname === '/officer/settings' || pathname.startsWith('/officer/settings/');

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className={styles.backdrop}
        />
      )}

      {/* Sidebar Container using CSS classes for zero hydration mismatch */}
      <aside className={`officer-desktop-sidebar ${styles.sidebar} ${isMobileOpen ? `drawer-open ${styles.sidebarCollapsed}` : ''}`}>
        {/* Brand Header with Tribute Grace Logo */}
        <div className={styles.sidebarBrandHeader}>
          <Link
            href="/officer/dashboard"
            onClick={onCloseMobile}
            className={styles.sidebarBrandLink}
          >
            <div>
              <div className={styles.sidebarBrandTitleRow}>
                <span className={styles.sidebarBrandDot} />
                <span className={styles.sidebarBrandTitle}>
                  Field Desk
                </span>
              </div>
              <p className={styles.sidebarBrandSubtitle}>
                Underwriting & Operations
              </p>
            </div>
          </Link>

          {/* Close drawer button for mobile */}
          <button
            onClick={onCloseMobile}
            type="button"
            className={`officer-sidebar-close-btn ${styles.sidebarCloseBtn}`}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Officer Profile Card */}
        <div className={styles.sidebarProfileSection}>
          <div className={styles.sidebarProfileCard}>
            <div className={styles.sidebarAvatar}>
              {userName.charAt(0)}
            </div>
            <div className={styles.sidebarProfileMeta}>
              <p className={styles.sidebarProfileName}>
                {userName}
              </p>
              <div className={styles.sidebarProfileRoleRow}>
                <ShieldCheck size={12} color="#15803d" />
                <span className={styles.sidebarProfileRoleText}>
                  Field & Credit Officer
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className={styles.sidebarNav}>
          <span className={styles.sidebarNavSectionLabel}>
            Operations Menu
          </span>

          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/officer/dashboard' &&
                item.href !== '/officer/borrowers' &&
                pathname.startsWith(item.href + '/'));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`${styles.sidebarNavLink} ${isActive ? styles.sidebarNavLinkActive : ''}`}
              >
                <div className={styles.sidebarNavLinkInner}>
                  <Icon size={19} color={isActive ? '#ffffff' : '#15803d'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`${styles.sidebarBadge} ${isActive ? styles.sidebarBadgeActive : ''}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Account Settings & Logout */}
        <div className={styles.sidebarFooter}>
          <Link
            href="/officer/settings"
            onClick={onCloseMobile}
            className={`${styles.sidebarSettingsLink} ${isSettingsActive ? styles.sidebarSettingsLinkActive : ''}`}
          >
            <Settings size={16} color={isSettingsActive ? '#15803d' : '#475569'} />
            <span>Account Settings</span>
          </Link>

          <button
            type="button"
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch (e) {}
              window.location.href = '/officer/login';
            }}
            className={styles.sidebarLogoutBtn}
          >
            <LogOut size={16} />
            <span>Sign Out Desk</span>
          </button>
        </div>
      </aside>
    </>
  );
};
