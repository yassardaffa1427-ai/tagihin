"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BackLink from "@/components/BackLink";
import ProgressSteps from "@/components/ProgressSteps";
import ScreenBackground from "@/components/ScreenBackground";
import { UserIcon } from "@/components/icons";
import scallopCard from "../../../public/assets/scallop-card.svg";
import { formatRupiah, itemJumlah, subtotal, useInvoiceStore } from "@/lib/invoice-store";

export default function SelesaiPage() {
  const router = useRouter();
  const { namaPemesan, items, status, paidAt, reset } = useInvoiceStore();
  const safeItems = Array.isArray(items) ? items : [];
  const total = subtotal(safeItems);

  useEffect(() => {
    if (status !== "sukses") {
      router.replace("/");
    }
  }, [status, router]);

  const paidDate = paidAt ? new Date(paidAt) : null;

  const handleBackToStart = () => {
    reset();
    router.push("/");
  };

  if (status !== "sukses") return null;

  return (
    <div className="relative flex min-h-screen w-full justify-center px-[22px] py-[30px]">
      <ScreenBackground />
      <div className="flex w-full max-w-[350px] flex-col items-start gap-[17px]">
        <BackLink label="Kembali ke utama" onClick={handleBackToStart} />
        <ProgressSteps doneCount={3} />

        <div className="w-full">
          <div className="relative h-[13px] w-full">
            <Image
              src={scallopCard}
              alt=""
              aria-hidden
              fill
              unoptimized
              className="object-cover object-top"
            />
          </div>
          <div className="flex w-full flex-col items-center gap-6 bg-white px-5 pb-5">
            <div className="flex w-full max-w-[194px] flex-col items-center gap-[25px] pt-2">
              <div className="flex items-center gap-[14px]">
                <div className="flex size-[42px] items-center justify-center rounded-[10px] border border-white bg-gradient-to-b from-neutral-300 to-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)]">
                  <UserIcon className="size-6 text-neutral-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-neutral-800">
                    {namaPemesan || "Username"}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500">
                    Pemesan utama
                  </span>
                </div>
              </div>
              <p className="text-[13px] text-neutral-600">Pembayaran sudah diterima</p>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Detail Pembayaran</p>
              <div className="flex flex-col gap-[14px]">
                <Row label="Status" value="Sukses" valueClassName="font-semibold text-brand-500" />
                <Row label="Metode Pembayaran" value="QRIS" />
                <Row
                  label="Waktu"
                  value={
                    paidDate
                      ? paidDate.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"
                  }
                />
                <Row
                  label="Tanggal"
                  value={paidDate ? paidDate.toLocaleDateString("id-ID") : "dd/mm/yyyy"}
                />
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            <div className="flex w-full flex-col gap-[14px] text-[13px]">
              <p className="font-semibold text-neutral-950">Total Item</p>
              <div className="flex flex-col gap-[14px] text-neutral-600">
                {safeItems.map((item) => (
                  <Row
                    key={item.id}
                    label={`${item.nama || "Item"}${item.qty > 1 ? ` x${item.qty}` : ""}`}
                    value={formatRupiah(itemJumlah(item))}
                  />
                ))}
              </div>
            </div>

            <div className="h-px w-full bg-neutral-200" />

            <Row
              label="Jumlah Tagihan"
              value={formatRupiah(total)}
              labelClassName="font-semibold text-neutral-950"
            />
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
