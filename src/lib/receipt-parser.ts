/**
 * Utility to parse receipt / nota text from OCR and extract item name, quantity, and price.
 */

export interface ParsedItem {
  id: string;
  nama: string;
  qty: number;
  harga: number;
}

const IGNORE_KEYWORDS = [
  "total",
  "subtotal",
  "sub total",
  "sub-total",
  "grand total",
  "pajak",
  "ppn",
  "tax",
  "service",
  "charge",
  "tunai",
  "cash",
  "kembali",
  "kembalian",
  "change",
  "bayar",
  "debit",
  "kredit",
  "credit",
  "qris",
  "kartu",
  "diskon",
  "discount",
  "promo",
  "voucher",
  "potongan",
  "meja",
  "table",
  "kasir",
  "cashier",
  "order",
  "nomor",
  "no.",
  "receipt",
  "invoice",
  "tanggal",
  "date",
  "waktu",
  "time",
  "jam",
  "telp",
  "phone",
  "alamat",
  "terima kasih",
  "thank you",
  "selamat",
  "item",
  "qty",
  "harga",
  "jumlah",
  "price",
  "amount",
  "bca",
  "mandiri",
  "bri",
  "bni",
  "gopay",
  "ovo",
  "dana",
  "shopeepay",
];

function isIgnoredLine(line: string): boolean {
  const lower = line.toLowerCase();
  return IGNORE_KEYWORDS.some((kw) => {
    const reg = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, "i");
    return reg.test(lower);
  });
}

function parseNumber(numStr: string): number {
  let cleaned = numStr.trim().replace(/\s+/g, "");
  // If ends with ,00 or .00 decimal cents
  if (/[.,]\d{2}$/.test(cleaned) && cleaned.length > 5) {
    cleaned = cleaned.slice(0, -3);
  }
  // Strip dots and commas
  cleaned = cleaned.replace(/[.,]/g, "");
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

export function parseReceiptText(rawText: string): ParsedItem[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedItem[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Skip separator lines like ------ or ====== or ***
    if (/^[=\-_*#\s.|]{3,}$/.test(line)) continue;

    // Check if line contains ignore keywords
    if (isIgnoredLine(line)) continue;

    // Clean currency indicators
    const cleanLine = line
      .replace(/rp\.?/gi, " ")
      .replace(/\bidr\b/gi, " ")
      .replace(/[|]/g, " ")
      .trim();

    // Check for single line item: e.g. "1 Kopi Susu 18.000" or "Jasjus 1 5000" or "Nasi Goreng 25.000"
    // Find numbers in line
    const numberMatches = Array.from(
      cleanLine.matchAll(/(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\b\d{3,8}\b)/g)
    );

    if (numberMatches.length > 0) {
      // The last matched number is almost certainly the price or line total
      const lastMatch = numberMatches[numberMatches.length - 1];
      const priceVal = parseNumber(lastMatch[0]);

      if (priceVal > 0 && lastMatch.index !== undefined) {
        let beforeText = cleanLine.substring(0, lastMatch.index).trim();
        let qty = 1;

        // Check if there is an explicit qty like "2x" or "2 x" or "x 2"
        const qtyMatch = beforeText.match(/(\d+)\s*[xX]\b|\b[xX]\s*(\d+)/);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1] || qtyMatch[2], 10);
          beforeText = beforeText.replace(qtyMatch[0], " ").trim();
        } else {
          // Check leading quantity like "2 Nasi Goreng"
          const leadMatch = beforeText.match(/^(\d{1,2})\s+([a-zA-Z].*)/);
          if (leadMatch) {
            qty = parseInt(leadMatch[1], 10);
            beforeText = leadMatch[2].trim();
          } else {
            // Check trailing quantity or unit price like "Jasjus 1"
            const trailMatch = beforeText.match(/(.*?)\s+(\d{1,2})\s*$/);
            if (trailMatch && !isNaN(parseInt(trailMatch[2], 10))) {
              qty = parseInt(trailMatch[2], 10);
              beforeText = trailMatch[1].trim();
            }
          }
        }

        // Clean name
        const name = beforeText
          .replace(/^[-*•\s\d]+/, "")
          .replace(/[-_.:]+$/, "")
          .trim();

        if (name.length >= 2 && !isIgnoredLine(name)) {
          items.push({
            id: crypto.randomUUID(),
            nama: name,
            qty: Math.max(1, qty),
            harga: priceVal,
          });
          continue;
        }
      }
    }

    // Pattern 2: Multi-line layout where line i is Item Name and line i+1 has qty & price
    // e.g.
    // Line 1: "Kopi Susu"
    // Line 2: "1 x 18.000" or "2 @ 15.000"
    if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      const multiMatch = nextLine.match(
        /(?:(\d+)\s*[xX@]\s*)?(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\b\d{3,8}\b)/i
      );

      if (multiMatch && !isIgnoredLine(line) && !isIgnoredLine(nextLine)) {
        const qty = multiMatch[1] ? parseInt(multiMatch[1], 10) : 1;
        const price = parseNumber(multiMatch[2]);
        const cleanName = line
          .replace(/^[-*•\s\d]+/, "")
          .replace(/[-_.:]+$/, "")
          .trim();

        if (cleanName.length >= 2 && price > 0) {
          items.push({
            id: crypto.randomUUID(),
            nama: cleanName,
            qty: Math.max(1, qty),
            harga: price,
          });
          i++; // Skip next line since we consumed it
          continue;
        }
      }
    }
  }

  return items;
}

