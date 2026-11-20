import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Document encryption key handling.
 *
 * `local` derives the AES-256 key from DOCUMENT_ENCRYPTION_KEY. That is fine for
 * development and for a pilot where the value comes from a secret manager.
 *
 * `aws-kms` unwraps a KMS-encrypted ciphertext blob at boot and derives the
 * key in memory. The plaintext key is never written to disk or to the
 * environment. Create the ciphertext once with:
 *
 *   aws kms encrypt \
 *     --key-id "$KMS_KEY_ID" \
 *     --plaintext fileb://document-key.txt \
 *     --query CiphertextBlob --output text
 *
 * then store the base64 result in DOCUMENT_ENCRYPTION_KEY_CIPHERTEXT.
 */

let cachedKey = null;

function deriveKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

export async function initialiseDocumentKey() {
  if (config.kmsProvider === 'local') {
    cachedKey = deriveKey(config.documentEncryptionKey);
    return;
  }

  if (config.kmsProvider === 'aws-kms') {
    let decrypted;
    try {
      const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms');
      const client = new KMSClient({ region: config.awsRegion });
      const response = await client.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(config.documentKeyCiphertext, 'base64'),
          KeyId: config.kmsKeyId
        })
      );
      decrypted = Buffer.from(response.Plaintext);
    } catch (error) {
      throw new Error(
        `Could not unwrap the document encryption key with AWS KMS: ${error.message}. ` +
          'Install @aws-sdk/client-kms and grant kms:Decrypt on KMS_KEY_ID.'
      );
    }

    try {
      cachedKey = deriveKey(decrypted.toString('utf8'));
    } finally {
      decrypted.fill(0);
    }
    return;
  }

  throw new Error(`Unknown KMS_PROVIDER "${config.kmsProvider}". Use local or aws-kms.`);
}

/**
 * The 32-byte AES key. Falls back to local derivation when the server was
 * started without the async bootstrap (tests and scripts).
 */
export function documentKey() {
  if (!cachedKey) cachedKey = deriveKey(config.documentEncryptionKey);
  return cachedKey;
}

/**
 * Short, non-reversible identifier for the active key. Used to confirm that a
 * backup and the running process share a key without exposing it.
 */
export function documentKeyFingerprint() {
  return crypto
    .createHash('sha256')
    .update(documentKey())
    .digest('hex')
    .slice(0, 16);
}

export function resetDocumentKeyCache() {
  cachedKey = null;
}
