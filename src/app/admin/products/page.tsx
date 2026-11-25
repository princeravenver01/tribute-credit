'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { 
  Layers, 
  Plus, 
  Calculator, 
  CheckCircle, 
  Edit2, 
  X, 
  RefreshCw,
  Coins,
  Percent,
  Calendar
} from 'lucide-react';
import { 
  listProducts, 
  saveProduct, 
  type DynamicLoanProduct 
} from '@/lib/product-store';
import { calculateTributeLoan } from '@/lib/tribute-loan-engine';
import theme from '@/components/admin/AdminTheme.module.css';
import styles from './products.module.css';

export default function AdminProductsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState<DynamicLoanProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedProduct, setSelectedProduct] = useState<DynamicLoanProduct | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialMin, setInitialMin] = useState(1000);
  const [initialMax, setInitialMax] = useState(20000);
  const [increment, setIncrement] = useState(5000);
  const [absoluteMax, setAbsoluteMax] = useState(50000);
  const [minTerm, setMinTerm] = useState(2);
  const [maxTerm, setMaxTerm] = useState(6);
  const [interestPct, setInterestPct] = useState(6.0);
  const [serviceChargePct, setServiceChargePct] = useState(0.15);
  const [cbuPct, setCbuPct] = useState(5.0);
  const [cbuMin, setCbuMin] = useState(500);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live Loan Calculation Test Bench
  const [testProduct, setTestProduct] = useState('Regular Loan');
  const [testPrincipal, setTestPrincipal] = useState(15000);
  const [testTerm, setTestTerm] = useState(3);
  const [testFrequency, setTestFrequency] = useState<'Weekly' | 'Monthly' | 'Daily' | 'Semi-Monthly'>('Weekly');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/admin/products')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch((e) => {
        console.error('Failed to load products:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status === 'active').length;
    const maxFac = Math.max(0, ...products.map((p) => p.absoluteMax));
    const maxTermMonths = Math.max(0, ...products.map((p) => p.maxTerm));
    return { total, active, maxFac, maxTermMonths };
  }, [products]);

  // Live Calculator Bench Execution
  const calcResult = useMemo(() => {
    return calculateTributeLoan(testPrincipal, testTerm, testProduct, testFrequency);
  }, [testPrincipal, testTerm, testProduct, testFrequency]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedProduct(null);
    setName('');
    setDescription('');
    setInitialMin(1000);
    setInitialMax(25000);
    setIncrement(5000);
    setAbsoluteMax(50000);
    setMinTerm(2);
    setMaxTerm(6);
    setInterestPct(6.0);
    setServiceChargePct(1.5);
    setCbuPct(5.0);
    setCbuMin(500);
    setStatus('active');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: DynamicLoanProduct) => {
    setModalMode('edit');
    setSelectedProduct(prod);
    setName(prod.name);
    setDescription(prod.description || '');
    setInitialMin(prod.initialMin);
    setInitialMax(prod.initialMax);
    setIncrement(prod.increment);
    setAbsoluteMax(prod.absoluteMax);
    setMinTerm(prod.minTerm);
    setMaxTerm(prod.maxTerm);
    setInterestPct(prod.monthlyInterestRate * 100);
    setServiceChargePct(prod.monthlyServiceChargeRate * 100);
    setCbuPct(prod.cbuRate * 100);
    setCbuMin(prod.cbuMinimum);
    setStatus(prod.status);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const payload: DynamicLoanProduct = {
      id: selectedProduct?.id,
      name,
      description,
      initialMin: Number(initialMin),
      initialMax: Number(initialMax),
      increment: Number(increment),
      absoluteMax: Number(absoluteMax),
      minTerm: Number(minTerm),
      maxTerm: Number(maxTerm),
      monthlyInterestRate: Number(interestPct) / 100,
      monthlyServiceChargeRate: Number(serviceChargePct) / 100,
      cbuRate: Number(cbuPct) / 100,
      cbuMinimum: Number(cbuMin),
      status,
    };

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to save product');
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      await fetchProducts();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
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
          badgeLabel="Financial Configuration Console"
          pageTitle="Loan Products & Financial Engine"
          pageSubtitle="Configure loan packages, interest schedules, service charge deductions, and CBU equity parameters."
          onOpenMobileSidebar={() => setMobileMenuOpen((prev) => !prev)}
          actions={
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={openCreateModal}
                className={styles.createBtn}
              >
                <Plus size={15} /> Add Loan Product
              </button>
            </div>
          }
        />

        <div className={styles.productsWrap} style={{ marginTop: '20px' }}>
          {/* KPI Summary Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total Products</span>
              <span className={styles.kpiValue}>{kpis.total}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Active Offerings</span>
              <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{kpis.active}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Max Loan Capacity</span>
              <span className={styles.kpiValue}>₱ {kpis.maxFac.toLocaleString('en-PH')}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Max Repayment Term</span>
              <span className={styles.kpiValue}>{kpis.maxTermMonths} Months</span>
            </div>
          </div>

          {/* LIVE LOAN CALCULATION TEST BENCH */}
          <div className={styles.benchCard}>
            <div className={styles.benchHeader}>
              <div>
                <h3 className={styles.benchTitle}>Live Loan Calculation &amp; Engine Test Bench</h3>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Simulate principal disbursements, monthly amortizations, upfront deductions, and net proceeds under real engine rules.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className={styles.kpiLabel}>Selected Product</label>
                <select
                  value={testProduct}
                  onChange={(e) => setTestProduct(e.target.value)}
                  className={styles.formInput}
                  style={{ width: '100%' }}
                >
                  {products.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={styles.kpiLabel}>Simulated Principal (₱)</label>
                <input
                  type="number"
                  step="1000"
                  value={testPrincipal}
                  onChange={(e) => setTestPrincipal(Number(e.target.value))}
                  className={styles.formInput}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className={styles.kpiLabel}>Tenure / Term</label>
                <select
                  value={testTerm}
                  onChange={(e) => setTestTerm(Number(e.target.value))}
                  className={styles.formInput}
                  style={{ width: '100%' }}
                >
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                  <option value={4}>4 Months</option>
                  <option value={5}>5 Months</option>
                  <option value={6}>6 Months</option>
                </select>
              </div>

              <div>
                <label className={styles.kpiLabel}>Repayment Mode</label>
                <select
                  value={testFrequency}
                  onChange={(e) => setTestFrequency(e.target.value as any)}
                  className={styles.formInput}
                  style={{ width: '100%' }}
                >
                  <option value="Weekly">Weekly</option>
                  <option value="Daily">Daily</option>
                  <option value="Semi-Monthly">Semi-Monthly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className={styles.benchGrid}>
              <div className={styles.benchResultBox}>
                <span className={styles.benchResultLabel}>Net Cash Proceeds</span>
                <span className={styles.benchResultValue}>₱ {calcResult.netCashProceeds.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>After CBU &amp; Upfront Service Fee</span>
              </div>
              <div className={styles.benchResultBox}>
                <span className={styles.benchResultLabel}>Scheduled Installment</span>
                <span className={styles.benchResultValue}>₱ {calcResult.installmentPerFrequency.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Per {calcResult.frequency} ({calcResult.numberOfInstallments} payments)</span>
              </div>
              <div className={styles.benchResultBox}>
                <span className={styles.benchResultLabel}>Total Interest (6%/mo)</span>
                <span className={styles.benchResultValue}>₱ {calcResult.totalInterest.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Flat amortized interest</span>
              </div>
              <div className={styles.benchResultBox}>
                <span className={styles.benchResultLabel}>CBU Equity (5% floor)</span>
                <span className={styles.benchResultValue}>₱ {calcResult.cbuAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Member lifetime capital equity</span>
              </div>
            </div>
          </div>

          {/* Products Directory Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeaderRow}>
              <div>
                <h3 className={styles.tableTitle}>Master Loan Product Catalog</h3>
                <p className={styles.tableSubtitle}>Active financial rules and parameters governing new loan applications</p>
              </div>
              <button
                type="button"
                onClick={fetchProducts}
                className={styles.actionBtnEdit}
                title="Reload products"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.prodTable}>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Initial Min / Max</th>
                    <th>Absolute Cap</th>
                    <th>Allowed Terms</th>
                    <th>Monthly Interest Rate</th>
                    <th>Upfront Service Fee</th>
                    <th>CBU Rate / Floor</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        {loading ? 'Loading loan product catalog...' : 'No loan products recorded.'}
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.name}>
                        <td style={{ fontWeight: '800', color: '#0F172A' }}>
                          {p.name}
                          {p.description && (
                            <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b', fontWeight: 'normal' }}>
                              {p.description}
                            </span>
                          )}
                        </td>
                        <td>₱ {p.initialMin.toLocaleString()} - ₱ {p.initialMax.toLocaleString()}</td>
                        <td style={{ fontWeight: '700', color: '#B91C1C' }}>₱ {p.absoluteMax.toLocaleString()}</td>
                        <td>{p.minTerm} - {p.maxTerm} Months</td>
                        <td>{(p.monthlyInterestRate * 100).toFixed(1)}% / mo</td>
                        <td>{(p.monthlyServiceChargeRate * 100).toFixed(2)}% / mo</td>
                        <td>{(p.cbuRate * 100).toFixed(0)}% (min. ₱{p.cbuMinimum})</td>
                        <td>
                          {p.status === 'active' ? (
                            <span className={styles.statusActive}>● Active</span>
                          ) : (
                            <span className={styles.statusInactive}>○ Inactive</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className={styles.actionBtnEdit}
                          >
                            <Edit2 size={12} /> Edit Rules
                          </button>
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
                {modalMode === 'create' ? 'Create Loan Product Offering' : `Edit Product: ${name}`}
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
                  <label className={styles.formLabel}>Product Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Agricultural Crop Loan"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description for Account Officers and Borrowers"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Initial Min (₱)</label>
                    <input
                      type="number"
                      required
                      value={initialMin}
                      onChange={(e) => setInitialMin(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Initial Max (₱)</label>
                    <input
                      type="number"
                      required
                      value={initialMax}
                      onChange={(e) => setInitialMax(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Increment Step (₱)</label>
                    <input
                      type="number"
                      required
                      value={increment}
                      onChange={(e) => setIncrement(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Absolute Renewal Cap (₱)</label>
                    <input
                      type="number"
                      required
                      value={absoluteMax}
                      onChange={(e) => setAbsoluteMax(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Min Term (Months)</label>
                    <input
                      type="number"
                      required
                      value={minTerm}
                      onChange={(e) => setMinTerm(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Max Term (Months)</label>
                    <input
                      type="number"
                      required
                      value={maxTerm}
                      onChange={(e) => setMaxTerm(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Monthly Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={interestPct}
                      onChange={(e) => setInterestPct(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Upfront Service Fee (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={serviceChargePct}
                      onChange={(e) => setServiceChargePct(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>CBU Rate (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={cbuPct}
                      onChange={(e) => setCbuPct(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>CBU Floor (₱)</label>
                    <input
                      type="number"
                      required
                      value={cbuMin}
                      onChange={(e) => setCbuMin(Number(e.target.value))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className={styles.formInput}
                  >
                    <option value="active">Active Offering</option>
                    <option value="inactive">Inactive / Retired</option>
                  </select>
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
                  {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Product' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
