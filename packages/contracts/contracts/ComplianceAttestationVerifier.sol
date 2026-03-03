// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ComplianceAttestationVerifier
 * @notice Verifies EIP-712 signed attestations produced by the off-chain CRE (Compliance & Routing Engine).
 *
 * Flow:
 *   1. Institution submits deposit intent to CRE.
 *   2. CRE queries AML provider → receives CLEARED.
 *   3. CRE signs a ComplianceAttestation struct with its private key (EIP-712).
 *   4. Institution submits the signed attestation + deposit tx to PermissionedVault.
 *   5. PermissionedVault calls verifyAttestation() here — reverts if invalid.
 *
 * Privacy: No PII is stored on-chain. Only a hash of the AML report, the subject address,
 *          the expiry, and the CRE signature are committed.
 */
contract ComplianceAttestationVerifier is EIP712, Ownable {
    using ECDSA for bytes32;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct ComplianceAttestation {
        address subject;        // Institution wallet being attested
        bytes32 amlReportHash;  // keccak256 of the off-chain AML report (never stored in plaintext)
        uint256 expiry;         // Unix timestamp — attestation is valid until this time
        uint256 nonce;          // Prevents replay attacks
        string  amlProvider;    // e.g. "mock-aml" or "chainalysis"
    }

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "ComplianceAttestation(address subject,bytes32 amlReportHash,uint256 expiry,uint256 nonce,string amlProvider)"
    );

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// The CRE's authorized signing address — only signatures from this key are valid
    address public creSignerAddress;

    /// Tracks used nonces per subject to prevent replay
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    /// Attestation validity window (seconds) — default 15 minutes
    uint256 public constant MAX_ATTESTATION_AGE = 15 minutes;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AttestationVerified(
        address indexed subject,
        bytes32         amlReportHash,
        uint256         nonce,
        string          amlProvider
    );

    event CRESignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error Attestation__Expired(uint256 expiry, uint256 currentTime);
    error Attestation__InvalidSigner(address recovered, address expected);
    error Attestation__NonceUsed(address subject, uint256 nonce);
    error Attestation__SubjectMismatch(address subject, address caller);
    error Attestation__ZeroAddress();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _creSignerAddress)
        EIP712("ComplianceAttestationVerifier", "1")
        Ownable(msg.sender)
    {
        if (_creSignerAddress == address(0)) revert Attestation__ZeroAddress();
        creSignerAddress = _creSignerAddress;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // External
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Verify a CRE-signed compliance attestation.
     * @dev    Called by PermissionedVault before processing any deposit.
     *         Reverts on any failure — all-or-nothing verification.
     * @param attestation  The structured attestation data.
     * @param signature    65-byte ECDSA signature from the CRE signer.
     */
    function verifyAttestation(
        ComplianceAttestation calldata attestation,
        bytes calldata signature,
        address depositor
    ) external {
        // 1. Subject must match the actual depositor (passed by the vault)
        if (attestation.subject != depositor) {
            revert Attestation__SubjectMismatch(attestation.subject, depositor);
        }

        // 2. Attestation must not be expired
        if (block.timestamp > attestation.expiry) {
            revert Attestation__Expired(attestation.expiry, block.timestamp);
        }

        // 3. Nonce must not have been used
        if (usedNonces[attestation.subject][attestation.nonce]) {
            revert Attestation__NonceUsed(attestation.subject, attestation.nonce);
        }

        // 4. Recover signer and verify it matches the authorized CRE key
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            attestation.subject,
            attestation.amlReportHash,
            attestation.expiry,
            attestation.nonce,
            keccak256(bytes(attestation.amlProvider))
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);

        if (recovered != creSignerAddress) {
            revert Attestation__InvalidSigner(recovered, creSignerAddress);
        }

        // 5. Mark nonce as used (prevents replay)
        usedNonces[attestation.subject][attestation.nonce] = true;

        emit AttestationVerified(
            attestation.subject,
            attestation.amlReportHash,
            attestation.nonce,
            attestation.amlProvider
        );
    }

    /**
     * @notice Read-only version for frontend — does NOT mark nonce as used.
     *         Use to pre-validate before submitting tx.
     */
    function isAttestationValid(
        ComplianceAttestation calldata attestation,
        bytes calldata signature
    ) external view returns (bool valid, string memory reason) {
        if (block.timestamp > attestation.expiry) return (false, "EXPIRED");
        if (usedNonces[attestation.subject][attestation.nonce]) return (false, "NONCE_USED");

        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            attestation.subject,
            attestation.amlReportHash,
            attestation.expiry,
            attestation.nonce,
            keccak256(bytes(attestation.amlProvider))
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);

        if (recovered != creSignerAddress) return (false, "INVALID_SIGNATURE");

        return (true, "VALID");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Rotate the CRE signer key (e.g. after key compromise or scheduled rotation).
     */
    function updateCRESigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert Attestation__ZeroAddress();
        address old = creSignerAddress;
        creSignerAddress = newSigner;
        emit CRESignerUpdated(old, newSigner);
    }

    /**
     * @notice Returns the EIP-712 domain separator for off-chain signing.
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
