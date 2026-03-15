import { type XMLBuilder } from "../xml/builder.js";
import { NS } from "../xml/namespaces.js";
import { toIsoDate } from "./shared.js";

export interface ListFilterParams {
  id?: number;
  code?: string;
  dateFrom?: string;
  dateTill?: string;
  lastChanges?: string;
  companyName?: string;
  ico?: string;
  selectedNumbers?: string;
  selectedCompanys?: string;
}

export function applyFilter(parent: XMLBuilder, params: ListFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");

  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.code) ftr.ele(NS.ftr, "ftr:code").txt(params.code);
  if (params.dateFrom) ftr.ele(NS.ftr, "ftr:dateFrom").txt(toIsoDate(params.dateFrom));
  if (params.dateTill) ftr.ele(NS.ftr, "ftr:dateTill").txt(toIsoDate(params.dateTill));
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
  if (params.companyName) ftr.ele(NS.ftr, "ftr:selectedCompany").txt(params.companyName);
  if (params.ico) ftr.ele(NS.ftr, "ftr:selectedIco").txt(params.ico);
  if (params.selectedNumbers) ftr.ele(NS.ftr, "ftr:selectedNumbers")
    .ele(NS.ftr, "ftr:number").txt(params.selectedNumbers);
  if (params.selectedCompanys) ftr.ele(NS.ftr, "ftr:selectedCompanys")
    .ele(NS.ftr, "ftr:company").txt(params.selectedCompanys);
}

export interface InvoiceFilterParams extends ListFilterParams {
  invoiceType?: string;
  numberOrder?: string;
  variableSymbol?: string;
}

export function applyInvoiceFilter(parent: XMLBuilder, params: InvoiceFilterParams): void {
  const hasAny = Object.values(params).some((v) => v != null && v !== "");
  if (!hasAny) return;

  const ftr = parent.ele(NS.ftr, "ftr:filter");

  if (params.id != null) ftr.ele(NS.ftr, "ftr:id").txt(String(params.id));
  if (params.dateFrom) ftr.ele(NS.ftr, "ftr:dateFrom").txt(toIsoDate(params.dateFrom));
  if (params.dateTill) ftr.ele(NS.ftr, "ftr:dateTill").txt(toIsoDate(params.dateTill));
  if (params.invoiceType) ftr.ele(NS.ftr, "ftr:selectedInvoiceType").txt(params.invoiceType);
  if (params.numberOrder) ftr.ele(NS.ftr, "ftr:selectedNumberOrder").txt(params.numberOrder);
  if (params.variableSymbol) ftr.ele(NS.ftr, "ftr:variableSymbol").txt(params.variableSymbol);
  if (params.companyName) ftr.ele(NS.ftr, "ftr:selectedCompany").txt(params.companyName);
  if (params.ico) ftr.ele(NS.ftr, "ftr:selectedIco").txt(params.ico);
  if (params.lastChanges) ftr.ele(NS.ftr, "ftr:lastChanges").txt(toIsoDate(params.lastChanges));
}
