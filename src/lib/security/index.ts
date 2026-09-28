// Security headers
export { SECURITY_HEADERS, addSecurityHeaders, securityHeadersMiddleware } from './headers';

// Input sanitization
export {
  sanitizeHtml,
  escapeSql,
  escapeNoSql,
  escapeShell,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeNumber,
  sanitizeObjectKeys,
  sanitizeJson,
  sanitizeStellarAddress,
  sanitizeBlockchainAddress,
} from './sanitization';

// API key rotation
export {
  type RotationConfig,
  getKeysNeedingRotation,
  getKeysInGracePeriod,
  performAutoRotation,
  revokeExpiredRotatedKeys,
  getRotationStatus,
} from './api-key-rotation';

// Encryption at rest
export {
  type EncryptionConfig,
  encryptData,
  decryptData,
  encryptObject,
  decryptObject,
  hashData,
  verifyHash,
  generateEncryptionKey,
  encryptSensitiveFields,
  decryptSensitiveFields,
  encryptLocalStorageData,
  decryptLocalStorageData,
  encryptLogEntry,
  encryptBackupData,
  decryptBackupData,
} from './encryption';

// Database encryption
export {
  encryptTableColumn,
  decryptTableColumn,
  hashTableColumn,
  getTableEncryptionStatus,
  rotateTableColumnEncryption,
  createEncryptedBackup,
  restoreEncryptedBackup,
} from './database-encryption';

// Field-level encryption for PII columns (#692)
export {
  encryptField,
  decryptField,
  isEncrypted,
  maskPiiForLog,
  rotateFieldEncryption,
  type RotationResult,
} from './field-encryption';
