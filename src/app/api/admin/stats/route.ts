import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireApiRole } from '@/lib/server-auth';

export async function GET() {
  const auth = await requireApiRole('admin');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [totalLoans]: any = await query('SELECT COUNT(*) as count, COALESCE(SUM(amount_requested), 0) as totalVolume FROM loan_applications');
    const [activeBorrowers]: any = await query("SELECT COUNT(*) as count FROM users WHERE role = 'borrower' AND status = 'active'");
    const [pendingApprovals]: any = await query("SELECT COUNT(*) as count FROM loan_applications WHERE status = 'pending'");
    const [totalDisbursed]: any = await query("SELECT COALESCE(SUM(amount_requested), 0) as disbursedTotal FROM loan_applications WHERE status = 'disbursed'");

    return NextResponse.json({
      metrics: {
        totalLoans: totalLoans.count,
        totalVolume: totalLoans.totalVolume,
        activeBorrowers: activeBorrowers.count,
        pendingApprovals: pendingApprovals.count,
        totalDisbursed: totalDisbursed.disbursedTotal,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch admin stats', details: error.message }, { status: 500 });
  }
}
