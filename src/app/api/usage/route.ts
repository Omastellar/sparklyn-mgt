import { NextResponse } from 'next/server';
import { getDb, saveDb, CleanerUsageLog } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const { cleanerId, cleanerName, locationId, locationName, routineTitle, itemId, quantityUsed } = await req.json();
    const qty = Number(quantityUsed);
    if (!itemId || qty === undefined) {
      return NextResponse.json({ success: false, error: 'Item and quantity are required' }, { status: 400 });
    }
    const db = getDb();
    const item = db.inventory.find(i => i.id === itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const standard = item.standardAllowancePerCycle || 1;
    // Flag abuse if usage exceeds 3x expected standard
    const isAbuse = qty > (standard * 3);

    item.currentStock = Math.max(0, item.currentStock - qty);

    const newUsage: CleanerUsageLog = {
      id: 'usg-' + Date.now(),
      cleanerId: cleanerId || 'unknown',
      cleanerName: cleanerName || 'Cleaner',
      locationId: locationId || '',
      locationName: locationName || 'Location',
      routineTitle: routineTitle || 'Cleaning Routine',
      itemId,
      itemName: item.name,
      quantityUsed: qty,
      standardExpected: standard,
      isFlaggedAbuse: isAbuse,
      timestamp: new Date().toISOString()
    };

    db.usageLogs.unshift(newUsage);
    saveDb(db);
    return NextResponse.json({ success: true, usageLog: newUsage, isAbuse });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
