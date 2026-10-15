import { test } from "node:test";
import assert from "node:assert/strict";
import { exactMatch, findPhoto, readSources, sameMaker } from "../lib/parts";

const text = [
  "RQ011: REMOVAL OF GOVERNMENT IDENTIFICATION FROM NON-ACCEPTED SUPPLIES",
  "THALES AVS FRANCE SAS F9111 P/N F1450546",
  "KONGSBERG DEFENCE & AEROSPACE AS N0013 P/N 60249406-00 DLA issues this document",
  "AUTOMATIC SWITCH COMPANY 04845 P/N AV279731",
  "Thales AVS France SAS / CAGE: 23386 / P/N F1450546",
  "CAGE code Part number",
  "Superseding part number - applies to CLIN(s):",
].join("\n");

test("reads approved sources in both DLA formats", () => {
  const sources = readSources(text);
  assert.deepEqual(
    sources.map((s) => `${s.name}|${s.cage}|${s.partNumber}`),
    [
      "THALES AVS FRANCE SAS|F9111|F1450546",
      "KONGSBERG DEFENCE & AEROSPACE AS|N0013|60249406-00",
      "AUTOMATIC SWITCH COMPANY|04845|AV279731",
      "Thales AVS France SAS|23386|F1450546",
    ],
  );
});

test("form boilerplate never becomes a source", () => {
  assert.deepEqual(readSources("CAGE code Part number\nP/N\n"), []);
});

test("a photo needs the exact part number and the same maker", () => {
  const source = { name: "AUTOMATIC SWITCH COMPANY", cage: "04845", partNumber: "AV279731" };
  assert.equal(exactMatch(source, "AV-279731", "ASCO Automatic Switch Co."), true);
  assert.equal(exactMatch(source, "AV279732", "Automatic Switch Company"), false);
  assert.equal(exactMatch(source, "AV279731", "Other Maker Inc"), false);
  assert.equal(sameMaker("THALES AVS FRANCE SAS", "Thales"), true);
  assert.equal(sameMaker("GENERAL DYNAMICS LAND SYSTEMS", "Amphenol"), false);
});

test("photo lookup accepts only an exact match from the distributor", async () => {
  const realFetch = globalThis.fetch;
  const source = { name: "AUTOMATIC SWITCH COMPANY", cage: "04845", partNumber: "AV279731" };
  const reply = (parts: unknown[]) =>
    (async () =>
      new Response(JSON.stringify({ SearchResults: { Parts: parts } }), {
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
  process.env.MOUSER_API_KEY = "test";
  try {
    globalThis.fetch = reply([
      { ManufacturerPartNumber: "AV279731", Manufacturer: "Some Other Brand", ImagePath: "https://img.test/wrong.jpg" },
      { ManufacturerPartNumber: "AV279731", Manufacturer: "Automatic Switch", ImagePath: "https://img.test/right.jpg", ProductDetailUrl: "https://shop.test/p" },
    ]);
    const photo = await findPhoto([source]);
    assert.equal(photo?.url, "https://img.test/right.jpg");
    assert.equal(photo?.provider, "Mouser");
    globalThis.fetch = reply([
      { ManufacturerPartNumber: "AV279731-X", Manufacturer: "Automatic Switch", ImagePath: "https://img.test/near.jpg" },
    ]);
    assert.equal(await findPhoto([source]), null);
    delete process.env.MOUSER_API_KEY;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    assert.equal(await findPhoto([source]), null);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.MOUSER_API_KEY;
  }
});
