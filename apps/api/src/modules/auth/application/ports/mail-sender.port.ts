export interface MailSender {
  sendVerificationEmail(to: string, displayName: string, verificationToken: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetToken: string): Promise<void>;
}

export const MAIL_SENDER = Symbol('MailSender');
