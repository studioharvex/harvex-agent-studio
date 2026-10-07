# Harvex Agent Studio

Shape a character, give it a personality and up to four skills, and hand it work. Harvex Agent Studio is a web app
for building AI agents as 3D characters, running tasks with them, putting them on a schedule and publishing them
to a marketplace that accounts in credits. Sign-in is by wallet only (Sign-In with Ethereum, the EIP-4361 message
format, on BNB Smart Chain).

Harvex is an independent project. It is not affiliated with, endorsed by or partnered with BNB Chain, Binance or
Anthropic.

## Status

Read this before anything else: most of what touches a chain is written but switched off.

| Part | State |
| --- | --- |
| Character studio, agent builder, skills, history, schedules, credit marketplace, wallet sign-in | Built. Works without any chain setting. |
| Live AI answers | Built. Off until the operator sets a provider key on the server. Without one, every skill returns a clearly labelled workflow sample. |
| Credit top-ups in USDT, holder tiers, earnings claims, holder rewards | Built. Off until the operator configures them. |
| HARVEX token, reward vault, multisig, claims contract | Do not exist. Nothing is deployed on any chain. |
| Audit of `contracts/`, legal review of top-ups, claims or rewards | Not done. |
| Tests on BNB Smart Chain mainnet or testnet | Not done. Chain features were only ever run against a local chain. |

A preview build of the site runs on Cloudflare without a custom domain; `harvex.example` in the guides is a
placeholder. Parts of that preview can be kept closed ("not open yet") with the `CLOSED_SECTIONS` setting.
Credits have no monetary value.

## What is in it

- **Character studio.** 25 people built from one parametric body (shape, face, hair, outfit, colours, gear),
  33 motions, drawn live with three.js. The engine is the project's own, in `lib/harvex3d`.
- **Agents.** A name, a character, instructions, optional notes and pasted sources the agent answers from, and
  up to four of ten skills (research, writing, documents, code, summaries, translation, planning, brainstorming,
  a wallet monitor and a holder overview).
- **Runs.** Each run costs credits, is kept in History and is refunded when it fails. Limits per account and
  for the whole studio are counted on the server.
- **Schedules and delivery.** An agent can run a task up to 24 times a day and send the result to a Discord
  webhook or a Telegram chat. A schedule can report only when something changed.
- **Marketplace and community pages.** Published agents with a price per task and per chat message, public agent
  pages with a chat, teams of two or three agents that hand work on, duels between two agents, a weekly board,
  shared answers, recipes, quests and invitations.
- **Library.** Docs, whitepaper and roadmap, rendered from `lib/harvex3d/src/content.js`.

## Stack

| | |
| --- | --- |
| App | Next 16 app router, built with vinext on Vite 8, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui on Radix, GSAP |
| 3D | three.js with a procedural character engine (`lib/harvex3d`) |
| Runtime | Cloudflare Worker with a D1 database (SQLite), Drizzle ORM, 35 migrations in `drizzle/` |
| Auth | Better Auth, wallet sign-in only |
| Chain | viem; BNB Smart Chain mainnet (56) or testnet (97), chosen by environment settings |
| AI | Claude, OpenAI, or any OpenAI-compatible API; the key stays on the server |

## Getting started

Needs Node.js 22.13 or newer and npm.

```sh
npm ci
npm run build
```

Create the local database once, by applying every migration in order:

```sh
for f in drizzle/0*.sql; do node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$f"; done
```

Create the local settings file and give it a session secret:

```sh
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and set `BETTER_AUTH_SECRET` to 32 or more random characters (the file shows a command that
prints one). Then start the site:

```sh
npm run dev
```

Open http://localhost:5173 and connect a wallet. Signing in only signs a message, so it needs no BNB. Every chain
feature stays off while the `CHAIN_*` settings and token addresses are empty.

Checks before a commit:

```sh
npx tsc --noEmit
npm run build
```

`npm run build` first checks that the link-preview pictures in `public/og` match what they are drawn from. When
they do not, it stops and says so; start the dev server and run `npm run cards` to draw them again.

[START-HERE-ID.md](START-HERE-ID.md) has the longer version of this section, in Indonesian.

## Where things are

| Path | What it holds |
| --- | --- |
| `app/` | Routes, API handlers (`app/api`), the app shell (`app/studio.tsx`) and the theme (`app/globals.css`) |
| `components/` | `landing` (home page), `app` (dashboard), `harvex` (public pages, menus, sign-in), `ui` (shadcn) |
| `lib/` | Server logic: agents, runs, credits, schedules, delivery, chain, rewards, AI providers |
| `lib/harvex3d/src/` | Source of the character engine and of the docs text. `engine.js`, `data.js` and `content.js` beside it are generated: `node scripts/build-harvex-engine.mjs` |
| `db/`, `drizzle/` | Schema and migrations. Migrations are never edited after they ship |
| `contracts/` | `HarvexClaims.sol`, a draft that is neither audited nor deployed, and its internal review |
| `public/` | Character pictures, the character packs (`sim`, `kit`), wallet logos, link-preview pictures, licences |
| `scripts/` | Build, deploy and asset scripts |
| `proxy.ts` | Sign-in redirects, closed sections and security headers |

## Configuration

Every setting is an environment variable on the server. The templates list them with comments:

- `.dev.vars.example` for local development
- `.env.compose.example` for Docker or Coolify
- `deploy.config.example.json` for a Cloudflare deploy (copy it to `deploy.config.json`, which is not committed)

Secrets belong in the host's environment only. Never commit them and never put them in frontend files. The server
holds no key that can move funds. The one optional key it can hold, `REWARD_ROOT_POSTER_KEY`, can only post reward
roots on a vault that has a payout limit.

## Hosting

The app is a Cloudflare Worker with a D1 database. It runs on Cloudflare, or in a single Docker container on
workerd with SQLite on a volume. It does not run on hosts without that runtime as it is.

- [DEPLOY-ID.md](DEPLOY-ID.md): Cloudflare deploy, AI providers, limits, chain features
- [COOLIFY-ID.md](COOLIFY-ID.md) and [DOCKER-ID.md](DOCKER-ID.md): Docker and Coolify, server security

The guides are written in Indonesian. The product itself is English only.

## Not in this repository

Kept on the developers' machines on purpose: secrets and local databases, build output, the end-to-end test
scripts and the local-chain harness, the operator's tools and guides for a token launch and a reward vault, and
generated documents. The website needs none of them to build or run.

## Security

Report a vulnerability privately to the maintainers instead of opening a public issue.
[contracts/SECURITY-REVIEW.md](contracts/SECURITY-REVIEW.md) is an internal review of the claims contract. It is
not an audit.

## Third-party assets and licence

Character meshes, clothes and animation clips come from CC0 sources; wallet and network marks belong to their
owners. The notes are in [public/licenses](public/licenses) and
[public/integration-guide.txt](public/integration-guide.txt).

No open-source licence has been chosen for the project's own code yet.
