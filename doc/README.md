# Dokumen Dummy untuk Testing NegotiAI

5 dokumen **penawaran harga (quotation)** B2B dengan rincian per-item. Dipakai sebagai
input sisi **Vendor** saat join room — bisa **di-paste** ke kolom teks, atau **di-upload**
(backend membaca isi file `.md`/`.txt`; PDF/DOCX belum di-parse).

> Sisi **Pembeli (User)** tidak perlu dokumen — cukup **ketik bebas** budget & kebutuhannya.

| # | Dokumen | Kategori | Total Penawaran (asking) |
|---|---------|----------|--------------------------|
| 1 | [01-penawaran-aplikasi.md](01-penawaran-aplikasi.md) | Pengembangan aplikasi mobile | Rp 858.585.000 |
| 2 | [02-penawaran-laptop.md](02-penawaran-laptop.md) | Pengadaan 25 laptop | Rp 555.846.375 |
| 3 | [03-penawaran-lisensi-cloud.md](03-penawaran-lisensi-cloud.md) | Lisensi software & cloud | Rp 685.980.000 |
| 4 | [04-penawaran-cctv.md](04-penawaran-cctv.md) | Sistem CCTV & keamanan | Rp 230.880.000 |
| 5 | [05-penawaran-furniture.md](05-penawaran-furniture.md) | Furniture & fit-out kantor | Rp 404.189.850 |

Dokumen **tidak** mencantumkan harga pokok/floor (realistis). AI intake akan
memperkirakan floor (~85% dari asking) bila tak disebut — jadi outcome bergantung pada
**budget yang diketik pembeli**.

## Saran budget pembeli (untuk uji 3 skenario)

| Dokumen | 🟢 Deal cepat (budget ≥ asking) | 🟡 Alot (di antara floor–asking) | ⚫ Buntu (di bawah floor) |
|---------|-------------------------------|----------------------------------|----------------------------|
| 1 Aplikasi | 900 jt | 790 jt | 680 jt |
| 2 Laptop | 600 jt | 510 jt | 440 jt |
| 3 Lisensi/Cloud | 720 jt | 620 jt | 540 jt |
| 4 CCTV | 250 jt | 210 jt | 180 jt |
| 5 Furniture | 430 jt | 370 jt | 320 jt |

## Cara cepat testing
1. **Buat Room** (sisi pembeli) → ketik budget, mis. *"Budget maksimal 790 juta, prioritas harga, lead time maks 60 hari, bisa NET30."*
2. Salin link → buka incognito → **Join** (sisi vendor) → **paste isi** salah satu dokumen di atas (atau upload file `.md`-nya).
3. **Mulai Negosiasi** → tonton kedua agent tawar-menawar → setujui/tolak di titik keputusan.

Contoh kombinasi alot: **Dokumen 2 (laptop, asking 555 jt)** + budget pembeli **510 jt**.
