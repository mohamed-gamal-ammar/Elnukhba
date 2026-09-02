import fs from 'fs';
import path from 'path';

const findings: Array<{ severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; title: string; detail: string }> = [];

function readIfExists(file: string): string {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

const server = readIfExists(path.join(process.cwd(), 'server.ts'));
const db = readIfExists(path.join(process.cwd(), 'server', 'db.ts'));
const allSource = [server, db].join('\n');

if (/Math\.random\(\)\s*\*\s*9000|Math\.random\(\)\s*\*\s*900000/i.test(server)) {
  findings.push({
    severity: 'HIGH',
    title: 'Predictable security-sensitive identifiers/codes',
    detail: 'Math.random() is used for order identifiers and/or verification codes. Security-sensitive identifiers should use crypto.randomBytes/randomInt and should not be short enumerable values.'
  });
}

if (/res\.json\(\{\s*valid:\s*true,\s*\.\.\.coupon/i.test(server)) {
  findings.push({
    severity: 'MEDIUM',
    title: 'Coupon validation response exposes internal coupon fields',
    detail: 'The public coupon validation endpoint spreads the full coupon object into its response. Return only fields required by the storefront.'
  });
}

if (/app\.get\(['\"]\/api\/orders\/track['\"]/.test(server) && !/app\.get\(['\"]\/api\/orders\/track['\"].*rate/i.test(server)) {
  findings.push({
    severity: 'MEDIUM',
    title: 'Order tracking lacks endpoint-specific rate limiting',
    detail: 'Tracking requires invoice ID and phone, but the route has no dedicated rate limiter. Add throttling to reduce automated guessing and data-access attempts.'
  });
}

if (/script-src[^;]*['\"]unsafe-eval['\"]/i.test(server)) {
  findings.push({
    severity: 'HIGH',
    title: 'CSP allows unsafe-eval',
    detail: "Content-Security-Policy contains 'unsafe-eval', which materially weakens XSS defenses. Remove it unless a verified runtime dependency requires it." 
  });
}

if (/script-src[^;]*['\"]unsafe-inline['\"]/i.test(server)) {
  findings.push({
    severity: 'MEDIUM',
    title: 'CSP allows unsafe-inline scripts',
    detail: "Content-Security-Policy contains 'unsafe-inline'. Prefer nonces/hashes and external scripts where practical." 
  });
}

if (/origin\.includes\(['\"]localhost['\"]\)|origin\.includes\(['\"]127\.0\.0\.1['\"]\)/i.test(server)) {
  findings.push({
    severity: 'HIGH',
    title: 'CORS origin matching is overly broad',
    detail: 'Using substring matching for localhost/127.0.0.1 can accept attacker-controlled origins such as https://localhost.example.com. Use exact origin parsing/matching.'
  });
}

if (/endsWith\(['\"]\.run\.app['\"]\)|endsWith\(['\"]\.google\.com['\"]\)/i.test(server)) {
  findings.push({
    severity: 'MEDIUM',
    title: 'CORS trusts broad hosted-origin suffixes',
    detail: 'Wildcard-like suffix acceptance expands the trusted origin set. Production should use an explicit allowlist of exact origins.'
  });
}

if (/resetToken\s*=\s*crypto\.randomInt\(100000,\s*1000000\)/i.test(server)) {
  findings.push({
    severity: 'HIGH',
    title: 'Password reset token has only 6 decimal digits',
    detail: 'A 30-minute six-digit reset code has a small search space. Prefer a cryptographically random high-entropy token with a short TTL and single-use semantics.'
  });
}

if (/const newId = `ORD-\$\{Math\.floor\(1000 \+ Math\.random\(\) \* 9000\)\}`/i.test(server)) {
  findings.push({
    severity: 'MEDIUM',
    title: 'Order IDs are short and enumerable',
    detail: 'Four-digit order IDs are collision-prone and easy to enumerate. Use a collision-resistant public identifier while keeping authorization checks in place.'
  });
}

if (/passwordHash|password|secret/i.test(db) && /admin/i.test(db) && /hashPassword\(/i.test(db)) {
  findings.push({
    severity: 'CRITICAL',
    title: 'Review production admin seed/default credentials',
    detail: 'The database layer contains admin credential initialization logic. Production must never bootstrap a known/default administrator password; require an operator-supplied initial credential or one-time setup.'
  });
}

if (/console\.(log|error|warn)\([^\n]*(token|JWT_SECRET|SESSION_SECRET|password)/i.test(allSource)) {
  findings.push({
    severity: 'HIGH',
    title: 'Potential secret/token logging',
    detail: 'Source scan found a console statement containing a credential-related keyword. Review the exact statement and ensure secrets/tokens are never logged.'
  });
}

const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
findings.sort((a, b) => order[a.severity] - order[b.severity]);

console.log(`Security source audit: ${findings.length} finding(s)`);
for (const f of findings) {
  console.log(`[${f.severity}] ${f.title}`);
  console.log(`  ${f.detail}`);
}

if (findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
  process.exitCode = 1;
}
