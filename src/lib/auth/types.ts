export interface AuthToken {
  type: 'bearer' | 'api-key';
  value: string;
  extractedAt: number;
}

export interface SessionToken {
  id: string;
  userAddress: string;
  expiresAt: number;
  createdAt: number;
  isValid: boolean;
}

export interface ApiKeyContext {
  id: string;
  keyHash: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
}

export interface AuthContext {
  type: 'session' | 'api-key' | 'admin' | 'none';
  token: AuthToken | null;
  session?: SessionToken | null;
  apiKey?: ApiKeyContext | null;
  isAuthenticated: boolean;
  userId?: string;
}

export interface AuthError {
  code:
    | 'MISSING_TOKEN'
    | 'INVALID_TOKEN'
    | 'EXPIRED_TOKEN'
    | 'INSUFFICIENT_SCOPE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'UNAUTHORIZED';
  message: string;
  statusCode: number;
}
