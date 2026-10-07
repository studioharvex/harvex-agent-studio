# Contracts (draft, unaudited, not deployed)

Nothing here is deployed on BNB Smart Chain, mainnet or testnet.

- `HarvexClaims.sol` is a cumulative merkle distributor that pays one ERC-20 (BEP-20) token.
  - Creator earnings would use an instance that pays USDT.
  - A separate instance would be the holder-reward vault. Its token has not been chosen. It must be a plain token: one that takes a fee on transfer or rebases would pay holders something else than the leaf says. Whether a given token may be paid to holders, and to whom, is a legal question that has not been reviewed.
  - The owner must be a multisig. It posts roots, pauses claims, sets the payout limit and the optional root poster, and withdraws unclaimed funds.
  - The leaf format matches `lib/merkle.ts` and OpenZeppelin `MerkleProof`: `keccak256(bytes.concat(keccak256(abi.encode(account, cumulativeAmount))))`.
- `test/MockToken.sol` is an ERC-20 that only its deployer can mint. It is used for the mock tokens (tUSDT, tHARVEX and a mock reward token) on the local chain and on BNB Smart Chain **testnet** (`scripts/deploy-testnet.mjs`). Never deploy it to mainnet.
- `SECURITY-REVIEW.md` is the internal review. It is not an independent audit, and it was written before this copy targeted BNB Smart Chain.

Tests run on a local ganache chain that uses BNB Smart Chain Testnet's chain id (97), via `scripts/local-chain.mjs`, `scripts/verify-chain.mjs` and the contract-level script (`EVM_TOOLS=../evm-tools npx tsx scripts/test-claims-contract.mjs`). They have not been re-run for this copy. They cover these cases:
- Valid claim.
- Inflated amount rejected.
- Double claim rejected.
- Contract-level: pause, withdraw, two-step ownership, root replacement, tokens without a return value, root poster and payout limit.
- Only the owner (or the root poster it named) can post a root.

Before any public deployment:
1. Re-run the local tests until they pass.
2. Get an independent audit.
3. Deploy to testnet (97) first.
4. Verify the source on the official explorer (testnet.bscscan.com, then bscscan.com).
5. Set the multisig as owner.
6. Publish the addresses in the docs.
