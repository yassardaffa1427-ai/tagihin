import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InvoiceStatus = "draft" | "menunggu" | "sukses";

export type InvoiceItem = {
  id: string;
  nama: string;
  qty: number;
  harga: number;
};

type InvoiceState = {
  namaPemesan: string;
  tanggalTransaksi: string; // yyyy-mm-dd, native <input type="date"> format
  items: InvoiceItem[];
  status: InvoiceStatus;
  paidAt: string | null; // ISO string, set when slide-to-confirm completes

  setField: <K extends "namaPemesan" | "tanggalTransaksi">(
    key: K,
    value: string
  ) => void;
  addItem: () => void;
  removeItem: (id: string) => void;
  setItemNama: (id: string, nama: string) => void;
  setItemQty: (id: string, qty: number) => void;
  setItemHarga: (id: string, harga: number) => void;
  submitInvoice: () => void;
  confirmPayment: () => void;
  reset: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

const newItem = (): InvoiceItem => ({
  id: crypto.randomUUID(),
  nama: "",
  qty: 1,
  harga: 0,
});

const initialState = {
  namaPemesan: "",
  tanggalTransaksi: today(),
  items: [newItem()],
  status: "draft" as InvoiceStatus,
  paidAt: null as string | null,
};

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value }),
      addItem: () => set((state) => ({ items: [...state.items, newItem()] })),
      removeItem: (id) =>
        set((state) => ({
          items:
            state.items.length > 1
              ? state.items.filter((item) => item.id !== id)
              : state.items,
        })),
      setItemNama: (id, nama) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, nama } : item)),
        })),
      setItemQty: (id, qty) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, qty: Math.max(1, qty) } : item
          ),
        })),
      setItemHarga: (id, harga) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, harga: Math.max(0, harga) } : item
          ),
        })),
      submitInvoice: () => set({ status: "menunggu" }),
      confirmPayment: () =>
        set({ status: "sukses", paidAt: new Date().toISOString() }),
      reset: () => set({ ...initialState, items: [newItem()], tanggalTransaksi: today() }),
    }),
    { name: "tagih-qris-invoice" }
  )
);

export const itemJumlah = (item?: Pick<InvoiceItem, "qty" | "harga">) =>
  (item?.qty ?? 0) * (item?.harga ?? 0);

export const totalQty = (items?: InvoiceItem[]) =>
  Array.isArray(items)
    ? items.reduce((sum, item) => sum + (item?.qty ?? 0), 0)
    : 0;

export const subtotal = (items?: InvoiceItem[]) =>
  Array.isArray(items)
    ? items.reduce((sum, item) => sum + itemJumlah(item), 0)
    : 0;

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

