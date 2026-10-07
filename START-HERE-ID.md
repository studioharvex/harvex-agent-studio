# Harvex Agent Studio: mulai di sini

Panduan menjalankan dan menguji project di komputer sendiri. Untuk deploy baca `DEPLOY-ID.md` (Cloudflare) atau
`COOLIFY-ID.md` / `DOCKER-ID.md` (Docker Compose).

`harvex.studio` adalah domain Harvex: kalau kamu memasang salinan sendiri, ganti dengan domainmu di semua
panduan. Belum ada yang on-chain: belum ada token HARVEX, vault reward, Safe, maupun kontrak klaim.

## Isi repo
Source website, lockfile, model dan gambar karakter, logo Harvex, database migrations, test scripts dan contoh
environment (`.dev.vars.example` untuk lokal, `.env.compose.example` untuk Docker/Coolify).

Tidak ada di repo: `node_modules`, cache, kunci/API secrets, database lokal, data akun pengguna, dan kredensial
deployment. Dependencies di-install ulang dengan `npm ci`. Folder `exports/` dan `standalone/` juga tidak ada: isinya
dibuat oleh script (`scripts/build-vault-package.mjs`, `scripts/export-docs.mjs`, `scripts/build-harvex-engine.mjs`).

## Menjalankan lokal
Butuh Node.js >=22.13.0 dan npm. Buka terminal di folder yang berisi package.json.

```sh
npm ci
npm run build
```

Untuk database lokal BARU, jalankan semua migration di folder `drizzle/` sekali, berurutan menurut nomornya
(0000 sampai yang terbaru; database lama cukup menjalankan migration yang belum pernah dijalankan):

```sh
for f in drizzle/0*.sql; do node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$f"; done
cp .dev.vars.example .dev.vars
# isi BETTER_AUTH_SECRET di .dev.vars (32+ karakter acak, perintahnya ada di file itu)
npm run dev
```

Buka http://localhost:5173 lalu **Connect wallet** dengan wallet extension (MetaMask, Rabby, Coinbase Wallet, Trust
Wallet, OKX Wallet, atau wallet EIP-6963 lain yang terpasang). Login hanya lewat wallet (SIWE untuk BNB Smart Chain).
Di lokal, chain default-nya testnet 97; login hanya tanda tangan pesan, tidak butuh BNB. Jangan jalankan migration
lagi ke database yang sudah diinisialisasi.
Website ini memakai backend Worker + D1; bukan HTML yang bisa dibuka lewat double-click.

Pengecekan:
```sh
npx tsc --noEmit --incremental false
npm run build
```

Menjalankan build yang menyerupai produksi (build asli + proxy depan + migration dari nol), tanpa Docker:
```sh
npm run build
HARVEX_ALLOW_DEV_FLAGS=true APP_ORIGIN=http://localhost:8790 PORT=8790 HARVEX_DATA_DIR=.wrangler/qa-data BETTER_AUTH_SECRET=<32+ karakter acak> node scripts/container-start.mjs
```
Lalu buka http://localhost:8790. Semua fitur chain otomatis OFF selama variabel `CHAIN_*` dan alamat token tidak diisi.

## Tes fitur chain di chain LOKAL
Top-up, klaim, tier dan reward hanya dites di chain lokal (ganache di dalam proses, memakai chain id testnet 97),
tidak pernah di jaringan sungguhan. Alatnya bukan dependency project; pasang di folder terpisah:

```sh
mkdir ../evm-tools && cd ../evm-tools && npm init -y && npm i ganache@7.9.2 solc@0.8.26
cd -                                                   # kembali ke folder project
EVM_TOOLS=../evm-tools node scripts/local-chain.mjs    # tetap jalan; Ctrl+C untuk berhenti
```
Script itu men-deploy token tiruan dan dua HarvexClaims di chain lokal, lalu mencetak baris `CHAIN_*` untuk ditempel
ke `.dev.vars`. Restart `npm run dev`, lalu jalankan tes yang diinginkan, misalnya:

```sh
BASE=http://localhost:5173 node scripts/verify-chain.mjs
EVM_TOOLS=../evm-tools BASE=http://localhost:5173 ROUNDS=3 node scripts/verify-topup-security.mjs
EVM_TOOLS=../evm-tools npx tsx scripts/test-claims-contract.mjs
```
Kebutuhan tiap tes (env tambahan, urutan) tertulis di komentar paling atas file script-nya.

**Catatan jujur:** tes-tes ini ditulis untuk pengaturan chain sebelumnya dan belum dijalankan ulang untuk salinan ini.
Jalankan semuanya sampai lolos sebelum memakai testnet, apalagi mainnet. Belum ada yang pernah dites di BNB Smart
Chain testnet maupun mainnet.
