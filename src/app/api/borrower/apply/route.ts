import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireApiRole } from '@/lib/server-auth';

export async function POST(req: Request) {
  const auth = await requireApiRole('borrower');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const { productId, amountRequested, termMonths, purpose } = body;

    if (!productId || !amountRequested || !termMonths) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const products: any = await query('SELECT interest_rate FROM loan_products WHERE id = ?', [productId]);
    const rate = products.length > 0 ? products[0].interest_rate : 1.5;

    const loanCode = `LN-${Date.now().toString().slice(-6)}`;
    const monthlyRate = (rate / 100) / 12;
    const factor = Math.pow(1 + monthlyRate, termMonths);
    const monthlyAmortization = ((amountRequested * monthlyRate * factor) / (factor - 1)).toFixed(2);

    await query(
      `INSERT INTO loan_applications 
       (loan_code, borrower_id, product_id, amount_requested, term_months, interest_rate, purpose, monthly_amortization, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [loanCode, auth.session.userId, productId, amountRequested, termMonths, rate, purpose, monthlyAmortization]
    );

    return NextResponse.json({ success: true, loanCode });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to submit loan application', details: error.message }, { status: 500 });
  }
}
