# POHODA MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

MCP server for [POHODA](https://www.stormware.cz/pohoda/) (Stormware) accounting software. Manage invoices, stock, orders, bank documents, warehouse, and accounting from any MCP-compatible client.

48 tools covering all major POHODA agendas via mServer XML API.

## Requirements

- Node.js 20+
- POHODA with mServer enabled and running
- mServer user credentials with XML communication rights

## Installation

```bash
git clone https://github.com/hlebtkachenko/pohoda-mcp.git
cd pohoda-mcp
npm ci
npm run build
```

## Configuration

### Cursor

`~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "pohoda": {
      "command": "node",
      "args": ["/path/to/pohoda-mcp/dist/index.js"],
      "env": {
        "POHODA_URL": "http://localhost:444",
        "POHODA_USERNAME": "<your-username>",
        "POHODA_PASSWORD": "<your-password>",
        "POHODA_ICO": "<your-company-ico>"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json` ([location](https://modelcontextprotocol.io/quickstart/user#1-open-your-mcp-client))

```json
{
  "mcpServers": {
    "pohoda": {
      "command": "node",
      "args": ["/path/to/pohoda-mcp/dist/index.js"],
      "env": {
        "POHODA_URL": "http://localhost:444",
        "POHODA_USERNAME": "<your-username>",
        "POHODA_PASSWORD": "<your-password>",
        "POHODA_ICO": "<your-company-ico>"
      }
    }
  }
}
```

### Claude Code

`.mcp.json` in your project root, or `~/.claude.json` globally:

```json
{
  "mcpServers": {
    "pohoda": {
      "command": "node",
      "args": ["/path/to/pohoda-mcp/dist/index.js"],
      "env": {
        "POHODA_URL": "http://localhost:444",
        "POHODA_USERNAME": "<your-username>",
        "POHODA_PASSWORD": "<your-password>",
        "POHODA_ICO": "<your-company-ico>"
      }
    }
  }
}
```

### Any MCP client (stdio)

The server uses `stdio` transport. Point your MCP client to:

```
node /path/to/pohoda-mcp/dist/index.js
```

With environment variables set for authentication (see below).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POHODA_URL` | Yes | mServer URL (default port: 444) |
| `POHODA_USERNAME` | Yes | POHODA user with XML rights |
| `POHODA_PASSWORD` | Yes | POHODA password |
| `POHODA_ICO` | Yes | Company IČO (accounting unit) |
| `POHODA_TIMEOUT` | No | Request timeout in ms (default: 120000) |
| `POHODA_MAX_RETRIES` | No | Max retries on timeout/503 (default: 2) |
| `POHODA_CHECK_DUPLICITY` | No | Enable duplicate import checks (default: false) |

## Tools

### System (3)

| Tool | Description |
|------|-------------|
| `pohoda_status` | Check mServer status (processing queue, idle/working) |
| `pohoda_company_info` | Get accounting unit info (company name, database, period) |
| `pohoda_download_file` | Download a file from POHODA's documents folder |

### Address Book (4)

| Tool | Description |
|------|-------------|
| `pohoda_list_addresses` | Export contacts with filters (name, IČO, code, date) |
| `pohoda_create_address` | Create a new contact in address book |
| `pohoda_update_address` | Update an existing contact by ID |
| `pohoda_delete_address` | Delete a contact by ID |

### Invoices (3)

| Tool | Description |
|------|-------------|
| `pohoda_list_invoices` | Export invoices — issued, received, advance, credit notes, receivables, commitments |
| `pohoda_create_invoice` | Create an invoice with line items, partner, symbols, VAT |
| `pohoda_delete_invoice` | Delete an invoice by ID |

### Orders (3)

| Tool | Description |
|------|-------------|
| `pohoda_list_orders` | Export issued/received orders with filters |
| `pohoda_create_order` | Create an order with items and partner |
| `pohoda_delete_order` | Delete an order by ID |

### Offers (2)

| Tool | Description |
|------|-------------|
| `pohoda_list_offers` | Export issued/received offers |
| `pohoda_create_offer` | Create an offer with items |

### Enquiries (2)

| Tool | Description |
|------|-------------|
| `pohoda_list_enquiries` | Export issued/received enquiries |
| `pohoda_create_enquiry` | Create an enquiry with items |

### Contracts (3)

| Tool | Description |
|------|-------------|
| `pohoda_list_contracts` | Export contracts with filters |
| `pohoda_create_contract` | Create a new contract |
| `pohoda_delete_contract` | Delete a contract by ID |

### Bank Documents (2)

| Tool | Description |
|------|-------------|
| `pohoda_list_bank` | Export bank documents (receipts/expenses) |
| `pohoda_create_bank` | Create a bank document with items |

### Cash Vouchers (2)

| Tool | Description |
|------|-------------|
| `pohoda_list_vouchers` | Export cash register vouchers |
| `pohoda_create_voucher` | Create a cash voucher (receipt/expense) |

### Internal Documents (2)

| Tool | Description |
|------|-------------|
| `pohoda_list_internal_docs` | Export internal accounting documents |
| `pohoda_create_internal_doc` | Create an internal document |

### Stock / Inventory (5)

| Tool | Description |
|------|-------------|
| `pohoda_list_stock` | Export stock items with filters (code, name, store) |
| `pohoda_create_stock` | Create a new stock item |
| `pohoda_update_stock` | Update a stock item by ID or code |
| `pohoda_delete_stock` | Delete a stock item |
| `pohoda_list_stores` | List all stores (warehouses) |

### Warehouse Documents (8)

| Tool | Description |
|------|-------------|
| `pohoda_list_prijemky` | Export receiving documents (příjemky) |
| `pohoda_create_prijemka` | Create a receiving document |
| `pohoda_list_vydejky` | Export dispatch documents (výdejky) |
| `pohoda_create_vydejka` | Create a dispatch document |
| `pohoda_list_prodejky` | Export sales documents (prodejky) |
| `pohoda_create_prodejka` | Create a sales document |
| `pohoda_list_prevodky` | Export transfer documents (převodky) |
| `pohoda_create_prevodka` | Create a transfer document |

### Production & Service (4)

| Tool | Description |
|------|-------------|
| `pohoda_list_vyroba` | Export production documents |
| `pohoda_create_vyroba` | Create a production document |
| `pohoda_list_service` | Export service records |
| `pohoda_create_service` | Create a service record |

### Reports (4)

| Tool | Description |
|------|-------------|
| `pohoda_list_accountancy` | Export accounting journal entries |
| `pohoda_list_balance` | Export saldo/balance records |
| `pohoda_list_movements` | Export stock movement records |
| `pohoda_list_vat` | Export VAT classification records |

### Settings (1)

| Tool | Description |
|------|-------------|
| `pohoda_list_settings` | Export settings (numerical series, bank accounts, cash registers, centres, activities, payment methods, stores, storage, categories, accounting units) |

## Docker

```bash
docker build -t pohoda-mcp .
docker run --rm -i \
  -e POHODA_URL=http://host.docker.internal:444 \
  -e POHODA_USERNAME=<your-username> \
  -e POHODA_PASSWORD=<your-password> \
  -e POHODA_ICO=<your-company-ico> \
  pohoda-mcp
```

Multi-stage build, runs as non-root `node` user.

## Security

- Credentials via environment variables only
- `STW-Authorization` Basic auth per POHODA mServer specification
- `STW-Application: pohoda-mcp` header for audit trail in POHODA monitoring
- `STW-Check-Duplicity` header support to prevent duplicate imports
- XML escaping handled by xmlbuilder2 for all user-provided values
- Path traversal prevention for file downloads (normalize + reject `..` prefixed paths)
- Input validation via Zod on all tool parameters

## Architecture

```
src/
  index.ts              Entry point, env validation, tool registration
  client.ts             HTTP client (STW-Auth, Windows-1250, gzip/deflate, retries)
  xml/
    builder.ts          DataPack XML envelope builder (xmlbuilder2)
    parser.ts           ResponsePack parser (fast-xml-parser)
    namespaces.ts       40+ POHODA XML namespace URIs
  core/
    types.ts            ToolResult interface, ok/err helpers
    shared.ts           Date conversion, env helpers
    filters.ts          Filter builder for export requests
  tools/
    system.ts           Status, company info, file download (3 tools)
    addresses.ts        Address book CRUD (4 tools)
    invoices.ts         All invoice types (3 tools)
    orders.ts           Issued/received orders (3 tools)
    offers.ts           Offers (2 tools)
    enquiries.ts        Enquiries (2 tools)
    contracts.ts        Contracts (3 tools)
    bank.ts             Bank documents (2 tools)
    vouchers.ts         Cash vouchers (2 tools)
    internal_docs.ts    Internal documents (2 tools)
    stock.ts            Stock/inventory CRUD (5 tools)
    warehouse.ts        Příjemky, výdejky, prodejky, převodky (8 tools)
    production.ts       Production and service records (4 tools)
    reports.ts          Accountancy, balance, movements, VAT (4 tools)
    settings.ts         Numerical series, bank accounts, centres... (1 tool)
```

## POHODA mServer Setup

1. Open POHODA → Settings → mServer
2. Create a new mServer configuration
3. Set the listening port (default: 444)
4. Start the mServer
5. Ensure the user has XML communication rights (Settings → Access Rights → File → Data Communication)

For internet access, use HTTPS or VPN. mServer is primarily designed for local network use.

## Tech Stack

- TypeScript
- `@modelcontextprotocol/sdk`
- Zod (schema validation)
- xmlbuilder2 (XML generation)
- fast-xml-parser (XML parsing)
- iconv-lite (Windows-1250 encoding)
- Native `fetch`

## API Reference

- [POHODA XML Documentation](https://www.stormware.cz/xml)
- [POHODA Developer Guide](https://www.stormware.cz/pohoda/xml/obecny-obchod/pro-vyvojare/)

## License

[MIT](LICENSE)
