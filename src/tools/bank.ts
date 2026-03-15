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

const listBankParams = z.object({
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  companyName: z.string().optional(),
  lastChanges: z.string().optional(),
});

const bankItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
});

const createBankParams = z.object({
  bankType: bankTypeEnum,
  date: z.string(),
  text: z.string().optional(),
  account: z.string().optional(),
  bankCode: z.string().optional(),
  symVar: z.string().optional(),
  symConst: z.string().optional(),
  symSpec: z.string().optional(),
  partnerName: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  ico: z.string().optional(),
  note: z.string().optional(),
  items: z.array(bankItemSchema).optional(),
});

export function registerBankTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_bank",
    {
      description:
        "List bank documents (receipts and expenses) from POHODA. Supports filtering by ID, date range, company name, or last changes. Returns JSON array of matching records.",
      inputSchema: {
        id: z.number().optional().describe("Filter by bank document ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        companyName: z.string().optional().describe("Filter by company name"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listBankParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listBankRequest",
          NS.lst,
          "lst:requestBank",
          (req) => applyFilter(req, params)
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

  server.registerTool(
    "pohoda_create_bank",
    {
      description:
        "Create a bank document (receipt or expense) in POHODA. Requires bankType and date. Optional: text, account, bankCode, symbols, partner details, note, and line items.",
      inputSchema: {
        bankType: bankTypeEnum.describe("Bank document type: receipt or expense (required)"),
        date: z.string().describe("Document date (DD.MM.YYYY or YYYY-MM-DD)"),
        text: z.string().optional().describe("Document text/description"),
        account: z.string().optional().describe("Bank account identifier"),
        bankCode: z.string().optional().describe("Bank code"),
        symVar: z.string().optional().describe("Variable symbol"),
        symConst: z.string().optional().describe("Constant symbol"),
        symSpec: z.string().optional().describe("Specific symbol"),
        partnerName: z.string().optional().describe("Partner company name"),
        street: z.string().optional().describe("Partner street"),
        city: z.string().optional().describe("Partner city"),
        zip: z.string().optional().describe("Partner ZIP code"),
        ico: z.string().optional().describe("Partner IČO"),
        note: z.string().optional().describe("Note"),
        items: z
          .array(bankItemSchema)
          .optional()
          .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high)"),
      },
    },
    async (args) => {
      try {
        const params = createBankParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const bank = item.ele(NS.bnk, "bnk:bank").att("version", "2.0");
          const header = bank.ele(NS.bnk, "bnk:bankHeader");

          header.ele(NS.bnk, "bnk:bankType").txt(params.bankType);
          if (params.account) {
            header.ele(NS.bnk, "bnk:account").ele(NS.typ, "typ:ids").txt(params.account);
          }
          if (params.bankCode) header.ele(NS.bnk, "bnk:bankCode").txt(params.bankCode);
          header.ele(NS.bnk, "bnk:date").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.bnk, "bnk:text").txt(params.text);
          if (params.symVar) header.ele(NS.bnk, "bnk:symVar").txt(params.symVar);
          if (params.symConst) header.ele(NS.bnk, "bnk:symConst").txt(params.symConst);
          if (params.symSpec) header.ele(NS.bnk, "bnk:symSpec").txt(params.symSpec);

          const hasPartner =
            params.partnerName ?? params.street ?? params.city ?? params.zip ?? params.ico;
          if (hasPartner) {
            const identity = header.ele(NS.bnk, "bnk:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.street) typAddr.ele(NS.typ, "typ:street").txt(params.street);
            if (params.city) typAddr.ele(NS.typ, "typ:city").txt(params.city);
            if (params.zip) typAddr.ele(NS.typ, "typ:zip").txt(params.zip);
            if (params.ico) typAddr.ele(NS.typ, "typ:ico").txt(params.ico);
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
