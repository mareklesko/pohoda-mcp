import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

export function registerProductionTools(server: McpServer, client: PohodaClient) {
  server.tool(
    "pohoda_list_vyroba",
    "Export production documents (výroba) from POHODA",
    {
      id: z.number().optional().describe("Document ID"),
      dateFrom: z.string().optional().describe("Date from"),
      dateTill: z.string().optional().describe("Date to"),
      lastChanges: z.string().optional().describe("Only changed after this date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listVyrobaRequest",
          NS.lst,
          "lst:requestVyroba",
          (req) => applyFilter(req, params),
        );
        const resp = parseResponse(await client.sendXml(xml));
        const data = extractListData(resp);
        return jsonResult("Production documents", data, data.length);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_create_vyroba",
    "Create a production document (výroba) in POHODA",
    {
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Description"),
      note: z.string().optional(),
      items: z.array(z.object({
        text: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        unit: z.string().optional(),
        stockCode: z.string().optional(),
      })).optional().describe("Production items"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const doc = item.ele(NS.vyr, "vyr:vyroba").att("version", "2.0");
          const hdr = doc.ele(NS.vyr, "vyr:vyrobaHeader");
          hdr.ele(NS.vyr, "vyr:date").txt(toIsoDate(params.date));
          if (params.text) hdr.ele(NS.vyr, "vyr:text").txt(params.text);
          if (params.note) hdr.ele(NS.vyr, "vyr:note").txt(params.note);

          if (params.items?.length) {
            const det = doc.ele(NS.vyr, "vyr:vyrobaDetail");
            for (const i of params.items) {
              const li = det.ele(NS.vyr, "vyr:vyrobaItem");
              li.ele(NS.vyr, "vyr:text").txt(i.text);
              li.ele(NS.vyr, "vyr:quantity").txt(String(i.quantity));
              if (i.unit) li.ele(NS.vyr, "vyr:unit").txt(i.unit);
              li.ele(NS.vyr, "vyr:homeCurrency").ele(NS.typ, "typ:unitPrice").txt(String(i.unitPrice));
              if (i.stockCode) {
                li.ele(NS.vyr, "vyr:stockItem").ele(NS.typ, "typ:stockItem").ele(NS.typ, "typ:ids").txt(i.stockCode);
              }
            }
          }
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success
          ? ok(`Production document created. ${result.message}${result.producedId ? ` ID: ${result.producedId}` : ""}`)
          : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_list_service",
    "Export service records from POHODA",
    {
      id: z.number().optional().describe("Service record ID"),
      dateFrom: z.string().optional().describe("Date from"),
      dateTill: z.string().optional().describe("Date to"),
      lastChanges: z.string().optional().describe("Only changed after this date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listServiceRequest",
          NS.lst,
          "lst:requestService",
          (req) => applyFilter(req, params),
        );
        const resp = parseResponse(await client.sendXml(xml));
        const data = extractListData(resp);
        return jsonResult("Service records", data, data.length);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_create_service",
    "Create a service record in POHODA",
    {
      date: z.string().describe("Service date"),
      text: z.string().optional().describe("Description"),
      partnerName: z.string().optional(),
      note: z.string().optional(),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const doc = item.ele(NS.ser, "ser:service").att("version", "2.0");
          const hdr = doc.ele(NS.ser, "ser:serviceHeader");
          hdr.ele(NS.ser, "ser:date").txt(toIsoDate(params.date));
          if (params.text) hdr.ele(NS.ser, "ser:text").txt(params.text);
          if (params.partnerName) {
            const pi = hdr.ele(NS.ser, "ser:partnerIdentity");
            pi.ele(NS.typ, "typ:address").ele(NS.typ, "typ:name").txt(params.partnerName);
          }
          if (params.note) hdr.ele(NS.ser, "ser:note").txt(params.note);
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success
          ? ok(`Service record created. ${result.message}${result.producedId ? ` ID: ${result.producedId}` : ""}`)
          : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}
