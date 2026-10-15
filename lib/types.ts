export type Role = 'attendee' | 'host' | 'admin' | 'verified';

export interface HostStripeAccount {
  stripe_account_id?: string | null;
  onboarding_complete?: boolean;
  payouts_enabled?: boolean;
  charges_enabled?: boolean;
}

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  bio?: string;
  city?: string;
  avatar_url?: string;
  avatar_color?: string;
  avatar_ring_color?: string;
  banner_url?: string;
  role: Role;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  bible_verse?: string;
  bible_verse_reference?: string;
  bible_version?: string;
  hot_takes?: string;
  hobbies?: string;
  connect_tags?: string[];
  prayer_request?: string;
  testimony?: string;
  prayer_supporters?: unknown;
  followers_count?: number;
  following_count?: number;
  identity_verified?: boolean;
  is_following?: boolean;
  restricted?: boolean;
  host_stripe_accounts?: HostStripeAccount[];
  created_at: string;
  updated_at?: string;
}

export interface PersonSummary {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  avatar_color?: string | null;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price_cents: number;
  quantity?: number | null;
  tickets_sold?: number;
  description?: string;
  created_at: string;
}

export type EventFormat = 'in_person' | 'online' | 'hybrid';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface Event {
  id: string;
  host_id: string;
  name: string;
  description?: string;
  emoji?: string;
  event_type?: string;
  age_group?: string;
  format: EventFormat;
  denomination?: string;
  tags?: string[];
  is_paid: boolean;
  absorb_stripe_fee?: boolean;
  listing_fee_paid?: boolean;
  start_date?: string;
  end_date?: string;
  sales_cutoff?: string;
  publish_at?: string;
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  online_url?: string;
  max_capacity?: number;
  rsvp_count?: number;
  forum_enabled?: boolean;
  requires_approval?: boolean;
  cover_url?: string;
  gallery_urls?: string[];
  status: EventStatus;
  lat?: number;
  lng?: number;
  view_count?: number;
  created_at: string;
  updated_at?: string;
  host_name?: string;
  host_avatar_url?: string;
  host_avatar_color?: string;
  host_role?: string;
  /** Confirmed RSVPs + tickets, normalized from the API's `confirmed_rsvps`. */
  going_count: number;
  ticket_types: TicketType[];
}

export type PostType = 'prayer' | 'praise' | 'testimony' | 'encouragement' | 'answered';

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  amen_count: number;
  has_amened?: boolean;
  reply_count: number;
  post_type?: PostType | null;
  prayer_id?: string | null;
  created_at: string;
  profiles?: PersonSummary & { role?: string };
}

export interface CommunityReply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  amen_count?: number;
  created_at: string;
  profiles?: PersonSummary;
}

export interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'cancelled' | 'pending';
  created_at: string;
  event_name?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_city?: string;
  event_cover_url?: string;
  event_venue_name?: string;
}

export interface Ticket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_type_id?: string;
  quantity: number;
  unit_price_cents: number;
  total_charged_cents: number;
  platform_fee_cents?: number;
  stripe_fee_cents?: number;
  host_receives_cents?: number;
  discount_cents?: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded' | 'failed';
  code?: string;
  buyer_email?: string;
  confirmed_at?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  stripe_payment_intent?: string;
  created_at: string;
  event_name?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_city?: string;
  event_venue_name?: string;
  event_cover_url?: string;
  ticket_type_name?: string;
  ticket_types?: { name?: string } | null;
  profiles?: PersonSummary & { email?: string };
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  emoji?: string;
  event_type?: string;
  age_group?: string;
  format: EventFormat;
  denomination?: string;
  tags?: string[];
  is_paid: boolean;
  absorb_stripe_fee?: boolean;
  start_date?: string;
  end_date?: string;
  sales_cutoff?: string;
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  online_url?: string;
  max_capacity?: number;
  forum_enabled?: boolean;
  cover_url?: string;
  gallery_urls?: string[];
  publish_at?: string;
}

export interface EventsResponse {
  events: Event[];
}

export interface CommunityPostsResponse {
  posts: CommunityPost[];
}

export interface MyEventsResponse {
  events: Event[];
}

export interface MyRsvpsResponse {
  rsvps: RSVP[];
}

export interface MyTicketsResponse {
  tickets: Ticket[];
}

export interface ServerPriceBreakdown {
  face: number;
  chargeAmount: number;
  platformFee: number;
  stripeFee: number;
  hostReceives: number;
}

export interface PaymentIntentResponse {
  clientSecret?: string;
  ticketCode?: string;
  free?: boolean;
  error?: string;
}

export interface CouponResult {
  label: string;
  newTotal: number;
  discount_cents?: number;
}

export interface EventSales {
  event: Event;
  tickets: Ticket[];
  rsvps: (RSVP & { profiles?: PersonSummary & { email?: string } })[];
  summary: {
    totalTicketsSold: number;
    totalRsvps: number;
    grossRevenue: number;
    hostEarnings: number;
  };
}

export interface RefundRequest {
  id: string;
  ticket_id: string;
  requester_id: string | null;
  host_id: string;
  event_id: string;
  reason?: string;
  amount_cents?: number;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  profiles?: PersonSummary;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface ForumMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  message_type?: string;
  created_at: string;
  profiles?: PersonSummary;
}

export interface HostStats {
  eventsHosted: number;
  totalAttendees: number;
  isVerified: boolean;
}

export interface TicketVerifyResult {
  valid: boolean;
  message?: string;
  error?: string;
  ticket?: Partial<Ticket>;
}

export interface IdentityStatus {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  legal_name?: string;
  submitted_at?: string;
  rejection_reason?: string;
}

// ── Supabase-backed features (supabase/migrations) ──────────────────────────
export interface Church {
  id: string;
  name: string;
  denomination?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  service_times: { day: number; time: string; label?: string }[];
  livestream_url?: string | null;
  website_url?: string | null;
  leaders: { name: string; title?: string }[];
  photos: string[];
  logo_url?: string | null;
  about?: string | null;
  verified: boolean;
  claimed_by?: string | null;
  created_at: string;
}

export interface ChurchRecurringEvent {
  id: string;
  church_id: string;
  name: string;
  description?: string | null;
  event_type?: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  weekday?: number | null;
  day_of_month?: number | null;
  start_time: string;
  duration_minutes: number;
  starts_on: string;
  ends_on?: string | null;
  location?: string | null;
  is_service: boolean;
}

export interface Prayer {
  id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  answered_at: string | null;
  testimony: string | null;
  prayed_count: number;
  has_prayed: boolean;
  is_mine: boolean;
  is_friend: boolean;
  church_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_avatar_color: string | null;
}

export type PrayerFilter = 'all' | 'church' | 'friends' | 'answered' | 'mine';

export interface FriendsGoing {
  event_id: string;
  friend_count: number;
  friends: PersonSummary[];
}

export interface FriendActivity {
  event_id: string;
  event_name: string;
  start_date: string;
  cover_url: string | null;
  friends: PersonSummary[];
}

export interface ServeShift {
  shift_id: string;
  role_id: string;
  role_name: string;
  description: string | null;
  requirements: string | null;
  starts_at: string;
  ends_at: string;
  spots: number;
  taken: number;
  event_id: string | null;
  event_name: string | null;
  church_id: string | null;
  church_name: string | null;
  my_signup_id: string | null;
  my_status: string | null;
  my_code: string | null;
}

export interface ServeRosterEntry {
  id: string;
  shift_id: string;
  user_id: string;
  status: 'signed_up' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
  code: string;
  checked_in_at: string | null;
  profiles?: PersonSummary;
}

export interface UserSettings {
  user_id: string;
  home_church_id: string | null;
  hide_rsvps_from_non_friends: boolean;
  notification_prefs: Partial<Record<NotificationType, boolean>>;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  host_adult_confirmed_at: string | null;
  onboarding_completed_at: string | null;
}

export type NotificationType =
  | 'tickets'
  | 'reminders'
  | 'new_events'
  | 'friend_rsvps'
  | 'prayer'
  | 'serve'
  | 'forum'
  | 'refunds'
  | 'host';

export type ReportTarget = 'post' | 'reply' | 'forum_message' | 'prayer' | 'profile' | 'event' | 'church';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'scam' | 'false_info' | 'other';

export interface ReportQueueItem {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
  report_count: number;
  preview: string;
  reporter_name: string | null;
}
