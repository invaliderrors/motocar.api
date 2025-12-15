import { startOfDay, endOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const timeZone = 'America/Bogota';

export function toColombiaMidnightUtc(date: string | Date): Date {
  // Parse the input date and extract date components
  const inputDate = new Date(date);
  
  // Extract year, month, and day from the input (treating it as the intended calendar date)
  // When date is "2025-12-15T00:00:00.000Z", we want to keep Dec 15, not convert to Dec 14
  const year = inputDate.getUTCFullYear();
  const month = inputDate.getUTCMonth();
  const day = inputDate.getUTCDate();
  
  // Create a new date at midnight in local time with those components
  const localDate = new Date(year, month, day, 0, 0, 0, 0);
  
  // Convert to UTC treating it as Colombia time
  return zonedTimeToUtc(localDate, 'America/Bogota');
}


export function getColombiaDayRange(date: Date = new Date()) {
  const startDayCol = startOfDay(date);
  const endDayCol = endOfDay(date);
  const startUtc = zonedTimeToUtc(startDayCol, timeZone);
  const endUtc = zonedTimeToUtc(endDayCol, timeZone);
  return { startUtc, endUtc };
}

export function toColombiaEndOfDayUtc(date: string | Date): Date {
  const zoned = new Date(
    new Date(date).toLocaleString('en-US', { timeZone: 'America/Bogota' })
  )
  zoned.setHours(23, 59, 59, 999)
  return zonedTimeToUtc(zoned, 'America/Bogota')
}

export function toColombiaUtc(date: Date | string) {
  const localDate = typeof date === 'string' ? new Date(date) : date
  const zoned = utcToZonedTime(localDate, timeZone)
  return zonedTimeToUtc(zoned, timeZone)
}