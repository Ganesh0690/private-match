# PrivateMatch — Private Friend Discovery on Solana

> Find mutual contacts without revealing your address book. Powered by Arcium's Multi-Party Computation on Solana.

**Live Demo:** https://private-match.vercel.app/  
**Deployed Program:** [FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5](https://explorer.solana.com/address/FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5?cluster=devnet) (Solana Devnet)

## The Problem

Finding friends on new platforms typically requires uploading your entire contact list to a centralized server. This exposes private data — emails, phone numbers — creating massive privacy risks and enabling data harvesting.

## The Solution

PrivateMatch uses **Arcium's MPC network** to perform **Private Set Intersection (PSI)**. Two users can discover which contacts they share without revealing any non-matching contacts — not to each other, not to any server, not to any MPC node individually.

## How Arcium Enables This

### Step 1: Local Hashing
Contacts are hashed deterministically in the user's browser before leaving their device. No raw contact data ever leaves the client.

### Step 2: Rescue Cipher Encryption
Hashed contacts are encrypted using Arcium's **Rescue cipher** in CTR mode with 128-bit security. A **x25519 Diffie-Hellman key exchange** is performed between the client and the MXE cluster to derive a shared encryption key. This ensures only the intended MPC cluster can process the data.

### Step 3: MPC Computation via Arcium
The encrypted contact sets are submitted to Arcium's decentralized **ARX node network**. Using **secret sharing**, the data is split into random-looking fragments across multiple nodes. No single node ever sees plaintext data. The nodes collaboratively execute our `find_matches` circuit — comparing every pair of contacts across both sets — without any node learning which contacts matched or what the contacts are.

### Step 4: Encrypted Results
The circuit returns boolean match flags, encrypted separately for each user using their own shared key. User A only sees which of their own contacts matched. User B sees the same for theirs. Non-matching contacts are never revealed to anyone.

### Privacy Guarantees
- **Full-threshold security:** ALL ARX nodes would need to collude to break privacy
- **Zero data leakage:** Non-matching contacts are cryptographically hidden
- **No centralized storage:** Contact data exists only as encrypted fragments during computation
- **Client-side hashing:** Raw contacts never leave the browser

## Architecture
```
Browser (Client)
  |-- Hash contacts locally (deterministic hashing)
  |-- Generate x25519 keypair
  |-- Derive shared secret with MXE cluster
  |-- Encrypt hashes with Rescue cipher
  v
Solana Program (MXE) [FK6iXAx5Bd86...on devnet]
  |-- Receive encrypted contact sets from both users
  |-- Build computation arguments via ArgBuilder
  |-- Queue computation to Arcium network (queue_computation CPI)
  v
Arcium MPC Cluster (ARX Nodes)
  |-- Convert ciphertexts to secret shares (.to_arcis())
  |-- Execute find_matches circuit in MPC
  |   |-- Nested loop: compare all pairs (i,j) across both sets
  |   |-- Set match flags without revealing which indices matched
  |   |-- Count total matches
  |-- Re-encrypt results per user (.from_arcis())
  v
Callback to Solana Program
  |-- Verify computation signatures (SignedComputationOutputs)
  |-- Emit MatchCompleteEvent with encrypted results
  v
Browser (Client)
  |-- Decrypt own match flags with shared secret
  |-- Display matched contacts, mark non-matches as "Private"
```

## Technical Implementation

### Arcis Circuit (encrypted-ixs/src/lib.rs)
The core PSI logic runs inside Arcium's MPC network:
- Takes two `Enc<Shared, ContactSet>` inputs (up to 16 contacts each, as u128 hashes)
- Nested loop compares every pair across both sets using secret-shared comparisons
- Returns `(Enc<Shared, MatchFlags>, Enc<Shared, MatchFlags>)` — separate encrypted results per user
- Uses fixed-size arrays and fixed iteration counts (required by MPC circuit constraints)
- Both branches of conditionals always execute (MPC security requirement prevents information leakage via timing)

### Solana Program (programs/private_match_app/src/lib.rs)
The on-chain program orchestrates the computation:
- `#[arcium_program]` macro for Arcium integration
- `ArgBuilder` constructs encrypted arguments matching the circuit's expected inputs
- `queue_computation()` CPI submits work to Arcium's MPC cluster
- `#[arcium_callback]` receives results with `SignedComputationOutputs<FindMatchesOutput>`
- `init_computation_definition_accounts` registers the circuit on-chain with address lookup table
- Custom accounts: `ProgramState`, `UserAccount`, `MatchRecord` for persistent state
- `CallbackAccount` for passing writable match records to the callback

### Frontend (app/)
- React + TypeScript + Vite with Anchor SDK integration
- Real on-chain transactions to deployed Solana devnet program
- Phantom wallet integration with balance display
- Client-side contact hashing before any network calls
- Transaction signatures with Solana Explorer links
- Real-time progress showing each MPC computation step

## Project Structure
```
private-match/
├── encrypted-ixs/src/lib.rs       -- Arcis MPC circuit (Private Set Intersection)
├── programs/private_match_app/
│   └── src/lib.rs                  -- Solana program with full Arcium integration
├── build/                          -- Compiled circuit artifacts
│   ├── find_matches.arcis          -- Compiled MPC circuit bytecode
│   ├── find_matches.hash           -- Circuit hash for ARX node verification
│   └── find_matches.ts             -- Generated TypeScript types
├── app/                            -- React frontend
│   ├── src/App.tsx                 -- Main app with on-chain calls
│   ├── src/idl/                    -- Program IDL for Anchor client
│   └── src/index.css               -- Professional UI styling
├── tests/                          -- Integration test scaffold
├── target/deploy/
│   └── private_match_app.so        -- Compiled Solana program (deployed)
├── Anchor.toml                     -- Anchor configuration
└── Arcium.toml                     -- Arcium configuration
```

## Build and Deploy
```bash
# Install Arcium CLI
curl --proto '=https' --tlsv1.2 -sSfL https://install.arcium.com/ | bash

# Build circuit + program
arcium build --skip-keys-sync
anchor build

# Deploy to Solana devnet
arcium deploy --cluster-offset 456 --recovery-set-size 4 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url https://api.devnet.solana.com

# Run frontend locally
cd app && npm install && npm run dev
```

## How to Test

1. Install Phantom wallet and switch to Devnet
2. Get devnet SOL from Phantom (Settings > Developer Settings > Request Airdrop)
3. Visit https://private-match.vercel.app/
4. Connect wallet
5. Click "Initialize On-Chain" — sends real transaction to Solana devnet
6. Click "Register User On-Chain" — registers your wallet
7. Enter contacts (one per line) and a friend's wallet address
8. Click "Run Private Match via Arcium MPC"
9. View transaction signatures on Solana Explorer

## Deployed on Solana Devnet

- **Program ID:** FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5
- **Explorer:** https://explorer.solana.com/address/FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5?cluster=devnet
- **Live Demo:** https://private-match.vercel.app/
- **GitHub:** https://github.com/Ganesh0690/private-match

## Tech Stack

- **Solana** — Blockchain layer (devnet deployment)
- **Arcium** — Decentralized MPC network for private computation
- **Arcis** — Rust framework for writing MPC circuits
- **Anchor 0.32.1** — Solana program framework
- **React + Vite** — Frontend with Anchor SDK integration
- **Phantom** — Wallet connection

## License

MIT
