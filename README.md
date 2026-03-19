# PrivateMatch - Private Friend Discovery on Solana

Private Set Intersection (PSI) powered by Arcium MPC on Solana. Find mutual contacts without revealing your address book.

## How It Works

1. Contacts are hashed locally in-browser
2. Hashes encrypted with Rescue cipher via x25519 key exchange
3. Arcium MPC nodes compute intersection on encrypted data using secret sharing
4. Only boolean match flags returned - non-matches stay hidden

## Architecture

- `encrypted-ixs/src/lib.rs` - Arcis MPC circuit for private set intersection
- `programs/private_match_app/src/lib.rs` - Solana program with Arcium integration
- `tests/` - Integration tests
- `build/` - Compiled circuit artifacts

## Privacy Guarantees

- No single MPC node sees plaintext contact data
- Non-matching contacts never revealed to anyone
- Full-threshold security via Arcium's ARX node network
- Rescue cipher in CTR mode with 128-bit security

## Tech Stack

- Solana (blockchain layer)
- Arcium (MPC computation)
- Arcis (circuit framework)
- Anchor 0.32.1 (Solana framework)

## Build
```bash
arcium build --skip-keys-sync
anchor build
```

## Deploy
```bash
arcium deploy --cluster-offset 456 --recovery-set-size 4 --keypair-path ~/.config/solana/id.json --rpc-url https://api.devnet.solana.com
```

## License

MIT

## Deployed on Solana Devnet

- **Program ID:** `FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5`
- **Explorer:** https://explorer.solana.com/address/FK6iXAx5Bd86x1ypL5Nq91D6HXFXXWTJ1CjSmguwA9i5?cluster=devnet
- **Live Demo:** https://private-match.vercel.app/
