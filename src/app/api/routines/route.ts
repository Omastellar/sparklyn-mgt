import { NextResponse } from 'next/server';
import { getRoutines, addRoutine } from '../../../lib/supabaseDb';
import { RoutineLog } from '../../../lib/db';

export async function GET() {
  const routines = await getRoutines();
  return NextResponse.json({ success: true, routines });
}

export async function POST(req: Request) {
  try {
    const { cleanerId, cleanerName, locationId, locationName, taskTitle, frequency, cycleNumber, checklist, beforePhotoUrl, afterPhotoUrl } = await req.json();
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
    const saved = await addRoutine(newLog);
    return NextResponse.json({ success: true, routine: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
