"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BackLink from "@/components/BackLink";
import Card from "@/components/Card";
import ProgressSteps from "@/components/ProgressSteps";
import ScreenBackground from "@/components/ScreenBackground";
import SlideToConfirm from "@/components/SlideToConfirm";
import qrisCode from "../../../public/assets/qris-code.png";
import { formatRupiah, subtotal, useInvoiceStore } from "@/lib/invoice-store";

export default function BayarPage() {
  const router = useRouter();
  const { namaPemesan, items, status, confirmPayment } = useInvoiceStore();
  const total = subtotal(items);

  useEffect(() => {
    if (!namaPemesan || status === "draft") {
      router.replace("/");
    }
  }, [namaPemesan, status, router]);

  const handleConfirm = () => {
    confirmPayment();
    router.push("/selesai");
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center px-[22px] py-[30px]">
      <ScreenBackground />
      <div className="flex w-full max-w-[350px] flex-col items-start gap-[17px]">
        <BackLink label="Kembali" />
        <ProgressSteps doneCount={1} />

        <Card>
          <div className="flex w-full flex-col gap-[17px]">
            <div className="relative h-[438px] w-full overflow-hidden rounded-2xl border border-neutral-200">
              <Image
                src={qrisCode}
                alt="Kode QRIS pembayaran"
                fill
                sizes="310px"
                className="object-cover"
                priority
              />
            </div>
            <div className="flex w-full items-center justify-between rounded-[10px] bg-info-500 p-[10px] shadow-[inset_0px_0px_14px_0px_rgba(255,255,255,0.25),inset_0px_0px_11.8px_0px_rgba(255,255,255,0.6)]">
              <span className="text-[18px] font-extrabold text-white">Subtotal</span>
              <span className="text-[18px] font-extrabold text-white">{formatRupiah(total)}</span>
            </div>
          </div>

          <div className="flex w-full flex-col items-center">
            <SlideToConfirm label="Slide untuk lanjut.." onConfirm={handleConfirm} />
          </div>
        </Card>
      </div>
    </div>
  );
}
