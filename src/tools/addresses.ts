import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter, type ListFilterParams } from "../core/filters.js";

export function registerAddressTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_addresses",
    "List addresses from POHODA addressbook. Supports filtering by id, company name, IČO, last changes date, or code. Returns JSON array of matching address records.",
    {
      id: z.number().optional().describe("Filter by address ID"),
      companyName: z.string().optional().describe("Filter by company name"),
      ico: z.string().optional().describe("Filter by IČO (company ID number)"),
      lastChanges: z.string().optional().describe("Filter by last changes date (DD.MM.YYYY or YYYY-MM-DD)"),
      code: z.string().optional().describe("Filter by address code"),
    },
    async (params) => {
      try {
        const filterParams: ListFilterParams = {
          id: params.id,
          companyName: params.companyName,
          ico: params.ico,
          lastChanges: params.lastChanges,
          code: params.code,
        };
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listAddressBookRequest",
          NS.lAdb,
          "lst:requestAddressBook",
          (req) => applyFilter(req, filterParams)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Addresses", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_create_address",
    "Create a new address/contact in POHODA addressbook. Requires name; optional fields: street, city, zip, IČO, DIČ, email, phone, web, note.",
    {
      name: z.string().describe("Company or contact name (required)"),
      street: z.string().optional().describe("Street address"),
      city: z.string().optional().describe("City"),
      zip: z.string().optional().describe("ZIP/postal code"),
      ico: z.string().optional().describe("IČO (company ID number)"),
      dic: z.string().optional().describe("DIČ (VAT ID)"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      web: z.string().optional().describe("Website URL"),
      note: z.string().optional().describe("Note or comment"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const adb = item.ele(NS.adb, "adb:addressbook").att("version", "2.0");
          const header = adb.ele(NS.adb, "adb:addressbookHeader");
          header.ele(NS.adb, "adb:addressbookType").txt("company");
          const identity = header.ele(NS.adb, "adb:identity");
          const typAddr = identity.ele(NS.typ, "typ:address");
          typAddr.ele(NS.typ, "typ:name").txt(params.name);
          if (params.street) typAddr.ele(NS.typ, "typ:street").txt(params.street);
          if (params.city) typAddr.ele(NS.typ, "typ:city").txt(params.city);
          if (params.zip) typAddr.ele(NS.typ, "typ:zip").txt(params.zip);
          if (params.ico) typAddr.ele(NS.typ, "typ:ico").txt(params.ico);
          if (params.dic) typAddr.ele(NS.typ, "typ:dic").txt(params.dic);
          if (params.email) header.ele(NS.adb, "adb:email").txt(params.email);
          if (params.phone) header.ele(NS.adb, "adb:phone").txt(params.phone);
          if (params.web) header.ele(NS.adb, "adb:web").txt(params.web);
          if (params.note) header.ele(NS.adb, "adb:note").txt(params.note);
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(`Address created successfully. ${result.producedId != null ? `ID: ${result.producedId}` : result.message}`)
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_update_address",
    "Update an existing address in POHODA addressbook by ID. Provide id (required) and any fields to update: name, street, city, zip, ico, dic, email, phone, web, note.",
    {
      id: z.number().describe("Address ID to update (required)"),
      name: z.string().optional().describe("Company or contact name"),
      street: z.string().optional().describe("Street address"),
      city: z.string().optional().describe("City"),
      zip: z.string().optional().describe("ZIP/postal code"),
      ico: z.string().optional().describe("IČO (company ID number)"),
      dic: z.string().optional().describe("DIČ (VAT ID)"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      web: z.string().optional().describe("Website URL"),
      note: z.string().optional().describe("Note or comment"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const adb = item.ele(NS.adb, "adb:addressbook").att("version", "2.0");
          const actionType = adb.ele(NS.adb, "adb:actionType");
          const update = actionType.ele(NS.adb, "adb:update");
          const filter = update.ele(NS.ftr, "ftr:filter");
          filter.ele(NS.ftr, "ftr:id").txt(String(params.id));
          const header = adb.ele(NS.adb, "adb:addressbookHeader");
          const hasIdentity =
            params.name ?? params.street ?? params.city ?? params.zip ?? params.ico ?? params.dic;
          if (hasIdentity) {
            header.ele(NS.adb, "adb:addressbookType").txt("company");
            const identity = header.ele(NS.adb, "adb:identity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.name) typAddr.ele(NS.typ, "typ:name").txt(params.name);
            if (params.street) typAddr.ele(NS.typ, "typ:street").txt(params.street);
            if (params.city) typAddr.ele(NS.typ, "typ:city").txt(params.city);
            if (params.zip) typAddr.ele(NS.typ, "typ:zip").txt(params.zip);
            if (params.ico) typAddr.ele(NS.typ, "typ:ico").txt(params.ico);
            if (params.dic) typAddr.ele(NS.typ, "typ:dic").txt(params.dic);
          }
          if (params.email) header.ele(NS.adb, "adb:email").txt(params.email);
          if (params.phone) header.ele(NS.adb, "adb:phone").txt(params.phone);
          if (params.web) header.ele(NS.adb, "adb:web").txt(params.web);
          if (params.note) header.ele(NS.adb, "adb:note").txt(params.note);
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Address updated successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_delete_address",
    "Delete an address from POHODA addressbook by ID. Requires the address ID.",
    {
      id: z.number().describe("Address ID to delete (required)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const adb = item.ele(NS.adb, "adb:addressbook").att("version", "2.0");
          const actionType = adb.ele(NS.adb, "adb:actionType");
          const del = actionType.ele(NS.adb, "adb:delete");
          const filter = del.ele(NS.ftr, "ftr:filter");
          filter.ele(NS.ftr, "ftr:id").txt(String(params.id));
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Address deleted successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
