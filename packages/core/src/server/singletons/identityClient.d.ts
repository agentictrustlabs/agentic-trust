/**
 * Identity Client Singleton
 *
 * Manages a singleton instance of AIAgentIdentityClient
 * Initialized from environment variables using AccountProvider
 */
import { AIAgentIdentityClient } from '@agentic-trust/agentic-trust-sdk';
/**
 * Get or create the AIAgentIdentityClient singleton
 * Initializes from environment variables using AccountProvider
 */
export declare function getIdentityRegistryClient(chainId?: number): Promise<AIAgentIdentityClient>;
/**
 * Check if identity client is initialized for a specific chain
 */
export declare function isIdentityClientInitialized(chainId?: number): boolean;
/**
 * Reset the identity client instance for a specific chain (useful for testing)
 */
export declare function resetIdentityClient(chainId?: number): void;
//# sourceMappingURL=identityClient.d.ts.map