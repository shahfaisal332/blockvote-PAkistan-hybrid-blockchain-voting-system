// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * title  VoteLogger
 * notice Hybrid integrity layer for BlockVote Pakistan.
 *         Stores only vote hashes on-chain.
 *         Full vote records stay in MySQL database.
 *         Only the backend relayer (admin wallet) can log hashes.
 *         Anyone in the world can verify a hash for free.
 * author Shah Faisal — Abdul Wali Khan University Mardan
 */
contract VoteLogger {

    // ── State Variables ──────────────────────────────────────

    /// notice Address of the wallet that deployed this contract
    /// dev    Only this address can call logVote and logBatch
    address public immutable relayer;

    /// notice Maps each vote hash to its existence (true = logged)
    mapping(bytes32 => bool) public hashExists;

    /// notice Array of all logged hashes in order
    bytes32[] public allHashes;

    /// notice Total number of batch operations performed
    uint256 public batchCount;

    /// notice Maps batch ID to the hashes in that batch
    mapping(uint256 => bytes32[]) public batches;

    // ── Events ───────────────────────────────────────────────

    /// notice Emitted when a single vote hash is logged
    event HashLogged(bytes32 indexed voteHash, uint256 timestamp);

    /// notice Emitted when a batch of vote hashes is logged
    event BatchLogged(uint256 indexed batchId, uint256 count, uint256 timestamp);

    // ── Modifier ─────────────────────────────────────────────

    /// notice Restricts function to relayer wallet only
    modifier onlyRelayer() {
        require(msg.sender == relayer, "VoteLogger: only relayer can call this");
        _;
    }

    // ── Constructor ──────────────────────────────────────────

    /**
     * notice Sets the deployer as the permanent relayer
     * dev    Called once when contract is deployed on Sepolia
     */
    constructor() {
        relayer = msg.sender;
    }

    // ── Write Functions (onlyRelayer) ─────────────────────────

    /**
     * notice Log a single vote hash to the blockchain
     * dev    Reverts if hash was already logged (no duplicates)
     * param  _hash  The keccak256 vote hash from the backend
     *
     * Gas cost: approximately 45,000 gas per call
     *
     * How hash is generated in backend (blockchain.js):
     * keccak256(voterCNIC + candidateID + groupID + timestamp)
     */
    function logVote(bytes32 _hash) external onlyRelayer {
        require(!hashExists[_hash], "VoteLogger: hash already logged");

        hashExists[_hash] = true;
        allHashes.push(_hash);

        emit HashLogged(_hash, block.timestamp);
    }

    /**
     * notice Log multiple vote hashes in a single transaction
     * dev    Saves approximately 45% gas compared to individual calls
     *         Maximum 50 hashes per batch to stay within gas limits
     * param  _hashes  Array of keccak256 vote hashes
     *
     * Gas cost: approximately 24,800 gas per hash in batch
     */
    function logBatch(bytes32[] calldata _hashes) external onlyRelayer {
        require(_hashes.length > 0,  "VoteLogger: empty batch not allowed");
        require(_hashes.length <= 50, "VoteLogger: max 50 hashes per batch");

        uint256 batchId = ++batchCount;

        for (uint256 i = 0; i < _hashes.length; i++) {
            require(!hashExists[_hashes[i]], "VoteLogger: duplicate hash in batch");

            hashExists[_hashes[i]] = true;
            allHashes.push(_hashes[i]);
            batches[batchId].push(_hashes[i]);

            emit HashLogged(_hashes[i], block.timestamp);
        }

        emit BatchLogged(batchId, _hashes.length, block.timestamp);
    }

    // ── Read Functions (public, completely free) ───────────────

    /**
     * notice Verify whether a single vote hash exists on blockchain
     * dev    FREE to call — view function uses no gas
     *         Returns true  = vote hash is on blockchain (not tampered)
     *         Returns false = hash not found (possible tampering)
     * param  _hash  The vote hash to check
     * return bool   true if hash exists, false if not
     *
     * How to use in Remix IDE:
     * 1. Load contract at deployed address
     * 2. Paste vote_hash from MySQL into the verifyVote input
     * 3. Click verifyVote button
     * 4. true = vote is verified on blockchain
     */
    function verifyVote(bytes32 _hash) external view returns (bool) {
        return hashExists[_hash];
    }

    /**
     * notice Verify multiple vote hashes in one call
     * dev    FREE to call — useful for bulk audit operations
     * param  _hashes  Array of vote hashes to verify
     * return results  Array of booleans matching each hash
     */
    function verifyBatch(bytes32[] calldata _hashes)
        external
        view
        returns (bool[] memory results)
    {
        results = new bool[](_hashes.length);
        for (uint256 i = 0; i < _hashes.length; i++) {
            results[i] = hashExists[_hashes[i]];
        }
    }

    /**
     * notice Get total number of vote hashes logged on blockchain
     * dev    FREE to call
     *         Should match number of rows with tx_hash in MySQL
     * return uint256  Total count of logged hashes
     */
    function totalVotes() external view returns (uint256) {
        return allHashes.length;
    }

    /**
     * notice Get a slice of all logged hashes (paginated)
     * dev    FREE to call — use for bulk audit export
     * param  from   Starting index (0-based)
     * param  count  Number of hashes to return
     * return Array of vote hashes from index 'from' to 'from + count'
     *
     * Example: getHashes(0, 50) returns first 50 hashes
     */
    function getHashes(uint256 from, uint256 count)
        external
        view
        returns (bytes32[] memory)
    {
        uint256 end = from + count;
        if (end > allHashes.length) {
            end = allHashes.length;
        }

        bytes32[] memory result = new bytes32[](end - from);
        for (uint256 i = from; i < end; i++) {
            result[i - from] = allHashes[i];
        }
        return result;
    }

    /**
     * notice Get all hashes logged in a specific batch
     * dev    FREE to call
     * param  batchId  The batch ID (starts from 1)
     * return Array of hashes in that batch
     */
    function getBatch(uint256 batchId)
        external
        view
        returns (bytes32[] memory)
    {
        return batches[batchId];
    }

    /**
     * notice Get the relayer wallet address
     * dev    FREE to call — useful to confirm which wallet is authorised
     * return address  The relayer wallet address
     */
    function getRelayer() external view returns (address) {
        return relayer;
    }
}
