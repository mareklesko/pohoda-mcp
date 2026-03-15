import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  isArray: (_name: string, jpath: unknown) => {
    const arrayPaths = [
      "responsePack.responsePackItem",
      "listAddressBook.addressbook",
      "listInvoice.invoice",
      "listOrder.order",
      "listOffer.offer",
      "listEnquiry.enquiry",
      "listContract.contract",
      "listBank.bankItem",
      "listCash.voucher",
      "listIntDoc.intDoc",
      "listStock.stock",
      "listPrijemka.prijemka",
      "listVydejka.vydejka",
      "listProdejka.prodejka",
      "listPrevodka.prevodka",
      "listVyroba.vyroba",
      "listService.service",
      "listAccountancy.accountancy",
      "listBalance.balance",
      "listMovement.movement",
      "listClassificationVAT.classificationVAT",
      "listNumericalSeries.numericalSeries",
      "listCashRegister.cashRegister",
      "listBankAccount.bankAccount",
      "listCentre.centre",
      "listActivity.activity",
      "listPayment.payment",
      "listStore.store",
      "listStorage.storage",
      "listCategory.category",
    ];
    const jp = String(jpath);
    for (const p of arrayPaths) {
      if (jp.endsWith(p)) return true;
    }
    if (jp.includes("Detail") && jp.includes("Item")) return true;
    return false;
  },
  parseTagValue: true,
  trimValues: true,
});

export interface PohodaResponseItem {
  state: string;
  note?: string;
  id?: string | number;
  data?: unknown;
}

export interface PohodaResponse {
  state: string;
  version: string;
  items: PohodaResponseItem[];
  raw: unknown;
}

export function parseResponse(xml: string): PohodaResponse {
  const doc = parser.parse(xml);
  const pack = doc?.responsePack ?? doc?.["rsp:responsePack"] ?? doc;

  const state = pack?.["@_state"] ?? "unknown";
  const version = pack?.["@_version"] ?? "2.0";

  const rawItems = pack?.responsePackItem ?? pack?.["rsp:responsePackItem"] ?? [];
  const itemArr = Array.isArray(rawItems) ? rawItems : [rawItems];

  const items: PohodaResponseItem[] = itemArr.map((it: Record<string, unknown>) => {
    const itemState = (it["@_state"] as string) ?? "unknown";
    const itemNote = (it["@_note"] as string) ?? undefined;
    const itemId = it["@_id"] as string | undefined;

    const keys = Object.keys(it).filter((k) => !k.startsWith("@_"));
    const data = keys.length === 1 ? it[keys[0]] : keys.length > 0 ? it : undefined;

    return { state: itemState, note: itemNote, id: itemId, data };
  });

  return { state, version, items, raw: doc };
}

export function extractListData(response: PohodaResponse): unknown[] {
  const results: unknown[] = [];
  for (const item of response.items) {
    if (!item.data) continue;
    const d = item.data as Record<string, unknown>;
    for (const val of Object.values(d)) {
      if (Array.isArray(val)) {
        results.push(...val);
      } else if (val && typeof val === "object") {
        const inner = val as Record<string, unknown>;
        for (const v2 of Object.values(inner)) {
          if (Array.isArray(v2)) {
            results.push(...v2);
          }
        }
        if (results.length === 0) results.push(val);
      }
    }
  }
  return results;
}

export function extractImportResult(response: PohodaResponse): {
  success: boolean;
  message: string;
  producedId?: number;
} {
  if (response.items.length === 0) {
    return { success: false, message: "No response items" };
  }
  const item = response.items[0];
  const ok = item.state === "ok";
  const parts: string[] = [item.note ?? item.state];

  if (item.data && typeof item.data === "object") {
    const d = item.data as Record<string, unknown>;
    const detail = d.importDetails ?? d.producedDetails;
    if (detail && typeof detail === "object") {
      const det = detail as Record<string, unknown>;
      const id = det.id ?? det.number;
      if (id != null) return { success: ok, message: parts.join("; "), producedId: Number(id) };
    }
  }

  return { success: ok, message: parts.join("; ") };
}
