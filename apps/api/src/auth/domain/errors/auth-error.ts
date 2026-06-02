export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS');
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(message = 'Email is already registered') {
    super(message, 'USER_ALREADY_EXISTS');
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message = 'User not found') {
    super(message, 'USER_NOT_FOUND');
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Token is invalid or expired') {
    super(message, 'INVALID_TOKEN');
  }
}

export class TokenAlreadyUsedError extends AuthError {
  constructor(message = 'Token has already been used') {
    super(message, 'TOKEN_ALREADY_USED');
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class IncorrectPasswordError extends AuthError {
  constructor(message = 'Incorrect current password') {
    super(message, 'INCORRECT_PASSWORD');
  }
}
