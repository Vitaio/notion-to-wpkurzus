import { Client } from "@notionhq/client";

// WP All Import–friendly CSV endpoint: minimal headers, no Content-Disposition.
// Uses same env vars as /api/notion-csv and same output columns.

export default async function handler(req, res) {
  if (req.method === 'HEAD') {
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Connection', 'close');
    res.end();
    return;
  }

  const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    res.status(500).end('Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    return;
  }

  // Optional key enforcement like original endpoint
  if (process.env.CSV_REQUIRE_KEY === '1') {
    const want = (process.env.CSV_KEY || '').trim();
    const got = (req.query?.key || '').trim();
    if (!want || got !== want) {
      res.status(401).end('Unauthorized');
      return;
    }
  }

  const notion = new Client({ auth: NOTION_TOKEN });

  // Helpers (simplified from original endpoint)
  const read = {
    text(v) {
      if (!v) return '';
      if (Array.isArray(v?.title)) return v.title.map(t => t.plain_text).join('');
      if (Array.isArray(v?.rich_text)) return v.rich_text.map(t => t.plain_text).join('');
      if (typeof v?.name === 'string') return v.name;
      if (typeof v === 'string') return v;
      return '';
    },
    number(v) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
      return '';
    }
  };

  function toHMS(totalSeconds) {
    totalSeconds = Math.max(0, parseInt(totalSeconds || 0, 10));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function normalizeDuration(raw) {
    if (raw == null) return '';
    let s = String(raw).trim();
    const tokenRe = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i;
    const tokenMatch = s.match(tokenRe);
    if (tokenMatch && (tokenMatch[1] || tokenMatch[2] || tokenMatch[3])) {
      const h = parseInt(tokenMatch[1] || '0', 10);
      const m = parseInt(tokenMatch[2] || '0', 10);
      const sec = parseInt(tokenMatch[3] || '0', 10);
      return toHMS(h * 3600 + m * 60 + sec);
    }
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(':').map(x => parseInt(x, 10));
      let total = 0;
      if (parts.length === 2) total = parts[0] * 60 + parts[1];
      else if (parts.length === 3) total = parts[0] * 3600 + parts[1] * 60 + parts[2];
      return toHMS(total);
    }
    const digits = (s.match(/\d+/g) || []).join('');
    if (digits) return toHMS(parseInt(digits, 10));
    return '';
  }

  // Read DB schema to detect filters/sorts like original
  const db = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
  const props = db.properties || {};

  const statusName = process.env.STATUS_PROP_NAME || 'Videó státusz';
  const statusValue = process.env.STATUS_VALUE || '✅ Kész';
  let filter = undefined;
  const p = props[statusName];
  if (p && p.type === 'status') {
    filter = { property: statusName, status: { equals: statusValue } };
  } else if (p && p.type === 'select') {
    filter = { property: statusName, select: { equals: statusValue } };
  } else if (p && p.type === 'checkbox') {
    filter = { property: statusName, checkbox: { equals: true } };
  }

  const sorts = [];
  if (props['Sorszám']?.type === 'number') {
    sorts.push({ property: 'Sorszám', direction: 'ascending' });
  }
  if (props['Szakasz']?.type === 'select') {
    sorts.push({ property: 'Szakasz', direction: 'ascending' });
  }
  sorts.push({ timestamp: 'created_time', direction: 'ascending' });

  const rows = [];
  const headers = ["Kurzus","Sorszám","Szakasz","Lecke címe","Videó státusz","Lecke hossza"];
  rows.push(headers);

  let cursor = undefined;
  do {
    const resp = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      page_size: 100,
      start_cursor: cursor,
      ...(filter ? { filter } : {}),
      ...(sorts.length ? { sorts } : {}),
    });
    for (const r of resp.results) {
      const data = r.properties || {};
      const course = data['Kurzus'];
      const num = read.number(data['Sorszám']?.number ?? read.number(read.text(data['Sorszám'])));
      const section = read.text(data['Szakasz']?.select);
      const title = read.text(data['Lecke címe']) || read.text(Object.values(data).find(v => v?.type === 'title'));
      const status = read.text(data[statusName]?.status ?? data[statusName]?.select ?? data[statusName]);
      const lengthRaw = read.text(data['Lecke hossza']) || read.number(data['Lecke hossza']);
      const length = normalizeDuration(lengthRaw);

      // Expand relation titles only if asked (EXPAND_RELATIONS=1) and relation exists
      let courseTitle = '';
      if (process.env.EXPAND_RELATIONS === '1' && course?.type === 'relation' && Array.isArray(course.relation)) {
        const titles = [];
        for (const rel of course.relation) {
          try {
            const p = await notion.pages.retrieve({ page_id: rel.id });
            const pt = (p?.properties && Object.values(p.properties).find(v => v?.type === 'title')) || null;
            const t = pt ? read.text(pt) : '';
            titles.push(t || rel.id);
          } catch {
            titles.push(rel.id);
          }
        }
        courseTitle = titles.join(', ');
      } else {
        courseTitle = read.text(course);
      }

      rows.push([courseTitle, num, section, title, status, length]);
    }
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  // CSV build minimal
  const EOL = (process.env.CSV_EOL === 'LF') ? '\n' : '\r\n';
  const needsQuote = v => /[",\n\r]/.test(v);
  const esc = v => ('"'+v.replace(/"/g,'""')+'"');
  let csv = '';
  for (const row of rows) {
    const line = row.map(v => {
      let s = (v === null || v === undefined) ? '' : String(v);
      return needsQuote(s) ? esc(s) : s;
    }).join(',') + EOL;
    csv += line;
  }
  if (process.env.CSV_ADD_BOM !== '0') {
    csv = '\ufeff' + csv;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
  res.setHeader('Connection', 'close');
  res.end(csv);
}
