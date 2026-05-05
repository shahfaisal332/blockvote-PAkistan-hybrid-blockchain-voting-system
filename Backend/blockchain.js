/**
 * blockchain.js  —  Backend Relayer Service
 *
 * This module handles ALL blockchain interactions.
 * Voters never touch MetaMask. The admin wallet (relayer) pays all gas.
 *
 * How it works:
 *  1. Voter clicks Vote → vote saved to MySQL first
 *  2. Backend generates keccak256 hash (cnic + candidateId + groupId + timestamp)
 *  3. Backend sends hash to blockchain using admin wallet
 *  4. Hash stored in contract — immutable proof vote existed at that moment
 *  5. Anyone can verify later: re-generate hash from MySQL data, check onchain
 */

require("dotenv").config();
const { ethers } = require("ethers");

// ── Contract ABI (only functions we use) ──────────────────
const ABI = [
  "function logVote(bytes32 _hash) external",
  "function logBatch(bytes32[] calldata _hashes) external",
  "function verifyVote(bytes32 _hash) view returns (bool)",
  "function verifyBatch(bytes32[] calldata _hashes) view returns (bool[])",
  "function totalVotes() view returns (uint256)",
  "function hashExists(bytes32) view returns (bool)",
];

// ── Setup provider and wallet ──────────────────────────────
let provider;
let wallet;
let contract;
let initialized = false;

function init() {
  if (initialized) return;

  const rpcUrl         = process.env.RPC_URL;          // e.g. https://sepolia.infura.io/v3/YOUR_KEY
  const privateKey     = process.env.RELAYER_PRIVATE_KEY; // admin wallet private key
  const contractAddr   = process.env.VOTE_LOGGER_ADDRESS; // deployed VoteLogger address

  if (!rpcUrl || !privateKey || !contractAddr) {
    console.warn("⚠️  Blockchain not configured — running in DB-only mode");
    return;
  }

  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
    wallet   = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(contractAddr, ABI, wallet);
    initialized = true;
    console.log("✅ Blockchain relayer ready. Relayer wallet:", wallet.address);
  } catch (e) {
    console.error("❌ Blockchain init failed:", e.message);
  }
}

// ── Generate vote hash ─────────────────────────────────────
/**
 * Generates a deterministic keccak256 hash for a vote.
 * Same inputs always produce the same hash — used for verification.
 *
 * @param {string} voterCnic     - voter's 13-digit CNIC
 * @param {number} candidateId   - candidate ID from database
 * @param {number} groupId       - group ID from database
 * @param {string} timestamp     - ISO timestamp string (stored in DB with vote)
 * @returns {string} hex hash string starting with 0x
 */
function generateVoteHash(voterCnic, candidateId, groupId, timestamp) {
  // Pack all vote data into a single deterministic string
  const packed = ethers.solidityPackedKeccak256(
    ["string", "uint256", "uint256", "string"],
    [
      voterCnic.toString(),
      BigInt(candidateId),
      BigInt(groupId),
      timestamp.toString(),
    ]
  );
  return packed; // returns bytes32 hex string
}

// ── Log single vote to blockchain ──────────────────────────
/**
 * Sends one vote hash to the blockchain.
 * Called immediately after vote is saved to MySQL.
 * If blockchain is down, vote still exists in MySQL (graceful degradation).
 *
 * @param {string} voteHash - from generateVoteHash()
 * @returns {object} { success, txHash, error }
 */
async function logVoteOnChain(voteHash) {
  if (!initialized) {
    console.log("ℹ️  Blockchain not configured, skipping onchain log");
    return { success: false, error: "Blockchain not configured" };
  }

  try {
    // Estimate gas before sending
    const gasEstimate = await contract.logVote.estimateGas(voteHash);

    const tx = await contract.logVote(voteHash, {
      gasLimit: gasEstimate * 120n / 100n, // add 20% buffer
    });

    console.log(`📤 Vote hash sent to blockchain. TxHash: ${tx.hash}`);

    // Wait for 1 confirmation
    const receipt = await tx.wait(1);
    console.log(`✅ Vote confirmed in block ${receipt.blockNumber}`);

    return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
  } catch (e) {
    console.error("❌ Blockchain log failed:", e.message);
    return { success: false, error: e.message };
  }
}

// ── Log batch of votes to blockchain (gas efficient) ───────
/**
 * Sends multiple vote hashes in ONE transaction.
 * Much cheaper than one tx per vote.
 * Call this every 10-50 votes, or at end of election for final audit.
 *
 * @param {string[]} voteHashes - array of hash strings
 * @returns {object} { success, txHash, count }
 */
async function logBatchOnChain(voteHashes) {
  if (!initialized) {
    return { success: false, error: "Blockchain not configured" };
  }
  if (!voteHashes || voteHashes.length === 0) {
    return { success: false, error: "No hashes to log" };
  }

  try {
    const tx = await contract.logBatch(voteHashes);
    console.log(`📦 Batch of ${voteHashes.length} hashes sent. TxHash: ${tx.hash}`);
    const receipt = await tx.wait(1);
    console.log(`✅ Batch confirmed in block ${receipt.blockNumber}`);
    return {
      success: true,
      txHash: tx.hash,
      count: voteHashes.length,
      blockNumber: receipt.blockNumber,
    };
  } catch (e) {
    console.error("❌ Batch log failed:", e.message);
    return { success: false, error: e.message };
  }
}

// ── Verify a vote hash onchain ─────────────────────────────
/**
 * Checks if a vote hash exists on the blockchain.
 * Reading is FREE — no gas fee.
 *
 * @param {string} voteHash
 * @returns {boolean} true = vote logged and untampered
 */
async function verifyVoteOnChain(voteHash) {
  if (!initialized) return null; // null = blockchain not available

  try {
    const exists = await contract.verifyVote(voteHash);
    return exists;
  } catch (e) {
    console.error("Verify error:", e.message);
    return null;
  }
}

// ── Get total votes logged onchain ─────────────────────────
async function getTotalOnChain() {
  if (!initialized) return null;
  try {
    const total = await contract.totalVotes();
    return Number(total);
  } catch (e) { return null; }
}

// ── Get relayer wallet balance ─────────────────────────────
async function getRelayerBalance() {
  if (!initialized) return null;
  try {
    const bal = await provider.getBalance(wallet.address);
    return ethers.formatEther(bal);
  } catch (e) { return null; }
}

// Initialize when this module is loaded
init();

module.exports = {
  generateVoteHash,
  logVoteOnChain,
  logBatchOnChain,
  verifyVoteOnChain,
  getTotalOnChain,
  getRelayerBalance,
  isInitialized: () => initialized,
};
