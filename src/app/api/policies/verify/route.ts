import mysql from 'mysql2/promise';
import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';

let tgPool: mysql.Pool | null = null;
let cachedPolicyCol: string | null = null;
let cachedMiddleCol: string | null = null;
let cachedBirthCol: string | null = null;

function getTgDbPool() {
  if (!tgPool) {
    tgPool = mysql.createPool({
      host: process.env.TG_DB_HOST || process.env.DB_HOST || 'localhost',
      user: process.env.TG_DB_USER || 'u721094550_tribute_grace',
      password: process.env.TG_DB_PASSWORD || 'AveeAthena2026!',
      database: process.env.TG_DB_NAME || 'u721094550_tribute_grace',
      port: Number(process.env.TG_DB_PORT || process.env.DB_PORT) || 3306,
      ssl: process.env.TG_DB_SSL === 'true' ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 8000,
    });
  }
  return tgPool;
}

function normalizeNamePart(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

function normalizeDate(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function middleMatches(borrowerMid: string, policyMid: string): boolean {
  if (!borrowerMid || !policyMid) return true;
  if (borrowerMid === policyMid) return true;
  // Allow single-letter middle initial match (e.g., "v" vs "verciles")
  if (borrowerMid.length === 1 && policyMid.startsWith(borrowerMid)) return true;
  if (policyMid.length === 1 && borrowerMid.startsWith(policyMid)) return true;
  return false;
}

async function resolvePolicyColumns(pool: mysql.Pool) {
  if (cachedPolicyCol) {
    return {
      policyCol: cachedPolicyCol,
      middleCol: cachedMiddleCol || 'middleName',
      birthCol: cachedBirthCol || 'birthdate',
    };
  }

  const [cols] = (await pool.execute('SHOW COLUMNS FROM policies')) as unknown as [
    Array<{ Field: string }>
  ];
  const fields = cols.map((c) => c.Field);
  const lowerMap = new Map(fields.map((f) => [f.toLowerCase(), f]));

  const policyCandidates = [
    'policy_number',
    'policy_no',
    'policynumber',
    'policyno',
    'lcap_number',
    'lcap_no',
    'code',
  ];
  let policyCol =
    policyCandidates.map((c) => lowerMap.get(c)).find(Boolean) ||
    fields.find((f) => /policy|lcap/i.test(f)) ||
    'policy_number';

  const middleCol =
    lowerMap.get('middlename') ||
    lowerMap.get('middle_name') ||
    'middleName';

  const birthCol =
    lowerMap.get('birthdate') ||
    lowerMap.get('birth_date') ||
    lowerMap.get('date_of_birth') ||
    'birthdate';

  cachedPolicyCol = policyCol;
  cachedMiddleCol = middleCol;
  cachedBirthCol = birthCol;

  return { policyCol, middleCol, birthCol };
}

export async function POST(req: Request) {
  const auth = await requireApiRole('account_officer', 'admin', 'disbursement');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await req.json()) as {
      policyNumber?: string;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      birthdate?: string;
    };

    const policyNumber = typeof body.policyNumber === 'string' ? body.policyNumber.trim() : '';
    if (!policyNumber || policyNumber === 'LCAP-') {
      return NextResponse.json({ error: 'Policy number is required.' }, { status: 400 });
    }

    const pool = getTgDbPool();
    const { policyCol, middleCol, birthCol } = await resolvePolicyColumns(pool);

    const [rows] = (await pool.execute(
      `SELECT \`${policyCol}\` AS policy_number, first_name, last_name, \`${middleCol}\` AS middle_name, \`${birthCol}\` AS birthdate
       FROM policies
       WHERE LOWER(TRIM(\`${policyCol}\`)) = LOWER(TRIM(?))
       LIMIT 1`,
      [policyNumber]
    )) as unknown as [Array<Record<string, unknown>>];

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        ok: true,
        found: false,
        nameMatches: false,
        birthdateMatches: null,
        message: `Policy ${policyNumber} was not found in the Tribute Grace database.`,
      });
    }

    const row = rows[0];
    const policyFirst = normalizeNamePart(row.first_name);
    const policyLast = normalizeNamePart(row.last_name);
    const policyMid = normalizeNamePart(row.middle_name);
    const policyBirth = normalizeDate(row.birthdate);

    const borrowerFirst = normalizeNamePart(body.firstName);
    const borrowerLast = normalizeNamePart(body.lastName);
    const borrowerMid = normalizeNamePart(body.middleName);
    const borrowerBirth = normalizeDate(body.birthdate);

    const firstMatches = Boolean(borrowerFirst) && borrowerFirst === policyFirst;
    const lastMatches = Boolean(borrowerLast) && borrowerLast === policyLast;
    const midMatches = middleMatches(borrowerMid, policyMid);
    const nameMatches = firstMatches && lastMatches && midMatches;

    const birthdateMatches =
      borrowerBirth && policyBirth ? borrowerBirth === policyBirth : null;

    return NextResponse.json({
      ok: true,
      found: true,
      nameMatches,
      birthdateMatches,
      policyHolder: {
        policyNumber: String(row.policy_number || policyNumber),
        firstName: String(row.first_name || ''),
        middleName: String(row.middle_name || ''),
        lastName: String(row.last_name || ''),
        birthdate: policyBirth || undefined,
      },
    });
  } catch (err) {
    const dbErr = err as { code?: string; message?: string };
    console.error('[policies/verify] TG DB error:', {
      code: dbErr?.code,
      message: dbErr?.message ?? String(err),
    });
    return NextResponse.json(
      { ok: false, error: 'Unable to verify against Tribute Grace policy database right now.' },
      { status: 503 }
    );
  }
}
