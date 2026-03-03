<div align="center">

# Ψ Attestara

**A CRE-orchestrated compliance layer for institutional DeFi**

*Real-time AML screening · EIP-712 attestations · Zero on-chain exposure*

---

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.25-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
[![Tenderly](https://img.shields.io/badge/Powered%20by-Tenderly-6E56CF?style=flat-square)](https://tenderly.co/)
[![License: MIT](https://img.shields.io/badge/License-MIT-f5c45e?style=flat-square)](LICENSE)

</div>

---

## Overview

**Attestara** is a CRE-orchestrated compliance layer for institutional DeFi — a production-pattern middleware stack that sits between institutions and a permissioned vault. It enforces real-time AML/KYC compliance without ever writing personal data on-chain — only cryptographic commitments.

```
Institution Wallet
       │
       ▼
┌──────────────────────┐
│  CRE Engine :4000    │  ← Compliance & Routing Engine (off-chain enclave)
│  ┌────────────────┐  │
│  │ AML Screening  │──┼──► Mock AML / Chainalysis KYT
│  │ EIP-712 Sign   │  │
│  │ Tx Simulation  │──┼──► Tenderly Simulation API
│  │ Trace Analysis │──┼──► Tenderly Transaction API
│  └────────────────┘  │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│  PermissionedVault   │  ← On-chain (Tenderly Virtual TestNet)
│  ┌────────────────┐  │
│  │ DIDRegistry    │  │
│  │ Attestation    │  │
│  │ Verifier       │  │
│  └────────────────┘  │
└──────────────────────┘
```

**Privacy model:** AML reports never touch the chain. The CRE signs a `ComplianceAttestation` struct containing only a `keccak256` hash of the report + the subject address. The vault verifies the signature on-chain. No PII, ever.

---

## Glossary

New to institutional DeFi compliance? Here's what every term in this project means.

| Term | What it means |
|---|---|
| **CRE** | *Compliance & Routing Engine* — the off-chain middleware service at the heart of Attestara. It runs AML checks, signs attestations, and relays transactions. Think of it as a compliance firewall between an institution and the vault. |
| **AML** | *Anti-Money Laundering* — the regulatory process of screening wallets and transactions to detect illegal activity. In Attestara, AML screening runs inside the CRE using Chainalysis KYT or the built-in mock server. |
| **KYT** | *Know Your Transaction* — Chainalysis's real-time transaction risk scoring API. It analyses counterparty exposure, mixer usage, OFAC sanctions, and more. Attestara abstracts KYT behind a pluggable adapter. |
| **OFAC** | *Office of Foreign Assets Control* — the US Treasury body that maintains sanctions lists. Wallets on OFAC lists are flagged `BLOCKED` by the AML screener. |
| **DID** | *Decentralized Identifier* — a globally unique identifier (e.g. `did:ethr:0xABC...`) anchored to a blockchain address instead of a central authority. In Attestara, every institution must register a DID in the on-chain `DIDRegistry` before they can deposit. This proves they have gone through onboarding. |
| **DID Registry** | The `DIDRegistry.sol` smart contract that maps Ethereum addresses to DID documents. A DID document contains a document hash, service endpoint, and timestamps. The vault checks this registry before accepting any deposit. |
| **EIP-712** | An Ethereum standard for hashing and signing structured data (not raw bytes). Attestara uses EIP-712 to sign `ComplianceAttestation` structs — this means wallets show a human-readable signing prompt instead of a raw hex blob, and the signature is domain-separated to prevent cross-contract replay. |
| **Attestation** | A signed statement issued by the CRE that says "I checked this address against AML rules and it passed." It contains the subject address, an AML report hash, an expiry timestamp, and a one-time nonce. The vault verifies this on-chain before accepting a deposit. |
| **Nonce** | A one-time random number embedded in each attestation. Once an attestation is used in a deposit, its nonce is permanently recorded as spent in the `ComplianceAttestationVerifier` contract. This prevents the same attestation being replayed to make a second deposit. |
| **TTL** | *Time To Live* — the validity window of a signed attestation, defaulting to 15 minutes. After expiry, the vault rejects the deposit with `Attestation__Expired`. This limits the window in which a compromised attestation could be misused. |
| **Tenderly** | A blockchain development platform used by Attestara for four things: (1) hosting a fork of Ethereum mainnet as a Virtual TestNet, (2) simulating transactions before execution, (3) providing execution traces for gas analysis, and (4) firing webhooks when specific contract calls are detected. |
| **Virtual TestNet / Fork** | A sandboxed copy of Ethereum mainnet state hosted by Tenderly. It behaves exactly like mainnet (same contract addresses, same token balances) but transactions are isolated and free. Attestara deploys to a fork so you can run the full stack without spending real ETH or USDC. |
| **Simulation** | Tenderly's ability to execute a transaction against fork state without mining it. Attestara uses this as a pre-flight check — if the deposit would revert, the user sees the decoded reason before any gas is spent. |
| **ERC-20** | The standard interface for fungible tokens on Ethereum. Attestara uses USDC (a stablecoin pegged to $1) as the deposit asset. USDC implements ERC-20, so the vault calls `approve` + `transferFrom` to pull funds. |
| **ERC-4626** | A standard for tokenized vaults (yield-bearing deposit contracts). `PermissionedVault.sol` follows the spirit of ERC-4626 but adds a mandatory compliance gate before each deposit. |
| **ECDSA** | *Elliptic Curve Digital Signature Algorithm* — the cryptographic primitive Ethereum uses for transaction signing. The CRE's EIP-712 attestation signature is an ECDSA signature recovered by the `ComplianceAttestationVerifier` contract to prove the CRE authorised the deposit. |
| **Relay / Relayer** | A pattern where a backend service (the CRE) submits an on-chain transaction on behalf of a user, so the user doesn't need ETH for gas. In Attestara's demo mode, the CRE relays the vault deposit using the institution's private key passed in the request body. |
| **Revert** | When a smart contract transaction fails and all state changes are rolled back. Attestara's contracts use custom errors (`Vault__Paused`, `Attestation__NonceUsed`, etc.) that are decoded by the simulation service into human-readable messages. |
| **State Manipulation** | Tenderly's RPC extensions (`tenderly_setBalance`, `tenderly_setStorageAt`, `evm_increaseTime`) that let you directly modify fork state — useful for scripting test scenarios like advancing time past attestation expiry or funding a wallet with USDC without going through an exchange. |
| **Tenderly Alerts / Webhooks** | Tenderly can watch for specific on-chain events (e.g. a call to `PermissionedVault.deposit()`) and fire an HTTP POST to a CRE endpoint in real time. Attestara uses this for Feature 3: revocation — the CRE re-screens an address the moment a deposit is detected and can burn the nonce before it settles. |
| **Gas** | The unit of computational work in Ethereum. Every operation (storage write, signature verification, token transfer) costs gas, priced in gwei (1 gwei = 10⁻⁹ ETH). Attestara's gas dashboard decomposes a deposit's total gas into per-call-frame costs so you know exactly what each compliance check costs. |
| **keccak256** | Ethereum's standard hash function (a variant of SHA-3). Attestara uses it to commit to AML reports on-chain: `amlReportHash = keccak256(reportJSON)`. The report itself stays off-chain; only the hash is stored in the attestation. |
| **USDC** | *USD Coin* — a fiat-backed stablecoin issued by Circle, pegged 1:1 to the US dollar. It's the deposit asset in Attestara's vault because institutional DeFi typically operates in dollar-denominated stablecoins rather than volatile assets. |
| **Aave Arc** | An institutional-grade, permissioned version of the Aave lending protocol. It uses a `PermissionManager` whitelist to gate deposits. Attestara's vault is inspired by Aave Arc but replaces the static whitelist with a dynamic, per-transaction CRE attestation. |
| **EIP-712 Domain Separator** | A hash that uniquely identifies a specific contract deployment (by name, version, chain ID, and contract address). It prevents a signature intended for Attestara's verifier on mainnet being replayed against a different verifier on another chain or contract. |

---

## Features

### Core Compliance Pipeline
- **DID Resolution** — institutions register on-chain Decentralized Identifiers via `DIDRegistry.sol`
- **AML Screening** — pluggable adapter for Chainalysis KYT or the included mock server
- **EIP-712 Attestations** — CRE signs typed-data attestations with a 15-minute TTL and one-time nonces
- **Relay Mode** — CRE can relay the full deposit transaction on behalf of the institution

### Feature 1 — Tenderly Simulation Pre-Flight
> *"Predict the future before committing to it"*

Before executing any deposit on-chain, the CRE sends the full calldata to **Tenderly's Simulation API**. If the transaction would revert, the institution sees a decoded human-readable reason (`Vault__DIDNotRegistered`, `Attestation__Expired`, etc.) — zero gas wasted.

```
Screen → Sign → 🔮 Simulate (Tenderly) → Preview → Execute on-chain
```

The deposit response includes a `simulation` object:
```json
{
  "success": true,
  "gasUsed": 185432,
  "gasEstimateUsd": "2.31",
  "preview": {
    "gasLabel": "~185,432 gas ($2.31)",
    "stateChanges": ["Vault balance increases by 1,000 USDC"],
    "events": ["✅ AttestationVerified", "✅ Deposit"]
  }
}
```

### Feature 2 — Time-Travel Compliance Auditing
> *"Was this address compliant at the time of the deposit 3 months ago?"*

The CRE creates an **ephemeral Tenderly fork pinned to the exact block** of a historical deposit and re-queries all on-chain compliance state — DID registration, nonce consumption, vault balance — then compares it with the current state.

```
GET /api/v1/compliance/audit/:txHash
```

Returns a side-by-side comparison:

| Field | At Deposit (Block #18500000) | Now |
|---|---|---|
| DID Registered | ✅ did:ethr:0xABC… | ✅ Same |
| Vault Balance | 50,000 USDC | 120,000 USDC |
| Nonce Consumed | ✅ First use | ✅ Consumed |

The ephemeral fork is automatically torn down after the query.

### Feature 3 — Real-Time Attestation Revocation
> *"The AML status changed in the 15-minute window — revoke before settlement"*

Tenderly Alerts fire a webhook to the CRE when a vault deposit is detected. The CRE immediately re-screens the address. If the status changed to `BLOCKED` or `HIGH_RISK`, it burns the attestation nonce on-chain via `tenderly_setStorageAt` — causing the deposit to revert with `Attestation__NonceUsed`.

```
POST /api/v1/webhooks/tenderly   ← Tenderly Alert webhook receiver
POST /api/v1/compliance/revoke   ← Manual revocation trigger
GET  /api/v1/revocations         ← Revocation event log
```

### Feature 4 — Adversarial Scenario Playground
> *"Prove every revert path works — on demand, one click"*

Five scripted security scenarios using Tenderly state manipulation (`evm_increaseTime`, `tenderly_setBalance`, `tenderly_setErc20Balance`, `tenderly_setStorageAt`):

| Scenario | What it proves |
|---|---|
| 🚫 **Sanctioned Address** | CRE blocks OFAC-listed addresses before any on-chain interaction |
| 🔁 **Replay Attack** | `Attestation__NonceUsed` — signed attestations can only be used once |
| ⏰ **Expired Attestation** | `Attestation__Expired` — 15-minute TTL is enforced on-chain |
| 🪪 **Unregistered DID** | `Vault__DIDNotRegistered` — AML clearance alone is not sufficient |
| ⏸️ **Emergency Vault Pause** | `Vault__Paused` — owner kill-switch blocks all deposits instantly |

```
POST /api/v1/scenarios/:scenarioId
# scenarioId: sanctioned | replay | expired | no-did | pause
```

### Feature 5 — Gas Optimization Dashboard
> *"Where exactly is each wei being spent?"*

After every deposit, the CRE fetches the **Tenderly Transaction Trace** and decomposes gas into a structured call-tree with per-node percentages and category totals.

```
GET /api/v1/vault/trace/:txHash
```

```
PermissionedVault.deposit()              185,432 gas  100%
├── DIDRegistry.isRegistered()             8,500 gas    4.6%
├── ComplianceAttestationVerifier.verify() 52,100 gas  28.1%
│   ├── ECDSA.recover()                    3,800 gas    2.1%
│   ├── EIP712._hashTypedDataV4()          6,200 gas    3.4%
│   └── Storage: usedNonces write         20,000 gas   10.8%
├── SafeERC20.safeTransferFrom()          45,000 gas   24.3%
├── DIDRegistry.resolve()                 12,000 gas    6.5%
└── Storage: balances + totalDeposits    40,000 gas   21.6%
```

Includes optimization hints and rolling session averages.

---

## Architecture

```
packages/
├── contracts/          Solidity smart contracts + Hardhat config
│   └── contracts/
│       ├── DIDRegistry.sol                    On-chain DID registry
│       ├── ComplianceAttestationVerifier.sol  EIP-712 attestation verifier
│       └── PermissionedVault.sol              Permissioned ERC-4626-style vault
│
├── cre/                Compliance & Routing Engine (Express / TypeScript)
│   └── src/
│       ├── index.ts                           API server + all endpoints
│       ├── services/
│       │   ├── attestationSigner.ts           EIP-712 signing
│       │   ├── didResolver.ts                 On-chain DID resolution
│       │   ├── txForwarder.ts                 Relay deposits to vault
│       │   ├── simulationService.ts           [F1] Tenderly simulation
│       │   ├── timeTravelService.ts           [F2] Historical fork auditing
│       │   ├── revocationService.ts           [F3] Nonce burning / revocation
│       │   ├── scenarioRunner.ts              [F4] Adversarial scenarios
│       │   └── traceAnalyzer.ts               [F5] Gas trace decomposition
│       └── adapters/
│           ├── mockAmlAdapter.ts              Local mock AML server
│           └── chainalysisAdapter.ts          Real Chainalysis KYT
│
├── mock-aml/           Mock Chainalysis KYT server (port 4001)
│
└── frontend/           React + Vite dashboard (port 3000)
    └── src/
        ├── api.ts                             Typed API client
        ├── App.tsx                            Nav: Dashboard / AML Logs / Vault / Scenarios / Queue
        └── components/
            ├── TransactionStepper.tsx         Step-by-step compliance flow
            ├── SimulationPreview.tsx          [F1] Pre-flight result card
            ├── AMLLogs.tsx                    Compliance log table + audit button
            ├── AuditPanel.tsx                 [F2] Time-travel comparison modal
            ├── ScenariosTab.tsx               [F4] Adversarial scenario cards
            ├── GasAnalysis.tsx                [F5] Call-tree + category bars
            ├── LiveFeed.tsx                   Real-time transaction feed
            ├── VaultStats.tsx                 Vault stats dashboard
            └── PendingQueue.tsx               In-flight transaction queue
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Tenderly](https://tenderly.co) account with a Virtual TestNet (fork) already created
- The fork must have contracts deployed (run setup scripts below if starting fresh)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/attestara.git
cd attestara
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env` — see [Environment Variables](#environment-variables) below. The minimum required set for a full run:

```
TENDERLY_API_KEY=...
TENDERLY_ACCOUNT_SLUG=...
TENDERLY_PROJECT_SLUG=...
TENDERLY_FORK_RPC=...
TENDERLY_FORK_ID=...
DEPLOYER_PRIVATE_KEY=...
DEPLOYER_ADDRESS=...
CRE_SIGNER_PRIVATE_KEY=...
DID_REGISTRY_ADDRESS=...
VERIFIER_ADDRESS=...
VAULT_ADDRESS=...
```

### 3. (First time only) Set up Tenderly fork & deploy contracts

```bash
# Create a Tenderly Virtual TestNet fork of Ethereum mainnet
npm run fork:setup -w packages/contracts

# Deploy DIDRegistry, ComplianceAttestationVerifier, PermissionedVault
npm run deploy -w packages/contracts

# Fund deployer with USDC + register their DID
npx ts-node packages/contracts/scripts/setupDepositor.ts
```

### 4. Start all services

```bash
# Terminal 1 — Mock AML server (port 4001)
npm run dev -w packages/mock-aml

# Terminal 2 — CRE engine (port 4000)
npm run dev -w packages/cre

# Terminal 3 — Frontend dashboard (port 3000)
npm run dev -w packages/frontend
```

Or use concurrently to run mock-aml + CRE together:

```bash
npm run dev   # starts mock-aml + cre
```

Then open **http://localhost:3000**

---

## API Reference

All CRE endpoints are on `http://localhost:4000`.

### Core

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health + feature flags |
| `POST` | `/api/v1/compliance/screen` | AML screen an address, get signed attestation |
| `POST` | `/api/v1/compliance/deposit` | Full relay: screen → simulate → execute on-chain |
| `GET` | `/api/v1/compliance/queue` | In-flight pending transactions |
| `GET` | `/api/v1/compliance/logs` | Full AML audit log |
| `GET` | `/api/v1/vault/stats` | Vault total deposits + user balance |

### Feature Endpoints

| Method | Path | Feature | Description |
|---|---|---|---|
| `GET` | `/api/v1/compliance/audit/:txHash` | F2 | Time-travel audit for a historical deposit |
| `POST` | `/api/v1/webhooks/tenderly` | F3 | Tenderly Alert webhook receiver |
| `POST` | `/api/v1/compliance/revoke` | F3 | Manually burn an attestation nonce |
| `GET` | `/api/v1/revocations` | F3 | Revocation event log |
| `POST` | `/api/v1/scenarios/:id` | F4 | Run adversarial scenario |
| `GET` | `/api/v1/vault/trace/:txHash` | F5 | Gas trace decomposition |

### POST `/api/v1/compliance/screen`

```json
{ "address": "0x...", "amount": 1000000 }
```

**Response (CLEARED):**
```json
{
  "status": "CLEARED",
  "did": "did:ethr:0x...",
  "riskScore": 12,
  "attestation": {
    "subject": "0x...",
    "amlReportHash": "0x...",
    "expiry": "1700000000",
    "nonce": "0x...",
    "amlProvider": "mock-aml"
  },
  "signature": "0x..."
}
```

### POST `/api/v1/compliance/deposit`

```json
{
  "address": "0x...",
  "amount": 1000000,
  "institutionPrivateKey": "0x...",
  "skipSimulation": false
}
```

**Response (SETTLED):**
```json
{
  "status": "SETTLED",
  "txHash": "0x...",
  "blockNumber": 18500001,
  "gasUsed": "185432",
  "vaultBalance": "1000.0",
  "simulation": {
    "success": true,
    "gasUsed": 185432,
    "preview": { "gasLabel": "~185,432 gas ($2.31)", "events": ["✅ Deposit"] }
  }
}
```

**Response (SIMULATION_FAILED):**
```json
{
  "status": "SIMULATION_FAILED",
  "message": "Vault__DIDNotRegistered(0x...)",
  "simulation": { "success": false, "decodedRevert": "Vault__DIDNotRegistered(0x...)" }
}
```

---

## Smart Contracts

### DIDRegistry.sol

Maps Ethereum addresses to DID documents on-chain.

```solidity
function register(string did, bytes32 documentHash, string serviceEndpoint) external
function resolve(address owner) view returns (DIDDocument memory)
function isRegistered(address owner) view returns (bool)
```

### ComplianceAttestationVerifier.sol

Verifies EIP-712 CRE signatures. Prevents replay via nonce tracking.

```solidity
struct ComplianceAttestation {
    address subject;
    bytes32 amlReportHash;  // keccak256 of off-chain AML report — no PII on-chain
    uint256 expiry;
    uint256 nonce;
    string  amlProvider;
}

function verifyAttestation(ComplianceAttestation calldata, bytes calldata, address depositor) external
```

**Custom errors:** `Attestation__Expired` · `Attestation__NonceUsed` · `Attestation__InvalidSigner` · `Attestation__SubjectMismatch`

### PermissionedVault.sol

ERC-4626-style vault. Every deposit requires a valid `ComplianceAttestation` + a registered DID.

```solidity
function deposit(uint256 amount, ComplianceAttestation calldata, bytes calldata signature) external
function withdraw(uint256 amount) external
function pause() external onlyOwner
function unpause() external onlyOwner
```

**Custom errors:** `Vault__Paused` · `Vault__DIDNotRegistered` · `Vault__ZeroAmount` · `Vault__InsufficientBalance`

---

## AML Screening Rules (Mock Server)

| Rule | Status | Risk Score |
|---|---|---|
| Address starts with `0x000…` | `BLOCKED` | 100 — OFAC sanctioned pattern |
| Address contains `dead` or `beef` | `HIGH_RISK` | 75 — mixer pattern |
| Amount > 10,000,000 USDC | `HIGH_RISK` | 60 — large transaction flag |
| Everything else | `CLEARED` | 0–20 |

To use real [Chainalysis KYT](https://www.chainalysis.com/chainalysis-kyt/), set `CHAINALYSIS_API_KEY` in `.env`.

---

## Environment Variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Required | Description |
|---|---|---|
| `TENDERLY_API_KEY` | ✅ | Tenderly API key |
| `TENDERLY_ACCOUNT_SLUG` | ✅ | Tenderly account slug |
| `TENDERLY_PROJECT_SLUG` | ✅ | Tenderly project slug |
| `TENDERLY_FORK_RPC` | ✅ | Admin RPC URL of Virtual TestNet |
| `TENDERLY_FORK_ID` | ✅ | Virtual TestNet UUID (for simulation) |
| `TENDERLY_PUBLIC_RPC` | — | Public RPC (read-only access) |
| `DEPLOYER_PRIVATE_KEY` | ✅ | Wallet that deployed the contracts |
| `DEPLOYER_ADDRESS` | ✅ | Address of deployer wallet |
| `CRE_SIGNER_PRIVATE_KEY` | ✅ | CRE's EIP-712 signing key |
| `CRE_SIGNER_ADDRESS` | ✅ | Address of CRE signer (must match contract) |
| `CHAIN_ID` | ✅ | Chain ID (1 for mainnet fork) |
| `DID_REGISTRY_ADDRESS` | ✅ | Deployed DIDRegistry address |
| `VERIFIER_ADDRESS` | ✅ | Deployed ComplianceAttestationVerifier address |
| `VAULT_ADDRESS` | ✅ | Deployed PermissionedVault address |
| `USDC_ADDRESS` | — | USDC token address (default: mainnet) |
| `CHAINALYSIS_API_KEY` | — | Real KYT key; leave blank for mock |
| `CRE_PORT` | — | CRE port (default: 4000) |
| `MOCK_AML_PORT` | — | Mock AML port (default: 4001) |
| `MOCK_AML_URL` | — | Mock AML URL (default: http://localhost:4001) |

---

## ZK Privacy Model

```
Off-chain (CRE enclave)          On-chain (Vault + Verifier)
─────────────────────────        ───────────────────────────
Full AML report          ──┐
  name, DOB, SSN            │    keccak256(report) ← only this
  sanctions lists           │    subject address
  transaction history  ──┘    expiry timestamp
  risk score                   nonce (replay protection)
                               CRE signature (EIP-712)
```

The on-chain verifier checks the **signature** (proving the CRE ran the check) but never sees the underlying data. A regulator can verify compliance occurred; no one can reconstruct the AML findings from the chain.

---

## Security Notes

- **CRE signing key** — treat like a hot wallet private key. Rotate via `ComplianceAttestationVerifier.updateCRESigner()`.
- **Attestation TTL** — 15 minutes by default. Set `ttlSeconds` in `AttestationSigner.sign()`.
- **Nonce exhaustion** — nonces are 128-bit random values; collision probability is negligible.
- **Vault pause** — `PermissionedVault.pause()` is an emergency kill-switch callable only by the owner.
- **Replay protection** — `usedNonces[subject][nonce]` is set atomically with the deposit in a single transaction.
- **Tenderly fork** — the Virtual TestNet is a sandboxed environment. Production deployments should use a real network.

---

## Development

```bash
# Run integration tests
npm run integration:test -w packages/cre

# Type-check CRE
cd packages/cre && npx tsc --noEmit

# Type-check frontend
cd packages/frontend && npx tsc --noEmit

# Re-deploy contracts (after changes)
npm run deploy -w packages/contracts
```

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built with [Tenderly](https://tenderly.co) · [ethers.js](https://ethers.org) · [OpenZeppelin](https://openzeppelin.com)

</div>
