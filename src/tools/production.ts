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
          (req, listReq) => {
            listReq.att("vyrobaVersion", "2.0");
            applyFilter(req, params);
          },
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
        stockCode: z.string().describe("Stock item code (required to identify the item being produced)"),
        quantity: z.number().optional().describe("Quantity"),
        note: z.string().optional().describe("Item note"),
      })).optional().describe("Production items (each references a stock item)"),
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
              if (i.quantity != null) li.ele(NS.vyr, "vyr:quantity").txt(String(i.quantity));
              li.ele(NS.vyr, "vyr:stockItem").ele(NS.typ, "typ:stockItem").ele(NS.typ, "typ:ids").txt(i.stockCode);
              if (i.note) li.ele(NS.vyr, "vyr:note").txt(i.note);
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
          (req, listReq) => {
            listReq.att("serviceVersion", "2.0");
            applyFilter(req, params);
          },
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
      serviceType: z.enum(["postWarranty", "warranty"]).describe("Service type: postWarranty or warranty (required)"),
      received: z.string().optional().describe("Date of receipt into service (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Description"),
      partnerName: z.string().optional(),
      note: z.string().optional(),
      subjectText: z.string().optional().describe("Subject of service (description of the serviced item)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const doc = item.ele(NS.ser, "ser:service").att("version", "2.0");
          const hdr = doc.ele(NS.ser, "ser:serviceHeader");
          hdr.ele(NS.ser, "ser:serviceType").txt(params.serviceType);
          if (params.received) hdr.ele(NS.ser, "ser:received").txt(toIsoDate(params.received));
          if (params.text) hdr.ele(NS.ser, "ser:text").txt(params.text);
          if (params.partnerName) {
            const pi = hdr.ele(NS.ser, "ser:partnerIdentity");
            pi.ele(NS.typ, "typ:address").ele(NS.typ, "typ:name").txt(params.partnerName);
          }
          if (params.note) hdr.ele(NS.ser, "ser:note").txt(params.note);
          const subj = doc.ele(NS.ser, "ser:serviceSubject");
          const subject = subj.ele(NS.ser, "ser:subject");
          if (params.subjectText) subject.ele(NS.ser, "ser:text").txt(params.subjectText);
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
