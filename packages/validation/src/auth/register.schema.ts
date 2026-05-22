import { z } from 'zod';

const registerBaseSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(100, 'Display name cannot exceed 100 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters').max(72, 'Confirm password cannot exceed 72 characters'),
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

export const registerRequestSchema = registerSchema;

export type RegisterRequestInput = z.input<typeof registerSchema>;
export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
});

export type LoginInput = z.output<typeof loginSchema>;

