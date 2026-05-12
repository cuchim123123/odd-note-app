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
    token: string;
  }): Promise<void> {
    const { to, displayName, token } = params;
    const baseUrl = this.env.APP_URL.replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/auth/verify-email/${token}`;

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
}
