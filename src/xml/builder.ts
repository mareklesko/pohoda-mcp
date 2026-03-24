import { create } from "xmlbuilder2";

type XMLBuilder = ReturnType<typeof create>;
import { NS, POHODA_VERSION, POHODA_APP_NAME } from "./namespaces.js";

let requestCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}_${++requestCounter}`;
}

export interface DataPackOptions {
  ico: string;
  note?: string;
}

export function createDataPack(opts: DataPackOptions): XMLBuilder {
  const dp = create({ version: "1.0", encoding: "Windows-1250" })
    .ele(NS.dat, "dat:dataPack")
    .att("id", nextId("dp"))
    .att("ico", opts.ico)
    .att("application", POHODA_APP_NAME)
    .att("version", POHODA_VERSION)
    .att("note", opts.note ?? "MCP request");
  for (const [prefix, uri] of Object.entries(NS)) {
    dp.att(`xmlns:${prefix}`, uri);
  }
  return dp;
}

export function addDataPackItem(dataPack: XMLBuilder): XMLBuilder {
  return dataPack
    .ele(NS.dat, "dat:dataPackItem")
    .att("id", nextId("di"))
    .att("version", POHODA_VERSION);
}

export function buildExportRequest(
  opts: DataPackOptions,
  listTag: string,
  listNs: string,
  requestTag: string,
  filterContent?: (req: XMLBuilder, listReq: XMLBuilder) => void,
): string {
  const dp = createDataPack(opts);
  const item = addDataPackItem(dp);
  const listReq = item.ele(listNs, listTag).att("version", POHODA_VERSION);
  const req = listReq.ele(listNs, requestTag);
  if (filterContent) filterContent(req, listReq);
  return dp.end({ prettyPrint: false });
}

export function buildImportDoc(
  opts: DataPackOptions,
  docBuilder: (item: XMLBuilder) => void,
): string {
  const dp = createDataPack(opts);
  const item = addDataPackItem(dp);
  docBuilder(item);
  return dp.end({ prettyPrint: false });
}

export { create, type XMLBuilder };
