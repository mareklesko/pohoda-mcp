import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData } from "../xml/parser.js";
import { err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";

const listAccountancyParams = z.object({
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  lastChanges: z.string().optional(),
});

const listBalanceParams = z.object({
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
});

const listMovementParams = z.object({
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
});

const listVatParams = z.object({
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
});

export function registerReportTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_accountancy",
    {
      description:
        "List accountancy records from POHODA. Read-only export. Supports filtering by date range or last changes. Returns JSON array of accountancy records.",
      inputSchema: {
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listAccountancyParams.parse(args);
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

  server.registerTool(
    "pohoda_list_balance",
    {
      description:
        "List balance records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of balance records.",
      inputSchema: {
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      },
    },
    async (args) => {
      try {
        const params = listBalanceParams.parse(args);
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

  server.registerTool(
    "pohoda_list_movements",
    {
      description:
        "List movement records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of movement records.",
      inputSchema: {
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      },
    },
    async (args) => {
      try {
        const params = listMovementParams.parse(args);
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

  server.registerTool(
    "pohoda_list_vat",
    {
      description:
        "List VAT classification records from POHODA. Read-only export. Supports filtering by date range. Returns JSON array of VAT classification records.",
      inputSchema: {
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      },
    },
    async (args) => {
      try {
        const params = listVatParams.parse(args);
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
