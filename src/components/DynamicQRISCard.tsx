"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateDynamicQRIS } from "@/lib/qris";
import { formatRupiah } from "@/lib/invoice-store";

export default function DynamicQRISCard({
  amount,
  merchantName = "warung madura, Digital &",
  nmid = "ID1026567413319",
}: {
  amount: number;
  merchantName?: string;
  nmid?: string;
}) {
  const dynamicQrisString = useMemo(() => {
    return generateDynamicQRIS(undefined, amount);
  }, [amount]);

  return (
    <div className="relative flex w-full flex-col items-center overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      {/* Header QRIS */}
      <div className="flex w-full flex-col items-center border-b border-neutral-100 pb-3">
        <div className="flex items-center justify-between w-full px-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[#CD0000] px-2 py-0.5 text-[11px] font-black tracking-wider text-white">
              QRIS
            </span>
            <span className="text-[11px] font-semibold text-neutral-600">
              Standar Pembayaran Nasional
            </span>
          </div>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
            UMI
          </span>
        </div>

        <div className="mt-2 text-center">
          <h2 className="text-[14px] font-bold text-neutral-900 leading-tight">
            {merchantName}
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
            NMID: {nmid}
          </p>
        </div>
      </div>

      {/* QR Code Container */}
      <div className="my-3 flex items-center justify-center rounded-xl bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-neutral-100">
        <QRCodeSVG
          value={dynamicQrisString}
          size={210}
          level="M"
          includeMargin={false}
          className="rounded-lg"
        />
      </div>

      {/* Info Nominal Dinamis */}
      <div className="flex w-full flex-col items-center gap-1 rounded-xl bg-neutral-50 p-2.5 text-center border border-neutral-100">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-neutral-700">
            Nominal Otomatis Terkunci
          </span>
        </div>
        <span className="text-[16px] font-extrabold text-brand-600">
          {formatRupiah(amount)}
        </span>
        <p className="text-[10px] text-neutral-400">
          Teman scan via BCA, Mandiri, BRI, GoPay, DANA, OVO, ShopeePay
        </p>
      </div>
    </div>
  );
}
