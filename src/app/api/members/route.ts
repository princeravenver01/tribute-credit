import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import {
  listCooperativeMembers,
  registerCooperativeMember,
  validateEvidenceDataUrl,
  DuplicateMemberError,
  DatabasePersistenceError,
  type RegisterMemberInput,
} from '@/lib/coop-member-store';

export async function GET(req: Request) {
  // Cooperative Member Registry is restricted to Admin and Account Officer
  const auth = await requireApiRole('admin', 'account_officer');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const typeParam = url.searchParams.get('type') as 'full_cooperative' | 'borrower_only' | null;
    const members = await listCooperativeMembers(search, typeParam || undefined);
    return NextResponse.json({ success: true, members });
  } catch (err: unknown) {
    if (err instanceof DatabasePersistenceError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : 'Failed to retrieve cooperative members';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Member Registration is restricted to Admin and Account Officer
  const auth = await requireApiRole('admin', 'account_officer');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    // 1. Authoritative Server-side validation of 3 evidence data URLs
    validateEvidenceDataUrl(body.signatureData, 'Member digital signature');
    validateEvidenceDataUrl(body.photoUrl, 'Member profile photo');
    validateEvidenceDataUrl(body.idSelfieUrl, 'Member selfie holding valid ID');

    // 2. Map registrar information from authenticated session
    const input: RegisterMemberInput = {
      ...body,
      registeredById: typeof auth.session.userId === 'number' ? auth.session.userId : undefined,
      registeredByName: auth.session.name || 'Cooperative Registrar',
      registeredByRole: auth.session.role as 'admin' | 'account_officer',
    };

    const member = await registerCooperativeMember(input);
    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof DuplicateMemberError) {
      return NextResponse.json({ error: err.message, code: 'DUPLICATE_MEMBER' }, { status: 409 });
    }

    if (err instanceof DatabasePersistenceError) {
      return NextResponse.json({ error: err.message, code: 'DATABASE_ERROR' }, { status: 500 });
    }

    const message = err instanceof Error ? err.message : 'Failed to register cooperative member';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
