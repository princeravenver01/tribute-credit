import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import {
  recordMembershipPayment,
  DatabasePersistenceError,
  PaymentConflictError,
  type MemberPaymentInput,
} from '@/lib/coop-member-store';

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer', 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { memberNo, component, amount, paymentMethod, paymentReference, idempotencyKey } = body;

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (!memberNo || !component || typeof parsedAmount !== 'number' || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid memberNo, component, and positive finite decimal amount are required.' },
        { status: 400 }
      );
    }

    const validComponents = ['registration_fee', 'capital_share', 'savings_deposit', 'all'];
    if (!validComponents.includes(component)) {
      return NextResponse.json(
        { error: `Invalid component "${component}". Must be one of: ${validComponents.join(', ')}` },
        { status: 400 }
      );
    }

    const validMethods = ['cash', 'online', 'bank_transfer'];
    const method = paymentMethod || 'cash';
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid paymentMethod "${method}". Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    const ref = (paymentReference?.trim() || idempotencyKey?.trim() || `REC-${Date.now().toString().slice(-6)}`);

    const input: MemberPaymentInput = {
      memberNo: String(memberNo).trim(),
      component,
      amount: parsedAmount,
      paymentMethod: method,
      paymentReference: ref,
      recordedById: auth.session.userId || null,
      recordedByName: auth.session.name || 'Cooperative Officer',
      recordedByRole: auth.session.role as 'admin' | 'account_officer',
      auditId: `AUD-PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const result = await recordMembershipPayment(input);
    return NextResponse.json({
      success: true,
      member: result.member,
      remainingBalances: result.remainingBalances,
      audit: result.audit,
    });
  } catch (err: unknown) {
    if (err instanceof PaymentConflictError) {
      return NextResponse.json({ error: err.message, code: 'PAYMENT_CONFLICT' }, { status: 409 });
    }
    if (err instanceof DatabasePersistenceError) {
      return NextResponse.json({ error: err.message, code: 'DATABASE_ERROR' }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : 'Failed to record membership payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
