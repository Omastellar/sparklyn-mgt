import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }
    const db = getDb();
    const cleanNum = phone.replace(/[^0-9+]/g, '');
    const cleaner = db.cleaners.find(c => {
      const cClean = c.phone.replace(/[^0-9+]/g, '');
      return cClean === cleanNum || cClean.endsWith(cleanNum.slice(-10)) || cleanNum.endsWith(cClean.slice(-10));
    });

    if (!cleaner) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phone number not registered by Admin. Please contact your manager.' 
      }, { status: 404 });
    }

    const location = db.locations.find(l => l.id === cleaner.locationId) || db.locations[0] || null;
    return NextResponse.json({ success: true, cleaner, location });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
