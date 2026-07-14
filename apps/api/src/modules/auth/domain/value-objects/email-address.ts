import { ValueObject } from '../../../../common/domain/value-object';
import { InvalidCredentialsError } from '../errors/auth-error';

export interface EmailAddressProps {
  value: string;
}

export class EmailAddress extends ValueObject<EmailAddressProps> {
  private constructor(props: EmailAddressProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): EmailAddress {
    if (!email) {
      throw new InvalidCredentialsError('Email cannot be empty');
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new InvalidCredentialsError('Invalid email format');
    }

    return new EmailAddress({ value: trimmedEmail });
  }
}
