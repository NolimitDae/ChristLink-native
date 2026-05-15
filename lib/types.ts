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
  role: 'attendee' | 'host' | 'admin' | 'verified';
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
  prayer_supporters?: string[];
  followers_count?: number;
  following_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price_cents: number;
  quantity?: number;
  tickets_sold?: number;
  description?: string;
  created_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  name: string;
  description?: string;
  emoji?: string;
  event_type?: string;
  age_group?: string;
  format: 'in_person' | 'online' | 'hybrid';
  denomination?: string;
  tags?: string[];
  is_paid: boolean;
  absorb_stripe_fee?: boolean;
  listing_fee_paid?: boolean;
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
  rsvp_count?: number;
  forum_enabled?: boolean;
  cover_url?: string;
  gallery_urls?: string[];
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  lat?: number;
  lng?: number;
  created_at: string;
  updated_at?: string;
  // Joined fields from events_with_details view
  host_name?: string;
  host_avatar_url?: string;
  host_avatar_color?: string;
  host_role?: string;
  going_count?: number;
  ticket_types?: TicketType[];
  attendee_count?: number;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  amen_count: number;
  has_amened?: boolean;
  reply_count?: number;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    avatar_color?: string;
    role?: string;
  };
}

export interface CommunityReply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    avatar_color?: string;
  };
}

export interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  event_name?: string;
  event_start_date?: string;
  event_city?: string;
  event_cover_url?: string;
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
  host_receives_cents?: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'refunded';
  code?: string;
  buyer_email?: string;
  confirmed_at?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  created_at: string;
  // Joined
  event_name?: string;
  event_start_date?: string;
  event_city?: string;
  event_cover_url?: string;
  ticket_type_name?: string;
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  event_type?: string;
  age_group?: string;
  format: 'in_person' | 'online' | 'hybrid';
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

export interface ApiError {
  error: string;
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
