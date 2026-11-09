import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface RoutineTask {
  id: string;
  name: string;
  frequency: string; // e.g. 'Every 2 Hours', 'Hourly', 'Daily'
}

export interface Location {
  id: string;
  name: string;
  address: string;
  tasks: RoutineTask[];
  createdAt: string;
}

export interface Cleaner {
  id: string;
  name: string;
  phone: string;
  address: string;
  locationId: string;
  active: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  cleanerId: string;
  cleanerName: string;
  locationId: string;
  locationName: string;
  timestamp: string;
  selfieUrl: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isWithinGeofence: boolean;
}

export interface RoutineLog {
  id: string;
  cleanerId: string;
  cleanerName: string;
  locationId: string;
  locationName: string;
  taskTitle: string;
  frequency: string;
  cycleNumber: number;
  completedAt: string;
  checklist: { item: string; done: boolean }[];
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  standardAllowancePerCycle: number;
  currentStock: number;
  minStockAlert: number;
}

export interface RestockLog {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  restockedBy: string;
  notes: string;
  timestamp: string;
}

export interface CleanerUsageLog {
  id: string;
  cleanerId: string;
  cleanerName: string;
  locationId: string;
  locationName: string;
  routineTitle: string;
  itemId: string;
  itemName: string;
  quantityUsed: number;
  standardExpected: number;
  isFlaggedAbuse: boolean;
  timestamp: string;
}

export interface DatabaseSchema {
  adminPasswordHash: string;
  locations: Location[];
  cleaners: Cleaner[];
  attendance: AttendanceRecord[];
  routines: RoutineLog[];
  inventory: InventoryItem[];
  restocks: RestockLog[];
  usageLogs: CleanerUsageLog[];
}

const DB_PATH = path.join(process.cwd(), 'data', 'sparklyn.json');

const INITIAL_DATA: DatabaseSchema = {
  adminPasswordHash: '',
  locations: [],
  cleaners: [],
  attendance: [],
  routines: [],
  inventory: [
    {
      id: 'inv-1',
      name: 'Disinfectant / Bleach (5L)',
      unit: 'bottles',
      standardAllowancePerCycle: 50, // ml
      currentStock: 0,
      minStockAlert: 5
    },
    {
      id: 'inv-2',
      name: 'Trash Bags (Heavy Duty)',
      unit: 'rolls',
      standardAllowancePerCycle: 1, // unit
      currentStock: 0,
      minStockAlert: 20
    },
    {
      id: 'inv-3',
      name: 'Hand Soap Refill (5L)',
      unit: 'gallons',
      standardAllowancePerCycle: 0.1,
      currentStock: 0,
      minStockAlert: 5
    },
    {
      id: 'inv-4',
      name: 'Microfiber Cleaning Towels',
      unit: 'packs',
      standardAllowancePerCycle: 1,
      currentStock: 0,
      minStockAlert: 10
    }
  ],
  restocks: [],
  usageLogs: []
};

export function getDb(): DatabaseSchema {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
    return INITIAL_DATA;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_DATA;
  }
}

export function saveDb(data: DatabaseSchema): void {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('Filesystem write bypassed in serverless environment:', err.message);
  }
}

export { verifyAdminPassword } from './auth';
