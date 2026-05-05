// After deploying Voting.sol in Remix IDE, paste your contract address here
export const CONTRACT_ADDRESS = "0xd5c4688e0B64AcA14C5Cc5f2dc453823638Dbd5f";

export const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function electionStatus() view returns (bool active, bool ended, uint256 startTime, uint256 endTime, string title)",
  "function groupCount() view returns (uint256)",
  "function candidateCount() view returns (uint256)",
  "function getAllGroups() view returns (uint256[] ids, string[] names)",
  "function getGroup(uint256 id) view returns (uint256, string, uint256[])",
  "function getCandidate(uint256 id) view returns (uint256, string, string, string, string, uint256)",
  "function hasVotedInGroup(bytes32 voterHash, uint256 groupId) view returns (bool)",
  "function getGroupResults(uint256 groupId) view returns (uint256[], string[], string[], string[], uint256[])",
  "function configureElection(string title, uint256 startTime, uint256 endTime)",
  "function addGroup(string name) returns (uint256)",
  "function addCandidate(uint256 groupId, string name, string partyName, string symbolName, string symbolImageUrl) returns (uint256)",
  "function castVote(bytes32 voterHash, uint256 groupId, uint256 candidateId)",
];