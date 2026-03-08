# 🚀 Attestara: Online Demo & Marketing Script
**Vibe/Tone:** High-octane, visionary, but professional for a screencast. Steve Jobs meets a crypto-native engineer. Unapologetically hyped, but grounded in mind-blowing tech.

---

## 🎬 Act 1: The Hook & The Problem

**(Camera on speaker. Serious, urgent tone.)**

"For the past decade, the traditional financial world has been staring at DeFi through a glass window. Trillions of dollars, sitting on the sidelines. Why? Because of a toxic compromise."

**(Leans in slightly)**

"Regulators demand absolute compliance. Anti-Money Laundering. KYC. But the blockchain demands absolute transparency. If an institution puts their compliance data on a public ledger, they are exposing their clients' most sensitive financial DNA to the world. It’s a privacy nightmare."

"Until today. What if I told you that we have completely eliminated the trade-off? What if you could have military-grade, airtight AML compliance, without ever exposing a single byte of personally identifiable data on-chain?"

**(Starts Screen Share - landing on the Attestara Dashboard)**

"Welcome to **Attestara**. The definitive compliance layer for Institutional DeFi. This isn't an evolution. This is an extinction-level event for the old way of doing things."

---

## 🎬 Act 2: The Core Magic (The "How it Works" Pitch)

**(Mouse hovering over the architecture diagram on the landing page or just speaking while on the dashboard)**

"Attestara is a Compliance & Routing Engine—an off-chain enclave that sits between the trillion-dollar institutions and the blockchain. 

Here is our absolute guarantee: **Zero On-Chain Exposure.** 
We do not put your data on the blockchain. Instead, our engine runs rigorous compliance checks off-chain, and issues an **EIP-712 cryptographic attestation**. The smart contract verifies the *math*, but never sees the *data*. It’s a zero-knowledge paradigm shift."

---

## 🎬 Act 2.5: The Engine Room (CLI & Smart Contracts)

**(Action: Switch screen share from the browser to your Terminal/IDE)**

"While the frontend looks beautiful, the real magic happens right here in the terminal. I'm going to boot up the CRE—our Compliance & Routing Engine."

*(Action: Run the following command in the terminal)*
```bash
npm run dev -w packages/cre
```

"What you are seeing is a lightweight, off-chain Node.js enclave coming to life. It's connecting to Etherscan, initializing the AI Oracle, and linking to the Tenderly simulation engine. 

Let's look under the hood at how this actually works. This is the **Zero-Knowledge Signature Code** running in the CRE:"

*(Action: Bring up the code snippet in your IDE for `packages/cre/src/services/attestationSigner.ts` or just talk through it)*

```typescript
// Off-Chain: The CRE generates the Zero-Knowledge EIP-712 Signature
const signature = await wallet.signTypedData(domain, types, {
    subject: userAddress,
    amlReportHash: keccak256(reportData), // <--- Notice this!
    expiry: Math.floor(Date.now() / 1000) + 900, // 15-minute TTL
    nonce: generateNonce()
});
```

"Notice what we are signing. We aren't signing the user's name or their transaction history. We are signing a cryptographic `keccak256` hash of the AML report, a strict 15-minute expiration timer, and a one-time nonce. That is the EIP-712 payload.

And on the smart contract side, this is all the vault cares about:"

*(Action: Switch to the Solidity snippet for `ComplianceAttestationVerifier.sol`)*

```solidity
// On-Chain: The Smart Contract verifies the CRE's signature
function verifyAttestation(ComplianceAttestation calldata att, bytes calldata signature) external {
    bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
        ATTESTATION_TYPEHASH, att.subject, att.amlReportHash, att.expiry, att.nonce
    )));
    address signer = ECDSA.recover(digest, signature);
    
    if (signer != creSigner) revert Attestation__InvalidSigner();
    if (block.timestamp > att.expiry) revert Attestation__Expired();
    // ... consume nonce to prevent replay attacks
}
```

"The vault natively recovers the signer address using `ECDSA.recover`. If the signature didn't come from our off-chain CRE enclave, the transaction reverts instantly. If it's expired, it reverts. Absolute cryptographic certainty, with zero data leakage. 

Let's see this engine in action."

---

## 🎬 Act 3: The Live Demo (Feature Showcase)

**(Action: Switch screen share back to the Dashboard -> "Transaction Stepper")**

### 🌟 Feature 1: The AI Compliance Oracle (Gemini AI + Etherscan)
"Let's look at a transaction. A human compliance officer takes days to review a wallet's history. Watch what Attestara does."

*(Action: Paste the wallet address and amount into the Transaction Stepper. Click 'Run Compliance Screen')*

"In less than two seconds, we pull the last 50 transactions from Etherscan and feed them into our **Gemini AI Oracle**. It doesn't just give a blind score; it generates a human-readable, intelligent narrative. It detects mixer usage, OFAC sanctions, counterparty risks. It analyzes 50 transactions faster than you can blink."

### 🌟 Feature 2: Tenderly Simulation Pre-Flight (Predicting the Future)
"But what if the deposit fails? What if the attestation expired? In the old world, you pay gas to find out you failed. In the Attestara world, we use **Tenderly's Simulation Engine**."

*(Action: Highlight the Simulation Preview Card that appears after screening)*

"Before a single Wei is spent, we simulate the entire transaction on a Virtual TestNet. If it’s going to revert, we catch it instantly, decode the error in plain English, and stop the transaction. We have completely eradicated wasted gas."

*(Action: Click 'Execute Deposit')*

### 🌟 Feature 3: Time-Travel Auditing
"Regulators don't just care about today; they care about yesterday. Imagine an auditor knocks on your door and asks, *'Was this user compliant 3 months ago when they deposited?'*"

*(Action: Navigate to the 'AML Logs' tab. Click the 'Audit' button next to the recent or historical transaction)*

"Boom. We spin up an ephemeral Tenderly fork, **pinned to the exact block from 3 months ago**. We time-travel. We prove the on-chain state, the DID registration, and the vault balance exactly as it existed at that millisecond. The audit takes three seconds, and then the fork vanishes."

### 🌟 Feature 4: The Kill-Switch (Real-Time Revocation)
"What if a wallet is clean at 1:00 PM, but gets sanctioned at 1:05 PM? Traditional systems are too slow."

*(Action: Navigate to the 'Scenarios' tab, explain or trigger the revocation scenario)*

"Attestara listens to the chain in real-time. If a deposit is detected and the risk profile has changed, our engine fires a real-time revocation. We surgically burn the attestation nonce on-chain *before the transaction can settle*. It is a flawless, automated kill-switch."

### 🌟 Feature 5: The Gas X-Ray
"And for the engineers? We give you x-ray vision into your smart contracts."

*(Action: Navigate to the 'Gas Analysis' tab for the recent deposit)*

"Our Gas Optimization Dashboard decomposes every single transaction trace. You don't just see a total gas fee; you see exactly where every wei is spent down to the specific opcode call tree."

---

## 🎬 Act 4: The Close (Call to Action)

**(Stop screen share, back to camera on speaker)**

"We aren't just giving institutions a permissioned vault. We are handing them the keys to the entire DeFi kingdom, wrapped in an impenetrable shield of privacy and compliance.

We have the AI. We have the cryptographic attestations. We have the Tenderly-powered simulations and time-travel audits. 

The compromise is over. The era of Institutional DeFi begins right now. 

We are Attestara. And we are just getting started."

**(End recording)**

---

## 🛠️ End-to-End Project Setup (From Scratch)

Run these commands in order to get Attestara fully running from a fresh clone.

> **All commands are run from the project root directory (`Attestara/`).**

```bash
# 0. Navigate to the project root
cd Attestara
# 1. Install all dependencies (root + all workspaces)
npm install

# 2. Create a Tenderly Virtual TestNet fork (auto-updates .env with RPC URLs)
npm run fork:setup

# 3. Deploy smart contracts (DIDRegistry, ComplianceAttestationVerifier, PermissionedVault)
npm run deploy

# 4. Start all services concurrently (Mock AML, CRE, Frontend)
npm run dev
```

**After startup, you should see:**
| Service                          | URL                      |
|----------------------------------|--------------------------|
| Mock AML Server                  | http://localhost:4001    |
| CRE (Compliance & Routing Engine)| http://localhost:4000    |
| Frontend (Vite + React)          | http://localhost:3001    |

**Verify:** Open http://localhost:3001 in your browser → you should see the Attestara landing page.

> **Note:** Make sure your `.env` file has valid `ETHERSCAN_API_KEY` and `GEMINI_API_KEY` for AI-powered compliance analysis. Without them, the system falls back to data-driven analysis using Etherscan transaction history.

---

## 📋 Copy-Paste Demo Execution Guide

*Keep this open on a second monitor or notepad to quickly copy-paste during your screencast.*

### 🔄 Pre-Demo Reset (If Tenderly quota is exhausted)
If you hit Tenderly's API quota limit, reset the fork and redeploy:
```bash
# 1. Stop the dev server (Ctrl+C)
# 2. Create a fresh Tenderly fork (auto-updates .env)
npm run fork:setup
# 3. Redeploy contracts to the new fork
npm run deploy
# 4. Restart everything
npm run dev
```

### Step 1: The Engine Room (CLI)
- **Action:** Open terminal and run:
  ```bash
  npm run dev
  ```
- **Action:** Have your IDE open to show the `attestationSigner.ts` and `ComplianceAttestationVerifier.sol` snippets (or use the slides/screen to show the code blocks provided in Act 2.5).

### Step 2: Initial Screen (Browser)
- **Action:** Switch to browser. Start on the **Landing Page** or directly on the **Dashboard (Transaction Stepper)**.
- **Talking Point:** Introduce the privacy vs. compliance problem.

### Step 3: Transaction Stepper (The Core Flow)
- **Target Address (Institution Wallet):** 
  ```text
  0x742d35Cc6634C0532925a3b844Bc454e4438f44e
  ```
- **Deposit Amount (USDC):** 
  ```text
  50000
  ```
- **Action:** Click **"Run Compliance Screen"**
- **Talking Point:** Mention Gemini AI analyzing 50 Etherscan transactions instantly. Highlight the purple AI narrative card that appears.

### Step 4: Simulation & Execution
- **Action:** Wait for the Tenderly Simulation card to appear. Highlight it with your mouse.
- **Talking Point:** Explain that this is a pre-flight check guaranteeing zero wasted gas.
- **Deployer Private Key (paste when prompted):**
  ```text
  0x0434c7ec2fbe666ada097860fe7cf1517371c7c0de46e770c5ed43fce286d5bf
  ```
- **Action:** Click **"Confirm & Enter Private Key"** → paste the key above → click **"Execute →"**
- **Talking Point:** Emphasize that only the EIP-712 signature and hash go on-chain, never the personal data.

### Step 5: Time-Travel Audit (AML Logs)
- **Action:** Go to the **AML Logs** tab. 
- **Action:** Find the transaction you just did (or a historical one) and click the **"Audit"** or **"Time-Travel"** button.
- **Talking Point:** Explain the ephemeral Tenderly fork pinning to the exact historical block.

### Step 6: Gas X-Ray
- **Action:** Go to the **Gas Analysis** tab.
- **Talking Point:** Scroll through the call-tree. Show how every Wei is accounted for.

### Step 7: Adversarial Scenarios (Optional, if time permits)
- **Action:** Go to the **Scenarios** tab.
- **Action:** Click **"Sanctioned Address"** or **"Replay Attack"**.
- **Talking Point:** Show how the system aggressively blocks OFAC addresses or prevents used nonces from being replayed.