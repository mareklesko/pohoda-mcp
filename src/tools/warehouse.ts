import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const itemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]).optional(),
  unit: z.string().optional(),
  stockCode: z.string().optional().describe("Stock item code for stock link"),
});

const prevodkaItemSchema = z.object({
  stockCode: z.string().describe("Stock item code (required for transfer)"),
  quantity: z.number().optional().describe("Quantity to transfer"),
  note: z.string().optional().describe("Item note"),
});

const partnerFields = {
  partnerName: z.string().optional(),
  partnerStreet: z.string().optional(),
  partnerCity: z.string().optional(),
  partnerZip: z.string().optional(),
  partnerIco: z.string().optional(),
};

const listFilterFields = {
  id: z.number().optional().describe("Document ID"),
  dateFrom: z.string().optional().describe("Date from (DD.MM.YYYY or YYYY-MM-DD)"),
  dateTill: z.string().optional().describe("Date to"),
  lastChanges: z.string().optional().describe("Only changed after this date"),
};

function addPartner(parent: import("../xml/builder.js").XMLBuilder, prefix: string, ns: string, params: Record<string, unknown>) {
  const name = params.partnerName as string | undefined;
  if (!name) return;
  const pi = parent.ele(ns, `${prefix}:partnerIdentity`);
  const addr = pi.ele(NS.typ, "typ:address");
  addr.ele(NS.typ, "typ:name").txt(name);
  if (params.partnerStreet) addr.ele(NS.typ, "typ:street").txt(params.partnerStreet as string);
  if (params.partnerCity) addr.ele(NS.typ, "typ:city").txt(params.partnerCity as string);
  if (params.partnerZip) addr.ele(NS.typ, "typ:zip").txt(params.partnerZip as string);
  if (params.partnerIco) addr.ele(NS.typ, "typ:ico").txt(params.partnerIco as string);
}

function buildWarehouseListTool(
  server: McpServer,
  client: PohodaClient,
  toolName: string,
  description: string,
  listTag: string,
  requestTag: string,
  docVersionAttr: string,
) {
  server.tool(toolName, description, listFilterFields, async (params) => {
    try {
      const xml = buildExportRequest(
        { ico: client.ico },
        listTag,
        NS.lst,
        requestTag,
        (req, listReq) => {
          listReq.att(docVersionAttr, "2.0");
          applyFilter(req, params);
        },
      );
      const resp = parseResponse(await client.sendXml(xml));
      const data = extractListData(resp);
      return jsonResult(description, data, data.length);
    } catch (e) {
      return err((e as Error).message);
    }
  });
}

function buildWarehouseCreateTool(
  server: McpServer,
  client: PohodaClient,
  toolName: string,
  description: string,
  ns: string,
  prefix: string,
  docTag: string,
  headerTag: string,
  detailTag: string,
  itemTag: string,
) {
  server.tool(
    toolName,
    description,
    {
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Document text"),
      note: z.string().optional().describe("Note"),
      ...partnerFields,
      items: z.array(itemSchema).optional().describe("Line items"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const doc = item.ele(ns, `${prefix}:${docTag}`).att("version", "2.0");
          const hdr = doc.ele(ns, `${prefix}:${headerTag}`);
          hdr.ele(ns, `${prefix}:date`).txt(toIsoDate(params.date));
          if (params.text) hdr.ele(ns, `${prefix}:text`).txt(params.text);
          addPartner(hdr, prefix, ns, params);
          if (params.note) hdr.ele(ns, `${prefix}:note`).txt(params.note);

          if (params.items?.length) {
            const det = doc.ele(ns, `${prefix}:${detailTag}`);
            for (const i of params.items) {
              const li = det.ele(ns, `${prefix}:${itemTag}`);
              li.ele(ns, `${prefix}:text`).txt(i.text);
              li.ele(ns, `${prefix}:quantity`).txt(String(i.quantity));
              if (i.unit) li.ele(ns, `${prefix}:unit`).txt(i.unit);
              if (i.rateVAT) li.ele(ns, `${prefix}:rateVAT`).txt(i.rateVAT);
              li.ele(ns, `${prefix}:homeCurrency`).ele(NS.typ, "typ:unitPrice").txt(String(i.unitPrice));
              if (i.stockCode) {
                li.ele(ns, `${prefix}:stockItem`).ele(NS.typ, "typ:stockItem").ele(NS.typ, "typ:ids").txt(i.stockCode);
              }
            }
          }
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success
          ? ok(`Document created. ${result.message}${result.producedId ? ` ID: ${result.producedId}` : ""}`)
          : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

export function registerWarehouseTools(server: McpServer, client: PohodaClient) {
  buildWarehouseListTool(server, client, "pohoda_list_prijemky", "Export receiving documents (příjemky) from POHODA", "lst:listPrijemkaRequest", "lst:requestPrijemka", "prijemkaVersion");
  buildWarehouseCreateTool(server, client, "pohoda_create_prijemka", "Create a receiving document (příjemka) in POHODA", NS.pri, "pri", "prijemka", "prijemkaHeader", "prijemkaDetail", "prijemkaItem");

  buildWarehouseListTool(server, client, "pohoda_list_vydejky", "Export dispatch documents (výdejky) from POHODA", "lst:listVydejkaRequest", "lst:requestVydejka", "vydejkaVersion");
  buildWarehouseCreateTool(server, client, "pohoda_create_vydejka", "Create a dispatch document (výdejka) in POHODA", NS.vyd, "vyd", "vydejka", "vydejkaHeader", "vydejkaDetail", "vydejkaItem");

  buildWarehouseListTool(server, client, "pohoda_list_prodejky", "Export sales documents (prodejky) from POHODA", "lst:listProdejkaRequest", "lst:requestProdejka", "prodejkaVersion");
  buildWarehouseCreateTool(server, client, "pohoda_create_prodejka", "Create a sales document (prodejka) in POHODA", NS.pro, "pro", "prodejka", "prodejkaHeader", "prodejkaDetail", "prodejkaItem");

  buildWarehouseListTool(server, client, "pohoda_list_prevodky", "Export transfer documents (převodky) from POHODA", "lst:listPrevodkaRequest", "lst:requestPrevodka", "prevodkaVersion");

  server.tool(
    "pohoda_create_prevodka",
    "Create a transfer document (převodka) in POHODA",
    {
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Document text"),
      note: z.string().optional().describe("Note"),
      ...partnerFields,
      items: z.array(prevodkaItemSchema).optional().describe("Items to transfer (each requires a stock item code)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const doc = item.ele(NS.pre, "pre:prevodka").att("version", "2.0");
          const hdr = doc.ele(NS.pre, "pre:prevodkaHeader");
          hdr.ele(NS.pre, "pre:date").txt(toIsoDate(params.date));
          if (params.text) hdr.ele(NS.pre, "pre:text").txt(params.text);
          addPartner(hdr, "pre", NS.pre, params);
          if (params.note) hdr.ele(NS.pre, "pre:note").txt(params.note);

          if (params.items?.length) {
            const det = doc.ele(NS.pre, "pre:prevodkaDetail");
            for (const i of params.items) {
              const li = det.ele(NS.pre, "pre:prevodkaItem");
              if (i.quantity != null) li.ele(NS.pre, "pre:quantity").txt(String(i.quantity));
              li.ele(NS.pre, "pre:stockItem").ele(NS.typ, "typ:stockItem").ele(NS.typ, "typ:ids").txt(i.stockCode);
              if (i.note) li.ele(NS.pre, "pre:note").txt(i.note);
            }
          }
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success
          ? ok(`Document created. ${result.message}${result.producedId ? ` ID: ${result.producedId}` : ""}`)
          : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}
