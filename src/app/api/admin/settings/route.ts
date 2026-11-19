import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireApiRole } from '@/lib/server-auth';
import { getCoopSettings, saveCoopSettings, type CoopSettings } from '@/lib/settings-store';
import { query } from '@/lib/db';

export async function GET() {
  const auth = await requireApiRole('admin');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getCoopSettings();
  return NextResponse.json({ success: true, settings });
}

export async function POST(req: Request) {
  const auth = await requireApiRole('admin');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    // Check if this is a password change request
    if (body.action === 'change_password') {
      const { currentPassword, newPassword, confirmPassword } = body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return NextResponse.json({ error: 'All password fields are required' }, { status: 400 });
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: 'New password and confirmation do not match' }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters long' }, { status: 400 });
      }

      let rows: Array<{ password?: string }>;
      try {
        rows = await query<Array<{ password?: string }>>(
          'SELECT password FROM users WHERE id = ? AND role = ? LIMIT 1',
          [auth.session.userId, 'admin'],
        );
      } catch {
        return NextResponse.json({ error: 'Password service is temporarily unavailable.' }, { status: 503 });
      }

      const storedPassword = rows?.[0]?.password;
      const isVerified = storedPassword ? await bcrypt.compare(currentPassword, storedPassword) : false;

      if (!isVerified) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      try {
        await query('UPDATE users SET password = ? WHERE id = ? AND role = ?', [newHash, auth.session.userId, 'admin']);
      } catch {
        return NextResponse.json({ error: 'Password service is temporarily unavailable.' }, { status: 503 });
      }

      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    // Default: update coop settings
    const result = await saveCoopSettings(body.settings || body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, settings: result.settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
