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
  RotateCcw,
  LogOut
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
  cleanerId?: string;
  cleanerName: string;
  locationId?: string;
  locationName: string;
  taskTitle: string;
  frequency: string;
  cycleNumber: number;
  completedAt: string;
  checklist?: { item?: string; text?: string; done: boolean }[];
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
  const [adminToken, setAdminToken] = useState('');
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
  const [activeTask, setActiveTask] = useState<{ title: string; freq: string }>({ title: '', freq: '' });
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clockInDone, setClockInDone] = useState(false);

  // Routine Checklist State
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>([]);
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
    { name: '', frequency: 'Every 2 Hours' }
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

  // Add Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('bottles');
  const [newItemAllowance, setNewItemAllowance] = useState(1);
  const [newItemStock, setNewItemStock] = useState(10);
  const [newItemMinAlert, setNewItemMinAlert] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const beforeInputRef = useRef<HTMLInputElement | null>(null);
  const afterInputRef = useRef<HTMLInputElement | null>(null);

  // Load Initial Data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const headers = { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' };
      const cacheBust = '?t=' + Date.now();
      const [locRes, cleanRes, attRes, routRes, invRes] = await Promise.all([
        fetch('/api/locations' + cacheBust, { cache: 'no-store', headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/cleaners' + cacheBust, { cache: 'no-store', headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/attendance' + cacheBust, { cache: 'no-store', headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/routines' + cacheBust, { cache: 'no-store', headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/inventory' + cacheBust, { cache: 'no-store', headers }).then(r => r.json()).catch(() => ({}))
      ]);

      if (locRes.locations) setLocations(locRes.locations);
      if (cleanRes.cleaners) setCleaners(cleanRes.cleaners);
      if (attRes.attendance) setAttendance(attRes.attendance);
      if (routRes.routines) setRoutines(routRes.routines);
      if (invRes.inventory) setInventory(invRes.inventory);
      if (invRes.usageLogs) setUsageLogs(invRes.usageLogs);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
    checkAdminAuth();
  }, []);

  // Poll for updates in Admin view
  useEffect(() => {
    if (adminUnlocked && role === 'admin') {
      const timer = setInterval(() => {
        refreshData();
      }, 10000);
      return () => clearInterval(timer);
    }
  }, [adminUnlocked, role]);

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
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          err => {
            console.warn('Geolocation unavailable:', err.message);
            setGpsCoords(null);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setGpsCoords(null);
      }

      // Initialize camera
      startCamera();
    } catch (e) {
      alert('Network error signing in');
    }
  };

  const startCamera = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (e) {
      console.warn('Live camera stream not supported or denied; file capture fallback available');
    }
  };

  const takeSelfie = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelfieImage(dataUrl);
        // Stop stream tracks to free camera hardware
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
        return;
      }
    }
    // Fallback if live video stream has no frame: trigger native file camera capture
    if (selfieInputRef.current) {
      selfieInputRef.current.click();
    }
  };

  const handleSelfieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelfieImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmClockIn = async () => {
    if (!selfieImage) {
      alert('Live selfie capture is required to clock in.');
      return;
    }
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: currentCleaner?.id,
          cleanerName: currentCleaner?.name,
          locationId: currentLocation?.id,
          locationName: currentLocation?.name,
          selfieUrl: selfieImage,
          latitude: gpsCoords?.lat || 0,
          longitude: gpsCoords?.lng || 0,
          accuracyMeters: gpsCoords ? 5 : 0
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
      { text: `Disinfect & scrub ${taskName.toLowerCase()} high-touch surfaces`, done: false },
      { text: 'Sanitize handles, faucets, and switches', done: false },
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

  const handleProofPhotoCapture = (type: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (type === 'before') {
          setBeforePhoto(reader.result);
        } else {
          setAfterPhoto(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const submitRoutineAndGoToInventory = async () => {
    if (!beforePhoto || !afterPhoto) {
      alert('Please capture both Before and After clean photo proofs to proceed.');
      return;
    }
    try {
      const todayRoutines = routines.filter(
        r => ((r.cleanerId && currentCleaner?.id) ? r.cleanerId === currentCleaner.id : r.cleanerName === currentCleaner?.name) &&
             new Date(r.completedAt).toDateString() === new Date().toDateString()
      );
      const cycleNumber = todayRoutines.length + 1;

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
          cycleNumber,
          checklist,
          beforePhotoUrl: beforePhoto,
          afterPhotoUrl: afterPhoto
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

  // Admin Session Verification
  const checkAdminAuth = async () => {
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('sparklyn_admin_token') : null;
      const res = await fetch('/api/admin-auth', {
        headers: stored ? { Authorization: `Bearer ${stored}` } : {}
      });
      const data = await res.json();
      if (data.authenticated) {
        setAdminUnlocked(true);
        if (stored) setAdminToken(stored);
      }
    } catch {
      // Ignore background check failure
    }
  };

  const getAuthHeaders = (): { [key: string]: string } => {
    const headers: { [key: string]: string } = { 'Content-Type': 'application/json' };
    const token =
      adminToken ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('sparklyn_admin_token') || '' : '');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

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
        if (data.token) {
          setAdminToken(data.token);
          try {
            sessionStorage.setItem('sparklyn_admin_token', data.token);
          } catch {}
        }
        setAdminError('');
        setAdminPasswordInput('');
        refreshData();
      } else {
        setAdminError(data.error || 'Invalid admin credentials');
      }
    } catch (e) {
      setAdminError('Authentication error');
    }
  };

  const logoutAdmin = async () => {
    try {
      await fetch('/api/admin-auth', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'logout' })
      });
    } finally {
      setAdminUnlocked(false);
      setAdminToken('');
      try {
        sessionStorage.removeItem('sparklyn_admin_token');
      } catch {}
      setAdminPasswordInput('');
    }
  };

  // Location Management (Add/Edit)
  const openNewLocation = () => {
    setEditLocId(null);
    setLocName('');
    setLocAddress('');
    setLocTasks([{ name: '', frequency: 'Every 2 Hours' }]);
    setShowLocationModal(true);
  };

  const openEditLocation = (loc: Location) => {
    setEditLocId(loc.id);
    setLocName(loc.name);
    setLocAddress(loc.address);
    setLocTasks(loc.tasks && loc.tasks.length ? loc.tasks : [{ name: '', frequency: 'Every 2 Hours' }]);
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
      let res: Response;
      if (editLocId) {
        res = await fetch('/api/locations', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: editLocId,
            name: locName,
            address: locAddress,
            tasks: validTasks
          })
        });
      } else {
        res = await fetch('/api/locations', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: locName,
            address: locAddress,
            tasks: validTasks
          })
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to save location');
        return;
      }
      setShowLocationModal(false);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Failed to save location');
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newCleanerName,
          phone: newCleanerPhone,
          address: newCleanerAddress,
          locationId: newCleanerLocId || (locations[0] ? locations[0].id : '')
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to onboard cleaner');
        return;
      }
      setShowCleanerModal(false);
      setNewCleanerName('');
      setNewCleanerPhone('');
      setNewCleanerAddress('');
      refreshData();
      alert(`Cleaner ${newCleanerName} onboarded successfully!`);
    } catch (e: any) {
      alert(e.message || 'Error onboarding cleaner');
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
      const res = await fetch('/api/restock', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          itemId: targetItemId,
          quantityAdded: restockQty,
          restockedBy: 'Admin',
          notes: restockNotes || 'Restocked Batch'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to process restock');
        return;
      }
      setShowRestockModal(false);
      refreshData();
      alert(`Restocked +${restockQty} units!`);
    } catch (e: any) {
      alert(e.message || 'Error logging restock');
    }
  };

  // Add Custom Inventory Item
  const saveNewInventoryItem = async () => {
    if (!newItemName.trim() || !newItemUnit.trim()) {
      alert('Item name and unit of measurement are required');
      return;
    }
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newItemName,
          unit: newItemUnit,
          standardAllowancePerCycle: newItemAllowance,
          currentStock: newItemStock,
          minStockAlert: newItemMinAlert
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to add item');
        return;
      }
      setShowAddItemModal(false);
      setNewItemName('');
      setNewItemStock(10);
      refreshData();
      alert(`Item "${newItemName}" added successfully!`);
    } catch (e: any) {
      alert(e.message || 'Error adding inventory item');
    }
  };

  // Delete Inventory Item
  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from inventory?`)) return;
    try {
      const res = await fetch(`/api/inventory?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to delete item');
        return;
      }
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Error deleting item');
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
                  <input
                    type="file"
                    ref={selfieInputRef}
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handleSelfieFileUpload}
                  />

                  {selfieImage ? (
                    <img src={selfieImage} className="w-full h-full object-cover" alt="Captured selfie" />
                  ) : (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3 items-center space-y-1.5">
                        <p className="text-[11px] text-zinc-300 font-medium">Live selfie camera feed</p>
                        <button
                          type="button"
                          onClick={takeSelfie}
                          className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-semibold rounded-full shadow-lg active:scale-95 transition flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" /> Snap Live Selfie
                        </button>
                      </div>
                    </div>
                  )}

                  {selfieImage && (
                    <button
                      onClick={() => {
                        setSelfieImage(null);
                        startCamera();
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 backdrop-blur rounded-lg text-[10px] text-zinc-200 hover:text-white flex items-center gap-1 border border-white/10"
                    >
                      <RotateCcw className="w-3 h-3" /> Retake
                    </button>
                  )}
                </div>

                {/* Geotag Indicator */}
                <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${gpsCoords ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span> GPS Geotag
                    </span>
                    <span className={`text-[10px] font-semibold ${gpsCoords ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {gpsCoords ? 'GPS Fix Locked' : 'Acquiring GPS Signal...'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-300">
                    {gpsCoords ? `${gpsCoords.lat.toFixed(4)}° N, ${gpsCoords.lng.toFixed(4)}° E (±5m)` : 'Please ensure device location is enabled'}
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
                {currentLocation?.tasks && currentLocation.tasks.length > 0 ? (
                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Next Scheduled Task</span>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          {currentLocation.tasks[0].name}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Configured Interval: <span className="text-zinc-200 font-semibold">{currentLocation.tasks[0].frequency}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-400">Ready</span>
                        <p className="text-[10px] text-zinc-500">
                          Cycle {routines.filter(r => ((r.cleanerId && currentCleaner?.id) ? r.cleanerId === currentCleaner.id : r.cleanerName === currentCleaner?.name) && new Date(r.completedAt).toDateString() === new Date().toDateString()).length + 1}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => startRoutine(currentLocation.tasks[0].name, currentLocation.tasks[0].frequency)}
                      className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
                    >
                      Start Guided Routine <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center space-y-1.5">
                    <p className="text-xs font-semibold text-white">No tasks configured for this site</p>
                    <p className="text-[11px] text-zinc-400">Ask your admin to add routine tasks to {currentLocation?.name || 'this location'}.</p>
                  </div>
                )}

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
                      <input
                        type="file"
                        ref={beforeInputRef}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => handleProofPhotoCapture('before', e)}
                      />
                      <div
                        onClick={() => beforeInputRef.current?.click()}
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
                      <input
                        type="file"
                        ref={afterInputRef}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => handleProofPhotoCapture('after', e)}
                      />
                      <div
                        onClick={() => afterInputRef.current?.click()}
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
                  {inventory.length === 0 ? (
                    <div className="p-4 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl text-xs text-zinc-400">
                      <p className="font-semibold text-white">No supplies tracked</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Your manager has not configured any tracked cleaning items yet.</p>
                    </div>
                  ) : (
                    inventory.map(item => (
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
                    ))
                  )}
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
                      autoComplete="new-password"
                      name="sparklyn-admin-pass"
                      value={adminPasswordInput}
                      onChange={e => setAdminPasswordInput(e.target.value)}
                      placeholder="Enter master password..."
                      className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 font-mono transition"
                    />
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
                <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1 border-b border-zinc-800/60 text-xs items-center">
                  <button
                    onClick={() => { setAdminTab('locations'); refreshData(); }}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'locations' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Locations ({locations.length})
                  </button>
                  <button
                    onClick={() => { setAdminTab('cleaners'); refreshData(); }}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'cleaners' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Cleaners ({cleaners.length})
                  </button>
                  <button
                    onClick={() => { setAdminTab('attendance'); refreshData(); }}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'attendance' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Live Attendance ({attendance.length})
                  </button>
                  <button
                    onClick={() => { setAdminTab('proofs'); refreshData(); }}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'proofs' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Proofs ({routines.length})
                  </button>
                  <button
                    onClick={() => { setAdminTab('inventory'); refreshData(); }}
                    className={`px-3 py-1.5 rounded-lg flex-shrink-0 transition ${
                      adminTab === 'inventory' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Inventory ({inventory.length})
                  </button>

                  <button
                    onClick={refreshData}
                    title="Refresh data"
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition flex items-center"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={logoutAdmin}
                    title="Lock admin session"
                    className="ml-auto px-2.5 py-1.5 rounded-lg flex-shrink-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 transition flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" /> Lock
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
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Inventory & Supplies</h3>
                        <p className="text-[11px] text-zinc-500">Track facility chemicals & consumables</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg text-xs transition flex items-center gap-1 border border-zinc-700"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                        <button
                          onClick={() => {
                            if (inventory.length === 0) {
                              alert('Please add at least one inventory item first using "+ Add Item"');
                              return;
                            }
                            setShowRestockModal(true);
                          }}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                        >
                          <Package className="w-3.5 h-3.5" /> Restock
                        </button>
                      </div>
                    </div>

                    {/* Stock Grid */}
                    {inventory.length === 0 ? (
                      <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-2">
                        <Package className="w-8 h-8 text-zinc-600 mx-auto" />
                        <div>
                          <p className="font-semibold text-white">No inventory items added yet</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">Click "+ Add Item" to configure the real chemicals and cleaning supplies used by cleaners.</p>
                        </div>
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          className="mt-1 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg"
                        >
                          + Add First Item
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {inventory.map(item => (
                          <div key={item.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl relative group">
                            <button
                              onClick={() => deleteItem(item.id, item.name)}
                              title="Delete item"
                              className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-rose-400 rounded opacity-60 hover:opacity-100 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-zinc-400 block pr-4 truncate font-medium">{item.name}</span>
                            <p className="text-base font-bold text-white mt-0.5">
                              {item.currentStock} <span className="text-xs font-normal text-zinc-400">{item.unit}</span>
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1">SOP: ~{item.standardAllowancePerCycle} {item.unit}/cycle</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Flagged Abuse Logs */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Supply Audit Logs ({usageLogs.length})</h4>
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

      {/* MODAL 4: ADD CUSTOM INVENTORY ITEM */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Add Inventory Item</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-400 mb-1">Item Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="e.g. Toilet Bowl Cleaner, Bleach, Floor Wash"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    placeholder="e.g. bottles, rolls, liters"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={newItemStock}
                    onChange={e => setNewItemStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">SOP per Cycle</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newItemAllowance}
                    onChange={e => setNewItemAllowance(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={newItemMinAlert}
                    onChange={e => setNewItemMinAlert(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 font-medium rounded-xl text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={saveNewInventoryItem}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
