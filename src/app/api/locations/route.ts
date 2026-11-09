import { NextResponse } from 'next/server';
import { getLocations, addLocation, updateLocation } from '../../../lib/supabaseDb';
import { Location } from '../../../lib/db';
import { isRequestAuthorizedAsAdmin } from '../../../lib/auth';

export async function GET() {
  const locations = await getLocations();
  return NextResponse.json({ success: true, locations });
}

export async function POST(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required' }, { status: 401 });
  }

  try {
    const { name, address, tasks } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, error: 'Location name is required' }, { status: 400 });
    }
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one routine task is required' }, { status: 400 });
    }
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
    const saved = await addLocation(newLoc);
    return NextResponse.json({ success: true, location: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isRequestAuthorizedAsAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required' }, { status: 401 });
  }

  try {
    const { id, name, address, tasks } = await req.json();
    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'Location id and name are required' }, { status: 400 });
    }
    const updated = await updateLocation({
      id,
      name,
      address,
      ...(tasks && Array.isArray(tasks)
        ? {
            tasks: tasks.map((t: any, i: number) => ({
              id: t.id || 't-' + Date.now() + '-' + i,
              name: t.name,
              frequency: t.frequency || 'Every 2 Hours'
            }))
          }
        : {})
    });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Location not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, location: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
