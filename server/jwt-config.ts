const isProduction = process.env.NODE_ENV === 'production';
const configuredJwtSecret = process.env.JWT_SECRET?.trim();

if (isProduction && !configuredJwtSecret) {
  throw new Error('JWT_SECRET is required in production. Set JWT_SECRET before starting the server.');
}

// Development/Test fallback only. Never used when NODE_ENV=production.
const DEVELOPMENT_TEST_JWT_SECRET = 'development-test-only-jwt-secret';

export const JWT_SECRET = configuredJwtSecret || (!isProduction
  ? process.env.SESSION_SECRET?.trim() || DEVELOPMENT_TEST_JWT_SECRET
  : '');

export const JWT_ENVIRONMENT = isProduction ? 'production' : 'development-or-test';
