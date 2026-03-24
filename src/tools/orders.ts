import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc, type XMLBuilder } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import type { ListFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const orderTypeEnum = z.enum(["issuedOrder", "receivedOrder"]);

const orderItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
  unit: z.string().optional(),
  code: z.string().optional(),
});

function applyOrderFilter(parent: XMLBuilder, params: ListFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");
  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.dateFrom) ftr.ele(NS.ftr, "ftr:dateFrom").txt(toIsoDate(params.dateFrom));
  if (params.dateTill) ftr.ele(NS.ftr, "ftr:dateTill").txt(toIsoDate(params.dateTill));
  if (params.companyName) ftr.ele(NS.ftr, "ftr:selectedCompanys").ele(NS.ftr, "ftr:company").txt(params.companyName);
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
}

export function registerOrderTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_orders",
    "List orders from POHODA. Supports filtering by order type, ID, date range, company name, or last changes. Returns JSON array of matching order records.",
    {
      orderType: orderTypeEnum.optional().describe("Filter by order type (issuedOrder or receivedOrder)"),
      id: z.number().optional().describe("Filter by order ID"),
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      companyName: z.string().optional().describe("Filter by company name"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listOrderRequest",
          NS.lst,
          "lst:requestOrder",
          (req, listReq) => {
            listReq.att("orderVersion", "2.0");
            if (params.orderType) listReq.att("orderType", params.orderType);
            applyOrderFilter(req, {
              id: params.id,
              dateFrom: params.dateFrom,
              dateTill: params.dateTill,
              companyName: params.companyName,
              lastChanges: params.lastChanges,
            });
          }
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Orders", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_create_order",
    "Create a new order in POHODA. Requires orderType and date. Optional: numberOrder, text, partner details, note, and line items.",
    {
      orderType: orderTypeEnum.describe("Order type: issuedOrder or receivedOrder (required)"),
      date: z.string().describe("Order date (DD.MM.YYYY or YYYY-MM-DD)"),
      numberOrder: z.string().optional().describe("Order number"),
      text: z.string().optional().describe("Order text/description"),
      partnerName: z.string().optional().describe("Partner company name"),
      partnerStreet: z.string().optional().describe("Partner street"),
      partnerCity: z.string().optional().describe("Partner city"),
      partnerZip: z.string().optional().describe("Partner ZIP code"),
      partnerIco: z.string().optional().describe("Partner IČO"),
      partnerDic: z.string().optional().describe("Partner DIČ"),
      note: z.string().optional().describe("Note"),
      items: z
        .array(orderItemSchema)
        .optional()
        .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high), optional unit, code"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const ord = item.ele(NS.ord, "ord:order").att("version", "2.0");
          const header = ord.ele(NS.ord, "ord:orderHeader");

          header.ele(NS.ord, "ord:orderType").txt(params.orderType);
          header.ele(NS.ord, "ord:date").txt(toIsoDate(params.date));
          if (params.numberOrder) header.ele(NS.ord, "ord:numberOrder").txt(params.numberOrder);
          if (params.text) header.ele(NS.ord, "ord:text").txt(params.text);

          const hasPartner =
            params.partnerName ??
            params.partnerStreet ??
            params.partnerCity ??
            params.partnerZip ??
            params.partnerIco ??
            params.partnerDic;
          if (hasPartner) {
            const identity = header.ele(NS.ord, "ord:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.partnerStreet) typAddr.ele(NS.typ, "typ:street").txt(params.partnerStreet);
            if (params.partnerCity) typAddr.ele(NS.typ, "typ:city").txt(params.partnerCity);
            if (params.partnerZip) typAddr.ele(NS.typ, "typ:zip").txt(params.partnerZip);
            if (params.partnerIco) typAddr.ele(NS.typ, "typ:ico").txt(params.partnerIco);
            if (params.partnerDic) typAddr.ele(NS.typ, "typ:dic").txt(params.partnerDic);
          }

          if (params.note) header.ele(NS.ord, "ord:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = ord.ele(NS.ord, "ord:orderDetail");
            for (const it of params.items) {
              const ordItem = detail.ele(NS.ord, "ord:orderItem");
              ordItem.ele(NS.ord, "ord:text").txt(it.text);
              ordItem.ele(NS.ord, "ord:quantity").txt(String(it.quantity));
              ordItem.ele(NS.ord, "ord:rateVAT").txt(it.rateVAT);
              ordItem
                .ele(NS.ord, "ord:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
              if (it.unit) ordItem.ele(NS.ord, "ord:unit").txt(it.unit);
              if (it.code) ordItem.ele(NS.ord, "ord:code").txt(it.code);
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Order created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_delete_order",
    "Delete an order from POHODA by ID. Requires the order ID.",
    {
      id: z.number().describe("Order ID to delete (required)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const ord = item.ele(NS.ord, "ord:order").att("version", "2.0");
          const actionType = ord.ele(NS.ord, "ord:actionType");
          const del = actionType.ele(NS.ord, "ord:delete");
          const filter = del.ele(NS.ftr, "ftr:filter");
          filter.ele(NS.ftr, "ftr:id").txt(String(params.id));
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Order deleted successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
