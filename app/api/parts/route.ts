import type { PartInfo } from "../../../lib/parts";
import { loadParts } from "../../../lib/store";

export const runtime = "nodejs";

// Photos already verified for the rows on screen. Reads the database only;
// never contacts DIBBS or a distributor.
export async function POST(request: Request) {
  let nsns: unknown;
  try {
    nsns = (await request.json())?.nsns;
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(nsns) || nsns.length > 100)
    return Response.json({ message: "Invalid request." }, { status: 400 });
  const clean = nsns.filter(
    (n): n is string => typeof n === "string" && /^[0-9A-Z][0-9A-Z -]{8,40}$/i.test(n),
  );
  const photos: Record<string, PartInfo["photo"]> = {};
  for (const { nsn, data } of await loadParts(clean))
    if ((data as PartInfo).photo) photos[nsn] = (data as PartInfo).photo;
  return Response.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}
