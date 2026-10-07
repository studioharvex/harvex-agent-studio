# Deploy ke Coolify (Docker Compose): preview.harvex.studio

Panduan ini untuk **preview** di `preview.<domain utama>`, contohnya `preview.harvex.studio`. `harvex.studio` adalah domain Harvex: kalau kamu memasang salinan sendiri, ganti dengan domainmu di semua langkah.

Belum ada yang on-chain: belum ada token HARVEX, vault maupun Safe, jadi semua fitur chain tetap OFF.

Production nanti memakai cara yang sama, hanya domain, secret dan volume-nya yang berbeda (lihat bagian akhir).

## Cara kerjanya
- App ini adalah Cloudflare Worker + D1. Di Coolify, Worker dijalankan oleh **workerd** (runtime open-source Cloudflare) lewat `wrangler dev --local`. Database D1 berupa file SQLite di volume `harvex-data` (`/data`).
- Saat container start, `scripts/container-start.mjs` akan:
  1. Menolak konfigurasi berbahaya: secret kosong, `AUTH_TRUST_SITES_HEADERS` bernilai true, atau domain non-https. Untuk mainnet juga: `PAY_TOKEN_ADDRESS` harus USDT di BNB Smart Chain, treasury wajib, finality tidak boleh `soft`, dan `REWARDS_ENABLED=true` butuh RPC dari provider.
  2. Meneruskan **hanya** env var yang ada di daftar izin ke Worker.
  3. Menjalankan migration yang belum pernah jalan (0000 sampai yang terbaru). Migration dicatat di tabel `d1_migrations`, jadi tidak dijalankan ulang.
  4. Kalau domain diawali `preview.`, otomatis masuk mode **noindex**: `robots.txt` diisi `Disallow: /` dan header `X-Robots-Tag: noindex` ikut dikirim, supaya preview tidak muncul di Google.
- Setelah start, proses yang sama juga:
  - memanggil **scheduler** tiap menit (`/api/schedules/tick`) untuk menjalankan jadwal agent dan menyinkronkan pencatat holder. Token-nya dibuat otomatis tiap start, jadi tidak perlu Scheduled Task Coolify;
  - membuat **backup database harian** di `/data/backups/harvex-YYYY-MM-DD.sqlite`. Jumlah yang disimpan diatur `HARVEX_BACKUP_DAYS` (default 7).
- Karena database-nya SQLite di satu volume, jalankan **1 container saja**. Jangan di-scale ke beberapa replika.

### Kenapa tidak ada service database di docker-compose?
- Database-nya **D1**, yaitu SQLite yang berjalan di dalam runtime Worker (workerd) di container `harvex` itu sendiri. Filenya ada di volume `harvex-data`:
  - data: `/data/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`
  - backup: `/data/backups/`
- Tidak perlu Postgres atau MySQL, tidak ada password database, dan tidak ada port database yang terbuka. Semua tabel dibuat oleh migration `drizzle/*.sql` saat start.
- Kode yang sama juga bisa di-deploy ke Cloudflare Workers + D1 managed (DEPLOY-ID.md) tanpa perubahan.
- Batasannya: satu container, dan database tidak dipakai bersama server lain. Kalau nanti traffic sudah besar, ada dua pilihan:
  - pindah ke Cloudflare D1 managed (paling mudah, kodenya sama);
  - port ke Postgres (butuh ubah lapisan database).

## 1. Push ke Git
Coolify mengambil kode dari repository Git (GitHub, GitLab, Gitea, dan sejenisnya). Folder ini belum berupa repo Git dan belum ada repo untuk Harvex: buat sendiri.
```bash
git init
git add .
git status
```
Sebelum commit, pastikan file-file ini **tidak** muncul di daftar (semuanya sudah ada di `.gitignore`):
- `.dev.vars`
- `deploy.config.json`
- `.wrangler/`
- `node_modules/`
- `dist/`

```bash
git commit -m "Harvex: Coolify docker compose"
git branch -M main
git remote add origin git@github.com:<akun>/<repo>.git
git push -u origin main
```
Repo boleh private. Di Coolify, hubungkan lewat GitHub App atau Deploy Key.

## 2. DNS
Di pengelola DNS domainmu (misalnya Cloudflare), tambahkan record:

| Type | Name | Value |
| --- | --- | --- |
| A | preview | IP server Coolify |

Kalau memakai Cloudflare, set dulu ke **DNS only** (awan abu-abu) supaya Coolify bisa membuat sertifikat Let's Encrypt. Setelah HTTPS jalan, boleh diubah ke Proxied dengan SSL mode **Full (strict)**.

## 3. Buat resource di Coolify
1. Project → **+ New** → **Private Repository** (atau Public) → pilih repo dan branch `main`.
2. **Build Pack: Docker Compose**, dengan Docker Compose Location `/docker-compose.yml`.
3. Di pengaturan service **harvex**, isi Domains dengan `https://preview.harvex.studio:8787`.
   `:8787` hanya memberi tahu proxy Coolify port container-nya. Pengunjung tetap membuka `https://preview.harvex.studio` tanpa port.
4. Isi tab **Environment Variables**:

| Variabel | Isi untuk preview |
| --- | --- |
| `APP_ORIGIN` | `https://preview.harvex.studio` (wajib, tanpa `/` di akhir) |
| `BETTER_AUTH_SECRET` | 32+ karakter acak, **berbeda** dari production (wajib) |
| `CHAIN_NETWORK` | `testnet` |

Cara membuat secret acak:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
Semua variabel lain boleh dibiarkan kosong (daftar lengkap dan nilai bawaannya ada di `.env.compose.example`). Fitur chain (top-up, klaim, tier) tetap **OFF** sampai alamat testnet diisi.

Untuk menyalakan fitur chain di preview (testnet 97, gas dibayar dengan BNB testnet):
1. Jalankan `node scripts/deploy-testnet.mjs` (lihat DEPLOY-ID.md bagian 7).
2. Tempel baris env yang dicetak script itu ke Coolify: `PAY_TOKEN_ADDRESS`, `TOPUP_TREASURY`, `CLAIMS_CONTRACT`, `CLAIMS_ADMIN_TOKEN`, `HARVEX_TOKEN_ADDRESS`, dan seterusnya. Tambahkan `CHAIN_RPC_URL` testnet dari provider RPC: RPC publik testnet menolak `eth_getLogs`.
3. Redeploy.

Di preview token-nya bernama **tUSDT / tHARVEX** (token tiruan buatan script itu, tanpa nilai; di testnet tidak ada USDT resmi).

**Jangan pernah** mengisi `AUTH_TRUST_SITES_HEADERS=true` atau `HARVEX_ALLOW_DEV_FLAGS=true` di server. Container akan menolak start kalau ada.

5. Klik **Deploy**. Build pertama makan waktu sekitar 3–6 menit (`npm ci` + `vinext build`).

## 4. Cek setelah deploy
```bash
curl -s https://preview.harvex.studio/api/chain
curl -s https://preview.harvex.studio/robots.txt
```
- Perintah pertama harus mengembalikan JSON berisi `"chainId":97`.
- Perintah kedua harus berisi `Disallow: /`.
- Buka situsnya, lalu **Sign in → Wallet** (tanda tangan saja, gratis). Setelah itu simpan sebuah agent.
- Di log container harus terlihat baris `[harvex] preview mode: ...` dan `Ready on http://0.0.0.0:8787`.

## 4b. Mainnet (BNB Smart Chain 56)
Belum pernah dijalankan: tidak ada yang di-deploy atau dites di mainnet, `HarvexClaims` belum diaudit dan belum ada review hukum. Bagian ini adalah langkah yang masih harus dikerjakan.

Mulai dari `.env.compose.example` (satu-satunya template env di repo; file env siap pakai tidak ada karena berisi secret). Di template semua alamat chain kosong; isi mengikuti DEPLOY-ID.md bagian 7 dan cocokkan tiap alamat di bscscan.com. Yang diisi:
- `CHAIN_NETWORK=mainnet`
- `PAY_TOKEN_ADDRESS` = USDT di BNB Smart Chain `0x55d398326f99059fF775485246999027B3197955` (cocokkan dulu di bscscan.com), `PAY_TOKEN_DECIMALS=18` atau kosong (**bukan 6**)
- `TOPUP_FINALITY=safe` (kredit masuk beberapa detik setelah transaksi)
- klaim, tier dan reward **OFF**: `CLAIMS_ENABLED=false`, `HARVEX_TOKEN_ADDRESS` kosong, `REWARDS_ENABLED=false`

Sebelum deploy:
- **`TOPUP_TREASURY` wajib diisi** dengan alamat multisig kamu. Tanpa itu container menolak start.
- Isi `CHAIN_RPC_URL` dengan RPC dari provider (misalnya Alchemy, QuickNode, Ankr atau NodeReal; belum ada yang dites untuk project ini), dengan akses archive. RPC publik resmi dibatasi rate-limit, menolak `eth_getLogs` dan tidak menyimpan state lama. `CHAIN_LOGS_RPC_URL` boleh kosong: bawaannya memakai `CHAIN_RPC_URL`.

Container juga menolak token bayar selain USDT itu, desimal USDT selain 18, dan finality `soft`. Di halaman Wallet muncul peringatan **"Mainnet · real funds"**.

`SKILL_TRIAL_LIMIT=2` = tiap akun bisa mencoba tiap skill 2x; `0` (default kalau dikosongkan) = tanpa batas, credit dan batas harian yang menentukan.

Holder rewards: `REWARDS_ENABLED=false` sampai token HARVEX, token reward (belum dipilih) dan HarvexClaims kedua ada. Cara menyalakan dan
alur operatornya ada di DEPLOY-ID.md bagian 7 dan GO-LIVE-HARVEX-ID.md. Pencatat holder jalan otomatis dari scheduler di dalam
container. Kalau perlu memicunya sendiri (Coolify → Terminal), perintahnya:
`node -e "fetch('http://127.0.0.1:8787/api/rewards/admin',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLAIMS_ADMIN_TOKEN,Origin:process.env.APP_ORIGIN},body:JSON.stringify({action:'sync'})}).then(r=>r.text()).then(console.log)"`

## 4b-2. Jadwal agent dan holder reward
- **Jadwal agent** aktif otomatis. Batasnya bisa diatur lewat env:
  - `CREATOR_ADMINS`: alamat wallet (pisahkan dengan koma) yang boleh mengonfirmasi handle X kreator di halaman Profile; kosong = verifikasi kreator ditutup;
  - `CHECK_COST`: kredit per agent check sebelum publish (empat panggilan AI), default 8;
  - `VOICE_COST`: kredit per draft persona dari post kreator sendiri (Studio → Persona), default 8;
  - `TALK_COST`: kredit per pesan chat dengan agent di halamannya, default 3 (harga kreator ditambahkan di atasnya);
  - `SCHEDULE_RUN_COST`: kredit per run, default 5;
  - `SCHEDULE_MAX`: jumlah jadwal per akun, default 3;
  - `SCHEDULE_DAILY_RUNS`: run terjadwal per akun per hari, default 24.
  - Matikan dengan `SCHEDULES_ENABLED=false`.
- **Kirim hasil jadwal ke Discord / Telegram** (halaman Schedules → Delivery):
  - Discord langsung aktif: user menempel alamat webhook channel-nya sendiri. Matikan dengan `NOTIFY_DISCORD=false`.
  - Telegram aktif setelah `TELEGRAM_BOT_TOKEN` diisi. Buat bot di @BotFather (`/newbot`), salin tokennya langsung ke
    Environment Variables Coolify (jangan ditempel di chat mana pun), lalu redeploy. Bot itu jangan dipasangi webhook di
    tempat lain: server membaca pesannya sendiri (getUpdates). Tanpa token, panel menulis "not set up on this server yet".
  - `NOTIFY_MAX`: jumlah channel per akun, default 4.
  - **Quests** (halaman Quests di dashboard): tiap quest yang selesai memberi kredit GRATIS sekali per akun.
    `QUEST_CREDITS` = kredit per quest (default 5, isi 0 kalau tidak mau memberi kredit); `QUESTS_ENABLED=false` mematikannya.
    Kredit quest sama seperti kredit awal akun: hanya untuk menjalankan agen, tidak bisa diklaim atau ditarik.
  - **Undangan (referral)**: tiap akun punya link undangan (`/r/<kode>`, kartunya ada di halaman Quests). Saat akun baru
    yang masuk lewat link itu menyelesaikan run pertamanya, pengundang dan yang diundang masing-masing mendapat kredit
    GRATIS. `REFERRAL_CREDITS` = kredit per sisi (default 10, 0 = tanpa kredit), `REFERRAL_MAX` = jumlah undangan
    berhadiah per akun (default 20), `REFERRALS_ENABLED=false` mematikannya. Kredit ini tidak bisa diklaim atau ditarik.
  - **Boost holder reward untuk pengundang** (hanya berarti kalau holder reward menyala): tiap teman undangan yang
    memegang satu unit reward (3.000.000 HARVEX) selama satu jam penuh menaikkan reward pengundang untuk jam itu. `REFERRAL_BOOST_PERCENT` = persen per teman (default
    10, isi 0 untuk mematikan), `REFERRAL_BOOST_FRIENDS` = jumlah teman yang dihitung (default 5, jadi maksimal 1,5x).
    Ini menambah yang dibayar vault: akun dengan boost penuh menguras vault 50% lebih cepat untuk bagiannya.
  - **Agen menjawab di Telegram** memakai bot yang sama, tanpa env baru. Container menjalankan pembaca pesan sendiri
    (long poll), jadi jawaban mulai dalam satu-dua detik. Biarkan privacy mode bot tetap aktif (bawaan BotFather):
    di grup hanya `/ask …` yang sampai ke bot. Tiap jawaban adalah run live biasa yang memotong kredit pemilik chat.
- **Holder reward**: OFF, dan token reward-nya belum dipilih (`REWARD_TOKEN_ADDRESS` bisa BEP-20 apa saja). Syarat supaya periode reward bisa jalan:
  1. token HARVEX sudah ada (`HARVEX_TOKEN_ADDRESS`);
  2. token reward sudah diputuskan (`REWARD_TOKEN_ADDRESS`, plus `REWARD_TOKEN_SYMBOL` dan `REWARD_TOKEN_DECIMALS` yang cocok);
  3. kontrak reward sudah di-deploy (`REWARD_CONTRACT`, lihat DEPLOY-ID.md bagian 7 dan VAULT-MAINNET-ID.md);
  4. `CHAIN_RPC_URL` dari provider (container menolak `REWARDS_ENABLED=true` tanpa itu);
  5. `REWARDS_ENABLED=true`, setelah audit kontrak dan review hukum.
  - Sebelum klaim pertama, tiap holder mengisi negara domisili dan pernyataan kelayakan. Server menolak sejumlah negara lewat daftar bawaan di kode; daftar itu bawaan hati-hati dari versi sebelumnya dan perlu direview penasihat hukum untuk token reward yang dipilih.

## 4b-3. Menambah CA token HARVEX
Token HARVEX belum ada. Begitu ada, cukup lewat env, tanpa mengubah kode. Di Coolify isi `HARVEX_TOKEN_ADDRESS` dengan alamat kontrak di BNB Smart Chain
mainnet (salin dari bscscan.com supaya huruf besar-kecilnya benar), lalu **Redeploy**. Setelah itu:
- kotak **CA** di halaman depan menampilkan alamatnya, dengan tautan ke explorer dan tombol Copy;
- teks status di halaman depan dan menu berganti dari "The HARVEX token and holder rewards are not live." ke "The HARVEX token is live. Holder rewards are not switched on.";
- holder tier aktif: diskon fee dan jatah kredit bulanan (`TIER_BASE_CREDITS`) dibaca dari saldo HARVEX wallet yang ditautkan.

Alamat hanya tampil kalau `CHAIN_NETWORK=mainnet`. Situs testnet menulis "Testnet build" dan tidak menampilkan alamat.
Kalau kotak CA masih "Not deployed yet" setelah redeploy, alamatnya salah ketik: `GET /api/chain` harus menampilkan
`harvexToken` berisi alamat itu.

Holder reward tidak ikut menyala: `REWARDS_ENABLED` tetap `false` sampai syarat di 4b-2 terpenuhi. Whitepaper dan
roadmap adalah teks, bukan env: ubah di `lib/harvex3d/src/content.js` (lalu `node scripts/build-harvex-engine.mjs`) saat token diluncurkan.

## 4c. Tes end-to-end setelah deploy
```bash
BASE=https://preview.harvex.studio node scripts/smoke.mjs
```
Yang dites:
- semua route publik dan dashboard, redirect login, 404 dan header keamanan;
- sign-in wallet, simpan agent, jalankan workflow sample, batas percobaan skill (dengan `SKILL_TRIAL_LIMIT=2`: 2x per skill, ke-3 ditolak 429);
- publish ke Discover lalu unpublish, History dan kredit, endpoint wallet, tier dan klaim;
- logout.

Tes memakai wallet sekali pakai (tanpa dana) dan mengarsipkan agent QA di akhir.

## 5. Update, backup, rollback
- **Update:** push ke `main`, lalu Deploy di Coolify (atau aktifkan Auto Deploy). Migration baru jalan otomatis.
- **Backup database:** file SQLite ada di volume `harvex-data`, di bawah `/data/v3/d1/`. Contoh backup dari server:
```bash
docker run --rm -v <nama-volume-harvex-data>:/data -v $PWD:/backup alpine tar czf /backup/harvex-data-$(date +%F).tgz -C /data .
```
  Nama volume bisa dilihat di Coolify pada tab Storages, atau dengan `docker volume ls`.
- Backup harian otomatis ada di dalam volume yang sama (`/data/backups`). Salin juga secara rutin ke luar server, misalnya dengan perintah `tar` di atas dari cron host, atau dengan fitur backup Coolify. Kalau volume rusak, backup yang ada di dalam volume ikut hilang.
- **Restore:** stop container, salin `harvex-YYYY-MM-DD.sqlite` menimpa file `<hash>.sqlite` di `/data/v3/d1/miniflare-D1DatabaseObject/`, hapus file `-wal`/`-shm` di sebelahnya, lalu start lagi.
- **Rollback kode:** pilih deployment sebelumnya di Coolify. Migration tidak di-rollback, karena semuanya hanya menambah tabel.

## 6. Production nanti (domain utama, contoh: harvex.studio)
Buat **resource terpisah** dari repo yang sama:
- Domain `https://harvex.studio:8787`
- `APP_ORIGIN=https://harvex.studio`
- `BETTER_AUTH_SECRET` baru
- Volume sendiri (dibuat otomatis per resource)

Mode noindex otomatis mati karena domainnya tidak diawali `preview.`. Kalau perlu, bisa dipaksa dengan `HARVEX_NOINDEX=true` atau `false`.

Alternatif production tetap Cloudflare Workers + D1 asli (DEPLOY-ID.md).

## 7. Keamanan server
App ini menyimpan saldo credit dan (nanti) menentukan siapa boleh klaim reward. Siapa pun yang bisa masuk ke server atau
panel Coolify bisa membaca semua secret dan mengubah database, jadi server-nya dijaga seperti dompet:
- **Panel Coolify hanya lewat HTTPS** dengan domain sendiri (Settings → Instance domain), lalu tutup port `8000`, `6001`
  dan `6002` dari internet di firewall. Login panel lewat HTTP biasa mengirim password dan semua env tanpa enkripsi.
- **SSH dengan kunci saja:** `PasswordAuthentication no` dan `PermitRootLogin prohibit-password` di
  `/etc/ssh/sshd_config`, lalu `systemctl restart ssh`. Pastikan kunci SSH kamu sudah terpasang sebelum mematikan password.
- Firewall: hanya `22`, `80` dan `443` yang terbuka. Aplikasi lain di server yang sama berbagi risiko yang sama.
- Aktifkan 2FA di akun Coolify, GitHub, registrar domain dan penyedia server.
- Container berjalan tanpa hak tambahan (`no-new-privileges`, `cap_drop: ALL`). Proxy depannya membuang header identitas
  dan `cf-*` dari luar, menolak body di atas 1 MB, dan menutup `/cdn-cgi/*`. `HARVEX_TRUST_CF_HEADERS` biarkan kosong
  kecuali domain memang lewat proxy Cloudflare dan server tidak bisa dijangkau langsung.
- Secret yang pernah tampil di chat, tangkapan layar atau perangkat yang kena malware dianggap bocor. Ganti dari
  perangkat yang bersih: `BETTER_AUTH_SECRET` (semua user login ulang), `CLAIMS_ADMIN_TOKEN`, key AI, key RPC.
- Salin `/data/backups` ke luar server secara rutin (bagian 5).

## Masalah umum
- **Live AI gagal dengan `internal error; reference = …`:** koneksi HTTPS keluar dari workerd gagal.
  - Image sekarang memasang `ca-certificates`, jadi cukup redeploy dengan build baru (jangan pakai cache image lama).
  - Cek dengan `curl -X POST https://<domain>/api/ai/check -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN"`. Bagian `network` di hasilnya membandingkan HTTP dan HTTPS:
    - HTTP gagal juga: masalahnya DNS atau jaringan server.
    - Hanya HTTPS yang gagal: masalahnya sertifikat.
| Gejala | Penyebab |
| --- | --- |
| Container langsung berhenti dengan pesan `[harvex] ...` | Pesannya menyebut env var yang salah atau kosong. |
| Semua tombol simpan membalas "Please use this workspace…" (403) | `APP_ORIGIN` tidak sama persis dengan URL di browser (cek https, www, dan `/` di akhir). |
| Bad Gateway | Domain di Coolify belum diberi `:8787`, atau container belum sehat (tunggu sekitar 60 detik setelah start). |
| "No browser wallet found" | Di desktop, pasang extension (MetaMask, Rabby). Di HP, buka situs lewat browser dApp di aplikasi wallet (MetaMask, Trust Wallet, OKX Wallet, Coinbase Wallet). |
