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

export type RegisterRequestInput = z.input<typeof registerSchema>;
export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

export type LoginInput = z.output<typeof loginSchema>;

