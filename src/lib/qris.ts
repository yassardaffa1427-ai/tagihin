/**
 * Utilitas Generator QRIS Dinamis (EMVCo MPM / Bank Indonesia Standard)
 * Mengubah QRIS Statis menjadi QRIS Dinamis dengan nominal transaksi otomatis.
 */

export const DEFAULT_STATIC_QRIS =
  process.env.NEXT_PUBLIC_DEFAULT_QRIS_STRING ||
  "00020101021126610014COM.GO-JEK.WWW01189360091430384629830210G0384629830303UMI51440014ID.CO.QRIS.WWW0215ID10265674133190303UMI5204899953033605802ID5924warung madura, Digital &6005BOGOR61051612162140703A01110362163049D52";

/**
 * Menghitung CRC16 CCITT (Polynom 0x1021, Init 0xFFFF)
 */
export function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Menghasilkan string QRIS Dinamis dari QRIS statis dan nominal tertentu
 * @param staticQris String QRIS statis awal
 * @param amount Nominal tagihan (angka bulat dalam Rupiah)
 */
export function generateDynamicQRIS(
  staticQris: string = DEFAULT_STATIC_QRIS,
  amount: number = 0
): string {
  if (!staticQris || typeof staticQris !== "string") {
    return DEFAULT_STATIC_QRIS;
  }

  const cleanQris = staticQris.trim();
  if (amount <= 0) {
    return cleanQris;
  }

  // 1. Buang 4 digit checksum lama di akhir (format standar diakhiri 6304XXXX)
  let rawWithoutCrc = cleanQris.endsWith("6304")
    ? cleanQris
    : cleanQris.slice(0, -4);

  // Jika belum ada prefix tag 6304, tambahkan
  if (!rawWithoutCrc.includes("6304")) {
    const idx63 = rawWithoutCrc.lastIndexOf("63");
    if (idx63 !== -1 && idx63 >= rawWithoutCrc.length - 8) {
      rawWithoutCrc = rawWithoutCrc.slice(0, idx63) + "6304";
    } else {
      rawWithoutCrc = rawWithoutCrc + "6304";
    }
  }

  // Pisahkan body QRIS sebelum "6304"
  const body = rawWithoutCrc.slice(0, rawWithoutCrc.indexOf("6304"));

  // 2. Ubah tipe Point of Initiation Method dari statis (010211) ke dinamis (010212)
  let updatedBody = body.replace("010211", "010212");

  // 3. Buat Tag 54 (Transaction Amount)
  const amountStr = Math.round(amount).toString();
  const amountTag = `54${amountStr.length.toString().padStart(2, "0")}${amountStr}`;

  // Cek apakah Tag 54 sudah ada sebelumnya
  const tag54Regex = /54\d{2}\d+/;
  if (tag54Regex.test(updatedBody)) {
    updatedBody = updatedBody.replace(tag54Regex, amountTag);
  } else {
    // Sisipkan sebelum Tag 58 (Country Code: 5802ID)
    const tag58Idx = updatedBody.indexOf("5802ID");
    if (tag58Idx !== -1) {
      updatedBody =
        updatedBody.slice(0, tag58Idx) + amountTag + updatedBody.slice(tag58Idx);
    } else {
      updatedBody = updatedBody + amountTag;
    }
  }

  // 4. Gabungkan dengan tag 6304 dan hitung CRC16
  const finalPayloadBeforeCrc = updatedBody + "6304";
  const checksum = calculateCRC16(finalPayloadBeforeCrc);

  return finalPayloadBeforeCrc + checksum;
}
