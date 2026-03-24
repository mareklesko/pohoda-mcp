import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter, type ListFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

export function registerContractTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_contracts",
    "List contracts from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching contract records.",
    {
      id: z.number().optional().describe("Filter by contract ID"),
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      companyName: z.string().optional().describe("Filter by company name"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listContractRequest",
          NS.lCon,
          "lst:requestContract",
          (req, listReq) => {
            listReq.att("contractVersion", "2.0");
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

  server.tool(
    "pohoda_create_contract",
    "Create a new contract in POHODA. Optional: number, datePlan, text, partner details, note.",
    {
      number: z.string().optional().describe("Contract number"),
      datePlanDelivery: z.string().optional().describe("Planned delivery date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Contract text/description"),
      partnerName: z.string().optional().describe("Partner company name"),
      partnerStreet: z.string().optional().describe("Partner street"),
      partnerCity: z.string().optional().describe("Partner city"),
      partnerZip: z.string().optional().describe("Partner ZIP code"),
      partnerIco: z.string().optional().describe("Partner IČO"),
      note: z.string().optional().describe("Note"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const con = item.ele(NS.con, "con:contract").att("version", "2.0");
          const desc = con.ele(NS.con, "con:contractDesc");

          if (params.number) desc.ele(NS.con, "con:number").txt(params.number);
          if (params.datePlanDelivery) desc.ele(NS.con, "con:datePlanDelivery").txt(toIsoDate(params.datePlanDelivery));
          if (params.text) desc.ele(NS.con, "con:text").txt(params.text);

          const hasPartner =
            params.partnerName ?? params.partnerStreet ?? params.partnerCity ?? params.partnerZip ?? params.partnerIco;
          if (hasPartner) {
            const identity = desc.ele(NS.con, "con:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.partnerStreet) typAddr.ele(NS.typ, "typ:street").txt(params.partnerStreet);
            if (params.partnerCity) typAddr.ele(NS.typ, "typ:city").txt(params.partnerCity);
            if (params.partnerZip) typAddr.ele(NS.typ, "typ:zip").txt(params.partnerZip);
            if (params.partnerIco) typAddr.ele(NS.typ, "typ:ico").txt(params.partnerIco);
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

  server.tool(
    "pohoda_delete_contract",
    "Delete a contract from POHODA by ID. Requires the contract ID.",
    {
      id: z.number().describe("Contract ID to delete (required)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const con = item.ele(NS.con, "con:contract").att("version", "2.0");
          const actionType = con.ele(NS.con, "con:actionType");
          const del = actionType.ele(NS.con, "con:delete");
          const filter = del.ele(NS.ftr, "ftr:filter");
          filter.ele(NS.ftr, "ftr:id").txt(String(params.id));
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Contract deleted successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
