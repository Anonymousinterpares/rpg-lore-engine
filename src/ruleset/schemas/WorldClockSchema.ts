import { z } from 'zod';

export const WorldClockSchema = z.object({
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59).default(0),
    day: z.number().min(1).max(30),
    month: z.number().min(1).max(12),
    year: z.number().min(1),
    totalTurns: z.number().default(0) // Internal turn counter for tracking durations
});

export type WorldClock = z.infer<typeof WorldClockSchema>;
