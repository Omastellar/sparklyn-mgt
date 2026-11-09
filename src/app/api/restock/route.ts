import { NextResponse } from 'next/server';
import { applyRestock } from '../../../lib/supabaseDb';
import { isRequestAuthorizedAsAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required' }, { status: 401 });
  }

  try {
    const { itemId, quantityAdded, restockedBy, notes } = await req.json();
    const qty = Number(quantityAdded);
    if (!itemId || !qty || qty <= 0) {
      return NextResponse.json({ success: false, error: 'Valid item and positive quantity required' }, { status: 400 });
    }
    const result = await applyRestock(itemId, qty, restockedBy, notes);
    return NextResponse.json({ success: true, restock: result.restock, item: result.item });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
