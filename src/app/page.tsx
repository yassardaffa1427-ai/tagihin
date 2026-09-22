"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import Card from "@/components/Card";
import { AddCircleIcon, CalculatorIcon, CloseCircleIcon } from "@/components/icons";
import PrimaryButton from "@/components/PrimaryButton";
import ProgressSteps from "@/components/ProgressSteps";
import ScreenBackground from "@/components/ScreenBackground";
import DateField from "@/components/fields/DateField";
import TextField from "@/components/fields/TextField";
import {
  formatRupiah,
  itemJumlah,
  subtotal,
  totalQty,
  useInvoiceStore,
} from "@/lib/invoice-store";

export default function DetailInvoicePage() {
  const router = useRouter();
  const {
    namaPemesan,
    tanggalTransaksi,
    items,
    setField,
    addItem,
    removeItem,
    setItemNama,
    setItemQty,
    setItemHarga,
    submitInvoice,
  } = useInvoiceStore();

  const safeItems = Array.isArray(items) ? items : [];
  const total = subtotal(safeItems);
  const canSubmit = (namaPemesan || "").trim().length > 0 && total > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    submitInvoice();
    router.push("/bayar");
  };

  return (
    <div className="relative flex min-h-screen w-full justify-center px-[22px] py-[30px]">
      <ScreenBackground />
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[350px] flex-col items-start gap-4"
      >
        <ProgressSteps doneCount={0} />

        <Card>
          <div className="flex w-full flex-col gap-[17px]">
            <div className="flex items-center gap-3">
              <div className="flex size-[42px] items-center justify-center rounded-[10px] border border-white bg-gradient-to-br from-brand-500 to-white shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)]">
                <CalculatorIcon className="size-6 text-white" />
              </div>
              <h1 className="text-[18px] font-medium text-black">Detail invoice</h1>
            </div>

            <div className="flex w-full flex-col gap-2">
              <label className="text-[13px] text-black">Tanggal Transaksi</label>
              <DateField
                value={tanggalTransaksi}
                onChange={(value) => setField("tanggalTransaksi", value)}
              />
            </div>

            <div className="flex w-full flex-col gap-2">
              <label className="text-[13px] text-black">Nama Pemesan</label>
              <TextField
                placeholder="Cth. Budi"
                value={namaPemesan}
                hasValue={namaPemesan.length > 0}
                onChange={(event) => setField("namaPemesan", event.target.value)}
                required
              />
            </div>

            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col gap-2">
                <div className="flex w-full items-center justify-between rounded-[10px] bg-brand-500 p-[10px] shadow-[inset_0px_0px_14px_0px_rgba(255,255,255,0.25),inset_0px_0px_11.8px_0px_rgba(255,255,255,0.6)]">
                  <span className="text-[18px] font-extrabold text-white">Total item</span>
                  <span className="text-[18px] font-extrabold text-white">{totalQty(safeItems)}</span>
                </div>
                <div className="flex w-full items-center justify-between rounded-[10px] bg-info-500 p-[10px] shadow-[inset_0px_0px_14px_0px_rgba(255,255,255,0.25),inset_0px_0px_11.8px_0px_rgba(255,255,255,0.6)]">
                  <span className="text-[18px] font-extrabold text-white">Subtotal</span>
                  <span className="text-[18px] font-extrabold text-white">{formatRupiah(total)}</span>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2">
                <div className="flex w-full items-stretch text-[12px]">
                  <div className="flex flex-1 flex-col">
                    <div className="border-b border-neutral-200 p-[10px] text-neutral-500">Item</div>
                  </div>
                  <div className="flex w-[45px] flex-col">
                    <div className="border-b border-neutral-200 p-[10px] text-neutral-500">Qty</div>
                  </div>
                  <div className="flex w-[80px] flex-col">
                    <div className="border-b border-neutral-200 p-[10px] text-neutral-500">Harga</div>
                  </div>
                  <div className="flex w-[80px] flex-col">
                    <div className="border-b border-neutral-200 p-[10px] text-neutral-500">Jumlah</div>
                  </div>
                  <div className="w-[20px] shrink-0 border-b border-neutral-200" />
                </div>

                {safeItems.map((item) => (
                  <div key={item.id} className="flex w-full items-stretch text-[12px]">
                    <div className="flex flex-1 flex-col border-b border-neutral-200">
                      <input
                        value={item.nama}
                        onChange={(event) => setItemNama(item.id, event.target.value)}
                        placeholder="Nama item"
                        className="w-full rounded-md p-[6px] text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-neutral-100"
                      />
                    </div>
                    <div className="flex w-[45px] flex-col border-b border-neutral-200">
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(event) => setItemQty(item.id, Number(event.target.value))}
                        className="w-full rounded-md p-[6px] text-[12px] text-neutral-900 outline-none focus:bg-neutral-100"
                      />
                    </div>
                    <div className="flex w-[80px] flex-col border-b border-neutral-200">
                      <input
                        type="number"
                        min={0}
                        value={item.harga || ""}
                        onChange={(event) => setItemHarga(item.id, Number(event.target.value))}
                        placeholder="0"
                        className="w-full rounded-md p-[6px] text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-neutral-100"
                      />
                    </div>
                    <div className="flex w-[80px] flex-col justify-center border-b border-neutral-200 p-[10px] text-neutral-900">
                      {formatRupiah(itemJumlah(item))}
                    </div>
                    <div className="flex w-[20px] shrink-0 items-center justify-center border-b border-neutral-200">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        aria-label="Hapus item"
                        className="cursor-pointer text-neutral-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <CloseCircleIcon className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-[6px] self-start py-[6px] text-[12px] font-medium text-brand-600 cursor-pointer"
                >
                  <AddCircleIcon className="size-4" />
                  Tambah item
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-[10px]">
            <PrimaryButton type="submit" disabled={!canSubmit}>
              Lanjut Pembayaran
            </PrimaryButton>
            <p className="text-[10px] text-neutral-500">in-development by @yasraffad_sensei</p>
          </div>
        </Card>
      </form>
    </div>
  );
}
