import { NextResponse } from 'next/server';
import { getRoutines, addRoutine } from '../../../lib/supabaseDb';
import { RoutineLog } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const routines = await getRoutines();
  return NextResponse.json({ success: true, routines });
}

export async function POST(req: Request) {
  try {
    const {
      cleanerId,
      cleanerName,
      locationId,
      locationName,
      taskTitle,
      frequency,
      cycleNumber,
      checklist,
      beforePhotoUrl,
      afterPhotoUrl,
      startedAt
    } = await req.json();

    // Deduplication check: prevent duplicate submissions created within 30s
    const existingRoutines = await getRoutines();
    const now = Date.now();
    const duplicate = existingRoutines.find(r => {
      const isSameCleaner = (cleanerId && r.cleanerId === cleanerId) || r.cleanerName === cleanerName;
      const isSameTask = r.taskTitle === taskTitle;
      const timeDiff = Math.abs(now - new Date(r.completedAt).getTime());
      return isSameCleaner && isSameTask && timeDiff < 30000;
    });

    if (duplicate) {
      return NextResponse.json({
        success: true,
        routine: duplicate,
        message: 'Routine proof already saved.'
      });
    }

    const completedAt = new Date().toISOString();
    let durationMinutes = 15;
    if (startedAt) {
      durationMinutes = Math.max(1, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000));
    }

    const enrichedChecklist = [
      { item: '__meta__', text: '__meta__', done: true, startedAt: startedAt || completedAt, durationMinutes },
      ...(Array.isArray(checklist) ? checklist : [])
    ];

    const newLog: RoutineLog = {
      id: 'rout-' + Date.now(),
      cleanerId: cleanerId || 'unknown',
      cleanerName: cleanerName || 'Cleaner',
      locationId: locationId || '',
      locationName: locationName || 'Location',
      taskTitle: taskTitle || 'Routine SOP',
      frequency: frequency || 'Every 2 Hours',
      cycleNumber: Number(cycleNumber) || 1,
      completedAt,
      startedAt: startedAt || completedAt,
      durationMinutes,
      checklist: enrichedChecklist,
      beforePhotoUrl,
      afterPhotoUrl
    };

    const saved = await addRoutine(newLog);
    return NextResponse.json({ success: true, routine: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
