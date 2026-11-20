'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfficerSidebar } from '@/components/officer/OfficerSidebar';
import { OfficerMobileNav } from '@/components/officer/OfficerMobileNav';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { AppHeader } from '@/components/common/AppHeader';
import { SignaturePad } from '@/components/common/SignaturePad';
import { FaceCapture } from '@/components/common/FaceCapture';
import { PH_LOCATIONS, COUNTRY_CODES, GOV_ID_TYPES } from '@/lib/ph-data';
import {
  PH_OCCUPATIONS,
  ASSET_CATEGORIES,
  OTHER_INCOME_SOURCES,
  LIABILITY_TYPES,
  DEPENDANT_RELATIONS
} from '@/lib/livelihood-data';
import {
  calculateTributeLoan,
  runAiCreditVerification,
  AiVerificationResult,
  CalculationResult
} from '@/lib/tribute-loan-engine';
import {
  saveCreditAssessment,
  getCreditAssessments,
  updateAssessmentStatus,
  calculate5CsGrade,
  generateNextCooperativeId,
  generateNextLoanReference,
  CreditAssessmentItem
} from '@/lib/credit-assessment-store';
import {
  User,
  Phone,
  Plus,
  Trash2,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Users,
  Briefcase,
  Coins,
  DollarSign,
  Scale,
  FileCheck2,
  FileCheck,
  Eye,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Calculator,
  Paperclip,
  Check,
  Sparkles,
  Bot,
  Sliders,
  Send,
  Building,
  Printer,
  Camera,
  PenTool,
  Clock,
  ArrowRight,
  Shield,
  Menu,
  FileSpreadsheet,
  BookOpen
} from 'lucide-react';
import { PassbookBooklet, LoanPaymentLedger, PassbookData } from '@/components/passbook/PassbookBooklet';
import {
  OfficialSignatureBlock,
  OfficialSignatureRecord,
  getLatestOfficialSignature,
  formatPhDateTime
} from '@/components/common/OfficialSignatureBlock';
import { generateCollectionScheduleDates, isPhilippineHoliday } from '@/lib/ph-holidays';
import { 
  getActiveContractTemplate, 
  ContractTemplate, 
  DEFAULT_CONTRACT_TEMPLATE, 
  interpolateContractHtml 
} from '@/lib/contract-template-store';
import theme from '@/components/officer/OfficerTheme.module.css';
import styles from './onboarding.module.css';

interface GovIdRecord {
  idType: string;
  idNumber: string;
  expiryDate: string;
  photoFrontName?: string;
  photoFrontBase64?: string;
  photoBackName?: string;
  photoBackBase64?: string;
}

interface DependantRecord {
  lastName: string;
  firstName: string;
  middleName: string;
  relation: string;
  dateOfBirth: string;
  isSchooling: boolean;
}

interface AssetRecord {
  category: string;
  subtype: string;
  nameTitle: string;
  titleNumber: string;
  titleHolderName?: string;
  location?: string;
  totalLotArea?: string; // sqm (optional)
  floorArea?: string; // sqm (optional)
  jurisdiction: string;
  appraisedValue: number;
  valuationDate: string;
}

interface OtherIncomeRecord {
  source: string;
  description: string;
  monthlyAmount: number;
}

interface LiabilityRecord {
  creditorName: string;
  liabilityType: string;
  totalOutstanding: number;
  monthlyAmortization: number;
}

interface AttachmentRecord {
  documentType: string;
  fileName: string;
  fileSize?: string;
  description?: string;
  fileBase64?: string;
}

export default function NewBorrowerRegistrationPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Current Step: 1 to 7 (plus Verification intermission after Step 6)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [isAiVerifying, setIsAiVerifying] = useState(false);
  const [aiTimerSeconds, setAiTimerSeconds] = useState(60);
  const [aiResult, setAiResult] = useState<AiVerificationResult | null>(null);

  // Workflow Loan Amounts & IDs:
  const [applicationId, setApplicationId] = useState<string>('');
  const [officerAdjustedAmount, setOfficerAdjustedAmount] = useState<number>(0);
  const [officerAdjustmentNote, setOfficerAdjustmentNote] = useState<string>('');
  const [adminSimulationStatus, setAdminSimulationStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [adminApprovedAmount, setAdminApprovedAmount] = useState<number>(0);
  const [adjustmentCount, setAdjustmentCount] = useState<number>(0);

  const [isSubmittingToAdmin, setIsSubmittingToAdmin] = useState(false);
  const [isSubmittedToAdmin, setIsSubmittedToAdmin] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Account Officer GPS Location Verification Gate
  const [aoLocationVerified, setAoLocationVerified] = useState<boolean>(false);
  const [aoLocationConfirmed, setAoLocationConfirmed] = useState<boolean>(false);
  const [aoLocationData, setAoLocationData] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
    addressLabel?: string;
  } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>('');

  // Step 1: Personal Information
  const [step1, setStep1] = useState({
    cooperativeId: typeof window !== 'undefined' ? generateNextCooperativeId() : 'TCID-A-00001',
    lastName: '',
    firstName: '',
    middleName: '',
    suffix: '',
    dateOfBirth: '',
    civilStatus: 'Single',
    sex: 'Male',
    nationality: 'Filipino',
    tgswsPolicyNumber: 'LCAP-',
    referral: '',
  });

  // Real-Time Member Detection State
  const [detectedMember, setDetectedMember] = useState<any | null>(null);
  const [isDetectingMember, setIsDetectingMember] = useState<boolean>(false);
  const [detectedMemberDismissed, setDetectedMemberDismissed] = useState<boolean>(false);

  // Step 2: Contact Information
  const [step2, setStep2] = useState({
    countryCode: '+63',
    mobileNumber: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    province: 'Metro Manila (NCR)',
    city: 'Quezon City',
    barangay: 'Batasan Hills',
    postalCode: '',
    residenceOwnership: 'Owned',
    otherResidenceOwnership: '',
    yearsOfResidence: '',
  });

  const [govIds, setGovIds] = useState<GovIdRecord[]>([
    { idType: 'PH National ID (PhilSys)', idNumber: '', expiryDate: '' },
  ]);

  // Step 3: Dependants
  const [dependants, setDependants] = useState<DependantRecord[]>([]);

  // Step 4: Livelihood & Income
  const [step4, setStep4] = useState({
    occupation: 'Private Company Employee',
    otherOccupation: '',
    employerEnterpriseName: '',
    yearsInLivelihood: '3',
    monthlyNetIncome: 25000,
  });

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<OtherIncomeRecord[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRecord[]>([]);

  // Step 5: Loan Terms
  const [step5, setStep5] = useState({
    loanProduct: 'Regular Loan',
    requestedAmount: 10000,
    termMonths: 3, // Business plan min 2 to 6 months
    repaymentFrequency: 'Daily' as 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly',
    loanPurpose: 'Debt Consolidation',
    otherPurpose: '',
  });

  // Step 6: Consent & Review
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([
    { documentType: 'Proof of Billing / Residence', fileName: 'billing_statement.pdf', fileSize: '1.2 MB' },
  ]);
  const [officerAssessmentNotes, setOfficerAssessmentNotes] = useState('');
  const [privacyConsentAffirmed, setPrivacyConsentAffirmed] = useState(false);

  // Step 7: Contract Execution & Disbursement Choice
  const [applicantSignature, setApplicantSignature] = useState<string>('');
  const [borrowerSignatures, setBorrowerSignatures] = useState<
    { signature: string; authId: string; timestamp: string }[]
  >([]);
  const [activeBorrowerSigSlot, setActiveBorrowerSigSlot] = useState<number>(0);

  const [officerSignatures, setOfficerSignatures] = useState<
    { signature: string; authId: string; timestamp: string }[]
  >([]);
  const [activeOfficerSigSlot, setActiveOfficerSigSlot] = useState<number>(0);

  const [adminSignatures, setAdminSignatures] = useState<
    { signature: string; authId: string; timestamp: string }[]
  >([]);
  const [adminActionAt, setAdminActionAt] = useState<string>('');

  const [applicantFacePhoto, setApplicantFacePhoto] = useState<string>('');
  const [borrowerHoldingIdPhoto, setBorrowerHoldingIdPhoto] = useState<string>('');
  const [contractAgreed, setContractAgreed] = useState(false);
  const [isContractFinalized, setIsContractFinalized] = useState(false);
  const [disbursementMode, setDisbursementMode] = useState<'cash' | 'online'>('cash');
  const [disbursementChannel, setDisbursementChannel] = useState<string>('Cashier Window');
  const [disbursementAccountNumber, setDisbursementAccountNumber] = useState<string>('');
  const [activeExecutedTab, setActiveExecutedTab] = useState<'schedule' | 'contract' | 'passbook_inside' | 'payment_ledger'>('schedule');

  // Contract Template State (Active master template or immutable executed snapshot)
  const [contractTemplateSnapshot, setContractTemplateSnapshot] = useState<ContractTemplate | null>(null);

  // Dedicated Print Target Mode ('all' | 'contract' | 'schedule' | 'ledger' | 'passbook' | 'payment-ledger')
  const handlePrintDocument = (target: 'all' | 'contract' | 'schedule' | 'ledger' | 'passbook' | 'payment-ledger') => {
    // Remove any previous print classes
    document.body.classList.remove('print-mode-contract', 'print-mode-schedule', 'print-mode-ledger', 'print-mode-all', 'print-mode-passbook', 'print-mode-payment-ledger');
    if (target !== 'all') {
      document.body.classList.add(`print-mode-${target}`);
    }

    // Explicitly inject dynamic @page orientation into head so browser print engine sets Landscape
    const existingStyle = document.getElementById('dynamic-print-orientation-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-orientation-style';
    if (target === 'passbook' || target === 'ledger') {
      styleEl.innerHTML = `@page { size: A4 landscape !important; margin: 4mm !important; }`;
    } else {
      styleEl.innerHTML = `@page { size: A4 portrait !important; margin: 10mm !important; }`;
    }
    document.head.appendChild(styleEl);

    window.print();

    // Clean up after print dialog closes
    setTimeout(() => {
      document.body.classList.remove('print-mode-contract', 'print-mode-schedule', 'print-mode-ledger', 'print-mode-all', 'print-mode-passbook');
      const s = document.getElementById('dynamic-print-orientation-style');
      if (s) s.remove();
    }, 1000);
  };

  // Auto-Save Draft Tracking
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string>('');
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const [isDraftLoaded, setIsDraftLoaded] = useState<boolean>(false);

  // Dynamic PSGC locations state
  const [phProvinces, setPhProvinces] = useState<{ name: string; region: string }[]>([]);
  const [phCities, setPhCities] = useState<{ name: string; rawName: string; city: boolean }[]>([]);
  const [phBarangays, setPhBarangays] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // 1. Fetch all 85 provinces on initial mount
  useEffect(() => {
    fetch('/api/locations/ph?type=provinces')
      .then((res) => res.json())
      .then((data) => {
        if (data.provinces && Array.isArray(data.provinces)) {
          setPhProvinces(data.provinces);
        }
      })
      .catch((err) => console.error('Failed to load provinces:', err));
  }, []);

  // 2. Fetch cities whenever province changes
  useEffect(() => {
    if (!step2.province) return;
    setLoadingLocations(true);
    fetch(`/api/locations/ph?type=municipalities&province=${encodeURIComponent(step2.province)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.municipalities && Array.isArray(data.municipalities)) {
          setPhCities(data.municipalities);
          // If current city is not in list, keep it or default
        }
      })
      .catch((err) => console.error('Failed to load cities:', err))
      .finally(() => setLoadingLocations(false));
  }, [step2.province]);

  // 3. Fetch barangays whenever city or province changes
  useEffect(() => {
    if (!step2.city) return;
    fetch(`/api/locations/ph?type=barangays&municipality=${encodeURIComponent(step2.city)}&province=${encodeURIComponent(step2.province)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.barangays && Array.isArray(data.barangays)) {
          setPhBarangays(data.barangays);
        }
      })
      .catch((err) => console.error('Failed to load barangays:', err));
  }, [step2.city, step2.province]);

  // 4. Restore draft or load specific application on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id');

      const assessments = getCreditAssessments();

      // If a specific application or draft ID was passed in query parameter (from Review / Resume)
      if (targetId) {
        const matched = assessments.find(a => a.id === targetId || a.applicationId === targetId || a.policyNo === targetId);
        if (matched) {
          const p = matched.fullProfile || {};
          if (p.step1) {
            setStep1(p.step1);
          } else {
            setStep1(prev => ({
              ...prev,
              firstName: matched.borrowerName.split(' ')[0] || '',
              lastName: matched.borrowerName.split(' ').slice(1).join(' ') || '',
              cooperativeId: matched.cidNumber || matched.mcid || prev.cooperativeId,
              tgswsPolicyNumber: matched.policyNo || 'LCAP-',
            }));
          }
          if (p.step2) setStep2(p.step2);
          if (p.govIds) setGovIds(p.govIds);
          if (p.dependants) setDependants(p.dependants);
          if (p.step4) setStep4(p.step4);
          if (p.assets) setAssets(p.assets);
          if (p.otherIncomes) setOtherIncomes(p.otherIncomes);
          if (p.liabilities) setLiabilities(p.liabilities);
          if (p.step5) {
            setStep5(p.step5);
          } else {
            setStep5(prev => ({
              ...prev,
              requestedAmount: matched.requestedAmount || prev.requestedAmount,
              loanProduct: matched.productName || prev.loanProduct,
              termMonths: matched.termMonths || prev.termMonths,
              repaymentFrequency: matched.paymentMode || prev.repaymentFrequency,
            }));
          }
          if (p.attachments) setAttachments(p.attachments);
          if (matched.officerNotes) setOfficerAssessmentNotes(matched.officerNotes);
          setPrivacyConsentAffirmed(true);
          setApplicationId(matched.applicationId || matched.id);

          const stepToSet = matched.status === 'contract_ready' || matched.status === 'disbursed'
            ? 7
            : matched.status === 'admin_approved'
            ? 7
            : matched.status === 'pending_admin' || matched.status === 'admin_rejected'
            ? 6
            : 6;
          setCurrentStep(stepToSet as any);

          if (matched.status === 'contract_ready' || matched.status === 'disbursed') {
            setIsContractFinalized(true);
          }
          if (matched.status === 'admin_approved') {
            setAdminSimulationStatus('approved');
            setAdminApprovedAmount(matched.adminApprovedAmount || matched.officerAdjustedAmount || matched.requestedAmount);
            setOfficerAdjustedAmount(matched.adminApprovedAmount || matched.officerAdjustedAmount || matched.requestedAmount);
          } else if (matched.status === 'pending_admin') {
            setAdminSimulationStatus('pending');
            setIsSubmittedToAdmin(true);
          }

          if (matched.applicantSignature) setApplicantSignature(matched.applicantSignature);
          if (matched.borrowerSignatures) setBorrowerSignatures(matched.borrowerSignatures);
          if (matched.officerSignatures) setOfficerSignatures(matched.officerSignatures);
          if (matched.adminSignatures) setAdminSignatures(matched.adminSignatures);
          if (matched.adminActionAt) setAdminActionAt(matched.adminActionAt);
          if (matched.applicantFacePhoto) setApplicantFacePhoto(matched.applicantFacePhoto);
          if (matched.borrowerHoldingIdPhoto) setBorrowerHoldingIdPhoto(matched.borrowerHoldingIdPhoto);
          if (matched.disbursementMode) setDisbursementMode(matched.disbursementMode);
          if (matched.disbursementChannel) setDisbursementChannel(matched.disbursementChannel);
          if (matched.disbursementAccountNumber) setDisbursementAccountNumber(matched.disbursementAccountNumber);
          if (matched.contractTemplateSnapshot) {
            setContractTemplateSnapshot(matched.contractTemplateSnapshot as any);
          } else {
            setContractTemplateSnapshot(getActiveContractTemplate());
          }

          setHasRestoredDraft(true);
          setIsDraftLoaded(true);
          return;
        }
      }

      const saved = localStorage.getItem('tribute_new_borrower_draft');
      if (saved) {
        const d = JSON.parse(saved);

        // Check if this application has already been executed/disbursed in the assessment store
        const borrowerFullName = `${d.step1?.firstName || ''} ${d.step1?.middleName || ''} ${d.step1?.lastName || ''}`.trim();
        const matched = assessments.find(a => 
          (d.applicationId && (a.applicationId === d.applicationId || a.id === d.applicationId)) ||
          (d.step1?.tgswsPolicyNumber && d.step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === d.step1.tgswsPolicyNumber) ||
          (borrowerFullName && a.borrowerName.toLowerCase() === borrowerFullName.toLowerCase())
        );

        // If the draft was completed in Step 7 or is already in the current borrowers registry,
        // and no specific id parameter was requested, start fresh.
        if (!targetId && (d.isContractFinalized || (matched && (matched.status === 'contract_ready' || matched.status === 'disbursed')))) {
          localStorage.removeItem('tribute_new_borrower_draft');
          setStep1(prev => ({
            ...prev,
            cooperativeId: generateNextCooperativeId(),
          }));
          setIsDraftLoaded(true);
          return;
        }

        if (d.step1) {
          setStep1({
            ...d.step1,
            cooperativeId: d.step1.cooperativeId || generateNextCooperativeId(),
          });
        }
        if (d.step2) setStep2(d.step2);
        if (d.govIds && d.govIds.length > 0) setGovIds(d.govIds);
        if (d.dependants) setDependants(d.dependants);
        if (d.step4) setStep4(d.step4);
        if (d.assets) setAssets(d.assets);
        if (d.otherIncomes) setOtherIncomes(d.otherIncomes);
        if (d.liabilities) setLiabilities(d.liabilities);
        if (d.step5) setStep5(d.step5);
        if (d.attachments) setAttachments(d.attachments);
        if (d.officerAssessmentNotes) setOfficerAssessmentNotes(d.officerAssessmentNotes);
        if (d.privacyConsentAffirmed) setPrivacyConsentAffirmed(d.privacyConsentAffirmed);
        if (d.currentStep) setCurrentStep(d.currentStep);
        if (d.savedAt) setLastDraftSavedTime(d.savedAt);
        if (d.applicationId) setApplicationId(d.applicationId);
        if (d.aiResult) setAiResult(d.aiResult);
        if (d.officerAdjustedAmount) setOfficerAdjustedAmount(d.officerAdjustedAmount);
        if (d.officerAdjustmentNote) setOfficerAdjustmentNote(d.officerAdjustmentNote);
        if (d.adminSimulationStatus) setAdminSimulationStatus(d.adminSimulationStatus);
        if (d.adminApprovedAmount) setAdminApprovedAmount(d.adminApprovedAmount);
        if (d.adjustmentCount !== undefined) setAdjustmentCount(Number(d.adjustmentCount));
        if (d.isSubmittedToAdmin) setIsSubmittedToAdmin(d.isSubmittedToAdmin);
        if (d.isContractFinalized) setIsContractFinalized(true);
        if (d.applicantSignature) setApplicantSignature(d.applicantSignature);
        if (d.borrowerSignatures) setBorrowerSignatures(d.borrowerSignatures);
        if (d.officerSignatures) setOfficerSignatures(d.officerSignatures);
        if (d.adminSignatures) setAdminSignatures(d.adminSignatures);
        if (d.adminActionAt) setAdminActionAt(d.adminActionAt);
        if (d.applicantFacePhoto) setApplicantFacePhoto(d.applicantFacePhoto);
        if (d.borrowerHoldingIdPhoto) setBorrowerHoldingIdPhoto(d.borrowerHoldingIdPhoto);
        if (d.contractAgreed) setContractAgreed(d.contractAgreed);
        if (d.disbursementMode) setDisbursementMode(d.disbursementMode);
        if (d.disbursementChannel) setDisbursementChannel(d.disbursementChannel);
        if (d.disbursementAccountNumber) setDisbursementAccountNumber(d.disbursementAccountNumber);
        if (d.contractTemplateSnapshot) {
          setContractTemplateSnapshot(d.contractTemplateSnapshot);
        } else {
          setContractTemplateSnapshot(getActiveContractTemplate());
        }
        if (d.aoLocationConfirmed) {
          setAoLocationConfirmed(true);
          setAoLocationVerified(true);
        }
        if (d.aoLocationData) setAoLocationData(d.aoLocationData);

        setHasRestoredDraft(true);
      } else {
        // Ensure initial cooperativeId and loan reference are generated if fresh
        const initialCid = generateNextCooperativeId();
        const initialLoanRef = generateNextLoanReference();
        setStep1(prev => ({
          ...prev,
          cooperativeId: prev.cooperativeId || initialCid,
        }));
        setApplicationId(prev => prev || initialLoanRef);
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    } finally {
      setIsDraftLoaded(true);
    }
  }, []);

  // 5. Automatically save all form state whenever any field or AI/Admin review changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isDraftLoaded) return;
    const currentAppId = applicationId || `NBR-${Date.now().toString().slice(-6)}`;
    if (!applicationId) setApplicationId(currentAppId);

    const draftPayload = {
      currentStep,
      step1,
      step2,
      govIds,
      dependants,
      step4,
      assets,
      otherIncomes,
      liabilities,
      step5,
      attachments,
      officerAssessmentNotes,
      privacyConsentAffirmed,
      applicationId: currentAppId,
      aiResult,
      officerAdjustedAmount,
      officerAdjustmentNote,
      adminSimulationStatus,
      adminApprovedAmount,
      adjustmentCount,
      isSubmittedToAdmin,
      isContractFinalized,
      applicantSignature,
      borrowerSignatures,
      officerSignatures,
      adminSignatures,
      adminActionAt,
      applicantFacePhoto,
      borrowerHoldingIdPhoto,
      contractAgreed,
      disbursementMode,
      disbursementChannel,
      disbursementAccountNumber,
      contractTemplateSnapshot,
      aoLocationConfirmed,
      aoLocationData,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    try {
      localStorage.setItem('tribute_new_borrower_draft', JSON.stringify(draftPayload));
      setLastDraftSavedTime(draftPayload.savedAt);
    } catch (e) {
      // Storage quota or SSR guard
    }
  }, [
    isDraftLoaded,
    currentStep,
    step1,
    step2,
    govIds,
    dependants,
    step4,
    assets,
    otherIncomes,
    liabilities,
    step5,
    attachments,
    officerAssessmentNotes,
    privacyConsentAffirmed,
    applicationId,
    aiResult,
    officerAdjustedAmount,
    officerAdjustmentNote,
    adminSimulationStatus,
    adminApprovedAmount,
    adjustmentCount,
    isSubmittedToAdmin,
    isContractFinalized,
    applicantSignature,
    borrowerSignatures,
    officerSignatures,
    adminSignatures,
    adminActionAt,
    applicantFacePhoto,
    borrowerHoldingIdPhoto,
    contractAgreed,
    disbursementMode,
    disbursementChannel,
    disbursementAccountNumber,
    contractTemplateSnapshot,
    aoLocationConfirmed,
    aoLocationData
  ]);

  // Real-time detection effect: Triggers on exact memberNo, email, or compound phone+DOB
  useEffect(() => {
    if (detectedMemberDismissed || currentStep > 2) return;

    const email = step2.email?.trim();
    const phone = step2.mobileNumber?.trim();
    const dob = step1.dateOfBirth?.trim();
    const memberNo = step1.cooperativeId?.startsWith('TCID-M-') ? step1.cooperativeId.trim() : '';

    const hasExactEmail = Boolean(email && email.includes('@') && email.length >= 6);
    const hasCompound = Boolean(phone && phone.replace(/\D/g, '').length >= 10 && dob);
    const hasMemberNo = Boolean(memberNo);

    if (!hasExactEmail && !hasCompound && !hasMemberNo) {
      if (detectedMember) setDetectedMember(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsDetectingMember(true);
        const res = await fetch('/api/members/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberNo: hasMemberNo ? memberNo : undefined,
            email: hasExactEmail ? email : undefined,
            contactNumber: phone || undefined,
            dateOfBirth: dob || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.matched && data.member) {
            setDetectedMember(data.member);
          } else {
            setDetectedMember(null);
          }
        }
      } catch {
        // Silent failure in background detection
      } finally {
        setIsDetectingMember(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    step1.cooperativeId,
    step1.dateOfBirth,
    step2.email,
    step2.mobileNumber,
    detectedMemberDismissed,
    currentStep,
  ]);

  const handleApplyDetectedMember = (mem: any) => {
    // 1. Prefill Step 1
    const parts = (mem.fullName || '').split(' ');
    setStep1((prev) => ({
      ...prev,
      cooperativeId: mem.memberNo,
      firstName: mem.firstName || parts[0] || prev.firstName,
      middleName: mem.middleName || prev.middleName,
      lastName: mem.lastName || parts[parts.length - 1] || prev.lastName,
      suffix: mem.suffix || prev.suffix,
      dateOfBirth: mem.dateOfBirth || prev.dateOfBirth,
      civilStatus: mem.civilStatus || prev.civilStatus,
      sex: mem.gender === 'Female' ? 'Female' : 'Male',
      referral: prev.referral || 'Cooperative Member (Auto-detected)',
    }));

    // 2. Prefill Step 2
    setStep2((prev) => ({
      ...prev,
      email: mem.email || prev.email,
      mobileNumber: mem.contactNumber ? mem.contactNumber.replace(/^\+63|^0/, '') : prev.mobileNumber,
      addressLine1: mem.address || prev.addressLine1,
      city: mem.city || prev.city,
      province: mem.province || prev.province,
      barangay: mem.barangay || prev.barangay,
    }));

    // 3. Prefill Gov ID if provided
    if (mem.validIdType && mem.validIdNumber) {
      setGovIds([
        {
          idType: mem.validIdType,
          idNumber: mem.validIdNumber,
          expiryDate: '',
        },
      ]);
    }

    // 4. Prefill Step 4 occupation if available
    if (mem.occupation) {
      setStep4((prev) => ({
        ...prev,
        occupation: mem.occupation,
        monthlyNetIncome: mem.monthlyIncome || prev.monthlyNetIncome,
      }));
    }

    // 5. Automatically continue to Step 3 (Dependants), while allowing user to step back to review
    setDetectedMemberDismissed(true);
    setSuccessMsg(`✓ Matched & prefilled authoritative records for Member ${mem.memberNo}. Continued to Step 3: Dependants.`);
    setCurrentStep(3);
  };

  // 6. Real-Time Admin Approval Sync Listener & Poller
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAdminStatus = async () => {
      try {
        // First check directly if localStorage draft was updated by admin
        const draftRaw = localStorage.getItem('tribute_new_borrower_draft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          if (draft.adminSignatures && Array.isArray(draft.adminSignatures) && draft.adminSignatures.length > 0) {
            setAdminSignatures(draft.adminSignatures);
          }
          if (draft.adminActionAt) {
            setAdminActionAt(draft.adminActionAt);
          }
          if (draft.adminSimulationStatus === 'pending') {
            if (adminSimulationStatus !== 'pending') {
              setAdminSimulationStatus('pending');
              setIsSubmittedToAdmin(true);
            }
          } else if (draft.adminSimulationStatus === 'approved') {
            if (adminSimulationStatus !== 'approved') {
              setAdminSimulationStatus('approved');
              setSuccessMsg('🎉 Official Approval Received from Admin Credit Committee! Ready for Contract Execution.');
            }
            if (draft.adminApprovedAmount && Number(draft.adminApprovedAmount) !== adminApprovedAmount) {
              setAdminApprovedAmount(Number(draft.adminApprovedAmount));
              setOfficerAdjustedAmount(Number(draft.adminApprovedAmount));
            }
            if (draft.adminApprovedAmount) {
              return;
            }
          }
        }

        // Also check assessment store for this application or policy number
        let assessments = getCreditAssessments();

        // Also check server store
        try {
          const res = await fetch('/api/assessments');
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
              assessments = json.data;
            }
          }
        } catch (e) {}

        const borrowerFullName = `${step1.firstName || ''} ${step1.middleName || ''} ${step1.lastName || ''}`.trim();
        const matched = assessments.find(a => 
          (applicationId && (a.applicationId === applicationId || a.id === applicationId)) ||
          (step1.tgswsPolicyNumber && step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === step1.tgswsPolicyNumber) ||
          (borrowerFullName && a.borrowerName.toLowerCase() === borrowerFullName.toLowerCase())
        );

        if (matched) {
          if (matched.status === 'contract_ready' || matched.status === 'disbursed') {
            setIsContractFinalized(true);
            if (matched.applicantSignature) setApplicantSignature(matched.applicantSignature);
            if (matched.borrowerSignatures) setBorrowerSignatures(matched.borrowerSignatures);
            if (matched.officerSignatures) setOfficerSignatures(matched.officerSignatures);
            if (matched.adminSignatures) setAdminSignatures(matched.adminSignatures);
            if (matched.adminActionAt) setAdminActionAt(matched.adminActionAt);
            if (matched.applicantFacePhoto) setApplicantFacePhoto(matched.applicantFacePhoto);
            if (matched.borrowerHoldingIdPhoto) setBorrowerHoldingIdPhoto(matched.borrowerHoldingIdPhoto);
            if (matched.disbursementMode) setDisbursementMode(matched.disbursementMode);
            if (matched.disbursementChannel) setDisbursementChannel(matched.disbursementChannel);
            if (matched.disbursementAccountNumber) setDisbursementAccountNumber(matched.disbursementAccountNumber);
          } else if (matched.status === 'admin_approved') {
            if (matched.adminSignatures && Array.isArray(matched.adminSignatures) && matched.adminSignatures.length > 0) {
              setAdminSignatures(matched.adminSignatures);
            }
            if (matched.adminActionAt) {
              setAdminActionAt(matched.adminActionAt);
            }
            if (adminSimulationStatus !== 'approved') {
              setAdminSimulationStatus('approved');
              setSuccessMsg('🎉 Official Approval Received from Admin Credit Committee! Ready for Contract Execution.');
            }
            const approvedVal = Number(matched.adminApprovedAmount || matched.officerAdjustedAmount || matched.aiPreApprovedAmount || 10000);
            if (approvedVal !== adminApprovedAmount) {
              setAdminApprovedAmount(approvedVal);
              setOfficerAdjustedAmount(approvedVal);
            }
            if (matched.adjustmentCount !== undefined && matched.adjustmentCount !== adjustmentCount) {
              setAdjustmentCount(matched.adjustmentCount);
            }
          } else if (matched.status === 'pending_admin' && adminSimulationStatus !== 'pending') {
            setAdminSimulationStatus('pending');
            setIsSubmittedToAdmin(true);
            if (matched.adjustmentCount !== undefined && matched.adjustmentCount !== adjustmentCount) {
              setAdjustmentCount(matched.adjustmentCount);
            }
          } else if (matched.status === 'admin_rejected' && adminSimulationStatus !== 'rejected') {
            setAdminSimulationStatus('rejected');
            setErrorMsg('Application was declined by the Credit Committee.');
          }
        }
      } catch (e) {
        console.error('Error polling admin status:', e);
      }
    };

    // Listen to storage events across tabs
    window.addEventListener('storage', checkAdminStatus);
    // Also poll every 1.5 seconds for instant responsiveness
    const poller = setInterval(checkAdminStatus, 1500);

    return () => {
      window.removeEventListener('storage', checkAdminStatus);
      clearInterval(poller);
    };
  }, [applicationId, step1.tgswsPolicyNumber, step1.firstName, step1.lastName, adminSimulationStatus, adminApprovedAmount]);

  // Handler to clear draft and start fresh
  const handleClearDraft = () => {
    if (confirm('Are you sure you want to discard this saved draft and start a fresh application?')) {
      localStorage.removeItem('tribute_new_borrower_draft');
      window.location.reload();
    }
  };

  // ================= 1-MINUTE AI VERIFICATION COUNTDOWN =================
  useEffect(() => {
    let interval: any = null;
    if (isAiVerifying && aiTimerSeconds > 0) {
      interval = setInterval(() => {
        setAiTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (isAiVerifying && aiTimerSeconds === 0) {
      // 1 minute completed! Run AI evaluation
      const verification = runAiCreditVerification({
        monthlyNetIncome: Number(step4.monthlyNetIncome) || 20000,
        existingDebtDues: liabilities.reduce((sum, l) => sum + (Number(l.monthlyAmortization) || 0), 0),
        dependantsCount: dependants.length,
        yearsInLivelihood: Number(step4.yearsInLivelihood) || 3,
        assetsTotalValue: assets.reduce((sum, a) => sum + (Number(a.appraisedValue) || 0), 0),
        requestedAmount: Number(step5.requestedAmount) || 10000,
        productName: step5.loanProduct,
        isRenewal: false,
      });

      setAiResult(verification);
      setOfficerAdjustedAmount(verification.preApprovedAmount);
      setIsAiVerifying(false);

      // Instantly save to localStorage draft so a refresh immediately preserves AI evaluation
      try {
        const currentAppId = applicationId || `NBR-${Date.now().toString().slice(-6)}`;
        if (!applicationId) setApplicationId(currentAppId);

        const draftPayload = {
          currentStep: 6,
          step1,
          step2,
          govIds,
          dependants,
          step4,
          assets,
          otherIncomes,
          liabilities,
          step5,
          attachments,
          officerAssessmentNotes,
          privacyConsentAffirmed,
          applicationId: currentAppId,
          aiResult: verification,
          officerAdjustedAmount: verification.preApprovedAmount,
          officerAdjustmentNote,
          adminSimulationStatus,
          adminApprovedAmount,
          savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        localStorage.setItem('tribute_new_borrower_draft', JSON.stringify(draftPayload));
        setLastDraftSavedTime(draftPayload.savedAt);
      } catch (err) {
        console.error('Failed to save AI verification result:', err);
      }

      // Automatically sync into Credit Assessment store for Admin review
      syncToCreditAssessmentStore(verification);

      setSuccessMsg('AI Verification algorithm evaluation complete & auto-saved! Pre-approved amount generated and synchronized.');
    }
    return () => clearInterval(interval);
  }, [isAiVerifying, aiTimerSeconds, step4, liabilities, dependants, assets, step5, step1, step2, govIds, officerAssessmentNotes, privacyConsentAffirmed, applicationId, officerAdjustmentNote, adminSimulationStatus, adminApprovedAmount]);

  // Start 1-Minute AI verification
  const handleStartAiVerification = () => {
    if (!validateStep6()) return;
    setIsAiVerifying(true);
    setAiTimerSeconds(60); // 1-minute process
  };

  // Skip / Instant finish for testing purposes
  const handleFastTrackAiVerification = () => {
    setAiTimerSeconds(0);
  };

  // Step 1 Policy lock
  const handleTgswsChange = (val: string) => {
    if (!val.startsWith('LCAP-')) {
      setStep1({ ...step1, tgswsPolicyNumber: 'LCAP-' });
    } else {
      setStep1({ ...step1, tgswsPolicyNumber: val });
    }
  };

  // Step 2 Gov IDs
  const handleAddGovId = () => {
    if (govIds.length >= 20) return;
    setGovIds([...govIds, { idType: "Driver's License", idNumber: '', expiryDate: '' }]);
  };
  const handleRemoveGovId = (idx: number) => {
    if (govIds.length <= 1) return;
    setGovIds(govIds.filter((_, i) => i !== idx));
  };
  const handleUpdateGovId = (idx: number, field: keyof GovIdRecord, val: string) => {
    const updated = [...govIds];
    updated[idx] = { ...updated[idx], [field]: val };
    setGovIds(updated);
  };

  // Step 3 Dependants
  const handleAddDependant = () => {
    if (dependants.length >= 20) return;
    setDependants([...dependants, { lastName: '', firstName: '', middleName: '', relation: 'Child / Son / Daughter', dateOfBirth: '', isSchooling: false }]);
  };
  const handleRemoveDependant = (idx: number) => setDependants(dependants.filter((_, i) => i !== idx));
  const handleUpdateDependant = (idx: number, field: keyof DependantRecord, val: any) => {
    const updated = [...dependants];
    updated[idx] = { ...updated[idx], [field]: val };
    setDependants(updated);
  };

  // Step 4 Assets & Debts
  const handleAddAsset = () => {
    if (assets.length >= 100) return;
    setAssets([...assets, {
      category: 'Real Estate (House & Lot, Agricultural Land, Commercial)',
      subtype: '',
      nameTitle: '',
      titleNumber: '',
      titleHolderName: '',
      location: '',
      totalLotArea: '',
      floorArea: '',
      jurisdiction: '',
      appraisedValue: 0,
      valuationDate: ''
    }]);
  };
  const handleRemoveAsset = (idx: number) => setAssets(assets.filter((_, i) => i !== idx));
  const handleUpdateAsset = (idx: number, field: keyof AssetRecord, val: any) => {
    const updated = [...assets];
    updated[idx] = { ...updated[idx], [field]: val };
    setAssets(updated);
  };

  const handleAddOtherIncome = () => {
    if (otherIncomes.length >= 100) return;
    setOtherIncomes([...otherIncomes, { source: 'Remittances (from OFW family members)', description: '', monthlyAmount: 0 }]);
  };
  const handleRemoveOtherIncome = (idx: number) => setOtherIncomes(otherIncomes.filter((_, i) => i !== idx));
  const handleUpdateOtherIncome = (idx: number, field: keyof OtherIncomeRecord, val: any) => {
    const updated = [...otherIncomes];
    updated[idx] = { ...updated[idx], [field]: val };
    setOtherIncomes(updated);
  };

  const handleAddLiability = () => {
    if (liabilities.length >= 100) return;
    setLiabilities([...liabilities, { creditorName: '', liabilityType: 'Microfinance / MFI Loan (Card Bank, ASA, Taytay Sa Kauswagan, etc.)', totalOutstanding: 0, monthlyAmortization: 0 }]);
  };
  const handleRemoveLiability = (idx: number) => setLiabilities(liabilities.filter((_, i) => i !== idx));
  const handleUpdateLiability = (idx: number, field: keyof LiabilityRecord, val: any) => {
    const updated = [...liabilities];
    updated[idx] = { ...updated[idx], [field]: val };
    setLiabilities(updated);
  };

  // Step 6 Attachments
  const handleAddAttachment = () => {
    if (attachments.length >= 20) return;
    setAttachments([...attachments, { documentType: 'Certificate of Employment / Payslip', fileName: '', description: '' }]);
  };
  const handleRemoveAttachment = (idx: number) => {
    if (attachments.length <= 1) return;
    setAttachments(attachments.filter((_, i) => i !== idx));
  };
  const handleUpdateAttachment = (idx: number, field: keyof AttachmentRecord, val: string) => {
    const updated = [...attachments];
    updated[idx] = { ...updated[idx], [field]: val };
    setAttachments(updated);
  };

  // Financial Totals
  const totals = useMemo(() => {
    const totalAssetsValue = assets.reduce((sum, a) => sum + (Number(a.appraisedValue) || 0), 0);
    const primaryIncome = Number(step4.monthlyNetIncome) || 0;
    const totalOtherIncome = otherIncomes.reduce((sum, o) => sum + (Number(o.monthlyAmount) || 0), 0);
    const totalMonthlyIncome = primaryIncome + totalOtherIncome;
    const totalOutstandingDebt = liabilities.reduce((sum, l) => sum + (Number(l.totalOutstanding) || 0), 0);
    const totalMonthlyDebtDues = liabilities.reduce((sum, l) => sum + (Number(l.monthlyAmortization) || 0), 0);
    const netDisposableMonthlyIncome = totalMonthlyIncome - totalMonthlyDebtDues;

    return {
      totalAssetsValue,
      primaryIncome,
      totalOtherIncome,
      totalMonthlyIncome,
      totalOutstandingDebt,
      totalMonthlyDebtDues,
      netDisposableMonthlyIncome,
    };
  }, [assets, step4.monthlyNetIncome, otherIncomes, liabilities]);

  // Synchronize onboarding application into Credit Assessment desk
  const syncToCreditAssessmentStore = (verificationResult?: AiVerificationResult) => {
    try {
      const borrowerFullName = `${step1.firstName || ''} ${step1.middleName || ''} ${step1.lastName || ''}`.trim() || 'Applicant';
      const aiPreApprove = verificationResult?.preApprovedAmount || aiResult?.preApprovedAmount || step5.requestedAmount;
      const aiRating = verificationResult?.riskRating || aiResult?.riskRating || 'Class A (Low Risk)';
      const aiDsrVal = verificationResult?.debtServiceRatio || aiResult?.debtServiceRatio || 30;

      const currentAppId = applicationId || `NBR-${Date.now().toString().slice(-6)}`;
      if (!applicationId) setApplicationId(currentAppId);

      // Check if this application has already been approved by Admin
      const existingAssessments = getCreditAssessments();
      const existingMatched = existingAssessments.find(a =>
        a.id === `CA-${currentAppId.replace('NBR-', '')}` ||
        a.applicationId === currentAppId ||
        (step1.tgswsPolicyNumber && step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === step1.tgswsPolicyNumber) ||
        (borrowerFullName && a.borrowerName.toLowerCase() === borrowerFullName.toLowerCase())
      );

      const effectiveStatus = (existingMatched && (existingMatched.status === 'admin_approved' || existingMatched.status === 'contract_ready' || existingMatched.status === 'disbursed'))
        ? existingMatched.status
        : (adminSimulationStatus === 'approved' ? 'admin_approved' : adminSimulationStatus === 'rejected' ? 'admin_rejected' : (existingMatched?.status === 'pending_admin' || isSubmittedToAdmin ? 'pending_admin' : 'pending_assessment'));

      const effectiveApprovedAmount = existingMatched?.adminApprovedAmount || adminApprovedAmount || undefined;

      const assessmentData = {
        id: `CA-${currentAppId.replace('NBR-', '')}`,
        applicationId: currentAppId,
        borrowerName: borrowerFullName,
        policyNo: step1.tgswsPolicyNumber || 'LCAP-',
        contactNumber: `${step2.countryCode || '+63'} ${step2.mobileNumber || ''}`,
        location: `${step2.barangay || ''}, ${step2.city || ''}, ${step2.province || ''}`,
        livelihood: step4.occupation || 'Self-Employed Micro-Enterprise',
        yearsInBusiness: Number(step4.yearsInLivelihood) || 3,
        monthlyNetIncome: Number(step4.monthlyNetIncome) || 20000,
        existingDebts: totals.totalMonthlyDebtDues || 0,
        netDisposableIncome: totals.netDisposableMonthlyIncome || 15000,
        requestedAmount: Number(step5.requestedAmount) || 10000,
        productName: step5.loanProduct || 'Regular Loan',
        termMonths: Number(step5.termMonths) || 3,
        paymentMode: step5.repaymentFrequency,
        aiPreApprovedAmount: aiPreApprove,
        aiRiskRating: aiRating,
        aiDsr: aiDsrVal,
        aiConfidenceScore: 94.2,
        aiRecommendationNote: verificationResult?.recommendationNote || 'Evaluated during intake interview.',
        fiveCs: {
          characterScore: 18,
          characterNotes: `Barangay residency verified. Policy no: ${step1.tgswsPolicyNumber}`,
          capacityScore: 21,
          capacityNotes: `DSR at ${aiDsrVal}%. Net disposable is ₱${totals.netDisposableMonthlyIncome.toLocaleString('en-PH')}`,
          capitalScore: 16,
          capitalNotes: `Declared assets value: ₱${totals.totalAssetsValue.toLocaleString('en-PH')}`,
          collateralScore: 14,
          collateralNotes: assets.length > 0 ? `${assets.length} collateral item(s) declared` : 'Personal guarantee / co-maker',
          conditionsScore: 13,
          conditionsNotes: `Operating in ${step2.city || 'Metro Manila'}`,
          totalScore: 82,
          riskGrade: calculate5CsGrade(82),
        },
        officerAdjustedAmount: officerAdjustedAmount || aiPreApprove,
        officerRecommendation: 'recommend_approve' as const,
        officerNotes: officerAdjustmentNote || officerAssessmentNotes || 'Verified during live applicant intake interview.',
        evaluatedByOfficer: 'Officer Juan (AO-001)',
        evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: effectiveStatus as any,
        adminApprovedAmount: effectiveApprovedAmount,
        adjustmentCount: adjustmentCount,
        maxAdjustmentsReached: adjustmentCount >= 3,
        mcid: step1.cooperativeId || 'TCID-A-00001',
        cidNumber: step1.cooperativeId || 'TCID-A-00001',
        fullProfile: {
          step1,
          step2,
          govIds,
          dependants,
          step4,
          assets,
          otherIncomes,
          liabilities,
          step5,
          attachments,
        },
      };

      saveCreditAssessment(assessmentData);
      
      // Also post immediately to server API
      try {
        fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assessmentData),
        }).catch(() => {});
      } catch (e) {}

      // Broadcast storage event
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
  };

  // Handler to navigate to Credit Assessments workbench
  const handleContinueToCreditAssessment = () => {
    const currentAppId = applicationId || `NBR-${Date.now().toString().slice(-6)}`;
    const assessId = `CA-${currentAppId.replace('NBR-', '')}`;
    syncToCreditAssessmentStore();
    router.push(`/officer/credit-assessments?assessId=${encodeURIComponent(assessId)}`);
  };

  // Sync automatically when reaching or viewing Step 6 if not yet submitted
  useEffect(() => {
    if (currentStep >= 6 && isDraftLoaded && !isSubmittedToAdmin) {
      syncToCreditAssessmentStore();
    }
  }, [currentStep, isDraftLoaded, isSubmittedToAdmin, officerAdjustedAmount]);

  // Current Working Loan Amount for calculation (Officer Adjusted or Admin Approved)
  const activePrincipalAmount = useMemo(() => {
    if (adminApprovedAmount > 0) return adminApprovedAmount;
    if (officerAdjustedAmount > 0) return officerAdjustedAmount;
    return Number(step5.requestedAmount) || 10000;
  }, [adminApprovedAmount, officerAdjustedAmount, step5.requestedAmount]);

  // Confirmed Tribute Grace Business Plan Calculation (5.3 & 5.4)
  const tributeCalculations = useMemo<CalculationResult>(() => {
    return calculateTributeLoan(
      activePrincipalAmount,
      Number(step5.termMonths) || 3,
      step5.loanProduct,
      step5.repaymentFrequency,
      false // first loan
    );
  }, [activePrincipalAmount, step5.termMonths, step5.loanProduct, step5.repaymentFrequency]);

  // Account Officer Geolocation Request Handler
  const handleRequestAoLocation = () => {
    setIsRequestingLocation(true);
    setLocationError('');

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser/device.');
      setIsRequestingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

        setAoLocationData({
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          accuracy: Math.round(accuracy),
          timestamp: `${dateStr} ${timeStr}`,
          addressLabel: 'Field Intake Coordinate'
        });
        setAoLocationVerified(true);
        setIsRequestingLocation(false);
      },
      (err) => {
        setIsRequestingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access was denied. You must allow location permission to verify onboarding site integrity.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('GPS signal unavailable. Please ensure location services are enabled on your device.');
        } else if (err.code === err.TIMEOUT) {
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationError('Failed to capture location: ' + err.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleConfirmAoLocation = () => {
    if (!aoLocationData) {
      setLocationError('Please allow and capture your GPS location first.');
      return;
    }
    setAoLocationConfirmed(true);
    setSuccessMsg('✓ Account Officer field location confirmed and stamped! Proceeding to Step 1.');
  };

  // Validations
  const validateStep1 = () => {
    if (!aoLocationConfirmed) {
      setErrorMsg('Account Officer must allow and confirm GPS location before proceeding.');
      return false;
    }
    if (!step1.lastName.trim() || !step1.firstName.trim() || !step1.middleName.trim()) {
      setErrorMsg('Please complete Last Name, First Name, and Middle Name in Step 1.');
      return false;
    }
    if (!step1.dateOfBirth) {
      setErrorMsg('Date of birth is required in Step 1.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep2 = () => {
    if (!step2.mobileNumber || !step2.email || !step2.addressLine1 || !step2.yearsOfResidence) {
      setErrorMsg('Please complete all required contact and residential fields in Step 2.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep3 = () => {
    for (let i = 0; i < dependants.length; i++) {
      const d = dependants[i];
      if (!d.lastName.trim() || !d.firstName.trim() || !d.dateOfBirth) {
        setErrorMsg(`Please complete details for Dependant #${i + 1}.`);
        return false;
      }
    }
    setErrorMsg('');
    return true;
  };

  const validateStep4 = () => {
    if (!step4.employerEnterpriseName.trim() || !step4.yearsInLivelihood || !step4.monthlyNetIncome) {
      setErrorMsg('Please complete employment and income fields in Step 4.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep5 = () => {
    if (!step5.requestedAmount || step5.requestedAmount <= 0) {
      setErrorMsg('Please specify a valid principal amount.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep6 = () => {
    if (attachments.length < 1) {
      setErrorMsg('Please attach at least 1 supporting document.');
      return false;
    }
    if (!officerAssessmentNotes.trim()) {
      setErrorMsg('Account Officer Field Assessment Notes are required.');
      return false;
    }
    if (!privacyConsentAffirmed) {
      setErrorMsg('Borrower Privacy Consent Declaration must be affirmed.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep7 = () => {
    if (!applicantSignature || borrowerSignatures.length < 3) {
      setErrorMsg('All 3 borrower specimen signatures must be affixed on the tablet (one signature at a time with unique Auth IDs).');
      return false;
    }
    if (!applicantFacePhoto) {
      setErrorMsg('Applicant live biometric face picture is required.');
      return false;
    }
    if (!borrowerHoldingIdPhoto) {
      setErrorMsg('Borrower photo holding government ID is required.');
      return false;
    }
    if (officerSignatures.length < 3) {
      setErrorMsg('Account Officer must digitally sign all 3 verification slots (with unique Auth IDs and timestamps).');
      return false;
    }
    if (!contractAgreed) {
      setErrorMsg('You must check the agreement to the contract terms and privacy notice.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const selectedProvinceCities = PH_LOCATIONS[step2.province]?.cities || [];
  const selectedCityData = selectedProvinceCities.find((c) => c.name === step2.city);
  const barangays = selectedCityData?.barangays || [];

  const officialAo = getLatestOfficialSignature(
    officerSignatures,
    'OFFICER JUAN DE LA CRUZ',
    'Account Officer (AO-001)'
  );
  const officialAdmin = getLatestOfficialSignature(
    adminSignatures,
    'Branch General Manager / Credit Approver',
    'Branch General Manager',
    adminActionAt
  );

  return (
    <div className={`${theme.theme} ${theme.pageShell}`}>
      <OfficerSidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <main className={`officer-main-content ${theme.main} ${styles.onboardingMain}`}>
        <AppHeader
          panelType="officer"
          userName="Officer Juan"
          badgeLabel="Onboarding Desk"
          pageTitle="New Borrower Onboarding"
          pageSubtitle="Live demographic, livelihood, asset & credit profiling wizard (Form Ref: NBR-2026)."
          onOpenMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
          actions={
            <div className={styles.headerActions}>
              <span className={styles.autoSavedBadge}>
                <Check size={12} /> Auto-Saved ({lastDraftSavedTime || 'Just now'})
              </span>
              <button
                type="button"
                onClick={handleClearDraft}
                className={styles.newApplicationBtn}
                title="Clear current draft and start a brand new application"
              >
                <Plus size={14} color="#b91c1c" />
                <span>New Application</span>
              </button>
            </div>
          }
        />

        {/* Progress Stepper Tabs (Steps 1 to 7) */}
        <div className={`stepper-container ${styles.stepperShell}`}>
          <div className={styles.mobileProgressHeader}>
            <div className={styles.mobileProgressTopRow}>
              <p className={styles.mobileStepTitle}>
                {[
                  { step: 1, title: '1. Personal' },
                  { step: 2, title: '2. Contact' },
                  { step: 3, title: '3. Dependants' },
                  { step: 4, title: '4. Livelihood' },
                  { step: 5, title: '5. Loan Terms' },
                  { step: 6, title: '6. Review' },
                  { step: 7, title: '7. Contract' },
                ].find((s) => s.step === currentStep)?.title}
              </p>
              <span className={styles.mobileStepBadge}>Step {currentStep} of 7</span>
            </div>
            <div className={styles.mobileProgressTrack}>
              <div
                className={styles.mobileProgressFill}
                style={{ width: `${(currentStep / 7) * 100}%` }}
              />
            </div>
          </div>

          <div className={styles.stepperGrid}>
            {[
              { step: 1, title: '1. Personal' },
              { step: 2, title: '2. Contact' },
              { step: 3, title: '3. Dependants' },
              { step: 4, title: '4. Livelihood' },
              { step: 5, title: '5. Loan Terms' },
              { step: 6, title: '6. Review' },
              { step: 7, title: '7. Contract' },
            ].map((item) => {
              const isActive = currentStep === item.step;
              const isCompleted = currentStep > item.step;
              return (
                <div
                  key={item.step}
                  className={`stepper-tab ${styles.stepTab} ${isActive ? styles.stepTabActive : isCompleted ? styles.stepTabCompleted : ''}`}
                  onClick={() => {
                    if (item.step === 1) setCurrentStep(1);
                    if (item.step === 2 && validateStep1()) setCurrentStep(2);
                    if (item.step === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                    if (item.step === 4 && validateStep1() && validateStep2() && validateStep3()) setCurrentStep(4);
                    if (item.step === 5 && validateStep1() && validateStep2() && validateStep3() && validateStep4()) setCurrentStep(5);
                    if (item.step === 6 && validateStep1() && validateStep2() && validateStep3() && validateStep4() && validateStep5()) setCurrentStep(6);
                    if (item.step === 7 && validateStep6()) setCurrentStep(7);
                  }}
                >
                  <div className={`${styles.stepNumberBadge} ${isActive ? styles.stepNumberBadgeActive : isCompleted ? styles.stepNumberBadgeCompleted : ''}`}>
                    {isCompleted ? <Check size={14} /> : item.step}
                  </div>
                  <div className={styles.stepTitleWrap}>
                    <p className={`${styles.stepTitleText} ${isActive ? styles.stepTitleTextActive : ''}`}>
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback messages */}
        {errorMsg && (
          <div className={`no-print ${styles.alertError}`}>
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className={`no-print ${styles.alertSuccess}`}>
            <CheckCircle size={20} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================= STEP 1: PERSONAL INFORMATION ================= */}
        {currentStep === 1 && (
          <div className="officer-card" style={cardStyle}>
            {/* Account Officer Location Permission & Confirmation Gate */}
            <div style={{
              backgroundColor: aoLocationConfirmed ? '#f0fdf4' : '#eff6ff',
              border: aoLocationConfirmed ? '1.5px solid #86efac' : '1.5px solid #93c5fd',
              borderRadius: '14px',
              padding: '18px 22px',
              marginBottom: '26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    backgroundColor: aoLocationConfirmed ? '#16a34a' : '#0284c7',
                    color: '#ffffff',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Account Officer Field Geolocation Verification <span style={{ color: '#ef4444' }}>*</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: '#475569', margin: '2px 0 0 0' }}>
                      To prevent ghost applicants, Account Officer must allow device GPS location and confirm field presence before proceeding.
                    </p>
                  </div>
                </div>

                <div>
                  {aoLocationConfirmed ? (
                    <span style={{
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <CheckCircle size={14} /> Location Verified & Confirmed
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      padding: '5px 12px',
                      borderRadius: '8px'
                    }}>
                      Mandatory Before Step 1
                    </span>
                  )}
                </div>
              </div>

              {locationError && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{locationError}</span>
                </div>
              )}

              {/* Location Status Details Box */}
              {aoLocationData ? (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', flex: 1 }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>GPS Coordinates</span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontFamily: 'monospace', fontWeight: '800', color: '#0f172a' }}>
                        {aoLocationData.latitude.toFixed(6)}, {aoLocationData.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>GPS Accuracy</span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
                        ±{aoLocationData.accuracy} meters
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Capture Timestamp</span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#334155', fontWeight: '600' }}>
                        {aoLocationData.timestamp}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!aoLocationConfirmed && (
                      <button
                        type="button"
                        onClick={handleConfirmAoLocation}
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '9px 18px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                        }}
                      >
                        <Check size={15} /> Confirm & Unlock Step 1
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRequestAoLocation}
                      disabled={isRequestingLocation}
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {isRequestingLocation ? 'Updating...' : 'Re-fetch GPS'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    Click below to allow browser location access and record coordinates of this onboarding session.
                  </p>
                  <button
                    type="button"
                    onClick={handleRequestAoLocation}
                    disabled={isRequestingLocation}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    {isRequestingLocation ? (
                      <>Fetching GPS Coordinates...</>
                    ) : (
                      <>
                        <Building size={16} /> Allow Location & Detect GPS
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Member Detection Card */}
            {detectedMember && !detectedMemberDismissed && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {detectedMember.photoUrl ? (
                    <img
                      src={detectedMember.photoUrl}
                      alt={detectedMember.fullName}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800'
                    }}>
                      {detectedMember.firstName?.charAt(0)}{detectedMember.lastName?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#166534' }}>
                        Existing Cooperative Member Detected
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        textTransform: 'uppercase'
                      }}>
                        {detectedMember.membershipType === 'borrower_only' ? 'Borrower-Only' : 'Full Member'}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>
                      <strong>{detectedMember.fullName}</strong> • MCID: <span style={{ fontFamily: 'monospace' }}>{detectedMember.memberNo}</span> • {detectedMember.email}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setDetectedMemberDismissed(true)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#64748b',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDetectedMember(detectedMember)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#ffffff',
                      backgroundColor: '#15803d',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>Prefill & Continue to Dependants</span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                <User size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 1: Personal Information</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Enter official identity information as written on government IDs.</p>
              </div>
            </div>

            <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" required placeholder="e.g. Dela Cruz" value={step1.lastName} onChange={(e) => setStep1({ ...step1, lastName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" required placeholder="e.g. Juan" value={step1.firstName} onChange={(e) => setStep1({ ...step1, firstName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Middle Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" required placeholder="e.g. Santos" value={step1.middleName} onChange={(e) => setStep1({ ...step1, middleName: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Suffix</label>
                <select value={step1.suffix} onChange={(e) => setStep1({ ...step1, suffix: e.target.value })} style={inputStyle}>
                  <option value="">None (N/A)</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="date" required value={step1.dateOfBirth} onChange={(e) => setStep1({ ...step1, dateOfBirth: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Civil Status <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={step1.civilStatus} onChange={(e) => setStep1({ ...step1, civilStatus: e.target.value })} style={inputStyle}>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sex <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={step1.sex} onChange={(e) => setStep1({ ...step1, sex: e.target.value })} style={inputStyle}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nationality <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={step1.nationality} onChange={(e) => setStep1({ ...step1, nationality: e.target.value })} style={inputStyle}>
                  <option value="Filipino">Filipino</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Cooperative ID (CID / MCID) <span style={{ color: '#047857', fontWeight: '800' }}>(Auto-Generated)</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={step1.cooperativeId}
                    onChange={(e) => setStep1({ ...step1, cooperativeId: e.target.value })}
                    placeholder="TCID-A-00001"
                    style={{
                      ...inputStyle,
                      fontFamily: 'monospace',
                      fontWeight: '800',
                      color: '#047857',
                      backgroundColor: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      letterSpacing: '0.5px'
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    color: '#047857',
                    backgroundColor: '#dcfce7',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}>
                    Auto-Incremental
                  </span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>TGSWS Policy Number <span style={{ color: '#0284c7' }}>(Prefix: LCAP-)</span></label>
                <input type="text" value={step1.tgswsPolicyNumber} onChange={(e) => handleTgswsChange(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={labelStyle}>Referral / Recommending Member</label>
                <input type="text" placeholder="e.g. Member Name or Referral Code" value={step1.referral} onChange={(e) => setStep1({ ...step1, referral: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { if (validateStep1()) setCurrentStep(2); }}
                style={primaryBtnStyle}
              >
                Proceed to Step 2: Contact Information <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: CONTACT & GOV IDS ================= */}
        {currentStep === 2 && (
          <div className="officer-card" style={cardStyle}>
            {/* Real-time Member Detection Card (Step 2) */}
            {detectedMember && !detectedMemberDismissed && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {detectedMember.photoUrl ? (
                    <img
                      src={detectedMember.photoUrl}
                      alt={detectedMember.fullName}
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800'
                    }}>
                      {detectedMember.firstName?.charAt(0)}{detectedMember.lastName?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#166534' }}>
                        Existing Cooperative Member Detected
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        textTransform: 'uppercase'
                      }}>
                        {detectedMember.membershipType === 'borrower_only' ? 'Borrower-Only' : 'Full Member'}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#334155' }}>
                      <strong>{detectedMember.fullName}</strong> • MCID: <span style={{ fontFamily: 'monospace' }}>{detectedMember.memberNo}</span> • {detectedMember.email}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setDetectedMemberDismissed(true)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#64748b',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDetectedMember(detectedMember)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#ffffff',
                      backgroundColor: '#15803d',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>Prefill & Continue to Dependants</span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                <Phone size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 2: Contact & Government IDs</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Permanent residence address, communications, and verified government IDs.</p>
              </div>
            </div>

            <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div>
                <label style={labelStyle}>Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={step2.countryCode} onChange={(e) => setStep2({ ...step2, countryCode: e.target.value })} style={{ ...inputStyle, width: '130px', flexShrink: 0 }}>
                    {COUNTRY_CODES.map((c, idx) => (
                      <option key={idx} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input type="tel" required placeholder="917 123 4567" value={step2.mobileNumber} onChange={(e) => setStep2({ ...step2, mobileNumber: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" required placeholder="borrower@example.com" value={step2.email} onChange={(e) => setStep2({ ...step2, email: e.target.value })} style={inputStyle} />
              </div>
              <div className="col-span-2-responsive" style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Address Line 1 <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" required placeholder="Unit No., Building, Street Name" value={step2.addressLine1} onChange={(e) => setStep2({ ...step2, addressLine1: e.target.value })} style={inputStyle} />
              </div>
              <div className="col-span-2-responsive" style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Address Line 2</label>
                <input type="text" placeholder="Subdivision, Landmark, Compound" value={step2.addressLine2} onChange={(e) => setStep2({ ...step2, addressLine2: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Province <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step2.province}
                  onChange={(e) => {
                    const newProv = e.target.value;
                    setStep2({ ...step2, province: newProv, city: '', barangay: '' });
                  }}
                  style={inputStyle}
                >
                  {phProvinces.length > 0 ? (
                    phProvinces.map((prov) => (
                      <option key={prov.name} value={prov.name}>
                        {prov.name} ({prov.region})
                      </option>
                    ))
                  ) : (
                    Object.keys(PH_LOCATIONS).map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label style={labelStyle}>City / Municipality <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step2.city}
                  onChange={(e) => {
                    const newCity = e.target.value;
                    setStep2({ ...step2, city: newCity, barangay: '' });
                  }}
                  style={inputStyle}
                >
                  <option value="">{loadingLocations ? 'Loading municipalities...' : '-- Select City / Municipality --'}</option>
                  {phCities.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                  {phCities.length === 0 && selectedProvinceCities.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Barangay <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step2.barangay}
                  onChange={(e) => setStep2({ ...step2, barangay: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">-- Select Barangay ({phBarangays.length || barangays.length} available) --</option>
                  {phBarangays.length > 0 ? (
                    phBarangays.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))
                  ) : (
                    barangays.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Postal Code</label>
                <input type="text" placeholder="e.g. 1126" value={step2.postalCode} onChange={(e) => setStep2({ ...step2, postalCode: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Residence Ownership <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={step2.residenceOwnership} onChange={(e) => setStep2({ ...step2, residenceOwnership: e.target.value })} style={inputStyle}>
                  <option value="Owned">Owned</option>
                  <option value="Rented">Rented</option>
                  <option value="Living with Parents/Family">Living with Parents/Family</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Years of Residence <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" min="0" placeholder="e.g. 5" value={step2.yearsOfResidence} onChange={(e) => setStep2({ ...step2, yearsOfResidence: e.target.value })} style={inputStyle} />
              </div>
            </div>

            {/* Gov IDs List with Front and Back Photos */}
            <div style={{ padding: '24px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1.5px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Government Identification Records</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Provide valid government IDs with front and back photo captures.</p>
                </div>
                <button type="button" onClick={handleAddGovId} disabled={govIds.length >= 20} style={secondaryBtnStyle}>
                  <Plus size={15} /> Add ID Record ({govIds.length}/20)
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {govIds.map((item, index) => (
                  <div key={index} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '18px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0284c7' }}>ID Record #{index + 1}</span>
                      <button type="button" onClick={() => handleRemoveGovId(index)} style={deleteBtnStyle} title="Remove this ID record">
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>

                    <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={smallLabelStyle}>ID Agency / Type <span style={{ color: '#ef4444' }}>*</span></label>
                        <select value={item.idType} onChange={(e) => handleUpdateGovId(index, 'idType', e.target.value)} style={inputSmallStyle}>
                          {GOV_ID_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={smallLabelStyle}>ID Number <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" required placeholder="e.g. 1234-5678-9012" value={item.idNumber} onChange={(e) => handleUpdateGovId(index, 'idNumber', e.target.value)} style={inputSmallStyle} />
                      </div>
                      <div>
                        <label style={smallLabelStyle}>Expiry Date</label>
                        <input type="date" value={item.expiryDate} onChange={(e) => handleUpdateGovId(index, 'expiryDate', e.target.value)} style={inputSmallStyle} />
                      </div>
                    </div>

                    {/* ID Photo Front & Back */}
                    <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', paddingTop: '6px' }}>
                      {/* Front Photo */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: item.photoFrontBase64 ? '1.5px solid #86efac' : '1px dashed #cbd5e1',
                        backgroundColor: item.photoFrontBase64 ? '#f0fdf4' : '#fafafa'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Camera size={14} color="#0284c7" /> ID Front Photo
                          </span>
                          {item.photoFrontName && (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>✓ Attached</span>
                          )}
                        </div>

                        {item.photoFrontBase64 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={item.photoFrontBase64} alt="ID Front Preview" style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '11.5px', fontWeight: '600', color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.photoFrontName || 'id_front.jpg'}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...govIds];
                                  updated[index].photoFrontBase64 = undefined;
                                  updated[index].photoFrontName = undefined;
                                  setGovIds(updated);
                                }}
                                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                Remove Front Photo
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <label style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#475569',
                              cursor: 'pointer'
                            }}>
                              <Upload size={13} /> Upload File
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const updated = [...govIds];
                                      updated[index].photoFrontName = file.name;
                                      updated[index].photoFrontBase64 = event.target?.result as string;
                                      setGovIds(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            <label style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 10px',
                              backgroundColor: '#0284c7',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}>
                              <Camera size={13} /> Take Photo
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const updated = [...govIds];
                                      updated[index].photoFrontName = `id_front_cam_${Date.now()}.jpg`;
                                      updated[index].photoFrontBase64 = event.target?.result as string;
                                      setGovIds(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Back Photo */}
                      <div style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: item.photoBackBase64 ? '1.5px solid #86efac' : '1px dashed #cbd5e1',
                        backgroundColor: item.photoBackBase64 ? '#f0fdf4' : '#fafafa'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Camera size={14} color="#0284c7" /> ID Back Photo
                          </span>
                          {item.photoBackName && (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600' }}>✓ Attached</span>
                          )}
                        </div>

                        {item.photoBackBase64 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={item.photoBackBase64} alt="ID Back Preview" style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '11.5px', fontWeight: '600', color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.photoBackName || 'id_back.jpg'}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...govIds];
                                  updated[index].photoBackBase64 = undefined;
                                  updated[index].photoBackName = undefined;
                                  setGovIds(updated);
                                }}
                                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                Remove Back Photo
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <label style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#475569',
                              cursor: 'pointer'
                            }}>
                              <Upload size={13} /> Upload File
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const updated = [...govIds];
                                      updated[index].photoBackName = file.name;
                                      updated[index].photoBackBase64 = event.target?.result as string;
                                      setGovIds(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            <label style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '7px 10px',
                              backgroundColor: '#0284c7',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#ffffff',
                              cursor: 'pointer'
                            }}>
                              <Camera size={13} /> Take Photo
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const updated = [...govIds];
                                      updated[index].photoBackName = `id_back_cam_${Date.now()}.jpg`;
                                      updated[index].photoBackBase64 = event.target?.result as string;
                                      setGovIds(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setCurrentStep(1)} style={backBtnStyle}>
                <ChevronLeft size={18} /> Back to Step 1
              </button>
              <button type="button" onClick={() => { if (validateStep2()) setCurrentStep(3); }} style={primaryBtnStyle}>
                Proceed to Step 3: Dependants <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: DEPENDANTS ================= */}
        {currentStep === 3 && (
          <div className="officer-card" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                  <Users size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 3: Household Dependants</h2>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Add or remove household dependants (min 0, max 20).</p>
                </div>
              </div>
              <button type="button" onClick={handleAddDependant} disabled={dependants.length >= 20} style={secondaryBtnStyle}>
                <Plus size={16} /> Add Dependant ({dependants.length}/20)
              </button>
            </div>

            {dependants.length === 0 ? (
              <div style={emptyBoxStyle}>No dependants declared. You can proceed directly to Step 4.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {dependants.map((dep, index) => (
                  <div key={index} style={formRepeaterCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7' }}>Dependant #{index + 1}</span>
                      <button type="button" onClick={() => handleRemoveDependant(index)} style={deleteBtnStyle}><Trash2 size={15} /></button>
                    </div>
                    <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div>
                        <label style={smallLabelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" required placeholder="Last Name" value={dep.lastName} onChange={(e) => handleUpdateDependant(index, 'lastName', e.target.value)} style={inputSmallStyle} />
                      </div>
                      <div>
                        <label style={smallLabelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" required placeholder="First Name" value={dep.firstName} onChange={(e) => handleUpdateDependant(index, 'firstName', e.target.value)} style={inputSmallStyle} />
                      </div>
                      <div>
                        <label style={smallLabelStyle}>Relation <span style={{ color: '#ef4444' }}>*</span></label>
                        <select value={dep.relation} onChange={(e) => handleUpdateDependant(index, 'relation', e.target.value)} style={inputSmallStyle}>
                          {DEPENDANT_RELATIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                        </select>
                      </div>
                      <div>
                        <label style={smallLabelStyle}>Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="date" required value={dep.dateOfBirth} onChange={(e) => handleUpdateDependant(index, 'dateOfBirth', e.target.value)} style={inputSmallStyle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setCurrentStep(2)} style={backBtnStyle}>
                <ChevronLeft size={18} /> Back to Step 2
              </button>
              <button type="button" onClick={() => { if (validateStep3()) setCurrentStep(4); }} style={primaryBtnStyle}>
                Proceed to Step 4: Livelihood & Income <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: LIVELIHOOD & ASSETS ================= */}
        {currentStep === 4 && (
          <div className="officer-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                <Briefcase size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 4: Livelihood, Income, Assets & Liabilities</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Declared livelihood earnings, assets portfolio, and existing obligations.</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Occupation / Profession <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={step4.occupation} onChange={(e) => setStep4({ ...step4, occupation: e.target.value })} style={inputStyle}>
                    {PH_OCCUPATIONS.map((occ) => (<option key={occ} value={occ}>{occ}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Employer / Enterprise Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" required placeholder="Employer / Business Name" value={step4.employerEnterpriseName} onChange={(e) => setStep4({ ...step4, employerEnterpriseName: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Years in Livelihood <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" min="0" placeholder="e.g. 4" value={step4.yearsInLivelihood} onChange={(e) => setStep4({ ...step4, yearsInLivelihood: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Monthly Net Income / Salary (₱) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" min="0" required placeholder="25000" value={step4.monthlyNetIncome || ''} onChange={(e) => setStep4({ ...step4, monthlyNetIncome: Number(e.target.value) || 0 })} style={{ ...inputStyle, fontWeight: '700' }} />
                </div>
              </div>
            </div>

            {/* Assets Inventory (0 to 100) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Assets Inventory (0 to 100)</h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Real estate, vehicles, equipment, livestock, bank deposits, and enterprise chattel.</p>
                </div>
                <button type="button" onClick={handleAddAsset} disabled={assets.length >= 100} style={secondaryBtnStyle}>
                  <Plus size={15} /> Add Asset ({assets.length}/100)
                </button>
              </div>
              {assets.length === 0 ? (<div style={emptyBoxStyle}>No assets recorded. Click above to add declared assets.</div>) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {assets.map((asset, idx) => (
                    <div key={idx} style={{ ...formRepeaterCardStyle, backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0284c7' }}>Asset Record #{idx + 1}</span>
                        <button type="button" onClick={() => handleRemoveAsset(idx)} style={deleteBtnStyle} title="Remove this asset">
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                      <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                        <div>
                          <label style={smallLabelStyle}>Asset Category <span style={{ color: '#ef4444' }}>*</span></label>
                          <select value={asset.category} onChange={(e) => handleUpdateAsset(idx, 'category', e.target.value)} style={inputSmallStyle}>
                            {ASSET_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                          </select>
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Asset Subtype / Description</label>
                          <input type="text" placeholder="e.g. Residential House & Lot / Sari-sari inventory" value={asset.subtype || ''} onChange={(e) => handleUpdateAsset(idx, 'subtype', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Asset Name / Description</label>
                          <input type="text" placeholder="e.g. Primary Residence Lot" value={asset.nameTitle || ''} onChange={(e) => handleUpdateAsset(idx, 'nameTitle', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Name of Title / Proof Holder <span style={{ color: '#ef4444' }}>*</span></label>
                          <input type="text" placeholder="e.g. Juan dela Cruz (Registered Owner)" value={asset.titleHolderName || ''} onChange={(e) => handleUpdateAsset(idx, 'titleHolderName', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Title / Serial / Reg. Number</label>
                          <input type="text" placeholder="e.g. TCT No. 123-456789 or Plate No." value={asset.titleNumber || ''} onChange={(e) => handleUpdateAsset(idx, 'titleNumber', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Location / Physical Address <span style={{ color: '#ef4444' }}>*</span></label>
                          <input type="text" placeholder="e.g. Brgy. Commonwealth, Quezon City" value={asset.location || ''} onChange={(e) => handleUpdateAsset(idx, 'location', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Date of Valuation</label>
                          <input type="date" value={asset.valuationDate || ''} onChange={(e) => handleUpdateAsset(idx, 'valuationDate', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Total Lot Area (sqm) <span style={{ color: '#64748b' }}>(Optional)</span></label>
                          <input type="text" placeholder="e.g. 120 sqm" value={asset.totalLotArea || ''} onChange={(e) => handleUpdateAsset(idx, 'totalLotArea', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Floor Area (sqm) <span style={{ color: '#64748b' }}>(Optional)</span></label>
                          <input type="text" placeholder="e.g. 75 sqm" value={asset.floorArea || ''} onChange={(e) => handleUpdateAsset(idx, 'floorArea', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Appraised / Fair Value (₱) <span style={{ color: '#ef4444' }}>*</span></label>
                          <input type="number" min="0" placeholder="0.00" value={asset.appraisedValue || ''} onChange={(e) => handleUpdateAsset(idx, 'appraisedValue', Number(e.target.value) || 0)} style={{ ...inputSmallStyle, fontWeight: '700', color: '#0284c7' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other Income Sources (0 to 100) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Other Income Sources (0 to 100)</h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Remittances, spouse income, side businesses, agricultural sales.</p>
                </div>
                <button type="button" onClick={handleAddOtherIncome} disabled={otherIncomes.length >= 100} style={secondaryBtnStyle}>
                  <Plus size={15} /> Add Income Stream ({otherIncomes.length}/100)
                </button>
              </div>

              {otherIncomes.length === 0 ? (
                <div style={emptyBoxStyle}>No additional income streams recorded. Click above to add if applicable.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {otherIncomes.map((inc, idx) => (
                    <div key={idx} style={formRepeaterCardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#10b981' }}>Income Stream #{idx + 1}</span>
                        <button type="button" onClick={() => handleRemoveOtherIncome(idx)} style={deleteBtnStyle}><Trash2 size={14} /></button>
                      </div>
                      <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={smallLabelStyle}>Income Source Category</label>
                          <select value={inc.source} onChange={(e) => handleUpdateOtherIncome(idx, 'source', e.target.value)} style={inputSmallStyle}>
                            {OTHER_INCOME_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
                          </select>
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Description / Provider</label>
                          <input type="text" placeholder="e.g. Sibling remittance from Dubai" value={inc.description} onChange={(e) => handleUpdateOtherIncome(idx, 'description', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Monthly Amount (₱)</label>
                          <input type="number" min="0" placeholder="0.00" value={inc.monthlyAmount || ''} onChange={(e) => handleUpdateOtherIncome(idx, 'monthlyAmount', Number(e.target.value) || 0)} style={{ ...inputSmallStyle, fontWeight: '700' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liabilities & Existing Debts (0 to 100) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Liabilities & Existing Debts (0 to 100)</h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Existing obligations with other MFIs, cooperatives, banks, and private moneylenders.</p>
                </div>
                <button type="button" onClick={handleAddLiability} disabled={liabilities.length >= 100} style={secondaryBtnStyle}>
                  <Plus size={15} /> Add Debt / Liability ({liabilities.length}/100)
                </button>
              </div>

              {liabilities.length === 0 ? (
                <div style={emptyBoxStyle}>No existing debts declared. Click above to add if applicable.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {liabilities.map((liab, idx) => (
                    <div key={idx} style={formRepeaterCardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#ef4444' }}>Debt Record #{idx + 1}</span>
                        <button type="button" onClick={() => handleRemoveLiability(idx)} style={deleteBtnStyle}><Trash2 size={14} /></button>
                      </div>
                      <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={smallLabelStyle}>Creditor / Financial Institution</label>
                          <input type="text" placeholder="e.g. Card Bank / Home Credit" value={liab.creditorName} onChange={(e) => handleUpdateLiability(idx, 'creditorName', e.target.value)} style={inputSmallStyle} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Debt / Loan Type</label>
                          <select value={liab.liabilityType} onChange={(e) => handleUpdateLiability(idx, 'liabilityType', e.target.value)} style={inputSmallStyle}>
                            {LIABILITY_TYPES.map((lt) => (<option key={lt} value={lt}>{lt}</option>))}
                          </select>
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Total Outstanding Balance (₱)</label>
                          <input type="number" min="0" placeholder="0.00" value={liab.totalOutstanding || ''} onChange={(e) => handleUpdateLiability(idx, 'totalOutstanding', Number(e.target.value) || 0)} style={{ ...inputSmallStyle, fontWeight: '700' }} />
                        </div>
                        <div>
                          <label style={smallLabelStyle}>Monthly Due / Amortization (₱)</label>
                          <input type="number" min="0" placeholder="0.00" value={liab.monthlyAmortization || ''} onChange={(e) => handleUpdateLiability(idx, 'monthlyAmortization', Number(e.target.value) || 0)} style={{ ...inputSmallStyle, fontWeight: '700', color: '#ef4444' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: '16px', padding: '24px', color: '#ffffff', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Scale size={20} color="#38bdf8" />
                <h4 style={{ fontSize: '15px', fontWeight: '800' }}>Monthly Financial Capacity Overview</h4>
              </div>
              <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Monthly Income</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#38bdf8' }}>₱ {totals.totalMonthlyIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Monthly Debt Dues</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#f87171' }}>- ₱ {totals.totalMonthlyDebtDues.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Declared Assets</span>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>₱ {totals.totalAssetsValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Net Disposable Monthly</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: totals.netDisposableMonthlyIncome >= 0 ? '#4ade80' : '#f87171' }}>
                    ₱ {totals.netDisposableMonthlyIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setCurrentStep(3)} style={backBtnStyle}>
                <ChevronLeft size={18} /> Back to Step 3
              </button>
              <button type="button" onClick={() => { if (validateStep4()) setCurrentStep(5); }} style={primaryBtnStyle}>
                Proceed to Step 5: Loan Terms <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: LOAN TERMS (TRIBUTE GRACE BUSINESS PLAN MATRIX) ================= */}
        {currentStep === 5 && (
          <div className="officer-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                <Calculator size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 5: Loan Terms (Business Plan Matrix)</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Product terms conforming to Tribute Grace financial rules (Interest: 6%/mo flat, Service Charge: 1.5%/mo of term, CBU: 5%).
                </p>
              </div>
            </div>

            <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
              {/* Product */}
              <div>
                <label style={labelStyle}>Loan Product <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step5.loanProduct}
                  onChange={(e) => setStep5({ ...step5, loanProduct: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Regular Loan">Regular Loan (₱1,000 - ₱20,000 initial / max ₱50k)</option>
                  <option value="Small Business Loan">Small Business Loan (₱1,000 - ₱100,000 initial / max ₱200k)</option>
                  <option value="Emergency Loan">Emergency Loan (₱1,000 - ₱10,000 initial / max ₱30k)</option>
                </select>
              </div>

              {/* Principal Amount */}
              <div>
                <label style={labelStyle}>Requested Principal Amount (₱) <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#64748b' }}>₱</span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={step5.requestedAmount || ''}
                    onChange={(e) => setStep5({ ...step5, requestedAmount: Number(e.target.value) || 0 })}
                    style={{ ...inputStyle, paddingLeft: '32px', fontWeight: '800', fontSize: '16px', color: '#0284c7' }}
                  />
                </div>
              </div>

              {/* Term (2 to 6 months per business plan) */}
              <div>
                <label style={labelStyle}>Term in Months <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step5.termMonths}
                  onChange={(e) => setStep5({ ...step5, termMonths: Number(e.target.value) })}
                  style={inputStyle}
                >
                  <option value={2}>2 Months (60 days)</option>
                  <option value={3}>3 Months (90 days - Standard Cycle)</option>
                  <option value={4}>4 Months</option>
                  <option value={5}>5 Months</option>
                  <option value={6}>6 Months (Maximum Term)</option>
                </select>
              </div>

              {/* Repayment Frequency */}
              <div>
                <label style={labelStyle}>Mode of Payment <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step5.repaymentFrequency}
                  onChange={(e) => setStep5({ ...step5, repaymentFrequency: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="Daily">Daily (Field AO Collection)</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Semi-Monthly">Semi-Monthly (15th & 30th)</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>

              {/* Loan Purpose */}
              <div>
                <label style={labelStyle}>Loan Purpose <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={step5.loanPurpose}
                  onChange={(e) => setStep5({ ...step5, loanPurpose: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Debt Consolidation">Debt Consolidation</option>
                  <option value="Home Improvement">Home Improvement</option>
                  <option value="Medical Expense">Medical Expense</option>
                  <option value="Education">Education</option>
                  <option value="Emergency Funds">Emergency Funds</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {step5.loanPurpose === 'Other' && (
                <div>
                  <label style={labelStyle}>Specify Purpose <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" value={step5.otherPurpose} onChange={(e) => setStep5({ ...step5, otherPurpose: e.target.value })} style={inputStyle} />
                </div>
              )}
            </div>

            {/* Confirmed Business Plan Breakdown Display */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1.5px solid #cbd5e1',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calculator size={18} color="#0284c7" /> Confirmed Calculation (Rules 5.3 & 5.4 Example Basis)
              </h3>

              <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <div style={calcCardStyle}>
                  <span style={calcCardSub}>Principal Amount (P)</span>
                  <p style={{ ...calcCardVal, color: '#0284c7' }}>₱ {tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div style={calcCardStyle}>
                  <span style={calcCardSub}>Interest (6% x {tributeCalculations.termMonths} mos)</span>
                  <p style={{ ...calcCardVal, color: '#0f172a' }}>₱ {tributeCalculations.totalInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
                <div style={calcCardStyle}>
                  <span style={calcCardSub}>Service Charge (1.5% x {tributeCalculations.termMonths} mos)</span>
                  <p style={{ ...calcCardVal, color: '#b45309' }}>₱ {tributeCalculations.serviceCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>Deducted at release</span>
                </div>
                <div style={calcCardStyle}>
                  <span style={calcCardSub}>CBU (5% Lifetime &bull; Min ₱500)</span>
                  <p style={{ ...calcCardVal, color: '#16a34a' }}>₱ {tributeCalculations.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: '700' }}>Paid one-time upon release</span>
                </div>
                <div style={{ ...calcCardStyle, backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                  <span style={calcCardSub}>NET CASH PROCEEDS</span>
                  <p style={{ ...calcCardVal, color: '#15803d', fontSize: '20px' }}>₱ {tributeCalculations.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                  <span style={{ fontSize: '10.5px', color: '#166534' }}>P - Service Charge</span>
                </div>
                <div style={{ ...calcCardStyle, backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
                  <span style={calcCardSub}>COLLECTION / {step5.repaymentFrequency.toUpperCase()}</span>
                  <p style={{ ...calcCardVal, color: '#0284c7', fontSize: '20px' }}>
                    ₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                  <span style={{ fontSize: '10.5px', color: '#1e40af' }}>{tributeCalculations.numberOfInstallments} installments total</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setCurrentStep(4)} style={backBtnStyle}>
                <ChevronLeft size={18} /> Back to Step 4
              </button>
              <button type="button" onClick={() => { if (validateStep5()) setCurrentStep(6); }} style={primaryBtnStyle}>
                Proceed to Step 6: Review & Declaration <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 6: CONSENT & AI VERIFICATION INTERMISSION ================= */}
        {currentStep === 6 && (
          <div className="officer-card" style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                <FileCheck2 size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 6: Review, Attachments & 1-Minute AI Verification</h2>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  Audit application parameters, upload supporting documentation, and trigger the AI evaluation engine.
                </p>
              </div>
            </div>

            {/* Summary Preview */}
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '28px' }}>
              <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div><span style={{ color: '#64748b' }}>Borrower:</span> <strong>{step1.firstName} {step1.lastName}</strong></div>
                <div><span style={{ color: '#64748b' }}>Product:</span> <strong>{step5.loanProduct}</strong></div>
                <div><span style={{ color: '#64748b' }}>Requested:</span> <strong style={{ color: '#0284c7' }}>₱ {Number(step5.requestedAmount).toLocaleString('en-PH')}</strong></div>
                <div><span style={{ color: '#64748b' }}>Net Salary:</span> <strong>₱ {Number(step4.monthlyNetIncome).toLocaleString('en-PH')}/mo</strong></div>
                <div><span style={{ color: '#64748b' }}>Net Disposable:</span> <strong style={{ color: '#16a34a' }}>₱ {totals.netDisposableMonthlyIncome.toLocaleString('en-PH')}/mo</strong></div>
              </div>
            </div>

            {/* Supporting Document Attachments */}
            <div style={{ padding: '24px', borderRadius: '16px', border: '1.5px dashed #cbd5e1', backgroundColor: '#f8fafc', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Supporting Document Attachments ({attachments.length}/20)</h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Attach payslips, proof of billing, barangay clearance, or business permits via file upload or camera snapshot.</p>
                </div>
                <button type="button" onClick={handleAddAttachment} disabled={attachments.length >= 20} style={secondaryBtnStyle}>
                  <Plus size={14} /> Add Attachment ({attachments.length}/20)
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {attachments.map((att, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#ffffff',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7' }}>Attachment #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        disabled={attachments.length <= 1}
                        style={{ ...deleteBtnStyle, opacity: attachments.length <= 1 ? 0.4 : 1, cursor: attachments.length <= 1 ? 'not-allowed' : 'pointer' }}
                        title="Remove attachment"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>

                    <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={smallLabelStyle}>Document Type <span style={{ color: '#ef4444' }}>*</span></label>
                        <select
                          value={att.documentType}
                          onChange={(e) => handleUpdateAttachment(idx, 'documentType', e.target.value)}
                          style={inputSmallStyle}
                        >
                          <option value="Proof of Billing / Residence">Proof of Billing / Residence</option>
                          <option value="Certificate of Employment / Payslip">Certificate of Employment / Payslip</option>
                          <option value="Barangay Clearance">Barangay Clearance</option>
                          <option value="Business Permit / Mayor's Permit">Business Permit / Mayor's Permit</option>
                          <option value="DTI Registration">DTI Registration</option>
                          <option value="Bank Statement / Passbook">Bank Statement / Passbook</option>
                          <option value="Post-dated Checks">Post-dated Checks</option>
                          <option value="Co-Maker Undertaking">Co-Maker Undertaking</option>
                          <option value="Collateral / Asset Title Photo">Collateral / Asset Title Photo</option>
                          <option value="Other Supporting Document">Other Supporting Document</option>
                        </select>
                      </div>

                      <div>
                        <label style={smallLabelStyle}>Document Name / Note</label>
                        <input
                          type="text"
                          placeholder="e.g. Meralco_Bill_March2026.pdf"
                          value={att.fileName}
                          onChange={(e) => handleUpdateAttachment(idx, 'fileName', e.target.value)}
                          style={inputSmallStyle}
                        />
                      </div>
                    </div>

                    {/* Actions: Attach File OR Take a Picture */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: att.fileBase64 ? '#f0fdf4' : '#f8fafc',
                      border: att.fileBase64 ? '1px solid #86efac' : '1px dashed #cbd5e1',
                      flexWrap: 'wrap'
                    }}>
                      {att.fileBase64 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <CheckCircle size={16} color="#16a34a" />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {att.fileName || 'Attached file'} ({att.fileSize || 'Attached'})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...attachments];
                              updated[idx].fileBase64 = undefined;
                              updated[idx].fileName = '';
                              updated[idx].fileSize = undefined;
                              setAttachments(updated);
                            }}
                            style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Remove File
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                          {/* Option 1: Attach File */}
                          <label style={{
                            flex: 1,
                            minWidth: '150px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#334155',
                            cursor: 'pointer'
                          }}>
                            <Upload size={14} color="#0284c7" /> Attach File (PDF, Image, Doc)
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const updated = [...attachments];
                                    updated[idx].fileName = file.name;
                                    updated[idx].fileSize = sizeMb;
                                    updated[idx].fileBase64 = event.target?.result as string;
                                    setAttachments(updated);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>

                          {/* Option 2: Take Picture */}
                          <label style={{
                            flex: 1,
                            minWidth: '150px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: '#0284c7',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                          }}>
                            <Camera size={14} /> Take a Picture (Camera)
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const updated = [...attachments];
                                    updated[idx].fileName = `snapshot_${Date.now()}.jpg`;
                                    updated[idx].fileSize = sizeMb;
                                    updated[idx].fileBase64 = event.target?.result as string;
                                    setAttachments(updated);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Field Notes */}
            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Account Officer Field Assessment Notes <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                rows={3}
                placeholder="Client character investigation and capacity notes..."
                value={officerAssessmentNotes}
                onChange={(e) => setOfficerAssessmentNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>

            {/* Privacy Declaration */}
            <div style={{ padding: '16px', borderRadius: '12px', border: privacyConsentAffirmed ? '2px solid #10b981' : '1px solid #cbd5e1', backgroundColor: '#f8fafc', marginBottom: '32px' }}>
              <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', fontSize: '13px' }}>
                <input type="checkbox" checked={privacyConsentAffirmed} onChange={(e) => setPrivacyConsentAffirmed(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#10b981' }} />
                <span>I hereby declare that the member-borrower was presented with the <strong>Tribute Grace Data Privacy Notice (Version PN_446a3cc6)</strong> and gave affirmative consent.</span>
              </label>
            </div>

            {/* AI VERIFICATION INTERMISSION & COUNTDOWN */}
            {!aiResult && !isAiVerifying && (
              <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#f0f9ff', borderRadius: '16px', border: '1.5px solid #bae6fd', marginBottom: '32px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                  <Bot size={28} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Ready for 1-Minute AI Verification Engine</h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '480px', margin: '6px auto 20px auto' }}>
                  The engine will evaluate borrower DSR, capacity, and risk predictions based on the Tribute Grace Business Plan, then automatically generate the <strong>Pre-Approved Loan Amount</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleStartAiVerification}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 28px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  <Sparkles size={18} /> Launch 1-Minute AI Verification
                </button>
              </div>
            )}

            {/* Active 1-Minute Countdown Running */}
            {isAiVerifying && (
              <div style={{
                textAlign: 'center',
                padding: '36px 24px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '18px',
                marginBottom: '32px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)'
              }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  border: '3px solid #38bdf8',
                  borderTopColor: 'transparent',
                  animation: 'spin 1.2s linear infinite',
                  margin: '0 auto 18px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={28} color="#38bdf8" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>
                  AI Verification Algorithm Running...
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
                  Analyzing cash-flow capacity, delinquency matrix & Tribute Grace ceiling rules.
                </p>

                <div style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  margin: '16px 0'
                }}>
                  00:{aiTimerSeconds < 10 ? `0${aiTimerSeconds}` : aiTimerSeconds}
                </div>

                <button
                  type="button"
                  onClick={handleFastTrackAiVerification}
                  style={{
                    background: 'none',
                    border: '1px solid #334155',
                    color: '#94a3b8',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Fast-Forward AI Simulation
                </button>
              </div>
            )}

            {/* AI Evaluation Completed Result & Credit Assessment Hand-off */}
            {aiResult && (
              <div style={{
                backgroundColor: '#f0fdf4',
                borderRadius: '16px',
                border: '2px solid #86efac',
                padding: '28px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px', borderRadius: '10px' }}>
                      <Bot size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>AI Pre-Approved Recommendation</h3>
                      <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>
                        Risk: {aiResult.riskRating} • Confidence: {aiResult.confidenceScore}%
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>AI Pre-Approved Amount</span>
                    <p style={{ fontSize: '26px', fontWeight: '800', color: '#0284c7' }}>
                      ₱ {aiResult.preApprovedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#334155', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  🤖 <strong>AI Note:</strong> {aiResult.recommendationNote}
                </p>

                {/* Workflow Status Banner & Mandatory 5 Cs Assessment CTA */}
                {(() => {
                  const currentAppId = applicationId || `NBR-${Date.now().toString().slice(-6)}`;
                  const assessId = `CA-${currentAppId.replace('NBR-', '')}`;
                  const isApproved = adminSimulationStatus === 'approved';
                  const isPendingAdmin = isSubmittedToAdmin || adminSimulationStatus === 'pending';
                  const isRejected = adminSimulationStatus === 'rejected';

                  return (
                    <div style={{
                      backgroundColor: isApproved ? '#f0fdf4' : isRejected ? '#fef2f2' : isPendingAdmin ? '#f0f9ff' : '#fffbeb',
                      borderRadius: '14px',
                      padding: '22px',
                      border: isApproved ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fecaca' : isPendingAdmin ? '1.5px solid #bae6fd' : '1.5px solid #fde68a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}>
                      <div style={{ maxWidth: '640px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          {isApproved ? (
                            <CheckCircle size={18} color="#15803d" />
                          ) : isRejected ? (
                            <AlertCircle size={18} color="#dc2626" />
                          ) : isPendingAdmin ? (
                            <Building size={18} color="#0284c7" />
                          ) : (
                            <FileCheck size={18} color="#b45309" />
                          )}
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {isApproved
                              ? 'Application Status: Approved by Committee'
                              : isRejected
                              ? 'Application Status: Disapproved'
                              : isPendingAdmin
                              ? 'Application Status: In Admin Committee Queue'
                              : 'Ready for AO Credit Assessment'}
                          </strong>
                        </div>
                        <p style={{ fontSize: '12.5px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                          {isApproved ? (
                            <>Credit Committee has officially approved this loan at <strong>₱{adminApprovedAmount.toLocaleString('en-PH')}</strong>. You may now proceed directly to Step 7 Contract Execution.</>
                          ) : isRejected ? (
                            <>This loan application has been disapproved by the Credit Committee. Review notes or contact administration.</>
                          ) : isPendingAdmin ? (
                            <>Application was endorsed by Account Officer and is currently under review by the Admin Credit Committee. Amount adjustments and endorsements are locked.</>
                          ) : (
                            <>AI verification is complete. The application must now be evaluated on the 5 Cs Credit Assessment desk (Character, Capacity, Capital, Collateral, Conditions) before it can be submitted to Admin.</>
                          )}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isApproved ? (
                          <>
                            <Link
                              href={`/officer/credit-assessments?assessId=${encodeURIComponent(assessId)}`}
                              style={{
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                border: '1.5px solid #cbd5e1',
                                padding: '10px 18px',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '13px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textDecoration: 'none'
                              }}
                            >
                              <Eye size={15} /> View Credit Assessment
                            </Link>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(7)}
                              style={{
                                backgroundColor: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 22px',
                                borderRadius: '8px',
                                fontWeight: '800',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                              }}
                            >
                              Proceed to Step 7: Contract Execution <ChevronRight size={16} />
                            </button>
                          </>
                        ) : isPendingAdmin ? (
                          <Link
                            href={`/officer/credit-assessments?assessId=${encodeURIComponent(assessId)}`}
                            style={{
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '13px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              textDecoration: 'none',
                              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                            }}
                          >
                            <Eye size={15} /> View Credit Assessment
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={handleContinueToCreditAssessment}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '11px 22px',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '13.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                            }}
                          >
                            <BadgeCheck size={17} /> Continue to Credit Assessment <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setCurrentStep(5)} style={backBtnStyle}>
                <ChevronLeft size={18} /> Back to Step 5
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 7: CONTRACT (DIGITAL SIGNATURE, FACE PICTURE & PRIVACY AGREE) ================= */}
        {currentStep === 7 && (
          <div className="officer-card" style={cardStyle}>
            {/* STEP 7 HEADER */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '12px' }}>
                  <PenTool size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>Step 7: Contract Execution & Biometrics</h2>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Final approved loan agreement, digital stylus signature, live face photo, and contract execution.
                  </p>
                </div>
              </div>
            </div>

            {/* FULL DRAFT CONTRACT DOCUMENT & EXECUTION WORKBENCH (Only shown before finalization, hidden in print when finalized) */}
            {!isContractFinalized && (
              <div className="no-print">
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #0f172a',
                  borderRadius: '14px',
                  padding: '36px',
                  marginBottom: '32px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
                  fontFamily: 'serif'
                }}>
                  {/* Document Header */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a' }}>
                      Tribute Grace Financial Cooperative
                    </h2>
                    <p style={{ fontSize: '13px', color: '#334155' }}>
                      Microfinance Credit Facility & Promissory Note Agreement
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '800', fontFamily: 'monospace' }}>
                        {applicationId || 'TC-LN-A-00001'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', fontFamily: 'monospace' }}>
                        MCID: {step1.cooperativeId || 'TCID-A-00001'}
                      </span>
                    </div>
                  </div>

                  {/* Parties Statement */}
                  <div style={{ fontSize: '13.5px', lineHeight: '1.7', color: '#1e293b', marginBottom: '20px' }}>
                    <p>
                      This Microfinance Loan Agreement is entered into by and between <strong>TRIBUTE GRACE COOPERATIVE</strong>, hereinafter referred to as the <em>LENDER</em>, and:
                    </p>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', margin: '10px 0', border: '1px solid #e2e8f0', fontFamily: 'sans-serif' }}>
                      <p><strong>BORROWER:</strong> {step1.firstName} {step1.middleName} {step1.lastName} {step1.suffix}</p>
                      <p><strong>RESIDENCE:</strong> {step2.addressLine1}, {step2.barangay}, {step2.city}, {step2.province}</p>
                      <p><strong>PRIMARY LIVELIHOOD:</strong> {step4.occupation} ({step4.employerEnterpriseName})</p>
                    </div>
                  </div>

                  {/* Financial Terms Table */}
                  <h4 style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'sans-serif' }}>
                    Summary of Approved Loan Terms & Amortization
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '24px', fontFamily: 'sans-serif' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px' }}>Calculation Basis</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '600' }}>Approved Principal Loan</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{step5.loanProduct}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>₱ {tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px' }}>Total Add-on Interest</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>6% monthly x {tributeCalculations.termMonths} mos</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>₱ {tributeCalculations.totalInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px' }}>Upfront Service Charge</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>1.5% monthly x {tributeCalculations.termMonths} mos</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#b45309' }}>- ₱ {tributeCalculations.serviceCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px' }}>Capital Build Up (CBU)</td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>5% lifetime cooperative equity (min. ₱500 floor &bull; one-time upon release)</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a' }}>₱ {tributeCalculations.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2px solid #16a34a' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>NET DISBURSEMENT TO BORROWER</td>
                        <td style={{ padding: '10px 12px', color: '#166534' }}>Disbursed in cash / bank transfer</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#15803d', fontSize: '15px' }}>
                          ₱ {tributeCalculations.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: '#eff6ff', borderTop: '1px solid #bfdbfe' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>SCHEDULED PAYMENT DUES</td>
                        <td style={{ padding: '10px 12px', color: '#1e40af' }}>{step5.repaymentFrequency} Collection Mode</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#0284c7', fontSize: '15px' }}>
                          ₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {step5.repaymentFrequency}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Standard Legal Covenants */}
                  <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#475569', marginBottom: '28px' }}>
                    <p><strong>1. Repayment Terms:</strong> The Borrower agrees to pay the scheduled collections unconditionally without the necessity of prior demand. Payments will be collected by authorized Tribute Grace account officers/collectors.</p>
                    <p style={{ marginTop: '6px' }}><strong>2. CBU Savings:</strong> The Capital Build Up (CBU) is credited to the member's cooperative equity savings and can only be withdrawn upon full cessation of membership.</p>
                    <p style={{ marginTop: '6px' }}><strong>3. Default & Remedies:</strong> Missed installments shall be subject to standard cooperative arrears handling and CI field follow-up.</p>
                  </div>

                  {/* Execution Signatures Grid */}
                  <div className="step-form-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '30px',
                    borderTop: '1px solid #cbd5e1',
                    paddingTop: '20px',
                    fontFamily: 'sans-serif'
                  }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>BORROWER SIGNATURE:</span>
                      {applicantSignature ? (
                        <div style={{ marginTop: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px', backgroundColor: '#fafafa' }}>
                          <img src={applicantSignature} alt="Borrower Digital Signature" style={{ height: '70px', display: 'block' }} />
                          <p style={{ fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>{step1.firstName} {step1.lastName}</p>
                          {borrowerSignatures[0]?.authId && (
                            <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#0284c7' }}>
                              Auth: {borrowerSignatures[0].authId} ({borrowerSignatures[0].timestamp})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ height: '70px', borderBottom: '1px solid #334155', marginTop: '20px' }} />
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>AUTHORIZED OFFICER SIGNATURE:</span>
                      {officerSignatures.length > 0 ? (
                        <div style={{ marginTop: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px', backgroundColor: '#fafafa' }}>
                          <img src={officerSignatures[0].signature} alt="AO Digital Signature" style={{ height: '70px', display: 'block' }} />
                          <p style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7', marginTop: '4px' }}>Officer Juan (AO-001)</p>
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#0284c7' }}>
                            Auth: {officerSignatures[0].authId} ({officerSignatures[0].timestamp})
                          </span>
                        </div>
                      ) : (
                        <div style={{ height: '70px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderBottom: '1px solid #334155' }}>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#0284c7' }}>Officer Juan (AO-001)</p>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Account Officer / Field Collector</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TABLET INTERACTIVE EXECUTION AREA */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  padding: '28px',
                  border: '1.5px solid #cbd5e1',
                  marginBottom: '32px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#0284c7" /> Tablet Digital Execution Requirements
                  </h3>

                  {/* 1. BORROWER: 3 SIGNATURES (ONE AT A TIME WITH UNIQUE AUTH ID & TIMESTAMP) */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #cbd5e1',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          1. Borrower 3-Time Specimen Signatures (One at a time) <span style={{ color: '#ef4444' }}>*</span>
                        </h4>
                        <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                          Each signature is captured individually and assigned a unique cryptographically tracked Authentication ID & Timestamp.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[0, 1, 2].map((slot) => {
                          const isDone = Boolean(borrowerSignatures[slot]);
                          const isActive = activeBorrowerSigSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setActiveBorrowerSigSlot(slot)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                border: isActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                backgroundColor: isDone ? '#f0fdf4' : (isActive ? '#e0f2fe' : '#f8fafc'),
                                color: isDone ? '#166534' : (isActive ? '#0369a1' : '#475569'),
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isDone ? '✓' : ''} Signature #{slot + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
                      {/* Active Signature Pad for Selected Slot */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1' }}>
                            Currently Affixing: Borrower Signature #{activeBorrowerSigSlot + 1}
                          </span>
                          {borrowerSignatures[activeBorrowerSigSlot] && (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>
                              ✓ Captured
                            </span>
                          )}
                        </div>
                        <SignaturePad
                          key={`borrower-pad-${activeBorrowerSigSlot}`}
                          onSave={(dataUrl) => {
                            const now = new Date();
                            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                            const authId = `AUTH-BRW-${Date.now().toString().slice(-6)}-S${activeBorrowerSigSlot + 1}`;
                            
                            const next = [...borrowerSignatures];
                            next[activeBorrowerSigSlot] = {
                              signature: dataUrl,
                              authId,
                              timestamp: `${dateStr} ${timeStr}`
                            };
                            setBorrowerSignatures(next);
                            if (activeBorrowerSigSlot === 0 || !applicantSignature) {
                              setApplicantSignature(dataUrl);
                            }
                            // Auto-advance to next slot if available
                            if (activeBorrowerSigSlot < 2 && !borrowerSignatures[activeBorrowerSigSlot + 1]) {
                              setActiveBorrowerSigSlot(activeBorrowerSigSlot + 1);
                            }
                          }}
                          height={150}
                        />
                      </div>

                      {/* Summary of 3 Captured Signatures with Auth IDs */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[0, 1, 2].map((idx) => {
                          const sig = borrowerSignatures[idx];
                          return (
                            <div
                              key={idx}
                              onClick={() => setActiveBorrowerSigSlot(idx)}
                              style={{
                                border: activeBorrowerSigSlot === idx ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '8px',
                                backgroundColor: sig ? '#ffffff' : '#f8fafc',
                                textAlign: 'center',
                                cursor: 'pointer',
                                minHeight: '120px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>
                                #{idx + 1}
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                {sig ? (
                                  <img src={sig.signature} alt={`Borrower Sig ${idx + 1}`} style={{ maxHeight: '42px', maxWidth: '100%', objectFit: 'contain' }} />
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>Pending</span>
                                )}
                              </div>
                              {sig ? (
                                <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  <div style={{ fontSize: '8pt', fontFamily: 'monospace', fontWeight: '700', color: '#0284c7' }}>
                                    {sig.authId}
                                  </div>
                                  <div style={{ fontSize: '6.5pt', color: '#64748b' }}>
                                    {sig.timestamp}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Tap to sign</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 2. PHOTOS: LIVE FACE PHOTO + PHOTO HOLDING GOVERNMENT ID */}
                  <div className="step-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {/* Live Face Photo */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1.5px solid #cbd5e1'
                    }}>
                      <label style={{ ...labelStyle, marginBottom: '8px' }}>
                        2. Applicant Live Biometric Face Picture <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <FaceCapture
                        onCapture={(photoData) => setApplicantFacePhoto(photoData)}
                        title="Live Biometric Face Capture"
                        description="Clear photo of applicant face with good lighting."
                        buttonText="Capture Face Photo"
                        badgeText="Biometric Face Attached"
                        previewRounded={true}
                      />
                    </div>

                    {/* Holding Gov ID Photo */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '14px',
                      padding: '20px',
                      border: '1.5px solid #cbd5e1'
                    }}>
                      <label style={{ ...labelStyle, marginBottom: '8px' }}>
                        3. Applicant Photo Holding Government ID <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <FaceCapture
                        onCapture={(photoData) => setBorrowerHoldingIdPhoto(photoData)}
                        title="Applicant Holding Government ID"
                        description="Capture applicant holding their official Government ID next to their face."
                        buttonText="Capture Photo Holding ID"
                        badgeText="Photo Holding ID Attached"
                        previewRounded={false}
                      />
                    </div>
                  </div>

                  {/* 3. ACCOUNT OFFICER: 3 SIGNATURES (ONE AT A TIME WITH AUTH ID & TIMESTAMP) */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #cbd5e1',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          4. Account Officer Digital Signatures (3 Times) <span style={{ color: '#ef4444' }}>*</span>
                        </h4>
                        <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                          Signed by Account Officer after borrower completion. Each signature receives a unique AO Auth ID & timestamp.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[0, 1, 2].map((slot) => {
                          const isDone = Boolean(officerSignatures[slot]);
                          const isActive = activeOfficerSigSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setActiveOfficerSigSlot(slot)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                border: isActive ? '2px solid #047857' : '1px solid #cbd5e1',
                                backgroundColor: isDone ? '#f0fdf4' : (isActive ? '#ecfdf5' : '#f8fafc'),
                                color: isDone ? '#166534' : (isActive ? '#047857' : '#475569'),
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isDone ? '✓' : ''} AO Sig #{slot + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
                      {/* Active Signature Pad for AO */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857' }}>
                            Currently Affixing: Account Officer Signature #{activeOfficerSigSlot + 1}
                          </span>
                          {officerSignatures[activeOfficerSigSlot] && (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>
                              ✓ Captured
                            </span>
                          )}
                        </div>
                        <SignaturePad
                          key={`ao-pad-${activeOfficerSigSlot}`}
                          onSave={(dataUrl) => {
                            const now = new Date();
                            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const dateStr = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                            const authId = `AUTH-AO-001-${Date.now().toString().slice(-6)}-S${activeOfficerSigSlot + 1}`;
                            
                            const next = [...officerSignatures];
                            next[activeOfficerSigSlot] = {
                              signature: dataUrl,
                              authId,
                              timestamp: `${dateStr} ${timeStr}`
                            };
                            setOfficerSignatures(next);
                            if (activeOfficerSigSlot < 2 && !officerSignatures[activeOfficerSigSlot + 1]) {
                              setActiveOfficerSigSlot(activeOfficerSigSlot + 1);
                            }
                          }}
                          height={150}
                        />
                      </div>

                      {/* Summary of 3 Captured AO Signatures with Auth IDs */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {[0, 1, 2].map((idx) => {
                          const sig = officerSignatures[idx];
                          return (
                            <div
                              key={idx}
                              onClick={() => setActiveOfficerSigSlot(idx)}
                              style={{
                                border: activeOfficerSigSlot === idx ? '2px solid #047857' : '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '8px',
                                backgroundColor: sig ? '#ffffff' : '#f8fafc',
                                textAlign: 'center',
                                cursor: 'pointer',
                                minHeight: '120px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b' }}>
                                AO #{idx + 1}
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                {sig ? (
                                  <img src={sig.signature} alt={`AO Sig ${idx + 1}`} style={{ maxHeight: '42px', maxWidth: '100%', objectFit: 'contain' }} />
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>Pending</span>
                                )}
                              </div>
                              {sig ? (
                                <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                                  <div style={{ fontSize: '8pt', fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>
                                    {sig.authId}
                                  </div>
                                  <div style={{ fontSize: '6.5pt', color: '#64748b' }}>
                                    {sig.timestamp}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Tap to sign</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. Disbursement Release Channel Question */}
                  <div style={{
                    marginTop: '24px',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#ffffff'
                  }}>
                    <label style={{ ...labelStyle, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Coins size={18} color="#0284c7" />
                      5. Disbursement Preference: How will the member receive the loan funds? <span style={{ color: '#ef4444' }}>*</span>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: disbursementMode === 'cash' ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                        backgroundColor: disbursementMode === 'cash' ? '#f0fdf4' : '#fafafa',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="disbursementMode"
                          checked={disbursementMode === 'cash'}
                          onChange={() => {
                            setDisbursementMode('cash');
                            setDisbursementChannel('Cashier Over-the-Counter');
                          }}
                          style={{ width: '18px', height: '18px', accentColor: '#16a34a' }}
                        />
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block' }}>💵 Cash Disbursement</strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Release via Tribute Grace Cashier Window</span>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: disbursementMode === 'online' ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                        backgroundColor: disbursementMode === 'online' ? '#f0f9ff' : '#fafafa',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="disbursementMode"
                          checked={disbursementMode === 'online'}
                          onChange={() => {
                            setDisbursementMode('online');
                            setDisbursementChannel('GCash');
                          }}
                          style={{ width: '18px', height: '18px', accentColor: '#0284c7' }}
                        />
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block' }}>📲 Online Electronic Transfer</strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Release to GCash, Maya, or Bank Account</span>
                        </div>
                      </label>
                    </div>

                    {disbursementMode === 'online' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                        <div>
                          <label style={smallLabelStyle}>Online Transfer Channel</label>
                          <select
                            value={disbursementChannel}
                            onChange={(e) => setDisbursementChannel(e.target.value)}
                            style={inputStyle}
                          >
                            <option value="GCash">GCash E-Wallet</option>
                            <option value="Maya">Maya Wallet</option>
                            <option value="BDO Unibank">BDO Unibank</option>
                            <option value="Bank of the Philippine Islands (BPI)">BPI (Bank of the Philippine Islands)</option>
                            <option value="Landbank">Landbank of the Philippines</option>
                            <option value="UnionBank">UnionBank of the Philippines</option>
                          </select>
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Account / Mobile Number for Disbursement</label>
                          <input
                            type="text"
                            placeholder={disbursementChannel.includes('GCash') || disbursementChannel.includes('Maya') ? 'e.g. 0917XXXXXXX' : 'e.g. Account Number 10-12 digits'}
                            value={disbursementAccountNumber}
                            onChange={(e) => setDisbursementAccountNumber(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Final Privacy & Contract Agreement Checkbox */}
                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: '12px',
                    border: contractAgreed ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                    backgroundColor: '#ffffff'
                  }}>
                    <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', fontSize: '13px', lineHeight: '1.6' }}>
                      <input
                        type="checkbox"
                        checked={contractAgreed}
                        onChange={(e) => setContractAgreed(e.target.checked)}
                        style={{ width: '22px', height: '22px', accentColor: '#10b981', marginTop: '2px', flexShrink: 0 }}
                      />
                      <span>
                        I confirm that I have reviewed the full loan agreement, repayment schedule, and privacy declaration with the member-borrower. The borrower voluntarily affixes their digital signature, submits their biometric face verification, and formally agrees to the <strong>Tribute Grace Loan Contract Terms & Conditions</strong>.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Post-Finalization Success Document Display: Schedule, Contract, Ledger, and Borrower Credentials */}
            {isContractFinalized && (
              <div style={{ marginTop: '32px' }}>
                {/* Status Announcement Banner (Screen Only) */}
                <div className="status-announcement-banner no-print" style={{
                  padding: '24px 28px',
                  borderRadius: '16px',
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #86efac',
                  boxShadow: '0 8px 24px rgba(22, 163, 74, 0.12)',
                  marginBottom: '28px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: '#16a34a', color: '#ffffff', padding: '12px', borderRadius: '12px' }}>
                      <CheckCircle size={28} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                        Loan Contract Executed & Dispatched to Disbursement Officer!
                      </h3>
                      <p style={{ fontSize: '13px', color: '#15803d', fontWeight: '700' }}>
                        Approved Principal: ₱{tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} • Net Proceeds: ₱{tributeCalculations.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({disbursementMode === 'cash' ? 'Over-the-Counter Cash' : `Online Transfer via ${disbursementChannel}`})
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintDocument('all')}
                      style={{
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)'
                      }}
                      title="Print all 3 official documents together in 1 professional PDF bundle"
                    >
                      <Printer size={16} /> Print Full Bundle (All 3 Docs)
                    </button>

                    <Link
                      href="/officer/borrowers"
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                      }}
                    >
                      <Users size={16} /> View in Current Borrowers
                    </Link>

                    <button
                      type="button"
                      onClick={handleClearDraft}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <Plus size={16} /> Start Next Application
                    </button>
                  </div>
                </div>

                {/* Document View Switcher Tabs (Screen Only) */}
                <div className="doc-tab-switcher no-print" style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '20px',
                  backgroundColor: '#ffffff',
                  padding: '8px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={() => setActiveExecutedTab('schedule')}
                    style={{
                      flex: 1,
                      minWidth: '180px',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeExecutedTab === 'schedule' ? '#0284c7' : 'transparent',
                      color: activeExecutedTab === 'schedule' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Calendar size={16} /> 1. Payment Schedule
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveExecutedTab('contract')}
                    style={{
                      flex: 1,
                      minWidth: '180px',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeExecutedTab === 'contract' ? '#0284c7' : 'transparent',
                      color: activeExecutedTab === 'contract' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileText size={16} /> 2. Executed Contract & Signatures
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveExecutedTab('passbook_inside')}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeExecutedTab === 'passbook_inside' ? '#0f172a' : 'transparent',
                      color: activeExecutedTab === 'passbook_inside' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <BookOpen size={16} color={activeExecutedTab === 'passbook_inside' ? '#38bdf8' : '#0284c7'} /> 3. Official Passbook Booklet & Records
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveExecutedTab('payment_ledger')}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeExecutedTab === 'payment_ledger' ? '#15803d' : 'transparent',
                      color: activeExecutedTab === 'payment_ledger' ? '#ffffff' : '#475569',
                      fontWeight: '800',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileSpreadsheet size={16} color={activeExecutedTab === 'payment_ledger' ? '#ffffff' : '#15803d'} /> 4. Loan Payment Ledger (Field Copy)
                  </button>
                </div>

                {/* =========================================================================
                    SCREEN PREVIEW OF ACTIVE TAB (Interactive with individual Print Button)
                   ========================================================================= */}
                <div className="no-print">
                  {/* TAB 1: DETAILED PAYMENT AMORTIZATION SCHEDULE */}
                  {activeExecutedTab === 'schedule' && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #cbd5e1',
                      padding: '28px',
                      marginBottom: '28px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                            Official Repayment Amortization Schedule
                          </h3>
                          <p style={{ fontSize: '13px', color: '#64748b' }}>
                            Collection Frequency: <strong>{step5.repaymentFrequency}</strong> • Term: <strong>{step5.termMonths} Months</strong> ({tributeCalculations.numberOfInstallments} Installments)
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', backgroundColor: '#dcfce7', padding: '6px 14px', borderRadius: '8px' }}>
                            ₱{tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {step5.repaymentFrequency}
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                              <th style={{ padding: '10px 12px' }}>#</th>
                              <th style={{ padding: '10px 12px' }}>Due Date</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Principal Due</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Interest (6%/mo)</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Installment</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Remaining Balance</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const holidaySchedule = generateCollectionScheduleDates(
                                new Date(),
                                Number(step5.termMonths) || 3,
                                step5.repaymentFrequency,
                                tributeCalculations.numberOfInstallments
                              );

                              return Array.from({ length: Math.min(tributeCalculations.numberOfInstallments, 26) }).map((_, idx) => {
                                const instNo = idx + 1;
                                const principalPerInst = tributeCalculations.principal / tributeCalculations.numberOfInstallments;
                                const interestPerInst = tributeCalculations.totalInterest / tributeCalculations.numberOfInstallments;
                                const remaining = Math.max(0, tributeCalculations.totalScheduledCollections - (tributeCalculations.installmentPerFrequency * instNo));
                                
                                const schedItem = holidaySchedule[idx];
                                const dueDateStr = schedItem ? schedItem.shortDateStr : new Date(Date.now() + 86400000 * ((idx + 1) * 7)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: '700', color: '#64748b' }}>{instNo}</td>
                                    <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>
                                      {dueDateStr}
                                      {schedItem?.holidayNote && (
                                        <span style={{ display: 'block', fontSize: '9.5px', color: '#b45309', fontWeight: '700' }}>
                                          {schedItem.holidayNote}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₱ {principalPerInst.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>₱ {interestPerInst.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0284c7' }}>₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>₱ {remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '700' }}>
                                        Upcoming
                                      </span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: EXECUTED CONTRACT & BIOMETRIC ATTESTATION */}
                  {activeExecutedTab === 'contract' && (() => {
                    const currentTemplate = contractTemplateSnapshot || getActiveContractTemplate();
                    const contractVars = {
                      totalScheduledCollections: `₱ ${tributeCalculations.totalScheduledCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                      installmentAmount: `₱ ${tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                      repaymentFrequency: step5.repaymentFrequency,
                      termMonths: step5.termMonths,
                      principal: `₱ ${tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                      borrowerName: `${step1.firstName} ${step1.middleName} ${step1.lastName} ${step1.suffix}`.trim(),
                      policyNo: step1.tgswsPolicyNumber || 'LCAP-001'
                    };

                    return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #0f172a',
                      padding: '32px',
                      marginBottom: '28px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      {/* Modern Corporate Bank Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '2.5px solid #0f172a',
                        paddingBottom: '18px',
                        marginBottom: '22px',
                        gap: '20px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <img
                            src="/tribute-credit-logo.png"
                            alt="Tribute Credit Cooperative"
                            style={{ height: '62px', width: 'auto', objectFit: 'contain' }}
                          />
                          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '16px' }}>
                            <h2 style={{ fontSize: '14pt', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              TRIBUTE CREDIT COOPERATIVE
                            </h2>
                            <p style={{ fontSize: '7.5pt', color: '#047857', margin: 0, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              REGULATED CREDIT & FINANCIAL SERVICES &bull; CDA REG. REF: NCR-COOP-88219
                            </p>
                            <p style={{ fontSize: '7pt', color: '#64748b', margin: '2px 0 0 0' }}>
                              Commonwealth Ave., Quezon City, Metro Manila &bull; Tel: (02) 8921-4400 &bull; contact@tribute-grace.org
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{
                            fontSize: '7pt',
                            fontWeight: '900',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase'
                          }}>
                            OFFICIAL EXECUTED CONTRACT & NOTE
                          </span>
                          <span style={{ fontSize: '9pt', fontFamily: 'monospace', fontWeight: '800', color: '#0284c7' }}>
                            {applicationId || 'TC-LN-A-00001'}
                          </span>
                          <span style={{ fontSize: '8.5pt', fontFamily: 'monospace', fontWeight: '800', color: '#047857' }}>
                            MCID: {step1.cooperativeId || 'TCID-A-00001'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '6.5pt', fontWeight: '800', color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                              TEMPLATE {currentTemplate.version}
                            </span>
                            <span style={{ fontSize: '6.5pt', color: '#64748b' }}>
                              Date Updated: {currentTemplate.updatedAt}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Document Title Banner */}
                      <div style={{
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        textAlign: 'center',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        marginBottom: '20px'
                      }}>
                        <h1 style={{ fontSize: '13pt', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px 0' }}>
                          {currentTemplate.title}
                        </h1>
                        <p style={{ fontSize: '8pt', color: '#94a3b8', margin: 0 }}>
                          {currentTemplate.subTitle}
                        </p>
                      </div>

                      {/* Section 1: Member-Borrower Information */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
                        <div style={{ backgroundColor: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>I. MEMBER-BORROWER & FACILITY PARTICULARS</span>
                          <span style={{ color: '#047857' }}>Cooperative ID: {step1.cooperativeId || 'TCID-A-00001'}</span>
                        </div>
                        <div style={{ padding: '14px', fontSize: '9pt', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                          <div>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Full Legal Name</span>
                            <strong style={{ color: '#0f172a', fontSize: '10pt' }}>{step1.firstName} {step1.middleName} {step1.lastName} {step1.suffix}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Civil Status & Sex</span>
                            <strong>{step1.civilStatus} / {step1.sex}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Contact & Email</span>
                            <strong>{step2.countryCode} {step2.mobileNumber}</strong>
                            <span style={{ display: 'block', fontSize: '8pt', color: '#64748b' }}>{step2.email || 'borrower@tribute.ph'}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>TGSWS Policy Number</span>
                            <strong style={{ fontFamily: 'monospace', color: '#0284c7' }}>{step1.tgswsPolicyNumber || 'LCAP-001'}</strong>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Permanent Residential Address</span>
                            <strong>{step2.addressLine1}, {step2.barangay}, {step2.city}, {step2.province}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '7.5pt', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Disbursement Channel</span>
                            <strong style={{ color: '#0f172a' }}>{disbursementMode === 'cash' ? 'Over-the-Counter Cash' : `${disbursementChannel} (${disbursementAccountNumber || 'Registered Account'})`}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Financial Terms & Amortization Breakdown */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
                        <div style={{ backgroundColor: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          II. APPROVED CREDIT TERMS & FINANCIAL SCHEDULE
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                              <th style={{ textAlign: 'left', padding: '8px 14px', width: '38%', fontWeight: '800', color: '#334155' }}>FINANCIAL ITEM</th>
                              <th style={{ textAlign: 'left', padding: '8px 14px', width: '37%', fontWeight: '800', color: '#334155' }}>POLICY BASIS & TERMS</th>
                              <th style={{ textAlign: 'right', padding: '8px 14px', width: '25%', fontWeight: '800', color: '#334155' }}>AMOUNT (PHP)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 14px', fontWeight: '700' }}>Approved Principal Loan</td>
                              <td style={{ padding: '8px 14px' }}>{step5.loanProduct} (Term: {step5.termMonths} Months)</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '800' }}>₱ {tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 14px' }}>Add-on Contract Interest</td>
                              <td style={{ padding: '8px 14px' }}>6.00% monthly flat across {step5.termMonths} months</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right' }}>₱ {tributeCalculations.totalInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 14px' }}>Upfront Service & Processing Fee</td>
                              <td style={{ padding: '8px 14px' }}>1.50% monthly rate (Deducted upfront upon release)</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#dc2626' }}>- ₱ {tributeCalculations.serviceCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 14px', fontWeight: '700' }}>Cash Collateral Build-Up (CBU)</td>
                              <td style={{ padding: '8px 14px' }}>5.00% lifetime member equity deposit (min. ₱500 floor &bull; one-time upon release)</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>₱ {tributeCalculations.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style={{ backgroundColor: '#f0fdf4', borderTop: '1.5px solid #86efac', borderBottom: '1px solid #86efac', fontWeight: '800' }}>
                              <td style={{ padding: '10px 14px', color: '#166534' }}>NET CASH PROCEEDS TO BORROWER</td>
                              <td style={{ padding: '10px 14px', color: '#166534' }}>{disbursementMode === 'cash' ? 'Cashier Window Cash' : `Online Transfer via ${disbursementChannel}`}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11pt', color: '#15803d' }}>₱ {tributeCalculations.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                              <td style={{ padding: '10px 14px' }}>SCHEDULED INSTALLMENT DUES</td>
                              <td style={{ padding: '10px 14px' }}>{step5.repaymentFrequency} Collection Mode ({tributeCalculations.numberOfInstallments} payments)</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11pt', color: '#0f172a' }}>₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {step5.repaymentFrequency}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Section 3: Legal Terms & Promissory Undertakings (Loaded from Rich Template) */}
                      <div style={{
                        backgroundColor: '#fafafa',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '16px 20px',
                        fontSize: '8.5pt',
                        lineHeight: '1.6',
                        color: '#334155',
                        marginBottom: '20px',
                        textAlign: 'justify'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                          <span style={{ fontSize: '8pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>
                            III. LEGAL COVENANTS & ENFORCEABLE PROMISSORY TERMS
                          </span>
                          <span style={{ fontSize: '7pt', color: '#64748b', fontWeight: '600' }}>
                            Template Revision: {currentTemplate.version} (Date Updated: {currentTemplate.updatedAt})
                          </span>
                        </div>

                        <strong style={{ color: '#0f172a', display: 'block', margin: '8px 0 4px 0' }}>
                          {currentTemplate.sections.promissoryTitle}:
                        </strong>
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: interpolateContractHtml(currentTemplate.sections.promissoryHtml, contractVars) 
                          }} 
                        />

                        <strong style={{ color: '#0f172a', display: 'block', margin: '12px 0 4px 0' }}>
                          {currentTemplate.sections.defaultTitle}:
                        </strong>
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: interpolateContractHtml(currentTemplate.sections.defaultHtml, contractVars) 
                          }} 
                        />

                        <strong style={{ color: '#0f172a', display: 'block', margin: '12px 0 4px 0' }}>
                          {currentTemplate.sections.privacyTitle}:
                        </strong>
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: interpolateContractHtml(currentTemplate.sections.privacyHtml, contractVars) 
                          }} 
                        />

                        {currentTemplate.sections.additionalClausesHtml && (
                          <>
                            <strong style={{ color: '#0f172a', display: 'block', margin: '12px 0 4px 0' }}>
                              ADDITIONAL COVENANTS & INTAKE AFFIRMATIONS:
                            </strong>
                            <div 
                              dangerouslySetInnerHTML={{ 
                                __html: interpolateContractHtml(currentTemplate.sections.additionalClausesHtml, contractVars) 
                              }} 
                            />
                          </>
                        )}
                      </div>

                      {/* Section 4: Live Biometric Captures & Specimen Signatures */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        marginBottom: '10px'
                      }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                          IV. BIOMETRIC VERIFICATIONS & DIGITAL SIGNATURES ATTESTATION
                        </div>

                        {/* Top: Biometric Photos Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                          {/* Live Face Photo */}
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {applicantFacePhoto ? (
                              <img src={applicantFacePhoto} alt="Live Face Biometric" style={{ width: '70px', height: '70px', borderRadius: '6px', objectFit: 'cover', border: '1.5px solid #16a34a' }} />
                            ) : (
                              <div style={{ width: '70px', height: '70px', borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9pt' }}>No Face Photo</div>
                            )}
                            <div>
                              <span style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>1. LIVE BIOMETRIC FACE CAPTURE</span>
                              <strong style={{ color: '#16a34a', fontSize: '9pt', display: 'block', marginTop: '2px' }}>✓ Biometric Face Attested</strong>
                              <span style={{ fontSize: '7pt', color: '#64748b' }}>Account Officer Live Witnessed</span>
                            </div>
                          </div>

                          {/* Holding ID Photo */}
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {borrowerHoldingIdPhoto ? (
                              <img src={borrowerHoldingIdPhoto} alt="Holding ID Photo" style={{ width: '70px', height: '70px', borderRadius: '6px', objectFit: 'cover', border: '1.5px solid #0284c7' }} />
                            ) : (
                              <div style={{ width: '70px', height: '70px', borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9pt' }}>No ID Photo</div>
                            )}
                            <div>
                              <span style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>2. PHOTO HOLDING GOVERNMENT ID</span>
                              <strong style={{ color: '#0284c7', fontSize: '9pt', display: 'block', marginTop: '2px' }}>✓ Physical Identity Verified</strong>
                              <span style={{ fontSize: '7pt', color: '#64748b' }}>Matched with Gov ID Record</span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Borrower 3 Signatures */}
                        <div style={{ marginBottom: '14px' }}>
                          <span style={{ fontSize: '7.5pt', color: '#475569', fontWeight: '800', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                            BORROWER DIGITAL SIGNATURE SPECIMENS (3 UNIQUE AUTH IDS & TIMESTAMPS):
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {[0, 1, 2].map((idx) => {
                              const sigObj = borrowerSignatures && borrowerSignatures[idx];
                              const fallbackSig = applicantSignature;
                              const sigUrl = sigObj?.signature || (idx === 0 ? fallbackSig : undefined);
                              const authId = sigObj?.authId || (sigUrl ? `AUTH-BRW-00${idx + 1}` : undefined);
                              const timestamp = sigObj?.timestamp || (sigUrl ? new Date().toLocaleString('en-PH') : undefined);

                              return (
                                <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', textAlign: 'center', minHeight: '84px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7pt', fontWeight: '800', color: '#64748b' }}>
                                    <span>Sign #{idx + 1}</span>
                                    <span style={{ color: authId ? '#0284c7' : '#94a3b8', fontFamily: authId ? 'monospace' : 'inherit', fontSize: '6.5pt' }}>
                                      {authId || 'Auth ID unavailable'}
                                    </span>
                                  </div>
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                    {sigUrl ? (
                                      <img src={sigUrl} alt={`Borrower Sig ${idx + 1}`} style={{ maxHeight: '36px', maxWidth: '95%', objectFit: 'contain' }} />
                                    ) : (
                                      <span style={{ fontSize: '7.5pt', color: '#94a3b8', fontStyle: 'italic' }}>Pending Signature</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '6.5pt', color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: '2px' }}>
                                    {timestamp || 'Pending timestamp'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bottom: Officer 3 Signatures */}
                        <div>
                          <span style={{ fontSize: '7.5pt', color: '#475569', fontWeight: '800', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                            ACCOUNT OFFICER WITNESSING SIGNATURES (3 UNIQUE AO AUTH IDS & TIMESTAMPS):
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {[0, 1, 2].map((idx) => {
                              const sigObj = officerSignatures && officerSignatures[idx];
                              const authId = sigObj?.authId;
                              const timestamp = sigObj?.timestamp;

                              return (
                                <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px', textAlign: 'center', minHeight: '84px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7pt', fontWeight: '800', color: '#15803d' }}>
                                    <span>AO Sign #{idx + 1}</span>
                                    <span style={{ color: authId ? '#047857' : '#94a3b8', fontFamily: authId ? 'monospace' : 'inherit', fontSize: '6.5pt' }}>
                                      {authId || 'Auth ID unavailable'}
                                    </span>
                                  </div>
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                                    {sigObj?.signature ? (
                                      <img src={sigObj.signature} alt={`AO Sig ${idx + 1}`} style={{ maxHeight: '36px', maxWidth: '95%', objectFit: 'contain' }} />
                                    ) : (
                                      <span style={{ fontSize: '7.5pt', color: '#94a3b8', fontStyle: 'italic' }}>Pending signature</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '6.5pt', color: '#15803d', borderTop: '1px dashed #bbf7d0', paddingTop: '2px' }}>
                                    {timestamp || 'Pending timestamp'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                  {/* TAB 3: OFFICIAL PASSBOOK BOOKLET & COMPLETE CREDIT LEDGER */}
                  {activeExecutedTab === 'passbook_inside' && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #0f172a',
                      padding: '28px',
                      marginBottom: '28px'
                    }}>
                      <div style={{ marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>
                          OFFICIAL PASSBOOK BOOKLET & CREDIT LEDGER
                        </h2>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                          100% Exact Microfinance Format: <strong>Inside Client & Staff Sheet</strong> + <strong>Loan Info & Cash Build Up Centerfold</strong> + <strong>Amortization Payment Record</strong>
                        </p>
                      </div>

                      <PassbookBooklet
                        data={{
                          borrowerName: `${step1.firstName} ${step1.middleName} ${step1.lastName} ${step1.suffix}`.trim(),
                          cidNumber: step1.tgswsPolicyNumber || 'LCAP-001',
                          loanReference: applicationId || 'TC-LN-A-00001',
                          mcidNumber: step1.cooperativeId || 'TCID-A-00001',
                          spouseName: dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband')) 
                            ? `${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.firstName} ${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.lastName}` 
                            : 'N/A',
                          permanentAddress: `${step2.addressLine1}, ${step2.barangay}, ${step2.city}, ${step2.province}`,
                          membershipDate: new Date().toLocaleDateString('en-PH'),
                          dateIssued: new Date().toLocaleDateString('en-PH'),
                          issuedByName: 'OFFICER JUAN DE LA CRUZ',
                          issuedByDesignation: 'Account Officer (AO-001)',
                          specimenSignature: applicantSignature,
                          specimenSignatures: borrowerSignatures,
                          aoSignatures: officerSignatures,
                          adminSignatures: adminSignatures,
                          adminActionAt: adminActionAt,
                          aoOfficialSignature: officialAo,
                          adminOfficialSignature: officialAdmin,
                          memberFacePhoto: applicantFacePhoto,
                          holdingIdPhoto: borrowerHoldingIdPhoto,
                          dateReleased: new Date().toLocaleDateString('en-PH'),
                          loanType: step5.loanProduct,
                          loanAmount: tributeCalculations.principal,
                          cycle: 1,
                          cbuInitialDeposit: tributeCalculations.cbuAmount,
                          cbuBalance: tributeCalculations.cbuAmount,
                        }}
                        activeView="all"
                      />
                    </div>
                  )}

                  {/* TAB 4: OFFICIAL LOAN PAYMENT LEDGER (BORROWER FIELD COPY) */}
                  {activeExecutedTab === 'payment_ledger' && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #15803d',
                      padding: '28px',
                      marginBottom: '28px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h2 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>
                            OFFICIAL LOAN PAYMENT LEDGER (FIELD VISIT BORROWER COPY)
                          </h2>
                          <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                            Given to the member-borrower for safe keeping &bull; Account Officer signs each visit &bull; No digital status column
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePrintDocument('payment-ledger')}
                          style={{
                            backgroundColor: '#15803d',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(21, 128, 61, 0.25)'
                          }}
                        >
                          <Printer size={14} /> Print Payment Ledger
                        </button>
                      </div>

                      <LoanPaymentLedger
                        data={{
                          borrowerName: `${step1.firstName} ${step1.middleName} ${step1.lastName} ${step1.suffix}`.trim(),
                          cidNumber: step1.tgswsPolicyNumber || 'LCAP-001',
                          loanReference: applicationId || 'TC-LN-A-00001',
                          mcidNumber: step1.cooperativeId || 'TCID-A-00001',
                          spouseName: dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband')) 
                            ? `${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.firstName} ${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.lastName}` 
                            : 'N/A',
                          permanentAddress: `${step2.addressLine1}, ${step2.barangay}, ${step2.city}, ${step2.province}`,
                          membershipDate: new Date().toLocaleDateString('en-PH'),
                          dateIssued: new Date().toLocaleDateString('en-PH'),
                          issuedByName: 'OFFICER JUAN DE LA CRUZ',
                          issuedByDesignation: 'Account Officer (AO-001)',
                          dateReleased: new Date().toLocaleDateString('en-PH'),
                          loanType: step5.loanProduct,
                          loanAmount: tributeCalculations.principal,
                          paymentMode: step5.repaymentFrequency,
                          termMonths: step5.termMonths,
                          cycle: 1,
                          aoSignatures: officerSignatures,
                          adminSignatures: adminSignatures,
                          adminActionAt: adminActionAt,
                          aoOfficialSignature: officialAo,
                          adminOfficialSignature: officialAdmin,
                          cbuInitialDeposit: tributeCalculations.cbuAmount,
                          cbuBalance: tributeCalculations.cbuAmount,
                        }}
                      />
                    </div>
                  )}

                  {/* BORROWER TEMPORARY PORTAL CREDENTIALS CARD */}
                  <div style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px 28px',
                    marginBottom: '28px',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.3)',
                    border: '1.5px solid #334155'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <ShieldCheck size={22} color="#38bdf8" />
                      <h4 style={{ fontSize: '16px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px' }}>
                        Member-Borrower Portal Access Credentials
                      </h4>
                      <span style={{ fontSize: '11px', backgroundColor: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                        Tribute Borrower App
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '18px' }}>
                      Please provide these login credentials to the borrower. They can immediately log in to the Borrower Web/Mobile Portal at <strong>/borrower/login</strong> to monitor upcoming payment dues, make online repayments, view CBU growth, and check ledger balances:
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div style={{ backgroundColor: '#1e293b', padding: '14px 18px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Registered Member Email</span>
                        <p style={{ fontSize: '16px', fontWeight: '800', color: '#38bdf8', marginTop: '4px', fontFamily: 'monospace' }}>
                          {step2.email || `borrower.${step1.lastName.toLowerCase() || 'member'}@tribute.ph`}
                        </p>
                      </div>

                      <div style={{ backgroundColor: '#1e293b', padding: '14px 18px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Temporary Password</span>
                        <p style={{ fontSize: '16px', fontWeight: '800', color: '#4ade80', marginTop: '4px', fontFamily: 'monospace' }}>
                          Pass123
                        </p>
                      </div>

                      <div style={{ backgroundColor: '#1e293b', padding: '14px 18px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Borrower Portal URL</span>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginTop: '4px' }}>
                          http://localhost:3003/borrower/login
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =========================================================================
                    DEDICATED FORMAL OFFICE PRINTABLE BUNDLE (Hidden on screen via CSS, displayed on print)
                   ========================================================================= */}
                <div className="official-print-bundle">
                  {/* PRINT DOCUMENT 1: PROMISSORY NOTE & FACILITY AGREEMENT */}
                  <div className="official-printable-page print-doc-contract page-break-after" style={{ padding: '8px 12px', color: '#0f172a' }}>
                    {/* Executive Header with Modern Corporate Bank Branding */}
                    <div style={{ borderBottom: '2.5px solid #0f172a', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src="/tribute-credit-logo.png"
                            alt="Tribute Credit Cooperative"
                            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                          />
                          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '14px' }}>
                            <h1 style={{ fontSize: '12pt', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              TRIBUTE CREDIT COOPERATIVE
                            </h1>
                            <p style={{ fontSize: '7pt', color: '#047857', margin: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              REGULATED CREDIT & FINANCIAL SERVICES &bull; CDA REG. REF: NCR-COOP-88219
                            </p>
                            <p style={{ fontSize: '6.5pt', color: '#64748b', margin: '1px 0 0 0' }}>
                              Commonwealth Ave., Quezon City, Metro Manila &bull; Tel: (02) 8921-4400 &bull; contact@tribute-grace.org
                            </p>
                          </div>
                        </div>

                        {/* Document Classification Badge */}
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{
                            fontSize: '6.5pt',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '3px',
                            letterSpacing: '0.08em'
                          }}>
                            EXECUTED ORIGINAL NOTE
                          </span>
                          <div style={{ fontSize: '9pt', fontFamily: '"SFMono-Regular", Consolas, monospace', fontWeight: '900', marginTop: '2px', color: '#0284c7' }}>
                            {applicationId || 'TC-LN-A-00001'}
                          </div>
                          <div style={{ fontSize: '7.5pt', fontFamily: 'monospace', fontWeight: '800', color: '#047857' }}>
                            MCID: {step1.cooperativeId || 'TCID-A-00001'}
                          </div>
                        </div>
                      </div>

                      {/* Meta Sub-header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: '8px', paddingTop: '4px', fontSize: '7pt', fontWeight: '700', color: '#334155' }}>
                        <span>MEMBER POLICY: <strong style={{ color: '#0f172a' }}>{step1.tgswsPolicyNumber || 'LCAP-001'}</strong></span>
                        <span>ACCOUNT OFFICER: <strong style={{ color: '#0f172a' }}>Officer Juan (AO-001)</strong></span>
                        <span>EXECUTION DATE: <strong style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
                      </div>
                    </div>

                    {/* Document Title Ribbon */}
                    <div style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'center', padding: '5px 10px', borderRadius: '4px', margin: '8px 0 10px 0' }}>
                      <h2 style={{ fontSize: '10pt', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                        MICROFINANCE PROMISSORY NOTE & CREDIT FACILITY AGREEMENT
                      </h2>
                    </div>

                    {/* Section 1: Member-Borrower Identification */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '4px 10px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        I. MEMBER-BORROWER DEMOGRAPHIC PROFILE
                      </div>
                      <div style={{ padding: '8px 10px', fontSize: '8pt', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Full Legal Name</span>
                          <strong>{step1.firstName} {step1.middleName} {step1.lastName} {step1.suffix}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Civil Status & Sex</span>
                          <strong>{step1.civilStatus} / {step1.sex}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Contact Number</span>
                          <strong>{step2.countryCode} {step2.mobileNumber}</strong>
                        </div>
                      </div>
                      <div style={{ padding: '0 10px 8px 10px', fontSize: '8pt', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Residential Address</span>
                          <strong>{step2.addressLine1}, {step2.barangay}, {step2.city}, {step2.province}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Primary Livelihood</span>
                          <strong>{step4.occupation || 'Microenterprise Member'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '7pt', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Registered Email</span>
                          <span style={{ fontFamily: 'monospace' }}>{step2.email || 'borrower@tribute.ph'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Approved Loan Terms & Financial Breakdown */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '4px 10px', borderBottom: '1px solid #cbd5e1', fontSize: '7.5pt', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        II. APPROVED CREDIT TERMS & FINANCIAL SCHEDULE
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ textAlign: 'left', padding: '5px 10px', width: '38%', fontWeight: '800', color: '#334155' }}>FINANCIAL ITEM</th>
                            <th style={{ textAlign: 'left', padding: '5px 10px', width: '37%', fontWeight: '800', color: '#334155' }}>POLICY BASIS & RATE</th>
                            <th style={{ textAlign: 'right', padding: '5px 10px', width: '25%', fontWeight: '800', color: '#334155' }}>AMOUNT (PHP)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px 10px', fontWeight: '700' }}>Approved Principal Loan</td>
                            <td style={{ padding: '5px 10px' }}>{step5.loanProduct} (Term: {step5.termMonths} Months)</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '800' }}>₱ {tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px 10px' }}>Add-on Contract Interest</td>
                            <td style={{ padding: '5px 10px' }}>6.00% monthly flat across {step5.termMonths} months</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' }}>₱ {tributeCalculations.totalInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px 10px' }}>Upfront Service & Processing Fee</td>
                            <td style={{ padding: '5px 10px' }}>1.50% monthly rate (Deducted upfront upon release)</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', color: '#dc2626' }}>- ₱ {tributeCalculations.serviceCharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px 10px', fontWeight: '700' }}>Cash Collateral Build-Up (CBU)</td>
                            <td style={{ padding: '5px 10px' }}>5.00% lifetime member equity deposit (min. ₱500 floor &bull; one-time upon release)</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>₱ {tributeCalculations.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style={{ backgroundColor: '#f0fdf4', borderTop: '1.5px solid #86efac', borderBottom: '1px solid #86efac', fontWeight: '800' }}>
                            <td style={{ padding: '6px 10px', color: '#166534' }}>NET CASH PROCEEDS TO BORROWER</td>
                            <td style={{ padding: '6px 10px', color: '#166534' }}>{disbursementMode === 'cash' ? 'Cashier Window Cash' : `Online Transfer via ${disbursementChannel}`}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '9.5pt', color: '#15803d' }}>₱ {tributeCalculations.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                            <td style={{ padding: '6px 10px' }}>SCHEDULED INSTALLMENT DUES</td>
                            <td style={{ padding: '6px 10px' }}>{step5.repaymentFrequency} Collection Mode ({tributeCalculations.numberOfInstallments} payments)</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '9.5pt', color: '#0f172a' }}>₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {step5.repaymentFrequency}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Legal Clause Section (Loaded from Template with Date Updated) */}
                    <div style={{ backgroundColor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '7pt', lineHeight: '1.35', textAlign: 'justify', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '4px', fontSize: '6.5pt', fontWeight: '700', color: '#64748b' }}>
                        <span>TERMS & CONDITIONS ({contractTemplateSnapshot?.version || getActiveContractTemplate().version})</span>
                        <span>Date Updated: {contractTemplateSnapshot?.updatedAt || getActiveContractTemplate().updatedAt}</span>
                      </div>
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: interpolateContractHtml(
                            (contractTemplateSnapshot?.sections.promissoryHtml || getActiveContractTemplate().sections.promissoryHtml) + ' ' +
                            (contractTemplateSnapshot?.sections.defaultHtml || getActiveContractTemplate().sections.defaultHtml),
                            {
                              totalScheduledCollections: `₱ ${tributeCalculations.totalScheduledCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                              installmentAmount: `₱ ${tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                              repaymentFrequency: step5.repaymentFrequency,
                              termMonths: step5.termMonths,
                              principal: `₱ ${tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                              borrowerName: `${step1.firstName} ${step1.lastName}`,
                              policyNo: step1.tgswsPolicyNumber || 'LCAP-001'
                            }
                          )
                        }} 
                      />
                    </div>

                    {/* Section 3: Tripartite Attestation, Signatures & Biometrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      {/* Biometric Photos */}
                      <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {applicantFacePhoto ? (
                          <img src={applicantFacePhoto} alt="Biometric Face" style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #16a34a' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
                        )}
                        <div>
                          <strong style={{ fontSize: '7.5pt', color: '#16a34a', display: 'block' }}>✓ LIVE FACE ATTESTED</strong>
                          <span style={{ fontSize: '6.5pt', color: '#64748b' }}>Account Officer Witnessed</span>
                        </div>
                      </div>

                      <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '6px 8px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {borrowerHoldingIdPhoto ? (
                          <img src={borrowerHoldingIdPhoto} alt="Holding ID" style={{ width: '48px', height: '48px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #0284c7' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '4px' }} />
                        )}
                        <div>
                          <strong style={{ fontSize: '7.5pt', color: '#0284c7', display: 'block' }}>✓ HOLDING ID VERIFIED</strong>
                          <span style={{ fontSize: '6.5pt', color: '#64748b' }}>Matched with Gov ID</span>
                        </div>
                      </div>

                      <OfficialSignatureBlock
                        signature={officialAdmin?.signature}
                        authId={officialAdmin?.authId}
                        timestamp={officialAdmin?.timestamp || (adminActionAt ? formatPhDateTime(adminActionAt) : undefined)}
                        signerName={officialAdmin?.signerName || 'Authorized Credit Approver'}
                        roleTitle="Authorized Credit Approver"
                        variant="coop-approval"
                      />
                    </div>

                    {/* Signatures Specimen Grid with Auth IDs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[0, 1, 2].map((idx) => {
                        const sigObj = borrowerSignatures && borrowerSignatures[idx];
                        const fallbackSig = applicantSignature;
                        const sigUrl = sigObj?.signature || (idx === 0 ? fallbackSig : undefined);
                        const authId = sigObj?.authId || (sigUrl ? `AUTH-BRW-00${idx + 1}` : undefined);
                        const timestamp = sigObj?.timestamp || (sigUrl ? new Date().toLocaleString('en-PH') : undefined);

                        return (
                          <div key={idx} style={{ border: '1px solid #cbd5e1', borderRadius: '5px', padding: '4px 6px', backgroundColor: '#ffffff', textAlign: 'center', minHeight: '62px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '6pt', fontWeight: '800', color: '#64748b' }}>
                              <span>Borrower Sign #{idx + 1}</span>
                              <span style={{ color: authId ? '#0284c7' : '#94a3b8', fontFamily: authId ? 'monospace' : 'inherit', fontSize: '5.5pt' }}>
                                {authId || 'Auth ID unavailable'}
                              </span>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {sigUrl ? (
                                <img src={sigUrl} alt={`Borrower Sig ${idx + 1}`} style={{ maxHeight: '28px', maxWidth: '95%', objectFit: 'contain' }} />
                              ) : (
                                <span style={{ fontSize: '6.5pt', color: '#94a3b8', fontStyle: 'italic' }}>Pending Signature</span>
                              )}
                            </div>
                            <div style={{ fontSize: '5.5pt', color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: '1px' }}>
                              {timestamp || 'Pending timestamp'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PRINT DOCUMENT 2: OFFICIAL REPAYMENT AMORTIZATION SCHEDULE */}
                  <div className="official-printable-page print-doc-schedule page-break-after" style={{ padding: '8px 12px', color: '#0f172a' }}>
                    {/* Modern Corporate Bank Amortization Header */}
                    <div style={{ borderBottom: '2.5px solid #0f172a', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <img
                            src="/tribute-credit-logo.png"
                            alt="Tribute Credit Cooperative"
                            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                          />
                          <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '14px' }}>
                            <h1 style={{ fontSize: '12pt', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              TRIBUTE CREDIT COOPERATIVE
                            </h1>
                            <p style={{ fontSize: '7.5pt', fontWeight: '800', color: '#0284c7', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              OFFICIAL REPAYMENT & AMORTIZATION SCHEDULE
                            </p>
                            <p style={{ fontSize: '6.5pt', color: '#64748b', margin: '1px 0 0 0' }}>
                              Regulated Microfinance &bull; CDA Reg. No. NCR-COOP-88219 &bull; Member Statement Copy
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{
                            fontSize: '6.5pt',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '3px',
                            letterSpacing: '0.08em'
                          }}>
                            OFFICIAL SCHEDULE
                          </span>
                          <div style={{ fontSize: '8.5pt', fontFamily: '"SFMono-Regular", Consolas, monospace', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                            REF: {applicationId || 'TC-LN-A-00001'}
                          </div>
                          <div style={{ fontSize: '7.5pt', fontFamily: 'monospace', fontWeight: '800', color: '#047857' }}>
                            MCID: {step1.cooperativeId || 'TCID-A-00001'}
                          </div>
                          <div style={{ fontSize: '7pt', color: '#475569', fontWeight: '600' }}>
                            POLICY: <strong style={{ color: '#0f172a' }}>{step1.tgswsPolicyNumber || 'LCAP-001'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Meta Summary Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', marginTop: '8px', fontSize: '7.5pt' }}>
                        <div><span style={{ color: '#64748b', display: 'block', fontSize: '6.5pt', fontWeight: '700' }}>BORROWER NAME</span><strong style={{ color: '#0f172a' }}>{step1.firstName} {step1.lastName}</strong></div>
                        <div><span style={{ color: '#64748b', display: 'block', fontSize: '6.5pt', fontWeight: '700' }}>LOAN PRINCIPAL</span><strong style={{ color: '#0f172a' }}>₱ {tributeCalculations.principal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                        <div><span style={{ color: '#64748b', display: 'block', fontSize: '6.5pt', fontWeight: '700' }}>INSTALLMENT DUE</span><strong style={{ color: '#16a34a' }}>₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / {step5.repaymentFrequency}</strong></div>
                        <div><span style={{ color: '#64748b', display: 'block', fontSize: '6.5pt', fontWeight: '700' }}>TOTAL COLLECTION</span><strong style={{ color: '#0f172a' }}>₱ {tributeCalculations.totalScheduledCollections.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div>
                      </div>
                    </div>

                    {/* Detailed Installment Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', border: '1px solid #cbd5e1' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                          <th style={{ width: '5%', padding: '5px 4px', textAlign: 'center', color: '#ffffff' }}>#</th>
                          <th style={{ width: '20%', padding: '5px 6px', textAlign: 'left', color: '#ffffff' }}>SCHEDULED DUE</th>
                          <th style={{ width: '18%', padding: '5px 6px', textAlign: 'right', color: '#ffffff' }}>PRINCIPAL</th>
                          <th style={{ width: '18%', padding: '5px 6px', textAlign: 'right', color: '#ffffff' }}>INTEREST (6%)</th>
                          <th style={{ width: '20%', padding: '5px 6px', textAlign: 'right', color: '#ffffff' }}>INSTALLMENT</th>
                          <th style={{ width: '20%', padding: '5px 6px', textAlign: 'right', color: '#ffffff' }}>OUTSTANDING</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const holidaySchedule = generateCollectionScheduleDates(
                            new Date(),
                            Number(step5.termMonths) || 3,
                            step5.repaymentFrequency,
                            tributeCalculations.numberOfInstallments
                          );

                          return Array.from({ length: Math.min(tributeCalculations.numberOfInstallments, 26) }).map((_, idx) => {
                            const instNo = idx + 1;
                            const principalPerInst = tributeCalculations.principal / tributeCalculations.numberOfInstallments;
                            const interestPerInst = tributeCalculations.totalInterest / tributeCalculations.numberOfInstallments;
                            const remaining = Math.max(0, tributeCalculations.totalScheduledCollections - (tributeCalculations.installmentPerFrequency * instNo));

                            const schedItem = holidaySchedule[idx];
                            const dueDateStr = schedItem ? schedItem.shortDateStr : new Date(Date.now() + 86400000 * ((idx + 1) * 7)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

                            return (
                              <tr key={idx} style={{ height: '19px', borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{ textAlign: 'center', fontWeight: '700', borderRight: '1px solid #e2e8f0' }}>{instNo}</td>
                                <td style={{ fontWeight: '600', padding: '2px 6px', borderRight: '1px solid #e2e8f0' }}>
                                  {dueDateStr}
                                  {schedItem?.holidayNote && (
                                    <span style={{ display: 'block', fontSize: '5.5pt', color: '#b45309', fontWeight: '700' }}>
                                      {schedItem.holidayNote}
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', padding: '2px 6px', borderRight: '1px solid #e2e8f0' }}>₱ {principalPerInst.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right', padding: '2px 6px', borderRight: '1px solid #e2e8f0' }}>₱ {interestPerInst.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right', padding: '2px 6px', fontWeight: '800', borderRight: '1px solid #e2e8f0', color: '#0f172a' }}>₱ {tributeCalculations.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right', padding: '2px 6px', fontWeight: '700' }}>₱ {remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>

                    {/* Signatures */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1.5px solid #0f172a', height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                          {applicantSignature ? (
                            <img src={applicantSignature} alt="Borrower Signature" style={{ maxHeight: '28px' }} />
                          ) : (
                            <span style={{ fontSize: '7.5pt' }}>{step1.firstName} {step1.lastName}</span>
                          )}
                        </div>
                        <p style={{ fontSize: '7.5pt', fontWeight: '800', marginTop: '3px', textTransform: 'uppercase' }}>Borrower Conforme & Signature</p>
                      </div>

                      <OfficialSignatureBlock
                        signature={officialAo?.signature}
                        authId={officialAo?.authId}
                        timestamp={officialAo?.timestamp || (officialAo?.signature ? new Date().toLocaleDateString('en-PH') : undefined)}
                        signerName={officialAo?.signerName || 'Officer Juan (AO-001)'}
                        roleTitle="Account Officer / Certified Collector"
                        variant="collector"
                      />
                    </div>
                  </div>

                  {/* PRINT DOCUMENT 3: OFFICIAL PASSBOOK BOOKLET (WITH LOAN PAYMENT RECORD) */}
                  <div className="official-printable-page print-doc-passbook page-break-after" style={{ padding: '0', color: '#0f172a' }}>
                    <PassbookBooklet
                      data={{
                        borrowerName: `${step1.firstName} ${step1.middleName} ${step1.lastName} ${step1.suffix}`.trim(),
                        cidNumber: step1.tgswsPolicyNumber || 'LCAP-001',
                        spouseName: dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband')) 
                          ? `${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.firstName} ${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.lastName}` 
                          : 'N/A',
                        permanentAddress: `${step2.addressLine1}, ${step2.barangay}, ${step2.city}, ${step2.province}`,
                        membershipDate: new Date().toLocaleDateString('en-PH'),
                        dateIssued: new Date().toLocaleDateString('en-PH'),
                        issuedByName: 'OFFICER JUAN DE LA CRUZ',
                        issuedByDesignation: 'Account Officer (AO-001)',
                        specimenSignature: applicantSignature,
                        specimenSignatures: borrowerSignatures,
                        aoSignatures: officerSignatures,
                        adminSignatures: adminSignatures,
                        adminActionAt: adminActionAt,
                        aoOfficialSignature: officialAo,
                        adminOfficialSignature: officialAdmin,
                        memberFacePhoto: applicantFacePhoto,
                        holdingIdPhoto: borrowerHoldingIdPhoto,
                        dateReleased: new Date().toLocaleDateString('en-PH'),
                        loanType: step5.loanProduct,
                        loanAmount: tributeCalculations.principal,
                        loanReference: applicationId || 'TC-LN-A-00001',
                        mcidNumber: step1.cooperativeId || 'TCID-A-00001',
                        cycle: 1,
                        cbuInitialDeposit: tributeCalculations.cbuAmount,
                        cbuBalance: tributeCalculations.cbuAmount,
                      }}
                      activeView="all"
                    />
                  </div>

                  {/* PRINT DOCUMENT 4: STANDALONE OFFICIAL LOAN PAYMENT LEDGER (BORROWER FIELD VISIT COPY) */}
                  <div className="official-printable-page print-doc-payment-ledger print-doc-ledger" style={{ padding: '0', color: '#0f172a' }}>
                    <LoanPaymentLedger
                      data={{
                        borrowerName: `${step1.firstName} ${step1.middleName} ${step1.lastName} ${step1.suffix}`.trim(),
                        cidNumber: step1.tgswsPolicyNumber || 'LCAP-001',
                        spouseName: dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband')) 
                          ? `${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.firstName} ${dependants.find(d => d.relation.toLowerCase().includes('spouse') || d.relation.toLowerCase().includes('husband'))?.lastName}` 
                          : 'N/A',
                        permanentAddress: `${step2.addressLine1}, ${step2.barangay}, ${step2.city}, ${step2.province}`,
                        membershipDate: new Date().toLocaleDateString('en-PH'),
                        dateIssued: new Date().toLocaleDateString('en-PH'),
                        issuedByName: 'OFFICER JUAN DE LA CRUZ',
                        issuedByDesignation: 'Account Officer (AO-001)',
                        dateReleased: new Date().toLocaleDateString('en-PH'),
                        loanType: step5.loanProduct,
                        loanAmount: tributeCalculations.principal,
                        paymentMode: step5.repaymentFrequency,
                        termMonths: step5.termMonths,
                        loanReference: applicationId || 'TC-LN-A-00001',
                        mcidNumber: step1.cooperativeId || 'TCID-A-00001',
                        cycle: 1,
                        aoSignatures: officerSignatures,
                        adminSignatures: adminSignatures,
                        adminActionAt: adminActionAt,
                        aoOfficialSignature: officialAo,
                        adminOfficialSignature: officialAdmin,
                        cbuInitialDeposit: tributeCalculations.cbuAmount,
                        cbuBalance: tributeCalculations.cbuAmount,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Final Action Buttons */}
            {!isContractFinalized && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => setCurrentStep(6)} style={backBtnStyle}>
                  <ChevronLeft size={18} /> Back to Step 6
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (validateStep7()) {
                      setIsContractFinalized(true);
                      setSuccessMsg('🎉 LOAN CONTRACT SUCCESSFULLY EXECUTED! The application has been finalized, biometrics recorded, and queued for fund disbursement.');
                      
                      // Update Credit Assessment store to contract_ready with complete disbursement and borrower portal details
                      try {
                        const currentAppId = (applicationId && /^TC-LN-[A-Z]-\d{5}$/.test(applicationId)) 
                          ? applicationId 
                          : generateNextLoanReference();
                        const borrowerFullName = `${step1.firstName || ''} ${step1.middleName || ''} ${step1.lastName || ''}`.trim() || 'Applicant';
                        const assessments = getCreditAssessments();
                        let matched = assessments.find(a => 
                          (a.applicationId === currentAppId || a.id === `CA-${currentAppId.replace('NBR-', '')}`) ||
                          (step1.tgswsPolicyNumber && step1.tgswsPolicyNumber !== 'LCAP-' && a.policyNo === step1.tgswsPolicyNumber) ||
                          (borrowerFullName && a.borrowerName.toLowerCase() === borrowerFullName.toLowerCase())
                        );

                        const registeredEmail = step2.email || `borrower.${step1.lastName.toLowerCase() || 'member'}@tribute.ph`;

                        const assessmentPayload = {
                          id: matched?.id || `CA-${currentAppId.replace('NBR-', '')}`,
                          applicationId: matched?.applicationId || currentAppId,
                          borrowerName: borrowerFullName,
                          policyNo: step1.tgswsPolicyNumber || matched?.policyNo || 'LCAP-',
                          contactNumber: `${step2.countryCode || '+63'} ${step2.mobileNumber || ''}`,
                          location: `${step2.barangay || ''}, ${step2.city || ''}, ${step2.province || ''}`,
                          livelihood: step4.occupation || 'Self-Employed Micro-Enterprise',
                          yearsInBusiness: Number(step4.yearsInLivelihood) || 3,
                          monthlyNetIncome: Number(step4.monthlyNetIncome) || 20000,
                          existingDebts: totals.totalMonthlyDebtDues || 0,
                          netDisposableIncome: totals.netDisposableMonthlyIncome || 15000,
                          requestedAmount: Number(step5.requestedAmount) || 10000,
                          productName: step5.loanProduct || 'Regular Loan',
                          termMonths: Number(step5.termMonths) || 3,
                          paymentMode: step5.repaymentFrequency,
                          aiPreApprovedAmount: matched?.aiPreApprovedAmount || Number(step5.requestedAmount) || 10000,
                          aiRiskRating: matched?.aiRiskRating || 'Class A (Prime / Low Risk)',
                          aiDsr: matched?.aiDsr || 30,
                          aiConfidenceScore: 94.2,
                          aiRecommendationNote: matched?.aiRecommendationNote || 'Evaluated during intake interview.',
                          fiveCs: matched?.fiveCs || {
                            characterScore: 18,
                            characterNotes: `Barangay residency verified. Policy no: ${step1.tgswsPolicyNumber}`,
                            capacityScore: 21,
                            capacityNotes: 'Verified repayment capacity.',
                            capitalScore: 16,
                            capitalNotes: 'Member capital declared.',
                            collateralScore: 14,
                            collateralNotes: 'Collateral & personal guarantee verified.',
                            conditionsScore: 13,
                            conditionsNotes: 'Prime microfinance operating condition.',
                            totalScore: 82,
                            riskGrade: 'Class A (Prime / Low Risk)' as const,
                          },
                          officerAdjustedAmount: officerAdjustedAmount || tributeCalculations.principal,
                          officerRecommendation: 'recommend_approve' as const,
                          officerNotes: officerAdjustmentNote || officerAssessmentNotes || 'Verified during live applicant intake interview.',
                          evaluatedByOfficer: 'Officer Juan (AO-001)',
                          evaluatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
                          status: 'contract_ready' as const,
                          adminApprovedAmount: adminApprovedAmount || tributeCalculations.principal,
                          finalContractAmount: tributeCalculations.principal,
                          contractExecutedAt: new Date().toISOString(),
                          contractTemplateSnapshot: contractTemplateSnapshot || getActiveContractTemplate(),
                          applicantSignature,
                          borrowerSignatures,
                          officerSignatures,
                          adminSignatures: adminSignatures.length > 0 ? adminSignatures : matched?.adminSignatures,
                          adminActionAt: adminActionAt || matched?.adminActionAt,
                          applicantFacePhoto,
                          borrowerHoldingIdPhoto,
                          borrowerEmail: registeredEmail,
                          tempPassword: 'Pass123',
                          disbursementMode,
                          disbursementChannel,
                          disbursementAccountNumber: disbursementAccountNumber || 'Over-the-Counter Cashier',
                          firstDueDate: (() => {
                            const sched = generateCollectionScheduleDates(new Date(), Number(step5.termMonths) || 3, step5.repaymentFrequency, 1);
                            return sched[0] ? sched[0].dueDate.toISOString().split('T')[0] : new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
                          })(),
                          nextDueDate: (() => {
                            const sched = generateCollectionScheduleDates(new Date(), Number(step5.termMonths) || 3, step5.repaymentFrequency, 1);
                            return sched[0] ? sched[0].dueDate.toISOString().split('T')[0] : new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
                          })(),
                          totalCollected: 0,
                          remainingBalance: tributeCalculations.totalScheduledCollections,
                          mcid: step1.cooperativeId || 'TCID-A-00001',
                          cidNumber: step1.cooperativeId || 'TCID-A-00001',
                          fullProfile: {
                            step1,
                            step2,
                            govIds,
                            dependants,
                            step4,
                            assets,
                            otherIncomes,
                            liabilities,
                            step5,
                            attachments,
                          },
                        };

                        if (matched) {
                          updateAssessmentStatus(matched.id, 'contract_ready', assessmentPayload);
                        } else {
                          saveCreditAssessment(assessmentPayload);
                        }

                        // Also sync directly to server API
                        try {
                          fetch('/api/assessments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(assessmentPayload),
                          }).catch(() => {});
                        } catch (e) {}

                        // Remove draft from localStorage so on reload this borrower does not stay in onboarding wizard
                        localStorage.removeItem('tribute_new_borrower_draft');
                      } catch (e) {
                        console.error('Error updating contract status:', e);
                      }

                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  style={{
                    ...primaryBtnStyle,
                    backgroundColor: '#10b981',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                    fontSize: '15px',
                    padding: '14px 32px'
                  }}
                >
                  Finalize & Execute Loan Contract <CheckCircle size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Bottom App Navigation on mobile */}
      <OfficerMobileNav onOpenSidebar={() => setMobileMenuOpen(true)} />

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Styling Constants
const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  border: '1px solid #dcece0',
  boxShadow: '0 2px 10px rgba(20, 83, 45, 0.05)',
  padding: '28px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '13.5px',
  fontWeight: '700',
  color: '#0f291a',
  display: 'block',
  marginBottom: '6px',
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '700',
  color: '#334e3e',
  display: 'block',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '44px',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid #dcece0',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f291a',
  fontFamily: 'inherit',
};

const inputSmallStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid #dcece0',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f291a',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#15803d',
  color: '#ffffff',
  border: 'none',
  minHeight: '44px',
  padding: '12px 24px',
  borderRadius: '12px',
  fontWeight: '800',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  boxShadow: '0 3px 12px rgba(21, 128, 61, 0.25)',
};

const secondaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  border: 'none',
  minHeight: '40px',
  padding: '8px 14px',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12.5px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  cursor: 'pointer',
};

const backBtnStyle: React.CSSProperties = {
  backgroundColor: '#f6fbf7',
  color: '#334e3e',
  border: '1px solid #dcece0',
  minHeight: '44px',
  padding: '12px 22px',
  borderRadius: '12px',
  fontWeight: '700',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
};

const deleteBtnStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  minHeight: '38px',
  padding: '8px 10px',
  borderRadius: '10px',
  cursor: 'pointer',
};

const emptyBoxStyle: React.CSSProperties = {
  padding: '24px',
  textAlign: 'center',
  color: '#526b5c',
  fontSize: '13px',
  backgroundColor: '#f6fbf7',
  borderRadius: '14px',
  border: '1px dashed #bbf7d0',
};

const gridItemCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  padding: '18px',
  border: '1px solid #dcece0',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto',
  gap: '14px',
  alignItems: 'center',
};

const formRepeaterCardStyle: React.CSSProperties = {
  backgroundColor: '#f6fbf7',
  borderRadius: '14px',
  padding: '16px',
  border: '1px solid #dcece0',
};

const calcCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '16px',
  borderRadius: '14px',
  border: '1px solid #dcece0',
};

const calcCardSub: React.CSSProperties = {
  fontSize: '11px',
  color: '#526b5c',
  fontWeight: '700',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '4px',
};

const calcCardVal: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '800',
  margin: '0',
};
