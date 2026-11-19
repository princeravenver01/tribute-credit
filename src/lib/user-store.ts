import bcrypt from 'bcryptjs';

async function safeQuery<T>(sql: string, params: any[] = []): Promise<T | null> {
  try {
    const db = await import('./db');
    return await db.query<T>(sql, params);
  } catch {
    return null;
  }
}

export type UserRole = 'admin' | 'account_officer' | 'borrower' | 'disbursement';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface UserRecord {
  id: number;
  member_no?: string | null;
  name: string;
  email: string;
  role: UserRole;
  contact_number?: string | null;
  address?: string | null;
  status: UserStatus;
  created_at: string;
  password?: string;
}

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 1,
    member_no: 'ADM-001',
    name: 'Executive Admin',
    email: 'admin@tribute.coop',
    role: 'admin',
    contact_number: '0917-000-0001',
    status: 'active',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 101,
    member_no: 'AO-001',
    name: 'Officer Juan',
    email: 'officer@tribute.coop',
    role: 'account_officer',
    contact_number: '0917-889-4400',
    status: 'active',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 301,
    member_no: 'DISB-001',
    name: 'Disbursement Officer',
    email: 'disbursement@tribute.coop',
    role: 'disbursement',
    contact_number: '0917-555-3001',
    status: 'active',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 501,
    member_no: 'TCID-A-00001',
    name: 'Member Borrower',
    email: 'borrower@tribute.coop',
    role: 'borrower',
    contact_number: '0917-555-5001',
    status: 'active',
    created_at: '2026-11-01T08:00:00.000Z',
  },
];

// In-memory / fallback store when MySQL is down
const memoryUsers: UserRecord[] = [...DEFAULT_USERS];

export async function listUsers(): Promise<UserRecord[]> {
  try {
    const rows = await safeQuery<any[]>(
      'SELECT id, member_no, name, email, role, contact_number, address, status, created_at FROM users ORDER BY id ASC'
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: Number(r.id),
        member_no: r.member_no || null,
        name: r.name,
        email: r.email,
        role: r.role,
        contact_number: r.contact_number || null,
        address: r.address || null,
        status: r.status,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));
    }
  } catch {
    // MySQL unavailable; use memory fallback
  }

  return memoryUsers.map(({ password: _, ...rest }) => rest as UserRecord);
}

export async function createUser(data: {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  contact_number?: string;
  member_no?: string;
  address?: string;
}): Promise<{ ok: boolean; user?: UserRecord; error?: string }> {
  const emailNorm = data.email.trim().toLowerCase();
  if (!data.name.trim() || !emailNorm) {
    return { ok: false, error: 'Name and email are required' };
  }

  // Check unique email
  const existing = memoryUsers.find((u) => u.email.toLowerCase() === emailNorm);
  if (existing) {
    return { ok: false, error: 'A user with this email address already exists' };
  }

  const plainPass = data.password || 'Password123!';
  const hashedPassword = await bcrypt.hash(plainPass, 10);

  let newId = Date.now();
  const createdUser: UserRecord = {
    id: newId,
    member_no: data.member_no?.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    name: data.name.trim(),
    email: emailNorm,
    role: data.role,
    contact_number: data.contact_number?.trim() || null,
    address: data.address?.trim() || null,
    status: 'active',
    created_at: new Date().toISOString(),
    password: hashedPassword,
  };

  try {
    const res = await safeQuery<any>(
      'INSERT INTO users (member_no, name, email, password, role, contact_number, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        createdUser.member_no,
        createdUser.name,
        createdUser.email,
        hashedPassword,
        createdUser.role,
        createdUser.contact_number,
        createdUser.address,
        'active',
      ]
    );
    if (res && res.insertId) {
      newId = res.insertId;
      createdUser.id = newId;
    }
  } catch (e: any) {
    // Fall back to memory
  }

  memoryUsers.push(createdUser);
  const { password: _, ...clean } = createdUser;
  return { ok: true, user: clean as UserRecord };
}

export async function updateUser(
  id: number,
  updates: Partial<Pick<UserRecord, 'name' | 'contact_number' | 'address' | 'role' | 'status' | 'member_no'>>
): Promise<{ ok: boolean; error?: string; user?: UserRecord }> {
  const target = memoryUsers.find((u) => u.id === id);
  if (!target) {
    return { ok: false, error: 'User not found' };
  }

  // Prevent changing super admin role or status to inactive
  if ((target.email === 'admin@tribute.coop' || target.id === 1) && updates.status === 'inactive') {
    return { ok: false, error: 'Primary Super Administrator cannot be deactivated' };
  }

  Object.assign(target, updates);

  try {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.contact_number !== undefined) {
      fields.push('contact_number = ?');
      values.push(updates.contact_number);
    }
    if (updates.address !== undefined) {
      fields.push('address = ?');
      values.push(updates.address);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.member_no !== undefined) {
      fields.push('member_no = ?');
      values.push(updates.member_no);
    }

    if (fields.length > 0) {
      values.push(id);
      await safeQuery(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  } catch (e: any) {
    // Ignore MySQL error in memory fallback
  }

  const { password: _, ...clean } = target;
  return { ok: true, user: clean as UserRecord };
}

export async function toggleUserStatus(
  id: number,
  newStatus: UserStatus
): Promise<{ ok: boolean; error?: string }> {
  return updateUser(id, { status: newStatus });
}
