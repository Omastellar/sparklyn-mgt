/**
 * Helper utilities for Nigeria Time (West Africa Time, WAT = UTC+1).
 * Nigeria does not observe Daylight Saving Time.
 */

export interface NigeriaTimeInfo {
  hour: number;
  minute: number;
  totalMinutes: number; // minutes from 00:00
  timeString: string;
  isBeforeClockOut: boolean; // Before 3:30 PM (15:30)
  isWithinClockOutWindow: boolean; // 3:30 PM (15:30) - 5:00 PM (17:00)
  isAfterClockOutWindow: boolean; // After 5:00 PM (17:00)
  canClockOut: boolean; // >= 3:30 PM (15:30)
}

export function getNigeriaTime(date = new Date()): NigeriaTimeInfo {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = hour * 60 + minute;

  // 3:30 PM = 15:30 = 15 * 60 + 30 = 930 minutes
  // 5:00 PM = 17:00 = 17 * 60 = 1020 minutes
  const isBeforeClockOut = totalMinutes < 930;
  const isWithinClockOutWindow = totalMinutes >= 930 && totalMinutes <= 1020;
  const isAfterClockOutWindow = totalMinutes > 1020;
  const canClockOut = totalMinutes >= 930;

  const displayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const timeString = displayFormatter.format(date);

  return {
    hour,
    minute,
    totalMinutes,
    timeString,
    isBeforeClockOut,
    isWithinClockOutWindow,
    isAfterClockOutWindow,
    canClockOut
  };
}
