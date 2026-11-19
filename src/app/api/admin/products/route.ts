import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwtToken } from '@/lib/auth';
import { listProducts, saveProduct, type DynamicLoanProduct } from '@/lib/product-store';

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
  const products = await listProducts();
  return NextResponse.json({ success: true, products });
}

export async function POST(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body: DynamicLoanProduct = await req.json();
    const result = await saveProduct(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, product: result.product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
