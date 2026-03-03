// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ComplianceAttestationVerifier.sol";
import "./DIDRegistry.sol";

/**
 * @title PermissionedVault
 * @notice Institutional-grade ERC-4626-style vault that enforces CRE compliance attestations
 *         before accepting deposits. Models Aave Arc's whitelist pattern.
 *
 * Architecture:
 *   - Any deposit MUST be accompanied by a valid ComplianceAttestation signed by the CRE.
 *   - The CRE acts as a middleware firewall: it intercepts the intent, runs AML/KYC off-chain,
 *     and only signs the attestation if the user is CLEARED.
 *   - No PII hits the chain. Only a hash of the AML report is committed.
 *   - The depositor must also have a registered DID in the DIDRegistry.
 *
 * Aave Arc Analogy:
 *   - Aave Arc uses a PermissionManager whitelist.
 *   - This vault replaces that whitelist with a dynamic per-transaction attestation check,
 *     making it impossible to deposit without real-time AML clearance.
 */
contract PermissionedVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Immutables & State
    // ─────────────────────────────────────────────────────────────────────────

    IERC20 public immutable asset;                          // Underlying token (e.g. USDC)
    ComplianceAttestationVerifier public immutable verifier;
    DIDRegistry public immutable didRegistry;

    mapping(address => uint256) public balances;           // Depositor → share balance
    uint256 public totalDeposits;

    bool public paused;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Deposit(
        address indexed depositor,
        uint256         amount,
        bytes32         amlReportHash,
        string          did
    );

    event Withdrawal(
        address indexed withdrawer,
        uint256         amount
    );

    event VaultPaused(address indexed by);
    event VaultUnpaused(address indexed by);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error Vault__Paused();
    error Vault__ZeroAmount();
    error Vault__InsufficientBalance(uint256 available, uint256 requested);
    error Vault__DIDNotRegistered(address depositor);
    error Vault__TransferFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _asset,
        address _verifier,
        address _didRegistry
    ) Ownable(msg.sender) {
        asset       = IERC20(_asset);
        verifier    = ComplianceAttestationVerifier(_verifier);
        didRegistry = DIDRegistry(_didRegistry);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert Vault__Paused();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Deposit
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit tokens into the vault.
     * @dev    Requires a valid CRE-signed ComplianceAttestation. Reverts without one.
     *         The attestation is verified and nonce consumed atomically with the deposit.
     *
     * @param amount       Amount of `asset` tokens to deposit (must be approved first).
     * @param attestation  CRE-signed compliance attestation for this depositor.
     * @param signature    65-byte ECDSA signature over the attestation (EIP-712).
     */
    function deposit(
        uint256 amount,
        ComplianceAttestationVerifier.ComplianceAttestation calldata attestation,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert Vault__ZeroAmount();

        // ── 1. DID check: depositor must be registered ────────────────────────
        if (!didRegistry.isRegistered(msg.sender)) {
            revert Vault__DIDNotRegistered(msg.sender);
        }

        // ── 2. Compliance check: verifyAttestation reverts on any failure ─────
        //       This call also consumes the nonce, preventing replay.
        verifier.verifyAttestation(attestation, signature, msg.sender);

        // ── 3. Pull tokens from depositor ─────────────────────────────────────
        asset.safeTransferFrom(msg.sender, address(this), amount);

        // ── 4. Credit balance ─────────────────────────────────────────────────
        balances[msg.sender] += amount;
        totalDeposits        += amount;

        // ── 5. Resolve DID string for event (read-only, no gas concern) ───────
        DIDRegistry.DIDDocument memory doc = didRegistry.resolve(msg.sender);

        emit Deposit(msg.sender, amount, attestation.amlReportHash, doc.did);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Withdraw
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Withdraw previously deposited tokens.
     * @dev    Withdrawal does NOT require a new attestation — the user is already whitelisted
     *         by virtue of having successfully deposited. This mirrors Aave Arc behavior.
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert Vault__ZeroAmount();

        uint256 available = balances[msg.sender];
        if (amount > available) revert Vault__InsufficientBalance(available, amount);

        balances[msg.sender] -= amount;
        totalDeposits        -= amount;

        asset.safeTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        paused = true;
        emit VaultPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit VaultUnpaused(msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────────

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}
