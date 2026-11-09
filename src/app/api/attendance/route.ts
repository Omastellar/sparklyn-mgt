import { NextResponse } from 'next/server';
import { getDb, saveDb, AttendanceRecord } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ success: true, attendance: db.attendance });
}

export async function POST(req: Request) {
  try {
    const { cleanerId, cleanerName, locationId, locationName, selfieUrl, latitude, longitude, accuracyMeters } = await req.json();
    if (!cleanerId || !selfieUrl) {
      return NextResponse.json({ success: false, error: 'Cleaner ID and Live Selfie are required' }, { status: 400 });
    }
    const db = getDb();
    const newRecord: AttendanceRecord = {
      id: 'att-' + Date.now(),
      cleanerId,
      cleanerName: cleanerName || 'Cleaner',
      locationId: locationId || '',
      locationName: locationName || 'Assigned Location',
      timestamp: new Date().toISOString(),
      selfieUrl,
      latitude: Number(latitude) || 6.5244,
      longitude: Number(longitude) || 3.3792,
      accuracyMeters: Number(accuracyMeters) || 5,
      isWithinGeofence: true
    };
    db.attendance.unshift(newRecord);
    saveDb(db);
    return NextResponse.json({ success: true, record: newRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
