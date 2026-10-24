import { z } from 'zod';

export const NCII_PUBLIC_LABEL = 'Shared without consent' as const;

export const TidaRequestSchema = z.object({
  signature: z.string().trim().min(2).max(200),
  capacity: z.enum(['self', 'authorized']),
  goodFaith: z.literal(true),
});

export type TidaRequest = z.infer<typeof TidaRequestSchema>;

export function isNciiPublicReport(type: string): boolean {
  return type === NCII_PUBLIC_LABEL;
}

export function tidaDeadline(receivedAt: Date = new Date()): Date {
  return new Date(receivedAt.getTime() + 48 * 60 * 60 * 1000);
}
