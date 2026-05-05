// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  BlockVote Pakistan
 * @notice Pakistan-style group voting (MNA / MPA).
 *         Admin  = contract deployer (owner).
 *         Voters = identified by keccak256(cnic + name_lowercase) — never stored raw.
 *         Votes are counted onchain. Voter registration is offchain (MySQL/WampServer).
 */
contract Voting {

    address public immutable owner;

    string  public electionTitle;
    uint256 public startTime;
    uint256 public endTime;
    bool    public configured;

    struct Candidate {
        uint256 id;
        string  name;
        string  symbolName;
        string  symbolImageUrl;   // stored offchain; URL kept here for transparency
        uint256 voteCount;
    }

    struct Group {
        uint256   id;
        string    name;           // e.g. "MNA Seat 15", "MPA Seat 4"
        uint256[] candidateIds;
    }

    uint256 public groupCount;
    uint256 public candidateCount;

    mapping(uint256 => Group)     public groups;
    mapping(uint256 => Candidate) public candidates;

    // voterHash => groupId => hasVoted
    mapping(bytes32 => mapping(uint256 => bool)) private votedInGroup;

    // ── Events ───────────────────────────────────────────────
    event ElectionConfigured(string title, uint256 start, uint256 end);
    event GroupAdded(uint256 indexed id, string name);
    event CandidateAdded(uint256 indexed id, uint256 indexed groupId, string name);
    event VoteCast(bytes32 indexed voterHash, uint256 indexed groupId, uint256 indexed candidateId);

    // ── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier isActive() {
        require(configured,                      "Election not configured");
        require(block.timestamp >= startTime,    "Election not started yet");
        require(block.timestamp <= endTime,      "Election has ended");
        _;
    }

    constructor() { owner = msg.sender; }

    // ── Admin functions ──────────────────────────────────────

    function configureElection(
        string calldata _title,
        uint256 _start,
        uint256 _end
    ) external onlyOwner {
        require(_end > _start, "End must be after start");
        electionTitle = _title;
        startTime     = _start;
        endTime       = _end;
        configured    = true;
        emit ElectionConfigured(_title, _start, _end);
    }

    function addGroup(string calldata _name)
        external onlyOwner returns (uint256)
    {
        uint256 id = ++groupCount;
        groups[id].id   = id;
        groups[id].name = _name;
        emit GroupAdded(id, _name);
        return id;
    }

    function addCandidate(
        uint256 _groupId,
        string calldata _name,
        string calldata _symbolName,
        string calldata _symbolImageUrl
    ) external onlyOwner returns (uint256) {
        require(_groupId > 0 && _groupId <= groupCount, "Invalid group");
        uint256 id = ++candidateCount;
        candidates[id] = Candidate(id, _name, _symbolName, _symbolImageUrl, 0);
        groups[_groupId].candidateIds.push(id);
        emit CandidateAdded(id, _groupId, _name);
        return id;
    }

    // ── Voter function ───────────────────────────────────────

    /**
     * @param _voterHash  keccak256(abi.encodePacked(cnic + name_lowercase))
     *                    Computed offchain in the browser — never send raw CNIC.
     */
    function castVote(
        bytes32 _voterHash,
        uint256 _groupId,
        uint256 _candidateId
    ) external isActive {
        require(!votedInGroup[_voterHash][_groupId], "Already voted in this group");
        require(_groupId > 0 && _groupId <= groupCount,         "Invalid group");
        require(_candidateId > 0 && _candidateId <= candidateCount, "Invalid candidate");

        bool belongs;
        uint256[] memory cids = groups[_groupId].candidateIds;
        for (uint i; i < cids.length; i++) {
            if (cids[i] == _candidateId) { belongs = true; break; }
        }
        require(belongs, "Candidate not in group");

        votedInGroup[_voterHash][_groupId] = true;
        candidates[_candidateId].voteCount++;
        emit VoteCast(_voterHash, _groupId, _candidateId);
    }

    // ── View functions ───────────────────────────────────────

    function electionStatus() external view returns (
        bool active, bool ended,
        uint256 _start, uint256 _end,
        string memory title
    ) {
        return (
            configured && block.timestamp >= startTime && block.timestamp <= endTime,
            configured && block.timestamp > endTime,
            startTime, endTime, electionTitle
        );
    }

    function getAllGroups() external view returns (
        uint256[] memory ids, string[] memory names
    ) {
        ids   = new uint256[](groupCount);
        names = new string[](groupCount);
        for (uint256 i = 1; i <= groupCount; i++) {
            ids[i-1]   = i;
            names[i-1] = groups[i].name;
        }
    }

    function getGroup(uint256 _id) external view returns (
        uint256, string memory, uint256[] memory
    ) {
        Group storage g = groups[_id];
        return (g.id, g.name, g.candidateIds);
    }

    function getCandidate(uint256 _id) external view returns (
        uint256, string memory, string memory, string memory, uint256
    ) {
        Candidate storage c = candidates[_id];
        return (c.id, c.name, c.symbolName, c.symbolImageUrl, c.voteCount);
    }

    function hasVotedInGroup(bytes32 _voterHash, uint256 _groupId)
        external view returns (bool)
    {
        return votedInGroup[_voterHash][_groupId];
    }

    function getGroupResults(uint256 _groupId) external view returns (
        uint256[] memory ids,
        string[]  memory names,
        string[]  memory symbolNames,
        uint256[] memory votes
    ) {
        uint256[] memory cids = groups[_groupId].candidateIds;
        uint256 len = cids.length;
        ids         = new uint256[](len);
        names       = new string[](len);
        symbolNames = new string[](len);
        votes       = new uint256[](len);
        for (uint i; i < len; i++) {
            Candidate storage c = candidates[cids[i]];
            ids[i]         = c.id;
            names[i]       = c.name;
            symbolNames[i] = c.symbolName;
            votes[i]       = c.voteCount;
        }
    }
}