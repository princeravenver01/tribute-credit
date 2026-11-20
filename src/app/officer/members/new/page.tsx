'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { AppHeader } from '@/components/common/AppHeader';
import { SignaturePad } from '@/components/common/SignaturePad';
import { ProofCaptureInput } from '@/components/common/ProofCaptureInput';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  UserPlus, 
  Info,
  Check
} from 'lucide-react';
import styles from './register.module.css';

export default function OfficerRegisterMemberPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    dateOfBirth: '',
    civilStatus: 'Single' as 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced',
    email: '',
    contactNumber: '',
    address: '',
    barangay: '',
    city: '',
    province: '',
    occupation: '',
    monthlyIncome: '',
    validIdType: 'UMID',
    validIdNumber: '',
    paymentMethod: 'cash' as 'cash' | 'online' | 'bank_transfer',
    paymentReference: '',
  });

  // 3 Mandatory Identity Evidence items
  const [signatureData, setSignatureData] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [idSelfieUrl, setIdSelfieUrl] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate 3 evidence items client-side
    if (!signatureData) {
      setErrorMsg('Mandatory Evidence Missing: Member digital e-signature is strictly required.');
      return;
    }
    if (!photoUrl) {
      setErrorMsg('Mandatory Evidence Missing: Member profile photo is strictly required.');
      return;
    }
    if (!idSelfieUrl) {
      setErrorMsg('Mandatory Evidence Missing: Member selfie holding valid ID is strictly required.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        monthlyIncome: Number(formData.monthlyIncome) || 0,
        signatureData,
        photoUrl,
        idSelfieUrl,
      };

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete cooperative member registration.');
      }

      setSuccessMsg(`Member registered successfully! Member Number: ${data.member.memberNo}`);
      setTimeout(() => {
        router.push('/officer/members');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during member registration.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className={styles.mainContent}>
        <AppHeader
          panelType="officer"
          pageTitle="Register Cooperative Member"
          pageSubtitle="New Member Enrolment & Opening Share Capital"
          onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        />

        <div className={styles.contentWrapper}>
          <div className={styles.headerRow}>
            <Link href="/officer/members" className={styles.backBtn}>
              <ArrowLeft size={16} />
              <span>Back to Member Registry</span>
            </Link>
          </div>

          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h1>Cooperative Member Registration</h1>
              <p>Complete all personal information, verify the fixed opening fee schedule, and capture the three required identity evidence items.</p>
            </div>

            <div className={styles.noticeBanner}>
              <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Notice: Cooperative Membership Only.</strong>
                <div>This action enrolls an individual as an official member and share capital contributor of Tribute Credit Cooperative. It does not create a loan, loan application, or borrower record.</div>
              </div>
            </div>

            {errorMsg && (
              <div className={styles.errorBanner}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{errorMsg}</div>
              </div>
            )}

            {successMsg && (
              <div className={styles.noticeBanner} style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}>
                <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{successMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.formBody}>
              {/* Section 1: Personal Details */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  1. Member Personal Information
                </div>
                <div className={styles.grid3} style={{ marginBottom: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label>First Name <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      className={styles.input}
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="e.g. Maria"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      className={styles.input}
                      value={formData.middleName}
                      onChange={handleInputChange}
                      placeholder="e.g. Santos"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Last Name <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      className={styles.input}
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="e.g. Dela Cruz"
                    />
                  </div>
                </div>

                <div className={styles.grid3} style={{ marginBottom: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label>Suffix</label>
                    <input
                      type="text"
                      name="suffix"
                      className={styles.input}
                      value={formData.suffix}
                      onChange={handleInputChange}
                      placeholder="Jr., Sr., III (optional)"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Gender <span className={styles.required}>*</span></label>
                    <select
                      name="gender"
                      className={styles.input}
                      value={formData.gender}
                      onChange={handleInputChange}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Civil Status <span className={styles.required}>*</span></label>
                    <select
                      name="civilStatus"
                      className={styles.input}
                      value={formData.civilStatus}
                      onChange={handleInputChange}
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label>Date of Birth <span className={styles.required}>*</span></label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      required
                      className={styles.input}
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Occupation <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="occupation"
                      required
                      className={styles.input}
                      value={formData.occupation}
                      onChange={handleInputChange}
                      placeholder="e.g. Market Vendor, Teacher"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Address */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  2. Contact & Residential Address
                </div>
                <div className={styles.grid2} style={{ marginBottom: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label>Email Address <span className={styles.required}>*</span></label>
                    <input
                      type="email"
                      name="email"
                      required
                      className={styles.input}
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="e.g. maria.delacruz@gmail.com"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Contact / Mobile Number <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="contactNumber"
                      required
                      className={styles.input}
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="e.g. 0917-123-4567"
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                  <label>House / Unit No., Street Address <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    name="address"
                    required
                    className={styles.input}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="e.g. Blk 12 Lot 4, Sunflower St."
                  />
                </div>

                <div className={styles.grid3}>
                  <div className={styles.formGroup}>
                    <label>Barangay <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="barangay"
                      required
                      className={styles.input}
                      value={formData.barangay}
                      onChange={handleInputChange}
                      placeholder="e.g. Commonwealth"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>City / Municipality <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="city"
                      required
                      className={styles.input}
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="e.g. Quezon City"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Province <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="province"
                      required
                      className={styles.input}
                      value={formData.province}
                      onChange={handleInputChange}
                      placeholder="e.g. Metro Manila"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Official Valid Identification */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  3. Primary Government Identification
                </div>
                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label>Valid ID Presented <span className={styles.required}>*</span></label>
                    <select
                      name="validIdType"
                      className={styles.input}
                      value={formData.validIdType}
                      onChange={handleInputChange}
                    >
                      <option value="UMID">UMID (Unified Multi-Purpose ID)</option>
                      <option value="PhilSys ID">PhilSys National ID</option>
                      <option value="Driver's License">LTO Driver&apos;s License</option>
                      <option value="Passport">Philippine Passport</option>
                      <option value="SSS ID">Social Security System (SSS) ID</option>
                      <option value="PRC ID">Professional Regulation Commission ID</option>
                      <option value="Voter's ID">COMELEC Voter&apos;s ID</option>
                      <option value="Postal ID">PhilPost Postal ID</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Valid ID Number <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      name="validIdNumber"
                      required
                      className={styles.input}
                      value={formData.validIdNumber}
                      onChange={handleInputChange}
                      placeholder="e.g. 0111-2345678-9"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Fixed Opening Financial Schedule */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  4. Fixed Opening Capital & Fees Schedule (₱3,000)
                </div>
                <div className={styles.financialSummaryBox}>
                  <div className={styles.summaryRow}>
                    <span>1. Membership Registration Fee (Non-refundable):</span>
                    <strong>₱500.00</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>2. Capital Share / Member Equity (CBU):</span>
                    <strong>₱2,000.00</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>3. Initial Savings Deposit:</span>
                    <strong>₱500.00</strong>
                  </div>
                  <div className={styles.summaryTotal}>
                    <span>Total Required Opening Payment:</span>
                    <span>₱3,000.00</span>
                  </div>
                </div>

                <div className={styles.grid2} style={{ marginTop: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label>Payment Method <span className={styles.required}>*</span></label>
                    <select
                      name="paymentMethod"
                      className={styles.input}
                      value={formData.paymentMethod}
                      onChange={handleInputChange}
                    >
                      <option value="cash">Cash (Over-the-Counter / AO Collection)</option>
                      <option value="online">Online Payment / GCash / Maya</option>
                      <option value="bank_transfer">Direct Bank Deposit / Transfer</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Payment Receipt / Reference Number</label>
                    <input
                      type="text"
                      name="paymentReference"
                      className={styles.input}
                      value={formData.paymentReference}
                      onChange={handleInputChange}
                      placeholder="e.g. OR-2026-9901 or GCash Ref"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Three Mandatory Identity Evidence Items */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>
                  5. Mandatory Identity Evidence (All 3 Items Required)
                </div>

                <div className={styles.evidenceSection}>
                  {/* Evidence 1: Profile Photo */}
                  <div className={styles.evidenceItem}>
                    <div className={styles.evidenceLabel}>
                      Evidence 1: Member Profile Photo <span className={styles.required}>*</span>
                    </div>
                    <div className={styles.evidenceDesc}>
                      Take a clear front-facing photograph of the cooperative member.
                    </div>
                    <ProofCaptureInput
                      label="Member Profile Photo"
                      helperText="Live camera or photo upload of member face"
                      value={photoUrl}
                      accent="officer"
                      onChange={(data) => setPhotoUrl(data)}
                    />
                    <div className={`${styles.evidenceStatus} ${photoUrl ? styles.statusComplete : styles.statusPending}`}>
                      {photoUrl ? <><Check size={14} /> Profile Photo Captured</> : 'Awaiting Photo Capture'}
                    </div>
                  </div>

                  {/* Evidence 2: Selfie Holding Valid ID */}
                  <div className={styles.evidenceItem}>
                    <div className={styles.evidenceLabel}>
                      Evidence 2: Selfie Holding Valid ID <span className={styles.required}>*</span>
                    </div>
                    <div className={styles.evidenceDesc}>
                      Member must hold their official valid ID next to their face for anti-impersonation verification.
                    </div>
                    <ProofCaptureInput
                      label="Selfie with Valid ID"
                      helperText="Capture member holding the selected ID"
                      value={idSelfieUrl}
                      accent="officer"
                      onChange={(data) => setIdSelfieUrl(data)}
                    />
                    <div className={`${styles.evidenceStatus} ${idSelfieUrl ? styles.statusComplete : styles.statusPending}`}>
                      {idSelfieUrl ? <><Check size={14} /> ID Selfie Verified</> : 'Awaiting ID Selfie'}
                    </div>
                  </div>

                  {/* Evidence 3: E-Signature */}
                  <div className={styles.evidenceItem}>
                    <div className={styles.evidenceLabel}>
                      Evidence 3: Member Digital E-Signature <span className={styles.required}>*</span>
                    </div>
                    <div className={styles.evidenceDesc}>
                      Member must sign on the digital pad to authorize cooperative membership and capital share subscription.
                    </div>
                    <SignaturePad onSave={(data) => setSignatureData(data)} height={160} />
                    <div className={`${styles.evidenceStatus} ${signatureData ? styles.statusComplete : styles.statusPending}`}>
                      {signatureData ? <><Check size={14} /> Digital Signature Recorded</> : 'Awaiting Digital Signature'}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formFooter}>
                <Link href="/officer/members" className={styles.backBtn} style={{ marginRight: 'auto' }}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || !signatureData || !photoUrl || !idSelfieUrl}
                  className={styles.submitBtn}
                >
                  <UserPlus size={18} />
                  <span>{submitting ? 'Registering Member...' : 'Register Cooperative Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />
    </div>
  );
}
