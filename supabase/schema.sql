-- =======================================================
-- SPARKLYN FACILITY MANAGEMENT - SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =======================================================

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "tasks" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Cleaners Table
CREATE TABLE IF NOT EXISTS public.cleaners (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT DEFAULT '',
  "locationId" TEXT,
  "active" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
  "id" TEXT PRIMARY KEY,
  "cleanerId" TEXT NOT NULL,
  "cleanerName" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ DEFAULT NOW(),
  "selfieUrl" TEXT,
  "latitude" NUMERIC,
  "longitude" NUMERIC,
  "accuracyMeters" NUMERIC,
  "isWithinGeofence" BOOLEAN DEFAULT TRUE
);

-- 4. Routines Task Logs
CREATE TABLE IF NOT EXISTS public.routines (
  "id" TEXT PRIMARY KEY,
  "cleanerId" TEXT NOT NULL,
  "cleanerName" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "taskTitle" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "cycleNumber" INT DEFAULT 1,
  "completedAt" TIMESTAMPTZ DEFAULT NOW(),
  "checklist" JSONB DEFAULT '[]'::jsonb,
  "beforePhotoUrl" TEXT,
  "afterPhotoUrl" TEXT
);

-- 5. Inventory Items
CREATE TABLE IF NOT EXISTS public.inventory (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "standardAllowancePerCycle" NUMERIC DEFAULT 0,
  "currentStock" NUMERIC DEFAULT 0,
  "minStockAlert" NUMERIC DEFAULT 0
);

-- 6. Restock Logs
CREATE TABLE IF NOT EXISTS public.restocks (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantityAdded" NUMERIC NOT NULL,
  "restockedBy" TEXT NOT NULL,
  "notes" TEXT DEFAULT '',
  "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Cleaner Usage Logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
  "id" TEXT PRIMARY KEY,
  "cleanerId" TEXT NOT NULL,
  "cleanerName" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "routineTitle" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantityUsed" NUMERIC NOT NULL,
  "standardExpected" NUMERIC NOT NULL,
  "isFlaggedAbuse" BOOLEAN DEFAULT FALSE,
  "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) setup
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Allow read/write access (service_role bypasses RLS, anon can read & write for facility operations)
CREATE POLICY "Allow all on locations" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cleaners" ON public.cleaners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on routines" ON public.routines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on restocks" ON public.restocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on usage_logs" ON public.usage_logs FOR ALL USING (true) WITH CHECK (true);

-- Seed Initial Inventory Items
INSERT INTO public.inventory ("id", "name", "unit", "standardAllowancePerCycle", "currentStock", "minStockAlert")
VALUES
  ('inv-1', 'Disinfectant / Bleach (5L)', 'bottles', 50, 0, 5),
  ('inv-2', 'Trash Bags (Heavy Duty)', 'rolls', 1, 0, 20),
  ('inv-3', 'Hand Soap Refill (5L)', 'gallons', 0.1, 0, 5),
  ('inv-4', 'Microfiber Cleaning Towels', 'packs', 1, 0, 10)
ON CONFLICT ("id") DO NOTHING;
