import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const intDocItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
});

export function registerInternalDocTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_internal_docs",
    "List internal documents from POHODA. Supports filtering by ID, date range, or last changes. Returns JSON array of matching records.",
    {
      id: z.number().optional().describe("Filter by internal document ID"),
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listIntDocRequest",
          NS.lst,
          "lst:requestIntDoc",
          (req, listReq) => {
            listReq.att("intDocVersion", "2.0");
            applyFilter(req, params);
          }
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Internal documents", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_create_internal_doc",
    "Create an internal document in POHODA. Requires date. Optional: text, variable symbol, note, and line items.",
    {
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Document text/description"),
      symVar: z.string().optional().describe("Variable symbol"),
      note: z.string().optional().describe("Note"),
      items: z
        .array(intDocItemSchema)
        .optional()
        .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const intDoc = item.ele(NS.int, "int:intDoc").att("version", "2.0");
          const header = intDoc.ele(NS.int, "int:intDocHeader");

          header.ele(NS.int, "int:date").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.int, "int:text").txt(params.text);
          if (params.symVar) header.ele(NS.int, "int:symVar").txt(params.symVar);
          if (params.note) header.ele(NS.int, "int:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = intDoc.ele(NS.int, "int:intDocDetail");
            for (const it of params.items) {
              const intItem = detail.ele(NS.int, "int:intDocItem");
              intItem.ele(NS.int, "int:text").txt(it.text);
              intItem.ele(NS.int, "int:quantity").txt(String(it.quantity));
              intItem.ele(NS.int, "int:rateVAT").txt(it.rateVAT);
              intItem
                .ele(NS.int, "int:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Internal document created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
