import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  organizationName: z.string().min(2).max(150),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
