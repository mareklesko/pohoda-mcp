import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PohodaClient } from "../client.js";
import { buildExportRequest, buildImportDoc } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { parseResponse, extractListData, extractImportResult } from "../xml/parser.js";
import { ok, err, jsonResult } from "../core/types.js";
import { applyFilter, type ListFilterParams } from "../core/filters.js";
import { toIsoDate } from "../core/shared.js";

const offerTypeEnum = z.enum(["issuedOffer", "receivedOffer"]);

const listOfferParams = z.object({
  offerType: offerTypeEnum.optional(),
  id: z.number().optional(),
  dateFrom: z.string().optional(),
  dateTill: z.string().optional(),
  companyName: z.string().optional(),
  lastChanges: z.string().optional(),
});

const offerItemSchema = z.object({
  text: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  rateVAT: z.enum(["none", "low", "high"]),
  unit: z.string().optional(),
});

const createOfferParams = z.object({
  offerType: offerTypeEnum,
  date: z.string(),
  text: z.string().optional(),
  partnerName: z.string().optional(),
  Street: z.string().optional(),
  City: z.string().optional(),
  Zip: z.string().optional(),
  Ico: z.string().optional(),
  note: z.string().optional(),
  items: z.array(offerItemSchema).optional(),
});

export function registerOfferTools(server: McpServer, client: PohodaClient): void {
  server.registerTool(
    "pohoda_list_offers",
    {
      description:
        "List offers from POHODA. Supports filtering by offer type (issued/received), ID, date range, company name, or last changes. Returns JSON array of matching offer records.",
      inputSchema: {
        offerType: offerTypeEnum.optional().describe("Filter by offer type (issuedOffer or receivedOffer)"),
        id: z.number().optional().describe("Filter by offer ID"),
        dateFrom: z.string().optional().describe("Filter from date (DD.MM.YYYY or YYYY-MM-DD)"),
        dateTill: z.string().optional().describe("Filter till date (DD.MM.YYYY or YYYY-MM-DD)"),
        companyName: z.string().optional().describe("Filter by company name"),
        lastChanges: z.string().optional().describe("Filter by last changes date"),
      },
    },
    async (args) => {
      try {
        const params = listOfferParams.parse(args);
        const xml = buildExportRequest(
          { ico: client.ico },
          "lst:listOfferRequest",
          NS.lst,
          "lst:requestOffer",
          (req) => {
            if (params.offerType) req.att("offerType", params.offerType);
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
        return jsonResult("Offers", data, Array.isArray(data) ? data.length : 0);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );

  server.registerTool(
    "pohoda_create_offer",
    {
      description:
        "Create a new offer in POHODA. Requires offerType and date. Optional: text, partner details (partnerName, Street, City, Zip, Ico), note, and line items.",
      inputSchema: {
        offerType: offerTypeEnum.describe("Offer type: issuedOffer or receivedOffer (required)"),
        date: z.string().describe("Offer date (DD.MM.YYYY or YYYY-MM-DD)"),
        text: z.string().optional().describe("Offer text/description"),
        partnerName: z.string().optional().describe("Partner company name"),
        Street: z.string().optional().describe("Partner street"),
        City: z.string().optional().describe("Partner city"),
        Zip: z.string().optional().describe("Partner ZIP code"),
        Ico: z.string().optional().describe("Partner IČO"),
        note: z.string().optional().describe("Note"),
        items: z
          .array(offerItemSchema)
          .optional()
          .describe("Line items: text, quantity, unitPrice, rateVAT (none|low|high), optional unit"),
      },
    },
    async (args) => {
      try {
        const params = createOfferParams.parse(args);
        const xml = buildImportDoc({ ico: client.ico }, (item) => {
          const ofr = item.ele(NS.ofr, "ofr:offer").att("version", "2.0");
          const header = ofr.ele(NS.ofr, "ofr:offerHeader");

          header.ele(NS.ofr, "ofr:offerType").txt(params.offerType);
          header.ele(NS.ofr, "ofr:date").txt(toIsoDate(params.date));
          if (params.text) header.ele(NS.ofr, "ofr:text").txt(params.text);

          const hasPartner =
            params.partnerName ?? params.Street ?? params.City ?? params.Zip ?? params.Ico;
          if (hasPartner) {
            const identity = header.ele(NS.ofr, "ofr:partnerIdentity");
            const typAddr = identity.ele(NS.typ, "typ:address");
            if (params.partnerName) typAddr.ele(NS.typ, "typ:name").txt(params.partnerName);
            if (params.Street) typAddr.ele(NS.typ, "typ:street").txt(params.Street);
            if (params.City) typAddr.ele(NS.typ, "typ:city").txt(params.City);
            if (params.Zip) typAddr.ele(NS.typ, "typ:zip").txt(params.Zip);
            if (params.Ico) typAddr.ele(NS.typ, "typ:ico").txt(params.Ico);
          }

          if (params.note) header.ele(NS.ofr, "ofr:note").txt(params.note);

          if (params.items && params.items.length > 0) {
            const detail = ofr.ele(NS.ofr, "ofr:offerDetail");
            for (const it of params.items) {
              const ofrItem = detail.ele(NS.ofr, "ofr:offerItem");
              ofrItem.ele(NS.ofr, "ofr:text").txt(it.text);
              ofrItem.ele(NS.ofr, "ofr:quantity").txt(String(it.quantity));
              ofrItem.ele(NS.ofr, "ofr:rateVAT").txt(it.rateVAT);
              ofrItem
                .ele(NS.ofr, "ofr:homeCurrency")
                .ele(NS.typ, "typ:unitPrice")
                .txt(String(it.unitPrice));
              if (it.unit) ofrItem.ele(NS.ofr, "ofr:unit").txt(it.unit);
            }
          }
        });
        const response = await client.sendXml(xml);
        const result = extractImportResult(parseResponse(response));
        return result.success
          ? ok(
              `Offer created successfully.${result.producedId != null ? ` ID: ${result.producedId}` : ""} ${result.message}`
            )
          : err(result.message);
      } catch (e) {
        return err((e as Error).message);
      }
    }
  );
}
