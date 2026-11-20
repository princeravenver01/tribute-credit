import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import {
  reconcileBorrowerMemberships,
  DatabasePersistenceError,
} from '@/lib/coop-member-store';

export async function POST() {
  const auth = await requireApiRole('admin', 'account_officer');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const summary = await reconcileBorrowerMemberships({
      recordedById: auth.session.userId || null,
      recordedByName: auth.session.name || 'Staff Reconciler',
      recordedByRole: auth.session.role as 'admin' | 'account_officer',
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    if (err instanceof DatabasePersistenceError) {
      return NextResponse.json({ error: err.message, code: 'DATABASE_ERROR' }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : 'Failed to reconcile borrower memberships';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
