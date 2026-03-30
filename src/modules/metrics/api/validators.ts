import { z } from 'zod';

export const periodQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const membersQuerySchema = paginationQuerySchema.extend({
  active: z.enum(['true', 'false']).optional(),
});

export const topQuerySchema = periodQuerySchema.extend({
  top: z.coerce.number().int().min(1).max(50).default(10),
});

export const generateReportSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly']),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const snapshotsQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export const dateRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const topChannelsQuerySchema = dateRangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
