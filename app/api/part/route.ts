import {
  findPhoto,
  photoSearchEnabled,
  readSolicitation,
  type PartInfo,
} from "../../../lib/parts";
import { loadPart, savePart } from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;
const pending = new Map<string, Promise<PartInfo>>();
const noStore = { "Cache-Control": "no-store" };

async function lookup(nsn: string, pdf: string): Promise<PartInfo> {
  const saved = await loadPart(nsn);
  const cached = saved?.data as PartInfo | undefined;
  // A miss checked before a photo provider was configured is worth retrying,
  // and entries saved before units were read need the PDF once more.
  const hasUnit = cached?.unit !== undefined;
  if (cached && hasUnit && (cached.searched || !photoSearchEnabled()))
    return cached;
  const read = hasUnit ? null : await readSolicitation(pdf, nsn);
  const sources = cached?.sources ?? read!.sources;
  const info: PartInfo = {
    sources,
    unit: hasUnit ? cached!.unit : read!.unit,
    photo: await findPhoto(sources),
    searched: photoSearchEnabled(),
  };
  await savePart(nsn, info);
  return info;
}

// Approved sources, unit of issue and an exact-match photo for one RFQ, read from its
// solicitation PDF the first time anyone opens it.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nsn = params.get("nsn") || "";
  const pdf = params.get("pdf") || "";
  if (!/^[0-9A-Z][0-9A-Z -]{8,40}$/i.test(nsn) || !pdf)
    return Response.json({ message: "Invalid part." }, { status: 400 });
  try {
    if (!pending.has(nsn)) pending.set(nsn, lookup(nsn, pdf));
    return Response.json(await pending.get(nsn)!, { headers: noStore });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Could not read the solicitation.",
      },
      { status: 502 },
    );
  } finally {
    pending.delete(nsn);
  }
}
