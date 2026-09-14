import { z } from 'zod';

export const meetingSchema = z.object({
  title: z.string().min(1),
  deal: z.string().optional(),
  contact: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
});
