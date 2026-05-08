import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.preprocess((val: unknown) => (typeof val === 'string' ? val.trim() : val), z.string().email()),
    displayName: z.preprocess((val: unknown) => (typeof val === 'string' ? val.trim() : val), z.string().min(2).max(100)),
    // Passwords usually shouldn't be implicitly trimmed — preserve user intent
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

export type RawRegisterInput = z.infer<typeof registerSchema>;
export type RegisterInput = Omit<RawRegisterInput, 'confirmPassword'>;
