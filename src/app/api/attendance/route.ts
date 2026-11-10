import { NextResponse } from 'next/server';
import { getAttendance, addAttendance } from '../../../lib/supabaseDb';
import { AttendanceRecord } from '../../../lib/db';
import { getNigeriaTime } from '../../../lib/nigeriaTime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const attendance = await getAttendance();
  return NextResponse.json({ success: true, attendance });
}

export async function POST(req: Request) {
  try {
    const {
      cleanerId,
      cleanerName,
      locationId,
      locationName,
      selfieUrl,
      latitude,
      longitude,
      accuracyMeters,
      type = 'in' // 'in' or 'out'
    } = await req.json();

    if (!cleanerId || !selfieUrl) {
      return NextResponse.json(
        { success: false, error: 'Cleaner ID and Live Selfie are required' },
        { status: 400 }
      );
    }

    const ngTime = getNigeriaTime();

    // 1. Enforce Clock-Out Timing (Nigeria Time: 3:30 PM - 5:00 PM)
    if (type === 'out') {
      if (ngTime.isBeforeClockOut) {
        return NextResponse.json(
          {
            success: false,
            error: `Cleaners cannot clock out before 3:30 PM (Nigeria Time). Current time is ${ngTime.timeString} WAT.`
          },
          { status: 400 }
        );
      }
    }

    // 2. Check existing attendance today to prevent duplicates
    const allAttendance = await getAttendance();
    const todayStr = new Date().toDateString();
    const todayCleanerRecords = allAttendance.filter(
      att => (att.cleanerId === cleanerId || att.cleanerName === cleanerName) &&
             new Date(att.timestamp).toDateString() === todayStr
    );

    const existingClockIn = todayCleanerRecords.find(att => !att.id.includes('-out-')) || null;
    const existingClockOut = todayCleanerRecords.find(att => att.id.includes('-out-')) || null;

    if (type === 'in' && existingClockIn) {
      return NextResponse.json({
        success: true,
        record: existingClockIn,
        message: 'Morning attendance was already recorded today.'
      });
    }

    if (type === 'out') {
      if (!existingClockIn) {
        return NextResponse.json(
          { success: false, error: 'You must clock in first before clocking out.' },
          { status: 400 }
        );
      }
      if (existingClockOut) {
        return NextResponse.json({
          success: true,
          record: existingClockOut,
          message: 'Evening clock-out was already recorded today.'
        });
      }
    }

    // 3. Create Record
    const prefix = type === 'out' ? 'att-out-' : 'att-in-';
    const newRecord: AttendanceRecord = {
      id: prefix + Date.now(),
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

    const saved = await addAttendance(newRecord);
    return NextResponse.json({
      success: true,
      record: saved,
      type,
      message: type === 'out' ? 'Evening clock-out successfully recorded!' : 'Morning attendance successfully recorded!'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
