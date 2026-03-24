import { gunzipSync, inflateSync, inflateRawSync } from "node:zlib";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const iconv = require("iconv-lite") as {
  encode: (str: string, encoding: string) => Buffer;
  decode: (buf: Buffer, encoding: string) => string;
};

export interface PohodaClientConfig {
  url: string;
  username: string;
  password: string;
  ico: string;
  timeout?: number;
  maxRetries?: number;
  checkDuplicity?: boolean;
}

export class PohodaClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  readonly ico: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly checkDuplicity: boolean;

  constructor(config: PohodaClientConfig) {
    this.baseUrl = config.url.replace(/\/+$/, "");
    this.ico = config.ico;
    this.timeout = config.timeout ?? 120_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.checkDuplicity = config.checkDuplicity ?? false;

    const creds = `${config.username}:${config.password}`;
    this.authHeader = `Basic ${Buffer.from(creds, "utf-8").toString("base64")}`;
  }

  async sendXml(xml: string): Promise<string> {
    const body = new Uint8Array(iconv.encode(xml, "win1250"));

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const resp = await fetch(`${this.baseUrl}/xml`, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml",
            "STW-Authorization": this.authHeader,
            "Accept-Encoding": "gzip",
            "STW-Application": "pohoda-mcp",
            "STW-Instance": `mcp-${Date.now()}`,
            ...(this.checkDuplicity ? { "STW-Check-Duplicity": "true" } : {}),
          },
          body,
          signal: AbortSignal.timeout(this.timeout),
        });

        if (resp.status === 401) throw new Error("Authentication failed (401). Check POHODA_USERNAME/POHODA_PASSWORD.");
        if (resp.status === 403) throw new Error("Access forbidden (403). User lacks permissions in POHODA.");
        if (resp.status === 404) throw new Error("Endpoint not found (404). Check POHODA_URL — should point to mServer /xml.");
        if (resp.status === 408) {
          if (attempt < this.maxRetries) { await sleep(2000 * (attempt + 1)); continue; }
          throw new Error("Request timeout (408). POHODA took too long to process.");
        }
        if (resp.status === 503) {
          if (attempt < this.maxRetries) { await sleep(3000 * (attempt + 1)); continue; }
          throw new Error("Service unavailable (503). POHODA mServer may be busy.");
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

        const rawBuf = Buffer.from(await resp.arrayBuffer());
        const contentEncoding = resp.headers.get("content-encoding") ?? "";
        // Node.js fetch (undici) auto-decompresses responses but may retain the
        // Content-Encoding header, so we detect compression via magic bytes instead
        // of trusting the header to avoid double-decompression ("incorrect header check").
        let dataBuf: Buffer;
        if (isGzip(rawBuf)) {
          dataBuf = gunzipSync(rawBuf);
        } else if (isDeflate(rawBuf)) {
          dataBuf = safeInflate(rawBuf);
        } else if (/\bdeflate\b/i.test(contentEncoding) && !looksLikeTextOrXml(rawBuf)) {
          // Fallback for raw RFC1951 deflate streams without a fixed magic signature.
          dataBuf = safeInflate(rawBuf);
        } else {
          dataBuf = rawBuf;
        }

        const contentType = resp.headers.get("content-type") ?? "";
        if (contentType.includes("Windows-1250") || contentType.includes("windows-1250")) {
          return iconv.decode(dataBuf, "win1250");
        }
        return dataBuf.toString("utf-8");
      } catch (err) {
        lastError = err as Error;
        if ((err as Error).name === "TimeoutError" && attempt < this.maxRetries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if ((err as Error).name === "TimeoutError") {
          throw new Error(`POHODA mServer did not respond within ${this.timeout / 1000}s.`);
        }
        throw err;
      }
    }
    throw lastError ?? new Error("Request failed after retries.");
  }

  async getStatus(): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/status`, {
      method: "GET",
      headers: { "STW-Authorization": this.authHeader },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`Status check failed: HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    return iconv.decode(buf, "win1250");
  }

  async getCompanyInfo(): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/status?companyDetail`, {
      method: "GET",
      headers: { "STW-Authorization": this.authHeader },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`Company info failed: HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    return iconv.decode(buf, "win1250");
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const normalized = path.posix.normalize(filePath).replace(/^\/+/, "");
    if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
      throw new Error("Path traversal attempt blocked.");
    }
    const safePath = normalized;
    const resp = await fetch(`${this.baseUrl}/documents/${encodeURI(safePath)}`, {
      method: "GET",
      headers: { "STW-Authorization": this.authHeader },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) throw new Error(`File download failed: HTTP ${resp.status} for ${safePath}`);
    return Buffer.from(await resp.arrayBuffer());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeInflate(buf: Buffer): Buffer {
  try { return inflateSync(buf); } catch { return inflateRawSync(buf); }
}

function isGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function isDeflate(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  const cmf = buf[0];
  const flg = buf[1];
  // zlib header (RFC 1950): CM must be 8 (deflate) and (CMF << 8 | FLG) must be divisible by 31
  if ((cmf & 0x0f) !== 8) return false;
  return (((cmf << 8) | flg) % 31) === 0;
}

function looksLikeTextOrXml(buf: Buffer): boolean {
  const sample = buf.subarray(0, 512).toString("utf-8");
  const trimmed = sample.trimStart();
  if (!trimmed) return false;
  if (/^<\?xml/i.test(trimmed)) return true;
  if (trimmed[0] === "<" || trimmed[0] === "{" || trimmed[0] === "[") return true;
  let printable = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (
      code === 9 || code === 10 || code === 13 ||
      (code >= 32 && code <= 126) ||
      code > 127
    ) {
      printable++;
    }
  }
  return printable > 0 && printable / trimmed.length > 0.9;
}
