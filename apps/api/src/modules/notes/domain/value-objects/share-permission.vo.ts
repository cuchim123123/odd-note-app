import { ValueObject } from '@shared/domain/ddd/value-object';
import { DomainError } from '@shared/domain/errors/domain-error';

export interface SharePermissionProps {
  value: 'READ' | 'EDIT';
}

export class InvalidSharePermissionError extends DomainError {
  constructor(value: string) {
    super(`Invalid share permission: ${value}. Must be 'READ' or 'EDIT'`, 'INVALID_SHARE_PERMISSION');
  }
}

export class SharePermission extends ValueObject<SharePermissionProps> {
  private constructor(props: SharePermissionProps) {
    super(props);
  }

  get value(): 'READ' | 'EDIT' {
    return this.props.value;
  }

  public static create(permission: string): SharePermission {
    if (permission !== 'READ' && permission !== 'EDIT') {
      throw new InvalidSharePermissionError(permission);
    }

    return new SharePermission({ value: permission });
  }
}
