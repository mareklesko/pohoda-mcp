import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyInvoiceFilter, type InvoiceFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const invoiceTypeEnum = z.enum([
  "issuedInvoice",
  "issuedCreditNote",
  "receivedInvoice",
  "issuedAdvanceInvoice",
  "receivedAdvanceInvoice",
  "receivable",
  "commitment",
]);

const listInvoiceParams = z.object({
  invoiceType: invoiceTypeEnum.optional(),
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  variableSymbol: z.string().optional(),
  companyName: z.string().optional(),
  ico: z.string().optional(),
  lastChanges: z.string().optional(),
});

const invoiceItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
  unit: z.string().optional(),
  code: z.string().optional(),
});

const createInvoiceParams = z.object({
  invoiceType: invoiceTypeEnum,
  date: z.string(),
  dateTax: z.string().optional(),
  dateDue: z.string().optional(),
  dateAccounting: z.string().optional(),
  text: z.string().optional(),
  partnerName: z.string().optional(),
  partnerStreet: z.string().optional(),
  partnerCity: z.string().optional(),
  partnerZip: z.string().optional(),
  partnerIco: z.string().optional(),
  partnerDic: z.string().optional(),
  symVar: z.string().optional(),
  symConst: z.string().optional(),
  symSpec: z.string().optional(),
  note: z.string().optional(),
  intNote: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

const deleteInvoiceParams = z.object({
  id: z.number(),
});

export function registerInvoiceTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_invoices",
    {
      description:
        "List invoices from POHODA. Supports filtering by invoice type, ID, date range, variable symbol, company name, IČO, or last changes. Returns JSON array of matching invoice records.",
      inputSchema: {
        invoiceType: invoiceTypeEnum.optional().describe("Filter by invoice type"),
        id: z.number().optional().describe("Filter by invoice ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        variableSymbol: z.string().optional().describe("Filter by variable symbol"),
        companyName: z.string().optional().describe("Filter by company name"),
        ico: z.string().optional().describe("Filter by IČO"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listInvoiceParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listInvoiceRequest",
          NS.lst,
          "lst:requestInvoice",
          (req) => {
            if (params.invoiceType) req.att("invoiceType", params.invoiceType);
            const filterParams: InvoiceFilterParams = {
              id: params.id,
              dateFrom: params.dateFrom,
              dateTill: params.dateTill,
              variableSymbol: params.variableSymbol,
              companyName: params.companyName,
              ico: params.ico,
              lastChanges: params.lastChanges,
            };
            applyInvoiceFilter(req, filterParams);
          }
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Invoices", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_create_invoice",
    {
      description:
        "Create a new invoice in POHODA. Requires invoiceType and date. Optional: dateTax, dateDue, dateAccounting, text, partner details, symbols, note, and line items.",
      inputSchema: {
        invoiceType: invoiceTypeEnum.describe("Invoice type (required)"),
        date: z.string().describe("Invoice date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTax: z.string().optional().describe("Tax date"),
        dateDue: z.string().optional().describe("Due date"),
        dateAccounting: z.string().optional().describe("Accounting date"),
        text: z.string().optional().describe("Invoice text/description"),
        partnerName: z.string().optional().describe("Partner company name"),
        partnerStreet: z.string().optional().describe("Partner street"),
        partnerCity: z.string().optional().describe("Partner city"),
        partnerZip: z.string().optional().describe("Partner ZIP code"),
        partnerIco: z.string().optional().describe("Partner IČO"),
        partnerDic: z.string().optional().describe("Partner DIČ"),
        symVar: z.string().optional().describe("Variable symbol"),
        symConst: z.string().optional().describe("Constant symbol"),
        symSpec: z.string().optional().describe("Specific symbol"),
        note: z.string().optional().describe("Note"),
        intNote: z.string().optional().describe("Internal note"),
        items: z
          .array(invoiceItemSchema)
          .optional()
          .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high), optional unit, code"),
      },
    },
    async (args) => {
      try {
        const params = createInvoiceParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const inv = item.ele(NS.inv, "inv:invoice").att("version", "2.0");
          const header = inv.ele(NS.inv, "inv:invoiceHeader");

          header.ele(NS.inv, "inv:invoiceType").txt(params.invoiceType);
          header.ele(NS.inv, "inv:date").txt(toIsoDate(params.date));
          if (params.dateTax) header.ele(NS.inv, "inv:dateTax").txt(toIsoDate(params.dateTax));
          if (params.dateDue) header.ele(NS.inv, "inv:dateDue").txt(toIsoDate(params.dateDue));
          if (params.dateAccounting)
            header.ele(NS.inv, "inv:dateAccounting").txt(toIsoDate(params.dateAccounting));
          if (params.text) header.ele(NS.inv, "inv:text").txt(params.text);

          const hasPartner =
            params.partnerName ??
            params.partnerStreet ??
            params.partnerCity ??
            params.partnerZip ??
            params.partnerIco ??
            params.partnerDic;
          if (hasPartner) {
            const identity = header.ele(NS.inv, "inv:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.partnerStreet) typAddr.ele(NS.typ, "typ:street").txt(params.partnerStreet);
            if (params.partnerCity) typAddr.ele(NS.typ, "typ:city").txt(params.partnerCity);
            if (params.partnerZip) typAddr.ele(NS.typ, "typ:zip").txt(params.partnerZip);
            if (params.partnerIco) typAddr.ele(NS.typ, "typ:ico").txt(params.partnerIco);
            if (params.partnerDic) typAddr.ele(NS.typ, "typ:dic").txt(params.partnerDic);
          }

          if (params.symVar) header.ele(NS.inv, "inv:symVar").txt(params.symVar);
          if (params.symConst) header.ele(NS.inv, "inv:symConst").txt(params.symConst);
          if (params.symSpec) header.ele(NS.inv, "inv:symSpec").txt(params.symSpec);
          if (params.note) header.ele(NS.inv, "inv:note").txt(params.note);
          if (params.intNote) header.ele(NS.inv, "inv:intNote").txt(params.intNote);

          if (params.items && params.items.length > 0) {
            const detail = inv.ele(NS.inv, "inv:invoiceDetail");
            for (const it of params.items) {
              const invItem = detail.ele(NS.inv, "inv:invoiceItem");
              invItem.ele(NS.inv, "inv:text").txt(it.text);
              invItem.ele(NS.inv, "inv:quantity").txt(String(it.quantity));
              if (it.unit) invItem.ele(NS.inv, "inv:unit").txt(it.unit);
              invItem.ele(NS.inv, "inv:rateVAT").txt(it.rateVAT);
              invItem.ele(NS.inv, "inv:homeCurrency").ele(NS.typ, "typ:unitPrice").txt(String(it.unitPrice));
              if (it.code) invItem.ele(NS.inv, "inv:code").txt(it.code);
            }
          }

          inv.ele(NS.inv, "inv:invoiceSummary");
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Invoice created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_delete_invoice",
    {
      description: "Delete an invoice from POHODA by ID. Requires the invoice ID.",
      inputSchema: {
        id: z.number().describe("Invoice ID to delete (required)"),
      },
    },
    async (args) => {
      try {
        const params = deleteInvoiceParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const inv = item.ele(NS.inv, "inv:invoice").att("version", "2.0");
          const actionType = inv.ele(NS.inv, "inv:actionType");
          const del = actionType.ele(NS.inv, "inv:delete");
          const filter = del.ele(NS.ftr, "ftr:filter");
          filter.ele(NS.ftr, "ftr:id").txt(String(params.id));
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success ? ok(`Invoice deleted successfully. ${result.message}`) : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
