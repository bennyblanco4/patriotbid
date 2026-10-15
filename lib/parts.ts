import { getDocumentProxy } from "unpdf";
import { DibbsSession, safeLink } from "./dibbs";
import { isUnitCode } from "./units";

// An approved source named in a solicitation: who makes the item and under
// which part number. DLA prints these as "MANUFACTURER CAGE P/N NUMBER".
export type Source = { name: string; cage: string; partNumber: string };

export type Photo = {
  url: string;
  productUrl: string;
  provider: string;
  partNumber: string;
  manufacturer: string;
};

// One line of the solicitation's "Procurement History for NSN/FSC" table.
export type Award = {
  cage: string;
  contract: string;
  quantity: number;
  unitCost: number;
  date: string;
  surplus: boolean;
};

export type PartInfo = {
  sources: Source[];
  // DoD unit of issue code from the line item, such as "EA".
  unit?: string | null;
  // Past awards for this NSN, newest first; missing on entries saved before
  // the history was read.
  awards?: Award[];
  photo: Photo | null;
  // Whether a photo provider was available when this was checked; a miss
  // without one is retried once a key is configured.
  searched: boolean;
};

const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function readSources(text: string): Source[] {
  const found = new Map<string, Source>();
  const add = (name: string, cage: string, partNumber: string) => {
    const pn = partNumber.replace(/[.,;]+$/, "");
    const key = `${cage}:${compact(pn)}`;
    if (compact(pn).length < 3 || found.has(key)) return;
    found.set(key, { name: name.replace(/\s+/g, " ").trim(), cage, partNumber: pn });
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*([A-Z0-9][A-Z0-9 .,&'()\/-]{1,80}?)\s+([0-9A-HJ-NP-Z]{5})\s+P\/N\s+([A-Z0-9][A-Z0-9.\/-]{1,40})(?=\s|$)/,
    );
    if (m) add(m[1], m[2], m[3]);
  }
  // "Name / CAGE: 12345 / P/N ABC123" sentence form
  for (const m of text.matchAll(
    /([A-Za-z0-9][A-Za-z0-9 .,&'()-]{1,80}?)\s*\/\s*CAGE:\s*([0-9A-HJ-NP-Z]{5})\s*\/\s*P\/N\s*([A-Z0-9][A-Z0-9.\/-]{1,40})/g,
  ))
    add(m[1], m[2], m[3]);
  return [...found.values()];
}

// The unit of issue printed on the first line item. Automated RFQs list
// "CLIN PR PRLI UI QUANTITY" ("0001 7018541488 0001 EA 34.000"); manual ones
// list "ITEM NO. SUPPLIES/SERVICES QUANTITY UNIT" ("0001 6685-22-617-1434 4.000 EA $").
export function readUnit(text: string): string | null {
  const code =
    text.match(/^\s*\d{4}\s+\d{10}\s+(?:\d{4}\s+)?([0-9A-Z]{2})\s+[\d,]+\.\d+\b/m)?.[1] ??
    text.match(/^\s*\d{4}\s+[0-9A-Z-]{9,20}\s+[\d,]+\.\d+\s+([0-9A-Z]{2})\s+\$/m)?.[1];
  return code && isUnitCode(code) ? code : null;
}

// Section A prints past awards as rows of
// "CAGE CONTRACT QUANTITY UNIT-COST YYYYMMDD SURPLUS", e.g.
// "4LF36 SPE1C126V0624 1.000 224.90000 20260618 N".
export function readAwards(text: string): Award[] {
  const start = text.search(/Procurement\s+History\s+for\s+NSN/i);
  if (start < 0) return [];
  const rest = text.slice(start);
  const end = rest.search(/\bSECTION\s+B\b/);
  const block = end < 0 ? rest : rest.slice(0, end);
  const awards: Award[] = [];
  for (const m of block.matchAll(
    /\b([0-9A-HJ-NP-Z]{5})\s+([A-Z0-9]{13,20})\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+(\d{4})(\d{2})(\d{2})\s+([YN])\b/g,
  ))
    awards.push({
      cage: m[1],
      contract: m[2],
      quantity: Number(m[3].replace(/,/g, "")),
      unitCost: Number(m[4].replace(/,/g, "")),
      date: `${m[5]}-${m[6]}-${m[7]}`,
      surplus: m[8] === "Y",
    });
  return awards.sort((a, b) => b.date.localeCompare(a.date));
}

// The manufacturer has to agree as well as the part number, so two
// companies' identical numbers are never confused.
export function sameMaker(sourceName: string, maker: string) {
  const words = (s: string) =>
    s
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !/^(INC|LLC|LTD|CORP|CORPORATION|COMPANY|THE|SAS|GMBH|DIV|DIVISION|AND|USA|INTL|INTERNATIONAL|CO)$/.test(w),
      );
  const maker_ = new Set(words(maker));
  return words(sourceName).some((w) => maker_.has(w));
}

export function exactMatch(source: Source, partNumber: string, maker: string) {
  return (
    compact(source.partNumber) === compact(partNumber) &&
    sameMaker(source.name, maker)
  );
}

type MouserPart = {
  ManufacturerPartNumber?: string;
  Manufacturer?: string;
  ImagePath?: string;
  ProductDetailUrl?: string;
};

async function mouser(source: Source, key: string): Promise<Photo | null> {
  const response = await fetch(
    `https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SearchByPartRequest: {
          mouserPartNumber: source.partNumber,
          partSearchOptions: "Exact",
        },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    SearchResults?: { Parts?: MouserPart[] };
  };
  for (const part of data.SearchResults?.Parts ?? []) {
    if (
      part.ImagePath?.startsWith("https://") &&
      part.ManufacturerPartNumber &&
      part.Manufacturer &&
      exactMatch(source, part.ManufacturerPartNumber, part.Manufacturer)
    )
      return {
        url: part.ImagePath,
        productUrl: part.ProductDetailUrl || "",
        provider: "Mouser",
        partNumber: part.ManufacturerPartNumber,
        manufacturer: part.Manufacturer,
      };
  }
  return null;
}

export const photoSearchEnabled = () => Boolean(process.env.MOUSER_API_KEY);

export async function findPhoto(sources: Source[]): Promise<Photo | null> {
  const key = process.env.MOUSER_API_KEY;
  if (!key) return null;
  for (const source of sources.slice(0, 3)) {
    const photo = await mouser(source, key).catch(() => null);
    if (photo) return photo;
  }
  return null;
}

let session: { value: DibbsSession; at: number } | null = null;

export async function readSolicitation(
  pdfUrl: string,
  nsn: string,
): Promise<{ sources: Source[]; unit: string | null; awards: Award[] }> {
  const url = safeLink(pdfUrl);
  if (!url || !/^https:\/\/dibbs2\.bsm\.dla\.mil\/Downloads\/RFQ\//i.test(url))
    throw new Error("Unexpected solicitation link.");
  if (!session || Date.now() - session.at > 1800000)
    session = { value: new DibbsSession(), at: Date.now() };
  const bytes = await session.value.file(url);
  const text = await pdfText(bytes);
  // Only trust a solicitation that is actually about this item.
  const digits = nsn.replace(/[^0-9A-Z]/gi, "").slice(0, 13).toUpperCase();
  if (!compact(text).includes(digits))
    throw new Error("This solicitation does not list the item.");
  return { sources: readSources(text), unit: readUnit(text), awards: readAwards(text) };
}

// Rebuild lines from pdf.js text items; merged extraction can glue the end
// of one line onto the next and swallow the part number's boundary.
async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  let text = "";
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    for (const item of content.items)
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
    text += "\n";
  }
  return text;
}
