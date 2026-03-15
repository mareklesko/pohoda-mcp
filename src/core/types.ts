export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function err(text: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

export function jsonResult(label: string, data: unknown, count?: number): ToolResult {
  const header = count != null ? `${label} (${count} records)` : label;
  return ok(`${header}\n\n${JSON.stringify(data, null, 2)}`);
}
