import { NextResponse } from 'next/server';
import { getDb, saveDb, Cleaner } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ success: true, cleaners: db.cleaners });
}

export async function POST(req: Request) {
  try {
    const { name, phone, address, locationId } = await req.json();
    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }
    const db = getDb();
    const existing = db.cleaners.find(c => c.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
    if (existing) {
      return NextResponse.json({ success: false, error: 'Cleaner with this phone number already exists' }, { status: 400 });
    }
    const newCleaner: Cleaner = {
      id: 'c-' + Date.now(),
      name,
      phone,
      address: address || '',
      locationId: locationId || (db.locations[0] ? db.locations[0].id : ''),
      active: true,
      createdAt: new Date().toISOString()
    };
    db.cleaners.unshift(newCleaner);
    saveDb(db);
    return NextResponse.json({ success: true, cleaner: newCleaner });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
