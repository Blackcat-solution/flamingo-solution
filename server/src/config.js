import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_DOCUMENT_ENCRYPTION_KEY =
  'flamingo-local-development-document-key-change-in-production-0001';

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const demoMode = bool(process.env.DEMO_MODE, true);

// Upload scanning. `clamd` is the only mode permitted in production. `eicar`
// recognises the standard antivirus test string and nothing else; it exists so
// development, demo and test environments can exercise the rejection path
// without a ClamAV daemon, and it must never be treated as real protection.
// `off` skips scanning and is rejected in production.
const malwareScanMode = String(
  process.env.MALWARE_SCAN_MODE || (isProduction ? 'clamd' : 'eicar')
).toLowerCase();

export const config = {
  env,
  isProduction,
  port: Number(process.env.PORT || 4000),
  repoRoot,
  dataDir: process.env.FLAMINGO_DATA_DIR || path.join(repoRoot, 'data'),
  dbFile: process.env.FLAMINGO_DB || path.join(repoRoot, 'data', 'flamingo.db'),
  storageDir: process.env.FLAMINGO_STORAGE || path.join(repoRoot, 'storage'),
  clientDist: path.join(repoRoot, '..', 'client', 'dist'),
  sessionCookie: 'fl_session',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),
  secureCookies: bool(process.env.SECURE_COOKIES, isProduction),
  documentEncryptionKey: process.env.DOCUMENT_ENCRYPTION_KEY || DEFAULT_DOCUMENT_ENCRYPTION_KEY,
  isTest: env === 'test',
  demoMode,
  // Admin accounts must enrol a TOTP authenticator before the admin API opens.
  // Enabled by default in production, disabled for demo and test environments.
  adminMfaEnforced: bool(process.env.REQUIRE_ADMIN_MFA, isProduction && !demoMode),
  // Where runtime secrets are read from. `env` is the local default; production
  // must use a managed store (or a mounted secret file) instead.
  secretProvider: String(process.env.SECRET_PROVIDER || 'env').toLowerCase(),
  secretsFile: process.env.FLAMINGO_SECRETS_FILE || null,
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1',
  gcpProject: process.env.GOOGLE_CLOUD_PROJECT || null,
  azureVaultUrl: process.env.AZURE_KEYVAULT_URL || null,
  vaultAddr: process.env.VAULT_ADDR || null,
  vaultToken: process.env.VAULT_TOKEN || null,
  // How the document encryption key is unwrapped. `local` hashes the value in
  // DOCUMENT_ENCRYPTION_KEY; `aws-kms` decrypts a KMS ciphertext blob at boot.
  kmsProvider: String(process.env.KMS_PROVIDER || 'local').toLowerCase(),
  kmsKeyId: process.env.KMS_KEY_ID || null,
  documentKeyCiphertext: process.env.DOCUMENT_ENCRYPTION_KEY_CIPHERTEXT || null,
  malwareScan: {
    mode: malwareScanMode,
    host: process.env.CLAMAV_HOST || '127.0.0.1',
    port: Number(process.env.CLAMAV_PORT || 3310),
    socketPath: process.env.CLAMAV_SOCKET || null,
    timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS || 10_000)
  }
};

/**
 * Fail fast before the process starts accepting traffic when production
 * configuration is unsafe. Development, test and explicitly labelled demo
 * environments keep their current behaviour.
 */
export function assertProductionSafety() {
  if (!config.isProduction) return;

  const problems = [];

  if (
    config.documentEncryptionKey === DEFAULT_DOCUMENT_ENCRYPTION_KEY ||
    config.documentEncryptionKey.length < 32
  ) {
    problems.push(
      'DOCUMENT_ENCRYPTION_KEY must be set to a unique random value of at least 32 characters.'
    );
  }

  if (!config.secureCookies) {
    problems.push('SECURE_COOKIES must not be disabled in production.');
  }

  if (config.demoMode && !bool(process.env.ALLOW_DEMO_IN_PRODUCTION, false)) {
    problems.push(
      'DEMO_MODE must be false in production. Set ALLOW_DEMO_IN_PRODUCTION=true only for a public demonstration deployment that never handles real user data.'
    );
  }

  if (!config.adminMfaEnforced && !config.demoMode) {
    problems.push(
      'REQUIRE_ADMIN_MFA must not be disabled in production unless DEMO_MODE is enabled.'
    );
  }

  if (config.malwareScan.mode !== 'clamd') {
    problems.push(
      'MALWARE_SCAN_MODE must be "clamd" in production. The eicar and off modes do not scan real uploads.'
    );
  }

  if (config.secretProvider === 'env') {
    problems.push(
      'SECRET_PROVIDER must be aws, gcp, azure, vault or file in production. Process-environment secrets are not a secret manager.'
    );
  } else if (!['aws', 'gcp', 'azure', 'vault', 'file'].includes(config.secretProvider)) {
    problems.push(
      `Unknown SECRET_PROVIDER "${config.secretProvider}". Use aws, gcp, azure, vault or file.`
    );
  }

  if (config.kmsProvider === 'aws-kms' && !config.kmsKeyId) {
    problems.push('KMS_KEY_ID is required when KMS_PROVIDER=aws-kms.');
  }

  if (config.kmsProvider === 'aws-kms' && !config.documentKeyCiphertext) {
    problems.push(
      'DOCUMENT_ENCRYPTION_KEY_CIPHERTEXT is required when KMS_PROVIDER=aws-kms.'
    );
  }

  if (problems.length) {
    throw new Error(
      `Unsafe production configuration:\n- ${problems.join('\n- ')}\nSee docs/DEPLOYMENT.md for the required environment variables.`
    );
  }
}

export const ADMIN_PERMISSIONS = {
  super_admin: ['*'],
  verification_officer: ['users.view', 'verification.review', 'documents.review', 'marketplace.moderate'],
  finance_officer: ['finance.view', 'finance.reconcile', 'payouts.manage', 'disputes.finance', 'reports.view'],
  recruitment_manager: ['users.view', 'marketplace.view', 'assignments.view', 'interviews.view', 'reports.view'],
  support: ['users.view', 'support.tickets', 'disputes.view', 'marketplace.view']
};
