import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData } from "../xml/parser.js";
import { err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";

export function registerReportTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_accountancy",
    "List accountancy records from POHODA. Read-only export. Supports filtering by date range or last changes. Returns JSON array of accountancy records.",
    {
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listAccountancyRequest",
          NS.lst,
          "lst:requestAccountancy",
          (req) => applyFilter(req, params)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Accountancy", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_list_balance",
    "List balance records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of balance records.",
    {
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listBalanceRequest",
          NS.lst,
          "lst:requestBalance",
          (req) => applyFilter(req, params)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Balance", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_list_movements",
    "List movement records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of movement records.",
    {
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listMovementRequest",
          NS.lst,
          "lst:requestMovement",
          (req) => applyFilter(req, params)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Movements", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_list_vat",
    "List VAT classification records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of VAT classification records.",
    {
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listClassificationVATRequest",
          NS.lst,
          "lst:requestClassificationVAT",
          (req) => applyFilter(req, params)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("VAT classification", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
