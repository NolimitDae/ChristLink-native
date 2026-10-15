export interface Plan {
  eventId: string;
  name: string;
  start: string;
  kind: 'rsvp' | 'ticket';
}
