# Attestara — Complete Demo Guide

> **Audience**: Business stakeholders, technical reviewers, and developers.  
> **Purpose**: Walk through every step of the system — from entering an address in the UI to an on-chain settlement — explaining the business rationale and the exact technical mechanics underneath.

---

## Table of Contents

1. [What Is This System?](#1-what-is-this-system)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [The Three Smart Contracts](#3-the-three-smart-contracts)
4. [The Off-Chain Services](#4-the-off-chain-services)
5. [AI Compliance Oracle — How It Works](#5-ai-compliance-oracle--how-it-works)
6. [Step-by-Step: What Happens When You Submit the Form](#6-step-by-step-what-happens-when-you-submit-the-form)
7. [The EIP-712 Attestation Explained](#7-the-eip-712-attestation-explained)
8. [The ZK Privacy Model](#8-the-zk-privacy-model)
9. [Compliance Screening Rules](#9-compliance-screening-rules)
10. [What the Frontend Shows](#10-what-the-frontend-shows)
11. [Running the Demo](#11-running-the-demo)
12. [Integration Test Walkthrough](#12-integration-test-walkthrough)
13. [Security Properties](#13-security-properties)
14. [Production vs Demo Differences](#14-production-vs-demo-differences)

---

## 1. What Is This System?

### Business Perspective

Traditional DeFi protocols are open to anyone — including sanctioned entities, mixer wallets, and money launderers. Institutional capital (hedge funds, banks, asset managers) cannot legally touch these protocols without compliance controls.

This system is a **compliance middleware layer** that sits between an institution and a permissioned DeFi vault. It answers one question before every deposit:

> *"Has this wallet been AML/KYC-screened and cleared by an authorised compliance engine?"*

If yes → the vault accepts the deposit.  
If no → the vault reverts the transaction at the smart contract level.

The critical innovation: **no personally identifiable information (PII) is stored on-chain**. The blockchain only ever sees a cryptographic hash of the compliance report and a digital signature — never the raw report, never the institution's identity documents.

### Technical Perspective

The system is a monorepo with three layers:

| Layer | Technology | Purpose |
|---|---|---|
| Smart Contracts | Solidity on Tenderly Virtual Sepolia (`chainId: 11155111`) | Identity, attestation verification, vault |
| CRE Engine | TypeScript / Express.js (port 4000) | AML orchestration, EIP-712 signing, tx relay |
| AI Oracle | Etherscan API + Google Gemini AI | Primary AML adapter — real wallet analysis + AI risk narrative |
| Mock AML Server | TypeScript / Express.js (port 4001) | Fallback AML server — simulates Chainalysis KYT API |
| Frontend | React / Vite / TailwindCSS (port 3000) | UI dashboard for demo |

---

## 2. Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Institution Operator                          │
│              (enters address + amount + private key)                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP POST /api/v1/compliance/deposit
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CRE Engine (port 4000)                            │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ DID Resolver │  │           AML Adapter Pipeline               │ │
│  │ (on-chain)   │  │  ┌─────────────────────────────────────────┐ │ │
│  └──────┬───────┘  │  │ 1. AI Oracle (primary)                  │ │ │
│         │          │  │    Etherscan → tx history (last 50)     │ │ │
│         │          │  │    Gemini AI → risk score + narrative   │ │ │
│         │          │  ├─────────────────────────────────────────┤ │ │
│         │          │  │ 2. Chainalysis KYT (if key set)         │ │ │
│         │          │  ├─────────────────────────────────────────┤ │ │
│         │          │  │ 3. Mock AML server (fallback, port 4001)│ │ │
│         │          │  └─────────────────────────────────────────┘ │ │
│         │          └──────────────────┬───────────────────────────┘ │
│         │                             │                              │
│  ┌──────┴───────────────────────────-─┴──────────────────────────┐  │
│  │              Attestation Signer (EIP-712, secp256k1)           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │
          │ eth_call / eth_sendRawTransaction
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│            Tenderly Virtual Sepolia (chainId: 11155111)              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               PermissionedVault.sol                            │ │
│  │  1. require(didRegistry.isRegistered(msg.sender))              │ │
│  │  2. verifier.verifyAttestation(attestation, signature, sender) │ │
│  │  3. IERC20(asset).transferFrom(sender, vault, amount)          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Three Smart Contracts

All three are deployed on a **Tenderly Virtual Sepolia TestNet** (`chainId: 11155111`) via `@tenderly/hardhat-tenderly` with automatic contract verification. Contracts run on a sandboxed Sepolia fork — real EVM logic, no real money.

### 3.1 DIDRegistry.sol
**Address**: `0xccA4A4c8A03C7Dd156E5Fc2aeD4B9D911180797F`

**Business purpose**: An on-chain identity ledger. Before an institution can deposit, they must register a Decentralized Identifier (DID) — a self-sovereign identity anchor that maps their Ethereum address to an off-chain compliance document.

**Technical detail**:

```solidity
mapping(address => DIDDocument) private _documents;
mapping(string  => address)     private _didToOwner;

struct DIDDocument {
    string  did;             // e.g. "did:zk:0x742d..."
    bytes32 documentHash;    // keccak256 of the off-chain JSON identity doc
    string  serviceEndpoint; // URL where full document lives
    uint256 registeredAt;
    uint256 updatedAt;
    bool    active;
}
```

Key functions:
- `register(did, documentHash, serviceEndpoint)` — one-time registration, reverts if address already registered or DID string taken
- `resolve(address)` — returns full `DIDDocument` for an address (called by the vault before every deposit)
- `isRegistered(address)` — returns `true` only if `registeredAt != 0` AND `active == true`
- `deactivate()` — soft-deletes (preserves history for audit trail)

**Events emitted**: `DIDRegistered`, `DIDUpdated`, `DIDDeactivated`

### 3.2 ComplianceAttestationVerifier.sol
**Address**: `0xC5fa799a9b4afcAC37cC4742E17e79f49FB97Fc8`

**Business purpose**: The cryptographic gatekeeper. It proves on-chain that a specific wallet was cleared by the authorised CRE at a specific time, for a specific amount, without revealing the actual compliance report.

**Technical detail — the attestation struct**:

```solidity
struct ComplianceAttestation {
    address subject;        // institution wallet being attested
    bytes32 amlReportHash;  // keccak256(AML report JSON) — never the report itself
    uint256 expiry;         // unix timestamp: block.timestamp must be <= this
    uint256 nonce;          // random 16-byte number, consumed atomically on use
    string  amlProvider;    // "mock-aml" or "chainalysis"
}
```

**EIP-712 type hash** (must match exactly what the CRE signs):
```
keccak256("ComplianceAttestation(address subject,bytes32 amlReportHash,uint256 expiry,uint256 nonce,string amlProvider)")
```

**Verification logic** inside `verifyAttestation()`:
1. `require(attestation.subject == depositor)` — prevents one institution using another's clearance
2. `require(block.timestamp <= attestation.expiry)` — no stale attestations
3. `require(!usedNonces[subject][nonce])` — no replay attacks
4. Recovers signer from EIP-712 digest + ECDSA signature
5. `require(recovered == creSignerAddress)` — only the authorised CRE can sign
6. `usedNonces[subject][nonce] = true` — atomically burns the nonce

**Read-only check**: `isAttestationValid()` does the same checks but does NOT consume the nonce — used by the frontend for pre-validation.

### 3.3 PermissionedVault.sol
**Address**: `0x13F32ed38efC220eA31269F06793244081581427`

**Business purpose**: The institutional vault. Accepts USDC deposits only from DID-registered, AML-cleared institutions. Analogous to Aave Arc but with dynamic per-transaction compliance instead of a static whitelist.

**Technical detail — the `deposit()` function**:

```solidity
function deposit(
    uint256 amount,
    ComplianceAttestationVerifier.ComplianceAttestation calldata attestation,
    bytes calldata signature
) external nonReentrant whenNotPaused {
    require(amount > 0);
    require(didRegistry.isRegistered(msg.sender));         // Step 1: DID check
    verifier.verifyAttestation(attestation, signature, msg.sender); // Step 2: AML check
    IERC20(asset).safeTransferFrom(msg.sender, address(this), amount); // Step 3: Pull tokens
    balances[msg.sender] += amount;
    totalDeposits += amount;
    emit Deposit(msg.sender, amount, attestation.amlReportHash, did);
}
```

All three checks are **atomic in a single transaction** — there is no window between clearance and deposit.

**Emergency controls**: `pause()` / `unpause()` (owner only) — stops all deposits and withdrawals immediately.

---

## 4. The Off-Chain Services

### 4.1 CRE Engine — `packages/cre/src/index.ts`

The CRE (Compliance & Routing Engine) is a TypeScript/Express.js server running on **port 4000**. It is the brain of the system — it orchestrates every step between the institution and the blockchain.

**Startup sequence**:
1. Loads environment variables (`TENDERLY_FORK_RPC`, `VAULT_ADDRESS`, `CRE_SIGNER_PRIVATE_KEY`, etc.)
2. Creates `ethers.JsonRpcProvider` connected to the Tenderly Virtual Sepolia RPC
3. Checks for `CRE_SIGNER_PRIVATE_KEY` in `.env`:
   - If present: uses it directly
   - If absent: checks `.cre-signer.key` file
   - If neither: **generates a fresh secp256k1 key pair**, saves it to `.cre-signer.key` (chmod 0600), and logs the address for the operator to add to `.env` and redeploy contracts with
4. Selects AML adapter (priority order):
   - `AIAmlAdapter` — if both `ETHERSCAN_API_KEY` and `GEMINI_API_KEY` are set (**default when configured**)
   - `ChainalysisAdapter` — if `CHAINALYSIS_API_KEY` is set
   - `MockAMLAdapter` — fallback when no keys are present
5. Instantiates service objects:
   - `DIDResolver` — thin wrapper around the on-chain `DIDRegistry`
   - `AttestationSigner` — holds the CRE signing key
   - `TxForwarder` — handles on-chain execution
6. Starts Express server

**In-memory state** (resets on restart):
```typescript
auditLogs: AuditLog[]   // complete history of all screenings
pendingQueue: AuditLog[] // transactions currently in-flight
```

### 4.2 Attestation Signer — `packages/cre/src/services/attestationSigner.ts`

Responsible for producing the EIP-712 signature that gates vault access.

**Key generation**:
- On first run with no key: `ethers.Wallet.createRandom()` → persisted to `.cre-signer.key`
- File permissions: `0o600` (owner read/write only)
- The address of this key must be registered as `creSignerAddress` in the `ComplianceAttestationVerifier` contract

**Signing**:
```typescript
// EIP-712 domain (must exactly match contract constructor args)
const domain = {
  name: "ComplianceAttestationVerifier",
  version: "1",
  chainId: chainId,          // 1 for mainnet fork
  verifyingContract: verifierAddress
};

// Type definition (must exactly match ATTESTATION_TYPEHASH in contract)
const types = {
  ComplianceAttestation: [
    { name: "subject",       type: "address" },
    { name: "amlReportHash", type: "bytes32" },
    { name: "expiry",        type: "uint256" },
    { name: "nonce",         type: "uint256" },
    { name: "amlProvider",   type: "string"  }
  ]
};

const signature = await wallet.signTypedData(domain, types, attestation);
```

The signature is a standard 65-byte hex string (`r + s + v`), recoverable on-chain via OpenZeppelin's `ECDSA.recover()`.

### 4.3 DID Resolver — `packages/cre/src/services/didResolver.ts`

Makes a read-only `eth_call` to `DIDRegistry.resolve(address)`. Returns the `DIDDocument` or `null` if not registered. Used by the CRE to enrich audit logs with the institution's DID string.

### 4.4 Transaction Forwarder — `packages/cre/src/services/txForwarder.ts`

Executes the on-chain deposit on behalf of the institution. In production, the institution would sign and submit their own transaction — this relayer pattern is for demonstration purposes.

**Flow**:
1. Connect `institutionSigner` (from private key) to provider
2. Check USDC allowance: if `allowance(institution, vault) < amount`, call `usdc.approve(vault, amount)` and wait for confirmation
3. Build attestation tuple (Solidity-compatible struct encoding):
   ```typescript
   [subject, amlReportHash, expiry, nonce, amlProvider]
   ```
4. Call `vault.deposit(amount, tuple, signature)` and wait for receipt
5. Read final `vault.balanceOf(institution)` and return result

### 4.5 AI Compliance Oracle — `packages/cre/src/adapters/aiAmlAdapter.ts`

The primary AML adapter when `ETHERSCAN_API_KEY` and `GEMINI_API_KEY` are both configured. Replaces rule-based screening with intelligent wallet analysis powered by real blockchain data and large language model reasoning.

**Two-stage pipeline:**
1. **Etherscan** — fetches the last 50 normal transactions + ERC-20 token transfers for the wallet
2. **Gemini AI** — receives a structured prompt containing the transaction summary, counterparty patterns, protocol interactions, and known-address detection; returns:
   - `riskScore` (0–100)
   - `status` (`CLEARED` / `HIGH_RISK` / `BLOCKED`)
   - `alerts[]` (e.g. `MIXER_INTERACTION`, `EXCHANGE_DEPOSIT`)
   - `narrative` — a human-readable explanation of the risk assessment

**Static pre-filters** (applied before AI call, for demo compatibility):
- Address starts with `0x000` → `BLOCKED` (100) — OFAC pattern
- Address contains `dead` or `beef` → `HIGH_RISK` (75) — mixer pattern
- Amount > 10,000,000 USDC → upgrades to `HIGH_RISK`
- Everything else → handed to Gemini for analysis

**Fallback**: If Etherscan or Gemini APIs are unreachable, the adapter returns a safe `CLEARED` result with a `FALLBACK` flag — static demo rules remain functional.

### 4.6 Mock AML Server — `packages/mock-aml/src/index.ts`

Standalone Express.js server on **port 4001**. Used automatically as fallback when AI keys are not configured. Simulates the Chainalysis KYT API structure so the CRE adapter code is production-compatible with zero changes.

**Screening rules** (applied in order):
1. Address starts with `0x000` → `BLOCKED` (risk: 100) — simulates OFAC sanctions match
2. Address contains `dead` or `beef` → `HIGH_RISK` (risk: 75) — simulates mixer/darknet exposure
3. Amount > 10,000,000 USDC → adds `LARGE_TRANSACTION_THRESHOLD_EXCEEDED` alert, upgrades to `HIGH_RISK`
4. Everything else → `CLEARED` (risk: 0–14, randomised per check)

---

## 5. AI Compliance Oracle — How It Works

> **Set `ETHERSCAN_API_KEY` + `GEMINI_API_KEY` in `.env` to activate.** Without these, the system falls back to the Mock AML server automatically.

```
Screening Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ Static Pre-Filters (always applied first)            │
│  0x000... → BLOCKED (OFAC pattern)                   │
│  dead/beef → HIGH_RISK (mixer pattern)               │
│  amount > $10M → HIGH_RISK                           │
└──────────────────────────┬──────────────────────────┘
                           │ passes pre-filters
                           ▼
┌─────────────────────────────────────────────────────┐
│ Etherscan API                                        │
│  GET /api?module=account&action=txlist&address=0x…   │
│  → last 50 normal txs                               │
│  GET /api?module=account&action=tokentx&address=0x…  │
│  → last 50 ERC-20 token transfers                   │
└──────────────────────────┬──────────────────────────┘
                           │ transaction history
                           ▼
┌─────────────────────────────────────────────────────┐
│ Gemini AI (gemini-1.5-flash)                         │
│  Prompt includes:                                    │
│   - wallet address                                   │
│   - total tx count, first/last activity              │
│   - top counterparties (known exchanges, protocols)  │
│   - token transfer volume                            │
│   - known-risk patterns (mixers, bridges, etc.)      │
│                                                      │
│  Returns:                                            │
│   - riskScore: 0–100                                 │
│   - status: CLEARED / HIGH_RISK / BLOCKED            │
│   - alerts: ["MIXER_INTERACTION", ...]               │
│   - narrative: "This wallet has 47 txs over 6 months │
│     primarily interacting with Uniswap V3..."        │
└──────────────────────────┬──────────────────────────┘
                           │ AMLScreeningResult + aiNarrative
                           ▼
     CRE signs EIP-712 attestation
```

### What the Narrative Looks Like

The `aiNarrative` field appears in frontend UI as a purple **🧠 AI Risk Analysis** card in three places:
- **ScreenForm** — after the screening result badge
- **TransactionStepper** — in the attestation review step
- **AML Logs** — 🧠 tooltip icon on rows screened by AI

Example AI narrative for a clean wallet:
> *"This wallet shows 47 transactions over 6 months, primarily interacting with Uniswap V3 (DEX swaps) and Aave V2 (lending). No mixer interactions detected. Counterparties are limited to well-known DeFi protocols and CEX withdrawal addresses. Token transfers consist mainly of USDC and ETH with no privacy-coin activity. Risk assessment: LOW."*

Example AI narrative for a high-risk wallet:
> *"This wallet has 12 transactions, including 3 interactions with Tornado Cash (ETH mixing), and 2 transfers from a flagged darknet market deposit address. Transaction volume spiked abruptly 30 days ago with no prior activity. Risk assessment: HIGH — mixer interactions detected."*

---

## 6. Step-by-Step: What Happens When You Submit the Form

This is the full journey from the moment you click **"Run Compliance Screen"** or **"Execute On-Chain Deposit"** in the UI, to the final on-chain settlement. Nothing is skipped.

---

### Phase 0 — You Enter the Inputs

In the frontend (`ScreenForm.tsx` or `TransactionStepper.tsx`) you fill in three fields:

| Field | Example | What it is |
|---|---|---|
| **Institution Address** | `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` | The Ethereum wallet seeking to deposit |
| **Deposit Amount** | `50000` | Amount in USDC (human-readable, not raw 6-decimal) |
| **Private Key** | `0x0434...` | The institution's wallet signing key (only used for deposit, never stored) |

The hint pills (e.g. "0x000 → BLOCKED") pre-fill the address field with test patterns so you can demonstrate different compliance outcomes instantly.

---

### Phase 1 — Compliance Screening (HTTP POST to CRE)

Clicking **"Run Compliance Screen"** triggers:

```
POST http://localhost:4000/api/v1/compliance/screen
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "amount": 50000
}
```

**Inside the CRE — `index.ts` route handler:**

#### Step 1.1 — Audit Log Created (Instant)

An in-memory `AuditLog` record is created immediately and pushed to `pendingQueue[]`:
```typescript
{
  id:        "log_1709394287123",
  timestamp: "2026-03-02T16:19:13.000Z",
  subject:   "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  did:       null,       // not yet resolved
  amount:    "50000",
  amlStatus: "PENDING",
  riskScore: null,
  alerts:    [],
  status:    "PENDING"
}
```

This entry is visible immediately in the frontend's **Queue tab** — before any network calls are made.

#### Step 1.2 — DID Resolution (On-Chain Read via eth_call)

The CRE calls `DIDResolver.resolve(address)` which issues an `eth_call` to the Tenderly fork:

```
eth_call → DIDRegistry.resolve("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
```

The contract does a mapping lookup `_documents[address]` and returns:
```typescript
{
  did:             "did:zk:0x742d35cc6634c0532925a3b844bc454e4438f44e",
  documentHash:    "0x4a3b...",
  serviceEndpoint: "https://cre.example.com/did",
  registeredAt:    1709394100n,
  updatedAt:       1709394100n,
  active:          true
}
```

If the address is not registered, `did` stays `null` in the log. The vault will reject unregistered depositors on-chain — the CRE surfaces this early as an informational hint only.

#### Step 1.3 — AML Screening (AI Oracle or Mock Fallback)

**Path A — AI Oracle (when `ETHERSCAN_API_KEY` + `GEMINI_API_KEY` are set):**

The CRE calls `AIAmlAdapter.screenAddress(address, amount)`:

```
① GET https://api.etherscan.io/api?module=account&action=txlist
              &address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e
              &apikey=YOUR_KEY
   → returns last 50 transactions (timestamp, counterparty, value, method)

② GET https://api.etherscan.io/api?module=account&action=tokentx
              &address=0x742d35Cc6634C0532925a3b844Bc454e4438f44e
              &apikey=YOUR_KEY
   → returns last 50 ERC-20 token transfers

③ POST https://generativelanguage.googleapis.com/...
   Body: structured prompt with transaction summary, counterparties, protocol tags
   → Gemini returns: riskScore, status, alerts[], narrative
```

Gemini AI response:
```json
{
  "status":    "CLEARED",
  "riskScore": 12,
  "alerts":    [],
  "narrative": "This wallet has 47 transactions over 6 months, primarily interacting with Uniswap V3 and Aave V2. No mixer interactions detected. Risk assessment: LOW.",
  "provider":  "ai-oracle"
}
```

**Path B — Mock AML (fallback, no API keys needed):**

```
GET http://localhost:4001/v1/address/0x742d35Cc6634C0532925a3b844Bc454e4438f44e/risk?amount=50000
→ { "status": "CLEARED", "riskScore": 7, "alerts": [], "provider": "mock-aml" }
```

**Back in the CRE adapter — report hashing (applies to both paths):**

The adapter builds a deterministic report string from the response:
```json
{
  "address":   "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "status":    "CLEARED",
  "riskScore": 12,
  "alerts":    [],
  "checkedAt": "2026-03-02T16:19:13.123Z",
  "provider":  "ai-oracle"
}
```

Then computes:
```
reportHash = keccak256(utf8Bytes(JSON.stringify(report)))
```

This `bytes32` hash is the **only** representation of the AML report that will ever touch the blockchain. The full report — including the AI narrative — stays on the CRE server.

#### Step 1.4 — Blocked / High Risk Path

If `status === "BLOCKED"` or `"HIGH_RISK"`:
- Audit log updated: `amlStatus = "BLOCKED"`, `status = "BLOCKED"`
- Entry removed from `pendingQueue`
- CRE responds HTTP **403**:
```json
{
  "logId":       "log_1709394287123",
  "status":      "BLOCKED",
  "amlProvider": "mock-aml",
  "riskScore":   100,
  "alerts":      ["OFAC_SANCTIONS_MATCH", "HIGH_RISK_ENTITY"]
}
```
No attestation is created. No signature is produced. The flow ends here.

#### Step 1.5 — Cleared Path: EIP-712 Attestation Signing

If `status === "CLEARED"`, `AttestationSigner.sign()` is called:

```typescript
const ttlSeconds = 900; // 15 minutes
const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
const nonce  = BigInt("0x" + crypto.randomBytes(16).toString("hex"));

const attestation = {
  subject:       "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  amlReportHash: "0x4f8b2a...",   // keccak256 of AML report JSON
  expiry:        1709395087n,     // unix timestamp, 15 min from now
  nonce:         72389471928374918273n,  // 128 bits of randomness
  amlProvider:   "mock-aml"
};
```

The signer wallet calls `ethers.signTypedData(domain, types, attestation)` — a deterministic ECDSA signature over the EIP-712 structured hash, producing a 65-byte hex signature (`r + s + v`).

#### Step 1.6 — CRE Response to Frontend

Audit log updated (`amlStatus = "CLEARED"`, `status = "CLEARED"`). HTTP **200**:

```json
{
  "logId":       "log_1709394287123",
  "status":      "CLEARED",
  "did":         "did:zk:0x742d35cc6634c0532925a3b844bc454e4438f44e",
  "amlProvider": "ai-oracle",
  "riskScore":   12,
  "attestation": {
    "subject":       "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "amlReportHash": "0x4f8b2a...",
    "expiry":        1709395087,
    "nonce":         "72389471928374918273",
    "amlProvider":   "ai-oracle"
  },
  "signature":     "0xa3f9...",
  "signerAddress": "0xE0A600Af3bd8A92eF9890859b092572aC7D512D1",
  "aiNarrative":   "This wallet has 47 transactions over 6 months, primarily interacting with Uniswap V3 and Aave V2. No mixer interactions detected. Risk assessment: LOW."
}
```

The frontend shows the full attestation: subject, AML hash, 15-minute expiry countdown, nonce, signature, and — when AI Oracle is active — the **🧠 AI Risk Analysis** card with the Gemini narrative.

---

### Phase 2 — On-Chain Deposit (HTTP POST to CRE)

After reviewing the attestation, you enter your private key and click **"Execute On-Chain Deposit"**:

```
POST http://localhost:4000/api/v1/compliance/deposit
Content-Type: application/json

{
  "address":              "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "amount":               50000,
  "institutionPrivateKey": "0x0434..."
}
```

> **Security note**: In this demo the private key is sent to the local CRE server so it can relay the transaction. In production the institution would sign and submit client-side. Since the CRE runs on `localhost`, the key never leaves the local machine.

**Inside the CRE — deposit route handler:**

#### Step 2.1 — Re-Screen and Re-Sign

The deposit route **repeats the full screening flow** (Steps 1.1–1.5) to produce a fresh attestation with a new nonce and a new expiry. This guarantees:
- The attestation is always within the 15-minute TTL
- The nonce is always unique (replay protection)
- The AML report is always current

#### Step 2.2 — Institution Wallet Created

```typescript
const institutionSigner = new ethers.Wallet(institutionPrivateKey, provider);
```

This wallet object holds the institution's signing capability for the on-chain transaction.

#### Step 2.3 — USDC Allowance Check + Approval

```typescript
const allowance = await usdc.allowance(institution.address, vaultAddress);

if (allowance < amount) {
  const approveTx = await usdc.connect(institution).approve(vaultAddress, amount);
  await approveTx.wait();
}
```

This sends `eth_sendRawTransaction` to Tenderly with the ERC-20 `approve(spender, amount)` calldata. The Tenderly fork processes it against the real mainnet USDC contract state — the vault is now authorised to pull the exact deposit amount.

#### Step 2.4 — Vault Deposit Transaction

```typescript
const attestationTuple = [
  attestation.subject,        // address  — who is being attested
  attestation.amlReportHash,  // bytes32  — commitment to AML report
  attestation.expiry,         // uint256  — expiry unix timestamp
  attestation.nonce,          // uint256  — single-use random number
  attestation.amlProvider     // string   — "mock-aml"
];

const tx = await vault.connect(institution).deposit(
  50000n * 1_000_000n,   // 50,000 USDC in 6-decimal raw units
  attestationTuple,
  signature              // 65-byte EIP-712 signature from CRE
);
const receipt = await tx.wait();
```

**What the EVM executes inside `PermissionedVault.deposit()`, step by step:**

1. **`nonReentrant` lock** — sets re-entrancy guard slot, preventing any recursive calls
2. **`whenNotPaused` check** — reads `paused` storage slot, reverts with `Vault__Paused()` if true
3. **`require(amount > 0)`** — basic sanity check
4. **DID check** — `STATICCALL` to `DIDRegistry.isRegistered(msg.sender)`:
   - Reads `_documents[msg.sender].registeredAt` and `_documents[msg.sender].active`
   - Returns `true` only if both conditions are met
   - Vault reverts if `false`
5. **Attestation verification** — `CALL` to `ComplianceAttestationVerifier.verifyAttestation(attestation, signature, msg.sender)`:
   - `require(attestation.subject == depositor)` — subject must be the caller
   - `require(block.timestamp <= attestation.expiry)` — not expired
   - `require(!usedNonces[subject][nonce])` — nonce not consumed
   - Computes EIP-712 digest:
     ```
     structHash = keccak256(abi.encode(
       TYPEHASH, subject, amlReportHash, expiry, nonce, keccak256(bytes(amlProvider))
     ))
     digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash))
     ```
   - `ECDSA.recover(digest, signature)` → recovers the signing address
   - `require(recovered == creSignerAddress)` — only the authorised CRE signed this
   - **`usedNonces[subject][nonce] = true`** — atomically burns the nonce
   - `emit AttestationVerified(subject, amlReportHash, nonce, amlProvider)`
6. **Token pull** — `SafeERC20.safeTransferFrom(msg.sender, address(this), amount)`:
   - Calls USDC's `transferFrom` — moves 50,000 USDC from institution to vault
   - `SafeERC20` wrapper handles non-standard ERC-20 return values safely
7. **Balance update** — `balances[msg.sender] += amount`, `totalDeposits += amount`
8. **Event** — `emit Deposit(msg.sender, amount, attestation.amlReportHash, did)`

#### Step 2.5 — Settlement Result

CRE reads receipt, updates audit log to `SETTLED`, responds HTTP **200**:

```json
{
  "logId":        "log_1709394287456",
  "status":       "SETTLED",
  "txHash":       "0xabc123...",
  "blockNumber":  19442000,
  "gasUsed":      "187432",
  "vaultBalance": "50000.000000"
}
```

The frontend success screen shows a Tenderly dashboard link — click it to inspect every internal call, state change, event, and storage slot modification in the transaction.

---

## 7. The EIP-712 Attestation Explained

EIP-712 is the Ethereum standard for structured data signing. It solves a critical problem: raw `eth_sign` produces a signature over arbitrary bytes with no human-readable context — making it vulnerable to phishing. EIP-712 adds:

1. A **domain separator** — ties the signature to a specific contract on a specific chain (cannot be replayed on another chain or contract)
2. A **type hash** — ties the signature to a specific struct definition (cannot be reinterpreted as a different message)
3. **Human-readable fields** — wallets display "You are signing: ComplianceAttestation for subject 0x742d..."

### The Full Digest Computation

```
digest = keccak256(
  "\x19\x01"           ← EIP-712 prefix (2 bytes)
  || domainSeparator   ← keccak256 of domain struct
  || structHash        ← keccak256 of attestation fields
)

domainSeparator = keccak256(abi.encode(
  keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
  keccak256("ComplianceAttestationVerifier"),
  keccak256("1"),
  1,                                                     ← chainId
  0xC5fa799a9b4afcAC37cC4742E17e79f49FB97Fc8            ← verifier address
))

structHash = keccak256(abi.encode(
  ATTESTATION_TYPEHASH,          ← keccak256 of type string
  subject,                       ← address (32 bytes)
  amlReportHash,                 ← bytes32
  expiry,                        ← uint256
  nonce,                         ← uint256
  keccak256(bytes(amlProvider))  ← dynamic string must be hashed first
))
```

The resulting `digest` is signed with `secp256k1` using the CRE's private key. On-chain, `ECDSA.recover(digest, signature)` recovers the public key's address and confirms it equals `creSignerAddress`.

### Why This Is Unbreakable Without the CRE Key

- **Chain binding**: Domain includes `chainId = 1` and `verifyingContract`. A signature for this deployment cannot be replayed on Polygon or a different verifier.
- **Nonce**: 128-bit random number, consumed atomically. Replay attack reverts immediately.
- **Expiry**: 15-minute TTL. A stolen attestation is useless after the window.
- **Subject binding**: `attestation.subject == msg.sender` enforced on-chain. One institution cannot use another's clearance.

---

## 8. The ZK Privacy Model

The name "Zero-Knowledge" refers to the **data minimisation** privacy property — not ZK-SNARKs. The system achieves the cryptographic minimum: the blockchain proves that screening occurred and was approved, without revealing what the screening found.

### What the Blockchain Sees vs What It Does Not

| Data | On-Chain? | Notes |
|---|---|---|
| Institution wallet address | ✅ Yes | Required for tx |
| Deposit amount (USDC) | ✅ Yes | In `Deposit` event |
| AML report hash (`bytes32`) | ✅ Yes | Commitment proving screening occurred |
| AML provider name | ✅ Yes | "mock-aml" or "chainalysis" |
| CRE signer address | ✅ Yes | Public key — not a secret |
| DID string | ✅ Yes | In `Deposit` event |
| Full AML report JSON | ❌ Never | Lives on CRE server only |
| Risk score (number) | ❌ Never | Off-chain only |
| Specific alert types | ❌ Never | Off-chain only |
| Institution legal name / KYC docs | ❌ Never | Never enters this system |

### The Commitment Scheme (How Regulators Audit It)

The `amlReportHash` is a cryptographic commitment:
```
amlReportHash = keccak256(utf8Bytes(JSON.stringify({
  address:   "0x742d...",
  status:    "CLEARED",
  riskScore: 7,
  alerts:    [],
  checkedAt: "2026-03-02T...",
  provider:  "mock-aml"
})))
```

A regulator with access to the CRE's audit log can verify that a specific on-chain deposit corresponds to a specific AML screening: they re-compute the hash from the stored report and confirm it matches the on-chain `amlReportHash` from the `Deposit` event. A blockchain observer cannot reverse the hash to learn the report contents.

---

## 9. Compliance Screening Rules

### Adapter Priority

| Priority | Adapter | Activated by |
|---|---|---|
| 1 (highest) | **AI Oracle** | `ETHERSCAN_API_KEY` + `GEMINI_API_KEY` both set |
| 2 | **Chainalysis KYT** | `CHAINALYSIS_API_KEY` set |
| 3 (fallback) | **Mock AML** | No keys configured |

### AI Oracle Rules (static pre-filters applied before Gemini)

| Condition | Status | Risk Score | Alerts |
|---|---|---|---|
| Address starts with `0x000` | `BLOCKED` | 100 | `OFAC_SANCTIONS_MATCH`, `HIGH_RISK_ENTITY` |
| Address contains `dead` or `beef` | `HIGH_RISK` | 75 | `MIXER_INTERACTION`, `DARKNET_MARKET_EXPOSURE` |
| Amount > 10,000,000 USDC | Upgrades to `HIGH_RISK` | — | `LARGE_TRANSACTION_THRESHOLD_EXCEEDED` |
| All other addresses | Analysed by **Gemini AI** | 0–100 (AI-determined) | AI-detected |

### Mock AML Rules (applied in order, fallback only)

| Condition | Status | Risk Score | Alerts |
|---|---|---|---|
| Address starts with `0x000` | `BLOCKED` | 100 | `OFAC_SANCTIONS_MATCH`, `HIGH_RISK_ENTITY` |
| Address contains `dead` or `beef` | `HIGH_RISK` | 75 | `MIXER_INTERACTION`, `DARKNET_MARKET_EXPOSURE` |
| Amount > 10,000,000 USDC | Upgrades to `HIGH_RISK` (if was CLEARED) | — | `LARGE_TRANSACTION_THRESHOLD_EXCEEDED` |
| All other addresses | `CLEARED` | 0–14 (random) | None |

### Test Addresses for Each Scenario

| Address | Expected Result | Demo Reason |
|---|---|---|
| `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` | ✅ CLEARED | Clean institutional wallet |
| `0x0000000000000000000000000000000000000001` | 🔴 BLOCKED | OFAC sanctions match |
| `0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef` | 🟡 HIGH_RISK | Mixer / darknet exposure |
| Any clean address, amount `15000000` | 🟡 HIGH_RISK | Over $10M threshold |

---

## 10. What the Frontend Shows

The frontend at `http://localhost:3000` has four tabs:

### Dashboard Tab — AI Oracle Integration

When `amlProvider === "ai-oracle"`, additional UI elements appear:
- **🧠 AI Risk Analysis card** (purple) displayed after the screening result badge in the ScreenForm
- **🧠 AI Risk Analysis section** inside the TransactionStepper attestation review step
- **🧠 icon** on AI-screened rows in the AML Logs table (tooltip with full narrative)

### Dashboard Tab
- **Hero Stats** (top row): Total vault deposits (animated count-up), addresses cleared today, in AML queue, blocked today — all live-polling
- **Transaction Stepper** (left panel): 5-step wizard — Input → Screening → Attestation Review → Execute → Settled
- **Live Feed** (right panel): Real-time stream of all compliance events with colour-coded status bars

### AML Logs Tab
Full audit table: Time, Subject/DID, Amount, AML Status, Risk Score, Alerts, Settlement Status, Tx Hash link (→ Tenderly).

### Vault Tab
Architecture flow diagram (Institution → CRE → AML → EIP-712 → Vault → Tenderly Fork). Live vault stats. Contract addresses. Privacy model explanation with badge tags.

### Queue Tab
In-flight transactions between submission and settlement. Animated shimmer progress bars show activity.

### Polling Intervals (Conservative to Protect Tenderly Quota)

| Component | Endpoint | Interval |
|---|---|---|
| App header | `/health` | 10s |
| HeroStats vault balance | `/api/v1/vault/stats` | 60s |
| HeroStats log counts | `/api/v1/compliance/logs` | 10s |
| HeroStats queue count | `/api/v1/compliance/queue` | 5s |
| LiveFeed | `/api/v1/compliance/logs` | 8s |
| AMLLogs table | `/api/v1/compliance/logs` | 10s |
| PendingQueue | `/api/v1/compliance/queue` | 5s |
| VaultStats page | `/api/v1/vault/stats` | 60s |

---

## 11. Running the Demo

### Enable AI Oracle (Recommended)

Before starting, set API keys in `.env` to activate Gemini AI analysis:

```bash
# Free keys:
# - Etherscan: https://etherscan.io/myapikey
# - Gemini: https://aistudio.google.com/apikey
ETHERSCAN_API_KEY=your_etherscan_key
GEMINI_API_KEY=your_gemini_key
```

The CRE auto-detects these on startup and logs:
```
🧠 AI Compliance Oracle active (Etherscan + Gemini)
```

Without keys:
```
🟡 Using Mock AML server (set ETHERSCAN_API_KEY + GEMINI_API_KEY for AI Oracle)
```

### Start All Services

```bash
# Kill any processes on required ports and start clean
fuser -k 3000/tcp 4000/tcp 4001/tcp 2>/dev/null || true

# Start Mock AML (port 4001) + CRE Engine (port 4000) together
npm run dev

# In a separate terminal: Frontend (port 3000)
cd packages/frontend && npx vite --port 3000

# Verify all three are healthy
curl -s http://localhost:4000/health | jq
curl -s http://localhost:4001/health | jq
```

### Automated 6-Scenario Demo

```bash
npm run demo
```

Walks through 6 scenarios with formatted console output — CLEARED deposits go all the way to on-chain settlement, BLOCKED/HIGH_RISK show the rejection response with alerts.

| # | Scenario | Address | Amount | Action |
|---|---|---|---|---|
| 1 | Tier-1 Institution | Deployer | 50,000 USDC | Full deposit → SETTLED |
| 2 | Mid-Market Fund | `0x742d...` | 25,000 USDC | Screen → CLEARED |
| 3 | OFAC Sanctioned | `0x000...1` | 100,000 USDC | Screen → BLOCKED |
| 4 | Tornado Cash | `0xdead...beef` | 50,000 USDC | Screen → HIGH_RISK |
| 5 | Suspicious Whale | `0x1234...` | 15,000,000 USDC | Screen → HIGH_RISK |
| 6 | Second Deposit | Deployer | 25,000 USDC | Full deposit → SETTLED |

### Manual API Walkthrough

```bash
# Screen a clean address
curl -s -X POST http://localhost:4000/api/v1/compliance/screen \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc454e4438f44e","amount":50000}' | jq

# Screen an OFAC-blocked address
curl -s -X POST http://localhost:4000/api/v1/compliance/screen \
  -H "Content-Type: application/json" \
  -d '{"address":"0x0000000000000000000000000000000000000001","amount":100000}' | jq

# Screen a mixer address
curl -s -X POST http://localhost:4000/api/v1/compliance/screen \
  -H "Content-Type: application/json" \
  -d '{"address":"0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef","amount":50000}' | jq

# Full deposit (replace with your DEPLOYER_PRIVATE_KEY from .env)
curl -s -X POST http://localhost:4000/api/v1/compliance/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "address":"0xE8A457Ce1Ab8659a6410474dB5f1c6b070b98372",
    "amount":50000,
    "institutionPrivateKey":"YOUR_DEPLOYER_PRIVATE_KEY"
  }' | jq

# View audit log
curl -s http://localhost:4000/api/v1/compliance/logs | jq

# View vault stats
curl -s http://localhost:4000/api/v1/vault/stats | jq
```

---

## 12. Integration Test Walkthrough

```bash
npm run integration:test
```

The test suite runs 13 automated tests proving the complete flow:

| # | Test | What It Proves |
|---|---|---|
| 1 | CRE health check | CRE is live |
| 2 | Mock AML health check | AML server is live |
| 3 | DID registration | Institution anchors identity on-chain |
| 4 | DID resolution | Registered DID reads back from blockchain |
| 5 | AML screen — CLEARED | Compliant wallets are approved |
| 6 | AML screen — BLOCKED | Sanctioned wallets are rejected |
| 7 | Attestation valid on-chain | EIP-712 signature verifies against the contract |
| 8 | Vault deposit succeeds | Full happy path: DID ✓ + attestation ✓ + USDC transfer ✓ |
| 9 | Deposit without attestation reverts | Contract-level enforcement — not just API logic |
| 10 | Replay attack reverts | Nonce reuse rejected on-chain |
| 11 | Audit log API | Full history is queryable |
| 12 | Queue API | In-flight queue is queryable |
| 13 | Vault stats API | Dashboard data is queryable |

**Test 9** is critical: it proves that even if someone bypasses the CRE entirely and calls `PermissionedVault.deposit()` directly with a zeroed attestation, the transaction reverts. Security lives in the smart contract, not just the API.

**Test 10** is equally important: it proves that a stolen or re-used attestation signature causes an immediate `CALL_EXCEPTION`. The nonce was burned on first use — no second attempt can succeed.

---

## 13. Security Properties

| Property | Mechanism | Enforced At |
|---|---|---|
| Only AML-cleared wallets deposit | ECDSA attestation verification | Smart contract |
| Only DID-registered wallets deposit | `isRegistered()` check | Smart contract |
| Attestations expire in 15 minutes | `expiry` vs `block.timestamp` | Smart contract |
| No replay attacks | Single-use nonce mapping | Smart contract |
| No cross-institution spoofing | `subject == msg.sender` | Smart contract |
| No cross-chain replay | ChainId in EIP-712 domain | Smart contract |
| No cross-contract replay | Verifier address in EIP-712 domain | Smart contract |
| CRE key stays off-chain | `.cre-signer.key` chmod 0600 | CRE filesystem |
| No PII on-chain | Only keccak256 hash stored | Architecture |
| Emergency stop | `pause()` / `unpause()` owner-only | Smart contract |
| Reentrancy protection | `nonReentrant` modifier | Smart contract |
| Safe token handling | OpenZeppelin `SafeERC20` | Smart contract |

---

## 14. Production vs Demo Differences

| Aspect | Demo | Production |
|---|---|---|
| AML Provider (primary) | **AI Oracle** — Etherscan + Gemini AI (when keys set) | Real Chainalysis KYT or proprietary AI model |
| AML Provider (fallback) | Mock server (localhost:4001) | N/A — production always has keys |
| Network | Tenderly Virtual Sepolia (`chainId: 11155111`) | Ethereum mainnet / L2 |
| Private key handling | Sent to local CRE | Institution signs locally, submits own tx |
| DID registration | Manual / test script | Institutional onboarding flow |
| CRE deployment | Single process (localhost) | HSM-secured enclave, multi-region |
| USDC funding | `tenderly_setErc20Balance` RPC | Real USDC |
| Audit log storage | In-memory (resets on restart) | Persistent encrypted database |
| Key rotation | Manual `.env` update + redeploy | Automated key management |
| CRE signer key storage | File (`chmod 0600`) | Hardware Security Module (HSM) |
| Attestation TTL | 15 minutes (configurable) | Set by compliance policy |

**To switch from mock to real Chainalysis — zero code changes:**
```bash
# Add to .env:
CHAINALYSIS_API_KEY=your_key_here
# Restart CRE — auto-detects and switches adapters on startup
```

---

*Generated: 2026-03-02 | Attestara v1.0.0*
