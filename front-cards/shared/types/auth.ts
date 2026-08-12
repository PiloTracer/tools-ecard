/**
 * Authentication & OAuth Types
 */

/**
 * OAuth Token Response from Tools Dashboard
 */
export type OAuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // seconds
  scope: string;
};

/**
 * User data from Tools Dashboard
 */
export type User = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  /**
   * tools-dashboard client-app roles (from the access-token JWT `app_roles`
   * claim, decoded by /api/auth/user). UI hints only — the server enforces.
   */
  roles?: string[];
  subscription?: {
    tier: 'free' | 'basic' | 'professional' | 'enterprise';
    status: 'active' | 'suspended' | 'cancelled';
    cardsPerMonth: number;
    currentUsage: number;
    llmCredits: number;
    resetDate: string; // ISO date string
    features?: {
      /** Per-user override from Tools Dashboard Access tab; -1 = unlimited */
      batch_size_limit?: number;
      template_limit?: number;
      ecards_enabled?: boolean;
      [key: string]: unknown;
    };
  };
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
};

/**
 * Token Exchange Request (client → backend)
 *
 * Note: codeVerifier is optional
 * - Manual login flow: codeVerifier is provided (PKCE flow)
 * - Pre-initiated OAuth flow: codeVerifier is omitted (Tools Dashboard handles PKCE)
 */
export type TokenExchangeRequest = {
  code: string;
  codeVerifier?: string; // Optional - only for manual login flows
};

/**
 * Token Exchange Response (backend → client)
 */
export type TokenExchangeResponse = {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  error?: string;
};

/**
 * Refresh Token Response
 */
export type RefreshTokenResponse = {
  success: boolean;
  error?: string;
};

/**
 * Authentication Context State
 */
export type AuthContextState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  /** tools-dashboard client-app roles (UI hints only; server enforces). */
  roles: string[];
  /** True when roles include `appsuper` or `appglobal` (either grants it). */
  canManageGlobalTemplates: boolean;
};

/**
 * Authentication Context Actions
 */
export type AuthContextActions = {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
};

/**
 * Complete Authentication Context
 */
export type AuthContext = AuthContextState & AuthContextActions;
