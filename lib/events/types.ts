export type EventCategory =
  | 'party'
  | 'meetup'
  | 'sports'
  | 'cultural'
  | 'nightlife'
  | 'other';
export type RSVPStatus = 'interested' | 'going' | 'maybe';

export interface Event {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  location_name: string;
  distance_km?: number;
  photo?: string;
  starts_at: string;
  ends_at: string;
  category: EventCategory;
  max_attendees?: number;
  created_at: string;
  updated_at?: string;
  attendee_count?: number;
  my_rsvp_status?: RSVPStatus | null;
  creator?: { id: string; handle: string; photo?: string };
}

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  party: '🎉 Party',
  meetup: '👥 Meetup',
  sports: '⚽ Sports',
  cultural: '🎭 Cultural',
  nightlife: '🌙 Nightlife',
  other: '📌 Event',
};

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  party: '#ec4899',
  meetup: '#8b5cf6',
  sports: '#f59e0b',
  cultural: '#06b6d4',
  nightlife: '#6366f1',
  other: '#64748b',
};
