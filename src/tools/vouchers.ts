import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const voucherTypeEnum = z.enum(["receipt", "expense"]);

const listVouchersParams = z.object({
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  companyName: z.string().optional(),
  lastChanges: z.string().optional(),
});

const voucherItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
});

const createVoucherParams = z.object({
  voucherType: voucherTypeEnum,
  cashRegister: z.string().optional(),
  date: z.string(),
  text: z.string().optional(),
  symVar: z.string().optional(),
  symConst: z.string().optional(),
  partnerName: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  ico: z.string().optional(),
  note: z.string().optional(),
  items: z.array(voucherItemSchema).optional(),
});

export function registerVoucherTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_vouchers",
    {
      description:
        "List cash vouchers (receipts and expenses) from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching records.",
      inputSchema: {
        id: z.number().optional().describe("Filter by voucher ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        companyName: z.string().optional().describe("Filter by company name"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listVouchersParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listCashRequest",
          NS.lst,
          "lst:requestCash",
          (req) => applyFilter(req, params)
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Vouchers", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_create_voucher",
    {
      description:
        "Create a cash voucher (receipt or expense) in POHODA. Requires voucherType and date. Optional: cashRegister, text, symbols, partner details, note, and line items.",
      inputSchema: {
        voucherType: voucherTypeEnum.describe("Voucher type: receipt or expense (required)"),
        cashRegister: z.string().optional().describe("Cash register identifier"),
        date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
        text: z.string().optional().describe("Document text/description"),
        symVar: z.string().optional().describe("Variable symbol"),
        symConst: z.string().optional().describe("Constant symbol"),
        partnerName: z.string().optional().describe("Partner company name"),
        street: z.string().optional().describe("Partner street"),
        city: z.string().optional().describe("Partner city"),
        zip: z.string().optional().describe("Partner ZIP code"),
        ico: z.string().optional().describe("Partner IČO"),
        note: z.string().optional().describe("Note"),
        items: z
          .array(voucherItemSchema)
          .optional()
          .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high)"),
      },
    },
    async (args) => {
      try {
        const params = createVoucherParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const vch = item.ele(NS.vch, "vch:voucher").att("version", "2.0");
          const header = vch.ele(NS.vch, "vch:voucherHeader");

          header.ele(NS.vch, "vch:voucherType").txt(params.voucherType);
          if (params.cashRegister) {
            header.ele(NS.vch, "vch:cashRegister").ele(NS.typ, "typ:ids").txt(params.cashRegister);
          }
          header.ele(NS.vch, "vch:date").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.vch, "vch:text").txt(params.text);
          if (params.symVar) header.ele(NS.vch, "vch:symVar").txt(params.symVar);
          if (params.symConst) header.ele(NS.vch, "vch:symConst").txt(params.symConst);

          const hasPartner =
            params.partnerName ?? params.street ?? params.city ?? params.zip ?? params.ico;
          if (hasPartner) {
            const identity = header.ele(NS.vch, "vch:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.street) typAddr.ele(NS.typ, "typ:street").txt(params.street);
            if (params.city) typAddr.ele(NS.typ, "typ:city").txt(params.city);
            if (params.zip) typAddr.ele(NS.typ, "typ:zip").txt(params.zip);
            if (params.ico) typAddr.ele(NS.typ, "typ:ico").txt(params.ico);
          }

          if (params.note) header.ele(NS.vch, "vch:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = vch.ele(NS.vch, "vch:voucherDetail");
            for (const it of params.items) {
              const vchItem = detail.ele(NS.vch, "vch:voucherItem");
              vchItem.ele(NS.vch, "vch:text").txt(it.text);
              vchItem.ele(NS.vch, "vch:quantity").txt(String(it.quantity));
              vchItem.ele(NS.vch, "vch:rateVAT").txt(it.rateVAT);
              vchItem
                .ele(NS.vch, "vch:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Voucher created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
