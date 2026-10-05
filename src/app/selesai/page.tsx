"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toPng, toBlob } from "html-to-image";
import BackLink from "@/components/BackLink";
import ProgressSteps from "@/components/ProgressSteps";
import ScreenBackground from "@/components/ScreenBackground";
import { UserIcon } from "@/components/icons";
import { formatRupiah, itemJumlah, subtotal, useInvoiceStore } from "@/lib/invoice-store";

function ScallopHeader() {
  return (
    <div className="w-full overflow-hidden leading-none block">
      <svg
        viewBox="0 0 350 13"
        className="w-full h-[13px] block text-white fill-current"
        preserveAspectRatio="none"
      >
        <path d="M350 13H0V0H14.0107C14.2738 7.22417 20.2116 13 27.5 13C34.7884 13 40.7262 7.22417 40.9893 0H51.0107C51.2738 7.22417 57.2116 13 64.5 13C71.7884 13 77.7262 7.22417 77.9893 0H88.0107C88.2738 7.22417 94.2116 13 101.5 13C108.788 13 114.726 7.22417 114.989 0H125.011C125.274 7.22417 131.212 13 138.5 13C145.788 13 151.726 7.22417 151.989 0H162.011C162.274 7.22417 168.212 13 175.5 13C182.788 13 188.726 7.22417 188.989 0H199.011C199.274 7.22417 205.212 13 212.5 13C219.788 13 225.726 7.22417 225.989 0H236.011C236.274 7.22417 242.212 13 249.5 13C256.788 13 262.726 7.22417 262.989 0H273.011C273.274 7.22417 279.212 13 286.5 13C293.788 13 299.726 7.22417 299.989 0H310.011C310.274 7.22417 316.212 13 323.5 13C330.788 13 336.726 7.22417 336.989 0H350V13Z" />
      </svg>
    </div>
  );
}

export default function SelesaiPage() {
  const router = useRouter();
  const { namaPemesan, items, status, paidAt, reset } = useInvoiceStore();
  const [isSharing, setIsSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const safeItems = Array.isArray(items) ? items : [];
  const total = subtotal(safeItems);

  useEffect(() => {
    if (status !== "sukses") {
      router.replace("/");
    }
  }, [status, router]);

  const paidDate = paidAt ? new Date(paidAt) : new Date();

  const formattedTime = paidDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = (() => {
    const day = String(paidDate.getDate()).padStart(2, "0");
    const month = String(paidDate.getMonth() + 1).padStart(2, "0");
    const year = paidDate.getFullYear();
    return `${day}/${month}/${year}`;
  })();

  const handleBackToStart = () => {
    reset();
    router.push("/");
  };

  const createBroadcastText = () => {
    const itemLines = safeItems
      .map(
        (it) =>
          `• *${it.nama || "Item"}*${it.qty > 1 ? ` (x${it.qty})` : ""} : ${formatRupiah(itemJumlah(it))}`
      )
      .join("\n");

    return (
      `🧾 *BUKTI TAGIHAN PEMBAYARAN*\n` +
      `----------------------------------------\n` +
      `👤 *Nama Pemesan:* ${namaPemesan || "Pelanggan"}\n` +
      `📅 *Tanggal:* ${formattedDate}\n` +
      `⏰ *Waktu:* ${formattedTime}\n` +
      `💳 *Metode:* QRIS\n` +
      `✅ *Status:* Pembayaran sudah diterima (Sukses)\n` +
      `----------------------------------------\n` +
      `📦 *Rincian Item:*\n` +
      `${itemLines}\n` +
      `----------------------------------------\n` +
      `💰 *Jumlah Tagihan:* ${formatRupiah(total)}\n` +
      `----------------------------------------\n` +
      `_Terima kasih atas pembayaran Anda!_`
    );
  };

  const handleShareToWhatsApp = async () => {
    if (isSharing || !exportRef.current) return;
    setIsSharing(true);
    setShareNotice(null);

    const broadcastMessage = createBroadcastText();
    const fileName = `struk-tagihan-${(namaPemesan || "invoice").replace(/\s+/g, "-").toLowerCase()}.png`;

    try {
      // Generate clean PNG blob of the receipt mockup
      const blob = await toBlob(exportRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "transparent",
      });

      if (!blob) throw new Error("Gagal membuat gambar struk");

      const file = new File([blob], fileName, { type: "image/png" });

      // Check if browser supports Web Share API with files (Mobile devices / iOS Safari / Android Chrome)
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: "Bukti Pembayaran Tagihan",
            text: broadcastMessage,
            files: [file],
          });
          setIsSharing(false);
          return;
        } catch (shareErr: unknown) {
          // If user aborted/cancelled share dialog, silently exit
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            setIsSharing(false);
            return;
          }
        }
      }

      // Fallback for Desktop / WhatsApp Web / non-file sharing browsers:
      // 1. Download image automatically
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "transparent",
      });
      const downloadLink = document.createElement("a");
      downloadLink.href = dataUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // 2. Open WhatsApp with broadcast text
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(broadcastMessage)}`;
      window.open(waUrl, "_blank");

      setShareNotice("Gambar struk telah diunduh & WhatsApp dibuka dengan pesan tagihan!");
    } catch (err) {
      console.error("Error sharing to WhatsApp:", err);
      // Direct text fallback
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(broadcastMessage)}`;
      window.open(waUrl, "_blank");
      setShareNotice("Membuka WhatsApp dengan teks tagihan...");
    } finally {
      setIsSharing(false);
    }
  };

  if (status !== "sukses") return null;

  return (
    <div className="relative flex min-h-screen w-full justify-center px-[22px] py-[30px]">
      <ScreenBackground />

      <div className="flex w-full max-w-[350px] flex-col items-start gap-[17px]">
        <BackLink label="Kembali ke utama" onClick={handleBackToStart} />
        <ProgressSteps doneCount={3} />

        {/* Display Receipt Card (iPhone 16 - 3) */}
        <div className="w-full drop-shadow-[0px_4px_16px_rgba(0,0,0,0.08)]">
          <ScallopHeader />
          <div className="flex w-full flex-col items-center gap-6 bg-white px-5 pb-6 rounded-b-[16px]">
            {/* Header User info */}
            <div className="flex w-full flex-col items-center gap-[18px] pt-3">
              <div className="flex items-center gap-[14px]">
                <div className="flex size-[42px] items-center justify-center rounded-[10px] border border-neutral-100 bg-gradient-to-b from-neutral-200 to-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.08)]">
                  <UserIcon className="size-6 text-neutral-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-neutral-800 leading-tight">
                    {namaPemesan || "Username"}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500">
                    Pemesan utama
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-medium text-brand-500">
                Pembayaran sudah diterima
              </p>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Detail Pembayaran */}
            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Detail Pembayaran</p>
              <div className="flex flex-col gap-[14px]">
                <Row label="Status" value="Sukses" valueClassName="font-semibold text-brand-500" />
                <Row label="Metode Pembayaran" value="QRIS" />
                <Row label="Waktu" value={formattedTime} />
                <Row label="Tanggal" value={formattedDate} />
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Total Item */}
            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Total Item</p>
              <div className="flex flex-col gap-[14px] text-neutral-600">
                {safeItems.map((item) => (
                  <Row
                    key={item.id}
                    label={`${item.nama || "item"}${item.qty > 1 ? ` x${item.qty}` : ""}`}
                    value={formatRupiah(itemJumlah(item))}
                  />
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Jumlah Tagihan */}
            <Row
              label="Jumlah Tagihan"
              value={formatRupiah(total)}
              labelClassName="font-semibold text-neutral-950"
              valueClassName="font-semibold text-neutral-950"
            />

            {/* Share to Whatsapp Link/Button (Apple Blue color token #007AFF) */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleShareToWhatsApp}
                disabled={isSharing}
                className="text-[13px] font-medium text-[#007AFF] hover:underline active:opacity-60 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSharing ? "Menyiapkan struk..." : "Share to Whatsapp"}
              </button>

              {shareNotice && (
                <p className="text-[11px] text-center text-neutral-500 animate-fade-in">
                  {shareNotice}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Render Target for Export Image (iPhone 16 - 6 mockup style) */}
      <div className="absolute -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        <div
          ref={exportRef}
          style={{ width: "350px", fontFamily: "var(--font-sans), Arial, Helvetica, sans-serif" }}
          className="flex flex-col bg-transparent"
        >
          <ScallopHeader />
          <div className="flex w-full flex-col items-center gap-6 bg-white px-5 pb-5">
            {/* Header User info */}
            <div className="flex w-full flex-col items-center gap-[18px] pt-4">
              <div className="flex items-center gap-[14px]">
                <div className="flex size-[42px] items-center justify-center rounded-[10px] border border-neutral-100 bg-gradient-to-b from-neutral-200 to-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.08)]">
                  <UserIcon className="size-6 text-neutral-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-neutral-800 leading-tight">
                    {namaPemesan || "Username"}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500">
                    Pemesan utama
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-medium text-brand-500">
                Pembayaran sudah diterima
              </p>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Detail Pembayaran */}
            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Detail Pembayaran</p>
              <div className="flex flex-col gap-[14px]">
                <Row label="Status" value="Sukses" valueClassName="font-semibold text-brand-500" />
                <Row label="Metode Pembayaran" value="QRIS" />
                <Row label="Waktu" value={formattedTime} />
                <Row label="Tanggal" value={formattedDate} />
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Total Item */}
            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Total Item</p>
              <div className="flex flex-col gap-[14px] text-neutral-600">
                {safeItems.map((item) => (
                  <Row
                    key={item.id}
                    label={`${item.nama || "item"}${item.qty > 1 ? ` x${item.qty}` : ""}`}
                    value={formatRupiah(itemJumlah(item))}
                  />
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            {/* Jumlah Tagihan */}
            <Row
              label="Jumlah Tagihan"
              value={formatRupiah(total)}
              labelClassName="font-semibold text-neutral-950"
              valueClassName="font-semibold text-neutral-950"
            />

            {/* Footer mockup signature */}
            <p className="pt-4 pb-2 text-[10px] text-neutral-500 tracking-wide text-center">
              in-development by @yasraffad_sensei
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  labelClassName = "text-neutral-600",
  valueClassName = "text-neutral-600",
}: {
  label: string;
  value: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex w-full items-center justify-between text-[13px]">
      <span className={labelClassName}>{label}</span>
      <span className={`text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}
