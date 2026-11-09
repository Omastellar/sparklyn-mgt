import { NextResponse } from 'next/server';
import { applyUsage } from '../../../lib/supabaseDb';

export async function POST(req: Request) {
  try {
    const { cleanerId, cleanerName, locationId, locationName, routineTitle, itemId, quantityUsed } = await req.json();
    const qty = Number(quantityUsed);
    if (!itemId || qty === undefined) {
      return NextResponse.json({ success: false, error: 'Item and quantity are required' }, { status: 400 });
    }
    const { usageLog, isAbuse } = await applyUsage(
      cleanerId,
      cleanerName,
      locationId,
      locationName,
      routineTitle,
      itemId,
      qty
    );
    return NextResponse.json({ success: true, usageLog, isAbuse });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
