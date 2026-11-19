import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwtToken } from '@/lib/auth';
import { listUsers, createUser, updateUser, type UserRole, type UserStatus } from '@/lib/user-store';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('coop_auth_token')?.value;
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized: No session token' };
  }
  const payload = verifyJwtToken(token);
  if (!payload || payload.role !== 'admin') {
    return { ok: false, status: 403, error: 'Forbidden: Admin access required' };
  }
  return { ok: true, admin: payload };
}

export async function GET() {
  const auth = await checkAdminAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const users = await listUsers();
  return NextResponse.json({ success: true, users });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { action, id, name, email, role, password, contact_number, member_no, address, status } = body;

    if (action === 'toggle_status') {
      if (!id || !status) {
        return NextResponse.json({ error: 'User ID and target status are required' }, { status: 400 });
      }
      const res = await updateUser(Number(id), { status: status as UserStatus });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, user: res.user });
    }

    if (action === 'update') {
      if (!id) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }
      const res = await updateUser(Number(id), {
        name,
        contact_number,
        address,
        role: role as UserRole,
        member_no,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, user: res.user });
    }

    // Default: create user
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
    }

    const res = await createUser({
      name,
      email,
      role: role as UserRole,
      password,
      contact_number,
      member_no,
      address,
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: res.user }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
