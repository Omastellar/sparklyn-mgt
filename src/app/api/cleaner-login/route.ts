import { NextResponse } from 'next/server';
import { findCleanerByPhone, getLocations } from '../../../lib/supabaseDb';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }
    const cleaner = await findCleanerByPhone(phone);
    if (!cleaner) {
      return NextResponse.json({ 
        success: false, 
        error: 'Phone number not registered by Admin. Please contact your manager.' 
      }, { status: 404 });
    }

    const locations = await getLocations();
    const location = locations.find(l => l.id === cleaner.locationId) || locations[0] || null;
    return NextResponse.json({ success: true, cleaner, location });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
