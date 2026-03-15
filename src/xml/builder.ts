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
  return create({ version: "1.0", encoding: "Windows-1250" })
    .ele(NS.dat, "dat:dataPack")
    .att("id", nextId("dp"))
    .att("ico", opts.ico)
    .att("application", POHODA_APP_NAME)
    .att("version", POHODA_VERSION)
    .att("note", opts.note ?? "MCP request");
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
  filterContent?: (req: XMLBuilder) => void,
): string {
  const dp = createDataPack(opts);
  const item = addDataPackItem(dp);
  const listReq = item.ele(listNs, listTag).att("version", POHODA_VERSION);
  const req = listReq.ele(listNs, requestTag);
  if (filterContent) filterContent(req);
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

export function buildDeleteRequest(
  opts: DataPackOptions,
  docTag: string,
  docNs: string,
  headerTag: string,
  deleteFilter: Record<string, string | number>,
): string {
  const dp = createDataPack(opts);
  const item = addDataPackItem(dp);
  const doc = item.ele(docNs, docTag).att("version", POHODA_VERSION);
  doc.ele(docNs, "actionType")
    .ele(docNs, "delete")
    .ele(NS.ftr, "ftr:filter");
  const filter = doc.first()!.first()!.first()!;
  for (const [k, v] of Object.entries(deleteFilter)) {
    filter.ele(NS.ftr, `ftr:${k}`).txt(String(v));
  }
  return dp.end({ prettyPrint: false });
}

export function addFilter(parent: XMLBuilder, filters: Record<string, string | number | undefined>): void {
  const ftr = parent.ele(NS.ftr, "ftr:filter");
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") {
      ftr.ele(NS.ftr, `ftr:${key}`).txt(String(value));
    }
  }
}

export function addDateFilter(
  parent: XMLBuilder,
  field: string,
  from?: string,
  to?: string,
): void {
  if (!from && !to) return;
  const ftr = parent.ele(NS.ftr, "ftr:filter");
  const df = ftr.ele(NS.ftr, `ftr:${field}`);
  if (from) df.ele(NS.ftr, "ftr:dateFrom").txt(from);
  if (to) df.ele(NS.ftr, "ftr:dateTill").txt(to);
}

export { create, type XMLBuilder };
