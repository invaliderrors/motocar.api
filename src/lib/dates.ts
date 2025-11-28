import { startOfDay, endOfDay } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const timeZone = 'America/Bogota';

export function toColombiaMidnightUtc(date: string | Date): Date {
  const zoned = new Date(
    new Date(date).toLocaleString('en-US', { timeZone: 'America/Bogota' })
  )
  zoned.setHours(0, 0, 0, 0)
  return zonedTimeToUtc(zoned, 'America/Bogota')
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