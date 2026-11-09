import { NextResponse } from 'next/server';
import { getDb, saveDb, RoutineLog } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ success: true, routines: db.routines });
}

export async function POST(req: Request) {
  try {
    const { cleanerId, cleanerName, locationId, locationName, taskTitle, frequency, cycleNumber, checklist, beforePhotoUrl, afterPhotoUrl } = await req.json();
    const db = getDb();
    const newLog: RoutineLog = {
      id: 'rout-' + Date.now(),
      cleanerId: cleanerId || 'unknown',
      cleanerName: cleanerName || 'Cleaner',
      locationId: locationId || '',
      locationName: locationName || 'Location',
      taskTitle: taskTitle || 'Routine SOP',
      frequency: frequency || 'Every 2 Hours',
      cycleNumber: Number(cycleNumber) || 1,
      completedAt: new Date().toISOString(),
      checklist: checklist || [],
      beforePhotoUrl,
      afterPhotoUrl
    };
    db.routines.unshift(newLog);
    saveDb(db);
    return NextResponse.json({ success: true, routine: newLog });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
