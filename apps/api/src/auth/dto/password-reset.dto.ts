import { forgotPasswordSchema, resetPasswordSchema } from '@odd-note-app/validation';

export type ForgotPasswordDto = typeof forgotPasswordSchema._input;
export type ResetPasswordDto = typeof resetPasswordSchema._input & { token: string };
