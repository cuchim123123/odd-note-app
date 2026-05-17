import { z } from 'zod';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(72),
  confirmNewPassword: z.string().min(8).max(72),
}).superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmNewPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'New passwords do not match',
      path: ['confirmNewPassword'],
    });
  }
});

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordOutput = z.output<typeof changePasswordSchema>;
