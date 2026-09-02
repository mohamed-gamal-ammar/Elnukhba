import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const tsx = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
const modulePath = './server/middleware/auth.ts';
const startupGuardPath = './server/jwt-startup.ts';

function runTsx(env: Record<string, string | undefined>, codeOrPath: string, args: string[] = []) {
  const commandArgs = codeOrPath.endsWith('.ts') ? [codeOrPath, ...args] : ['-e', codeOrPath];
  return execFileSync(tsx, commandArgs, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runTsxExpectFailure(env: Record<string, string | undefined>, codeOrPath: string) {
  try {
    runTsx(env, codeOrPath);
    assert.fail('Expected startup to fail');
  } catch (error: any) {
    return `${error.stdout || ''}\n${error.stderr || ''}`;
  }
}

// 1. Production startup guard without JWT_SECRET must fail with a clear message.
const productionMissingSecretError = runTsxExpectFailure(
  { NODE_ENV: 'production', JWT_SECRET: '', SESSION_SECRET: 'should-not-be-used' },
  startupGuardPath,
);
assert.match(productionMissingSecretError, /JWT_SECRET is required in production/i);

// 2. Production startup guard with JWT_SECRET must succeed.
assert.equal(
  runTsx({ NODE_ENV: 'production', JWT_SECRET: 'production-startup-test-secret', SESSION_SECRET: 'different-secret' }, startupGuardPath),
  '',
);

// 3. Development startup guard without JWT_SECRET must allow the explicit development/test fallback.
assert.equal(
  runTsx({ NODE_ENV: 'development', JWT_SECRET: '', SESSION_SECRET: '' }, startupGuardPath),
  '',
);

// 4. Development/Test fallback must actually sign and verify with the explicit fallback.
const developmentFallback = runTsx(
  { NODE_ENV: 'development', JWT_SECRET: '', SESSION_SECRET: '' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'dev-fallback-test' }); const decoded = jwt.verify(token, 'development-test-only-jwt-secret', { algorithms: ['HS256'] }); if (!decoded || typeof decoded !== 'object' || decoded.sub !== 'dev-fallback-test') process.exit(1); console.log('PASS');`,
);
assert.equal(developmentFallback, 'PASS');

// 5. A token generated with the configured production secret must verify with that same secret.
const configuredSecret = 'production-test-secret-2026';
const configuredVerification = runTsx(
  { NODE_ENV: 'production', JWT_SECRET: configuredSecret, SESSION_SECRET: 'different-secret' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'configured-test' }); const decoded = jwt.verify(token, ${JSON.stringify(configuredSecret)}, { algorithms: ['HS256'] }); if (!decoded || typeof decoded !== 'object' || decoded.sub !== 'configured-test') process.exit(1); console.log('PASS');`,
);
assert.equal(configuredVerification, 'PASS');

// 6. A token must be rejected when verified with a different secret.
const differentSecretRejected = runTsx(
  { NODE_ENV: 'test', JWT_SECRET: 'configured-secret-for-test' },
  `import jwt from 'jsonwebtoken'; import { generateToken } from '${modulePath}'; const token = generateToken({ sub: 'different-secret-test' }); try { jwt.verify(token, 'different-secret', { algorithms: ['HS256'] }); process.exit(1); } catch { console.log('PASS'); }`,
);
assert.equal(differentSecretRejected, 'PASS');

// 7. Ensure the development-only fallback is not used when NODE_ENV=production.
const productionFallbackBlocked = runTsxExpectFailure(
  { NODE_ENV: 'production', JWT_SECRET: '', SESSION_SECRET: '' },
  `import '${modulePath}';`,
);
assert.match(productionFallbackBlocked, /JWT_SECRET is required in production/i);

console.log('JWT hardening security tests: PASS (7/7)');
