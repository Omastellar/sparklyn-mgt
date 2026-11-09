import { NextResponse } from 'next/server';
import { getCleaners, addCleaner, getLocations } from '../../../lib/supabaseDb';
import { Cleaner } from '../../../lib/db';
import { isRequestAuthorizedAsAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cleaners = await getCleaners();
  return NextResponse.json({ success: true, cleaners });
}

export async function POST(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required' }, { status: 401 });
  }

  try {
    const { name, phone, address, locationId } = await req.json();
    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }
    const cleaners = await getCleaners();
    const existing = cleaners.find(c => c.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
    if (existing) {
      return NextResponse.json({ success: false, error: 'Cleaner with this phone number already exists' }, { status: 400 });
    }
    const locations = await getLocations();
    const newCleaner: Cleaner = {
      id: 'c-' + Date.now(),
      name,
      phone,
      address: address || '',
      locationId: locationId || (locations[0] ? locations[0].id : ''),
      active: true,
      createdAt: new Date().toISOString()
    };
    const saved = await addCleaner(newCleaner);
    return NextResponse.json({ success: true, cleaner: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
