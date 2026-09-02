import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const tsx = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
const modulePath = './server/middleware/auth.ts';

function runAuthModule(env: Record<string, string | undefined>, code: string) {
  const result = execFileSync(tsx, ['-e', code], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.trim();
}

function runAuthModuleExpectFailure(env: Record<string, string | undefined>, code: string) {
  try {
    execFileSync(tsx, ['-e', code], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('Expected auth module startup to fail');
  } catch (error: any) {
    return `${error.stdout || ''}\n${error.stderr || ''}`;
  }
}

const importOnly = `import '${modulePath}';`;

// 1. Production without JWT_SECRET must fail during module/server startup.
const productionMissingSecretError = runAuthModuleExpectFailure(
  { NODE_ENV: 'production', JWT_SECRET: '', SESSION_SECRET: 'should-not-be-used' },
  importOnly,
);
assert.match(productionMissingSecretError, /JWT_SECRET is required in production/i);

// 2. Production with JWT_SECRET must start successfully and use that configured secret.
const configuredSecret = 'production-test-secret-2026';
const productionStart = runAuthModule(
  { NODE_ENV: 'production', JWT_SECRET: configuredSecret, SESSION_SECRET: 'different-secret' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'jwt-hardening-test' }); const decoded = jwt.verify(token, ${JSON.stringify(configuredSecret)}, { algorithms: ['HS256'] }); if (!decoded || typeof decoded !== 'object' || decoded.sub !== 'jwt-hardening-test') process.exit(1); console.log('PASS');`,
);
assert.equal(productionStart, 'PASS');

// 3. Development/Test without JWT_SECRET may use the explicitly non-production fallback.
const developmentFallback = runAuthModule(
  { NODE_ENV: 'development', JWT_SECRET: '', SESSION_SECRET: '' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'dev-fallback-test' }); const decoded = jwt.verify(token, 'development-test-only-jwt-secret', { algorithms: ['HS256'] }); if (!decoded || typeof decoded !== 'object' || decoded.sub !== 'dev-fallback-test') process.exit(1); console.log('PASS');`,
);
assert.equal(developmentFallback, 'PASS');

// 4. A token signed with the configured secret verifies successfully.
const configuredVerification = runAuthModule(
  { NODE_ENV: 'test', JWT_SECRET: 'configured-secret-for-test' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'configured-test' }); const decoded = jwt.verify(token, 'configured-secret-for-test', { algorithms: ['HS256'] }); if (!decoded || typeof decoded !== 'object' || decoded.sub !== 'configured-test') process.exit(1); console.log('PASS');`,
);
assert.equal(configuredVerification, 'PASS');

// 5. A token must be rejected when verified with a different secret.
const differentSecretRejected = runAuthModule(
  { NODE_ENV: 'test', JWT_SECRET: 'configured-secret-for-test' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'different-secret-test' }); try { jwt.verify(token, 'different-secret', { algorithms: ['HS256'] }); process.exit(1); } catch { console.log('PASS'); }`,
);
assert.equal(differentSecretRejected, 'PASS');

console.log('JWT hardening security tests: PASS (5/5)');
