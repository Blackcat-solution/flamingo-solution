export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'forbidden', message);
export const mfaEnrollmentRequired = (
  message = 'Administrator multi-factor authentication is required. Enrol an authenticator app before using the admin console.'
) => new AppError(403, 'mfa_enrollment_required', message);
export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
export const conflict = (message, details) => new AppError(409, 'conflict', message, details);
export const unprocessable = (message, details) =>
  new AppError(422, 'validation_failed', message, details);
export const tooMany = (message = 'Too many requests. Please try again later.') =>
  new AppError(429, 'rate_limited', message);
