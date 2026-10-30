#!/usr/bin/env python3
"""Converts the Open Beauty Facts CosIng-derived taxonomy (ingredients-cosing-obf.txt) into the compact, gzipped
JSON used by the seed (seed/data/cosing/cosing-ingredients.json.gz).

Source: https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/beauty/ingredients-cosing-obf.txt
Underlying data: European Commission CosIng database. Attribution required (see seed/data/sources.json).
Usage: python3 scripts/convert-cosing-obf.py <ingredients-cosing-obf.txt> <out.json.gz> <inci_functions.txt>
"""
import gzip, json, re, sys

def split_names(v):
    # Synonyms are separated by ", " (comma + space). Commas inside INCI names (1,2-HEXANEDIOL) have no space, or are escaped "\,".
    parts = re.split(r'(?<!\\),\s+', v)
    return [p.replace('\\,', ',').strip() for p in parts if p.strip()]

def load_function_codes(path):
    # Official CosIng function names from the OBF inci_functions taxonomy, as OBF codes ("Hair conditioning" -> "hair-conditioning").
    codes = set()
    for line in open(path, encoding='utf-8'):
        m = re.match(r'^en:\s*(.+)$', line.strip())
        if m: codes.add(m.group(1).split(',')[0].strip().lower().replace(' ', '-'))
    return codes

def main(src, out, functions_file):
    valid = load_function_codes(functions_file)
    entries, cur = [], {}
    for line in open(src, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            if cur.get('names'): entries.append(cur)
            cur = {}
            continue
        if line.startswith('#') or line.startswith('synonyms:') or line.startswith('stopwords:') or line.startswith('<'):
            continue
        m = re.match(r'^([a-z_]+):([a-z]{2}):\s*(.*)$', line)
        if m:
            key, lang, val = m.groups()
            if lang != 'en': continue
            cur[key] = val.strip()
            continue
        m = re.match(r'^en:\s*(.*)$', line)
        if m: cur['names'] = split_names(m.group(1))
    if cur.get('names'): entries.append(cur)

    rows, seen = [], set()
    for e in entries:
        ref = e.get('cosing')
        # Records without a CosIng reference number are kept only if they carry CosIng data (CAS, functions or the
        # official description); OBF's own category groupings at the end of the file carry none and are skipped.
        if not ref and not (e.get('cas') or e.get('inci_functions') or e.get('inci_description')): continue
        inci = e['names'][0]
        key = re.sub(r'\s+', ' ', inci.upper()).strip()
        if key in seen: continue
        seen.add(key)
        # Keep only official CosIng function codes; other comma-separated fragments are pieces of chemical names.
        fns = [c for c in (f.strip().removeprefix('en:') for f in e.get('inci_functions', '').split(',')) if c in valid]
        ids = lambda k: [x.strip() for x in re.split(r'[,/;]\s*', e.get(k, '')) if re.match(r'^\d', x.strip())]
        row = {'i': inci}
        if ref: row['r'] = ref
        if len(e['names']) > 1: row['a'] = e['names'][1:]
        if ids('cas'): row['c'] = ids('cas')
        if ids('einecs'): row['e'] = ids('einecs')
        if fns: row['f'] = fns
        if e.get('inci_description'): row['d'] = e['inci_description'][:600]
        if e.get('inci_restriction'): row['x'] = e['inci_restriction']
        if e.get('wikidata'): row['w'] = e['wikidata'].removeprefix('en:')
        if e.get('inci_update_date'): row['u'] = e['inci_update_date']
        rows.append(row)
    meta = {'source': 'European Commission CosIng database, via Open Beauty Facts taxonomy ingredients-cosing-obf.txt', 'url': 'https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/beauty/ingredients-cosing-obf.txt', 'count': len(rows)}
    with gzip.open(out, 'wt', encoding='utf-8') as fh:
        json.dump({'_meta': meta, 'rows': rows}, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} ingredients written to {out}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
