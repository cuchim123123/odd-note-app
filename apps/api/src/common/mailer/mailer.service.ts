import { Inject, Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EnvConfig } from '../../config/config.module';

@Injectable()
export class MailerService {
  private readonly transporter: Transporter;

  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {
    this.transporter = createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_PORT === 465,
      auth:
        this.env.SMTP_USER && this.env.SMTP_PASS
          ? {
              user: this.env.SMTP_USER,
              pass: this.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async sendVerificationEmail(params: {
    to: string;
    displayName: string;
    verificationUrl: string;
  }): Promise<void> {
    const { to, displayName, verificationUrl } = params;

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to,
      subject: 'Activate your odd-note-app account',
      html: `
        <p>Hello ${displayName},</p>
        <p>Please activate your account by clicking this link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>If you did not create this account, you can ignore this email.</p>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to,
      subject: 'Reset your odd-note-app password',
      html: `
        <p>You requested to reset your password.</p>
        <p>Click this link to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    });
  }

  async sendNoteSharedEmail(params: {
    to: string;
    recipientName: string;
    senderName: string;
    noteTitle: string;
    noteId: string;
    permission: string;
    appUrl: string;
  }): Promise<void> {
    const { to, recipientName, senderName, noteTitle, noteId, permission, appUrl } = params;

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to,
      subject: `${senderName} shared a note with you`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700; tracking: -0.02em;">Collaborative Note Share</h2>
          <p style="color: #475569; font-size: 15px; line-height: 24px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 15px; line-height: 24px;">
            <strong>${senderName}</strong> has shared a note with you:
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #0f172a;">${noteTitle}</p>
            <span style="display: inline-block; font-size: 12px; font-weight: 600; color: #4f46e5; background-color: #e0e7ff; padding: 4px 10px; border-radius: 9999px;">
              ${permission === 'READ' ? 'Read-only access' : 'Can edit and collaborate'}
            </span>
          </div>
          <div style="margin: 28px 0 20px 0; text-align: center;">
            <a href="${appUrl}/notes/${noteId}" style="display: inline-block; font-weight: 600; text-decoration: none; color: #ffffff; background-color: #4f46e5; padding: 12px 24px; border-radius: 12px; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1);">
              Open in OddNote
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 18px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            If you did not expect this sharing notification, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }
}
