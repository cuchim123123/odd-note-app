import { z } from 'zod';

const registerBaseSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
});

export const registerSchema = registerBaseSchema
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  })
  .transform((value) => ({
    email: value.email,
    displayName: value.displayName,
    password: value.password,
  }));

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterRequestInput = z.input<typeof registerBaseSchema>;
