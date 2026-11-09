'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Building,
  RotateCcw
} from 'lucide-react';

interface RoutineTask {
  id?: string;
  name: string;
  frequency: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  tasks: RoutineTask[];
}

interface Cleaner {
  id: string;
  name: string;
  phone: string;
  address: string;
  locationId: string;
}

interface AttendanceRecord {
  id: string;
  cleanerName: string;
  locationName: string;
  timestamp: string;
  selfieUrl: string;
  latitude: number;
  longitude: number;
  isWithinGeofence: boolean;
}

interface RoutineLog {
  id: string;
  cleanerName: string;
  locationName: string;
  taskTitle: string;
  frequency: string;
  cycleNumber: number;
  completedAt: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  standardAllowancePerCycle: number;
  currentStock: number;
  minStockAlert: number;
}

interface CleanerUsageLog {
  id: string;
  cleanerName: string;
  locationName: string;
  routineTitle: string;
  itemName: string;
  quantityUsed: number;
  isFlaggedAbuse: boolean;
  timestamp: string;
}

export default function SparklynApp() {
  // Navigation State
  const [role, setRole] = useState<'cleaner' | 'admin'>('cleaner');
  const [cleanerScreen, setCleanerScreen] = useState<'login' | 'clockin' | 'hub' | 'checklist' | 'inventory'>('login');
  const [adminTab, setAdminTab] = useState<'locations' | 'cleaners' | 'attendance' | 'proofs' | 'inventory'>('locations');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  // Data from Backend
  const [locations, setLocations] = useState<Location[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [routines, setRoutines] = useState<RoutineLog[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [usageLogs, setUsageLogs] = useState<CleanerUsageLog[]>([]);

  // Cleaner Active Session
  const [phoneInput, setPhoneInput] = useState('');
  const [currentCleaner, setCurrentCleaner] = useState<Cleaner | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [activeTask, setActiveTask] = useState<{ title: string; freq: string }>({ title: 'Mgt Toilet Sanitization', freq: 'Every 2 Hours' });
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clockInDone, setClockInDone] = useState(false);

  // Routine Checklist State
  const [checklist, setChecklist] = useState([
    { text: 'Sanitize toilet bowl, seat, and handle', done: true },
    { text: 'Wipe and dry mirror & counter surfaces', done: true },
    { text: 'Check and refill soap and paper towel', done: false },
    { text: 'Damp mop floor with fresh disinfectant', done: false }
  ]);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);

  // Cleaner Supply Logging State
  const [selectedSupplies, setSelectedSupplies] = useState<{ [itemId: string]: number }>({});
  const [showAbuseWarning, setShowAbuseWarning] = useState(false);

  // Admin Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editLocId, setEditLocId] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locTasks, setLocTasks] = useState<{ name: string; frequency: string }[]>([
    { name: 'Mgt Toilet Sanitization', frequency: 'Every 2 Hours' }
  ]);

  const [showCleanerModal, setShowCleanerModal] = useState(false);
  const [newCleanerName, setNewCleanerName] = useState('');
  const [newCleanerPhone, setNewCleanerPhone] = useState('');
  const [newCleanerAddress, setNewCleanerAddress] = useState('');
  const [newCleanerLocId, setNewCleanerLocId] = useState('');

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItemId, setRestockItemId] = useState('');
  const [restockQty, setRestockQty] = useState(20);
  const [restockNotes, setRestockNotes] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load Initial Data
  const refreshData = async () => {
    try {
      const [locRes, cleanRes, attRes, routRes, invRes] = await Promise.all([
        fetch('/api/locations').then(r => r.json()),
        fetch('/api/cleaners').then(r => r.json()),
        fetch('/api/attendance').then(r => r.json()),
        fetch('/api/routines').then(r => r.json()),
        fetch('/api/inventory').then(r => r.json())
      ]);

      if (locRes.locations) setLocations(locRes.locations);
      if (cleanRes.cleaners) setCleaners(cleanRes.cleaners);
      if (attRes.attendance) setAttendance(attRes.attendance);
      if (routRes.routines) setRoutines(routRes.routines);
      if (invRes.inventory) setInventory(invRes.inventory);
      if (invRes.usageLogs) setUsageLogs(invRes.usageLogs);
    } catch (err) {
      console.error('Failed to load data', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Handle Cleaner Login by Phone Number
  const handleCleanerLogin = async (overridePhone?: string) => {
    const p = overridePhone || phoneInput;
    try {
      const res = await fetch('/api/cleaner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Cleaner phone number not found');
        return;
      }
      setCurrentCleaner(data.cleaner);
      setCurrentLocation(data.location);
      setCleanerScreen('clockin');

      // Attempt live GPS coordinate capture
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            setGpsCoords({ lat: 6.5244, lng: 3.3792 });
          }
        );
      } else {
        setGpsCoords({ lat: 6.5244, lng: 3.3792 });
      }

      // Initialize camera
      startCamera();
    } catch (e) {
      alert('Network error signing in');
    }
  };

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (e) {
      console.warn('Camera stream fallback');
    }
  };

  const takeSelfie = () => {
    setSelfieImage('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=400&fit=crop&crop=faces');
  };

  const confirmClockIn = async () => {
    const selfie = selfieImage || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=400&fit=crop&crop=faces';
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: currentCleaner?.id,
          cleanerName: currentCleaner?.name,
          locationId: currentLocation?.id,
          locationName: currentLocation?.name,
          selfieUrl: selfie,
          latitude: gpsCoords?.lat || 6.5244,
          longitude: gpsCoords?.lng || 3.3792,
          accuracyMeters: 5
        })
      });
      setClockInDone(true);
      setCleanerScreen('hub');
      refreshData();
    } catch (e) {
      alert('Error recording attendance');
    }
  };

  const startRoutine = (taskName: string, freq: string) => {
    setActiveTask({ title: taskName, freq });
    setChecklist([
      { text: `Disinfect & scrub ${taskName.toLowerCase()} high-touch surfaces`, done: true },
      { text: 'Sanitize handles, faucets, and switches', done: true },
      { text: 'Verify consumables & paper supply', done: false },
      { text: 'Damp mop & dry floor with disinfectant', done: false }
    ]);
    setBeforePhoto(null);
    setAfterPhoto(null);
    setCleanerScreen('checklist');
  };

  const toggleCheck = (idx: number) => {
    const next = [...checklist];
    next[idx].done = !next[idx].done;
    setChecklist(next);
  };

  const mockSnap = (type: 'before' | 'after') => {
    if (type === 'before') {
      setBeforePhoto('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop');
    } else {
      setAfterPhoto('https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&h=400&fit=crop');
    }
  };

  const submitRoutineAndGoToInventory = async () => {
    try {
      await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: currentCleaner?.id,
          cleanerName: currentCleaner?.name,
          locationId: currentLocation?.id,
          locationName: currentLocation?.name,
          taskTitle: activeTask.title,
          frequency: activeTask.freq,
          cycleNumber: 2,
          checklist,
          beforePhotoUrl: beforePhoto || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop',
          afterPhotoUrl: afterPhoto || 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&h=400&fit=crop'
        })
      });
      // Pre-fill inventory counters with standard
      const initialSupplies: { [key: string]: number } = {};
      inventory.forEach(inv => {
        initialSupplies[inv.id] = inv.standardAllowancePerCycle || 1;
      });
      setSelectedSupplies(initialSupplies);
      setShowAbuseWarning(false);
      setCleanerScreen('inventory');
      refreshData();
    } catch (e) {
      alert('Error submitting routine');
    }
  };

  const adjustSupply = (id: string, delta: number) => {
    const cur = selectedSupplies[id] || 0;
    const nextVal = Math.max(0, cur + delta);
    const updated = { ...selectedSupplies, [id]: nextVal };
    setSelectedSupplies(updated);

    // Check if any item exceeds 3x standard
    let abuse = false;
    inventory.forEach(item => {
      const q = updated[item.id] || 0;
      if (q > (item.standardAllowancePerCycle * 3)) {
        abuse = true;
      }
    });
    setShowAbuseWarning(abuse);
  };

  const submitSupplyConsumption = async () => {
    try {
      for (const [itemId, qty] of Object.entries(selectedSupplies)) {
        if (qty > 0) {
          await fetch('/api/usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cleanerId: currentCleaner?.id,
              cleanerName: currentCleaner?.name,
              locationId: currentLocation?.id,
              locationName: currentLocation?.name,
              routineTitle: activeTask.title,
              itemId,
              quantityUsed: qty
            })
          });
        }
      }
      alert('Routine and supply consumption successfully logged!');
      setCleanerScreen('hub');
      refreshData();
    } catch (e) {
      alert('Error saving inventory usage');
    }
  };

  // Admin Login with Spark@2O26
  const unlockAdmin = async () => {
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (data.success) {
        setAdminUnlocked(true);
        setAdminError('');
      } else {
        setAdminError(data.error || 'Invalid admin password');
      }
    } catch (e) {
      setAdminError('Authentication error');
    }
  };

  // Location Management (Add/Edit)
  const openNewLocation = () => {
    setEditLocId(null);
    setLocName('');
    setLocAddress('');
    setLocTasks([{ name: 'Mgt Toilet Sanitization', frequency: 'Every 2 Hours' }]);
    setShowLocationModal(true);
  };

  const openEditLocation = (loc: Location) => {
    setEditLocId(loc.id);
    setLocName(loc.name);
    setLocAddress(loc.address);
    setLocTasks(loc.tasks && loc.tasks.length ? loc.tasks : [{ name: 'Mgt Toilet Sanitization', frequency: 'Every 2 Hours' }]);
    setShowLocationModal(true);
  };

  const addLocTaskRow = () => {
    setLocTasks([...locTasks, { name: '', frequency: 'Every 2 Hours' }]);
  };

  const updateLocTaskRow = (idx: number, field: 'name' | 'frequency', val: string) => {
    const next = [...locTasks];
    next[idx][field] = val;
    setLocTasks(next);
  };

  const removeLocTaskRow = (idx: number) => {
    const next = locTasks.filter((_, i) => i !== idx);
    setLocTasks(next);
  };

  const saveLocation = async () => {
    if (!locName.trim()) {
      alert('Location name is required');
      return;
    }
    const validTasks = locTasks.filter(t => t.name.trim() !== '');
    if (validTasks.length === 0) {
      alert('Please define at least one routine task');
      return;
    }

    try {
      if (editLocId) {
        await fetch('/api/locations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editLocId,
            name: locName,
            address: locAddress,
            tasks: validTasks
          })
        });
      } else {
        await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: locName,
            address: locAddress,
            tasks: validTasks
          })
        });
      }
      setShowLocationModal(false);
      refreshData();
    } catch (e) {
      alert('Failed to save location');
    }
  };

  // Cleaner Onboarding
  const saveCleaner = async () => {
    if (!newCleanerName.trim() || !newCleanerPhone.trim()) {
      alert('Name and phone are required');
      return;
    }
    try {
      const res = await fetch('/api/cleaners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCleanerName,
          phone: newCleanerPhone,
          address: newCleanerAddress,
          locationId: newCleanerLocId || (locations[0] ? locations[0].id : '')
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to onboard cleaner');
        return;
      }
      setShowCleanerModal(false);
      setNewCleanerName('');
      setNewCleanerPhone('');
      setNewCleanerAddress('');
      refreshData();
      alert(`Cleaner ${newCleanerName} onboarded successfully!`);
    } catch (e) {
      alert('Error onboarding cleaner');
    }
  };

  // Restock Inventory
  const saveRestock = async () => {
    const targetItemId = restockItemId || (inventory[0] ? inventory[0].id : '');
    if (!targetItemId || restockQty <= 0) {
      alert('Select item and positive quantity');
      return;
    }
    try {
      await fetch('/api/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: targetItemId,
          quantityAdded: restockQty,
          restockedBy: 'Admin',
          notes: restockNotes || 'Restocked Batch'
        })
      });
      setShowRestockModal(false);
      refreshData();
      alert(`Restocked +${restockQty} units!`);
    } catch (e) {
      alert('Error logging restock');
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-800">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 font-bold flex items-center justify-center text-sm tracking-tight shadow-sm">
              S
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-none">Sparklyn</h1>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-none">
                {role === 'cleaner' ? 'Cleaner Routine App' : 'Admin Operations Hub'}
              </p>
            </div>
          </div>

          {/* Role Toggle Button */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setRole('cleaner')}
              className={`px-2.5 py-1 rounded-md transition font-semibold ${
                role === 'cleaner' ? 'bg-zinc-100 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cleaner
            </button>
            <button
              onClick={() => setRole('admin')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                role === 'admin' ? 'bg-zinc-100 text-zinc-950 shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <main className="flex-1 p-4 pb-20 space-y-4">

        {/* ======================================================== */}
        {/* 1. CLEANER MOBILE INTERFACE                              */}
        {/* ======================================================== */}
        {role === 'cleaner' && (
          <div className="space-y-4">

            {/* SCREEN 1: PHONE NUMBER LOGIN */}
            {cleanerScreen === 'login' && (
              <div className="space-y-4 pt-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Sign in to your shift</h2>
                  <p className="text-xs text-zinc-400 mt-1">Enter your registered mobile phone number collected by Admin</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Registered Phone Number</label>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="e.g. +234..."
                      className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 font-mono transition"
                    />
                  </div>

                  <button
                    onClick={() => handleCleanerLogin()}
                    className="w-full mt-2 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    Verify & Continue <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 2: MORNING LIVE SELFIE & GPS CLOCK-IN */}
            {cleanerScreen === 'clockin' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Morning Attendance</h2>
                    <p className="text-xs text-zinc-400">Live selfie & GPS location verification</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    Step 1
                  </span>
                </div>

                <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">{currentCleaner?.name}</p>
                    <p className="text-[11px] text-zinc-400">📍 {currentLocation?.name || 'Assigned Facility'}</p>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Ready
                  </span>
                </div>

                {/* Camera Viewfinder */}
                <div className="relative bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden aspect-[4/3] flex flex-col items-center justify-center">
                  {selfieImage ? (
                    <img src={selfieImage} className="w-full h-full object-cover" alt="Captured selfie" />
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <Camera className="w-10 h-10 text-zinc-400 mx-auto" />
                      <p className="text-xs font-medium text-zinc-300">Live Camera Selfie Required</p>
                      <p className="text-[11px] text-zinc-500">Direct camera stream prevents spoofing</p>
                      <button
                        onClick={takeSelfie}
                        className="mt-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700"
                      >
                        Snap Live Selfie
                      </button>
                    </div>
                  )}

                  {selfieImage && (
                    <button
                      onClick={() => setSelfieImage(null)}
                      className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] text-zinc-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Retake
                    </button>
                  )}
                </div>

                {/* Geotag Indicator */}
                <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> GPS Geotag Lock
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400">Within Geofence (35m)</span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-300">
                    {gpsCoords ? `${gpsCoords.lat.toFixed(4)}° N, ${gpsCoords.lng.toFixed(4)}° E (±5m)` : 'Acquiring GPS fix...'}
                  </p>
                </div>

                <button
                  onClick={confirmClockIn}
                  className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99]"
                >
                  Confirm Attendance & View Routine
                </button>
              </div>
            )}

            {/* SCREEN 3: ACTIVE ROUTINE HUB (MULTIPLE TIMES A DAY) */}
            {cleanerScreen === 'hub' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                  <div>
                    <h2 className="text-sm font-bold text-white">{currentLocation?.name}</h2>
                    <p className="text-[11px] text-zinc-400">
                      Cleaner: <span className="text-zinc-200 font-medium">{currentCleaner?.name}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Clocked In
                  </span>
                </div>

                {/* Active Focus Card */}
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Next Scheduled Task</span>
                      <h3 className="text-base font-bold text-white mt-0.5">
                        {currentLocation?.tasks[0]?.name || 'Mgt Toilet Sanitization'}
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Configured Interval: <span className="text-zinc-200 font-semibold">{currentLocation?.tasks[0]?.frequency || 'Every 2 Hours'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-emerald-400">Due Now</span>
                      <p className="text-[10px] text-zinc-500">Cycle 2</p>
                    </div>
                  </div>

                  <button
                    onClick={() => startRoutine(currentLocation?.tasks[0]?.name || 'Mgt Toilet Sanitization', currentLocation?.tasks[0]?.frequency || 'Every 2 Hours')}
                    className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    Start Guided Routine <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dynamic Task List from Assigned Location */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Location Tasks ({currentLocation?.tasks.length || 0})
                  </h4>

                  {currentLocation?.tasks.map((task, idx) => (
                    <div key={idx} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">{task.name}</p>
                        <p className="text-[11px] text-zinc-400">Frequency: {task.frequency}</p>
                      </div>
                      <button
                        onClick={() => startRoutine(task.name, task.frequency)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                      >
                        Execute
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => {
                      const initialSupplies: { [key: string]: number } = {};
                      inventory.forEach(inv => { initialSupplies[inv.id] = inv.standardAllowancePerCycle || 1; });
                      setSelectedSupplies(initialSupplies);
                      setCleanerScreen('inventory');
                    }}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" /> Direct Supply Logger
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 4: ROUTINE CHECKLIST & BEFORE/AFTER LIVE PHOTOS */}
            {cleanerScreen === 'checklist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <button
                    onClick={() => setCleanerScreen('hub')}
                    className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Routines
                  </button>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-white">{activeTask.title}</h3>
                    <span className="text-[10px] text-zinc-400">{activeTask.freq}</span>
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <label
                      key={idx}
                      onClick={() => toggleCheck(idx)}
                      className="flex items-start gap-3 p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        readOnly
                        className="mt-0.5 rounded border-zinc-700 text-zinc-100 focus:ring-0"
                      />
                      <div className="text-xs">
                        <p className={`font-medium ${item.done ? 'text-zinc-200 line-through opacity-70' : 'text-white'}`}>
                          {item.text}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Photo Proofs */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Routine Proof Photos</span>
                    <span className="text-[10px] text-zinc-400">Live camera only</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Before Card */}
                    <div className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center space-y-1.5">
                      <span className="text-[11px] font-medium text-zinc-300">Before Clean</span>
                      <div
                        onClick={() => mockSnap('before')}
                        className="aspect-square bg-zinc-950 rounded-lg border border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 overflow-hidden"
                      >
                        {beforePhoto ? (
                          <img src={beforePhoto} className="w-full h-full object-cover" alt="Before clean" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 text-zinc-500" />
                            <span className="text-[10px] text-zinc-500 mt-1">Tap to capture</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* After Card */}
                    <div className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center space-y-1.5">
                      <span className="text-[11px] font-medium text-emerald-400">After Clean Proof</span>
                      <div
                        onClick={() => mockSnap('after')}
                        className="aspect-square bg-zinc-950 rounded-lg border border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 overflow-hidden"
                      >
                        {afterPhoto ? (
                          <img src={afterPhoto} className="w-full h-full object-cover" alt="After clean" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5 text-zinc-500" />
                            <span className="text-[10px] text-zinc-500 mt-1">Tap to capture</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={submitRoutineAndGoToInventory}
                  className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5"
                >
                  Next: Log Supplies Used <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* SCREEN 5: INVENTORY LOGGING WITH ABUSE DETECTION */}
            {cleanerScreen === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <button
                    onClick={() => setCleanerScreen('hub')}
                    className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <span className="text-xs font-bold text-white">Log Supplies Used</span>
                  <span className="text-[10px] text-zinc-400">Anti-Abuse</span>
                </div>

                <p className="text-xs text-zinc-400">Enter supplies consumed during this cycle to keep inventory balances accurate.</p>

                <div className="space-y-2">
                  {inventory.map(item => (
                    <div key={item.id} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <p className="text-[10px] text-zinc-400">Standard SOP: ~{item.standardAllowancePerCycle} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustSupply(item.id, -(item.standardAllowancePerCycle || 1))}
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-white font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono font-semibold w-14 text-center">
                          {selectedSupplies[item.id] || 0} {item.unit}
                        </span>
                        <button
                          onClick={() => adjustSupply(item.id, (item.standardAllowancePerCycle || 1))}
                          className="w-7 h-7 rounded-lg bg-zinc-800 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Abuse Warning Banner */}
                {showAbuseWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <AlertTriangle className="w-4 h-4" /> Abnormal Supply Spike Detected
                    </div>
                    <p className="text-[11px] text-zinc-300">
                      You selected a quantity more than 3x the standard baseline. This routine will be flagged for Manager review.
                    </p>
                  </div>
                )}

                <button
                  onClick={submitSupplyConsumption}
                  className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99]"
                >
                  Confirm & Submit Routine Log ✓
                </button>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* 2. ADMIN MOBILE-FIRST INTERFACE                          */}
        {/* ======================================================== */}
        {role === 'admin' && (
          <div className="space-y-4">

            {/* ADMIN PASSWORD GATE */}
            {!adminUnlocked && (
              <div className="space-y-4 pt-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Admin Authentication</h2>
                  <p className="text-xs text-zinc-400 mt-1">Encrypted master access for operations and control</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Master Password</label>
                    <input
                      type="password"
                      value={adminPasswordInput}
                      onChange={e => setAdminPasswordInput(e.target.value)}
                      placeholder="Password..."
                      className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 font-mono transition"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Password preset: <code className="text-zinc-300">Spark@2O26</code> (Letter O)
                    </p>
                  </div>

                  {adminError && (
                    <div className="text-xs text-rose-400 font-medium">
                      {adminError}
                    </div>
                  )}

                  <button
                    onClick={unlockAdmin}
                    className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" /> Unlock Admin Hub
                  </button>
                </div>
              </div>
            )}

            {/* ADMIN DASHBOARD TABS */}
            {adminUnlocked && (
              <div className="space-y-4">

                {/* Subtab Pills */}
                <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1 border-b border-zinc-800/60 text-xs">
                  <button
                    onClick={() => setAdminTab('locations')}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'locations' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Locations ({locations.length})
                  </button>
                  <button
                    onClick={() => setAdminTab('cleaners')}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'cleaners' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Cleaners ({cleaners.length})
                  </button>
                  <button
                    onClick={() => setAdminTab('attendance')}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'attendance' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Live Attendance
                  </button>
                  <button
                    onClick={() => setAdminTab('proofs')}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'proofs' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Proofs ({routines.length})
                  </button>
                  <button
                    onClick={() => setAdminTab('inventory')}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'inventory' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Inventory & Abuse
                  </button>
                </div>

                {/* 1. LOCATIONS WITH MULTI-TASK & FREQUENCY (CREATE & EDIT) */}
                {adminTab === 'locations' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Locations & Schedules</h3>
                        <p className="text-[11px] text-zinc-500">Multiple tasks & individual cleaning frequencies</p>
                      </div>
                      <button
                        onClick={openNewLocation}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Location
                      </button>
                    </div>

                    <div className="space-y-3">
                      {locations.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No locations added yet</p>
                          <p className="text-[11px] text-zinc-500">Tap "+ Location" above to create your first facility and routine tasks.</p>
                        </div>
                      ) : (
                        locations.map(loc => (
                          <div key={loc.id} className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-2.5">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{loc.name}</h4>
                                <p className="text-[11px] text-zinc-400">{loc.address}</p>
                              </div>
                              <button
                                onClick={() => openEditLocation(loc)}
                                className="text-xs font-medium px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </button>
                            </div>

                            <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/70 space-y-0.5">
                              <span className="text-[10px] uppercase font-semibold text-zinc-500 block mb-1">
                                Scheduled Tasks ({loc.tasks.length}):
                              </span>
                              {loc.tasks.map((t, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1 border-b border-zinc-800/40 last:border-0 text-[11px]">
                                  <span className="text-zinc-200">{t.name}</span>
                                  <span className="font-medium text-zinc-400">{t.frequency}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 2. CLEANER ONBOARDING DIRECTORY */}
                {adminTab === 'cleaners' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cleaner Directory</h3>
                        <p className="text-[11px] text-zinc-500">Onboarded staff with mobile phone login</p>
                      </div>
                      <button
                        onClick={() => setShowCleanerModal(true)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Onboard
                      </button>
                    </div>

                    <div className="space-y-2">
                      {cleaners.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No cleaners onboarded yet</p>
                          <p className="text-[11px] text-zinc-500">Tap "+ Onboard" above to register your cleaning staff.</p>
                        </div>
                      ) : (
                        cleaners.map(c => {
                          const loc = locations.find(l => l.id === c.locationId);
                          return (
                            <div key={c.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-white">{c.name}</p>
                                <p className="text-[11px] font-mono text-zinc-400">{c.phone}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">📍 {loc?.name || 'Unassigned'}</p>
                              </div>
                              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Active
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 3. LIVE ATTENDANCE & GEOTAG SELFIES */}
                {adminTab === 'attendance' && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Morning Attendance Feed</h3>
                      <p className="text-[11px] text-zinc-500">Live selfie & GPS geofence checks</p>
                    </div>

                    <div className="space-y-3">
                      {attendance.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No attendance records today</p>
                          <p className="text-[11px] text-zinc-500">Cleaners will appear here as they clock in with live selfies.</p>
                        </div>
                      ) : (
                        attendance.map(att => (
                          <div key={att.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-white">{att.cleanerName}</p>
                                <p className="text-[11px] text-zinc-400">{att.locationName}</p>
                              </div>
                              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                Verified
                              </span>
                            </div>
                            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
                              <img src={att.selfieUrl} className="w-full h-full object-cover" alt="Cleaner selfie" />
                            </div>
                            <p className="text-[10px] font-mono text-zinc-400">
                              📍 {att.latitude.toFixed(4)}° N, {att.longitude.toFixed(4)}° E
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. CLEANING PROOFS (BEFORE/AFTER PHOTOS) */}
                {adminTab === 'proofs' && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Routine Photo Proofs</h3>
                      <p className="text-[11px] text-zinc-500">Audited multiple times per day</p>
                    </div>

                    <div className="space-y-3">
                      {routines.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No routine proofs submitted yet</p>
                          <p className="text-[11px] text-zinc-500">Before & After photo proofs will be logged here as routines are executed.</p>
                        </div>
                      ) : (
                        routines.map(rout => (
                          <div key={rout.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-white">{rout.taskTitle}</p>
                                <p className="text-[11px] text-zinc-400">{rout.cleanerName} • {rout.locationName}</p>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-medium">Approved SOP</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-zinc-400 block mb-1">Before Clean</span>
                                <div className="aspect-square rounded-lg bg-black overflow-hidden border border-zinc-800">
                                  <img src={rout.beforePhotoUrl} className="w-full h-full object-cover" alt="Before clean" />
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] text-emerald-400 block mb-1">After Clean</span>
                                <div className="aspect-square rounded-lg bg-black overflow-hidden border border-emerald-500/40">
                                  <img src={rout.afterPhotoUrl} className="w-full h-full object-cover" alt="After clean" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 5. INVENTORY RESTOCK & ABUSE TRACKING */}
                {adminTab === 'inventory' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Inventory & Abuse</h3>
                        <p className="text-[11px] text-zinc-500">Restocks vs cleaner consumption</p>
                      </div>
                      <button
                        onClick={() => setShowRestockModal(true)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Restock
                      </button>
                    </div>

                    {/* Stock Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {inventory.map(item => (
                        <div key={item.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                          <span className="text-[10px] text-zinc-400 block">{item.name}</span>
                          <p className="text-base font-bold text-white mt-0.5">
                            {item.currentStock} <span className="text-xs font-normal text-zinc-400">{item.unit}</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1">SOP: ~{item.standardAllowancePerCycle}/cycle</p>
                        </div>
                      ))}
                    </div>

                    {/* Flagged Abuse Logs */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Supply Audit Logs</h4>
                      {usageLogs.length === 0 ? (
                        <div className="p-4 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-xs text-zinc-500">
                          <p>No supply usage logged yet.</p>
                        </div>
                      ) : (
                        usageLogs.map(log => (
                          <div
                            key={log.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                              log.isFlaggedAbuse
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-300'
                            }`}
                          >
                            <div>
                              <p className="font-medium text-white">{log.itemName}</p>
                              <p className="text-[10px] text-zinc-400">{log.cleanerName} • {log.routineTitle}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold">-{log.quantityUsed}</span>
                              {log.isFlaggedAbuse && (
                                <span className="text-[9px] block text-rose-400 font-bold uppercase">Abuse Flag</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT LOCATION & MULTI-TASKS            */}
      {/* ======================================================== */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">
                {editLocId ? 'Edit Location & Tasks' : 'Create Location & Tasks'}
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Facility Name</label>
                <input
                  type="text"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  placeholder="e.g. Sparklyn HQ - Executive Floors"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-400 mb-1">Address</label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={e => setLocAddress(e.target.value)}
                  placeholder="e.g. Plot 14, Victoria Island, Lagos"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Dynamic Task Rows */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-white">Tasks & Routine Frequencies</label>
                  <button
                    type="button"
                    onClick={addLocTaskRow}
                    className="text-[11px] text-zinc-300 hover:text-white font-medium underline"
                  >
                    + Add Task
                  </button>
                </div>

                <div className="space-y-2">
                  {locTasks.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={t.name}
                        onChange={e => updateLocTaskRow(idx, 'name', e.target.value)}
                        placeholder="Task name (e.g. Mgt toilet)"
                        className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:border-zinc-500"
                      />
                      <select
                        value={t.frequency}
                        onChange={e => updateLocTaskRow(idx, 'frequency', e.target.value)}
                        className="w-36 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs"
                      >
                        <option>Hourly</option>
                        <option>Every 2 Hours</option>
                        <option>Every 3 Hours</option>
                        <option>Every 4 Hours</option>
                        <option>Twice Daily</option>
                        <option>Daily</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeLocTaskRow(idx)}
                        className="text-zinc-500 hover:text-rose-400 px-1 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowLocationModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 font-medium rounded-xl text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={saveLocation}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs"
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ONBOARD CLEANER */}
      {showCleanerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Onboard Cleaner</h3>
              <button onClick={() => setShowCleanerModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newCleanerName}
                  onChange={e => setNewCleanerName(e.target.value)}
                  placeholder="e.g. Samuel Adekunle"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Phone Number (Login Key)</label>
                <input
                  type="tel"
                  value={newCleanerPhone}
                  onChange={e => setNewCleanerPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={newCleanerAddress}
                  onChange={e => setNewCleanerAddress(e.target.value)}
                  placeholder="e.g. 15 Ikoyi Road, Lagos"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Assigned Location</label>
                <select
                  value={newCleanerLocId}
                  onChange={e => setNewCleanerLocId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowCleanerModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 font-medium rounded-xl text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={saveCleaner}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs"
              >
                Onboard Cleaner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RESTOCK INVENTORY */}
      {showRestockModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Log Supply Restock</h3>
              <button onClick={() => setShowRestockModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Item</label>
                <select
                  value={restockItemId}
                  onChange={e => setRestockItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white"
                >
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Quantity Added</label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={e => setRestockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Batch / Supplier Note</label>
                <input
                  type="text"
                  value={restockNotes}
                  onChange={e => setRestockNotes(e.target.value)}
                  placeholder="e.g. Central Warehouse batch #405"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowRestockModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 font-medium rounded-xl text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={saveRestock}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs"
              >
                Add to Stock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
