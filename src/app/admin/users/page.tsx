'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  CheckCircle, 
  X, 
  Edit2, 
  Power,
  RefreshCw
} from 'lucide-react';
import type { UserRecord, UserRole, UserStatus } from '@/lib/user-store';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './users.module.css';

export default function AdminUsersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('account_officer');
  const [password, setPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [memberNo, setMemberNo] = useState('');
  const [address, setAddress] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      })
      .catch((e) => {
        console.error('Failed to load users:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.member_no && u.member_no.toLowerCase().includes(q));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = users.length;
    const activeAos = users.filter((u) => u.role === 'account_officer' && u.status === 'active').length;
    const admins = users.filter((u) => u.role === 'admin' && u.status === 'active').length;
    const inactive = users.filter((u) => u.status === 'inactive').length;
    return { total, activeAos, admins, inactive };
  }, [users]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    setName('');
    setEmail('');
    setRole('account_officer');
    setPassword('Password123!');
    setContactNumber('');
    setMemberNo('');
    setAddress('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserRecord) => {
    setModalMode('edit');
    setSelectedUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword('');
    setContactNumber(user.contact_number || '');
    setMemberNo(user.member_no || '');
    setAddress(user.address || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            role,
            password,
            contact_number: contactNumber,
            member_no: memberNo,
            address,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.error || 'Failed to create user');
          setSubmitting(false);
          return;
        }
      } else if (modalMode === 'edit' && selectedUser) {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: selectedUser.id,
            name,
            role,
            contact_number: contactNumber,
            member_no: memberNo,
            address,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.error || 'Failed to update user');
          setSubmitting(false);
          return;
        }
      }

      setIsModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    const targetStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const confirmAction = window.confirm(
      `Are you sure you want to ${targetStatus === 'inactive' ? 'deactivate' : 'activate'} user ${user.name}?`
    );
    if (!confirmAction) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_status',
          id: user.id,
          status: targetStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to toggle user status');
        return;
      }
      await fetchUsers();
    } catch (e: any) {
      alert(e.message || 'Failed to toggle status');
    }
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return <span className={styles.roleBadgeAdmin}>Admin</span>;
      case 'account_officer':
        return <span className={styles.roleBadgeAo}>Account Officer</span>;
      case 'disbursement':
        return <span className={styles.roleBadgeDisb}>Disbursement</span>;
      default:
        return <span className={styles.roleBadgeBorrower}>Borrower</span>;
    }
  };

  return (
    <div className={`${theme.adminThemeRoot} ${theme.adminPageShell}`}>
      <Sidebar
        role="admin"
        userName="Super Admin"
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenMobile={() => setMobileMenuOpen(true)}
      />

      <main className={`officer-main-content ${theme.adminMainContent}`} style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', paddingBottom: '90px' }}>
        <AppHeader
          panelType="admin"
          userName="Dennis Yuan"
          badgeLabel="Administration & Staff Management"
          pageTitle="Manage System Users & Staff"
          pageSubtitle="Create, configure, and monitor cooperative staff accounts, Account Officers, and platform permissions."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
          actions={
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={openCreateModal}
                className={styles.createBtn}
              >
                <UserPlus size={15} /> Create New Staff
              </button>
            </div>
          }
        />

        <div className={styles.usersPageWrap} style={{ marginTop: '20px' }}>
          {/* KPI Summary Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total Accounts</span>
              <span className={styles.kpiValue}>{kpis.total}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Active Account Officers</span>
              <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{kpis.activeAos}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Executive Admins</span>
              <span className={styles.kpiValue}>{kpis.admins}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Inactive / Suspended</span>
              <span className={styles.kpiValue}>{kpis.inactive}</span>
            </div>
          </div>

          {/* User Table Card */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeaderRow}>
              <div>
                <h3 className={styles.tableTitle}>Staff Directory &amp; Role Assignments</h3>
                <p className={styles.tableSubtitle}>Review credentials, system roles, and active operational states</p>
              </div>

              <div className={styles.filterBar}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or ID..."
                    className={styles.searchInput}
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="account_officer">Account Officer</option>
                  <option value="disbursement">Disbursement Officer</option>
                  <option value="borrower">Borrower</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <button
                  type="button"
                  onClick={fetchUsers}
                  className={styles.actionBtnEdit}
                  title="Reload staff records"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.userTable}>
                <thead>
                  <tr>
                    <th>Staff / Member ID</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Contact Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        {loading ? 'Loading user accounts...' : 'No user records matching the filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                          {u.member_no || `EMP-${u.id}`}
                        </td>
                        <td style={{ fontWeight: '800', color: '#0F172A' }}>{u.name}</td>
                        <td style={{ color: '#475569' }}>{u.email}</td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td>{u.contact_number || '—'}</td>
                        <td>
                          {u.status === 'active' ? (
                            <span className={styles.statusActive}>● Active</span>
                          ) : (
                            <span className={styles.statusInactive}>○ Inactive</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.actionBtnGroup}>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className={styles.actionBtnEdit}
                              title="Edit user details"
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={styles.actionBtnToggle}
                              title={u.status === 'active' ? 'Deactivate user' : 'Activate user'}
                            >
                              <Power size={12} /> {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className={styles.modalDialog}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modalMode === 'create' ? 'Create New Staff Account' : `Edit User: ${name}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className={styles.modalBody}>
                {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Officer Juan De La Cruz"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email Address</label>
                  <input
                    type="email"
                    required
                    disabled={modalMode === 'edit'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. juan@tribute.coop"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={styles.formInput}
                  >
                    <option value="account_officer">Account Officer (AO)</option>
                    <option value="admin">Executive Administrator</option>
                    <option value="disbursement">Disbursement Officer</option>
                    <option value="borrower">Borrower / Member</option>
                  </select>
                </div>

                {modalMode === 'create' && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Initial Password</label>
                    <input
                      type="text"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Staff / Member ID Code (Optional)</label>
                  <input
                    type="text"
                    value={memberNo}
                    onChange={(e) => setMemberNo(e.target.value)}
                    placeholder="e.g. AO-002"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Contact Number (Optional)</label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 0917-123-4567"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.saveBtn}
                >
                  {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
