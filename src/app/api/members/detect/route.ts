import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import { findMatchingCooperativeMember } from '@/lib/coop-member-store';

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer', 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { memberNo, email, contactNumber, dateOfBirth } = body;

    const matched = await findMatchingCooperativeMember({
      memberNo,
      email,
      contactNumber,
      dateOfBirth,
    });

    if (matched) {
      return NextResponse.json({
        success: true,
        matched: true,
        member: matched,
      });
    }

    return NextResponse.json({
      success: true,
      matched: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to detect member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
