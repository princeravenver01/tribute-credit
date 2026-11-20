'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  FileCheck,
  Layers, 
  BarChart3, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  CreditCard,
  Building2,
  BadgeCheck,
  X,
  Menu
} from 'lucide-react';
import styles from '@/components/officer/OfficerChrome.module.css';
import adminStyles from '@/components/admin/AdminSidebar.module.css';

interface SidebarProps {
  role: 'admin' | 'officer' | 'borrower' | 'disbursement';
  userName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  userName = 'User',
  isMobileOpen,
  onCloseMobile,
  onOpenMobile
}) => {
  const pathname = usePathname();
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);

  const mobileOpen = isMobileOpen !== undefined ? isMobileOpen : internalMobileOpen;
  const handleCloseMobile = () => {
    if (onCloseMobile) onCloseMobile();
    setInternalMobileOpen(false);
  };
  const handleOpenMobile = () => {
    if (onOpenMobile) onOpenMobile();
    setInternalMobileOpen(true);
  };

  const adminLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Loan Approvals', href: '/admin/loans', icon: FileText },
    { name: 'Disbursement Hub', href: '/disbursement', icon: CreditCard },
    { name: 'Contract Editor', href: '/admin/contract-editor', icon: FileCheck },
    { name: 'Cooperative Members', href: '/admin/members', icon: Users },
    { name: 'Manage Users', href: '/admin/users', icon: ShieldCheck },
    { name: 'Loan Products', href: '/admin/products', icon: Layers },
    { name: 'Reports & Analytics', href: '/admin/reports', icon: BarChart3 },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const disbursementLinks = [
    { name: 'Disbursement Queue', href: '/disbursement', icon: CreditCard },
    { name: 'Release Vouchers', href: '/disbursement/vouchers', icon: FileText },
    { name: 'Completed Payouts', href: '/disbursement/history', icon: ShieldCheck },
  ];

  const officerLinks = [
    { name: 'Review Queue', href: '/officer/dashboard', icon: LayoutDashboard },
    { name: 'Cooperative Members', href: '/officer/members', icon: Users },
    { name: 'Applications', href: '/officer/queue', icon: FileText },
    { name: 'Current Borrowers', href: '/officer/borrowers', icon: UserCheck },
    { name: 'Credit Assessments', href: '/officer/credit-assessments', icon: BadgeCheck },
  ];

  const borrowerLinks = [
    { name: 'My Portal', href: '/borrower/dashboard', icon: LayoutDashboard },
    { name: 'Apply for Loan', href: '/borrower/apply', icon: FileText },
    { name: 'My Loans & Ledger', href: '/borrower/my-loans', icon: CreditCard },
    { name: 'Loan Calculator', href: '/borrower/calculator', icon: BarChart3 },
  ];

  const links = role === 'admin' 
    ? adminLinks 
    : role === 'disbursement'
      ? disbursementLinks
      : role === 'officer' 
        ? officerLinks 
        : borrowerLinks;

  const roleLabel = role === 'admin' 
    ? 'Super Admin' 
    : role === 'disbursement'
      ? 'Disbursement Officer / Cashier'
      : role === 'officer' 
        ? 'Account Officer' 
        : 'Borrower / Member';

  const roleBadgeColor = role === 'admin' 
    ? '#15803d' 
    : role === 'disbursement'
      ? '#8b5cf6'
      : role === 'officer' 
        ? '#0284c7' 
        : '#10b981';

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    const logoutTarget = role === 'admin' 
      ? '/admin/login' 
      : role === 'disbursement' 
        ? '/disbursement/login' 
        : role === 'officer' 
          ? '/officer/login' 
          : '/borrower/login';
    window.location.href = logoutTarget;
  };

  if (role === 'admin') {
    const adminMobileNavItems = [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Approvals', href: '/admin/loans', icon: FileText, isPrimary: true },
      { name: 'Contracts', href: '/admin/contract-editor', icon: FileCheck },
      { name: 'Disburse', href: '/disbursement', icon: CreditCard },
    ];

    return (
      <>
        {mobileOpen && (
          <div
            onClick={handleCloseMobile}
            className={`no-print ${adminStyles.adminBackdrop}`}
          />
        )}

        <aside className={`officer-desktop-sidebar ${adminStyles.adminSidebar} ${mobileOpen ? 'drawer-open' : ''}`}>
          {/* Top Brand Header */}
          <div className={adminStyles.adminSidebarBrandHeader}>
            <Link
              href="/admin/dashboard"
              onClick={handleCloseMobile}
              className={adminStyles.adminSidebarBrandLink}
            >
              <div>
                <div className={adminStyles.adminSidebarBrandTitleRow}>
                  <span className={adminStyles.adminSidebarBrandDot} />
                  <span className={adminStyles.adminSidebarBrandTitle}>
                    {roleLabel} Panel
                  </span>
                </div>
                <p className={adminStyles.adminSidebarBrandSubtitle}>
                  Navigation &amp; Governance
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleCloseMobile}
              className={`officer-sidebar-close-btn ${adminStyles.adminSidebarCloseBtn}`}
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Admin Profile Card */}
          <div className={adminStyles.adminSidebarProfileSection}>
            <div className={adminStyles.adminSidebarProfileCard}>
              <div className={adminStyles.adminSidebarAvatar}>
                {userName.charAt(0)}
              </div>
              <div className={adminStyles.adminSidebarProfileMeta}>
                <p className={adminStyles.adminSidebarProfileName}>
                  {userName}
                </p>
                <div className={adminStyles.adminSidebarProfileRoleRow}>
                  <ShieldCheck size={12} color="#B91C1C" />
                  <span className={adminStyles.adminSidebarProfileRoleText}>
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className={adminStyles.adminSidebarNav}>
            <div className={adminStyles.adminSidebarNavSectionLabel}>
              Executive Console
            </div>

            {links.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleCloseMobile}
                  className={`${adminStyles.adminSidebarNavLink} ${isActive ? adminStyles.adminSidebarNavLinkActive : ''}`}
                >
                  <div className={adminStyles.adminSidebarNavLinkInner}>
                    <Icon size={18} color={isActive ? '#B91C1C' : '#64748B'} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div className={adminStyles.adminSidebarFooter}>
            <button
              type="button"
              onClick={handleSignOut}
              className={adminStyles.adminSidebarLogoutBtn}
            >
              <LogOut size={17} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Bottom Navigation Bar for Admin */}
        <nav className={`officer-bottom-nav no-print ${adminStyles.adminBottomNav}`}>
          {adminMobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${adminStyles.adminMobileNavItem} ${item.isPrimary ? adminStyles.adminMobileNavItemPrimary : ''} ${isActive ? adminStyles.adminMobileNavItemActive : ''}`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive || item.isPrimary ? 2.4 : 2}
                />
                <span className={adminStyles.adminMobileNavLabel}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleOpenMobile}
            className={adminStyles.adminMobileMenuBtn}
          >
            <Menu size={20} />
            <span className={adminStyles.adminMobileNavLabel}>More</span>
          </button>
        </nav>
      </>
    );
  }

  return (
    <aside style={{
      width: '260px',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      boxShadow: '4px 0 10px rgba(0,0,0,0.05)'
    }}>
      <div style={{ padding: '20px 20px 16px 20px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: roleBadgeColor,
            boxShadow: `0 0 8px ${roleBadgeColor}`
          }} />
          <h2 style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc', margin: 0 }}>
            {roleLabel} Panel
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>
          Navigation & Controls
        </p>
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            fontWeight: '600'
          }}>
            {userName.charAt(0)}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {userName}
            </p>
            <span style={{
              display: 'inline-block',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: `${roleBadgeColor}20`,
              color: roleBadgeColor,
              fontWeight: '600',
              marginTop: '2px'
            }}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {links.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#ffffff' : '#94a3b8',
                backgroundColor: isActive ? '#0284c7' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid #1e293b' }}>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#f87171',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
