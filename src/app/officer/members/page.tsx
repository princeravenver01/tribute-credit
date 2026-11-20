'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { AppHeader } from '@/components/common/AppHeader';
import {
  Users,
  UserPlus,
  Search,
  X,
  Eye,
  FileCheck2,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { CooperativeMember } from '@/lib/coop-member-store';
import styles from './members.module.css';

export default function OfficerMembersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<CooperativeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<CooperativeMember | null>(null);

  // Active Tab: 'full_cooperative' vs 'borrower_only'
  const [activeTab, setActiveTab] = useState<'full_cooperative' | 'borrower_only'>('full_cooperative');

  // Record Payment Modal State
  const [payingMember, setPayingMember] = useState<CooperativeMember | null>(null);
  const [payComponent, setPayComponent] = useState<'all' | 'registration_fee' | 'capital_share' | 'savings_deposit'>('all');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'online' | 'bank_transfer'>('cash');
  const [payRef, setPayRef] = useState<string>('');
  const [paySubmitting, setPaySubmitting] = useState<boolean>(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);

  const handleSyncExistingBorrowers = async () => {
    setIsReconciling(true);
    setReconcileMessage(null);
    try {
      const res = await fetch('/api/members/reconcile', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const s = data.summary;
        setReconcileMessage(
          `✓ Sync Complete: Evaluated ${s.totalEvaluated} borrowers (${s.newlyCreated} newly linked, ${s.alreadyExisted} already up to date).`
        );
        fetchMembers(searchQuery, activeTab);
      } else {
        setReconcileMessage(`Sync notice: ${data.error || 'Failed to sync borrowers.'}`);
      }
    } catch {
      setReconcileMessage('Failed to complete borrower reconciliation sync.');
    } finally {
      setIsReconciling(false);
      setTimeout(() => setReconcileMessage(null), 6000);
    }
  };
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [payAuditDetail, setPayAuditDetail] = useState<{
    auditId?: string;
    recordedByName?: string;
    recordedByRole?: string;
    paymentReference?: string;
  } | null>(null);

  const fetchMembers = async (query = '', type?: string) => {
    setLoading(true);
    try {
      const targetType = type !== undefined ? type : activeTab;
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (targetType) params.set('type', targetType);

      const res = await fetch(`/api/members?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
      }
    } catch (e) {
      console.error('Failed to load members', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/members?type=${activeTab}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.members)) {
          setMembers(data.members);
        }
      })
      .catch((e) => {
        console.error('Failed to load members:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers(searchQuery, activeTab);
  };

  const handleOpenPayment = (m: CooperativeMember) => {
    const curFee = m.registrationFee || 0;
    const curCap = m.capitalShare || 0;
    const curSav = m.initialSavings || 0;

    const remFee = Math.max(0, 500 - curFee);
    const remCap = Math.max(0, 2000 - curCap);
    const remSav = Math.max(0, 500 - curSav);
    const totalRem = remFee + remCap + remSav;

    setPayingMember(m);
    setPayComponent('all');
    setPayAmount(totalRem);
    setPayMethod('cash');
    setPayRef(`OR-${String(m.id).slice(-4)}-${totalRem}`);
    setPayError(null);
    setPaySuccess(null);
  };

  const handleComponentChange = (comp: 'all' | 'registration_fee' | 'capital_share' | 'savings_deposit') => {
    setPayComponent(comp);
    if (!payingMember) return;
    const curFee = payingMember.registrationFee || 0;
    const curCap = payingMember.capitalShare || 0;
    const curSav = payingMember.initialSavings || 0;

    if (comp === 'registration_fee') setPayAmount(Math.max(0, 500 - curFee));
    else if (comp === 'capital_share') setPayAmount(Math.max(0, 2000 - curCap));
    else if (comp === 'savings_deposit') setPayAmount(Math.max(0, 500 - curSav));
    else setPayAmount(Math.max(0, 500 - curFee) + Math.max(0, 2000 - curCap) + Math.max(0, 500 - curSav));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingMember || payAmount <= 0) return;

    setPaySubmitting(true);
    setPayError(null);
    setPaySuccess(null);

    try {
      const res = await fetch('/api/members/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberNo: payingMember.memberNo,
          component: payComponent,
          amount: payAmount,
          paymentMethod: payMethod,
          paymentReference: payRef,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      setPaySuccess(
        data.member.membershipType === 'full_cooperative'
          ? `🎉 Payment Recorded! Member has met all requirements and has been promoted to Full Cooperative Member!`
          : `✓ Payment of ₱${payAmount.toLocaleString()} recorded successfully.`
      );
      if (data.audit) {
        setPayAuditDetail(data.audit);
      }

      // Refresh list
      setTimeout(() => {
        fetchMembers(searchQuery, activeTab);
        if (data.member.membershipType === 'full_cooperative') {
          setPayingMember(null);
          setPayAuditDetail(null);
        } else {
          setPayingMember(data.member);
        }
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      setPayError(msg);
    } finally {
      setPaySubmitting(false);
    }
  };

  const totalCapitalShare = members.reduce((sum, m) => sum + (m.capitalShare || 0), 0);
  const totalSavings = members.reduce((sum, m) => sum + (m.initialSavings || 0), 0);

  return (
    <div className={styles.pageContainer}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className={styles.mainContent}>
        <AppHeader
          panelType="officer"
          pageTitle="Cooperative Membership Registry"
          pageSubtitle="Tribute Credit Cooperative Member Directory & Share Capital Records"
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        />

        <div className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <div className={styles.titleArea}>
              <h1>Member Management</h1>
              <p>Authoritative cooperative roll, statutory share capital (CBU), opening savings, and borrower-only tracking.</p>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={handleSyncExistingBorrowers}
                disabled={isReconciling}
                className={styles.secondaryBtn}
                title="Synchronize and backfill unlinked borrowers into membership roll"
              >
                <RefreshCw size={16} className={isReconciling ? styles.spinning : ''} />
                <span>{isReconciling ? 'Syncing...' : 'Sync Borrowers'}</span>
              </button>
              <button
                type="button"
                onClick={() => fetchMembers(searchQuery, activeTab)}
                className={styles.secondaryBtn}
                title="Refresh Member List"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
              <Link href="/officer/members/new" className={styles.primaryBtn}>
                <UserPlus size={18} />
                <span>Register New Member</span>
              </Link>
            </div>
          </div>

          {reconcileMessage && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {reconcileMessage}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className={styles.tabsContainer}>
            <button
              type="button"
              onClick={() => { setActiveTab('full_cooperative'); setSearchQuery(''); }}
              className={`${styles.tabBtn} ${activeTab === 'full_cooperative' ? styles.tabBtnActive : ''}`}
            >
              <span>Cooperative Members (Fully Paid)</span>
              <span className={`${styles.tabBadge} ${activeTab === 'full_cooperative' ? styles.tabBadgeActive : ''}`}>
                {activeTab === 'full_cooperative' ? members.length : 'Full'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('borrower_only'); setSearchQuery(''); }}
              className={`${styles.tabBtn} ${activeTab === 'borrower_only' ? styles.tabBtnActive : ''}`}
            >
              <span>Borrower-Only Members (Incomplete Fees)</span>
              <span className={`${styles.tabBadge} ${activeTab === 'borrower_only' ? styles.tabBadgeActive : ''}`}>
                {activeTab === 'borrower_only' ? members.length : 'Provisional'}
              </span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>
                {activeTab === 'full_cooperative' ? 'Full Cooperative Members' : 'Borrower-Only Accounts'}
              </div>
              <div className={styles.statValue}>{members.length}</div>
              <div className={styles.statSubtext}>
                {activeTab === 'full_cooperative' ? 'Qualified Shareholders' : 'Awaiting Full Capital & Fees'}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total CBU / Capital Share</div>
              <div className={styles.statValue}>₱{totalCapitalShare.toLocaleString()}</div>
              <div className={styles.statSubtext}>₱2,000 required per member</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Opening Savings</div>
              <div className={styles.statValue}>₱{totalSavings.toLocaleString()}</div>
              <div className={styles.statSubtext}>₱500 required deposit</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Registration Fees Collected</div>
              <div className={styles.statValue}>₱{(members.reduce((s, m) => s + (m.registrationFee || 0), 0)).toLocaleString()}</div>
              <div className={styles.statSubtext}>₱500 non-refundable fee</div>
            </div>
          </div>

          {/* Search Filter */}
          <form onSubmit={handleSearch} className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by member name, MCID (TCID-M-...), email, or city..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.primaryBtn}>
              Search
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); fetchMembers('', activeTab); }}
                className={styles.secondaryBtn}
              >
                Clear
              </button>
            )}
          </form>

          {/* Table */}
          <div className={styles.tableContainer}>
            <div className={styles.tableWrapper}>
              <table className={styles.membersTable}>
                <thead>
                  <tr>
                    <th>Member Profile</th>
                    <th>Contact & Location</th>
                    <th>Status / Evidence</th>
                    <th>Fee Progress</th>
                    <th>Total Paid</th>
                    <th>{activeTab === 'full_cooperative' ? 'Registration Date' : 'Remaining Balance'}</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        Loading members...
                      </td>
                    </tr>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        <Users size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                          {activeTab === 'full_cooperative' ? 'No full cooperative members found' : 'No borrower-only members found'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                          {searchQuery ? 'Try adjusting your search criteria.' : 'Records will appear here as members are enrolled or borrowers onboarded.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => {
                      const totalPaid = (member.registrationFee || 0) + (member.capitalShare || 0) + (member.initialSavings || 0);
                      const totalRemaining = Math.max(0, 3000 - totalPaid);
                      const pct = Math.min(100, Math.round((totalPaid / 3000) * 100));

                      return (
                        <tr key={member.memberNo}>
                          <td>
                            <div className={styles.memberCell}>
                              {member.photoUrl ? (
                                <img
                                  src={member.photoUrl}
                                  alt={member.fullName}
                                  className={styles.memberAvatar}
                                />
                              ) : (
                                <div className={styles.memberInitials}>
                                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className={styles.memberName}>{member.fullName}</div>
                                <div className={styles.memberNo}>{member.memberNo}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>{member.contactNumber}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{member.email}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{member.city || 'Metro Manila'}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span className={`${styles.badge} ${member.membershipType === 'full_cooperative' ? styles.badgeActive : styles.badgeEvidence}`}>
                                {member.membershipType === 'full_cooperative' ? 'Full Member' : 'Borrower-Only'}
                              </span>
                              {member.signatureData ? (
                                <span className={`${styles.badge} ${styles.badgeEvidence}`}>
                                  <FileCheck2 size={12} /> E-Signed
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pending Evidence</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.progressContainer}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                <span>{pct}%</span>
                                <span>₱{totalPaid.toLocaleString()} / ₱3,000</span>
                              </div>
                              <div className={styles.progressBarBg}>
                                <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                Fee: ₱{member.registrationFee || 0} • CBU: ₱{member.capitalShare || 0} • Sav: ₱{member.initialSavings || 0}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: '#15803d' }}>
                              ₱{totalPaid.toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Ref: {member.paymentReference || 'N/A'}
                            </div>
                          </td>
                          <td>
                            {activeTab === 'full_cooperative' ? (
                              <>
                                <div style={{ fontSize: '0.85rem' }}>
                                  {new Date(member.createdAt).toLocaleDateString()}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {new Date(member.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontWeight: 700, color: totalRemaining > 0 ? '#b91c1c' : '#15803d' }}>
                                {totalRemaining > 0 ? `₱${totalRemaining.toLocaleString()} Due` : 'Fully Paid'}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedMember(member)}
                                className={styles.actionBtn}
                                title="View Dossier"
                              >
                                <Eye size={14} />
                                <span>Dossier</span>
                              </button>
                              {activeTab === 'borrower_only' && totalRemaining > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayment(member)}
                                  className={styles.primaryBtn}
                                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                                  title="Record Membership Payment"
                                >
                                  <CreditCard size={14} />
                                  <span>Pay</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />

      {/* Record Payment In-App Modal */}
      {payingMember && (
        <div className={styles.modalOverlay} onClick={() => setPayingMember(null)}>
          <div className={styles.modalContent} style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Record Membership Payment</h2>
                <span className={styles.memberNo}>{payingMember.fullName} ({payingMember.memberNo})</span>
              </div>
              <button type="button" onClick={() => setPayingMember(null)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className={styles.modalBody}>
              {payError && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', marginBottom: '1rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {payError}
                </div>
              )}
              {paySuccess && (
                <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderLeft: '4px solid #16a34a', color: '#166534', marginBottom: '1rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                  <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                  {paySuccess}
                  {payAuditDetail && (
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#14532d', borderTop: '1px solid #bbf7d0', paddingTop: '4px' }}>
                      <strong>Audit ID:</strong> {payAuditDetail.auditId} | <strong>Actor:</strong> {payAuditDetail.recordedByName} ({payAuditDetail.recordedByRole}) | <strong>Ref:</strong> {payAuditDetail.paymentReference}
                    </div>
                  )}
                </div>
              )}

              {/* Balances Status Box */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Required Opening Balances & Current Status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Reg Fee</div>
                    <div style={{ fontWeight: 700, color: (payingMember.registrationFee || 0) >= 500 ? '#15803d' : '#b91c1c' }}>
                      ₱{payingMember.registrationFee || 0} / 500
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Capital Share</div>
                    <div style={{ fontWeight: 700, color: (payingMember.capitalShare || 0) >= 2000 ? '#15803d' : '#b91c1c' }}>
                      ₱{payingMember.capitalShare || 0} / 2k
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Savings</div>
                    <div style={{ fontWeight: 700, color: (payingMember.initialSavings || 0) >= 500 ? '#15803d' : '#b91c1c' }}>
                      ₱{payingMember.initialSavings || 0} / 500
                    </div>
                  </div>
                </div>
              </div>

              {/* Component Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Payment Target Component
                </label>
                <select
                  value={payComponent}
                  onChange={(e) => handleComponentChange(e.target.value as any)}
                  className={styles.searchInput}
                  style={{ padding: '0.65rem' }}
                >
                  <option value="all">Pay All Remaining Balance (Full Settlement)</option>
                  <option value="registration_fee">1. Membership Registration Fee (₱500 max)</option>
                  <option value="capital_share">2. Capital Share / CBU Equity (₱2,000 max)</option>
                  <option value="savings_deposit">3. Opening Savings Deposit (₱500 max)</option>
                </select>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Amount to Pay (PHP)
                </label>
                <input
                  type="number"
                  min="1"
                  max="3000"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className={styles.searchInput}
                  style={{ padding: '0.65rem' }}
                />
              </div>

              {/* Method and Reference */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className={styles.searchInput}
                    style={{ padding: '0.65rem' }}
                  >
                    <option value="cash">Cash (AO / Field Collection)</option>
                    <option value="online">Online (GCash / Maya)</option>
                    <option value="bank_transfer">Bank Transfer / Deposit</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Official Receipt / Ref No.
                  </label>
                  <input
                    type="text"
                    required
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className={styles.searchInput}
                    style={{ padding: '0.65rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPayingMember(null)}
                  className={styles.secondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting || payAmount <= 0}
                  className={styles.primaryBtn}
                >
                  {paySubmitting ? 'Recording Payment...' : `Confirm & Record ₱${payAmount.toLocaleString()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details Modal */}
      {selectedMember && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Cooperative Member Dossier</h2>
                <span className={styles.memberNo}>{selectedMember.memberNo}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className={styles.closeBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Personal Information */}
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Personal & Contact Details</div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Full Legal Name</label>
                    <p>{selectedMember.fullName}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Gender / Civil Status</label>
                    <p>{selectedMember.gender} • {selectedMember.civilStatus}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Date of Birth</label>
                    <p>{selectedMember.dateOfBirth}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Contact Number</label>
                    <p>{selectedMember.contactNumber}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Email Address</label>
                    <p>{selectedMember.email}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Occupation / Monthly Income</label>
                    <p>{selectedMember.occupation || 'N/A'} (₱{(selectedMember.monthlyIncome || 0).toLocaleString()})</p>
                  </div>
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <label>Residential Address</label>
                    <p>{selectedMember.address || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Opening Financial Breakdown */}
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Opening Capital & Fees Breakdown (Fixed ₱3,000)</div>
                <div className={styles.financialBreakdown}>
                  <div className={styles.financialRow}>
                    <span>1. Non-Refundable Membership Registration Fee:</span>
                    <strong>₱{(selectedMember.registrationFee || 0).toLocaleString()}.00 / ₱500.00</strong>
                  </div>
                  <div className={styles.financialRow}>
                    <span>2. Cooperative Capital Share (CBU Equity):</span>
                    <strong>₱{(selectedMember.capitalShare || 0).toLocaleString()}.00 / ₱2,000.00</strong>
                  </div>
                  <div className={styles.financialRow}>
                    <span>3. Opening Savings Deposit Balance:</span>
                    <strong>₱{(selectedMember.initialSavings || 0).toLocaleString()}.00 / ₱500.00</strong>
                  </div>
                  <div className={styles.financialTotal}>
                    <span>Total Paid:</span>
                    <span>₱{(selectedMember.totalPaid || 0).toLocaleString()}.00 / ₱3,000.00</span>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Membership Classification:{' '}
                    <strong style={{ color: selectedMember.membershipType === 'full_cooperative' ? '#15803d' : '#b91c1c' }}>
                      {selectedMember.membershipType === 'full_cooperative' ? 'FULL COOPERATIVE MEMBER' : 'BORROWER-ONLY MEMBER'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Mandatory Identity Evidence Items if available */}
              {selectedMember.photoUrl && (
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Mandatory Identity Evidence</div>
                  <div className={styles.evidenceGrid}>
                    <div className={styles.evidenceCard}>
                      <div className={styles.evidenceCardTitle}>1. Member Profile Photo</div>
                      <img
                        src={selectedMember.photoUrl}
                        alt="Profile Photo"
                        className={styles.evidenceImage}
                      />
                    </div>
                    {selectedMember.idSelfieUrl && (
                      <div className={styles.evidenceCard}>
                        <div className={styles.evidenceCardTitle}>2. Selfie Holding Valid ID</div>
                        <img
                          src={selectedMember.idSelfieUrl}
                          alt="ID Selfie"
                          className={styles.evidenceImage}
                        />
                      </div>
                    )}
                    {selectedMember.signatureData && (
                      <div className={styles.evidenceCard}>
                        <div className={styles.evidenceCardTitle}>3. Member Digital Signature</div>
                        <img
                          src={selectedMember.signatureData}
                          alt="Signature"
                          className={styles.evidenceImage}
                          style={{ backgroundColor: '#ffffff' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Details */}
              <div className={styles.detailSection} style={{ marginBottom: 0 }}>
                <div className={styles.detailSectionTitle}>Registration Audit Trail</div>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <label>Registered By</label>
                    <p>{selectedMember.registeredByName} ({selectedMember.registeredByRole})</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Registered Timestamp</label>
                    <p>{new Date(selectedMember.createdAt).toLocaleString()}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <label>Status</label>
                    <p style={{ color: selectedMember.membershipType === 'full_cooperative' ? '#15803d' : '#b91c1c' }}>
                      {selectedMember.membershipType === 'full_cooperative' ? 'Active Full Member' : 'Provisional Borrower-Only'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
