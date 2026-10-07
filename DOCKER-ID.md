# Deploy Harvex dengan Docker Compose

Dua cara, image dan database-nya sama:

| Cara | File | HTTPS |
| --- | --- | --- |
| **Coolify** | `docker-compose.yml` | proxy Coolify (lihat COOLIFY-ID.md) |
| **VPS biasa** (Ubuntu, Debian, dll.) | `docker-compose.yml` + `docker-compose.standalone.yml` | Caddy, sertifikat otomatis |

App menolak start tanpa https (`APP_ORIGIN` wajib https), jadi selalu ada proxy TLS di depannya.
Database = SQLite (D1) di volume `harvex-data`. Jalankan **1 container saja**.

`harvex.studio` di bawah adalah domain Harvex: kalau kamu memasang salinan sendiri, ganti dengan domainmu.

## 1. Siapkan server (VPS biasa)

- Docker Engine + plugin Compose (`docker compose version`).
- DNS: record A (dan AAAA kalau ada IPv6) domain kamu mengarah ke IP server.
- Port 80 dan 443 terbuka (Caddy butuh port 80 untuk mengambil sertifikat).

## 2. Isi `.env`

```sh
git clone <repo> harvex && cd harvex
cp .env.compose.example .env
```
Isi minimal:
- `HARVEX_DOMAIN=harvex.studio` dan `APP_ORIGIN=https://harvex.studio` (sama, `APP_ORIGIN` pakai https://);
- `BETTER_AUTH_SECRET` dan `CLAIMS_ADMIN_TOKEN`: acak, 32+ karakter
  (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`);
- `AI_API_KEY` (Gemini, paid tier untuk user sungguhan);
- hanya kalau fitur chain dinyalakan: `CHAIN_RPC_URL` (RPC dari provider dengan akses archive; RPC publik BNB Smart
  Chain menolak `eth_getLogs`), `TOPUP_TREASURY` (multisig penerima USDT), dan `REWARD_ROOT_POSTER_KEY` nanti setelah
  vault ada (VAULT-MAINNET-ID.md Langkah 6).

Di `.env.compose.example` semua alamat chain kosong, jadi top-up, klaim, tier dan reward OFF sampai kamu mengisinya
mengikuti DEPLOY-ID.md bagian 7 (USDT di BNB Smart Chain 18 desimal; token reward belum dipilih, jadi `REWARD_*`
tetap kosong dan `REWARDS_ENABLED=false`). Template memakai `CHAIN_NETWORK=mainnet`; untuk mencoba dulu pakai `testnet`.

`.env` tidak pernah masuk Git dan tidak pernah masuk image (`.dockerignore`). Container menolak start kalau ada nilai yang
salah format dan menuliskan alasannya di log.

## 3. Jalankan

```sh
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.standalone.yml logs -f harvex
```
Di log harus terlihat: migration diterapkan (start pertama: semua file di `drizzle/`), `worker variables: ...`, lalu
`starting on 0.0.0.0:8787 for https://harvex.studio`. Healthcheck memanggil `/api/chain` tiap 30 detik; Caddy baru
menerima trafik setelah container sehat.

## 4. Cek setelah deploy

```sh
curl -s https://harvex.studio/api/chain | head -c 300
curl -s -X POST https://harvex.studio/api/ai/check -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN"
BASE=https://harvex.studio node scripts/smoke.mjs
```
`/api/ai/check` menjalankan satu tugas pendek ke provider AI yang dipasang dan menampilkan provider, model dan error
asli kalau gagal. `node scripts/smoke.mjs` dijalankan dari folder project yang sudah `npm ci`.

## 5. Update, backup, rollback

- **Update:** `git pull && docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --build`.
  Migration baru diterapkan otomatis saat start; data di volume tetap.
- **Backup:** salinan harian otomatis di `/data/backups` (simpan `HARVEX_BACKUP_DAYS` hari). Salin juga ke luar server:
  ```sh
  docker run --rm -v harvex_harvex-data:/data -v "$PWD":/backup alpine tar czf /backup/harvex-data-$(date +%F).tgz -C /data .
  ```
  (nama volume: `docker volume ls`, biasanya `<nama-folder>_harvex-data`).
- **Rollback:** `git checkout <commit-sebelumnya>` lalu `up -d --build`. Migration bersifat additive, database lama tetap
  terbaca oleh versi sebelumnya.

## 6. Tes lokal (tanpa domain)

`.env` dengan `HARVEX_DOMAIN=localhost`, `APP_ORIGIN=https://localhost:8443`, `HTTP_PORT=8080`, `HTTPS_PORT=8443`, lalu
buka https://localhost:8443 (sertifikat lokal Caddy, browser akan memperingatkan). Jangan pakai `.env` ini di server.
