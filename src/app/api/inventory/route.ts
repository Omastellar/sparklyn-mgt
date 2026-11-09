import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    success: true,
    inventory: db.inventory,
    restocks: db.restocks,
    usageLogs: db.usageLogs
  });
}
