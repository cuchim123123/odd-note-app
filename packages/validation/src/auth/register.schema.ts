import { z } from 'zod';

const registerBaseSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72),
});

export type RegisterInput = {
  email: string;
  displayName: string;
  password: string;
};

export type RegisterRequestInput = z.input<typeof registerBaseSchema>;

export const registerSchema: z.ZodType<RegisterInput, z.ZodTypeDef, RegisterRequestInput> = registerBaseSchema
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
