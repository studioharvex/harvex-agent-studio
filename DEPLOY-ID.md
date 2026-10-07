# Deploy Harvex (Cloudflare Workers + D1)

Panduan ini untuk hosting di akun Cloudflare-mu sendiri. Semua kunci rahasia dimasukkan
langsung ke Cloudflare, tidak pernah ditulis di file project.

`harvex.example` di panduan ini hanya domain contoh (belum ada situs yang di-deploy). Ganti dengan
domain milikmu di semua langkah. Bagian 6 (AI) dan 7 (chain) juga berlaku untuk Docker/Coolify: di sana variabelnya
diisi di env container (mulai dari `.env.compose.example`), bukan lewat `wrangler secret`.

## 0. Yang harus sudah ada
- Domain sendiri (di contoh: `harvex.example`).
- Akun Cloudflare (gratis cukup untuk mulai; Workers Paid $5/bulan disarankan untuk produksi).
- Akun OpenAI Platform dengan saldo (untuk skill AI). Boleh dilewati dulu; skill akan memakai
  contoh alur sampai diaktifkan.
- Node.js 22+ di komputermu, lalu `npm ci` di folder project.

## 1. Arahkan domain ke Cloudflare
1. Cloudflare dashboard → **Add a domain** → domainmu → paket Free.
2. Cloudflare memberi dua nameserver. Masukkan di registrar tempat kamu beli domain
   (Porkbun/Namecheap: menu Nameservers → ganti ke nameserver Cloudflare).
3. Tunggu status domain di Cloudflare jadi **Active** (biasanya beberapa menit sampai beberapa jam).

## 2. Login wrangler dan buat database
```sh
npx wrangler login
npx wrangler d1 create harvex-studio-db
```
Perintah kedua mencetak `database_id`. Salin.

## 3. Isi deploy.config.json
```sh
cp deploy.config.example.json deploy.config.json
```
Edit: tempel `d1DatabaseId`, dan pastikan `domain` serta `origin`.

## 4. Build, migrasi database, deploy
```sh
npm run build
npm run deploy:migrate      # menjalankan SEMUA drizzle/*.sql (0000 sampai terbaru) ke database REMOTE (sekali, database baru)
npm run deploy              # deploy Worker + pasang domain dan www
```
Kalau nanti ada migration baru, jalankan `node scripts/deploy.mjs --migrate <nomor>` (misalnya `--migrate 35`
menjalankan 0035 dan sesudahnya) supaya yang lama tidak diulang. Tabel fitur chain ada di `drizzle/0005_chain.sql`
dan migration sesudahnya; semuanya sudah ikut di langkah pertama.

## 5. Login: khusus wallet (BNB Smart Chain)
Login hanya lewat wallet: Sign-In with Ethereum untuk BNB Smart Chain (chain 56 di mainnet, 97 di testnet).
Tidak ada email maupun password.

Wallet yang bisa dipakai: MetaMask, Coinbase Wallet, Trust Wallet, Rabby, OKX Wallet, dan wallet lain yang terpasang
di browser (EIP-6963). Di HP, buka situs lewat browser dApp di aplikasi wallet-nya.

Server hanya menerima pesan yang ditandatangani untuk chain ID yang sedang dipakai (`CHAIN_NETWORK`).
Tabel login (`drizzle/0004_better_auth.sql`) sudah ikut di langkah 4. Set secret-nya:
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npx wrangler secret put BETTER_AUTH_SECRET --config dist/server/wrangler.deploy.json
```
Pastikan `APP_ORIGIN` = alamat situsmu, misalnya `https://harvex.example` (domain SIWE harus sama dengan domain situs).


## 6. Aktifkan AI (opsional, kapan saja)

**Claude (disarankan).** Urutan provider: Claude → OpenAI → OpenAI-compatible → gateway; yang pertama terisi dipakai.

Langganan Claude Pro/Max (termasuk Max 20x) **tidak bisa** dipakai sebagai AI di server ini. Langganan itu untuk
pemakaian kamu sendiri di aplikasi Claude, bukan untuk melayani user lain dari server. Token langganan
(`sk-ant-oat...`) ditolak saat container start. Yang dipakai adalah API key dari Claude Console, dibayar per token:
1. console.anthropic.com → Billing → beli kredit (prepaid) → Settings → Limits: set **spend limit bulanan**.
   Ini batas keras tagihan: kalau habis, API berhenti dan run live gagal lalu di-refund otomatis.
2. Settings → API keys → buat key (`sk-ant-api03-...`). Isi hanya di env server (secret Worker atau env Coolify), jangan di repo atau chat.
3. Env:
   | Variabel | Default | Arti |
   |---|---|---|
   | `AI_ENABLED` | `false` | `true` untuk menyalakan Live AI |
   | `ANTHROPIC_API_KEY` | kosong | key dari Console |
   | `ANTHROPIC_MODEL` | `claude-opus-5-5` | Opus 5.5 ($4/$20 per 1 juta token input/output). `claude-sonnet-5-5` ($2/$10) lebih murah |
   | `ANTHROPIC_EFFORT` | `medium` | `low` lebih hemat token untuk tugas ringan; `high` lebih dalam |
   | `ANTHROPIC_MAX_TOKENS` | `8000` | batas output per run (termasuk thinking), jadi batas biaya per run (Opus: maks. ~$0,16 output) |
   | `LIVE_RUN_COST` | `5` | kredit per live run milik sendiri (100 kredit = 1 USDT, jadi 5 = $0,05) |
   | `LIVE_DAILY_PER_USER` | `50` | live run manual per akun per hari (UTC) |
   | `AI_DAILY_RUNS` | `2000` | total live run per hari (UTC) untuk seluruh studio, termasuk jadwal. Tidak bisa dimatikan (minimal 1) |
   | `AI_DAILY_FREE_RUNS` | kosong = 70% dari `AI_DAILY_RUNS` | bagian `AI_DAILY_RUNS` yang boleh dipakai bersama oleh akun TANPA credit beli. Wallet baru = akun gratis baru, jadi tanpa ini akun-akun gratis bisa menghabiskan jatah sehari dan mengunci user yang membayar |
   | `AI_DAILY_SEARCH_RUNS` | `150` | run research per hari (seluruh studio) yang boleh memakai web search; `0` = tidak pernah. Lewat batas, research tetap menjawab tanpa browsing dan mengatakannya. Web search ditagih per query di luar token: 150 per hari kira-kira masih di dalam jatah gratis Google (5.000 per bulan di paid tier) |
   | `AI_SEARCH_FREE_CREDITS` | `true` | `false` = hanya akun yang punya credit beli yang memakai web search; akun gratis mendapat jawaban tanpa browsing (layar Run memberi tahu sebelum dijalankan) |
   | `SKILL_TRIAL_LIMIT` | `0` | percobaan per skill per akun untuk run manual; `0` = tanpa batas (kredit dan batas harian yang menentukan) |
4. Skill Web research memakai web search Anthropic (maks. 3 pencarian per run, $10 per 1.000 pencarian) dan
   menampilkan sumbernya. Kalau Claude menolak tugas, API otomatis mencoba model cadangan (server-side fallback);
   kalau tetap ditolak, run gagal dan kredit dikembalikan. Jawaban yang terpotong karena batas token tetap dikirim
   dengan catatan di akhirnya.

**Harga dan credit gratis:**
- `STARTING_CREDITS=25`: credit gratis untuk akun baru (2 research atau 5-6 tugas ringan). Maks. ±$0,05 biaya AI per
  akun baru. Setiap wallet baru = akun baru, jadi pengaman sebenarnya tetap `AI_DAILY_RUNS`.
- `LIVE_SKILL_COSTS=research=12,document=6,code=6,write=5,summarize=4,translate=4,brainstorm=4,planner=4`: harga live AI
  per skill (1 credit = $0,01 saat top-up aktif). Skill yang tidak disebut memakai `LIVE_RUN_COST`; nilai `flat` membuat
  semua skill memakai `LIVE_RUN_COST`. Run terjadwal membayar harga skill, minimal `SCHEDULE_RUN_COST`.
- Refill dan jendela 5 jam (drizzle/0015): `FREE_REFILL_CREDITS=25` + `FREE_REFILL_HOURS=24` (bagian credit gratis diisi
  kembali sampai 25, credit beli tidak disentuh, tidak menumpuk); `LIMIT_WINDOW_HOURS=5`,
  `HEAVY_SKILLS=research,document,code`, `FREE_HEAVY_PER_WINDOW=2`, `PAID_HEAVY_PER_WINDOW=20` (paid = masih punya credit
  beli). Atomik di ai_quotas. Credit run yang gagal selalu kembali; jatahnya hanya kembali kalau provider belum
  menghasilkan apa pun (lihat lapisan batas di bawah). Tes lokal: `scripts/verify-free-tier.mjs`.
- `AI_MODEL_FREE=gemini-3.1-flash-lite,gemini-3.5-flash-lite`: run yang dibayar penuh dengan credit gratis memakai model
  ini (lebih murah); run yang memakai credit beli memakai `AI_MODEL` (3.5 Flash-Lite).
- Tes: `scripts/verify-ai-compat.mjs` (routing model). `verify-market.mjs` dan `verify-chain.mjs` butuh server dengan
  `STARTING_CREDITS=250` (hitungannya memakai harga agent 200-400).

Lapisan batas pemakaian (dari yang paling dekat ke user):
- kredit per run (`LIVE_RUN_COST`) dan saldo kredit user;
- `LIVE_DAILY_PER_USER` live run per akun per hari (dan `SKILL_TRIAL_LIMIT` kalau diisi);
- `AI_DAILY_RUNS` untuk seluruh studio per hari, dan `AI_DAILY_FREE_RUNS` untuk akun tanpa credit beli. Semua batas
  harian dihitung atomik di database (drizzle/0013): request bersamaan tidak bisa menembusnya
  (`scripts/verify-ai-limits.mjs`). Run yang gagal selalu mendapat credit-nya kembali. Jatah hariannya hanya kembali
  kalau provider menolak sebelum menghasilkan apa pun (error HTTP). Run yang gagal setelah provider bekerja, atau yang
  terputus di tengah jalan, sudah ditagih ke operator, jadi tetap dihitung: gagal dengan sengaja tidak memberi AI gratis;
- biaya terburuk per hari = `AI_DAILY_RUNS` × biaya maksimal satu run (Gemini Flash-Lite ±$0,002 → 2000 run ≈ $4;
  Claude Opus dengan `ANTHROPIC_MAX_TOKENS=8000` maks. ±$0,17 → turunkan `AI_DAILY_RUNS` kalau pakai Claude);
- spend limit bulanan di Claude Console (batas keras tagihan).

**Supaya tagihan AI tidak bisa meledak (Gemini; angka harga di bawah adalah catatan lama, cek harga terbaru di Google):**
- Banyak API key TIDAK menambah kapasitas dan tidak melindungi biaya: batas Google berlaku per project, bukan per key,
  dan memecah pemakaian ke banyak project/akun gratis untuk menghindari batas melanggar ketentuan API Google (akun bisa
  diblokir). Satu key berbayar, dibatasi dari sisi kita, itu yang benar.
- Plafon mutlak: saldo Prepay tanpa auto-reload. Tagihan tidak pernah lebih dari saldo; saat $0 semua AI berhenti (402)
  dan credit user dikembalikan. Tambahkan spend cap per project di AI Studio.
- Plafon harian dari env: biaya terburuk per hari = `AI_DAILY_FREE_RUNS` × biaya run model gratis + pencarian.
  Satu run paling mahal (output penuh `AI_MAX_TOKENS=8000`): `gemini-3.1-flash-lite` ±$0,012, `gemini-3.5-flash-lite`
  ±$0,02, `gemini-3.5-flash` ±$0,075; run biasa sekitar seperlimanya. Contoh aman untuk saldo kecil:
  `AI_DAILY_RUNS=300`, `AI_DAILY_FREE_RUNS=150`, `AI_DAILY_SEARCH_RUNS=150` → paling buruk ±$2-4 per hari dari akun
  gratis, biasanya di bawah $1. Run yang dibayar credit beli ditutup oleh credit itu (riset 12 credit = $0,12).
- Pencarian web punya plafon sendiri (`AI_DAILY_SEARCH_RUNS`) karena ditagih per query: tanpa plafon, akun-akun gratis
  bisa menghabiskan 5.000 pencarian gratis sebulan dalam satu-dua hari, lalu tiap 1.000 pencarian $14.

Perkiraan biaya per run dengan Opus 5.5 dan effort medium: ~$0,01-0,05 untuk tugas biasa, lebih untuk research.
Kalau `LIVE_RUN_COST=5` ($0,05) terasa tipis, naikkan ke 10 atau pakai Sonnet 5.5.

**OpenAI**
1. platform.openai.com → Billing → isi saldo → API keys → buat key.
2. Masukkan:
```sh
npx wrangler secret put OPENAI_API_KEY --config dist/server/wrangler.deploy.json
```
3. Di `deploy.config.json` set `"aiEnabled": true` (dan model yang kamu mau), lalu `npm run deploy` lagi.
Batas pengaman: `LIVE_DAILY_PER_USER` dan `AI_DAILY_RUNS` (tabel di atas), dan kamu bisa set batas pengeluaran di OpenAI.

**Demo gratis: provider OpenAI-compatible** (`AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`, dengan `AI_ENABLED=true`):

| Provider | AI_BASE_URL | Contoh AI_MODEL | Catatan |
|---|---|---|---|
| Google Gemini (AI Studio) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.5-flash-lite,gemini-3.1-flash-lite` | **Pilihan AI murah** (`.env.compose.example` sudah diisi ini). Pakai key paid tier: di free tier data bisa dipakai Google untuk perbaikan produk |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Sangat cepat, free tier dengan batas per menit dan per hari |
| OpenRouter | `https://openrouter.ai/api/v1` | model berakhiran `:free` | Pilihan model banyak, tapi kuota gratisnya kecil |

- Nama model bisa berubah atau dipensiunkan (404). Cek daftar model terbaru di dashboard provider.
- `AI_MODEL` boleh berisi sampai 3 model, dipisah koma. Kalau model pertama sedang ramai (503/429), sudah pensiun (404) atau timeout, app otomatis mencoba model berikutnya. Model Gemini terbaru sering 503 di free tier saat jam sibuk.
- `AI_REASONING_EFFORT` (opsional, Gemini Flash-Lite: `minimal`/`low`/`medium`/`high`) membatasi token "thinking" yang ikut ditagih. `.env.compose.example` memakai `low`. Kosong = tidak dikirim (untuk provider yang tidak mengenal field ini).
- Jawaban yang terpotong di batas token (`finish_reason: length`) tidak ditampilkan: app mencoba model berikutnya, lalu mengembalikan kredit kalau semua gagal (`node --experimental-strip-types --no-warnings scripts/verify-ai-compat.mjs`).
- **Biaya Gemini 3.5 Flash-Lite** (model utama di `.env.compose.example`; catatan lama $0,30 input / $2,50 output per 1 juta token, cek lagi):
  ±$0,005 per run biasa, ±$0,02-0,035 per run research (termasuk 1-2 query Google Search, $14 per 1.000 setelah 5.000
  query gratis per bulan). 1.000 user × 3 run per hari (20% research) ≈ $30 per hari ≈ $800-900 per bulan; batas keras
  `AI_DAILY_RUNS=3000` ≈ maks. $35 per hari. Cadangan 3.1 Flash-Lite ($0,25 / $1,50) lebih murah. Pasang budget alert di
  Google Cloud Billing.
- Tanpa `AI_WEB_SEARCH`, skill Web research di jalur ini menjawab dari pengetahuan model (tanpa browsing live) dan menyebutkannya.
- **`AI_WEB_SEARCH=google`** (sudah di `.env.compose.example`): khusus skill research, Gemini mencari lewat **Grounding with Google Search**
  (API Interactions, key yang sama). Skill lain tetap lewat jalur chat yang murah.
  - Biaya: ditagih per query pencarian (Gemini 3: ±$14 per 1.000 query setelah kuota gratis bulanan). Satu run research
    biasanya 1-2 query, jadi ±$0,02-0,03 per run.
  - Aturan Google: jawaban wajib tampil bersama widget **Search Suggestions** dari Google, tanpa diubah, dan hanya untuk
    user yang bertanya. App menyimpan widget itu bersama output (`lib/grounding.ts`) dan menampilkannya di iframe sandbox di
    bawah jawaban. Copy/Download hanya menyalin teks. Hasil boleh disimpan maksimal 2 tahun (riwayat chat).
  - Model sibuk: app mencoba model berikutnya. **Kuota pencarian ditolak di semua model** (HTTP 429): research tetap
    menjawab, tetapi TANPA browsing dan mengatakannya di jawaban; di log muncul `Harvex research: Google Search quota refused`.
    Ini yang terjadi kalau key masih free tier: Google Search tidak tersedia di free tier untuk Gemini 3.x, dan
    jawaban tanpa browsing bisa basi atau salah.
  - **Cara menyalakannya tanpa tagihan otomatis: Prepay (isi saldo manual).** Google AI Studio → API keys → *Set up
    billing* → pilih atau buat billing account → metode bayar → pilih **Prepay** → beli credit (minimal $5, berlaku
    1 tahun, tidak bisa di-refund). Auto-reload opsional; biarkan mati kalau mau isi manual. Setelah itu key masuk paid
    tier: 5.000 pencarian Google per bulan gratis (dipakai bersama semua model Gemini 3.x), lalu $14 per 1.000. Env tidak
    perlu diubah.
  - **Yang berubah setelah Prepay:** semua pemakaian token ikut dipotong dari saldo (Flash-Lite ±$0,005 per run), dan
    saat saldo $0 SEMUA key berhenti dengan HTTP 402, tidak kembali ke free tier. Run live lalu gagal dan credit user
    dikembalikan; di log muncul `HTTP 402 (the prepaid balance at the AI provider is used up…)`. Pasang spend cap per
    project di AI Studio dan isi ulang sebelum habis.
  - Kecepatan tiap model berbeda jauh. Model pertama di `AI_MODEL` menentukan lama menunggu user; taruh model yang
    cepat di depan dan ukur sendiri setelah billing aktif.
  - Tes tanpa biaya: `node --experimental-strip-types --no-warnings scripts/verify-ai-compat.mjs`.
- `AI_MAX_TOKENS` (default 8000, termasuk thinking): batas output per run. Terjemahan 12.000 karakter atau kode yang
  diberi komentar lengkap butuh beberapa ribu token; jawaban yang terpotong di semua model tetap dikirim dengan catatan
  di akhirnya (sudah ditagih provider, jadi tidak dikembalikan).
- **Cek semua skill dengan AI asli** setelah key dipasang (±$0,05 per jalan, di shell server atau laptop, jangan
  tempel key ke chat). Setiap skill dijalankan sekali dengan tugas contoh dan dicek hasilnya:
  ```sh
  AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai AI_API_KEY=... AI_MODEL=gemini-3.5-flash-lite,gemini-3.1-flash-lite AI_REASONING_EFFORT=low AI_WEB_SEARCH=google node --experimental-strip-types --no-warnings scripts/verify-skills-live.mjs
  ```
  Bandingkan beberapa model sekaligus (semua skill per model, laporan berdampingan di `exports/skills-compare-*.md`),
  tambahkan misalnya `--compare gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.8-flash` (±$0,10-0,20 total).
  Baca jawabannya, lalu pilih model termurah yang hasilnya sudah memuaskan untuk `AI_MODEL`.
- Key hanya diisi di env server, tidak pernah di frontend, repo atau chat.
- **Cek AI setelah deploy.** Kalau run Live AI gagal ("The task failed. Any credits were returned."), jalankan:
  ```sh
  curl -X POST https://<domain>/api/ai/check -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN"
  ```
  Hasilnya menunjukkan provider, model dan host yang dipakai, serta pesan error asli dari provider (key tidak ikut ditampilkan). Contoh penyebab umum:
  - key salah;
  - nama model sudah tidak ada;
  - `AI_BASE_URL` salah;
  - kuota free tier habis.
  Error yang sama juga muncul di log server (Coolify → Logs) dengan awalan `Harvex AI run failed:`.

## 7. BNB Smart Chain: top-up, klaim, holder tier, reward (opsional, default OFF)
Semua fitur chain mati sampai variabel di bawah diisi. Mulai dari **testnet** (chain 97), jangan langsung mainnet.

> **Status jujur.** Belum ada yang di-deploy atau dites di BNB Smart Chain, baik testnet maupun mainnet: belum ada
> token HARVEX, kontrak klaim, vault reward maupun Safe. Kontrak `HarvexClaims` belum diaudit dan belum ada review hukum.
> Tes yang ada hanya tes di chain lokal (START-HERE-ID.md); tes itu ditulis untuk pengaturan chain sebelumnya dan belum
> dijalankan ulang untuk salinan ini.

**Yang perlu diketahui tentang chain ini**
- BNB Smart Chain adalah L1 dengan validator sendiri. Mainnet chain id 56, testnet 97. Gas dibayar dengan **BNB**.
- Blok kira-kira tiap 0,45 detik (sekitar 8.000 blok per jam). Tag blok `safe` dan `finalized` tersedia dan tercapai
  dalam beberapa detik.
- Explorer: mainnet https://bscscan.com, testnet https://testnet.bscscan.com (`/tx/`, `/address/`, `/token/`). Alamat
  kontrak hanya boleh disalin dari sana, bukan dari chat, iklan atau hasil pencarian.
- RPC publik resmi (`https://bsc-dataseed.bnbchain.org`, testnet `https://bsc-testnet-dataseed.bnbchain.org`) **menolak
  `eth_getLogs`** ("limit exceeded") dan tidak menyimpan state lama (diukur 5 Okt 2026). Jadi server butuh
  `CHAIN_RPC_URL` dari provider RPC (misalnya Alchemy, QuickNode, Ankr atau NodeReal; belum ada yang dites untuk project
  ini) dengan akses archive.
- Multicall3 ada di mainnet dan testnet di alamat kanoniknya `0xcA11bde05977b3631167028862bE2a173976CA11` (kodenya ada,
  dicek 5 Okt 2026). Server memakainya untuk membaca banyak nilai di satu blok.

**Token pembayaran (top-up)**
- Mainnet: USDT di BNB Smart Chain (di explorer tampil sebagai BSC-USD), **18 desimal, bukan 6**:
  `0x55d398326f99059fF775485246999027B3197955` (desimalnya dibaca on-chain 5 Okt 2026). Cocokkan sendiri alamat ini di
  bscscan.com sebelum dipakai.
- Testnet: tidak ada USDT resmi. Deploy token tiruan dan HarvexClaims sendiri:

```sh
EVM_TOOLS=../evm-tools OWNER_ADDRESS=0xWalletAtauMultisigKamu node scripts/deploy-testnet.mjs
```
Tentang script itu:
- Run pertama membuat **key deployer sekali pakai** di `.wrangler/testnet-deployer.json` (di-ignore Git) lalu berhenti sambil menampilkan alamatnya.
- Isi alamat itu dengan BNB testnet (tBNB) dari faucet testnet BNB Chain, lalu jalankan lagi.
- Hasilnya berupa baris env siap tempel. Token tiruannya: tUSDT (18 desimal, seperti USDT di mainnet), tHARVEX, dan
  tRWD sebagai pengganti token reward (yang aslinya belum dipilih), plus dua HarvexClaims.
- Jangan pernah memakai private key wallet pribadimu untuk script ini.

| Variabel | Isi |
| --- | --- |
| CHAIN_NETWORK | `testnet` (default) atau `mainnet` |
| CHAIN_RPC_URL | RPC server dari provider (tidak pernah dikirim ke browser). Dalam praktik wajib: RPC publik resmi menolak `eth_getLogs` dan tidak menyimpan state lama. Pakai paket dengan akses archive: tier bulanan membaca saldo HARVEX di blok snapshot awal bulan dan reward membaca riwayat. Kalau tidak bisa, klaim tier gagal dengan pesan "Could not read HARVEX balances at this month's snapshot" dan alasannya ada di log. |
| CHAIN_LOGS_RPC_URL | Opsional. RPC khusus untuk membaca log Transfer (pencatat holder, isi ulang vault). Kosong = memakai `CHAIN_RPC_URL`. Isi hanya kalau provider utama membatasi `eth_getLogs` terlalu ketat; server mengecilkan rentang blok sendiri kalau sebuah rentang ditolak. |
| PAY_TOKEN_ADDRESS | alamat USDT di chain itu. Default `PAY_TOKEN_SYMBOL=USDT` dan `PAY_TOKEN_DECIMALS=18`. Desimal yang salah membuat semua top-up salah harga. Di mainnet container hanya menerima alamat USDT di atas. |
| TOPUP_TREASURY | alamat multisig penerima top-up |
| CREDITS_PER_TOKEN | default 100 (1 USDT = 100 credit, juga kurs klaim) |
| TOPUP_FINALITY | `safe` (default): kredit masuk setelah blok transaksinya berstatus safe, beberapa detik. `finalized`: beberapa detik lebih lama. `soft`: receipt + N blok, hanya untuk tes (container menolaknya di mainnet). Kalau user menutup halaman sebelum selesai, scheduler menyelesaikannya sendiri. |
| TOPUP_MIN_CONFIRMATIONS | jumlah blok untuk mode `soft`, default 3 |
| CLAIMS_ENABLED | `true` untuk membuka antrean klaim |
| CLAIMS_CONTRACT | alamat HarvexClaims yang sudah di-deploy (contracts/HarvexClaims.sol, owner = multisig). Belum ada. |
| CLAIMS_ADMIN_TOKEN | token acak 32+ karakter untuk /api/claims/epoch dan /api/rewards/admin (secret) |
| HARVEX_TOKEN_ADDRESS | alamat token HARVEX di mainnet (token ini belum ada). Kosong = kotak CA di halaman depan menulis "Not deployed yet" dan tier tetap Free. Diisi = kotak CA dan teks status di situs menampilkan alamatnya dan holder tier aktif, tanpa mengubah kode (lihat COOLIFY-ID.md bagian 4b-3) |

Di Cloudflare isi lewat `npx wrangler secret put NAMA --config dist/server/wrangler.deploy.json` (atau Variables di
dashboard Worker); di Docker/Coolify lewat env container.

**Keamanan top-up.** Yang dijaga kode: credit hanya bertambah dari USDT asli yang masuk ke treasury dari wallet milik
akun itu, sekali saja, dibulatkan ke bawah (1 USDT = 100 credit). Ditolak: hash yang dipakai ulang (juga request
bersamaan), hash orang lain, token palsu bernama "USDT", transaksi gagal, wallet yang belum di-link, `transferFrom`
oleh pihak ketiga, penerima selain treasury, jumlah di bawah 1 credit, hash yang tidak ada di chain (tidak masuk
antrean), dan wallet yang pindah akun. Tesnya ada untuk chain lokal dan belum dijalankan ulang untuk salinan ini (token
bayar sekarang 18 desimal); jalankan sampai lolos sebelum testnet dan sebelum mainnet:
```sh
EVM_TOOLS=../evm-tools BASE=http://localhost:5173 ROUNDS=5 node scripts/verify-topup-security.mjs
```

Alur klaim tiap epoch (operator), setelah `CLAIMS_CONTRACT` ada:
```sh
curl -X POST https://harvex.example/api/claims/epoch -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"build"}'
# multisig memanggil HarvexClaims.setMerkleRoot(root) dan mengisi kontrak dengan USDT secukupnya
curl -X POST https://harvex.example/api/claims/epoch -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"publish","epoch":1,"txHash":"0x…"}'
```
HarvexClaims BELUM diaudit secara independen (review internal: contracts/SECURITY-REVIEW.md). Audit dulu sebelum mainnet. Server tidak pernah memegang private key yang bisa memindahkan dana.

Sebelum `CLAIMS_ENABLED=true` di produksi, cek database dulu (terminal container, read-only). Yang bisa diklaim hanya
penghasilan yang dibayar dengan credit beli, dan server menolak membangun epoch kalau total klaim melebihi credit yang
pernah dibeli di chain ini atau kalau kontrak tidak sanggup membayar semuanya (full-or-wait):
```sql
SELECT chain_id,COUNT(*),SUM(credits) FROM topups GROUP BY chain_id;   -- credit yang pernah dibeli, per chain
SELECT SUM(paid),SUM(earned_paid) FROM preview_wallets;                -- credit beli yang masih beredar / penghasilan yang bisa diklaim
SELECT status,COUNT(*),SUM(credits) FROM claims GROUP BY status;       -- harus kosong sebelum klaim pertama dibuka
```
Epoch terikat ke satu `CLAIMS_CONTRACT` dan satu chain: mengganti kontrak setelah epoch pertama ditolak server.

### Holder rewards (ada di kode, OFF, token reward belum dipilih)
Empat bagian: pencatat holder, penghitung reward, kontrak distribusi (vault), dashboard. Detail teknis dan keamanan:
`REWARDS-ID.md`. Urutan menyalakannya: `GO-LIVE-HARVEX-ID.md`.

Yang harus ada dulu: token HARVEX, **keputusan token reward** (BEP-20 apa saja; belum dipilih), vault reward (HarvexClaims
KEDUA, owner = multisig, bukan `CLAIMS_CONTRACT`), audit kontrak dan review hukum. Variabelnya:
- `REWARDS_ENABLED=true` (terakhir), `HARVEX_TOKEN_ADDRESS`;
- `REWARD_TOKEN_ADDRESS` = token yang dibayarkan; `REWARD_TOKEN_SYMBOL` (default `USDT`, hanya label di layar) dan
  `REWARD_TOKEN_DECIMALS` (default 18) harus cocok dengan token itu. Di mainnet container menolak start kalau tokennya
  bukan USDT tetapi simbol dan desimalnya tidak diisi;
- `REWARD_CONTRACT` = vault; `REWARD_START_BLOCK` = blok deploy token HARVEX; `REWARD_EXCLUDE` = tim, treasury, pool
  likuiditas.

Aturan bawaan (tarif tetap):
- Setiap **3.000.000 HARVEX** yang di-hold = **$0,01 token reward per jam** (6 juta = $0,02, 9 juta = $0,03).
  - Unit dihitung bulat: 1.499.999 HARVEX = 0 unit, 2.999.999 = 1 unit.
  - Dihitung per detik dari riwayat transfer HARVEX. HARVEX yang dipindah ke wallet lain tidak pernah dihitung dua kali,
    dan beli sebentar sebelum jam ditutup hanya dapat hitungan detiknya.
- Nilai dolarnya tetap; jumlah token reward mengikuti harga token itu saat jam diselesaikan.
- Variabel: `REWARD_HARVEX_PER_UNIT=3000000`, `REWARD_USD_PER_UNIT_HOUR=0.01`, `REWARD_PRICE_MAX_AGE_HOURS=72`,
  `REWARD_PERIOD_HOURS=1`. Setelah mengubah `REWARD_HARVEX_PER_UNIT`: redeploy, lalu jalankan aksi `rebuild` di
  `/api/rewards/admin` supaya unit tiap wallet dihitung ulang. Jam yang sudah terbit tidak berubah. Variabel lama
  (`REWARD_MIN_HOLD*`, `REWARD_DRIP_HOURS`, `REWARD_SPLIT`, `REWARD_PERIOD_DAYS`) tidak dipakai; container menulis
  peringatan kalau masih diisi.

**Harga token reward.** Dua cara:
- `REWARD_PRICE_FEED` diisi (feed Chainlink USD untuk token itu di BNB Smart Chain, 8 desimal; salin alamatnya dari
  direktori feed Chainlink dan cocokkan di bscscan.com): harga dibaca tiap jam diselesaikan dan tiap 15 menit untuk
  dashboard.
- `REWARD_PRICE_FEED` kosong: harga diisi manual lewat API admin, misalnya `{"action":"price","price":"1.00"}`.

Pengaman yang berlaku di kedua cara:
- Lompatan 50% atau lebih dari harga terakhir tidak langsung dipakai. Jam menunggu sampai kamu setujui
  (`{"action":"price","fromFeed":true,"confirm":true}` untuk feed).
- Harga lebih tua dari `REWARD_PRICE_MAX_AGE_HOURS` (72 jam) dibanding akhir jamnya: jam menunggu sampai ada harga
  baru, lalu semua jam yang tertunda diselesaikan sekaligus. Tidak ada yang hilang.
- Kalau kontrak token reward punya fungsi `oraclePaused()` dan nilainya true, server tidak menyelesaikan jam selama
  itu. Token tanpa fungsi itu tidak terpengaruh.

**Isi ulang vault (manual).** Kirim token reward ke `REWARD_CONTRACT`, lalu catat tx-nya (untuk riwayat di dashboard):
```sh
curl -X POST https://harvex.example/api/rewards/admin -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"fund","txHash":"0x…"}'
```
- Selama reward menyala, scheduler juga membaca sendiri transfer token reward ke vault dari chain, jadi isi ulang
  yang lupa dicatat tetap masuk riwayat (dan tidak pernah terhitung dua kali).
- Jam hanya diselesaikan kalau saldo vault cukup untuk membayar penuh semua yang terutang (full-or-wait).
  Kalau kurang, jam menunggu; setelah diisi, jam yang tertunda ikut diselesaikan.
- Dashboard menunjukkan status vault: Funded, Low (kurang dari sehari) atau "Needs a refill".
- Cek kapan saja: `GET /api/rewards/admin` (harga, umur harga, estimasi jam berjalan, cukup/tidaknya vault) atau
  `{"action":"preview"}`.

Dengan `REWARD_AUTO=true` (default), scheduler di container:
- menyinkronkan pencatat holder tiap 2 menit;
- menyelesaikan jam yang baru ditutup;
- memasang root di vault kalau `REWARD_ROOT_POSTER_KEY` diisi;
- mem-publish periode begitu root-nya terbaca di kontrak.

Yang tetap manual: isi ulang vault, harga (kalau tanpa feed), dan, tanpa root poster, multisig yang memanggil
`setMerkleRoot(root)` (root ada di `GET /api/rewards/admin`).

**Soal "klaim tiap jam":**
- Reward dihitung tiap jam, tapi holder baru bisa mengklaimnya setelah root terbaru terpasang di vault.
- Tiap root mencakup semua jam sebelumnya, jadi tidak ada jam yang hilang kalau root dipasang lebih jarang.
- Supaya klaim benar-benar tersedia tiap jam ada dua jalan: multisig memasang root tiap jam, atau **root poster**
  (`REWARD_ROOT_POSTER_KEY`): kunci khusus di server yang HANYA bisa memanggil `setMerkleRoot` di vault. Root
  menentukan siapa boleh klaim, jadi kunci ini tetap berisiko kalau bocor; karena itu vault wajib punya batas payout
  (`setPayoutLimit`) lebih dulu, dan server menolak memasang root tanpa batas itu. Kunci ini hanya diberi sedikit BNB
  untuk gas dan tidak pernah memegang token reward. Langkahnya: `VAULT-MAINNET-ID.md` Langkah 6.

Alur manual (kalau `REWARD_AUTO=false`), token admin = `CLAIMS_ADMIN_TOKEN`:
```sh
curl -X POST https://harvex.example/api/rewards/admin -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"sync"}'
curl -X POST https://harvex.example/api/rewards/admin -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"build"}'
# multisig memanggil setMerkleRoot(root) di REWARD_CONTRACT, lalu:
curl -X POST https://harvex.example/api/rewards/admin -H "Authorization: Bearer $CLAIMS_ADMIN_TOKEN" -d '{"action":"publish","period":1,"txHash":"0x…"}'
```
Salah hitung sebelum publish? `{"action":"discard","period":N}`. Ganti `REWARD_HARVEX_PER_UNIT`? `{"action":"rebuild"}`.
Holder klaim sendiri dari /dashboard/rewards (bayar gas sendiri dengan BNB), setelah mengisi negara domisili dan
pernyataan kelayakan. Server menolak sejumlah negara lewat daftar bawaan (`BLOCKED_COUNTRIES` di `lib/rewards.ts`):
daftar itu hanya bawaan hati-hati dari versi sebelumnya dan perlu direview penasihat hukum untuk token reward yang
nanti dipilih.

**Deploy vault reward (mainnet), sekali saja. Belum dikerjakan.** Panduan lengkap: `VAULT-MAINNET-ID.md`.
1. Buat Safe multisig (app.safe.global mendukung BNB Smart Chain, atau halaman lokal `safe-multisig.html`), threshold minimal 2 dan di bawah jumlah owner. Cek: `node scripts/check-reward-vault.mjs --safe 0x…`.
2. `REWARD_TOKEN_ADDRESS=0x… REWARD_TOKEN_SYMBOL=… REWARD_TOKEN_DECIMALS=… EVM_TOOLS=../evm-tools SAFE_ADDRESS=0x… node scripts/build-vault-package.mjs` → `exports/mainnet-vault/` (token reward tidak punya nilai bawaan).
3. Buka `deploy-vault.html` lewat `python -m http.server 8787 --bind 127.0.0.1 --directory exports/mainnet-vault`. Deploy dari wallet kamu sendiri (MetaMask/Rabby). Private key tidak pernah masuk server atau chat.
   Constructor: `token` = token reward yang disebut saat build (tidak bisa diganti setelah deploy), `owner` = Safe (halaman menolak wallet biasa).
4. `node scripts/check-reward-vault.mjs --vault 0x… --safe 0x… --token 0x… --tx 0x…`, lalu verifikasi source di bscscan.com dengan
   `exports/mainnet-vault/HarvexClaims.standard-input.json` (Standard-Json-Input, v0.8.26). Hindari deploy lewat Remix: metadata-nya
   berbeda, jadi bytecode tidak cocok dengan file verifikasi dan dengan script cek.
5. Isi `REWARD_CONTRACT` dengan alamat kontrak itu, `REWARD_START_BLOCK` dengan blok deploy token HARVEX, `REWARD_EXCLUDE` dengan wallet tim, treasury dan LP. `REWARDS_ENABLED=true` baru setelah audit dan review hukum. Setelah itu redeploy.
6. Pendanaan: kirim token reward ke `REWARD_CONTRACT`, lalu catat tx-nya dengan aksi `fund`. Semua pendanaan tampil publik di dashboard.

HarvexClaims belum diaudit independen dan belum pernah dijalankan di BNB Smart Chain. Jangan isi vault sebelum audit;
sesudahnya pun mulai dengan jumlah kecil.

**Jadwal agent di Cloudflare Workers:** tidak ada ticker bawaan. Buat cron (misalnya Cloudflare Cron atau cron-job.org) yang tiap menit memanggil
`POST https://harvex.example/api/schedules/tick` dengan header `Authorization: Bearer $SCHEDULER_TOKEN` (secret 32+ karakter).
Di Docker/Coolify ini sudah otomatis.

## 8. Fee platform (opsional)
`"platformFeeBps": 1000` = 10%. Ubah, lalu `npm run deploy`.

## Cek setelah deploy
- Situsmu terbuka, landing page tampil, karakter 3D jalan.
- Connect wallet → tanda tangani pesan → kembali ke studio dalam keadaan login (alamat wallet tampil di akun).
- Simpan agent, publish dengan harga, lalu cek di Discover dari wallet lain.
- Halaman Credits menampilkan credit awal (`STARTING_CREDITS`, default 25) dan ledger.

## Catatan keamanan
- `AUTH_TRUST_SITES_HEADERS` harus `false` di deploy sendiri (script sudah mengaturnya).
  Hanya `true` di dev lokal lewat `.dev.vars`.
- Cookie sesi HttpOnly, 30 hari, dihapus saat Sign out. Nonce SIWE sekali pakai; pesan untuk chain atau
  domain lain ditolak, dan pesan harus berformat EIP-4361 persis (wallet bisa memperingatkan situs tiruan).
- Di Docker/Coolify proxy depan container membuang header identitas dan header `cf-*` dari luar, menolak body di atas
  1 MB, dan memakai alamat penghubung (entri terakhir `X-Forwarded-For` dari Traefik) untuk rate limit login.
  `HARVEX_TRUST_CF_HEADERS=true` hanya kalau domain memang lewat proxy Cloudflare DAN server tidak bisa dijangkau
  langsung; kalau tidak, biarkan kosong (header itu bisa dipalsukan).
- Server: panel Coolify hanya lewat HTTPS (jangan buka port 8000 ke internet), login SSH dengan kunci saja
  (`PasswordAuthentication no`), dan salin backup `/data/backups` ke luar server.
- Secret yang pernah tampil di chat, tangkapan layar atau perangkat yang kena malware dianggap bocor: ganti semuanya
  (`BETTER_AUTH_SECRET` mengeluarkan semua sesi, `CLAIMS_ADMIN_TOKEN`, key AI, key RPC) dari perangkat yang bersih.
- Jangan pernah menempel API key di chat, file project, atau frontend.
