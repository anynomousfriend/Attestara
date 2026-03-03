// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DIDRegistry
 * @notice On-chain Decentralized Identifier registry.
 *         Maps an Ethereum address to a DID document hash (IPFS CID or keccak hash of the JSON doc).
 *         Institutions register their DID on first interaction; the CRE resolves it before AML check.
 */
contract DIDRegistry {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    struct DIDDocument {
        string  did;           // e.g. "did:ethr:0xABC..."  or  "did:org:blackrock"
        bytes32 documentHash;  // keccak256 of off-chain JSON DID document
        string  serviceEndpoint; // optional: URL to DID document (IPFS / HTTPS)
        uint256 registeredAt;
        uint256 updatedAt;
        bool    active;
    }

    /// address → DID document
    mapping(address => DIDDocument) private _documents;

    /// did string → owner address (for reverse lookup)
    mapping(string => address) private _didToOwner;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event DIDRegistered(
        address indexed owner,
        string  did,
        bytes32 documentHash,
        string  serviceEndpoint
    );

    event DIDUpdated(
        address indexed owner,
        string  did,
        bytes32 newDocumentHash,
        string  newServiceEndpoint
    );

    event DIDDeactivated(address indexed owner, string did);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error DID__AlreadyRegistered(address owner);
    error DID__NotRegistered(address owner);
    error DID__AlreadyTaken(string did);
    error DID__Deactivated(address owner);
    error DID__Unauthorized();

    // ─────────────────────────────────────────────────────────────────────────
    // External functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a DID for msg.sender.
     * @param did              The DID string (must be unique across all owners).
     * @param documentHash     keccak256 of the off-chain DID JSON document.
     * @param serviceEndpoint  Optional URL where the full DID document is hosted.
     */
    function register(
        string calldata did,
        bytes32         documentHash,
        string calldata serviceEndpoint
    ) external {
        if (_documents[msg.sender].registeredAt != 0) {
            revert DID__AlreadyRegistered(msg.sender);
        }
        if (_didToOwner[did] != address(0)) {
            revert DID__AlreadyTaken(did);
        }

        _documents[msg.sender] = DIDDocument({
            did:             did,
            documentHash:    documentHash,
            serviceEndpoint: serviceEndpoint,
            registeredAt:    block.timestamp,
            updatedAt:       block.timestamp,
            active:          true
        });

        _didToOwner[did] = msg.sender;

        emit DIDRegistered(msg.sender, did, documentHash, serviceEndpoint);
    }

    /**
     * @notice Update the document hash and/or service endpoint for an existing DID.
     */
    function update(
        bytes32         newDocumentHash,
        string calldata newServiceEndpoint
    ) external {
        DIDDocument storage doc = _documents[msg.sender];
        if (doc.registeredAt == 0) revert DID__NotRegistered(msg.sender);
        if (!doc.active)           revert DID__Deactivated(msg.sender);

        doc.documentHash    = newDocumentHash;
        doc.serviceEndpoint = newServiceEndpoint;
        doc.updatedAt       = block.timestamp;

        emit DIDUpdated(msg.sender, doc.did, newDocumentHash, newServiceEndpoint);
    }

    /**
     * @notice Deactivate a DID (soft delete — keeps history, marks inactive).
     */
    function deactivate() external {
        DIDDocument storage doc = _documents[msg.sender];
        if (doc.registeredAt == 0) revert DID__NotRegistered(msg.sender);

        doc.active    = false;
        doc.updatedAt = block.timestamp;

        emit DIDDeactivated(msg.sender, doc.did);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    function resolve(address owner) external view returns (DIDDocument memory) {
        return _documents[owner];
    }

    function resolveByDID(string calldata did) external view returns (address owner, DIDDocument memory doc) {
        owner = _didToOwner[did];
        doc   = _documents[owner];
    }

    function isRegistered(address owner) external view returns (bool) {
        return _documents[owner].registeredAt != 0 && _documents[owner].active;
    }
}
