# NIST NCCoE AI Agent Identity & Authorization – Public Comment Submission

**Submitted by:** Richard Pedersen  
**Organization:** Agentic Trust / RichCanvas LLC  
**Reference Implementation:** [https://agentictrust.io](https://agentictrust.io)  
**Date:** April 2026  

---

## 1. Problem Reframing (Critical)

Traditional identity systems are designed to answer:  
**“Who is the user?”**

The concept paper implicitly requires answering a fundamentally different question:  
**“Who or what is acting, under whose authority, in what context, and how is that action trusted and verified?”**

This is not a minor extension of existing identity models. It is a shift in the nature of identity itself. If identity is not defined in relation to action, authority, context, and trust, then AI agent identity and authorization cannot be made auditable, enforceable, or secure.

## 2. Core Assertion: Agent Must Be the Root Concept

The current framing risks treating AI agents as an extension of users or applications. That approach will not scale.

**Agent must be the root identity concept.**

All of the following are agents:  
- humans  
- organizations  
- AI agents  
- digital twins  

AI Agent Identity is not a new category — it is a specialization of Agent Identity. Without this unification, identity models fragment, delegation becomes ambiguous, and accountability breaks down.

## 3. Identity Requires an Anchor

NIST correctly emphasizes identity proofing and unique resolution within a domain. This principle must be preserved.

However, AI agent systems require a **persistent, portable identifier** that anchors an agent across systems and contexts. The identifier anchors the agent. The agent anchors all identity, relationships, and trust.

This is not theoretical. It is already implemented using decentralized identifier approaches and cryptographic identity systems.

## 4. Identity Is Not Static — It Is Contextual

Identity is not a single global record. It is expressed through context-specific facets.

An agent may simultaneously act as:  
- a patient in healthcare  
- a participant in commerce  
- a member of a community  
- a delegate in governance  

These are not separate identities — they are contextual projections of a single anchored agent. This aligns with NIST’s principle that identity is unique within a domain while allowing multiple identities across domains.

## 5. Identity Must Include Time and Evidence

A critical gap in current models is the lack of distinction between persistent identity structures and time-based actions and evidence.

Trust cannot be derived from identity alone. It must be derived from observed behavior over time. In practical terms: relationships persist, actions occur, and trust evolves. Time-based events create and update trust-bearing relationships. Without this, “trust” becomes static and unreliable.

## 6. Trust Is Relational, Not Intrinsic

Trust is not a property of an agent. It is a relationship between agents, evaluated in context.

This is a fundamental principle. Trust must be:  
- directional  
- context-specific  
- evidence-based  

Current models that treat trust as a score or a static attribute are insufficient for agent ecosystems.

## 7. The Agent Trust Graph Is Required

The above principles lead to a necessary conclusion: AI agent systems require a graph-based model of identity and trust.

The **Agent Trust Graph**:  
- represents all agents (human, organizational, AI)  
- models relationships as first-class objects  
- incorporates assertions, delegation, and history  
- enables trust evaluation in context  

Without a graph-based model, multi-agent systems cannot be made auditable or trustworthy.  

My reference implementation already delivers this today through an **on-chain Agent Trust Graph (ERC-8004)** that records every validation, delegation, and feedback event as signed, immutable, queryable history. Reputation is enforced economically: validators stake, high-signal reviewers earn