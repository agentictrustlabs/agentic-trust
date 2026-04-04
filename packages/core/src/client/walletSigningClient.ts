/**
 * Client-side wallet signing utilities (client-only entry point)
 * 
 * This is a client-only export that can be safely imported in browser code
 */

export {
  signAndSendTransaction,
  extractAgentIdFromReceipt,
  refreshAgentInIndexer,
  isWalletProviderAvailable,
  getWalletAddress,
  createAgentWithWallet,
  updateAgentRegistrationWithWallet,
  giveFeedbackWithWallet,
  finalizeAssociationWithWallet,
  requestNameValidationWithWallet,
  requestAccountValidationWithWallet,
  requestAppValidationWithWallet,
  requestAIDValidationWithWallet,
  getCounterfactualAccountClientByAgentName,
  getDeployedAccountClientByAgentName,
  getDeployedAccountClientByAddress,
  getCounterfactualSmartAccountAddressByAgentName,
  sendSponsoredUserOperation,
  waitForUserOperationReceipt,
} from './walletSigning';
export {
  createAgentDirect,
} from '../api/agents/directClient';

// Split session-package flow (browser-safe exports)
export {
  signAgentDelegation,
  DEFAULT_SELECTOR as DEFAULT_DELEGATION_SELECTOR,
  SMART_AGENT_DEFAULT_SELECTOR as SMART_AGENT_DELEGATION_SELECTOR,
} from './delegationSigning';
export type { DelegationSignatureArtifacts, SignAgentDelegationParams } from './delegationSigning';

export type {
  PreparedTransaction,
  TransactionResult,
  SignTransactionOptions,
  CreateAgentWithWalletOptions,
  CreateAgentResult,
  UpdateAgentRegistrationWithWalletOptions,
  GiveFeedbackWithWalletOptions,
  RequestValidationWithWalletOptions,
} from './walletSigning';
export type {
  CreateAgentDirectClientInput,
  CreateAgentDirectClientResult,
} from '../api/agents/directClient';

