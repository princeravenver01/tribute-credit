import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import {
  recordMembershipPayment,
  DatabasePersistenceError,
  type MemberPaymentInput,
} from '@/lib/coop-member-store';

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer', 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { memberNo, component, amount, paymentMethod, paymentReference } = body;

    if (!memberNo || !component || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'memberNo, valid component, and positive amount are required.' },
        { status: 400 }
      );
    }

    const input: MemberPaymentInput = {
      memberNo,
      component,
      amount,
      paymentMethod: paymentMethod || 'cash',
      paymentReference,
      recordedByName: auth.session.name || 'Cooperative Officer',
      recordedByRole: auth.session.role as 'admin' | 'account_officer',
    };

    const result = await recordMembershipPayment(input);
    return NextResponse.json({
      success: true,
      member: result.member,
      remainingBalances: result.remainingBalances,
    });
  } catch (err: unknown) {
    if (err instanceof DatabasePersistenceError) {
      return NextResponse.json({ error: err.message, code: 'DATABASE_ERROR' }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : 'Failed to record membership payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
