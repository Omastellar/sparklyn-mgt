import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import { matchPhone } from './auth';
import {
  getDb,
  saveDb,
  Location,
  Cleaner,
  AttendanceRecord,
  RoutineLog,
  InventoryItem,
  RestockLog,
  CleanerUsageLog
} from './db';

// Helper to check if Supabase returned a missing table error (PGRST205)
function isTableMissingError(err: any): boolean {
  return err && (err.code === 'PGRST205' || err.message?.includes('schema cache'));
}

// ---------------- LOCATIONS ----------------
export async function getLocations(): Promise<Location[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('locations')
      .select('*')
      .order('createdAt', { ascending: false });

    if (!error && data) {
      return data as Location[];
    }
  }
  return getDb().locations;
}

export async function addLocation(loc: Location): Promise<Location> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('locations').insert(loc);
    if (!error) {
      return loc;
    }
    console.error('Supabase addLocation error:', error);
    throw new Error(error.message || 'Failed to save location in Supabase');
  }
  const db = getDb();
  db.locations.unshift(loc);
  saveDb(db);
  return loc;
}

export async function updateLocation(loc: Partial<Location> & { id: string }): Promise<Location | null> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('locations')
      .update(loc)
      .eq('id', loc.id)
      .select()
      .single();

    if (!error && data) {
      return data as Location;
    }
    if (error) {
      console.error('Supabase updateLocation error:', error);
      throw new Error(error.message || 'Failed to update location in Supabase');
    }
  }
  const db = getDb();
  const idx = db.locations.findIndex(l => l.id === loc.id);
  if (idx !== -1) {
    db.locations[idx] = { ...db.locations[idx], ...loc };
    saveDb(db);
    return db.locations[idx];
  }
  return null;
}

// ---------------- CLEANERS ----------------
export async function getCleaners(): Promise<Cleaner[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('cleaners')
      .select('*')
      .order('createdAt', { ascending: false });

    if (!error && data) {
      return data as Cleaner[];
    }
  }
  return getDb().cleaners;
}

export async function addCleaner(cleaner: Cleaner): Promise<Cleaner> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('cleaners').insert(cleaner);
    if (!error) {
      return cleaner;
    }
    console.error('Supabase addCleaner error:', error);
    throw new Error(error.message || 'Failed to save cleaner in Supabase');
  }
  const db = getDb();
  db.cleaners.unshift(cleaner);
  saveDb(db);
  return cleaner;
}

export async function findCleanerByPhone(phone: string): Promise<Cleaner | null> {
  const cleaners = await getCleaners();
  return cleaners.find(c => matchPhone(phone, c.phone)) || null;
}

// ---------------- ATTENDANCE ----------------
export async function getAttendance(): Promise<AttendanceRecord[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .order('timestamp', { ascending: false });

    if (!error && data) {
      return data as AttendanceRecord[];
    }
  }
  return getDb().attendance;
}

export async function addAttendance(record: AttendanceRecord): Promise<AttendanceRecord> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('attendance').insert(record);
    if (!error) {
      return record;
    }
    console.error('Supabase addAttendance error:', error);
    throw new Error(error.message || 'Failed to save attendance in Supabase');
  }
  const db = getDb();
  db.attendance.unshift(record);
  saveDb(db);
  return record;
}

// ---------------- ROUTINES ----------------
export async function getRoutines(): Promise<RoutineLog[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('routines')
      .select('*')
      .order('completedAt', { ascending: false });

    if (!error && data) {
      return (data as RoutineLog[]).map(r => {
        let startedAt = r.startedAt;
        let durationMinutes = r.durationMinutes;
        if (!durationMinutes || !startedAt) {
          const meta = Array.isArray(r.checklist) ? r.checklist.find((c: any) => c.item === '__meta__') : null;
          if (meta) {
            startedAt = startedAt || meta.startedAt;
            durationMinutes = durationMinutes || meta.durationMinutes;
          }
        }
        return {
          ...r,
          startedAt,
          durationMinutes
        };
      });
    }
  }
  return getDb().routines;
}

export async function addRoutine(routine: RoutineLog): Promise<RoutineLog> {
  if (isSupabaseConfigured && supabaseAdmin) {
    // Only insert the exact columns that exist in the Supabase routines table.
    // metadata (startedAt, durationMinutes) is safely preserved inside the checklist JSON.
    const dbPayload = {
      id: routine.id,
      cleanerId: routine.cleanerId,
      cleanerName: routine.cleanerName,
      locationId: routine.locationId,
      locationName: routine.locationName,
      taskTitle: routine.taskTitle,
      frequency: routine.frequency,
      cycleNumber: routine.cycleNumber,
      completedAt: routine.completedAt,
      checklist: routine.checklist,
      beforePhotoUrl: routine.beforePhotoUrl,
      afterPhotoUrl: routine.afterPhotoUrl
    };
    const { error } = await supabaseAdmin.from('routines').insert(dbPayload);
    if (!error) {
      return routine;
    }
    console.error('Supabase addRoutine error:', error);
    throw new Error(error.message || 'Failed to save routine in Supabase');
  }
  const db = getDb();
  db.routines.unshift(routine);
  saveDb(db);
  return routine;
}

// ---------------- INVENTORY & RESTOCKS & USAGE ----------------
export async function getInventoryData(): Promise<{
  inventory: InventoryItem[];
  restocks: RestockLog[];
  usageLogs: CleanerUsageLog[];
}> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const [invRes, restockRes, usageRes] = await Promise.all([
      supabaseAdmin.from('inventory').select('*').order('name', { ascending: true }),
      supabaseAdmin.from('restocks').select('*').order('timestamp', { ascending: false }),
      supabaseAdmin.from('usage_logs').select('*').order('timestamp', { ascending: false })
    ]);

    if (!invRes.error) {
      return {
        inventory: (invRes.data || []) as InventoryItem[],
        restocks: (restockRes.data || []) as RestockLog[],
        usageLogs: (usageRes.data || []) as CleanerUsageLog[]
      };
    }
  }
  const db = getDb();
  return {
    inventory: db.inventory,
    restocks: db.restocks,
    usageLogs: db.usageLogs
  };
}

export async function addInventoryItem(item: InventoryItem): Promise<InventoryItem> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('inventory').insert(item);
    if (!error) return item;
    console.error('Supabase addInventoryItem error:', error);
    throw new Error(error.message || 'Failed to add inventory item');
  }
  const db = getDb();
  db.inventory.push(item);
  saveDb(db);
  return item;
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('inventory').delete().eq('id', id);
    if (!error) return true;
    console.error('Supabase deleteInventoryItem error:', error);
    throw new Error(error.message || 'Failed to delete inventory item');
  }
  const db = getDb();
  db.inventory = db.inventory.filter(i => i.id !== id);
  saveDb(db);
  return true;
}

export async function applyRestock(
  itemId: string,
  quantityAdded: number,
  restockedBy: string,
  notes: string
): Promise<{ restock: RestockLog; item: InventoryItem }> {
  const { inventory } = await getInventoryData();
  const item = inventory.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found');

  const newStock = Number(item.currentStock) + quantityAdded;
  const newRestock: RestockLog = {
    id: 'rst-' + Date.now(),
    itemId,
    itemName: item.name,
    quantityAdded,
    restockedBy: restockedBy || 'Admin',
    notes: notes || '',
    timestamp: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    await Promise.all([
      supabaseAdmin.from('inventory').update({ currentStock: newStock }).eq('id', itemId),
      supabaseAdmin.from('restocks').insert(newRestock)
    ]);
  }

  // Also update local DB for fallback consistency
  const db = getDb();
  const localItem = db.inventory.find(i => i.id === itemId);
  if (localItem) localItem.currentStock = newStock;
  db.restocks.unshift(newRestock);
  saveDb(db);

  return { restock: newRestock, item: { ...item, currentStock: newStock } };
}

export async function applyUsage(
  cleanerId: string,
  cleanerName: string,
  locationId: string,
  locationName: string,
  routineTitle: string,
  itemId: string,
  quantityUsed: number
): Promise<{ usageLog: CleanerUsageLog; isAbuse: boolean }> {
  const { inventory } = await getInventoryData();
  const item = inventory.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found');

  const standard = item.standardAllowancePerCycle || 1;
  const isAbuse = quantityUsed > standard * 3;
  const newStock = Math.max(0, Number(item.currentStock) - quantityUsed);

  const newUsage: CleanerUsageLog = {
    id: 'usg-' + Date.now(),
    cleanerId: cleanerId || 'unknown',
    cleanerName: cleanerName || 'Cleaner',
    locationId: locationId || '',
    locationName: locationName || 'Location',
    routineTitle: routineTitle || 'Cleaning Routine',
    itemId,
    itemName: item.name,
    quantityUsed,
    standardExpected: standard,
    isFlaggedAbuse: isAbuse,
    timestamp: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    await Promise.all([
      supabaseAdmin.from('inventory').update({ currentStock: newStock }).eq('id', itemId),
      supabaseAdmin.from('usage_logs').insert(newUsage)
    ]);
  }

  // Also update local DB for fallback consistency
  const db = getDb();
  const localItem = db.inventory.find(i => i.id === itemId);
  if (localItem) localItem.currentStock = newStock;
  db.usageLogs.unshift(newUsage);
  saveDb(db);

  return { usageLog: newUsage, isAbuse };
}
