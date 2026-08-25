import { z } from 'zod';

export const RADIUS_OPTIONS = [10, 25, 50] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Magic bytes for validating actual file content, not just MIME type. */
const MAGIC_BYTES: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47], // PNG: 89 50 4e 47
  'image/jpeg': [0xff, 0xd8, 0xff], // JPEG: ff d8 ff
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP)
};

async function validateMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    for (const [mimeType, expected] of Object.entries(MAGIC_BYTES)) {
      if (file.type === mimeType) {
        return expected.every((byte, i) => bytes[i] === byte);
      }
    }
    return false;
  } catch {
    return false;
  }
}

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a real calendar date');

/** Shared by the client uploader and the server action, so limits never drift. */
export const imageFileSchema = z
  .instanceof(File, { message: 'Choose an image file' })
  .refine((file) => file.size > 0, 'The selected file is empty')
  .refine((file) => file.size <= MAX_UPLOAD_BYTES, 'Image must be 5MB or smaller')
  .refine(
    (file) => (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type),
    'Image must be a PNG, JPEG, or WebP',
  )
  .refine(async (file) => validateMagicBytes(file), 'File content does not match its extension');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().max(32).optional().or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72),
    confirmPassword: z.string(),
    role: z.enum(['PLAYER', 'OWNER']).default('PLAYER'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const createBookingSchema = z.object({
  courtId: z.string().cuid('Unknown court'),
  date: dateKeySchema,
  hour: z.coerce.number().int().min(0).max(23),
  notes: z.string().trim().max(280).optional().or(z.literal('')),
});

export const uploadReceiptSchema = z.object({
  bookingId: z.string().cuid(),
  referenceNumber: z.string().trim().max(64).optional().or(z.literal('')),
  amountClaimed: z.coerce.number().nonnegative().max(1_000_000).optional(),
  screenshot: imageFileSchema,
});

export const verifyBookingSchema = z.object({
  bookingId: z.string().cuid(),
  decision: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().trim().max(280).optional().or(z.literal('')),
});

export const courtSchema = z.object({
  id: z.string().cuid().optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Court name is required').max(60),
  type: z.enum(['INDOOR', 'OUTDOOR']),
  hourlyRate: z.coerce.number().positive('Rate must be greater than zero').max(100_000),
  openHour: z.coerce.number().int().min(0).max(23),
  closeHour: z.coerce.number().int().min(1).max(24),
  isActive: z.coerce.boolean().default(true),
});

export const courtFormSchema = courtSchema.refine((data) => data.closeHour > data.openHour, {
  message: 'Closing hour must be after opening hour',
  path: ['closeHour'],
});

export const paymentMethodSchema = z.object({
  id: z.string().cuid().optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Payment method name is required').max(40),
  accountName: z.string().trim().min(2, 'Account name is required').max(120),
  accountNumber: z.string().trim().max(64).optional().or(z.literal('')),
  instructions: z.string().trim().min(10, 'Give players at least a sentence of instruction').max(2000),
  qrCode: imageFileSchema.optional(),
});

export const deletePaymentMethodSchema = z.object({
  paymentMethodId: z.string().cuid(),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce
    .number()
    .refine((value): value is RadiusOption => (RADIUS_OPTIONS as readonly number[]).includes(value), {
      message: `Radius must be one of ${RADIUS_OPTIONS.join(', ')} km`,
    }),
});

/** An owner registering their own club. Coordinates drive the proximity search. */
export const clubRegistrationSchema = z.object({
  name: z.string().trim().min(3, 'Club name must be at least 3 characters').max(80),
  description: z.string().trim().min(20, 'Describe the club in at least a sentence').max(1000),
  address: z.string().trim().min(5, 'Street address is required').max(160),
  city: z.string().trim().min(2, 'City is required').max(80),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  latitude: z.coerce.number({ invalid_type_error: 'Latitude is required' }).min(-90).max(90),
  longitude: z.coerce.number({ invalid_type_error: 'Longitude is required' }).min(-180).max(180),
});

export const toggleClubSchema = z.object({
  clubId: z.string().cuid(),
  isActive: z.coerce.boolean(),
});
