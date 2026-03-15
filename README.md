# pohoda-mcp

MCP server for **POHODA** (Stormware) accounting software. Full XML API coverage via mServer — **45 tools** across all major agendas with read + write operations.

First TypeScript/Node.js client for POHODA's XML API. Communicates via mServer HTTP interface using structured XML DataPack requests.

## Tools (45)

### System (3)
| Tool | Description |
|---|---|
| `pohoda_status` | Check mServer status (processing queue, idle/working) |
| `pohoda_company_info` | Get accounting unit info (company name, database, period) |
| `pohoda_download_file` | Download a file from POHODA's documents folder |

### Address Book (4)
| Tool | Description |
|---|---|
| `pohoda_list_addresses` | Export contacts with filters (name, ICO, code, date) |
| `pohoda_create_address` | Create a new contact in address book |
| `pohoda_update_address` | Update an existing contact by ID |
| `pohoda_delete_address` | Delete a contact by ID |

### Invoices (3)
| Tool | Description |
|---|---|
| `pohoda_list_invoices` | Export invoices — issued, received, advance, credit notes, receivables, commitments |
| `pohoda_create_invoice` | Create an invoice with line items, partner, symbols, VAT |
| `pohoda_delete_invoice` | Delete an invoice by ID |

### Orders (3)
| Tool | Description |
|---|---|
| `pohoda_list_orders` | Export issued/received orders with filters |
| `pohoda_create_order` | Create an order with items and partner |
| `pohoda_delete_order` | Delete an order by ID |

### Offers (2)
| Tool | Description |
|---|---|
| `pohoda_list_offers` | Export issued/received offers |
| `pohoda_create_offer` | Create an offer with items |

### Enquiries (2)
| Tool | Description |
|---|---|
| `pohoda_list_enquiries` | Export issued/received enquiries |
| `pohoda_create_enquiry` | Create an enquiry with items |

### Contracts (3)
| Tool | Description |
|---|---|
| `pohoda_list_contracts` | Export contracts with filters |
| `pohoda_create_contract` | Create a new contract |
| `pohoda_delete_contract` | Delete a contract by ID |

### Bank Documents (2)
| Tool | Description |
|---|---|
| `pohoda_list_bank` | Export bank documents (receipts/expenses) |
| `pohoda_create_bank` | Create a bank document with items |

### Cash Vouchers (2)
| Tool | Description |
|---|---|
| `pohoda_list_vouchers` | Export cash register vouchers |
| `pohoda_create_voucher` | Create a cash voucher (receipt/expense) |

### Internal Documents (2)
| Tool | Description |
|---|---|
| `pohoda_list_internal_docs` | Export internal accounting documents |
| `pohoda_create_internal_doc` | Create an internal document |

### Stock / Inventory (5)
| Tool | Description |
|---|---|
| `pohoda_list_stock` | Export stock items with filters (code, name, store) |
| `pohoda_create_stock` | Create a new stock item |
| `pohoda_update_stock` | Update a stock item by ID or code |
| `pohoda_delete_stock` | Delete a stock item |
| `pohoda_list_stores` | List all stores (warehouses) |

### Warehouse Documents (8)
| Tool | Description |
|---|---|
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
|---|---|
| `pohoda_list_vyroba` | Export production documents |
| `pohoda_create_vyroba` | Create a production document |
| `pohoda_list_service` | Export service records |
| `pohoda_create_service` | Create a service record |

### Reports (4)
| Tool | Description |
|---|---|
| `pohoda_list_accountancy` | Export accounting journal entries |
| `pohoda_list_balance` | Export saldo/balance records |
| `pohoda_list_movements` | Export stock movement records |
| `pohoda_list_vat` | Export VAT classification records |

### Settings (1)
| Tool | Description |
|---|---|
| `pohoda_list_settings` | Export settings (numerical series, bank accounts, cash registers, centres, activities, payment methods, stores, storage, categories, accounting units) |

## Setup

### Prerequisites

- Node.js 20+
- POHODA with mServer enabled (configured and running)
- mServer user credentials with XML communication rights

### Install

```bash
git clone https://github.com/hlebtkachenko/pohoda-mcp.git
cd pohoda-mcp
npm install
npm run build
```

### Environment Variables

```bash
export POHODA_URL="http://localhost:444"       # Required — mServer URL
export POHODA_USERNAME="Admin"                 # Required — POHODA user
export POHODA_PASSWORD="password"              # Required — POHODA password
export POHODA_ICO="12345678"                   # Required — Company ICO
export POHODA_TIMEOUT="120000"                 # Optional — Request timeout ms (default: 120s)
export POHODA_MAX_RETRIES="2"                  # Optional — Max retries on timeout/503
export POHODA_CHECK_DUPLICITY="true"           # Optional — Enable duplicate import checks
```

## MCP Client Configuration

```json
{
  "mcpServers": {
    "pohoda": {
      "command": "node",
      "args": ["/path/to/pohoda-mcp/dist/index.js"],
      "env": {
        "POHODA_URL": "http://localhost:444",
        "POHODA_USERNAME": "Admin",
        "POHODA_PASSWORD": "password",
        "POHODA_ICO": "12345678"
      }
    }
  }
}
```

## Docker

```bash
docker build -t pohoda-mcp .

docker run --rm -i \
  -e POHODA_URL=http://host.docker.internal:444 \
  -e POHODA_USERNAME=Admin \
  -e POHODA_PASSWORD=password \
  -e POHODA_ICO=12345678 \
  pohoda-mcp
```

## Architecture

```
MCP Client (AI Agent)
    └─> pohoda-mcp (MCP Server)
         ├─> PohodaClient (HTTP + STW-Authorization)
         │    └─> XML DataPack Builder (xmlbuilder2)
         │         └─> POST /xml → POHODA mServer
         │              └─> ResponsePack XML
         │                   └─> fast-xml-parser → JSON
         └─> 45 MCP Tools (15 modules)
```

**Communication flow:**
1. AI agent calls an MCP tool (e.g., `pohoda_list_invoices`)
2. Tool builds an XML DataPack request using `xmlbuilder2` with proper POHODA namespaces
3. Request is encoded to Windows-1250 and sent via HTTP POST to mServer
4. Response is decoded, parsed, and returned as structured JSON to the AI agent

**Key components:**
- `client.ts` — HTTP client with Basic auth, Windows-1250 encoding, gzip compression, retries
- `xml/builder.ts` — DataPack XML envelope builder (export requests, import docs, delete operations)
- `xml/parser.ts` — ResponsePack parser using fast-xml-parser with namespace handling
- `xml/namespaces.ts` — All 40+ POHODA XML namespace URIs
- `core/filters.ts` — Filter builder for export requests (date ranges, IDs, codes)

## Security

- Credentials via environment variables only
- `STW-Authorization` Basic auth per POHODA mServer specification
- `STW-Application: pohoda-mcp` header for audit trail in POHODA monitoring
- `STW-Check-Duplicity` header support to prevent duplicate imports
- XML string escaping for all user-provided values
- Path traversal prevention for file downloads (strips `..` from paths)
- Input validation via Zod on all tool parameters

## POHODA mServer Setup

1. Open POHODA → Settings → mServer
2. Create a new mServer configuration
3. Set the listening port (default: 444)
4. Start the mServer
5. Ensure the user has XML communication rights (Settings → Access Rights → File → Data Communication)

For internet access, use HTTPS or VPN. mServer is primarily designed for local network use.

## License

MIT
