import { NextResponse } from 'next/server';
import { getInventoryData, addInventoryItem, deleteInventoryItem } from '../../../lib/supabaseDb';
import { InventoryItem } from '../../../lib/db';
import { isRequestAuthorizedAsAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { inventory, restocks, usageLogs } = await getInventoryData();
  return NextResponse.json({
    success: true,
    inventory,
    restocks,
    usageLogs
  });
}

// Add new inventory item (Admin only)
export async function POST(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const { name, unit, standardAllowancePerCycle, currentStock, minStockAlert } = await req.json();
    if (!name || !unit) {
      return NextResponse.json(
        { success: false, error: 'Item name and unit of measurement are required' },
        { status: 400 }
      );
    }

    const newItem: InventoryItem = {
      id: 'inv-' + Date.now(),
      name: name.trim(),
      unit: unit.trim(),
      standardAllowancePerCycle: Number(standardAllowancePerCycle) || 1,
      currentStock: Number(currentStock) || 0,
      minStockAlert: Number(minStockAlert) || 5
    };

    const saved = await addInventoryItem(newItem);
    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Delete inventory item (Admin only)
export async function DELETE(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 });
    }

    await deleteInventoryItem(id);
    return NextResponse.json({ success: true, message: 'Item deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
