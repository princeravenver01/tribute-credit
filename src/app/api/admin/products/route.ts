import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/server-auth';
import { listProducts, saveProduct, type DynamicLoanProduct } from '@/lib/product-store';

export async function GET() {
  const auth = await requireApiRole('admin');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const products = await listProducts();
  return NextResponse.json({ success: true, products });
}

export async function POST(req: Request) {
  const auth = await requireApiRole('admin');
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
