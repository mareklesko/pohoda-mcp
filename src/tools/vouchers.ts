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

const voucherItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
});

export function registerVoucherTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_vouchers",
    "List cash vouchers (receipts and expenses) from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching records.",
    {
      id: z.number().optional().describe("Filter by voucher ID"),
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      companyName: z.string().optional().describe("Filter by company name"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
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

  server.tool(
    "pohoda_create_voucher",
    "Create a cash voucher (receipt or expense) in POHODA. Requires voucherType and date. Optional: cashRegister, text, symbols, partner details, note, and line items.",
    {
      voucherType: voucherTypeEnum.describe("Voucher type: receipt or expense (required)"),
      cashRegister: z.string().optional().describe("Cash register identifier"),
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Document text/description"),
      symVar: z.string().optional().describe("Variable symbol"),
      symConst: z.string().optional().describe("Constant symbol"),
      partnerName: z.string().optional().describe("Partner company name"),
      partnerStreet: z.string().optional().describe("Partner street"),
      partnerCity: z.string().optional().describe("Partner city"),
      partnerZip: z.string().optional().describe("Partner ZIP code"),
      partnerIco: z.string().optional().describe("Partner IČO"),
      note: z.string().optional().describe("Note"),
      items: z
        .array(voucherItemSchema)
        .optional()
        .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high)"),
    },
    async (params) => {
      try {
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
            params.partnerName ?? params.partnerStreet ?? params.partnerCity ?? params.partnerZip ?? params.partnerIco;
          if (hasPartner) {
            const identity = header.ele(NS.vch, "vch:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.partnerStreet) typAddr.ele(NS.typ, "typ:street").txt(params.partnerStreet);
            if (params.partnerCity) typAddr.ele(NS.typ, "typ:city").txt(params.partnerCity);
            if (params.partnerZip) typAddr.ele(NS.typ, "typ:zip").txt(params.partnerZip);
            if (params.partnerIco) typAddr.ele(NS.typ, "typ:ico").txt(params.partnerIco);
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
