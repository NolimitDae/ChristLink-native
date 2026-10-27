import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

export const fullNameSchema = z
  .string()
  .max(80, 'Name must be 80 characters or less')
  .trim()
  .optional();

export const PASSWORD_MIN = 8;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(72, 'Password must be 72 characters or less');

export const otpSchema = z
  .string()
  .length(6, 'Code must be exactly 6 digits')
  .regex(/^\d{6}$/, 'Code must contain only numbers');

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(80).trim(),
  bio: z.string().max(300, 'Bio must be 300 characters or less').trim().optional(),
  city: z.string().max(100).trim().optional(),
  bible_verse: z.string().max(500).trim().optional(),
  bible_verse_reference: z.string().max(100).trim().optional(),
  instagram_url: z.string().url('Invalid Instagram URL').optional().or(z.literal('')),
  facebook_url: z.string().url('Invalid Facebook URL').optional().or(z.literal('')),
  tiktok_url: z.string().url('Invalid TikTok URL').optional().or(z.literal('')),
});

export const createEventSchema = z
  .object({
    name: z.string().min(3, 'Event name must be at least 3 characters').max(120).trim(),
    description: z.string().max(2000).trim().optional(),
    event_type: z.string().optional(),
    age_group: z.string().optional(),
    format: z.enum(['in_person', 'online', 'hybrid']).refine(
      v => ['in_person', 'online', 'hybrid'].includes(v),
      { message: 'Please select a valid format' },
    ),
    is_paid: z.boolean(),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional(),
    venue_name: z.string().max(200).trim().optional(),
    address: z.string().max(300).trim().optional(),
    city: z.string().max(100).trim().optional(),
    state: z.string().max(50).trim().optional(),
    zip: z.string().max(20).trim().optional(),
    online_url: z.string().url('Invalid URL').optional().or(z.literal('')),
    max_capacity: z.number().int().positive().optional(),
  })
  .refine(
    data => {
      if (data.format === 'in_person' || data.format === 'hybrid') {
        return !!data.city;
      }
      return true;
    },
    { message: 'City is required for in-person and hybrid events', path: ['city'] },
  )
  .refine(
    data => {
      if (data.format === 'online' || data.format === 'hybrid') {
        return !!data.online_url;
      }
      return true;
    },
    { message: 'Online URL is required for online and hybrid events', path: ['online_url'] },
  );

export const communityPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Post cannot be empty')
    .max(1000, 'Post must be 1000 characters or less')
    .trim(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CommunityPostInput = z.infer<typeof communityPostSchema>;

export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((e: z.ZodIssue) => e.message).join('. ');
}
