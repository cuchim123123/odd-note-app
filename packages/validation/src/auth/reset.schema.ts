import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password cannot exceed 72 characters"),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters").max(72, "Confirm password cannot exceed 72 characters"),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  }
});

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
