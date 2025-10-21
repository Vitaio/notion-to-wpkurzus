# Notion → CSV (Vercel API) — Classic Node handler

- NINCS `vercel.json`
- `api/notion-csv.js` klasszikus `(req,res)` handlert exportál
- `package.json` kikényszeríti a Node 20-at (`"engines": {"node": "20.x"}`)
- Van egy `api/ok.js` egészségügyi endpoint: `/api/ok`

## Vercel beállítás
- Project Settings → Build & Development → **Node.js Version: 20.x**
- Environment Variables:
  - `NOTION_TOKEN`
  - `NOTION_DATABASE_ID`
  - `CSV_REQUIRE_KEY=1`
  - `CSV_KEY=<hosszú random>`
  - *(opcionális)* `STATUS_PROP_NAME=Videó státusz`
  - *(opcionális)* `STATUS_VALUE=✅ Kész`
  - *(opcionális)* `EXPAND_RELATIONS=1`

## Teszt
- `https://<app>.vercel.app/api/ok` → `ok`
- `https://<app>.vercel.app/api/notion-csv?key=<CSV_KEY>` → CSV