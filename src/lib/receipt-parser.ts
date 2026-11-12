/**
 * Utility to parse receipt / nota text from OCR and extract:
 * 1. Item list (nama, qty, harga satuan)
 * 2. PPh / PPN / PB1 / Pajak (jika ada, beserta status sudah termasuk / ditambahkan)
 * 3. Total akhir nota (untuk verifikasi otomatis)
 */

export interface ParsedItem {
  id: string;
  nama: string;
  qty: number;
  harga: number;
  /** Internal helper for resolving whether trailing price was lineTotal or unitPrice */
  _ambiguousLineTotal?: number;
}

export interface ParsedTax {
  label: string;
  amount: number;
  /** true jika pajak sudah termasuk di harga item (mis. DPP + PPN di struk minimarket) */
  isIncludedInItems: boolean;
  /** true jika pajak bersifat pemotongan (mis. PPh 23) */
  isDeduction?: boolean;
}

export interface ParsedReceiptResult {
  items: ParsedItem[];
  pajak: ParsedTax | null;
  subtotalNota: number | null;
  totalAkhirNota: number | null;
  subtotalItems: number;
  grandTotalHitung: number;
  isVerified: boolean;
}

const HEADER_ONLY_KEYWORDS = [
  /\bbon\b/i,
  /\bkas[i1]r\b/i,
  /\bcash[i1]er\b/i,
  /\bnpwp\b/i,
  /\bjl\.?\s/i,
  /\bjalan\b/i,
  /\btelp\b/i,
  /\btlp\b/i,
  /\bphone\b/i,
  /\balfamart\b/i,
  /\bindomaret\b/i,
  /\balfamidi\b/i,
  /\blawson\b/i,
  /\bfamilymart\b/i,
  /\bcircle\s*k\b/i,
  /\bkr[i1]t[i1]k\b/i,
  /\bsaran\b/i,
  /\bter[i1]ma\s*kas[i1]h\b/i,
  /\bthank\s*you\b/i,
  /\bselamat\b/i,
  /\brt\.?\s*\d/i,
  /\brw\.?\s*\d/i,
  /\b(kec|kab|kota|kel|desa)\.?\s/i,
  /\b(tangerang|jakarta|bandung|surabaya|bekasi|bogor|depok|semarang|yogyakarta|medan|makassar|jonggol|sutera)\b/i,
  /\bkode\s*pos\b/i,
  /\bstruk\b/i,
  /\bmeja\b/i,
  /\btable\b/i,
  /\border\s*(no|id|#)/i,
  /\breceipt\b/i,
  /\binvoice\b/i,
  /\bitem\b.*\b(qty|harga|jumlah|price)\b/i,
];

const SUMMARY_TOTAL_KEYWORDS = [
  /\bsub\s*-?\s*t[o0]t[a4][l1i]\b/i,
  /\bgrand\s*t[o0]t[a4][l1i]\b/i,
  /\bt[o0]t[a4][l1i]\s*(item|belanja|bayar|harga|tagihan|akhir|all|net|netto)?\b/i,
  /\bjumlah\s*(bayar|total|tagihan|harga)\b/i,
  /\btag[i1]han\b/i,
];

const PAYMENT_KEYWORDS = [
  /\btun[a4][i1]\b/i,
  /\bc[a4]sh\b/i,
  /\bkemb[a4]l[i1](an)?\b/i,
  /\bchange\b/i,
  /\bb[a4]y[a4]r\b/i,
  /\b[qgsc]r[i1l]s\b/i, // QRIS, SRIS, GRIS, CRIS
  /\bg[o0i][zp]p?[a4]y\b/i, // Gopay, Gizpay, G0pay
  /\b[o0]v[o0]\b/i,
  /\bd[a4]n[a4]\b/i,
  /\bsh[o0]p[e3]{2}\s*pay\b/i,
  /\blink\s*aja\b/i,
  /\bdeb[i1]t\b/i,
  /\bkr[e3]d[i1]t\b/i,
  /\bcredit\b/i,
  /\bedc\b/i,
  /\btransfer\b/i,
  /\bbca\b/i,
  /\bmandiri\b/i,
  /\bbri\b/i,
  /\bbni\b/i,
];

const TAX_KEYWORDS = [
  /\bppn\b/i,
  /\bpph\b/i,
  /\bpb\s*1\b/i,
  /\bpajak\b/i,
  /\btax\b/i,
  /\bdpp\b/i,
  /\bfpn\b/i, // OCR misread of PPN
  /\bpen\b(?=.*\bdpp\b)/i, // OCR misread of PPN when paired with DPP
  /\bservice\s*(charge)?\b/i,
];

const DISCOUNT_KEYWORDS = [
  /\bdiskon\b/i,
  /\bdiscount\b/i,
  /\bhemat\b/i,
  /\bpotongan\b/i,
  /\bvoucher\b/i,
  /\bpromo\b/i,
];

function isDateOrTimeLine(line: string): boolean {
  // Date patterns: 12-11-2026, 12/11/26, 12-10% (OCR), Tgl. ...
  if (/^\s*(tgl|tanggal|date|wi[,.])\b/i.test(line)) return true;
  if (/\b\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4}\b/.test(line)) return true;
  if (/\b\d{1,2}\s*[-/.]\s*\d{1,2}\s*%/.test(line)) return true; // OCR misread like 12-10%
  // Time patterns: 20:31:25, 20:31, 20:3
  if (/\b\d{1,2}\s*:\s*\d{1,2}(?:\s*:\s*\d{1,2})?\b/.test(line)) return true;
  // Version strings like V.2026.9.2
  if (/\bv\.\d{4}\./i.test(line)) return true;
  return false;
}

function matchesAny(line: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(line));
}

function parseNumberToken(numStr: string): number {
  let cleaned = numStr.trim().replace(/\s+/g, "");
  // Reject leading zero multi-digit strings like 054.000 (NPWP) or 0812345 (phone) or 001 (RT)
  if (/^0\d/.test(cleaned)) return 0;

  // Handle decimal cents like 15.000,00 or 15,000.00
  if (/[.,]\d{2}$/.test(cleaned) && cleaned.length > 5) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.replace(/[.,]/g, "");
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

/**
 * Extract all valid price-like or numeric tokens from a line,
 * ignoring product volume/weight specs (e.g. 350ML, 350M., 250G, 1L) and percentages (10%).
 */
function maskProductSpecs(line: string): { masked: string; restore: (s: string) => string } {
  const placeholders: string[] = [];
  // Match digits attached to common measurement units or percentage
  const specRegex = /\b\d+(?:[.,]\d+)?\s*(?:ml|m\.|gr|gram|kg|mg|ltr|lt|l|pcs|pack|oz|cm|mm|gb|w|v|%)\b/gi;
  const masked = line.replace(specRegex, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    return `__SPEC_${idx}__`;
  });

  const restore = (s: string) =>
    s.replace(/__SPEC_(\d+)__/g, (_, i) => placeholders[Number(i)] || "");

  return { masked, restore };
}

interface NumberToken {
  raw: string;
  value: number;
  index: number;
  endIndex: number;
  hasSeparator: boolean;
}

function extractNumberTokens(text: string): NumberToken[] {
  // Match formatted thousands (3,600 / 15.000 / 15.000,00) or plain integers (1..9999999)
  const regex = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b|\b\d{1,7}\b/g;
  const tokens: NumberToken[] = [];

  for (const m of text.matchAll(regex)) {
    if (m.index === undefined) continue;
    const raw = m[0];
    // Skip leading zero multi-digit (e.g., 054.000, 001)
    if (/^0\d/.test(raw)) continue;

    const hasSeparator = /[.,]/.test(raw);
    const val = parseNumberToken(raw);
    if (val <= 0) continue;

    tokens.push({
      raw,
      value: val,
      index: m.index,
      endIndex: m.index + raw.length,
      hasSeparator,
    });
  }
  return tokens;
}

function extractLastPrice(line: string): number {
  const cleaned = line.replace(/rp\.?/gi, " ").replace(/\bidr\b/gi, " ");
  const { masked } = maskProductSpecs(cleaned);
  const tokens = extractNumberTokens(masked).filter(
    (t) => t.value >= 50 || t.hasSeparator
  );
  if (tokens.length === 0) return 0;
  return tokens[tokens.length - 1].value;
}

function extractTaxInfo(line: string): { label: string; amount: number } | null {
  const amount = extractLastPrice(line);
  if (amount <= 0) return null;

  let label = "Pajak";
  if (/\bpph\b/i.test(line)) {
    const pphMatch = line.match(/\bpph(?:\s*\d+)?/i);
    label = pphMatch ? pphMatch[0].toUpperCase() : "PPh";
  } else if (/\bpb\s*1\b/i.test(line)) {
    label = "PB1";
  } else if (/\bppn\b|\bdpp\b|\bfpn\b|\bpen\b/i.test(line)) {
    label = "PPN";
  } else if (/\bservice\b/i.test(line)) {
    label = "Service";
  }

  return { label, amount };
}

function cleanItemName(name: string): string {
  return name
    .replace(/^[-*•—_=~:|.\s]+/, "")
    .replace(/[-*•—_=~:|.\s]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseReceiptText(rawText: string): ParsedReceiptResult {
  const emptyResult: ParsedReceiptResult = {
    items: [],
    pajak: null,
    subtotalNota: null,
    totalAkhirNota: null,
    subtotalItems: 0,
    grandTotalHitung: 0,
    isVerified: false,
  };

  if (!rawText || !rawText.trim()) return emptyResult;

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedItem[] = [];
  let inSummaryZone = false;
  let subtotalNota: number | null = null;
  let totalAkhirNota: number | null = null;
  let paymentTotal: number | null = null;
  let detectedTax: { label: string; amount: number } | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Skip divider lines
    if (/^[=\-_*#~.|+\s]{3,}$/.test(line)) continue;

    // Skip date/time/version metadata lines
    if (isDateOrTimeLine(line)) {
      // Dates at the bottom also mark end of items if we already found items
      if (items.length > 0) inSummaryZone = true;
      continue;
    }

    // Skip explicit header/footer noise
    if (matchesAny(line, HEADER_ONLY_KEYWORDS)) continue;

    // Check if this is a Tax line (PPN, PPh, PB1, DPP, etc.)
    if (matchesAny(line, TAX_KEYWORDS)) {
      const tax = extractTaxInfo(line);
      if (tax) {
        // Keep the most specific tax or accumulate if distinct? Usually one main PPN/PPh line
        detectedTax = tax;
      }
      if (items.length > 0) inSummaryZone = true;
      continue;
    }

    // Check if this is a Subtotal / Total line
    if (matchesAny(line, SUMMARY_TOTAL_KEYWORDS)) {
      inSummaryZone = true;
      const val = extractLastPrice(line);
      if (val > 0) {
        if (/\bsub\s*-?\s*t[o0]t[a4][l1i]\b/i.test(line)) {
          subtotalNota = val;
        } else {
          // Prefer "Total", "Grand Total", "Total Bayar", "Total Item"
          if (totalAkhirNota === null || !/\btotal\s*item\b/i.test(line)) {
            totalAkhirNota = val;
          } else if (totalAkhirNota === null) {
            totalAkhirNota = val;
          }
        }
      }
      continue;
    }

    // Check if this is a Payment method line (Gopay, QRIS, Tunai, Kembalian, etc.)
    if (matchesAny(line, PAYMENT_KEYWORDS)) {
      inSummaryZone = true;
      const val = extractLastPrice(line);
      if (val > 0 && !/\bkemb[a4]l[i1]|change\b/i.test(line)) {
        if (paymentTotal === null) paymentTotal = val;
      }
      continue;
    }

    // Check if this is a Discount/Promo line
    if (matchesAny(line, DISCOUNT_KEYWORDS)) {
      continue;
    }

    // Never parse items once we have entered the Summary/Payment/Footer zone
    if (inSummaryZone) continue;

    // --- Candidate Item Line Parsing ---
    const cleanedCurrency = line
      .replace(/rp\.?/gi, " ")
      .replace(/\bidr\b/gi, " ")
      .replace(/[|]/g, " ")
      .trim();

    const { masked, restore } = maskProductSpecs(cleanedCurrency);
    const tokens = extractNumberTokens(masked);

    // Filter price-candidate tokens (>= 100 or formatted with separator >= 50)
    const priceCandidates = tokens.filter((t) => t.value >= 100 || (t.hasSeparator && t.value >= 50));

    if (priceCandidates.length > 0) {
      const lastToken = priceCandidates[priceCandidates.length - 1];
      const lineTotal = lastToken.value;
      let cutIndex = lastToken.index;
      let qty = 1;
      let explicitUnitPrice: number | null = null;
      let hasAtSymbol = false;

      // Check tokens immediately preceding lastToken (could be unit price column or qty column)
      const beforeLastTokens = tokens.filter((t) => t.endIndex <= lastToken.index);

      if (beforeLastTokens.length > 0) {
        const prev1 = beforeLastTokens[beforeLastTokens.length - 1];
        const gap1 = masked.slice(prev1.endIndex, lastToken.index).trim();

        // Is prev1 separated only by spaces or 'x' / '@' (part of the trailing numeric columns)?
        if (/^([xX*@]?)$/.test(gap1)) {
          if (gap1 === "@") hasAtSymbol = true;

          if (prev1.value >= 100 || prev1.hasSeparator) {
            // prev1 is a Unit Price column (e.g., `1  3,600  3,600` or smudged `330  3,600`)
            explicitUnitPrice = prev1.value;
            cutIndex = prev1.index;

            // Check if there is a qty column before prev1
            if (beforeLastTokens.length > 1) {
              const prev2 = beforeLastTokens[beforeLastTokens.length - 2];
              const gap2 = masked.slice(prev2.endIndex, prev1.index).trim();
              if (/^([xX*]?)$/.test(gap2) && prev2.value >= 1 && prev2.value < 100 && !prev2.hasSeparator) {
                qty = prev2.value;
                cutIndex = prev2.index;
              }
            }
          } else if (prev1.value >= 1 && prev1.value < 100 && !prev1.hasSeparator) {
            // prev1 is a Qty column (e.g., `ICHI GTEA 350ML  2  7,200` or `Es Teh 2x 5.000`)
            qty = prev1.value;
            cutIndex = prev1.index;
          }
        }
      }

      let beforeText = masked.slice(0, cutIndex).trim();

      // Check explicit qty like "2x ..." or "... 2x" or "... x2" in beforeText
      const qtyXMatch = beforeText.match(/\b(\d{1,2})\s*[xX]\b|\b[xX]\s*(\d{1,2})\b/);
      if (qty === 1 && qtyXMatch) {
        qty = parseInt(qtyXMatch[1] || qtyXMatch[2], 10);
        beforeText = beforeText.replace(qtyXMatch[0], " ").trim();
      } else if (qty === 1) {
        // Leading qty like "2 Nasi Goreng"
        const leadMatch = beforeText.match(/^(\d{1,2})\s+([a-zA-Z_].*)/);
        if (leadMatch) {
          qty = parseInt(leadMatch[1], 10);
          beforeText = leadMatch[2].trim();
        }
      }

      const restoredName = cleanItemName(restore(beforeText));
      // Must contain at least 2 letters to be a real item name (not just punctuation/digits)
      const letterCount = (restoredName.match(/[a-zA-Z]/g) || []).length;

      if (letterCount >= 2 && lineTotal > 0) {
        let unitPrice = lineTotal;
        let ambiguousLineTotal: number | undefined;

        if (hasAtSymbol) {
          // e.g. `2 @ 15.000` -> 15000 is unit price
          unitPrice = lineTotal;
        } else if (explicitUnitPrice !== null && qty > 1) {
          if (qty * explicitUnitPrice === lineTotal) {
            unitPrice = explicitUnitPrice;
          } else if (lineTotal % qty === 0) {
            unitPrice = lineTotal / qty;
          } else {
            unitPrice = explicitUnitPrice;
          }
        } else if (qty > 1) {
          // Only one price found alongside qty > 1 (could be line total or unit price)
          if (lineTotal % qty === 0 && lineTotal / qty >= 100) {
            unitPrice = lineTotal / qty;
            ambiguousLineTotal = lineTotal;
          } else {
            unitPrice = lineTotal;
          }
        }

        items.push({
          id: crypto.randomUUID(),
          nama: restoredName,
          qty: Math.max(1, qty),
          harga: Math.max(0, Math.round(unitPrice)),
          _ambiguousLineTotal: ambiguousLineTotal,
        });
        continue;
      }
    }

    // Pattern 2: Multi-line layout (Line i: Name, Line i+1: "2 x 15.000" or "1 x 18.000")
    if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      if (!isDateOrTimeLine(nextLine) && !matchesAny(nextLine, [...SUMMARY_TOTAL_KEYWORDS, ...PAYMENT_KEYWORDS, ...TAX_KEYWORDS])) {
        const multiMatch = nextLine.match(
          /^\s*(?:(\d{1,2})\s*[xX@]\s*)?(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\b\d{3,7}\b)\s*$/i
        );
        if (multiMatch) {
          const qty = multiMatch[1] ? parseInt(multiMatch[1], 10) : 1;
          const price = parseNumberToken(multiMatch[2]);
          const cleanName = cleanItemName(line);
          const letterCount = (cleanName.match(/[a-zA-Z]/g) || []).length;

          if (letterCount >= 2 && price > 0) {
            items.push({
              id: crypto.randomUUID(),
              nama: cleanName,
              qty: Math.max(1, qty),
              harga: price,
            });
            i++;
            continue;
          }
        }
      }
    }
  }

  // --- Verification & Reconciliation ---
  const resolvedTotalNota = totalAkhirNota ?? paymentTotal ?? subtotalNota;

  // Resolve ambiguous qty > 1 prices using receipt total if available
  if (resolvedTotalNota !== null) {
    const currentSum = items.reduce((s, it) => s + it.qty * it.harga, 0);
    const taxVal = detectedTax ? detectedTax.amount : 0;

    if (currentSum !== resolvedTotalNota && currentSum + taxVal !== resolvedTotalNota) {
      // Check if switching any ambiguous item (where `rawPrice` was unitPrice instead of lineTotal) matches better
      for (const item of items) {
        if (item._ambiguousLineTotal !== undefined) {
          const altUnitPrice = item._ambiguousLineTotal;
          const diff = item.qty * altUnitPrice - item.qty * item.harga;
          const altSum = currentSum + diff;
          if (altSum === resolvedTotalNota || altSum + taxVal === resolvedTotalNota) {
            item.harga = altUnitPrice;
            break;
          }
        }
      }
    }
  }

  // Clean internal helper property
  const cleanItems: ParsedItem[] = items.map(({ id, nama, qty, harga }) => ({
    id,
    nama,
    qty,
    harga,
  }));

  const subtotalItems = cleanItems.reduce((sum, item) => sum + item.qty * item.harga, 0);

  // Determine tax relationship (included vs added vs deducted)
  let finalTax: ParsedTax | null = null;
  let grandTotalHitung = subtotalItems;

  if (detectedTax) {
    if (resolvedTotalNota !== null) {
      if (Math.abs(subtotalItems - resolvedTotalNota) <= 50) {
        // Items already include PPN (e.g. Alfamart: item = 3,600, Total = 3,600, DPP 3,243 + PPN 356)
        finalTax = {
          label: detectedTax.label,
          amount: detectedTax.amount,
          isIncludedInItems: true,
        };
        grandTotalHitung = subtotalItems;
      } else if (Math.abs(subtotalItems + detectedTax.amount - resolvedTotalNota) <= 50) {
        // Tax added on top (e.g. Restaurant PB1/PPN: Subtotal 50,000 + PPN 5,000 = Total 55,000)
        finalTax = {
          label: detectedTax.label,
          amount: detectedTax.amount,
          isIncludedInItems: false,
        };
        grandTotalHitung = subtotalItems + detectedTax.amount;
      } else if (Math.abs(subtotalItems - detectedTax.amount - resolvedTotalNota) <= 50) {
        // Tax deducted (e.g. PPh 23 withholding)
        finalTax = {
          label: detectedTax.label,
          amount: detectedTax.amount,
          isIncludedInItems: false,
          isDeduction: true,
        };
        grandTotalHitung = subtotalItems - detectedTax.amount;
      } else {
        // Default: show as included if subtotalNota === subtotalItems, else exclusive
        const isInc = subtotalNota === null && detectedTax.label === "PPN";
        finalTax = {
          label: detectedTax.label,
          amount: detectedTax.amount,
          isIncludedInItems: isInc,
        };
        grandTotalHitung = isInc ? subtotalItems : subtotalItems + detectedTax.amount;
      }
    } else {
      finalTax = {
        label: detectedTax.label,
        amount: detectedTax.amount,
        isIncludedInItems: false,
      };
      grandTotalHitung = subtotalItems + detectedTax.amount;
    }
  }

  const isVerified =
    resolvedTotalNota !== null &&
    cleanItems.length > 0 &&
    Math.abs(grandTotalHitung - resolvedTotalNota) <= 50;

  return {
    items: cleanItems,
    pajak: finalTax,
    subtotalNota,
    totalAkhirNota: resolvedTotalNota,
    subtotalItems,
    grandTotalHitung,
    isVerified,
  };
}
