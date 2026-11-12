"use client";

import Image from "next/image";
import { useState, useRef, useEffect, ChangeEvent } from "react";
import {
  CloseCircleIcon,
  ScanReceiptIcon,
  AddCircleIcon,
  CheckCircleIcon,
} from "@/components/icons";
import { formatRupiah } from "@/lib/invoice-store";
import {
  parseReceiptText,
  ParsedItem,
  ParsedTax,
} from "@/lib/receipt-parser";

interface ScanNotaModalProps {
  onClose: () => void;
  onApplyItems: (items: Array<{ nama: string; qty: number; harga: number }>) => void;
  selectedFile?: File | null;
}

/**
 * Preprocess receipt image using local adaptive illumination normalization
 * so uneven shadows (e.g. hand shadow) become uniform white paper while keeping
 * soft anti-aliased dark ink edges for Tesseract LSTM.
 */
function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(URL.createObjectURL(file));

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Ensure enough pixel height for small receipt text while capping huge photos
        const maxDim = 1800;
        const minWidth = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        } else if (width < minWidth && Math.max(width, height) * 1.5 <= maxDim) {
          const scale = minWidth / width;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Convert to grayscale
        const gray = new Float32Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // 2. Estimate local background illumination via downscaled canvas blur
        const bgScale = 32;
        const bgW = Math.max(8, Math.round(width / bgScale));
        const bgH = Math.max(8, Math.round(height / bgScale));

        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = bgW;
        smallCanvas.height = bgH;
        const smallCtx = smallCanvas.getContext("2d");

        let bgData: Uint8ClampedArray | null = null;
        if (smallCtx) {
          smallCtx.drawImage(canvas, 0, 0, bgW, bgH);
          const upCanvas = document.createElement("canvas");
          upCanvas.width = width;
          upCanvas.height = height;
          const upCtx = upCanvas.getContext("2d");
          if (upCtx) {
            upCtx.imageSmoothingEnabled = true;
            upCtx.imageSmoothingQuality = "high";
            upCtx.drawImage(smallCanvas, 0, 0, width, height);
            bgData = upCtx.getImageData(0, 0, width, height).data;
          }
        }

        // 3. Divide by local background and apply soft black/white point stretch
        const blackPoint = 115;
        const whitePoint = 225;
        const range = whitePoint - blackPoint;

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          let val = gray[p];
          if (bgData) {
            const bgGray = Math.max(
              30,
              0.299 * bgData[i] + 0.587 * bgData[i + 1] + 0.114 * bgData[i + 2]
            );
            val = Math.min(255, (val / bgGray) * 245);
          }

          // Contrast stretch: paper -> 255, ink -> 0..80
          let stretched = ((val - blackPoint) / range) * 255;
          if (stretched < 0) stretched = 0;
          if (stretched > 255) stretched = 255;

          data[i] = stretched;
          data[i + 1] = stretched;
          data[i + 2] = stretched;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(img.src);
      }
    };

    reader.readAsDataURL(file);
  });
}

interface OcrResult {
  text: string;
  items: ParsedItem[];
  pajak: ParsedTax | null;
  totalAkhirNota: number | null;
}

async function performReceiptOcr(
  file: File,
  onProgress: (pct: number, message: string) => void
): Promise<OcrResult> {
  const optimizedImageUrl = await preprocessImage(file);
  onProgress(40, "Menganalisis teks nota...");

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ind", "eng"], 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        const pct = Math.round(40 + m.progress * 50);
        onProgress(pct, `Membaca teks nota (${Math.round(m.progress * 100)}%)...`);
      }
    },
  });

  await worker.setParameters({
    preserve_interword_spaces: "1",
  });

  const result = await worker.recognize(optimizedImageUrl);
  await worker.terminate();

  const extractedText = result.data.text || "";
  onProgress(95, "Memverifikasi item, pajak, dan total...");
  const parsed = parseReceiptText(extractedText);

  return {
    text: extractedText,
    items: parsed.items,
    pajak: parsed.pajak,
    totalAkhirNota: parsed.totalAkhirNota,
  };
}

export default function ScanNotaModal({
  onClose,
  onApplyItems,
  selectedFile,
}: ScanNotaModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(() =>
    selectedFile ? URL.createObjectURL(selectedFile) : null
  );
  const [isScanning, setIsScanning] = useState<boolean>(Boolean(selectedFile));
  const [progress, setProgress] = useState<number>(selectedFile ? 20 : 0);
  const [statusMessage, setStatusMessage] = useState<string>(
    selectedFile ? "Membersihkan bayangan & kontras nota..." : ""
  );
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [pajak, setPajak] = useState<ParsedTax | null>(null);
  const [includeExclusiveTax, setIncludeExclusiveTax] = useState<boolean>(true);
  const [totalAkhirNota, setTotalAkhirNota] = useState<number | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [rawText, setRawText] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) return;

    let cancelled = false;

    performReceiptOcr(selectedFile, (pct, msg) => {
      if (!cancelled) {
        setProgress(pct);
        setStatusMessage(msg);
      }
    })
      .then(({ text, items: parsedItems, pajak: parsedTax, totalAkhirNota: parsedTotal }) => {
        if (cancelled) return;
        setRawText(text);
        setItems(parsedItems);
        setPajak(parsedTax);
        setIncludeExclusiveTax(Boolean(parsedTax && !parsedTax.isIncludedInItems && !parsedTax.isDeduction));
        setTotalAkhirNota(parsedTotal);
        setHasScanned(true);
        setProgress(100);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Scan nota error:", err);
        setError(
          "Gagal memindai nota. Pastikan gambar cukup terang dan teks terbaca dengan jelas."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsScanning(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setIsScanning(true);
    setProgress(20);
    setStatusMessage("Membersihkan bayangan & kontras nota...");
    setHasScanned(false);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const { text, items: parsedItems, pajak: parsedTax, totalAkhirNota: parsedTotal } =
        await performReceiptOcr(file, (pct, msg) => {
          setProgress(pct);
          setStatusMessage(msg);
        });
      setRawText(text);
      setItems(parsedItems);
      setPajak(parsedTax);
      setIncludeExclusiveTax(Boolean(parsedTax && !parsedTax.isIncludedInItems && !parsedTax.isDeduction));
      setTotalAkhirNota(parsedTotal);
      setHasScanned(true);
      setProgress(100);
    } catch (err) {
      console.error("Scan nota error:", err);
      setError(
        "Gagal memindai nota. Pastikan gambar cukup terang dan teks terbaca dengan jelas."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleItemChange = (
    id: string,
    field: "nama" | "qty" | "harga",
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nama: "",
        qty: 1,
        harga: 0,
      },
    ]);
  };

  const subtotalItems = items.reduce(
    (sum, item) => sum + (item.qty || 1) * (item.harga || 0),
    0
  );

  const taxAdjustment =
    pajak && !pajak.isIncludedInItems
      ? pajak.isDeduction
        ? -pajak.amount
        : includeExclusiveTax
        ? pajak.amount
        : 0
      : 0;

  const grandTotalHitung = subtotalItems + taxAdjustment;
  const selisihNota =
    totalAkhirNota !== null ? Math.abs(grandTotalHitung - totalAkhirNota) : null;
  const isVerifiedMatch = selisihNota !== null && selisihNota <= 50 && items.length > 0;

  const handleApply = () => {
    const validItems = items.filter(
      (item) => item.nama.trim().length > 0 && item.harga > 0
    );
    if (validItems.length === 0) return;

    const output = validItems.map((item) => ({
      nama: item.nama.trim(),
      qty: item.qty || 1,
      harga: item.harga || 0,
    }));

    if (pajak && !pajak.isIncludedInItems && !pajak.isDeduction && includeExclusiveTax && pajak.amount > 0) {
      output.push({
        nama: pajak.label,
        qty: 1,
        harga: pajak.amount,
      });
    }

    onApplyItems(output);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-info-500/10 text-info-500">
              <ScanReceiptIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-neutral-900 leading-tight">
                Scan Nota
              </h2>
              <p className="text-[11px] text-neutral-500">
                Verifikasi item, PPh/PPN & total akhir
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Tutup"
          >
            <CloseCircleIcon className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5">
          {/* File Picker trigger if no image */}
          {!imagePreview && !isScanning && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-info-500/30 bg-blue-50/50 p-8 text-center transition hover:border-info-500 hover:bg-blue-50"
            >
              <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-info-500 text-white shadow-[0_4px_12px_rgba(57,132,230,0.35)]">
                <ScanReceiptIcon className="size-7" />
              </div>
              <p className="text-[14px] font-semibold text-neutral-900">
                Ambil Foto atau Pilih Nota
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Mendukung struk fisik, nota kasir, atau screenshot (JPG, PNG)
              </p>
            </div>
          )}

          {/* Scanning In Progress */}
          {isScanning && (
            <div className="flex flex-col items-center py-4">
              {imagePreview && (
                <div className="relative mb-4 h-[160px] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900">
                  <Image
                    src={imagePreview}
                    alt="Nota preview"
                    fill
                    unoptimized
                    className="object-cover opacity-60"
                  />
                  {/* Laser Scan Animation */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-info-500 to-transparent shadow-[0_0_15px_#3984e6] animate-bounce" />
                </div>
              )}

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-info-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-3 text-center">
                <p className="text-[13px] font-medium text-neutral-800">
                  {statusMessage}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Mohon tunggu beberapa detik
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isScanning && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-[12px] font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 inline-flex items-center text-[12px] font-bold text-info-500 underline cursor-pointer"
              >
                Pilih foto lain
              </button>
            </div>
          )}

          {/* Results State */}
          {!isScanning && hasScanned && (
            <div className="flex flex-col gap-3">
              {/* Photo preview thumbnail bar */}
              {imagePreview && (
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-2 border border-neutral-100">
                  <div className="flex items-center gap-2">
                    <div className="relative size-9 overflow-hidden rounded-md border border-neutral-200">
                      <Image
                        src={imagePreview}
                        alt="Thumbnail nota"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] font-semibold text-neutral-700">
                        Foto Nota
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {items.length} item terdeteksi
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-info-500 hover:underline cursor-pointer"
                  >
                    Ganti Foto
                  </button>
                </div>
              )}

              {/* Items List */}
              {items.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 px-1">
                    <span>Item & Harga</span>
                    <span>Periksa & Edit jika perlu</span>
                  </div>

                  <div className="max-h-[210px] flex-col gap-2 overflow-y-auto pr-0.5 flex">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1.5 text-[12px] transition focus-within:border-info-500"
                      >
                        {/* Nama item */}
                        <input
                          type="text"
                          value={item.nama}
                          placeholder="Nama item"
                          onChange={(e) =>
                            handleItemChange(item.id, "nama", e.target.value)
                          }
                          className="flex-1 min-w-0 rounded p-1 text-[12px] font-medium text-neutral-900 outline-none"
                        />

                        {/* Qty */}
                        <div className="flex w-[40px] shrink-0 items-center rounded bg-neutral-50 px-1">
                          <span className="text-[10px] text-neutral-400">x</span>
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "qty",
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="w-full text-center text-[12px] outline-none"
                          />
                        </div>

                        {/* Harga */}
                        <div className="flex w-[84px] shrink-0 items-center rounded bg-neutral-50 px-1.5">
                          <span className="text-[10px] text-neutral-400">Rp</span>
                          <input
                            type="number"
                            min={0}
                            value={item.harga || ""}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "harga",
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              )
                            }
                            className="w-full text-right text-[12px] font-medium outline-none"
                          />
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="shrink-0 cursor-pointer text-neutral-400 hover:text-red-500"
                          aria-label="Hapus item"
                        >
                          <CloseCircleIcon className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add manual row */}
                  <button
                    type="button"
                    onClick={handleAddNewRow}
                    className="flex items-center gap-1 self-start py-1 text-[11px] font-medium text-brand-600 hover:underline cursor-pointer"
                  >
                    <AddCircleIcon className="size-3.5" />
                    Tambah baris
                  </button>

                  {/* Verification Summary Card: Harga Item + PPh/PPN + Total Akhir */}
                  <div className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[12px]">
                    <div className="flex items-center justify-between text-neutral-600">
                      <span>Subtotal Item ({items.length})</span>
                      <span className="font-semibold text-neutral-900">
                        {formatRupiah(subtotalItems)}
                      </span>
                    </div>

                    {pajak && (
                      <div className="flex items-center justify-between text-neutral-600">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          {!pajak.isIncludedInItems && !pajak.isDeduction && (
                            <input
                              type="checkbox"
                              checked={includeExclusiveTax}
                              onChange={(e) => setIncludeExclusiveTax(e.target.checked)}
                              className="size-3.5 rounded accent-info-500"
                            />
                          )}
                          <span>
                            {pajak.label}
                            {pajak.isIncludedInItems ? " (sudah termasuk)" : ""}
                          </span>
                        </label>
                        <span className="font-medium text-neutral-700">
                          {pajak.isDeduction ? "-" : ""}
                          {formatRupiah(pajak.amount)}
                        </span>
                      </div>
                    )}

                    <div className="my-0.5 border-t border-neutral-200" />

                    <div className="flex items-center justify-between text-info-500">
                      <span className="font-bold">Total Akhir</span>
                      <span className="text-[14px] font-extrabold">
                        {formatRupiah(grandTotalHitung)}
                      </span>
                    </div>

                    {totalAkhirNota !== null && (
                      <div
                        className={`mt-1 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                          isVerifiedMatch
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isVerifiedMatch && (
                            <CheckCircleIcon className="size-3.5 shrink-0 text-green-600" />
                          )}
                          {isVerifiedMatch
                            ? "Cocok dengan Total Nota"
                            : `Total di Nota: ${formatRupiah(totalAkhirNota)}`}
                        </span>
                        {!isVerifiedMatch && selisihNota !== null && (
                          <span className="font-bold">
                            Selisih {formatRupiah(selisihNota)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                    <ScanReceiptIcon className="size-5" />
                  </div>
                  <p className="text-[13px] font-semibold text-neutral-800">
                    Item tidak terdeteksi otomatis
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Teks pada nota mungkin terpotong atau buram. Anda dapat mencoba
                    foto ulang atau tambah item secara manual.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 cursor-pointer rounded-xl bg-info-500 px-4 py-2 text-[12px] font-bold text-white shadow-md hover:opacity-95"
                  >
                    Ambil Foto Ulang
                  </button>
                </div>
              )}

              {/* Raw text toggle */}
              {rawText && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-[10px] text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showRawText ? "Sembunyikan teks OCR" : "Lihat teks mentah OCR"}
                  </button>
                  {showRawText && (
                    <pre className="mt-1 max-h-[100px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-2 text-[10px] text-neutral-700">
                      {rawText}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-neutral-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-neutral-200 py-2.5 text-center text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Batal
          </button>

          {!isScanning && hasScanned && items.length > 0 && (
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 cursor-pointer rounded-xl bg-info-500 py-2.5 text-center text-[13px] font-bold text-white shadow-[inset_0px_0px_10px_0px_rgba(255,255,255,0.3)] hover:opacity-95"
            >
              Tambahkan ke Invoice ({items.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
