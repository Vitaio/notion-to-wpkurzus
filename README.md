# Notion → CSV (Vercel API) a WP All Importhoz

Ez egy kicsi Vercel-projekt, ami a Notion adatbázisból **csak a „✅ Kész”** státuszú leckéket adja vissza **CSV** formátumban.

## Gyors indítás

1. **Notion**
   - Property-k: `Kurzus` | `Sorszám` | `Szakasz` | `Lecke címe` | `Videó státusz` | `Lecke hossza`
   - `Videó státusz` értékei közt legyen **✅ Kész**.
   - Hozz létre Notion integrációt, másold ki a `NOTION_TOKEN`-t és **Share**-öld a DB-t az integrációnak.
   - Szerezd meg a `NOTION_DATABASE_ID`-t (a DB URL-jéből).

2. **Deploy Vercelre**
   - Importáld ezt a repo-t a Vercelbe.
   - Project → **Settings → Environment Variables**:
     - `NOTION_TOKEN`
     - `NOTION_DATABASE_ID`
     - `STATUS_PROP_NAME` = `Videó státusz`
     - `STATUS_VALUE` = `✅ Kész`
     - `CSV_REQUIRE_KEY` = `1`
     - `CSV_KEY` = hosszú random string
     - *(opcionális)* `EXPAND_RELATIONS` = `1` (ha a `Kurzus` relation és címre akarod feloldani)

3. **Használat**
   - Endpoint: `https://<app>.vercel.app/api/notion-csv?key=<CSV_KEY>`
   - A válasz `text/csv` lesz ezekkel az oszlopokkal:
     - `Kurzus,Sorszám,Szakasz,Lecke címe,Videó státusz,Lecke hossza`

4. **WP All Import**
   - New Import → **Download from URL** → fenti URL (a `?key=` paraméterrel).
   - Mapping: címezés a fejlécnevek szerint.
   - Unique key: pl. `Kurzus|Szakasz|Sorszám`.
   - Scheduling: WP All Import cron URL szerver cronba.

## Biztonság

- A Notion token a szerveren marad (Vercel env var), nem kerül a klienshez.
- Az endpoint csak `?key=` paraméterrel érhető el (állíts be erős `CSV_KEY`-et; időnként rotáld).

## License

MIT