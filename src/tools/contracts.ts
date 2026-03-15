import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc, buildDeleteRequest } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter, type ListFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const listContractParams = z.object({
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  companyName: z.string().optional(),
  lastChanges: z.string().optional(),
});

const createContractParams = z.object({
  number: z.string().optional(),
  datePlan: z.string().optional(),
  text: z.string().optional(),
  partnerName: z.string().optional(),
  Street: z.string().optional(),
  City: z.string().optional(),
  Zip: z.string().optional(),
  Ico: z.string().optional(),
  note: z.string().optional(),
});

const deleteContractParams = z.object({
  id: z.number(),
});

export function registerContractTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_contracts",
    {
      description:
        "List contracts from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching contract records.",
      inputSchema: {
        id: z.number().optional().describe("Filter by contract ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        companyName: z.string().optional().describe("Filter by company name"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listContractParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listContractRequest",
          NS.lCon,
          "lst:requestContract",
          (req) => {
            const filterParams: ListFilterParams = {
              id: params.id,
              dateFrom: params.dateFrom,
              dateTill: params.dateTill,
              companyName: params.companyName,
              lastChanges: params.lastChanges,
            };
            applyFilter(req, filterParams);
          }
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Contracts", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_create_contract",
    {
      description:
        "Create a new contract in POHODA. Optional: number, datePlan, text, partner details (partnerName, Street, City, Zip, Ico), note.",
      inputSchema: {
        number: z.string().optional().describe("Contract number"),
        datePlan: z.string().optional().describe("Planned date (DD.MM.YYYY or YYYY-MM-DD)"),
        text: z.string().optional().describe("Contract text/description"),
        partnerName: z.string().optional().describe("Partner company name"),
        Street: z.string().optional().describe("Partner street"),
        City: z.string().optional().describe("Partner city"),
        Zip: z.string().optional().describe("Partner ZIP code"),
        Ico: z.string().optional().describe("Partner IČO"),
        note: z.string().optional().describe("Note"),
      },
    },
    async (args) => {
      try {
        const params = createContractParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const con = item.ele(NS.con, "con:contract").att("version", "2.0");
          const desc = con.ele(NS.con, "con:contractDesc");

          if (params.number) desc.ele(NS.con, "con:number").txt(params.number);
          if (params.datePlan) desc.ele(NS.con, "con:datePlan").txt(toIsoDate(params.datePlan));
          if (params.text) desc.ele(NS.con, "con:text").txt(params.text);

          const hasPartner =
            params.partnerName ?? params.Street ?? params.City ?? params.Zip ?? params.Ico;
          if (hasPartner) {
            const identity = desc.ele(NS.con, "con:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.Street) typAddr.ele(NS.typ, "typ:street").txt(params.Street);
            if (params.City) typAddr.ele(NS.typ, "typ:city").txt(params.City);
            if (params.Zip) typAddr.ele(NS.typ, "typ:zip").txt(params.Zip);
            if (params.Ico) typAddr.ele(NS.typ, "typ:ico").txt(params.Ico);
          }

          if (params.note) desc.ele(NS.con, "con:note").txt(params.note);
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Contract created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_delete_contract",
    {
      description: "Delete a contract from POHODA by ID. Requires the contract ID.",
      inputSchema: {
        id: z.number().describe("Contract ID to delete (required)"),
      },
    },
    async (args) => {
      try {
        const params = deleteContractParams.parse(args);
        const xml = buildDeleteRequest(
          { ico: client.ico },
          "con:contract",
          NS.con,
          "con:contractDesc",
          { id: params.id }
        );
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Contract deleted successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
