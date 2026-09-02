import { JWT_SECRET, JWT_ENVIRONMENT } from './jwt-config.js';

// Startup guard: loading this module must fail in production when JWT_SECRET is missing.
// Never log the secret or any JWT token.
if (!JWT_SECRET) {
  throw new Error(`JWT secret configuration is invalid for ${JWT_ENVIRONMENT}.`);
}
