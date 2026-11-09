import { NextResponse } from 'next/server';
import { getInventoryData } from '../../../lib/supabaseDb';

export async function GET() {
  const { inventory, restocks, usageLogs } = await getInventoryData();
  return NextResponse.json({
    success: true,
    inventory,
    restocks,
    usageLogs
  });
}
