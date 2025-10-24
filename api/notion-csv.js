
import { Client } from "@notionhq/client";



function setCsvHeaders(res) {

async function notionCall(fn, args = [], { retries = 3, baseDelayMs = 300 } = {}) {

function normalizeDuration(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();

  // If contains h/m/s tokens, parse them
  const tokenRe = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i;
  const tokenMatch = s.match(tokenRe);
  if (tokenMatch && (tokenMatch[1] || tokenMatch[2] || tokenMatch[3])) {
    const h = parseInt(tokenMatch[1] || '0', 10);
    const m = parseInt(tokenMatch[2] || '0', 10);
    const sec = parseInt(tokenMatch[3] || '0', 10);
    const total = h * 3600 + m * 60 + sec;
    return toHMS(total);
  }

  // Allow HH:MM:SS or MM:SS
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':').map(x => parseInt(x, 10));
    let total = 0;
    if (parts.length === 2) {
      total = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      total = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return toHMS(total);
  }

  // Fallback: extract digits only (was previous behavior); treat as seconds
  const digits = (s.match(/\d+/g) || []).join('');
  if (digits) {
    const total = parseInt(digits, 10);
    return toHMS(total);
  }
  return '';
}

function toHMS(totalSeconds) {
  totalSeconds = Math.max(0, parseInt(totalSeconds || 0, 10));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  const HH = String(h).padStart(2, '0');
  const MM = String(m).padStart(2, '0');
  const SS = String(sec).padStart(2, '0');
  return `${HH}:${MM}:${SS}`;
}
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(...args);
    } catch (err) {
      const status = err?.status || err?.statusCode || err?.code;
      if (attempt < retries && (status === 429 || (status >= 500 && status < 600))) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}
  // Only set if missing; allows platform-level headers (e.g., vercel.json) to take precedence.
  const maybeSet = (name, value) => { try { if (!res.getHeader || !res.getHeader(name)) } };
  maybeSet('Content-Type', 'text/csv; charset=utf-8');
  maybeSet('Content-Disposition', 'attachment; filename="lessons.csv"');
  // We still ensure strong no-cache behavior here.
  }

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const CFG = {
  DB_ID: process.env.NOTION_DATABASE_ID,
  STATUS_PROP_NAME: process.env.STATUS_PROP_NAME || "Videó státusz",
  STATUS_VALUE: process.env.STATUS_VALUE || "✅ Kész",
  REQUIRE_KEY: process.env.CSV_REQUIRE_KEY === "1",
  KEY: process.env.CSV_KEY || "",
  EXPAND_RELATIONS: process.env.EXPAND_RELATIONS === "1",
  CSV_ADD_BOM: process.env.CSV_ADD_BOM !== "0",
  CSV_EOL: (process.env.CSV_EOL || "CRLF").toUpperCase()
};

function toCSV(rows, headers) {
  const esc = (v) => {
    const s = (v ?? "").toString();
    const needsQuotes = /[",\n\r]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const eol = CFG.CSV_EOL === "LF" ? "\n" : "\r\n";
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))
  ];
  const csv = lines.join(eol);
  return (CFG.CSV_ADD_BOM ? "\uFEFF" : "") + csv;
}

const read = {
  text(prop) {
    if (!prop) return "";
    if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
    if (prop.type === "title") return (prop.title || []).map(t => t.plain_text).join("");
    if (prop.type === "select") return prop.select?.name || "";
    if (prop.type === "multi_select") return (prop.multi_select || []).map(o => o.name).join(", ");
    if (prop.type === "status") return prop.status?.name || "";
    if (prop.type === "url") return prop.url || "";
    if (prop.type === "email") return prop.email || "";
    if (prop.type === "phone_number") return prop.phone_number || "";
    if (prop.type === "number") return prop.number ?? "";
    if (prop.type === "date") return prop.date?.start || "";
    if (prop.type === "checkbox") return prop.checkbox ? "true" : "false";
    if (prop.type === "people") return (prop.people || []).map(p => p.name || p.id).join(", ");
    if (prop.type === "files") return (prop.files || []).map(f => f.name).join(", ");
    if (prop.type === "relation") return (prop.relation || []).map(r => r.id).join(", ");
    return "";
  },
  number(prop) {
    if (!prop) return "";
    if (prop.type === "number") return prop.number ?? "";
    const t = read.text(prop);
    const n = Number((t || "").toString().replace(",", "."));
    return Number.isFinite(n) ? n : t;
  }
};

function getTitleFromProps(props) {
  for (const [_, p] of Object.entries(props || {})) {
    if (p?.type === "title") {
      return (p.title || []).map(t => t.plain_text).join("");
    }
  }
  return "";
}

function parseDurationToSeconds(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/[^\d:]/g, "");
  if (!s) return 0;
  const parts = s.split(":").map(v => (v === "" ? 0 : parseInt(v, 10)));
  if (parts.length === 1) return Number.isFinite(parts[0]) ? Math.max(0, parts[0]) : 0;
  if (parts.length === 2) {
    const [m, sec] = parts;
    return (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(sec) ? sec : 0);
  }
  const [h, m, sec] = parts.slice(-3);
  const H = Number.isFinite(h) ? h : 0;
  const M = Number.isFinite(m) ? m : 0;
  const S = Number.isFinite(sec) ? sec : 0;
  return H * 3600 + M * 60 + S;
}

function secondsToHHMMSS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildStatusFilter(db, statusPropName, statusValue) {
  const p = db.properties?.[statusPropName];
  if (!p) return null;
  if (p.type === "status") return { property: statusPropName, status: { equals: statusValue } };
  if (p.type === "select") return { property: statusPropName, select: { equals: statusValue } };
  if (p.type === "checkbox") return { property: statusPropName, checkbox: { equals: true } };
  return null;
}

function buildSorts(db) {
  const sorts = [];
  if (db.properties?.["Sorszám"]?.type === "number") {
    sorts.push({ property: "Sorszám", direction: "ascending" });
  }
  if (db.properties?.["Szakasz"]?.type === "select") {
    sorts.push({ property: "Szakasz", direction: "ascending" });
  }
  sorts.push({ timestamp: "created_time", "direction": "ascending" });
  return sorts;
}

export default async function handler(req, res) {
  const relationTitleCache = new Map();
  try {
    // HEAD handling (WP All Import sometimes issues HEAD first)
    if (req.method === "HEAD") {
      setCsvHeaders(res);
setCsvHeaders(res);
res.status(200).end();
      return;
    }

    if (CFG.REQUIRE_KEY) {
      if (!req.query?.key || req.query.key !== CFG.KEY) {
        res.status(401).send("Unauthorized");
        return;
      }
    }

    if (!CFG.DB_ID) throw new Error("NOTION_DATABASE_ID nincs beállítva.");
    if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN nincs beállítva.");

    const db = await notion.databases.retrieve({ database_id: CFG.DB_ID });

    const filter = buildStatusFilter(db, CFG.STATUS_PROP_NAME, CFG.STATUS_VALUE);
    if (!filter) {
      throw new Error(`A(z) "${CFG.STATUS_PROP_NAME}" property nem status/select/checkbox a DB-ben.`);
    }
    const sorts = buildSorts(db);

    let cursor = undefined;
    let has_more = true;
    const rows = [];

    while (has_more) {
      const resp = await notionCall(notion.databases.query.bind(notion), [{
        database_id: CFG.DB_ID,
        filter,
        sorts,
        page_size: 100,
        start_cursor: cursor
      }]);

      for (const page of resp.results) {
        const props = page.properties;
        const seconds = parseDurationToSeconds(read.text(props["Lecke hossza"]));
        const hhmmss = secondsToHHMMSS(seconds);

        const row = {
          "Kurzus": read.text(props["Kurzus"]),
          "Sorszám": read.number(props["Sorszám"]),
          "Szakasz": read.text(props["Szakasz"]),
          "Lecke címe": read.text(props["Lecke címe"]) || getTitleFromProps(props),
          "Videó státusz": read.text(props[CFG.STATUS_PROP_NAME]),
          "Lecke hossza": hhmmss
        };

        if (CFG.EXPAND_RELATIONS && db.properties?.["Kurzus"]?.type === "relation") {
          const rel = page.properties["Kurzus"]?.relation || [];
          const titles = [];
          for (const r of rel) {
            try {
              const p = relationTitleCache.has(r.id) ? relationTitleCache.get(r.id) : await (async () => { const _p = await notionCall(notion.pages.retrieve.bind(notion), [{ page_id: r.id }]); relationTitleCache.set(r.id, _p); return _p; })();
              const title = getTitleFromProps(p.properties);
              titles.push(title || r.id);
            } catch {
              titles.push(r.id);
            }
          }
          row["Kurzus"] = titles.join(", ");
        }

        rows.push(row);
      }

      has_more = resp.has_more;
      cursor = resp.next_cursor || undefined;
    }

    const headers = ["Kurzus","Sorszám","Szakasz","Lecke címe","Videó státusz","Lecke hossza"];
    const csv = toCSV(rows, headers);

    const body = Buffer.from(csv, "utf8");
    setCsvHeaders(res);
res.status(200).send(body);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
}
