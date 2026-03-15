import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter, type ListFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const enquiryTypeEnum = z.enum(["issuedEnquiry", "receivedEnquiry"]);

const listEnquiryParams = z.object({
  enquiryType: enquiryTypeEnum.optional(),
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  companyName: z.string().optional(),
  lastChanges: z.string().optional(),
});

const enquiryItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
  unit: z.string().optional(),
});

const createEnquiryParams = z.object({
  enquiryType: enquiryTypeEnum,
  date: z.string(),
  text: z.string().optional(),
  partnerName: z.string().optional(),
  Street: z.string().optional(),
  City: z.string().optional(),
  Zip: z.string().optional(),
  Ico: z.string().optional(),
  note: z.string().optional(),
  items: z.array(enquiryItemSchema).optional(),
});

export function registerEnquiryTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_enquiries",
    {
      description:
        "List enquiries from POHODA. Supports filtering by enquiry type (issued/received), ID, date range, company name, or last changes. Returns JSON array of matching enquiry records.",
      inputSchema: {
        enquiryType: enquiryTypeEnum.optional().describe("Filter by enquiry type (issuedEnquiry or receivedEnquiry)"),
        id: z.number().optional().describe("Filter by enquiry ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        companyName: z.string().optional().describe("Filter by company name"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listEnquiryParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listEnquiryRequest",
          NS.lst,
          "lst:requestEnquiry",
          (req) => {
            if (params.enquiryType) req.att("enquiryType", params.enquiryType);
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
        return jsonResult("Enquiries", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_create_enquiry",
    {
      description:
        "Create a new enquiry in POHODA. Requires enquiryType and date. Optional: text, partner details (partnerName, Street, City, Zip, Ico), note, and line items.",
      inputSchema: {
        enquiryType: enquiryTypeEnum.describe("Enquiry type: issuedEnquiry or receivedEnquiry (required)"),
        date: z.string().describe("Enquiry date (DD.MM.YYYY or YYYY-MM-DD)"),
        text: z.string().optional().describe("Enquiry text/description"),
        partnerName: z.string().optional().describe("Partner company name"),
        Street: z.string().optional().describe("Partner street"),
        City: z.string().optional().describe("Partner city"),
        Zip: z.string().optional().describe("Partner ZIP code"),
        Ico: z.string().optional().describe("Partner IČO"),
        note: z.string().optional().describe("Note"),
        items: z
          .array(enquiryItemSchema)
          .optional()
          .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high), optional unit"),
      },
    },
    async (args) => {
      try {
        const params = createEnquiryParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const enq = item.ele(NS.enq, "enq:enquiry").att("version", "2.0");
          const header = enq.ele(NS.enq, "enq:enquiryHeader");

          header.ele(NS.enq, "enq:enquiryType").txt(params.enquiryType);
          header.ele(NS.enq, "enq:date").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.enq, "enq:text").txt(params.text);

          const hasPartner =
            params.partnerName ?? params.Street ?? params.City ?? params.Zip ?? params.Ico;
          if (hasPartner) {
            const identity = header.ele(NS.enq, "enq:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.Street) typAddr.ele(NS.typ, "typ:street").txt(params.Street);
            if (params.City) typAddr.ele(NS.typ, "typ:city").txt(params.City);
            if (params.Zip) typAddr.ele(NS.typ, "typ:zip").txt(params.Zip);
            if (params.Ico) typAddr.ele(NS.typ, "typ:ico").txt(params.Ico);
          }

          if (params.note) header.ele(NS.enq, "enq:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = enq.ele(NS.enq, "enq:enquiryDetail");
            for (const it of params.items) {
              const enqItem = detail.ele(NS.enq, "enq:enquiryItem");
              enqItem.ele(NS.enq, "enq:text").txt(it.text);
              enqItem.ele(NS.enq, "enq:quantity").txt(String(it.quantity));
              enqItem.ele(NS.enq, "enq:rateVAT").txt(it.rateVAT);
              enqItem
                .ele(NS.enq, "enq:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
              if (it.unit) enqItem.ele(NS.enq, "enq:unit").txt(it.unit);
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Enquiry created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
