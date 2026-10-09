# 🌈 Rainbow Sort

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Rainbow Sort** adalah game puzzle *Water Sort* yang gratis dan open source. Game ini dibuat untuk membantu anak-anak memahami konsep **sorting (mengurutkan/mengelompokkan)** lewat tampilan yang berwarna dan menyenangkan.

Tujuannya sederhana: tuang cairan berwarna antar tabung sampai setiap tabung hanya berisi **satu warna**. Sambil bermain, anak melatih berpikir analitis, merencanakan langkah, dan memecahkan masalah.
![alt text](image.png)
## ✨ Filosofi

- **Gratis dan open source**, tanpa biaya dan tanpa iklan.
- **Tanpa batas energi atau nyawa.** Anak boleh mencoba sebanyak yang diinginkan.
- **Undo tanpa batas**, jadi salah langkah bukan masalah.
- **Semua level pasti bisa diselesaikan.** Setiap level diverifikasi oleh solver sebelum dimainkan.
- **Ada bantuan (hint)** kalau anak mentok.

## 🎮 Cara Bermain

1. Ketuk tabung sumber. Tabung akan terangkat dan menyala.
2. Ketuk tabung tujuan untuk menuangkan cairan.
3. Cairan hanya bisa dituang jika **warna teratasnya sama** dengan warna teratas tabung tujuan, atau tabung tujuan **kosong**, dan tabung tujuan **belum penuh**.
4. Menang jika setiap tabung **kosong** atau **penuh dengan satu warna**.

Selesaikan dengan langkah sesedikit mungkin untuk mendapat ⭐⭐⭐.

## 🧩 Fitur

**Gameplay**
- Tiga tingkat kesulitan: **Easy**, **Medium**, dan **Hard**.
- Level tak terbatas. Level yang sama selalu menghasilkan puzzle yang sama.
- Penuangan banyak segmen sekaligus, jika beberapa blok warna sama berada di atas.
- Counter langkah dan badge **"Best"**, yaitu jumlah langkah optimal level itu.
- **Undo tanpa batas** dan **Restart**.
- **Hint** yang menandai tabung sumber (▲) dan tujuan (▼) untuk langkah terbaik berikutnya.
- Penilaian bintang: 3★ jika optimal, 2★ jika dalam +30% dari optimal, 1★ jika selesai.
- Deteksi jalan buntu: game memberi tahu jika tidak ada langkah tersisa.
- Progres level per tingkat kesulitan dan pengaturan tersimpan otomatis di `localStorage`.

**Visual dan animasi**
- Tabung kaca dengan efek pantulan, dan cairan berwarna pastel dengan palet ramah buta warna.
- Tabung terangkat saat dipilih, lalu bergerak, miring 45°–75° sesuai ketinggian cairan, dan menuang dengan aliran cairan animasi.
- Tabung bergetar jika langkah tidak valid.
- Ikon centang pada tabung yang sudah selesai.
- Layar kemenangan dengan bintang beranimasi, skor efisiensi, dan confetti. Confetti dimatikan jika pengguna memilih *reduced motion*.
- Tampilan responsif (HP sampai desktop), mode gelap dan terang.

**Audio** (dibuat langsung dengan Web Audio API, tanpa file audio)
- Pilih tabung, menuang (suara gelembung), error, undo, hint, dan menang (arpeggio C–E–G–C).
- Bisa dimatikan (mute).

**Aksesibilitas**
- Setiap tabung punya `aria-label`, dan tombol bisa dioperasikan lewat keyboard.
- Mendukung `prefers-reduced-motion`.

## 🛠️ Tech Stack

| Bagian | Teknologi |
| --- | --- |
| Bahasa | TypeScript (strict mode) |
| UI | React 19 |
| Build tool | Vite |
| State management | Zustand (dengan middleware `persist`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Animasi | Framer Motion, `canvas-confetti` |
| Ikon | `lucide-react` |
| Audio | Web Audio API |
| Testing | Vitest |
| Linter | Oxlint |

## 🧠 Logika dan Algoritma

### Arsitektur

Logika game dipisah dari UI.

```
src/
├── core/            # Logika murni, tanpa dependensi UI
│   ├── types.ts     # Tipe domain (Tube, Move, Level, ...)
│   ├── engine.ts    # Aturan penuangan, validasi, kondisi menang, undo
│   ├── solver.ts    # Solver BFS kanonik + pencari hint
│   └── generator.ts # Generator level yang pasti solvable
├── store/
│   └── useGameStore.ts   # Store Zustand: jembatan engine ↔ UI
├── hooks/
│   └── useGameAudio.ts   # Efek suara sintetis
├── components/      # Tube, PourStream, GameBoard, ControlBar, VictoryModal
└── styles/index.css # Tailwind + gaya cairan/kaca
```

### Model data

Sebuah **tabung adalah stack**: array warna dengan indeks 0 sebagai dasar dan indeks terakhir sebagai puncak. Setiap `Move` menyimpan `from`, `to`, warna, dan jumlah segmen. Karena itu setiap langkah bisa dibalik dengan tepat, dan itulah dasar **undo tanpa batas**.

### Aturan penuangan (`engine.ts`)

- Sumber tidak boleh kosong, dan tujuan tidak boleh penuh.
- Warna teratas sumber harus sama dengan warna teratas tujuan, atau tujuan kosong.
- Jumlah yang dituang adalah `min(k, kapasitas − isi tujuan)`, dengan `k` jumlah blok warna sama di puncak sumber.
- Memindahkan tabung yang sudah satu warna ke tabung kosong ditolak, karena langkah itu tidak berguna.
- Menang jika semua tabung kosong atau penuh dengan satu warna.

### Solver: BFS kanonik dengan reduksi simetri (`solver.ts`)

Solver memakai **Breadth-First Search** pada ruang state permainan, sehingga solusi pertama yang ditemukan adalah solusi **dengan langkah paling sedikit**.

- **Reduksi simetri:** urutan tabung tidak memengaruhi solvabilitas. Sebelum dicek ke himpunan `visited`, tabung-tabung disusun terurut secara leksikografis lalu digabung menjadi kunci. Ini menghilangkan sampai *N!* cabang pencarian yang berulang.
- **Encoding ringan:** warna dikodekan jadi satu karakter dan tabung jadi string, sehingga hashing dan perbandingan murah.
- **Pruning:** tabung penuh satu warna tidak pernah dipindah, tuang ke tabung kosong dari tabung seragam diabaikan, dan hanya satu tabung kosong yang dipertimbangkan sebagai tujuan karena semuanya setara.
- **Batas pencarian:** jumlah state dibatasi (`maxStates`), dan hasilnya `solved`, `unsolvable`, atau `limit-exceeded`.
- **Fallback hint:** jika BFS melebihi batas (level Hard yang besar), hint memakai **DFS heuristik** dengan urutan langkah greedy: utamakan menyelesaikan tabung, memindahkan seluruh blok atas, dan mengosongkan sumber, serta hindari memakai tabung kosong. Solusinya belum tentu optimal, tapi hint tetap tersedia.

### Generator level: *generate-and-test* (`generator.ts`)

1. Pilih *C* warna dari palet.
2. Buat kumpulan *C × kapasitas* unit lalu **acak dengan Fisher–Yates** memakai PRNG ber-seed (*mulberry32*).
3. Bagi ke *C* tabung, lalu tambahkan 2 tabung kosong.
4. Buang kandidat jika ada tabung yang sudah selesai sejak awal.
5. Jalankan solver BFS. Kandidat diterima hanya jika solvable dan jumlah langkah optimalnya masuk rentang target tingkat kesulitan.
6. Simpan jumlah langkah optimal sebagai `minOptimalMoves`, yang dipakai untuk badge **Best** dan penilaian bintang.

Karena memakai seed dari `(difficulty, nomor level)`, level selalu **deterministik**.

| Tingkat | Warna | Tabung kosong | Langkah optimal target |
| --- | --- | --- | --- |
| Easy | 3–4 | 2 | 8–12 |
| Medium | 5–6 | 2 | 14–22 |
| Hard | 7–9 | 2 | 25–35 |

### State management dan animasi (`useGameStore.ts`)

Store mengatur pemilihan tabung, riwayat langkah, hint, dan animasi menuang sebagai **state machine** tiga fase: `travel → pouring → return`. Komponen membaca fase ini untuk menggerakkan tabung dan aliran cairan. Input dikunci selama animasi berjalan. Timer dibatalkan jika level di-restart atau diganti, supaya tidak ada animasi yang tersisa.

## 🚀 Menjalankan Secara Lokal

Prasyarat: [Node.js](https://nodejs.org/) versi terbaru dan npm.

```bash
npm install
npm run dev        # jalankan dev server
```

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Dev server dengan HMR |
| `npm run build` | Typecheck dan build produksi |
| `npm run preview` | Pratinjau hasil build |
| `npm test` | Menjalankan unit test (Vitest) |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm run lint` | Linting dengan Oxlint |

## 🤝 Kontribusi

Proyek ini open source dan kontribusi sangat diterima, baik berupa isu, ide level baru, perbaikan, maupun terjemahan. Silakan buka *issue* atau kirim *pull request*. Pastikan `npm test`, `npm run typecheck`, dan `npm run lint` lolos sebelum mengirim PR.

## 📄 Lisensi

Didistribusikan di bawah lisensi MIT. Lihat file [`LICENSE`](LICENSE) untuk informasi selengkapnya.

Copyright (c) 2026 Ahmad Rofi' Izzulhaq
