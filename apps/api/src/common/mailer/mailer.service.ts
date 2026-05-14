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
        <p>This link expires in 1 hour.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    });
  }

  async sendNoteSharedEmail(params: {
    to: string;
    recipientName: string;
    senderName: string;
    noteTitle: string;
    permission: string;
    appUrl: string;
  }): Promise<void> {
    const { to, recipientName, senderName, noteTitle, permission, appUrl } = params;

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to,
      subject: `${senderName} shared a note with you`,
      html: `
        <p>Hello ${recipientName},</p>
        <p><strong>${senderName}</strong> shared a note with you: <strong>${noteTitle}</strong></p>
        <p>Permission level: <strong>${permission === 'READ' ? 'Read-only' : 'Can edit'}</strong></p>
        <p><a href="${appUrl}/notes">View the shared note</a></p>
        <p>If you did not expect this share, you can ignore this email or log in to manage your sharing settings.</p>
      `,
    });
  }
}
