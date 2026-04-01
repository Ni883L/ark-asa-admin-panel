class AppError extends Error {
  constructor(message, status = 500, code = 'APP_ERROR', expose = true) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, 400, code, true);
  }
}

class AuthError extends AppError {
  constructor(message = 'Nicht angemeldet.', code = 'AUTH_ERROR') {
    super(message, 401, code, true);
  }
}

class PermissionError extends AppError {
  constructor(message = 'Keine Berechtigung.', code = 'PERMISSION_ERROR') {
    super(message, 403, code, true);
  }
}

class OperationalError extends AppError {
  constructor(message = 'Interner Verarbeitungsfehler.', code = 'OPERATIONAL_ERROR', status = 500) {
    super(message, status, code, true);
  }
}

module.exports = { AppError, ValidationError, AuthError, PermissionError, OperationalError };
