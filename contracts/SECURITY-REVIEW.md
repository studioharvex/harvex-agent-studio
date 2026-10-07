# HarvexClaims: internal security review

> **Status:** this is an internal review with tests, written by the development assistant. **It is not an independent audit.** An external audit is still required before HarvexClaims holds real funds on mainnet.
>
> **Where these notes come from.** They were written in late September and early October 2026 for an earlier deployment of the same contract on another chain, with different tokens. The contract's code is unchanged (only its name and two comment lines differ). This copy targets BNB Smart Chain, where nothing has been deployed and nothing has been tested. The findings about the contract's own logic still apply; everything that depended on the earlier chain or its tokens has been removed or marked below. The test results quoted are from that earlier work and have **not** been re-run for this copy.

## Scope
- In scope: `contracts/HarvexClaims.sol` (solc 0.8.26, optimizer 200 runs, evmVersion paris).
- Also checked, because they decide what the contract pays:
  - the off-chain parts `lib/merkle.ts`, `app/api/claims/route.ts` and `app/api/claims/epoch/route.ts`.
- Not reviewed for this copy: anything specific to BNB Smart Chain (see "BNB Smart Chain notes").

## Design summary
- One instance pays one ERC-20 token.
- The owner (meant to be a multisig) sets a merkle root over `(account, cumulativeAmount)` leaves.
- `claim(account, cumulative, proof)` pays `cumulative − claimed[account]` to `account`, and anyone may relay it.
- The owner can pause claims, withdraw funds, and hand over ownership in two steps.

## Findings
| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Info (trust) | The owner can post any root and can withdraw the whole float. Users must trust the owner. | By design. Use a multisig owner (for example 2-of-3), keep the float small and top it up per epoch, and publish every root. |
| 2 | Low | A wrong or lower root cannot claw back what was already paid. A later root with a higher cumulative can over-pay if the server builds it wrongly. | Mitigated off-chain: `/api/claims/epoch publish` refuses unless the on-chain root equals the built root, and cumulative amounts only ever grow. Recommend a second person checks `total` before signing `setMerkleRoot`. |
| 3 | Low | There is no timelock on `setMerkleRoot` or `withdraw`. | Acceptable while the float is small. Consider a timelock (or Safe delay module) before large balances. |
| 4 | Info | If the payout token has a blocklist or can freeze accounts, a claim to a blocked account reverts. | Only that account is affected. Its entitlement stays recorded and other claims keep working. Whether the token chosen on BNB Smart Chain has such a function has not been checked. |
| 5 | Info | Fee-on-transfer or rebasing tokens would pay less than `cumulative − claimed`. | The contract assumes a plain token. This must be confirmed for the pay token (USDT on BNB Smart Chain) and for whatever reward token is chosen; it has not been checked for this copy. |
| 6 | Info | `pendingOwner` can be cleared by `transferOwnership(address(0))`, but no event says "cancelled". | Cosmetic. |

No critical, high or medium issues were found.

## Checks that passed
- **Leaf format and proofs**
  - The leaf uses double hashing, `keccak256(bytes.concat(keccak256(abi.encode(account, cumulative))))`, so a 64-byte inner node cannot be passed off as a leaf (second-preimage attack).
  - `_verify` hashes sorted pairs, the same as OpenZeppelin `MerkleProof.verify`.
  - `lib/merkle.ts` produces identical roots and proofs: the on-chain claims in the tests used them.
- **Transfer safety**
  - Checks-effects-interactions: `claimed` is written before the external `transfer`, so re-entry cannot claim twice.
  - The safe transfer handles tokens that return `false` and tokens that return nothing.
- **Access control**
  - Constructor rejects a zero token and a zero owner.
  - Admin functions are owner-only.
  - Ownership changes in two steps.
  - The float can only move through `claim` (to the account in the leaf) or `withdraw` (owner).
- **Chain-independent properties**
  - The contract uses neither `block.number` nor `prevrandao`. The payout-limit window uses `block.timestamp`.

## BNB Smart Chain notes (not reviewed, to do)
- The original review included notes for the earlier chain (its block-number semantics, transaction screening by its operator, its finality stages and its contract size limit). None of that describes BNB Smart Chain and it has been removed.
- BNB Smart Chain is an L1 with its own validators; blocks come about every 0.45 seconds. A payout-limit window of 3,600 seconds is measured with `block.timestamp`, so block time does not change its length.
- To check before a deployment: that the compiled contract fits the chain's contract size limit, that the pay token and the reward token are plain tokens (finding 5), and whether they can block accounts (finding 4).

## Tests (local chain, chain id 97)
Results from the earlier work; not re-run for this copy.
- `scripts/test-claims-contract.mjs`: passed. It covers:
  - Constructor guards.
  - Owner-only root, pause and withdraw.
  - A proof only pays its own account, and anyone can relay a claim.
  - A new root pays only the difference, and double claims are rejected.
  - Pause blocks claims, and unpause restores them.
  - An underfunded claim reverts without changing state.
  - Two-step ownership, including that the old owner loses its rights.
  - Tokens without a return value.
- `scripts/verify-chain.mjs`: passed. It runs the full app flow: queue, epoch build, root posted by the owner, publish checked against the chain, on-chain claim, and rejection of double and inflated claims.

## Before mainnet
1. Re-run every local test until it passes, then deploy and test on BNB Smart Chain Testnet (97).
2. Get an independent audit (scope: this file plus the epoch builder), and publish the report.
3. Make the owner a multisig on BNB Smart Chain. Deploy with `OWNER_ADDRESS` set to it.
4. Verify the source on bscscan.com.
5. Start with a small float, and set up monitoring on the `RootUpdated`, `Claimed` and `Withdrawn` events.

## Addendum: second instance as the holder-reward vault

Scope: the same contract deployed a second time with `token` = the reward token, fed by the fixed-rate calculator in
`lib/rewards.ts` (default: every 1,500,000 HARVEX earns $0.01 of the reward token per hour). No contract change. The
reward token of this project has not been chosen, so the token-specific notes of the original addendum (they described
one particular token on the earlier chain) have been removed.

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 7 | Info (trust) | Solvency is enforced off-chain: a root is only built when the vault balance covers every `cumulative − claimed` (read on-chain). The contract itself would accept a root that owes more than it holds; claims beyond the balance then revert without changing state. | By design for v1; the server check plus the multisig review of each root. Worth an audit discussion: an on-chain `setMerkleRoot(root, totalOwed)` guard. |
| 8 | Info | Cumulative amounts are raw token units. They stay exact only for a token whose raw balances do not change on their own and that transfers the full amount. If the reward token's contract has an `oraclePaused()` function, the server stops settling while it returns true. | To confirm for the token that is chosen. |
| 9 | Low (compliance) | `claim` is permissionless and pays the leaf's account. The eligibility statement and the country check are enforced by serving proofs only after them, not on-chain. The country list in the code is an inherited cautious default. | A legal review must decide, for the token that is chosen, whether self-certification is enough and which countries belong on the list. Not done. |
| 10 | Info (operations) | Hourly settlement means an hourly `setMerkleRoot` if claims should be available every hour. Each root replaces the previous one and includes every earlier hour, so a slower cadence delays claims but never loses them. | Either a manual multisig cadence, or the automated poster of the next addendum. |

The price used for reward amounts comes from a Chainlink USD feed for the chosen token (`REWARD_PRICE_FEED`) or, without
one, from the operator through the admin API; off-chain there is a guard for jumps of 50% or more and a 72 h age limit.
Include this file, `lib/rewards.ts` (`accrue`, `buildPeriod`, `refreshPrice`) and `lib/merkle.ts` in the external audit scope.

## Addendum: root poster and payout limit

Purpose: holders can claim every hour when roots are posted by an automated key instead of the Safe.

- `rootPoster` (set by the owner) may call `setMerkleRoot` and nothing else: not `withdraw`, `setPaused`,
  `setRootPoster`, `setPayoutLimit` or `transferOwnership` (tested in the earlier work).
- Risk: a root decides who may claim, so a leaked poster key could post a root that pays an attacker. Mitigation:
  `setPayoutLimit(maxPayout, windowSeconds)` caps what all claims together can take per window; a claim above what is
  left in the window is paid in part (`claimed` grows by what was paid, the rest stays claimable). Tested in the earlier
  work: a forged root over the whole vault paid the thief at most one window, then `setPaused(true)` + `setRootPoster(0)`
  stopped it and the owner withdrew the rest (owner withdrawals are not capped).
- `check-reward-vault.mjs` fails a vault that has a poster but no payout limit, or whose poster is the owner.
- Server side (`lib/rewards.ts` `postRoot`): only roots of periods that `buildPeriod` accepted (the vault can pay every
  outstanding amount) are posted; the hash is stored on the period and a reverted transaction is sent again; publishing
  still requires the on-chain root to equal the period's root.
- Residual risk: the payout limit should be set close to what holders really claim per hour; a limit set too high
  weakens the protection, one set too low only slows claims. Monitor `Claimed` events and the poster's gas balance (BNB).

## Addendum: operating rules

- Order: the Safe sets the payout limit BEFORE it names a poster (`scripts/build-safe-batch.mjs` writes one batch in
  that order). The server refuses to post while the vault has no limit, names another poster, or the poster is the owner.
- The server watches `RootUpdated` on the vault. A root it did not build stops the automation and is reported
  (`rootWatch.alert`); it is never published and never used for proofs.
- Recovery after a leaked key: pause, remove the poster, have the Safe post the correct root again, and only then
  unpause. Unpausing while a forged root is still on the vault lets the forged claims continue.
- Periods are bound to the vault, token and chain they were built for. `claimed()` starts at zero on a new vault, so a
  tree built from the old cumulative amounts would pay everything again; the server refuses that build.
- A claim can be submitted by anyone for the account in the leaf (the tokens always go to that account). Eligibility
  is enforced by the app when it serves proofs, not by the contract.
- The vault's balance is the worst-case loss of every failure mode above. Fund it for one to two weeks, not for a year.
