import fs from 'node:fs';
import path from 'node:path';

/**
 * Runtime secret hydration.
 *
 * Local development reads process.env directly. Production is expected to use
 * a managed store. Because `config.js` reads process.env synchronously, the
 * server calls hydrateSecrets() and only then imports the app module, so every
 * secret is in place before configuration is evaluated.
 *
 * Values already present in the environment win, which keeps local overrides
 * and tests predictable. A secret is never logged.
 */

const DEFAULT_SECRET_NAMES = ['DOCUMENT_ENCRYPTION_KEY'];

function secretNames() {
  return (process.env.FLAMINGO_SECRET_NAMES || DEFAULT_SECRET_NAMES.join(','))
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function providerName() {
  return String(process.env.SECRET_PROVIDER || 'env').toLowerCase();
}

function applySecret(name, value) {
  if (value === undefined || value === null || value === '') return false;
  if (process.env[name] === undefined) {
    process.env[name] = String(value);
    return true;
  }
  return false;
}

/**
 * Accept either a bare secret string or a JSON object of name -> value.
 */
function applyPayload(payload, loaded) {
  if (payload === undefined || payload === null) return;
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);

  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Secret payload looks like JSON but could not be parsed.');
    }
    for (const [name, value] of Object.entries(parsed)) {
      if (applySecret(name, value)) loaded.push(name);
    }
    return;
  }

  // A single value with no name cannot be mapped safely.
  return;
}

function loadFromFile() {
  const file = process.env.FLAMINGO_SECRETS_FILE;
  if (!file) {
    throw new Error('SECRET_PROVIDER=file requires FLAMINGO_SECRETS_FILE.');
  }
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Secret file not found: ${resolved}`);
  }
  const loaded = [];
  applyPayload(fs.readFileSync(resolved, 'utf8'), loaded);
  return loaded;
}

async function loadFromAws(loaded) {
  let client;
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );
    client = new SecretsManagerClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1'
    });

    for (const name of secretNames()) {
      const response = await client.send(new GetSecretValueCommand({ SecretId: name }));
      const payload = response.SecretString ?? response.SecretBinary;
      if (payload && String(payload).trim().startsWith('{')) {
        applyPayload(payload, loaded);
      } else if (applySecret(name, payload)) {
        loaded.push(name);
      }
    }
  } catch (error) {
    throw new Error(
      `Could not load secrets from AWS Secrets Manager: ${error.message}. ` +
        'Install @aws-sdk/client-secrets-manager and grant secretsmanager:GetSecretValue.'
    );
  }
  return loaded;
}

async function loadFromGcp(loaded) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error('SECRET_PROVIDER=gcp requires GOOGLE_CLOUD_PROJECT.');
  }
  try {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();

    for (const name of secretNames()) {
      const [version] = await client.accessSecretVersion({
        name: `projects/${project}/secrets/${name}/versions/latest`
      });
      const payload = version.payload?.data;
      if (payload && String(payload).trim().startsWith('{')) {
        applyPayload(payload, loaded);
      } else if (applySecret(name, payload)) {
        loaded.push(name);
      }
    }
  } catch (error) {
    throw new Error(
      `Could not load secrets from Google Secret Manager: ${error.message}. ` +
        'Install @google-cloud/secret-manager and grant secretmanager.versions.access.'
    );
  }
  return loaded;
}

async function loadFromAzure(loaded) {
  const vaultUrl = process.env.AZURE_KEYVAULT_URL;
  if (!vaultUrl) {
    throw new Error('SECRET_PROVIDER=azure requires AZURE_KEYVAULT_URL.');
  }
  try {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    const { DefaultAzureCredential } = await import('@azure/identity');
    const client = new SecretClient(vaultUrl, new DefaultAzureCredential());

    for (const name of secretNames()) {
      // Key Vault names allow only alphanumerics and dashes.
      const vaultName = name.replace(/_/g, '-');
      const secret = await client.getSecret(vaultName);
      if (applySecret(name, secret.value)) loaded.push(name);
    }
  } catch (error) {
    throw new Error(
      `Could not load secrets from Azure Key Vault: ${error.message}. ` +
        'Install @azure/keyvault-secrets and @azure/identity and grant secrets/get.'
    );
  }
  return loaded;
}

async function loadFromVault(loaded) {
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  if (!addr || !token) {
    throw new Error('SECRET_PROVIDER=vault requires VAULT_ADDR and VAULT_TOKEN.');
  }
  const mount = process.env.VAULT_MOUNT || 'secret';
  const basePath = process.env.VAULT_PATH || 'flamingo';

  for (const name of secretNames()) {
    const url = `${addr.replace(/\/$/, '')}/v1/${mount}/data/${basePath}/${name}`;
    const response = await fetch(url, { headers: { 'X-Vault-Token': token } });
    if (!response.ok) {
      throw new Error(`Vault returned ${response.status} for ${name}`);
    }
    const body = await response.json();
    const payload = body?.data?.data?.value ?? body?.data?.value;
    if (applySecret(name, payload)) loaded.push(name);
  }
  return loaded;
}

/**
 * Load configured secrets into process.env. Call before importing app.js.
 */
export async function hydrateSecrets() {
  const provider = providerName();
  const loaded = [];

  if (provider === 'env') return { provider, loaded };
  if (provider === 'file') {
    const names = loadFromFile();
    return { provider, loaded: names };
  }
  if (provider === 'aws') return { provider, loaded: await loadFromAws(loaded) };
  if (provider === 'gcp') return { provider, loaded: await loadFromGcp(loaded) };
  if (provider === 'azure') return { provider, loaded: await loadFromAzure(loaded) };
  if (provider === 'vault') return { provider, loaded: await loadFromVault(loaded) };

  throw new Error(
    `Unknown SECRET_PROVIDER "${provider}". Use env, file, aws, gcp, azure or vault.`
  );
}
