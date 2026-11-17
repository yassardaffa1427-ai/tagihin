import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-latest",
];

const SYSTEM_PROMPT = `Kamu adalah asisten akurasi tinggi untuk mengekstrak dan memverifikasi data dari foto nota/struk belanja Indonesia.

TUGAS UTAMA:
Ekstrak HANYA:
1. Daftar item pembelian asli (nama, qty, hargaSatuan dalam angka integer Rupiah).
2. Pajak / PPh / PPN / PB1 / Service (jika ada).
3. Subtotal dan Total Akhir yang tertera pada nota.

ATURAN KETAT:
- JANGAN pernah memasukkan header toko, alamat, RT/RW, nomor telepon, NPWP, nomor Bon/Struk, nama kasir, tanggal/jam, versi aplikasi, atau nomor Kritik&Saran sebagai item.
- JANGAN pernah memasukkan baris pembayaran (Gopay, QRIS, OVO, Dana, ShopeePay, Tunai, Cash, Debit, Kredit, Kembalian, Bayar) atau baris Total/Subtotal sebagai item.
- Untuk setiap item:
  - "nama": bersihkan nama produk tanpa angka harga atau qty yang nyasar di belakangnya (tetap pertahankan ukuran produk seperti "350ML", "600ML", "250G", dll).
  - "qty": jumlah beli (integer >= 1).
  - "hargaSatuan": harga PER SATUAN (unit price) dalam integer Rupiah (contoh: jika beli 2 pcs dengan harga satuan 5.000 dan total baris 10.000, maka qty=2 dan hargaSatuan=5000).
- Untuk "pajak" (jika tertera di nota):
  - Pada struk minimarket (Alfamart/Indomaret) yang mencantumkan "PPN" / "DPP: ... PPN: ..." sebagai rincian pajak yang SUDAH termasuk di harga item (sum item == Total Akhir), set isIncludedInItems = true, isDeduction = false.
  - Pada struk restoran/kafe/toko yang menambahkan PPN / PB1 / Service di atas subtotal (subtotal + pajak == Total Akhir), set isIncludedInItems = false, isDeduction = false.
  - Jika PPh merupakan pemotongan (subtotal - PPh == Total Akhir), set isIncludedInItems = false, isDeduction = true.
  - Jika tidak ada pajak/PPh/PPN pada nota, isi pajak = null.
- Verifikasi hitungan: pastikan qty * hargaSatuan untuk setiap item konsisten dengan totalAkhirNota.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nama: { type: "STRING" },
          qty: { type: "INTEGER" },
          hargaSatuan: { type: "INTEGER" },
        },
        required: ["nama", "qty", "hargaSatuan"],
      },
    },
    pajak: {
      type: "OBJECT",
      nullable: true,
      properties: {
        label: { type: "STRING" },
        amount: { type: "INTEGER" },
        isIncludedInItems: { type: "BOOLEAN" },
        isDeduction: { type: "BOOLEAN" },
      },
      required: ["label", "amount", "isIncludedInItems", "isDeduction"],
    },
    subtotalNota: { type: "INTEGER", nullable: true },
    totalAkhirNota: { type: "INTEGER", nullable: true },
  },
  required: ["items", "pajak", "subtotalNota", "totalAkhirNota"],
};

interface GeminiRawResult {
  items?: Array<{
    nama?: string;
    qty?: number;
    hargaSatuan?: number;
  }>;
  pajak?: {
    label?: string;
    amount?: number;
    isIncludedInItems?: boolean;
    isDeduction?: boolean;
  } | null;
  subtotalNota?: number | null;
  totalAkhirNota?: number | null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY_MISSING", message: "Gemini API key belum dikonfigurasi." },
      { status: 503 }
    );
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Format request tidak valid." },
      { status: 400 }
    );
  }

  const { imageBase64, mimeType = "image/jpeg" } = body;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json(
      { error: "MISSING_IMAGE", message: "Gambar nota wajib disertakan." },
      { status: 400 }
    );
  }

  // Strip data URL prefix if present
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

  let lastErrorText = "";
  let lastStatus = 500;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: SYSTEM_PROMPT,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        lastStatus = response.status;
        lastErrorText = await response.text();
        // Try next fallback model on 404, 429, 500, 503
        if ([404, 429, 500, 503].includes(response.status)) {
          continue;
        }
        return NextResponse.json(
          { error: "GEMINI_API_ERROR", message: "Gagal memproses nota dengan AI." },
          { status: response.status }
        );
      }

      const data = await response.json();
      const textContent =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        lastErrorText = "Empty candidate response";
        continue;
      }

      const parsed: GeminiRawResult = JSON.parse(textContent);

      const cleanItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .map((item) => ({
          id: crypto.randomUUID(),
          nama: String(item.nama || "").trim(),
          qty: Math.max(1, Math.round(Number(item.qty) || 1)),
          harga: Math.max(0, Math.round(Number(item.hargaSatuan) || 0)),
        }))
        .filter((item) => item.nama.length > 0 && item.harga > 0);

      const cleanPajak =
        parsed.pajak && Number(parsed.pajak.amount) > 0
          ? {
              label: String(parsed.pajak.label || "Pajak").trim(),
              amount: Math.max(0, Math.round(Number(parsed.pajak.amount) || 0)),
              isIncludedInItems: Boolean(parsed.pajak.isIncludedInItems),
              isDeduction: Boolean(parsed.pajak.isDeduction),
            }
          : null;

      const subtotalNota =
        parsed.subtotalNota !== null && parsed.subtotalNota !== undefined
          ? Math.max(0, Math.round(Number(parsed.subtotalNota)))
          : null;

      const totalAkhirNota =
        parsed.totalAkhirNota !== null && parsed.totalAkhirNota !== undefined
          ? Math.max(0, Math.round(Number(parsed.totalAkhirNota)))
          : null;

      return NextResponse.json({
        engine: "gemini-ai",
        model,
        items: cleanItems,
        pajak: cleanPajak,
        subtotalNota,
        totalAkhirNota,
      });
    } catch (err) {
      lastErrorText = err instanceof Error ? err.message : "Unknown error";
      continue;
    }
  }

  console.error("All Gemini models failed:", lastStatus, lastErrorText);
  return NextResponse.json(
    {
      error: "GEMINI_UNAVAILABLE",
      message: "Layanan AI sedang sibuk, mencoba OCR lokal...",
    },
    { status: 503 }
  );
}

