# Notion → CSV (Vercel API) — fetch() verzió

Ez a változat **nem** használ `vercel.json`-t. A Vercel automatikusan felismeri az `/api` mappát, 
és a Node.js runtime-ot használja. A handler a **Web Standard `fetch`** API-t exportálja, 
ami stabilabb a modern Vercel környezetekben.

## Telepítés

1. Töltsd fel a repo-t GitHubra.
2. Vercel → New Project → importáld a repo-t.
3. Állítsd be az env változókat (Project → Settings → Environment Variables):
   - `NOTION_TOKEN`
   - `NOTION_DATABASE_ID`
   - `CSV_REQUIRE_KEY = 1`
   - `CSV_KEY = <hosszú_random>`
   - *(opcionális)* `STATUS_PROP_NAME = Videó státusz`
   - *(opcionális)* `STATUS_VALUE = ✅ Kész`
   - *(opcionális)* `EXPAND_RELATIONS = 1`
4. (Ajánlott) `package.json` már tartalmazza: `"engines": {"node": "20.x"}`.
5. Deploy.

## Használat

`https://<app>.vercel.app/api/notion-csv?key=<CSV_KEY>` → `text/csv` kimenet:

```
Kurzus,Sorszám,Szakasz,Lecke címe,Videó státusz,Lecke hossza
...
```

## Megjegyzés

- A `✅ Kész` szűrés a Notionban `status/select/checkbox` típusokra működik.
- `EXPAND_RELATIONS=1` esetén a `Kurzus` relation ID-ket címre próbálja feloldani (lassabb lehet).