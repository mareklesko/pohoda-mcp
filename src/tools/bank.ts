import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const bankTypeEnum = z.enum(["receipt", "expense"]);

const bankItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
});

export function registerBankTools(server: McpServer, client: PohodaClient): void {
  server.tool(
    "pohoda_list_bank",
    "List bank documents (receipts and expenses) from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching records.",
    {
      id: z.number().optional().describe("Filter by bank document ID"),
      dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
      dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
      companyName: z.string().optional().describe("Filter by company name"),
      lastChanges: z.string().optional().describe("Filter by last changes date"),
    },
    async (params) => {
      try {
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listBankRequest",
          NS.lst,
          "lst:requestBank",
          (req, listReq) => {
            listReq.att("bankVersion", "2.0");
            applyFilter(req, params);
          }
        );
        const response = await client.sendXml(xml);
        const parsed = parseResponse(response);
        const data = extractListData(parsed);
        return jsonResult("Bank documents", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.tool(
    "pohoda_create_bank",
    "Create a bank document (receipt or expense) in POHODA. Requires bankType and date. Optional: text, account, symbols, partner details, note, and line items.",
    {
      bankType: bankTypeEnum.describe("Bank document type: receipt or expense (required)"),
      date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
      text: z.string().optional().describe("Document text/description"),
      account: z.string().optional().describe("Bank account identifier"),
      symVar: z.string().optional().describe("Variable symbol"),
      symConst: z.string().optional().describe("Constant symbol"),
      symSpec: z.string().optional().describe("Specific symbol"),
      partnerName: z.string().optional().describe("Partner company name"),
      partnerStreet: z.string().optional().describe("Partner street"),
      partnerCity: z.string().optional().describe("Partner city"),
      partnerZip: z.string().optional().describe("Partner ZIP code"),
      partnerIco: z.string().optional().describe("Partner IČO"),
      note: z.string().optional().describe("Note"),
      items: z
        .array(bankItemSchema)
        .optional()
        .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high)"),
    },
    async (params) => {
      try {
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const bank = item.ele(NS.bnk, "bnk:bank").att("version", "2.0");
          const header = bank.ele(NS.bnk, "bnk:bankHeader");

          header.ele(NS.bnk, "bnk:bankType").txt(params.bankType);
          if (params.account) {
            header.ele(NS.bnk, "bnk:account").ele(NS.typ, "typ:ids").txt(params.account);
          }
          header.ele(NS.bnk, "bnk:datePayment").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.bnk, "bnk:text").txt(params.text);
          if (params.symVar) header.ele(NS.bnk, "bnk:symVar").txt(params.symVar);
          if (params.symConst) header.ele(NS.bnk, "bnk:symConst").txt(params.symConst);
          if (params.symSpec) header.ele(NS.bnk, "bnk:symSpec").txt(params.symSpec);

          const hasPartner =
            params.partnerName ?? params.partnerStreet ?? params.partnerCity ?? params.partnerZip ?? params.partnerIco;
          if (hasPartner) {
            const identity = header.ele(NS.bnk, "bnk:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.partnerStreet) typAddr.ele(NS.typ, "typ:street").txt(params.partnerStreet);
            if (params.partnerCity) typAddr.ele(NS.typ, "typ:city").txt(params.partnerCity);
            if (params.partnerZip) typAddr.ele(NS.typ, "typ:zip").txt(params.partnerZip);
            if (params.partnerIco) typAddr.ele(NS.typ, "typ:ico").txt(params.partnerIco);
          }

          if (params.note) header.ele(NS.bnk, "bnk:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = bank.ele(NS.bnk, "bnk:bankDetail");
            for (const it of params.items) {
              const bankItem = detail.ele(NS.bnk, "bnk:bankItem");
              bankItem.ele(NS.bnk, "bnk:text").txt(it.text);
              bankItem.ele(NS.bnk, "bnk:quantity").txt(String(it.quantity));
              bankItem.ele(NS.bnk, "bnk:rateVAT").txt(it.rateVAT);
              bankItem
                .ele(NS.bnk, "bnk:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Bank document created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
