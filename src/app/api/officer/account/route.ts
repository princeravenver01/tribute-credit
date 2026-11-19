import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signJwtToken } from '@/lib/auth';
import { requireApiRole } from '@/lib/server-auth';
import { query } from '@/lib/db';
import { sanitizeProfileUpdate, validatePasswordUpdate } from '@/lib/officer-account';

/**
 * GET /api/officer/account
 * Returns officer profile information. Never returns password hashes.
 */
export async function GET() {
  try {
    const auth = await requireApiRole('account_officer');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
      const rows = await query<Record<string, unknown>[]>(
        'SELECT id, member_no, name, email, role, contact_number, status, created_at FROM users WHERE id = ? AND role = ? LIMIT 1',
        [auth.session.userId, 'account_officer']
      );
      const dbUser = rows?.[0];
      if (!dbUser) return NextResponse.json({ error: 'Account record not found.' }, { status: 404 });
      return NextResponse.json({
        success: true,
        source: 'database',
        user: {
          id: dbUser.id,
          member_no: (dbUser.member_no as string) || 'AO-001',
          name: dbUser.name as string,
          email: dbUser.email as string,
          role: dbUser.role as string,
          contact_number: (dbUser.contact_number as string) || '',
          status: (dbUser.status as string) || 'active',
          created_at: dbUser.created_at
        }
      });
    } catch {
      return NextResponse.json({ error: 'Account service is temporarily unavailable.' }, { status: 503 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Officer account GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: message }, { status: 500 });
  }
}

/**
 * PATCH /api/officer/account
 * Handles profile update (name, contact_number) or password update.
 * Strictly checks account_officer role, validates inputs, and updates cookies.
 */
export async function PATCH(req: Request) {
  try {
    const auth = await requireApiRole('account_officer');
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const action = body.action; // 'update_profile' | 'update_password'

    if (action === 'update_profile') {
      const sanitized = sanitizeProfileUpdate(body);
      if (!sanitized.name && !sanitized.contact_number) {
        return NextResponse.json({ error: 'At least one valid field (name or contact number) must be provided.' }, { status: 400 });
      }

      try {
        // Attempt MySQL update
        const updateFields: string[] = [];
        const params: (string | number)[] = [];

        if (sanitized.name) {
          updateFields.push('name = ?');
          params.push(sanitized.name);
        }
        if (sanitized.contact_number !== undefined) {
          updateFields.push('contact_number = ?');
          params.push(sanitized.contact_number);
        }

        params.push(auth.session.userId);
        params.push('account_officer');

        const result = await query<{ affectedRows?: number }>(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND role = ?`,
          params
        );

        if (result && result.affectedRows === 0) {
          return NextResponse.json({
            error: 'Database record not found for this account.'
          }, { status: 404 });
        }

        // Issue refreshed JWT token with updated name
        const newName = sanitized.name || auth.session.name;
        const refreshedToken = signJwtToken({
          userId: auth.session.userId,
          email: auth.session.email,
          role: auth.session.role,
          name: newName
        });

        const response = NextResponse.json({
          success: true,
          message: 'Profile updated successfully',
          user: {
            id: auth.session.userId,
            name: newName,
            contact_number: sanitized.contact_number
          }
        });

        response.cookies.set('coop_auth_token', refreshedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7
        });

        return response;
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Database error';
        console.warn('Database update failed:', msg);
        return NextResponse.json({
          error: 'Database is currently unavailable. Profile changes could not be saved to MySQL.',
          details: msg
        }, { status: 503 });
      }
    }

    if (action === 'update_password') {
      const { currentPassword, newPassword, confirmPassword } = body;

      // Check current password from database
      let storedHash = '';
      try {
        const rows = await query<Record<string, unknown>[]>(
          'SELECT password FROM users WHERE id = ? AND role = ? LIMIT 1',
          [auth.session.userId, 'account_officer']
        );
        if (rows && rows.length > 0) {
          storedHash = (rows[0].password as string) || '';
        } else {
          return NextResponse.json({
            error: 'No database account record found for this session.'
          }, { status: 404 });
        }
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Database error';
        return NextResponse.json({
          error: 'Database is currently unavailable. Password changes require active database connectivity.',
          details: msg
        }, { status: 503 });
      }

      const validation = await validatePasswordUpdate({
        currentPassword,
        newPassword,
        confirmPassword,
        storedPasswordHash: storedHash
      });

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Hash and store new password
      const newHash = await bcrypt.hash(newPassword, 10);
      try {
        await query(
          'UPDATE users SET password = ? WHERE id = ? AND role = ?',
          [newHash, auth.session.userId, 'account_officer']
        );

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully.'
        });
      } catch (dbErr: unknown) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Database update error';
        return NextResponse.json({
          error: 'Failed to update password in database.',
          details: msg
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Officer account PATCH error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: msg }, { status: 500 });
  }
}
