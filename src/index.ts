#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PohodaClient } from "./client.js";
import { requiredEnv } from "./core/shared.js";
import { registerSystemTools } from "./tools/system.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerOfferTools } from "./tools/offers.js";
import { registerEnquiryTools } from "./tools/enquiries.js";
import { registerContractTools } from "./tools/contracts.js";
import { registerBankTools } from "./tools/bank.js";
import { registerVoucherTools } from "./tools/vouchers.js";
import { registerInternalDocTools } from "./tools/internal_docs.js";
import { registerStockTools } from "./tools/stock.js";
import { registerWarehouseTools } from "./tools/warehouse.js";
import { registerProductionTools } from "./tools/production.js";
import { registerReportTools } from "./tools/reports.js";
import { registerSettingsTools } from "./tools/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8")) as { version: string };

const client = new PohodaClient({
  url: requiredEnv("POHODA_URL"),
  username: requiredEnv("POHODA_USERNAME"),
  password: requiredEnv("POHODA_PASSWORD"),
  ico: requiredEnv("POHODA_ICO"),
  timeout: Number(process.env.POHODA_TIMEOUT ?? "120000"),
  maxRetries: Number(process.env.POHODA_MAX_RETRIES ?? "2"),
  checkDuplicity: process.env.POHODA_CHECK_DUPLICITY === "true",
});

const server = new McpServer({
  name: "pohoda-mcp",
  version: pkg.version,
});

registerSystemTools(server, client);
registerAddressTools(server, client);
registerInvoiceTools(server, client);
registerOrderTools(server, client);
registerOfferTools(server, client);
registerEnquiryTools(server, client);
registerContractTools(server, client);
registerBankTools(server, client);
registerVoucherTools(server, client);
registerInternalDocTools(server, client);
registerStockTools(server, client);
registerWarehouseTools(server, client);
registerProductionTools(server, client);
registerReportTools(server, client);
registerSettingsTools(server, client);

const transport = new StdioServerTransport();
server.connect(transport).catch((e) => {
  console.error("MCP server failed to start:", e);
  process.exit(1);
});
