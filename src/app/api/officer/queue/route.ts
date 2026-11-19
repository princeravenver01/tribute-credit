import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireApiRole } from '@/lib/server-auth';

export async function GET() {
  const auth = await requireApiRole('account_officer');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const queue = await query(`
      SELECT 
        l.id, l.loan_code, l.amount_requested, l.term_months, l.interest_rate,
        l.status, l.purpose, l.application_date,
        u.name as borrower_name, u.email as borrower_email, u.contact_number
      FROM loan_applications l
      JOIN users u ON l.borrower_id = u.id
      ORDER BY l.created_at DESC
    `);

    return NextResponse.json({ queue });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch officer queue', details: error.message }, { status: 500 });
  }
}
