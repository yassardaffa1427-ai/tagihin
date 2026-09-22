# Tagih QRIS

Web app pribadi untuk menagih teman lewat kode QRIS — 3 layar: detail
invoice, kode QRIS + slide untuk konfirmasi, dan invoice sukses.

## Menjalankan

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Alur

1. `/` — isi nama pemesan, tanggal transaksi (native date picker OS),
   dan item/harga. Data disimpan di state lokal (Zustand + localStorage).
2. `/bayar` — tampilkan kode QRIS statis (`public/assets/qris-code.png`)
   dan subtotal. Slide tombol di bawah setelah pemesan benar-benar
   transfer untuk menandai lunas.
3. `/selesai` — ringkasan invoice yang sudah dibayar.

## Firebase

Belum dipakai — hanya disiapkan. Salin `.env.local.example` ke
`.env.local` dan isi config project Firebase kalau nanti mau
menyimpan invoice ke Firestore. Skeleton client-nya ada di
`src/lib/firebase.ts`.
