/**
 * Validation Client Singleton
 *
 * Manages a singleton instance of AIAgentValidationClient
 * Initialized from environment variables and domain AccountProvider
 */
import { AIAgentValidationClient } from '@agentic-trust/agentic-trust-sdk';
export declare function getValidationRegistryClient(chainId?: number): Promise<AIAgentValidationClient>;
export declare function isValidationClientInitialized(chainId?: number): boolean;
export declare function resetValidationClient(chainId?: number): void;
//# sourceMappingURL=validationClient.d.ts.map