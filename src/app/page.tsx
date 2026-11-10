'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getNigeriaTime, NigeriaTimeInfo } from '../lib/nigeriaTime';
import { playChimeAlarm, parseFrequencyToMinutes } from '../lib/alarm';
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
  LogOut,
  Sun,
  Moon,
  Bell,
  BellOff,
  Volume2,
  Timer
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
  startedAt?: string;
  durationMinutes?: number;
  checklist?: { item?: string; text?: string; done: boolean; startedAt?: string; durationMinutes?: number }[];
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
  const [role, setRole] = useState<'cleaner' | 'admin' | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [cleanerScreen, setCleanerScreen] = useState<'clockin' | 'hub' | 'checklist' | 'inventory'>('clockin');
  const [adminTab, setAdminTab] = useState<'locations' | 'cleaners' | 'attendance' | 'proofs' | 'inventory'>('locations');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

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
  const [clockOutDone, setClockOutDone] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [attendanceMode, setAttendanceMode] = useState<'in' | 'out'>('in');
  const [nigeriaTime, setNigeriaTime] = useState<NigeriaTimeInfo>(getNigeriaTime());
  const [isSubmittingRoutine, setIsSubmittingRoutine] = useState(false);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

  // Helper to persist cleaner session across page refreshes
  const saveCleanerSession = (updates: Partial<{
    cleaner: Cleaner | null;
    location: Location | null;
    cleanerScreen: 'clockin' | 'hub' | 'checklist' | 'inventory';
    clockInDone: boolean;
    clockOutDone: boolean;
    clockInTime: string | null;
    clockOutTime: string | null;
    routineStage: 'before' | 'in_progress';
    routineStartedAt: string | null;
    beforePhoto: string | null;
    afterPhoto: string | null;
    phone: string;
    activeTask: { title: string; freq: string };
    checklist: { text: string; done: boolean }[];
  }>) => {
    if (typeof window === 'undefined') return;
    try {
      const existing = localStorage.getItem('sparklyn_cleaner_session');
      const base = existing ? JSON.parse(existing) : {};
      const merged = { ...base, ...updates };
      localStorage.setItem('sparklyn_cleaner_session', JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save cleaner session', e);
    }
  };

  // Two-Stage Routine States: Stage 1 Before Clean Inspection -> Stage 2 Cleaning in progress & After Proof
  const [routineStage, setRoutineStage] = useState<'before' | 'in_progress'>('before');
  const [routineStartedAt, setRoutineStartedAt] = useState<string | null>(null);
  const [elapsedCleaningSeconds, setElapsedCleaningSeconds] = useState(0);

  // Routine Alarm & Audio Reminders
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(true);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [alarmTaskTitle, setAlarmTaskTitle] = useState('');
  const [alarmTaskFreq, setAlarmTaskFreq] = useState('');
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [nextDueRoutine, setNextDueRoutine] = useState<{
    taskName: string;
    freq: string;
    dueTime: number;
    isOverdue: boolean;
    diffMinutes: number;
    timeString: string;
  } | null>(null);

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

  // Keep West Africa / Nigeria Time current
  useEffect(() => {
    setNigeriaTime(getNigeriaTime());
    const timer = setInterval(() => {
      setNigeriaTime(getNigeriaTime());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Restore session from localStorage on initial page load (prevents logout on refresh)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedCleaner = localStorage.getItem('sparklyn_cleaner_session');
        if (savedCleaner) {
          const parsed = JSON.parse(savedCleaner);
          if (parsed && parsed.cleaner) {
            setCurrentCleaner(parsed.cleaner);
            setCurrentLocation(parsed.location || null);
            const inDone = !!parsed.clockInDone;
            const outDone = !!parsed.clockOutDone;
            setClockInDone(inDone);
            setClockOutDone(outDone);
            if (parsed.clockInTime) setClockInTime(parsed.clockInTime);
            if (parsed.clockOutTime) setClockOutTime(parsed.clockOutTime);

            // If cleaner has already clocked in today, never force attendance capture on refresh!
            const defaultScreen = inDone ? 'hub' : 'clockin';
            setCleanerScreen(parsed.cleanerScreen || defaultScreen);
            if (parsed.activeTask) setActiveTask(parsed.activeTask);
            if (parsed.checklist) setChecklist(parsed.checklist);
            if (parsed.phone) setPhoneInput(parsed.phone);
            if (parsed.routineStage) setRoutineStage(parsed.routineStage);
            if (parsed.routineStartedAt) setRoutineStartedAt(parsed.routineStartedAt);
            if (parsed.beforePhoto) setBeforePhoto(parsed.beforePhoto);
            setRole('cleaner');
            setSessionLoaded(true);
            refreshData();
            return;
          }
        }

        const savedAdmin = localStorage.getItem('sparklyn_admin_session');
        if (savedAdmin) {
          const parsed = JSON.parse(savedAdmin);
          if (parsed && parsed.token) {
            setAdminToken(parsed.token);
            setAdminName(parsed.adminName || 'Admin');
            setAdminUnlocked(true);
            setRole('admin');
            setSessionLoaded(true);
            refreshData();
            return;
          }
        }

        const legacyToken = sessionStorage.getItem('sparklyn_admin_token');
        if (legacyToken) {
          setAdminToken(legacyToken);
          setAdminUnlocked(true);
          setRole('admin');
          setSessionLoaded(true);
          refreshData();
          return;
        }
      }
    } catch (e) {
      console.warn('Could not restore local session:', e);
    }
    setSessionLoaded(true);
    refreshData();
    checkAdminAuth();
  }, []);

  // Auto-dismiss welcome banner after 7 seconds
  useEffect(() => {
    if (welcomeToast) {
      const timer = setTimeout(() => {
        setWelcomeToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [welcomeToast]);

  // Poll for updates in Admin view
  useEffect(() => {
    if (adminUnlocked && role === 'admin') {
      const timer = setInterval(() => {
        refreshData();
      }, 10000);
      return () => clearInterval(timer);
    }
  }, [adminUnlocked, role]);

  // Live Cleaning Timer during Active Routine Phase
  useEffect(() => {
    if (cleanerScreen === 'checklist' && routineStage === 'in_progress' && routineStartedAt) {
      const calcElapsed = () => {
        const startMs = new Date(routineStartedAt).getTime();
        const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setElapsedCleaningSeconds(diff);
      };
      calcElapsed();
      const interval = setInterval(calcElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [cleanerScreen, routineStage, routineStartedAt]);

  // Routine Cleaning Schedule & Reminder Alarm
  useEffect(() => {
    if (role !== 'cleaner' || !currentCleaner || !currentLocation) return;

    const evaluateRoutineAlarm = () => {
      const tasks = currentLocation.tasks || [];
      if (tasks.length === 0) {
        setNextDueRoutine(null);
        return;
      }

      const primaryTask = tasks[0];
      const freqMinutes = parseFrequencyToMinutes(primaryTask.frequency);

      // Find today's routines for this cleaner / location
      const todayDateStr = new Date().toDateString();
      const completedToday = routines
        .filter(r => {
          const isCleaner = (r.cleanerId && currentCleaner.id) ? r.cleanerId === currentCleaner.id : r.cleanerName === currentCleaner.name;
          const isToday = new Date(r.completedAt).toDateString() === todayDateStr;
          return isCleaner && isToday;
        })
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      const now = Date.now();
      let baseTime = now;

      if (completedToday.length > 0) {
        // Next routine is due `freqMinutes` after the last completed routine
        baseTime = new Date(completedToday[0].completedAt).getTime();
      } else if (clockInTime) {
        const parsedClockIn = new Date(clockInTime).getTime();
        if (!isNaN(parsedClockIn)) {
          baseTime = parsedClockIn;
        } else {
          const d = new Date();
          const parts = clockInTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (parts) {
            let h = parseInt(parts[1], 10);
            const m = parseInt(parts[2], 10);
            const ap = parts[3]?.toUpperCase();
            if (ap === 'PM' && h < 12) h += 12;
            if (ap === 'AM' && h === 12) h = 0;
            d.setHours(h, m, 0, 0);
            baseTime = d.getTime();
          }
        }
      } else {
        const d = new Date();
        d.setHours(8, 0, 0, 0);
        baseTime = d.getTime();
      }

      const dueTime = baseTime + (freqMinutes * 60 * 1000);
      const isOverdue = now >= dueTime;
      const diffMinutes = Math.round(Math.abs(now - dueTime) / 60000);
      const dueDate = new Date(dueTime);
      const timeString = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setNextDueRoutine({
        taskName: primaryTask.name,
        freq: primaryTask.frequency,
        dueTime,
        isOverdue,
        diffMinutes,
        timeString
      });

      // Trigger alarm if overdue, not snoozed, on hub, and not already showing
      if (isOverdue && now > snoozedUntil && cleanerScreen === 'hub' && !alarmModalOpen) {
        setAlarmTaskTitle(primaryTask.name);
        setAlarmTaskFreq(primaryTask.frequency);
        setAlarmModalOpen(true);
        if (alarmSoundEnabled) {
          playChimeAlarm();
        }
      }
    };

    evaluateRoutineAlarm();
    const timer = setInterval(evaluateRoutineAlarm, 15000);
    return () => clearInterval(timer);
  }, [role, currentCleaner, currentLocation, routines, clockInTime, snoozedUntil, alarmSoundEnabled, cleanerScreen, alarmModalOpen]);

  // Handle Unified Login by Phone Number
  // Identifies Admins (Oma, Dolapo, Rita) and Onboarded Cleaners
  const handlePhoneLogin = async (overridePhone?: string) => {
    const p = (overridePhone !== undefined ? overridePhone : phoneInput).trim();
    if (!p) {
      setLoginError('Please enter your phone number to sign in');
      return;
    }
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/cleaner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Phone number not registered. Please contact management.');
        return;
      }

      // 1. Admin Match (Oma, Dolapo, Rita)
      if (data.role === 'admin') {
        setRole('admin');
        setAdminUnlocked(true);
        setAdminToken(data.token);
        const name = data.adminName || 'Admin';
        setAdminName(name);
        setWelcomeToast(data.message || `Welcome, Admin ${name}!`);

        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'sparklyn_admin_session',
            JSON.stringify({ token: data.token, adminName: name, phone: p })
          );
          sessionStorage.setItem('sparklyn_admin_token', data.token);
          localStorage.removeItem('sparklyn_cleaner_session');
        }
        refreshData();
        return;
      }

      // 2. Cleaner Match (Prince or any onboarded cleaner)
      if (data.role === 'cleaner') {
        setRole('cleaner');
        setCurrentCleaner(data.cleaner);
        setCurrentLocation(data.location);
        const inDone = !!data.clockInDone;
        const outDone = !!data.clockOutDone;
        setClockInDone(inDone);
        setClockOutDone(outDone);
        if (data.clockInTime) setClockInTime(data.clockInTime);
        if (data.clockOutTime) setClockOutTime(data.clockOutTime);

        // Attendance is twice a day:
        // - Morning Clock In
        // - Evening Clock Out (3:30 PM - 5:00 PM WAT)
        // If already clocked in, go straight to Hub! Never force attendance capture on login.
        const targetScreen: 'clockin' | 'hub' = inDone ? 'hub' : 'clockin';
        setAttendanceMode('in');
        setCleanerScreen(targetScreen);
        setWelcomeToast(data.message || `Welcome back, ${data.cleaner.name}!`);

        saveCleanerSession({
          cleaner: data.cleaner,
          location: data.location,
          cleanerScreen: targetScreen,
          clockInDone: inDone,
          clockOutDone: outDone,
          clockInTime: data.clockInTime || null,
          clockOutTime: data.clockOutTime || null,
          phone: p
        });

        if (typeof window !== 'undefined') {
          localStorage.removeItem('sparklyn_admin_session');
        }

        if (!inDone) {
          // Attempt live GPS coordinate capture for morning attendance
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
          startCamera();
        }

        refreshData();
        return;
      }
    } catch (e) {
      setLoginError('Network connection error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCleanerLogin = handlePhoneLogin;

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sparklyn_cleaner_session');
      localStorage.removeItem('sparklyn_admin_session');
      sessionStorage.removeItem('sparklyn_admin_token');
    }
    if (role === 'admin') {
      try {
        await fetch('/api/admin-auth', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: 'logout' })
        });
      } catch {}
    }
    setRole(null);
    setCurrentCleaner(null);
    setCurrentLocation(null);
    setClockInDone(false);
    setAdminUnlocked(false);
    setAdminToken('');
    setAdminName('');
    setWelcomeToast(null);
    setLoginError('');
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

  // Compress mobile camera images to prevent 413 payload limit
  const compressImageFile = (file: File, maxWidth = 1024, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  };

  const handleSelfieFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 800, 0.8);
      setSelfieImage(compressed);
    } catch {
      alert('Failed to process selfie');
    }
  };

  const openClockOut = () => {
    const ng = getNigeriaTime();
    if (ng.isBeforeClockOut) {
      alert(`Cleaners cannot clock out before 3:30 PM (Nigeria Time). Current time is ${ng.timeString} WAT.`);
      return;
    }
    setAttendanceMode('out');
    setSelfieImage(null);
    setCleanerScreen('clockin');

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
    startCamera();
  };

  const confirmAttendance = async () => {
    if (isSubmittingAttendance) return;
    if (!selfieImage) {
      alert(`Live selfie capture is required to ${attendanceMode === 'out' ? 'clock out' : 'clock in'}.`);
      return;
    }
    const ng = getNigeriaTime();
    if (attendanceMode === 'out' && ng.isBeforeClockOut) {
      alert(`Cleaners cannot clock out before 3:30 PM (Nigeria Time). Current time is ${ng.timeString} WAT.`);
      return;
    }

    setIsSubmittingAttendance(true);
    try {
      const res = await fetch('/api/attendance', {
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
          accuracyMeters: gpsCoords ? 5 : 0,
          type: attendanceMode
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to record attendance');
        return;
      }

      if (attendanceMode === 'out') {
        const timeOut = data.record?.timestamp || new Date().toISOString();
        setClockOutDone(true);
        setClockOutTime(timeOut);
        setCleanerScreen('hub');
        saveCleanerSession({
          clockOutDone: true,
          clockOutTime: timeOut,
          cleanerScreen: 'hub'
        });
        alert('Evening shift successfully closed! Great job today.');
      } else {
        const timeIn = data.record?.timestamp || new Date().toISOString();
        setClockInDone(true);
        setClockInTime(timeIn);
        setCleanerScreen('hub');
        saveCleanerSession({
          clockInDone: true,
          clockInTime: timeIn,
          cleanerScreen: 'hub'
        });
      }
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Error recording attendance');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const confirmClockIn = confirmAttendance;

  const formatElapsedTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRoutine = (taskName: string, freq: string) => {
    const checks = [
      { text: `Disinfect & scrub ${taskName.toLowerCase()} high-touch surfaces`, done: false },
      { text: 'Sanitize handles, faucets, and switches', done: false },
      { text: 'Verify consumables & paper supply', done: false },
      { text: 'Damp mop & dry floor with disinfectant', done: false }
    ];
    setActiveTask({ title: taskName, freq });
    setChecklist(checks);
    setBeforePhoto(null);
    setAfterPhoto(null);
    setRoutineStage('before');
    setRoutineStartedAt(null);
    setElapsedCleaningSeconds(0);
    setAlarmModalOpen(false);
    setCleanerScreen('checklist');
    saveCleanerSession({
      cleanerScreen: 'checklist',
      activeTask: { title: taskName, freq },
      checklist: checks,
      routineStage: 'before',
      routineStartedAt: null,
      beforePhoto: null
    });
  };

  const beginCleaningPhase = () => {
    if (!beforePhoto) {
      alert('Please capture the Before Clean proof photo first before starting physical cleaning.');
      return;
    }
    const startedIso = new Date().toISOString();
    setRoutineStage('in_progress');
    setRoutineStartedAt(startedIso);
    setElapsedCleaningSeconds(0);
    saveCleanerSession({
      routineStage: 'in_progress',
      routineStartedAt: startedIso,
      beforePhoto
    });
  };

  const toggleCheck = (idx: number) => {
    const next = [...checklist];
    next[idx].done = !next[idx].done;
    setChecklist(next);
    saveCleanerSession({ checklist: next });
  };

  const handleProofPhotoCapture = async (type: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1024, 0.75);
      if (type === 'before') {
        setBeforePhoto(compressed);
        saveCleanerSession({ beforePhoto: compressed });
      } else {
        setAfterPhoto(compressed);
      }
    } catch {
      alert('Failed to process image capture');
    }
  };

  const submitRoutineAndGoToInventory = async () => {
    if (isSubmittingRoutine) return;
    if (!beforePhoto || !afterPhoto) {
      alert('Please capture both Before and After clean photo proofs to proceed.');
      return;
    }
    setIsSubmittingRoutine(true);
    try {
      const todayRoutines = routines.filter(
        r => ((r.cleanerId && currentCleaner?.id) ? r.cleanerId === currentCleaner.id : r.cleanerName === currentCleaner?.name) &&
             new Date(r.completedAt).toDateString() === new Date().toDateString()
      );
      const cycleNumber = todayRoutines.length + 1;

      const res = await fetch('/api/routines', {
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
          afterPhotoUrl: afterPhoto,
          startedAt: routineStartedAt || new Date().toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to submit routine');
        return;
      }

      // Pre-fill inventory counters with standard
      const initialSupplies: { [key: string]: number } = {};
      inventory.forEach(inv => {
        initialSupplies[inv.id] = inv.standardAllowancePerCycle || 1;
      });
      setSelectedSupplies(initialSupplies);
      setShowAbuseWarning(false);
      setBeforePhoto(null);
      setAfterPhoto(null);
      setRoutineStartedAt(null);
      setRoutineStage('before');
      setElapsedCleaningSeconds(0);
      setCleanerScreen('inventory');
      saveCleanerSession({
        cleanerScreen: 'inventory',
        routineStage: 'before',
        routineStartedAt: null,
        beforePhoto: null
      });
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Error submitting routine');
    } finally {
      setIsSubmittingRoutine(false);
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
      saveCleanerSession({ cleanerScreen: 'hub' });
      refreshData();
    } catch (e) {
      alert('Error saving inventory usage');
    }
  };

  // Admin Session Verification
  const checkAdminAuth = async () => {
    try {
      let storedToken = '';
      if (typeof window !== 'undefined') {
        const savedAdmin = localStorage.getItem('sparklyn_admin_session');
        if (savedAdmin) {
          try { storedToken = JSON.parse(savedAdmin).token || ''; } catch {}
        }
        if (!storedToken) {
          storedToken = sessionStorage.getItem('sparklyn_admin_token') || '';
        }
      }
      const res = await fetch('/api/admin-auth', {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {}
      });
      const data = await res.json();
      if (data.authenticated) {
        setAdminUnlocked(true);
        if (storedToken) setAdminToken(storedToken);
      }
    } catch {
      // Ignore background check failure
    }
  };

  const getAuthHeaders = (): { [key: string]: string } => {
    const headers: { [key: string]: string } = { 'Content-Type': 'application/json' };
    let token = adminToken;
    if (!token && typeof window !== 'undefined') {
      try {
        const savedAdmin = localStorage.getItem('sparklyn_admin_session');
        if (savedAdmin) {
          token = JSON.parse(savedAdmin).token || '';
        }
      } catch {}
      if (!token) {
        token = sessionStorage.getItem('sparklyn_admin_token') || '';
      }
    }
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
        setRole('admin');
        setAdminUnlocked(true);
        setAdminName('Admin');
        if (data.token) {
          setAdminToken(data.token);
          try {
            sessionStorage.setItem('sparklyn_admin_token', data.token);
            localStorage.setItem(
              'sparklyn_admin_session',
              JSON.stringify({ token: data.token, adminName: 'Admin' })
            );
            localStorage.removeItem('sparklyn_cleaner_session');
          } catch {}
        }
        setWelcomeToast('Welcome, Admin!');
        setAdminError('');
        setAdminPasswordInput('');
        setShowPasswordFallback(false);
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
      handleSignOut();
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
                {role === 'cleaner'
                  ? (currentCleaner ? `${currentCleaner.name} · ${currentLocation?.name || 'Assigned Site'}` : 'Cleaner Operations')
                  : role === 'admin'
                  ? (adminName ? `Admin ${adminName} · Operations Hub` : 'Admin Operations Hub')
                  : 'Facility Operations Portal'}
              </p>
            </div>
          </div>

          {/* Right Action */}
          {role && (
            <div className="flex items-center gap-2">
              {role === 'admin' && (
                <button
                  onClick={refreshData}
                  title="Refresh data"
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={handleSignOut}
                title="Sign out of current shift or session"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* WELCOME BANNER / TOAST */}
      {welcomeToast && (
        <div className="mx-4 mt-3 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{welcomeToast}</span>
          </div>
          <button
            onClick={() => setWelcomeToast(null)}
            className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* BODY CONTENT */}
      <main className="flex-1 p-4 pb-20 space-y-4">

        {/* ======================================================== */}
        {/* 0. UNIFIED PHONE LOGIN SCREEN (PROMPT ON LOAD)           */}
        {/* ======================================================== */}
        {!role && sessionLoaded && (
          <div className="space-y-6 pt-6 pb-8">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 text-zinc-950 font-black flex items-center justify-center text-2xl tracking-tight shadow-lg">
                S
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white pt-1">Welcome to Sparklyn</h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Enter your mobile number. The system will automatically identify you as Admin or Cleaner.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handlePhoneLogin();
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => {
                        setPhoneInput(e.target.value);
                        setLoginError('');
                      }}
                      placeholder="e.g. 070346532037 or +234..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-300 font-mono transition"
                      autoFocus
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Verifying Account...
                    </>
                  ) : (
                    <>
                      Sign In <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Password fallback option for Admin */}
              <div className="pt-2 border-t border-zinc-800/60 text-center">
                {!showPasswordFallback ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordFallback(true)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                  >
                    Have a master password? Sign in with password
                  </button>
                ) : (
                  <div className="space-y-2.5 pt-2 text-left">
                    <label className="block text-xs font-medium text-zinc-400">Master Admin Password</label>
                    <input
                      type="password"
                      value={adminPasswordInput}
                      onChange={e => {
                        setAdminPasswordInput(e.target.value);
                        setAdminError('');
                      }}
                      placeholder="Enter master password..."
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-300 font-mono"
                    />
                    {adminError && (
                      <p className="text-[11px] text-rose-400 font-medium">{adminError}</p>
                    )}
                    <button
                      type="button"
                      onClick={unlockAdmin}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3 h-3" /> Unlock Admin Hub
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. CLEANER MOBILE INTERFACE                              */}
        {/* ======================================================== */}
        {role === 'cleaner' && (
          <div className="space-y-4">

            {/* SCREEN 2: MORNING ATTENDANCE OR EVENING CLOCK-OUT */}
            {cleanerScreen === 'clockin' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
                      {attendanceMode === 'out' ? (
                        <>
                          <Moon className="w-5 h-5 text-amber-400" /> Evening Clock-Out
                        </>
                      ) : (
                        <>
                          <Sun className="w-5 h-5 text-emerald-400" /> Morning Attendance
                        </>
                      )}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {attendanceMode === 'out'
                        ? 'Closing shift selfie & GPS geotag verification'
                        : 'Live selfie & GPS location verification'}
                    </p>
                  </div>
                  {attendanceMode === 'out' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCleanerScreen('hub');
                        saveCleanerSession({ cleanerScreen: 'hub' });
                      }}
                      className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                      Clock-In
                    </span>
                  )}
                </div>

                <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">{currentCleaner?.name}</p>
                    <p className="text-[11px] text-zinc-400">📍 {currentLocation?.name || 'Assigned Facility'}</p>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {attendanceMode === 'out' ? 'Closing Shift' : 'Arrival Check'}
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
                  onClick={confirmAttendance}
                  disabled={isSubmittingAttendance}
                  className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingAttendance ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Recording Attendance...
                    </>
                  ) : attendanceMode === 'out' ? (
                    <>
                      Confirm Evening Clock-Out & Close Shift ✓
                    </>
                  ) : (
                    <>
                      Confirm Morning Attendance & View Routines <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
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
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    clockOutDone
                      ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    {clockOutDone ? 'Shift Completed' : 'Shift Active'}
                  </span>
                </div>

                {/* SHIFT ATTENDANCE & NIGERIA TIME CARD */}
                <div className="p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800/60">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Nigeria Time:</span>
                      <span className="font-mono text-white font-semibold">{nigeriaTime.timeString} WAT</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">2 Checks / Day</span>
                  </div>

                  {/* Morning Clock-In Status */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="font-medium text-white">Morning Clock-In</p>
                        <p className="text-[10px] text-zinc-400">
                          {clockInTime
                            ? `Logged at ${new Date(clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WAT`
                            : 'Verified on arrival'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Clocked In
                    </span>
                  </div>

                  {/* Evening Clock-Out Status (3:30 PM - 5:00 PM WAT) */}
                  <div className="pt-2 border-t border-zinc-800/60">
                    {clockOutDone ? (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-violet-400" />
                          <div>
                            <p className="font-medium text-white">Evening Clock-Out</p>
                            <p className="text-[10px] text-zinc-400">
                              {clockOutTime
                                ? `Completed at ${new Date(clockOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WAT`
                                : 'Shift officially closed'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Shift Complete
                        </span>
                      </div>
                    ) : nigeriaTime.isBeforeClockOut ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4 text-amber-400" />
                            <div>
                              <p className="font-medium text-white">Evening Clock-Out</p>
                              <p className="text-[10px] text-zinc-400">
                                Window: 3:30 PM – 5:00 PM WAT
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-zinc-500" /> Unlocks 3:30 PM
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-[11px] text-zinc-400 flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span>Cleaners cannot clock out before 3:30 PM. Keep executing your scheduled routine cycles.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4 text-emerald-400" />
                            <div>
                              <p className="font-medium text-white">Evening Clock-Out Window Open</p>
                              <p className="text-[10px] text-emerald-400">
                                3:30 PM – 5:00 PM WAT
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                            Ready to Clock Out
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={openClockOut}
                          className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Camera className="w-3.5 h-3.5" /> Clock Out for Today (Evening Selfie & GPS)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ROUTINE CLEANING SCHEDULE & ALARM STATUS CARD */}
                {nextDueRoutine?.isOverdue ? (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center relative flex-shrink-0">
                        <span className="absolute inset-0 rounded-xl bg-amber-400/30 animate-ping opacity-60" />
                        <Bell className="w-4 h-4 text-amber-400 animate-bounce relative z-10" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            Routine Due Now
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white">
                          {nextDueRoutine.taskName}
                        </p>
                        <p className="text-[10px] text-amber-300/80">
                          Overdue by {nextDueRoutine.diffMinutes} mins • {nextDueRoutine.freq}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startRoutine(nextDueRoutine.taskName, nextDueRoutine.freq)}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded-xl text-xs transition active:scale-[0.98] shadow-sm flex items-center gap-1 flex-shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Clean Now
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <Timer className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">Next Scheduled Routine</p>
                        <p className="text-[10px] text-zinc-400">
                          {nextDueRoutine
                            ? `${nextDueRoutine.taskName} at ${nextDueRoutine.timeString} (in ${nextDueRoutine.diffMinutes}m)`
                            : (currentLocation?.tasks?.[0]?.name ? `${currentLocation.tasks[0].name} (${currentLocation.tasks[0].frequency})` : 'Routine scheduled')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title={alarmSoundEnabled ? "Alarm audio chime on" : "Alarm audio chime muted"}
                        onClick={() => {
                          const nextState = !alarmSoundEnabled;
                          setAlarmSoundEnabled(nextState);
                          if (nextState) playChimeAlarm();
                        }}
                        className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
                          alarmSoundEnabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {alarmSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-medium hidden sm:inline">{alarmSoundEnabled ? 'Alarm On' : 'Muted'}</span>
                      </button>
                    </div>
                  </div>
                )}

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
                      saveCleanerSession({ cleanerScreen: 'inventory' });
                    }}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" /> Direct Supply Logger
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 4: ROUTINE CHECKLIST & TWO-STAGE BEFORE/AFTER LIVE PHOTOS */}
            {cleanerScreen === 'checklist' && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <button
                    onClick={() => {
                      if (routineStage === 'in_progress' && elapsedCleaningSeconds > 0) {
                        if (!confirm('Cleaning is currently in progress with active timer running. Are you sure you want to exit?')) {
                          return;
                        }
                      }
                      setCleanerScreen('hub');
                      saveCleanerSession({ cleanerScreen: 'hub' });
                    }}
                    className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Routines
                  </button>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-white">{activeTask.title}</h3>
                    <span className="text-[10px] text-zinc-400">{activeTask.freq}</span>
                  </div>
                </div>

                {/* Progress Stages Bar */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-1.5 rounded-full transition-all ${routineStage === 'before' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <div className={`flex-1 h-1.5 rounded-full transition-all ${routineStage === 'in_progress' ? 'bg-emerald-400' : 'bg-zinc-800'}`} />
                </div>

                {/* STAGE 1: PRE-CLEAN INSPECTION & BEFORE PHOTO */}
                {routineStage === 'before' && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-amber-300">Stage 1 of 2: Pre-Clean Inspection Proof</h4>
                      </div>
                      <p className="text-[11px] text-amber-200/80 leading-relaxed">
                        Inspect the area before touching anything. Take a live photo showing the pre-cleaning state. Once captured, you can start the cleaning timer and perform the tasks.
                      </p>
                    </div>

                    {/* Pre-Clean Photo Capture */}
                    <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">Before Clean Photo Proof</span>
                        <span className="text-[10px] text-zinc-400">Live camera only</span>
                      </div>

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
                        className={`aspect-video w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition overflow-hidden relative ${
                          beforePhoto ? 'border-emerald-500/50 bg-black' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'
                        }`}
                      >
                        {beforePhoto ? (
                          <>
                            <img src={beforePhoto} className="w-full h-full object-cover" alt="Before clean proof" />
                            <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg py-1 px-2 flex items-center justify-between text-[10px] text-white">
                              <span className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> Pre-clean photo recorded
                              </span>
                              <span className="text-zinc-300 underline">Tap to retake</span>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-1 text-center p-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 mx-auto flex items-center justify-center">
                              <Camera className="w-5 h-5 text-amber-400" />
                            </div>
                            <p className="text-xs font-semibold text-white">Tap to take Before Clean photo</p>
                            <p className="text-[10px] text-zinc-500">Show restrooms, surfaces, or floors as found</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Unlock Stage 2 Button */}
                    <button
                      type="button"
                      disabled={!beforePhoto}
                      onClick={beginCleaningPhase}
                      className="w-full py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs tracking-wide transition shadow-md active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Timer className="w-4 h-4 text-zinc-950" /> Begin Cleaning Phase (Start Live Timer) <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {!beforePhoto && (
                      <p className="text-[11px] text-zinc-500 text-center">
                        Take the Before photo above to unlock the physical cleaning phase
                      </p>
                    )}
                  </div>
                )}

                {/* STAGE 2: ACTIVE CLEANING IN PROGRESS & AFTER CLEAN PROOF */}
                {routineStage === 'in_progress' && (
                  <div className="space-y-4">
                    {/* Live Timer Banner */}
                    <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center relative">
                          <span className="absolute inset-0 rounded-xl bg-emerald-400/30 animate-ping opacity-75" />
                          <Timer className="w-4 h-4 text-emerald-400 relative z-10" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              Active Cleaning Phase
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300">
                            Started at {routineStartedAt ? new Date(routineStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-mono font-bold text-white tracking-wider">
                          {formatElapsedTimer(elapsedCleaningSeconds)}
                        </div>
                        <span className="text-[10px] text-emerald-400 font-medium">Elapsed</span>
                      </div>
                    </div>

                    {/* SOP Checklist */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">SOP Task Checklist</span>
                        <span className="text-[10px] text-zinc-400">
                          {checklist.filter(c => c.done).length} of {checklist.length} completed
                        </span>
                      </div>

                      {checklist.map((item, idx) => (
                        <label
                          key={idx}
                          onClick={() => toggleCheck(idx)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            item.done
                              ? 'bg-zinc-900/30 border-zinc-800/50 opacity-80'
                              : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            readOnly
                            className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-0"
                          />
                          <p className={`text-xs ${item.done ? 'text-zinc-400 line-through' : 'text-white font-medium'}`}>
                            {item.text}
                          </p>
                        </label>
                      ))}
                    </div>

                    {/* Proof Photos Side-by-Side: Before (Locked) & After (Live Capture) */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">Proof Comparison</span>
                        <span className="text-[10px] text-zinc-400">Before & After Verification</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Before Clean Thumbnail */}
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-zinc-400">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Before Clean</span>
                          </div>
                          <div className="aspect-square bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative">
                            {beforePhoto ? (
                              <img src={beforePhoto} className="w-full h-full object-cover" alt="Before clean" />
                            ) : (
                              <span className="text-[10px] text-zinc-600">No before photo</span>
                            )}
                            <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-[9px] text-zinc-300">
                              Stage 1
                            </div>
                          </div>
                        </div>

                        {/* After Clean Live Camera Box */}
                        <div className="p-2.5 bg-zinc-900/50 border border-emerald-500/30 rounded-xl text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-400">
                            <Camera className="w-3 h-3 text-emerald-400" />
                            <span>After Clean Proof</span>
                          </div>
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
                            className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition overflow-hidden relative ${
                              afterPhoto ? 'border-emerald-500 bg-black' : 'border-zinc-700 bg-zinc-950 hover:border-emerald-500/60'
                            }`}
                          >
                            {afterPhoto ? (
                              <>
                                <img src={afterPhoto} className="w-full h-full object-cover" alt="After clean proof" />
                                <div className="absolute bottom-1 left-1 right-1 bg-black/70 backdrop-blur-sm rounded py-0.5 px-1 text-[9px] text-emerald-400 text-center font-medium">
                                  Captured • Retake
                                </div>
                              </>
                            ) : (
                              <>
                                <Camera className="w-5 h-5 text-emerald-400" />
                                <span className="text-[10px] text-zinc-400 mt-1 font-medium">Tap to capture</span>
                                <span className="text-[9px] text-zinc-500">After Clean</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      onClick={submitRoutineAndGoToInventory}
                      disabled={isSubmittingRoutine || !afterPhoto}
                      className="w-full py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs tracking-wide transition shadow-sm active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmittingRoutine ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Verifying & Saving Routine...
                        </>
                      ) : (
                        <>
                          Complete Routine & Log Supplies Used <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                    {!afterPhoto && (
                      <p className="text-[11px] text-zinc-500 text-center">
                        Take the After Clean photo above once cleaning is finished to proceed
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SCREEN 5: INVENTORY LOGGING WITH ABUSE DETECTION */}
            {cleanerScreen === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <button
                    onClick={() => {
                      setCleanerScreen('hub');
                      saveCleanerSession({ cleanerScreen: 'hub' });
                    }}
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
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Daily Attendance Feed ({attendance.length})</h3>
                      <p className="text-[11px] text-zinc-500">Morning Clock-In & Evening Clock-Out (WAT)</p>
                    </div>

                    <div className="space-y-3">
                      {attendance.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No attendance records today</p>
                          <p className="text-[11px] text-zinc-500">Cleaners will appear here as they clock in and clock out.</p>
                        </div>
                      ) : (
                        attendance.map(att => {
                          const isClockOut = att.id.includes('-out-');
                          return (
                            <div key={att.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">{att.cleanerName}</p>
                                  <p className="text-[11px] text-zinc-400">📍 {att.locationName}</p>
                                </div>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                  isClockOut
                                    ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                }`}>
                                  {isClockOut ? <Moon className="w-3 h-3 text-violet-400" /> : <Sun className="w-3 h-3 text-emerald-400" />}
                                  {isClockOut ? 'Evening Clock-Out' : 'Morning Clock-In'}
                                </span>
                              </div>

                            {/* Image with clickable Google Maps overlay button */}
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 group">
                              <img src={att.selfieUrl} className="w-full h-full object-cover" alt="Cleaner selfie" />
                              <a
                                href={`https://www.google.com/maps?q=${att.latitude},${att.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open exact coordinates on Google Maps"
                                className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/80 hover:bg-black backdrop-blur rounded-lg text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 transition shadow-lg"
                              >
                                <MapPin className="w-3 h-3 text-emerald-400" /> Open on Map ↗
                              </a>
                            </div>

                            {/* Clock-in Time & Clickable Coordinates */}
                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-zinc-500" />
                                  {isClockOut ? 'Clocked Out:' : 'Clocked In:'} <span className="text-zinc-200 font-medium">
                                    {att.timestamp ? new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'} WAT
                                  </span>
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {att.timestamp ? new Date(att.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                </span>
                              </div>

                              <a
                                href={`https://www.google.com/maps?q=${att.latitude},${att.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Click to view location in Google Maps"
                                className="text-[10px] font-mono text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition group"
                              >
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span className="group-hover:underline">
                                  {Number(att.latitude).toFixed(5)}° N, {Number(att.longitude).toFixed(5)}° E
                                </span>
                                <span className="text-[9px] text-emerald-400/80">(Tap for GPS Map)</span>
                              </a>
                            </div>
                          </div>
                        );
                      })
                      )}
                    </div>
                  </div>
                )}

                {/* 4. CLEANING PROOFS (BEFORE/AFTER PHOTOS) */}
                {adminTab === 'proofs' && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Routine Photo Proofs ({routines.length})</h3>
                      <p className="text-[11px] text-zinc-500">Audited multiple times per day</p>
                    </div>

                    <div className="space-y-3">
                      {routines.length === 0 ? (
                        <div className="p-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400 space-y-1">
                          <p className="font-semibold text-white">No routine proofs submitted yet</p>
                          <p className="text-[11px] text-zinc-500">Before & After photo proofs will be logged here as routines are executed.</p>
                        </div>
                      ) : (
                        routines.map(rout => {
                          const duration = rout.durationMinutes || (Array.isArray(rout.checklist) && rout.checklist.find((c: any) => c.item === '__meta__')?.durationMinutes);
                          const startedAtTime = rout.startedAt || (Array.isArray(rout.checklist) && rout.checklist.find((c: any) => c.item === '__meta__')?.startedAt);

                          return (
                            <div key={rout.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">{rout.taskTitle}</p>
                                  <p className="text-[11px] text-zinc-400">{rout.cleanerName} • {rout.locationName}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {duration ? (
                                    <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                                      <Timer className="w-3 h-3" /> {duration}m clean
                                    </span>
                                  ) : null}
                                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    Cycle {rout.cycleNumber || 1} • Verified
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                                    <span>Before Clean</span>
                                    {startedAtTime && (
                                      <span className="text-zinc-500">{new Date(startedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </div>
                                  <div className="aspect-square rounded-lg bg-black overflow-hidden border border-zinc-800">
                                    <img src={rout.beforePhotoUrl} className="w-full h-full object-cover" alt="Before clean" />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-[10px] text-emerald-400 mb-1">
                                    <span>After Clean</span>
                                    {rout.completedAt && (
                                      <span className="text-emerald-500/80">{new Date(rout.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </div>
                                  <div className="aspect-square rounded-lg bg-black overflow-hidden border border-emerald-500/40">
                                    <img src={rout.afterPhotoUrl} className="w-full h-full object-cover" alt="After clean" />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                                <span className="flex items-center gap-1 text-zinc-300">
                                  <Clock className="w-3 h-3 text-zinc-500" />
                                  {startedAtTime ? (
                                    <span>
                                      {new Date(startedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {new Date(rout.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  ) : (
                                    <span>Completed: {rout.completedAt ? new Date(rout.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                                  )}
                                </span>
                                <span className="text-zinc-500 font-mono">
                                  {rout.completedAt ? new Date(rout.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })
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

      {/* ======================================================== */}
      {/* MODAL 5: ROUTINE CLEANING REMINDER ALARM MODAL           */}
      {/* ======================================================== */}
      {alarmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500/60 rounded-3xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Pulsing glow ring */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Pulsing Bell Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center relative shadow-lg">
              <span className="absolute inset-0 rounded-2xl bg-amber-400/20 animate-ping opacity-75" />
              <Bell className="w-8 h-8 text-amber-400 animate-bounce relative z-10" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Routine Cleaning Reminder
              </span>
              <h3 className="text-lg font-bold text-white pt-1">
                {alarmTaskTitle || (currentLocation?.tasks?.[0]?.name || 'Routine SOP')}
              </h3>
              <p className="text-xs text-zinc-300">
                Scheduled interval: <span className="font-semibold text-white">{alarmTaskFreq || (currentLocation?.tasks?.[0]?.frequency || 'Every 2 Hours')}</span>
              </p>
              {nextDueRoutine?.isOverdue && nextDueRoutine.diffMinutes > 0 && (
                <p className="text-[11px] text-amber-400 font-medium">
                  Due {nextDueRoutine.diffMinutes} minute{nextDueRoutine.diffMinutes === 1 ? '' : 's'} ago
                </p>
              )}
            </div>

            <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-left text-xs text-zinc-300 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                <span>{currentLocation?.name || 'Assigned Site'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>2-Stage Proof: Pre-Clean photo required before start</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setAlarmModalOpen(false);
                  const task = alarmTaskTitle || (currentLocation?.tasks?.[0]?.name || 'General Routine Clean');
                  const freq = alarmTaskFreq || (currentLocation?.tasks?.[0]?.frequency || 'Every 2 Hours');
                  startRoutine(task, freq);
                }}
                className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl text-xs tracking-wide transition shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-zinc-950" /> Start Routine Now
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAlarmModalOpen(false);
                    setSnoozedUntil(Date.now() + 10 * 60 * 1000); // 10 minutes snooze
                  }}
                  className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl text-xs transition border border-zinc-700"
                >
                  ⏰ Snooze 10m
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmModalOpen(false)}
                  className="py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium rounded-xl text-xs transition border border-zinc-800"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Alarm Sound Toggle in Modal */}
            <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  const nextState = !alarmSoundEnabled;
                  setAlarmSoundEnabled(nextState);
                  if (nextState) playChimeAlarm();
                }}
                className="hover:text-white flex items-center gap-1 transition"
              >
                {alarmSoundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Alarm chime enabled</span>
                  </>
                ) : (
                  <>
                    <BellOff className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Alarm chime muted</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
