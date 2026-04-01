# NIST NCCoE AI Agent Identity & Authorization – Public Comment Submission

**Submitted by:** Richard Pedersen  
**Organization:** Agentic Trust / RichCanvas LLC  
**Reference Implementation:** https://agentictrust.io  
**Date:** April 2026  

---

## 1. Problem Reframing (Critical)

Traditional identity systems are designed to answer:  
**“Who is the user?”**

The concept paper implicitly requires answering a fundamentally different question:  
**“Who or what is acting, under whose authority, in what context, and how is that action trusted and verified?”**

This is not a minor extension of existing identity models. It is a **shift in the nature of identity itself**.

> **If identity is not defined in relation to action, authority, context, and trust, then AI agent identity and authorization cannot be made auditable, enforceable, or secure.**

> **The agentic architecture described in the NCCoE concept paper (Actor → Agent → Tools/Data → Action) requires an explicit identity and relationship layer to securely connect these components.**

---

## 2. Core Assertion: Agent Must Be the Root Concept

The current framing risks treating AI agents as an extension of users or applications. That approach will not scale.

> **Agent must be the root identity concept.**

> **Agent Identity applies to all actors—human, organizational, and AI. AI Agent Identity is a specialization, not a new model.**

Without this unification:
- identity models fragment  
- delegation becomes ambiguous  
- accountability breaks down  

---

## 3. Identity Requires an Anchor

NIST correctly emphasizes identity proofing and unique resolution within a domain.

However, AI agent systems require:

> **A persistent, portable identifier that anchors an agent across systems and contexts.**

> **The identifier anchors the agent. The agent anchors all identity, relationships, and trust.**

In practice, this is expressed as a **Universal Agent Identifier (UAID)** paired with an **Agent Registry** that enables consistent resolution across ecosystems while still supporting domain-specific registries and policies (a faceted identity model). Standards like **HCS-14** directly support this UAID + Agent Registry approach.

This is already implemented using decentralized identifiers and cryptographic identity systems.

---

## 4. Identity Is Not Static — It Is Contextual

> **Identity is not a single global record. It is expressed through domain-scoped registries and context-specific facets.**

An agent may simultaneously act as:
- a patient in healthcare  
- a participant in commerce  
- a member of a community  
- a delegate in governance  

These are **domain projections of a single anchored agent**—the same agent, expressed through different registries, roles, and policies.

This preserves **uniqueness within each domain registry** while enabling **portable, multi-domain participation** without fragmenting accountability.

---

## 5. Identity Must Include Time and Evidence

A critical gap is the lack of distinction between:

- persistent identity structures  
- time-based actions and evidence  

> **Trust cannot be derived from identity alone. It must be derived from observed behavior over time.**

In practical terms:
- relationships persist  
- actions occur  
- trust evolves  

> **Time-based events create and update trust-bearing relationships.**

> **This reflects a provenance-based model where identity, actions, and outcomes are explicitly linked.**

---

## 6. Trust Is Relational, Not Intrinsic

> **Trust is not a property of an agent. It is a relationship between agents, evaluated in context.**

Trust must be:
- directional  
- context-specific  
- evidence-based  

Static trust models are insufficient for agent ecosystems.

---

## 7. The Agent Trust Graph Is Required

> **AI agent systems require a graph-based model of identity and trust.**

The **Agent Trust Graph**:

- represents all agents (human, organizational, AI)  
- models relationships as first-class objects  
- incorporates assertions, delegation, and history  
- enables trust evaluation in context  

> **Without a graph-based model, multi-agent systems cannot provide verifiable accountability or enforce trust decisions across delegated interactions.**

This manifests through **standards-based protocols** at the protocol layer:
- **Agent Identifier** — UAID + Agent Registry (HCS-14) and DID/ENS anchoring (ERC-4337)  
- **Agent Authorization** — scoped, portable authority and delegation (e.g., ERC-7710, ERC-1271)  
- **Agent Relationships** — first-class relationship graph (ERC-8092)  
- **Assertions / Claims** — verifiable trust signals and evidence (ERC-8004 validations, feedback, attestations)  

These protocol-layer primitives are then surfaced during **discovery and engagement** via a standards-based **agentic trust ontology** (queryable knowledge base + structured metadata + verifiable endpoint bindings).

The reference implementation delivers this through an **on-chain Agent Trust Graph** that records every validation, delegation, and feedback event as signed, immutable, queryable history.

---

## 8. Discoverability Is a Security Requirement

> **Discovery is not a convenience—it is the first phase of authorization.**

Before an agent is invoked, it must be:
- discoverable  
- identifiable  
- trust-evaluable  

> **If discovery is not verifiable, execution cannot be trusted.**

This requires:
- a queryable knowledge base  
- structured metadata  
- verifiable endpoint binding  

---

## 9. ENS as a Trust Assertion Layer

A decentralized naming layer (e.g., ENS) provides:

> **A human-readable trust assertion surface for agent identity.**

Each agent:
- resolves to an identifier  
- exposes structured metadata  
- links to validation and relationships  

---

### 9.1 Ontology-Driven Schema

Metadata is governed by a **foundational agentic trust ontology**:

- agent types  
- relationships  
- claims  
- capabilities  
- endpoints  

---

### 9.2 Complement to Validation Protocols

- ERC-8004 → verifiable claims  
- ENS → discoverable identity  

> **Together they form a complete trust assertion layer.**

---

### 9.3 Provenance Foundation (W3C PROV-O Alignment)

> **The agentic trust ontology is grounded in a provenance-based model aligned with W3C PROV-O.**

This models:

- agents as accountable actors  
- actions as events  
- resources as entities  

> **Identity, trust, and authorization are defined in relation to who acted, what was done, and what was affected.**

This supports:

- auditability  
- non-repudiation  
- data flow tracking  
- trust evaluation over time  

---

## 10. Architecture Overview

> **Agent → Identifier (Anchor) → Relationships (Graph) → Discovery → Execution → Trust Evaluation**

---

## 11. Protocol-Centric and Composable Architecture

> **This architecture is protocol-centric and composable by design.**

Each capability is an independent, interoperable layer:
- identity anchoring  
- relationship modeling  
- validation  
- authorization  
- discoverability  

This enables:
- integration with existing enterprise systems  
- alignment with OAuth, OIDC, and NGAC  
- incremental adoption  
- interoperability across domains  
- independent evolution of components  

---

### Core Components

- ERC-4337, ERC-1271 — smart account execution, delegation and signature validation  
- ERC-7710 — agent delegation standard (portable, scoped authority)  
- ERC-8092 — relationship graph  
- ERC-8004 — validation and trust assertions  
- DID (did:ethr) — identity anchor  
- HCS-14 — Universal Agent Identifier (UAID) + Agent Registry
- ENS — metadata and discovery  
- SIWE for agents + MCP, but fully Web3-native — agent authentication and tool invocation bound to the anchored agent identifier, delegated authority, and verifiable context  

> **This stack composes existing identity and authorization models into a modular architecture without requiring centralized control.**

---

## 12. Working Implementations

- https://agentictrust.io  
- https://github.com/agentictrustlabs/agentic-trust  
- https://github.com/agentictrustlabs/agent-explorer  
- https://github.com/agentictrustlabs/agent-explorer/tree/main/docs/ontology  
- https://github.com/RichCanvas3/ens-node-metadata  *(implementation of ENS metadata standard)*

---

## 13. Alignment with NIST (and Extension)

This model aligns with:
- Identity assurance (SP 800-63)  
- Zero Trust (SP 800-207)  
- auditability and logging  

> **This model extends Zero Trust from resource access to agent-to-agent delegated authority.**

---

## 14. Direct Response to NCCoE Areas of Interest

### Identification
- Persistent identifier (DID/ENS)  
- Universal Agent Identifier (UAID) + Agent Registry (HCS-14)  
- Ontology-based metadata  

### Authentication
- Cryptographic proof of control  
- Delegation-aware validation  
- Agent authentication must be anchored to the agent identifier model (not a user session model): when an agent connects to a service or invokes tools, it should authenticate *as the agent* (via its portable identifier), present scoped authority (delegation/session constraints), and bind that authorization to a verifiable context trail.  
- A practical path is **“SIWE for agents + MCP, but fully Web3-native”**: a sign-in and session handshake patterned after SIWE, extended to agent identifiers and delegated authority, plus MCP-compatible capability/tool declarations so services can verify *who is acting*, *under what authority*, and *what they are allowed to do*.  

### Authorization
- Graph-based, context-aware decisions  

### Delegation
- First-class, verifiable, scoped  
- Delegation is a core agent-platform primitive: agents must be able to present portable, bounded authority to act on behalf of an agent identifier across services and domains (not just within a single application session).  
- Agent Delegation Standards (e.g., **ERC-7710**) provide a shared, verifiable way to express and validate scoped authority, enabling consistent enforcement and audit across multi-agent interactions.  

### Auditing & Non-Repudiation
- Signed, immutable event history  

### Provenance
- Linked to identity and actions  

### Prompt Injection
> **A trust problem — evaluate source identity before accepting input**

---

## 15. Recommendations

- Agent as root concept  
- Persistent identifier anchors  
- Contextual identity  
- Graph-based relationships  
- Delegation as first-class  
- Provenance-based accountability  
- Discoverability as security layer  
- Ontology-based schemas  
- Trust assertion layers  
- Protocol-based implementations  

---

## 16. Closing

> **AI agent identity requires a shift to an agent-centric, relationship-driven, evidence-based model.**

These principles:
- extend NIST thinking  
- align with existing standards  
- are validated through working systems  

> **The opportunity is not to adapt existing identity models to agents, but to define an agent-native foundation for identity, delegation, and trust.  
This foundation already exists and can serve as a reference architecture for NCCoE collaboration.**