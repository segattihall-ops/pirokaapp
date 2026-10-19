/**
 * πroka pin/display math. Source: design_handoff/design/Piroka App v2.dc.html,
 * and latest user-confirmed PIN ANATOMY spec. All exports are pure/server safe.
 * This module NEVER grants access to exact locations or original photographs.
 */
export const METRES_PER_MILE = 1609.344;

export function approx(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return 'Distance unavailable';
  // Prototype rounds upwards, at no better than a tenth of a mile.
  const miles = Math.max(0.1, Math.ceil((metres / METRES_PER_MILE) * 10) / 10);
  return `~${miles.toFixed(1)} mi`;
}

/** ONLY pass acceptedMeet=true after the server confirms both members opted in. */
export function exact(metres: number, acceptedMeet = false): string {
  if (!acceptedMeet) return approx(metres);
  if (!Number.isFinite(metres) || metres < 0) return 'Distance unavailable';
  const feet = metres * 3.28084;
  return feet < 1000
    ? `${Math.round(feet / 10) * 10} ft`
    : `${(metres / METRES_PER_MILE).toFixed(2)} mi`;
}

export function dur(minutes: number): string {
  if (!Number.isFinite(minutes)) return '0m';
  const value = Math.max(0, Math.round(minutes));
  return value < 60 ? `${value}m` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

export function addTripDays(ymd: string, nights: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !Number.isInteger(nights)) return '';
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + nights);
  return date.toISOString().slice(0, 10);
}

export function validDay(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && addTripDays(ymd, 0) === ymd;
}

export function tripNights(arriveOn: string, departOn: string): number {
  if (!validDay(arriveOn) || !validDay(departOn)) return 0;
  return Math.round((Date.parse(`${departOn}T12:00:00Z`) - Date.parse(`${arriveOn}T12:00:00Z`)) / 86_400_000);
}

/** Weekday at the destination: stored calendar dates, not device-dependent UTC offsets. */
export function dayName(ymd: string): string {
  if (!validDay(ymd)) return '';
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function validWallTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

/** Input is a destination-local wall clock (HH:mm); no guessed timezone. */
export function clockAt(time: string, alwaysMinutes = false): string {
  // PostgreSQL time columns serialize as HH:mm:ss; the client form submits HH:mm.
  // Parse both without adding a timezone or manufacturing an arrival/departure hour.
  const trimmed = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(time) ? time.slice(0, 5) : time;
  if (!validWallTime(trimmed)) return '';
  const [hour, minute] = trimmed.split(':').map(Number);
  const hour12 = hour % 12 || 12;
  const digits = minute || alwaysMinutes ? `:${String(minute).padStart(2, '0')}` : '';
  return `${hour12}${digits} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export type TripSchedule = {
  arriveOn: string;
  nights: number;
  arrivalTime?: string | null;
  departOn?: string | null;
  departureTime?: string | null;
};

/** Never invent hours when migrating an older date-only trip. */
export function tripText(trip: TripSchedule): string {
  const departure = trip.departOn && validDay(trip.departOn)
    ? trip.departOn : addTripDays(trip.arriveOn, trip.nights);
  const arrival = dayName(trip.arriveOn);
  const end = dayName(departure);
  if (!arrival || !end) return 'Arrival date unavailable';
  const startClock = trip.arrivalTime ? clockAt(trip.arrivalTime) : '';
  const endClock = trip.departureTime ? clockAt(trip.departureTime) : '';
  return `Arrives ${arrival}${startClock ? ` ${startClock}` : ''} → ${end}${endClock ? ` ${endClock}` : ''}`;
}

export function tripDateTime(ymd: string, time?: string | null): string {
  if (!validDay(ymd)) return '';
  const date = new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const localClock = time ? clockAt(time, true) : '';
  return localClock ? `${date}, ${localClock}` : date;
}

/** The original neutral-white place ring fills with activity, never with a color heat scale. */
export function heatOf(place: {
  here?: number;
  arriving?: number;
  going?: boolean;
  checked?: boolean;
}): number {
  const here = Math.max(0, Number(place.here) || 0);
  const arriving = Math.max(0, Number(place.arriving) || 0);
  return Math.min(1, (here + arriving * 1.5 + (place.going ? 1.5 : 0) + (place.checked ? 1 : 0)) / 45);
}

export function heatLabel(heat: number): 'Chill' | 'Lively' | 'Busy' | 'Packed' {
  if (heat >= 0.8) return 'Packed';
  if (heat >= 0.6) return 'Busy';
  if (heat >= 0.35) return 'Lively';
  return 'Chill';
}

/** Popping is based on distinct active on-site votes returned by the server, never headcount. */
export function isPopping(activeOnSiteVotes: number): boolean {
  return Number.isInteger(activeOnSiteVotes) && activeOnSiteVotes >= 5;
}

/** Even the owner's pin must not appear when the owner selected Hidden visibility. */
export function isSelfPinVisible(visibility: string | null | undefined): boolean {
  return visibility === 'neighborhood' || visibility === 'area';
}
