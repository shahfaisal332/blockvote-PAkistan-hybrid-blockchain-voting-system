BlockVote Pakistan

A Hybrid Blockchain-Based Voting System

📌 Overview
BlockVote Pakistan is a secure electronic voting system that combines traditional database storage with blockchain technology.

- Fast performance using MySQL
- Tamper-proof verification using Ethereum
- No crypto wallet required for voters

🏗️ Tech Stack

**Frontend:** React.js (Vite)  
**Backend:** Node.js + Express  
**Database:** MySQL  
**Blockchain:** Solidity + Ethereum Sepolia  
**Web3:** Ethers.js  

🔐 Features

- CNIC-based voter authentication
- One vote per group (MNA/MPA)
- Unique election symbols
- Admin dashboard (manage voters, candidates, groups)
- Blockchain vote verification (keccak256 hashing)
- Mobile responsive UI

🗳️ How It Works

1. Voter logs in using CNIC and name
2. Selects candidates from groups
3. Vote stored in MySQL
4. Vote hash stored on Ethereum blockchain
5. Results calculated and displayed

🔗 Blockchain

Only vote hashes are stored for integrity and transparency.
