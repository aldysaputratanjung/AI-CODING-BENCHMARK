// Centralized application errors → consistent JSON API error responses.

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** 401 — generic message to avoid user enumeration. */
export class GenericAuthError extends AppError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "VALIDATION_ERROR", "Invalid input", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, "RATE_LIMITED", message);
  }
}
