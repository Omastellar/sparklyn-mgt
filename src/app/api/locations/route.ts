import { NextResponse } from 'next/server';
import { getDb, saveDb, Location } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  return NextResponse.json({ success: true, locations: db.locations });
}

export async function POST(req: Request) {
  try {
    const { name, address, tasks } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, error: 'Location name is required' }, { status: 400 });
    }
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one routine task is required' }, { status: 400 });
    }
    const db = getDb();
    const newLoc: Location = {
      id: 'loc-' + Date.now(),
      name,
      address: address || 'Configured Site',
      createdAt: new Date().toISOString(),
      tasks: tasks.map((t: any, i: number) => ({
        id: 't-' + Date.now() + '-' + i,
        name: t.name,
        frequency: t.frequency || 'Every 2 Hours'
      }))
    };
    db.locations.unshift(newLoc);
    saveDb(db);
    return NextResponse.json({ success: true, location: newLoc });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name, address, tasks } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Location id and name are required' }, { status: 400 });
    }
    const db = getDb();
    const idx = db.locations.findIndex(l => l.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Location not found' }, { status: 404 });
    }
    db.locations[idx].name = name;
    if (address !== undefined) db.locations[idx].address = address;
    if (tasks && Array.isArray(tasks)) {
      db.locations[idx].tasks = tasks.map((t: any, i: number) => ({
        id: t.id || 't-' + Date.now() + '-' + i,
        name: t.name,
        frequency: t.frequency || 'Every 2 Hours'
      }));
    }
    saveDb(db);
    return NextResponse.json({ success: true, location: db.locations[idx] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
