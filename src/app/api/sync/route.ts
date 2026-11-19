import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireApiRole } from '@/lib/server-auth';

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { applications = [], collections = [] } = await req.json();

    const syncedApplications: string[] = [];
    const failedApplications: { localId: string; error: string }[] = [];

    const syncedCollections: string[] = [];
    const failedCollections: { localId: string; error: string }[] = [];

    // 1. Process Offline Loan Applications
    for (const app of applications) {
      try {
        // Prevent duplicate sync using unique reference/code
        const existing: any = await query(
          'SELECT id FROM loan_applications WHERE loan_code = ? LIMIT 1',
          [app.localId]
        );

        if (existing.length === 0) {
          const products: any = await query(
            'SELECT interest_rate FROM loan_products WHERE id = ?',
            [app.productId]
          );
          const rate = products.length > 0 ? products[0].interest_rate : 1.5;
          const monthlyRate = (rate / 100) / 12;
          const factor = Math.pow(1 + monthlyRate, app.termMonths);
          const monthlyAmortization = ((app.amountRequested * monthlyRate * factor) / (factor - 1)).toFixed(2);

          await query(
            `INSERT INTO loan_applications 
             (loan_code, borrower_id, product_id, amount_requested, term_months, interest_rate, purpose, monthly_amortization, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [app.localId, app.borrowerId, app.productId, app.amountRequested, app.termMonths, rate, app.purpose, monthlyAmortization, app.createdAt || new Date()]
          );
        }
        syncedApplications.push(app.localId);
      } catch (err: any) {
        failedApplications.push({ localId: app.localId, error: err.message });
      }
    }

    // 2. Process Offline Repayment Collections
    for (const col of collections) {
      try {
        const existing: any = await query(
          'SELECT id FROM payments WHERE reference_no = ? LIMIT 1',
          [col.referenceNo || col.localId]
        );

        if (existing.length === 0) {
          await query(
            `INSERT INTO payments 
             (reference_no, loan_id, borrower_id, recorded_by_id, amount, payment_method, payment_date, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              col.referenceNo || col.localId,
              col.loanId,
              col.borrowerId,
              col.officerId,
              col.amount,
              col.paymentMethod,
              col.paymentDate,
              col.notes || 'Recorded in offline mode',
              col.createdAt || new Date(),
            ]
          );

          // Update latest amortization schedule installment if applicable
          await query(
            `UPDATE repayment_schedules 
             SET amount_paid = amount_paid + ?, 
                 status = CASE WHEN (amount_paid + ?) >= total_due THEN 'paid' ELSE 'partially_paid' END,
                 paid_at = NOW()
             WHERE loan_id = ? AND status != 'paid'
             ORDER BY installment_no ASC LIMIT 1`,
            [col.amount, col.amount, col.loanId]
          );
        }
        syncedCollections.push(col.localId);
      } catch (err: any) {
        failedCollections.push({ localId: col.localId, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      syncedApplications,
      failedApplications,
      syncedCollections,
      failedCollections,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Batch sync error:', error);
    return NextResponse.json({ error: 'Sync server error', details: error.message }, { status: 500 });
  }
}
