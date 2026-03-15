import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

export function registerStockTools(server: McpServer, client: PohodaClient) {
  server.tool(
    "pohoda_list_stock",
    "Export stock/inventory items from POHODA with optional filters",
    {
      id: z.number().optional().describe("Stock item ID"),
      code: z.string().optional().describe("Stock code (supports wildcards *)"),
      name: z.string().optional().describe("Stock item name"),
      store: z.string().optional().describe("Store name filter"),
      lastChanges: z.string().optional().describe("Only items changed after this date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listStockRequest",
          NS.lStk,
          "lst:requestStock",
          (req) => {
            const hasFilter = Object.values(params).some((v) => v != null);
            if (!hasFilter) return;
            const ftr = req.ele(NS.ftr, "ftr:filter");
            if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
            if (params.code) ftr.ele(NS.ftr, "ftr:code").txt(params.code);
            if (params.name) ftr.ele(NS.ftr, "ftr:name").txt(params.name);
            if (params.store) ftr.ele(NS.ftr, "ftr:store").ele(NS.typ, "typ:ids").txt(params.store);
            if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
          },
        );
        const resp = parseResponse(await client.sendXml(xml));
        const data = extractListData(resp);
        return jsonResult("Stock items", data, data.length);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_create_stock",
    "Create a new stock/inventory item in POHODA",
    {
      code: z.string().describe("Unique stock code"),
      name: z.string().describe("Stock item name"),
      stockType: z.enum(["card", "text", "service", "kit", "set"]).optional().describe("Stock type (default: card)"),
      unit: z.string().optional().describe("Unit of measure (e.g., ks, kg, m)"),
      purchasingPrice: z.number().optional().describe("Purchasing price"),
      sellingPrice: z.number().optional().describe("Selling price without VAT"),
      sellingPriceVAT: z.number().optional().describe("Selling price with VAT"),
      rateVAT: z.enum(["none", "low", "high"]).optional().describe("VAT rate"),
      store: z.string().optional().describe("Store name"),
      note: z.string().optional().describe("Note"),
      description: z.string().optional().describe("Extended description"),
      quantity: z.number().optional().describe("Initial quantity"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const stk = item.ele(NS.stk, "stk:stock").att("version", "2.0");
          const hdr = stk.ele(NS.stk, "stk:stockHeader");
          hdr.ele(NS.stk, "stk:stockType").txt(params.stockType ?? "card");
          hdr.ele(NS.stk, "stk:code").txt(params.code);
          hdr.ele(NS.stk, "stk:name").txt(params.name);
          if (params.unit) hdr.ele(NS.stk, "stk:unit").txt(params.unit);
          if (params.store) hdr.ele(NS.stk, "stk:storage").ele(NS.typ, "typ:ids").txt(params.store);
          if (params.purchasingPrice != null) hdr.ele(NS.stk, "stk:purchasingPrice").txt(String(params.purchasingPrice));
          if (params.sellingPrice != null) hdr.ele(NS.stk, "stk:sellingPrice").txt(String(params.sellingPrice));
          if (params.sellingPriceVAT != null) hdr.ele(NS.stk, "stk:sellingPriceVAT").txt(String(params.sellingPriceVAT));
          if (params.rateVAT) hdr.ele(NS.stk, "stk:rateVAT").txt(params.rateVAT);
          if (params.quantity != null) hdr.ele(NS.stk, "stk:count").txt(String(params.quantity));
          if (params.description) hdr.ele(NS.stk, "stk:description").txt(params.description);
          if (params.note) hdr.ele(NS.stk, "stk:note").txt(params.note);
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success
          ? ok(`Stock item created. ${result.message}${result.producedId ? ` ID: ${result.producedId}` : ""}`)
          : err(`Failed to create stock item: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_update_stock",
    "Update an existing stock/inventory item in POHODA",
    {
      id: z.number().optional().describe("Stock item ID to update"),
      code: z.string().optional().describe("Stock code to identify item (alternative to id)"),
      name: z.string().optional().describe("New name"),
      unit: z.string().optional().describe("New unit"),
      purchasingPrice: z.number().optional().describe("New purchasing price"),
      sellingPrice: z.number().optional().describe("New selling price"),
      rateVAT: z.enum(["none", "low", "high"]).optional().describe("New VAT rate"),
      note: z.string().optional().describe("New note"),
    },
    async (params) => {
      try {
        if (!params.id && !params.code) return err("Either id or code is required to identify the stock item.");
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const stk = item.ele(NS.stk, "stk:stock").att("version", "2.0");
          const act = stk.ele(NS.stk, "stk:actionType").ele(NS.stk, "stk:update");
          const ftr = act.ele(NS.ftr, "ftr:filter");
          if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
          else if (params.code) ftr.ele(NS.ftr, "ftr:code").txt(params.code);
          const hdr = stk.ele(NS.stk, "stk:stockHeader");
          if (params.name) hdr.ele(NS.stk, "stk:name").txt(params.name);
          if (params.unit) hdr.ele(NS.stk, "stk:unit").txt(params.unit);
          if (params.purchasingPrice != null) hdr.ele(NS.stk, "stk:purchasingPrice").txt(String(params.purchasingPrice));
          if (params.sellingPrice != null) hdr.ele(NS.stk, "stk:sellingPrice").txt(String(params.sellingPrice));
          if (params.rateVAT) hdr.ele(NS.stk, "stk:rateVAT").txt(params.rateVAT);
          if (params.note) hdr.ele(NS.stk, "stk:note").txt(params.note);
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success ? ok(`Stock item updated. ${result.message}`) : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_delete_stock",
    "Delete a stock/inventory item from POHODA",
    { id: z.number().optional().describe("Stock item ID"), code: z.string().optional().describe("Stock code") },
    async (params) => {
      try {
        if (!params.id && !params.code) return err("Either id or code is required.");
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const stk = item.ele(NS.stk, "stk:stock").att("version", "2.0");
          const del = stk.ele(NS.stk, "stk:actionType").ele(NS.stk, "stk:delete");
          const ftr = del.ele(NS.ftr, "ftr:filter");
          if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
          else if (params.code) ftr.ele(NS.ftr, "ftr:code").txt(params.code);
        });
        const resp = parseResponse(await client.sendXml(xml));
        const result = extractImportResult(resp);
        return result.success ? ok(`Stock item deleted. ${result.message}`) : err(`Failed: ${result.message}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );

  server.tool(
    "pohoda_list_stores",
    "Export list of stores (warehouses) from POHODA",
    {},
    async () => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listStoreRequest",
          NS.lst,
          "lst:requestStore",
        );
        const resp = parseResponse(await client.sendXml(xml));
        const data = extractListData(resp);
        return jsonResult("Stores", data, data.length);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}
