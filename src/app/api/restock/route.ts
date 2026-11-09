import { NextResponse } from 'next/server';
import { getDb, saveDb, RestockLog } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const { itemId, quantityAdded, restockedBy, notes } = await req.json();
    const qty = Number(quantityAdded);
    if (!itemId || !qty || qty <= 0) {
      return NextResponse.json({ success: false, error: 'Valid item and positive quantity required' }, { status: 400 });
    }
    const db = getDb();
    const item = db.inventory.find(i => i.id === itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }
    item.currentStock += qty;
    const newRestock: RestockLog = {
      id: 'rst-' + Date.now(),
      itemId,
      itemName: item.name,
      quantityAdded: qty,
      restockedBy: restockedBy || 'Admin',
      notes: notes || '',
      timestamp: new Date().toISOString()
    };
    db.restocks.unshift(newRestock);
    saveDb(db);
    return NextResponse.json({ success: true, restock: newRestock, item });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
