import { NextResponse } from 'next/server';
import { findCleanerByPhone, getLocations, getAttendance } from '../../../lib/supabaseDb';
import {
  findAdminByPhone,
  createAdminSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS
} from '../../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const trimmedPhone = phone.trim();

    // 1. Check if phone belongs to an Admin (Oma, Dolapo, Rita)
    const admin = findAdminByPhone(trimmedPhone);
    if (admin) {
      const token = createAdminSessionToken();
      const res = NextResponse.json({
        success: true,
        role: 'admin',
        adminName: admin.name,
        message: `Welcome, Admin ${admin.name}!`,
        token
      });

      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return res;
    }

    // 2. Check if phone belongs to an Onboarded Cleaner
    const cleaner = await findCleanerByPhone(trimmedPhone);
    if (cleaner) {
      const locations = await getLocations();
      const location = locations.find(l => l.id === cleaner.locationId) || locations[0] || null;

      // Check cleaner's attendance today (morning clock-in vs evening clock-out)
      const allAttendance = await getAttendance();
      const todayStr = new Date().toDateString();
      const todayAttendance = allAttendance.filter(
        att => (att.cleanerId === cleaner.id || att.cleanerName === cleaner.name) &&
               new Date(att.timestamp).toDateString() === todayStr
      );

      const clockInRecord = todayAttendance.find(att => !att.id.includes('-out-')) || todayAttendance[0] || null;
      const clockOutRecord = todayAttendance.find(att => att.id.includes('-out-')) || (todayAttendance.length > 1 ? todayAttendance[1] : null);

      const clockInDone = !!clockInRecord;
      const clockOutDone = !!clockOutRecord;

      return NextResponse.json({
        success: true,
        role: 'cleaner',
        cleaner,
        location,
        clockInDone,
        clockOutDone,
        clockInTime: clockInRecord?.timestamp || null,
        clockOutTime: clockOutRecord?.timestamp || null,
        message: `Welcome back, ${cleaner.name}!`
      });
    }

    // 3. Not registered
    return NextResponse.json(
      {
        success: false,
        error: 'Phone number not registered. Please contact management.'
      },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
