import { type XMLBuilder } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { toIsoDate } from "./shared.js";

export interface ListFilterParams {
  id?: number;
  dateFrom?: string;
  dateTill?: string;
  lastChanges?: string;
  companyName?: string;
  ico?: string;
}

export function applyFilter(parent: XMLBuilder, params: ListFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");

  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.dateFrom) ftr.ele(NS.ftr, "ftr:dateFrom").txt(toIsoDate(params.dateFrom));
  if (params.dateTill) ftr.ele(NS.ftr, "ftr:dateTill").txt(toIsoDate(params.dateTill));
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
  if (params.companyName) ftr.ele(NS.ftr, "ftr:selectedCompanys").ele(NS.ftr, "ftr:company").txt(params.companyName);
  if (params.ico) ftr.ele(NS.ftr, "ftr:selectedIco").ele(NS.ftr, "ftr:ico").txt(params.ico);
}

export interface AddressFilterParams {
  id?: number;
  companyName?: string;
  ico?: string;
  lastChanges?: string;
  code?: string;
}

export function applyAddressFilter(parent: XMLBuilder, params: AddressFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");

  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.companyName) ftr.ele(NS.ftr, "ftr:company").txt(params.companyName);
  if (params.ico) ftr.ele(NS.ftr, "ftr:ico").txt(params.ico);
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
  if (params.code) ftr.ele(NS.ftr, "ftr:number").txt(params.code);
}

export interface InvoiceFilterParams extends ListFilterParams {
}

export function applyInvoiceFilter(parent: XMLBuilder, params: InvoiceFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");

  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.dateFrom) ftr.ele(NS.ftr, "ftr:dateFrom").txt(toIsoDate(params.dateFrom));
  if (params.dateTill) ftr.ele(NS.ftr, "ftr:dateTill").txt(toIsoDate(params.dateTill));
  if (params.companyName) ftr.ele(NS.ftr, "ftr:selectedCompanys").ele(NS.ftr, "ftr:company").txt(params.companyName);
  if (params.ico) ftr.ele(NS.ftr, "ftr:selectedIco").ele(NS.ftr, "ftr:ico").txt(params.ico);
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
}
