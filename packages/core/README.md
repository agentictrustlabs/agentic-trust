# @agentic-trust/core

Core SDK for agentic trust systems.

## Installation

```bash
pnpm add @agentic-trust/core
```

## Features

- **AgenticTrust Client**: GraphQL client for agent discovery and management
- **A2A Protocol**: Agent-to-Agent communication protocol support
- **Veramo Integration**: DID management and key management via Veramo
- **ERC-8004 Support**: Full ERC-8004 agentic trust SDK integration
  - AI Agent ENS Client (L1 and L2)
  - AI Agent Identity Management
  - AI Agent Reputation System
  - Organization Identity Management

## Usage

### Basic Client Setup

```typescript
import { AgenticTrustClient } from '@agentic-trust/core/server';

// Create a server-side client configured from environment variables or explicit config
const client = await AgenticTrustClient.create({
  graphQLUrl: process.env.AGENTIC_TRUST_DISCOVERY_URL!,
  apiKey: process.env.AGENTIC_TRUST_DISCOVERY_API_KEY,
  privateKey: process.env.AGENTIC_TRUST_ADMIN_PRIVATE_KEY, // optional, for signing
});
```

### AgenticTrustClient – High-level API

The `AgenticTrustClient` exposes a set of high-level methods that cover the most common
server-side use cases:

- **Discovery & lookup**

  ```ts
  // List/search agents (GraphQL + indexer integration)
  const { agents, total } = await client.searchAgents({
    query: 'my-agent',
    page: 1,
    pageSize: 20,
  });

  // Load a single agent object (A2A-capable wrapper around discovery data)
  const agent = await client.getAgent('1913', 11155111);

  // Look up by agent name via discovery indexer
  const agentByName = await client.getAgentByName('my-agent-name');

  // Get a fully-hydrated AgentDetail (on-chain + discovery + IPFS)
  const detail = await client.getAgentDetails('1913', 11155111);

  // Get AgentDetail from a did:8004 identifier
  const detailByDid = await client.getAgentDetailsByDid('did:8004:11155111:1913');

  // Get the on-chain owner (EOA or account) of an agentId from IdentityRegistry
  const owner = await client.getAgentOwner('1913', 11155111);
  ```

- **Creating agents (ERC‑8004 IdentityRegistry)**

  ```ts
  // High-level agent creation helper.
  // ownerType: 'eoa' | 'aa'
  // executionMode: 'auto' | 'server' | 'client'
  const result = await client.createAgent({
    ownerType: 'eoa',          // or 'aa' for Account Abstraction agents
    executionMode: 'auto',     // 'auto' picks server vs client based on private key presence
    agentName: 'my-agent',
    agentAccount: '0x1234...5678' as `0x${string}`,
    description: 'My ERC‑8004 agent',
    image: 'ipfs://...',
    agentUrl: 'https://my-agent.example.com',
    supportedTrust: ['feedback'],
    endpoints: [
      {
        name: 'a2a',
        endpoint: 'https://my-agent.example.com/api/a2a',
        version: '1.0.0',
      },
    ],
    chainId: 11155111,
  });
  ```

- **Feedback authorization (feedbackAuth)**

  ```ts
  import type { RequestAuthParams } from '@agentic-trust/core/server';

  // Build and sign an ERC‑8004 FeedbackAuth payload using the configured ReputationClient
  const feedbackAuth = await client.createFeedbackAuth({
    publicClient,                 // viem PublicClient for the target chain
    agentId: BigInt('1913'),
    clientAddress: '0xabc...def' as `0x${string}`,
    signer: agentAccount,         // viem Account (agent/AA or EOA)
    walletClient,                 // viem WalletClient used to sign the message
    expirySeconds: 3600,          // optional, default 1 hour
  });
  ```

- **A2A and Veramo helpers**

  ```ts
  // Access the A2A Protocol Provider (for low-level usage)
  const a2a = client.a2aProtocolProvider;

  // Access the underlying Veramo agent abstraction (no direct DID methods exposed)
  const verification = await client.verifyChallenge(authChallenge, 'https://my-provider.example.com');
  ```

### ERC-8004 Integration

In addition to the `AgenticTrustClient` façade, you can still use the lower-level
ERC‑8004 domain clients directly via `@agentic-trust/agentic-trust-sdk` and
`@agentic-trust/8004-sdk` (Identity, ENS, Reputation, etc.). The core server
entrypoint (`@agentic-trust/core/server`) wires these for you via singletons
such as `getIdentityRegistryClient`, `getENSClient`, and `getReputationRegistryClient`.

### Session packages (split 3-call flow)

For Smart Agents (principal AA + ENS, no ERC‑8004 extension), the recommended flow is split so:
- the **agent-service** creates + stores the session keypair
- the **web client** signs the delegation with the principal wallet
- the **agent-service** assembles and persists the final session package

#### SDK calls

- **(1) Agent-service: create session wallet + session AA (ensure deployed)**:

```ts
import { createSessionKeyAndSessionAccount } from '@agentic-trust/core';

const { artifacts, pub } = await createSessionKeyAndSessionAccount({
  chainId: 11155111,
  // optional overrides:
  // rpcUrl, bundlerUrl, sessionPrivateKey, deploySalt
  ensureSessionAccountDeployed: true,
});

// Store artifacts.sessionPrivateKey / artifacts.sessionKey server-side.
// Send pub.sessionAA to the web client.
```

- **(2) Web client: sign delegation (needs only sessionAA, no session keys)**:

```ts
import { signAgentDelegation, SMART_AGENT_DELEGATION_SELECTOR } from '@agentic-trust/core';

const sig = await signAgentDelegation({
  chainId: 11155111,
  agentAccount: principalSmartAccount, // delegator AA
  ownerAddress: principalEoa,          // wallet controlling the AA
  provider: window.ethereum,
  delegateeAA: sessionAA,              // from step (1)
  selector: SMART_AGENT_DELEGATION_SELECTOR,
  includeValidationScope: false,
  includeAssociationScope: false,
  includeAgentAccountSignatureScope: true,
});

// Send sig.signedDelegation (+ selector/scDelegation) back to the agent-service.
```

- **(3) Agent-service: assemble final package**:

```ts
import { assembleSmartAgentSessionPackage } from '@agentic-trust/core';

const pkg = assembleSmartAgentSessionPackage({
  chainId: 11155111,
  agentAccount: principalSmartAccount,
  sessionAA,
  sessionKey: artifacts.sessionKey,     // server-only
  entryPoint: artifacts.entryPoint,
  bundlerUrl: artifacts.bundlerUrl,
  selector: sig.selector,
  signedDelegation: sig.signedDelegation,
  scDelegation: sig.scDelegation,
  uaid,
  did,
  ensName,
});
```

#### Recommended HTTP endpoints between apps

- **Agent-service**:
  - `POST /session/init` → returns `{ chainId, sessionAA }` and stores the session key server-side.
  - `POST /session/complete` with `{ signedDelegation, selector, scDelegation?, sessionAA }` → assembles + stores the session package.
- **Web client**:
  - Calls `signAgentDelegation(...)` locally, then POSTs the result to `/session/complete`.

## Dependencies

- `@agentic-trust/agentic-trust-sdk` - Agentic Trust SDK (workspace dependency)
  - `@agentic-trust/8004-sdk` - Base ERC-8004 SDK (workspace dependency)

## License

MIT
