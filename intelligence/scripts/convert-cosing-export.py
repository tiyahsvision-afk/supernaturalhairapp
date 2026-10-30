#!/usr/bin/env python3
"""Converts the European Commission CosIng "Ingredients/Fragrance Inventory" CSV export into a supplement for the
seed (seed/data/cosing/cosing-export-2016-supplement.json.gz), keeping only records that the Open Beauty Facts
taxonomy snapshot (cosing-ingredients.json.gz) does not already contain with a CosIng reference.

Source: https://github.com/openfoodfacts/openbeautyfacts/blob/master/cosing/COSING_Ingredients-Fragrance.Inventory_v2.csv
(official CosIng export, "Last update: 15/02/2016"). Attribution required (see seed/data/sources.json).
Usage: python3 -I scripts/convert-cosing-export.py <export.csv> <cosing-ingredients.json.gz> <inci_functions.txt> <out.json.gz>
"""
import csv, gzip, io, json, re, sys

def load_function_codes(path):
    codes = set()
    for line in open(path, encoding='utf-8'):
        m = re.match(r'^en:\s*(.+)$', line.strip())
        if m: codes.add(m.group(1).split(',')[0].strip().lower().replace(' ', '-'))
    return codes

def ids(v):
    return [x.strip() for x in re.split(r'[,/;]\s*', v or '') if re.match(r'^\d', x.strip())]

def clean(v):
    return re.sub(r'\s+', ' ', (v or '').strip())

def main(src, obf, functions_file, out):
    valid = load_function_codes(functions_file)
    have = json.loads(gzip.open(obf, 'rt', encoding='utf-8').read())['rows']
    have_refs = {r['r'] for r in have if r.get('r')}
    # Names of snapshot rows that already carry a reference. Snapshot rows WITHOUT a reference (e.g. COCOS NUCIFERA OIL)
    # are deliberately not excluded: the export supplies their official reference, and the importer links by exact name.
    have_names = {clean(r['i']).upper() for r in have if r.get('r')}

    text = open(src, encoding='utf-8', errors='replace').read()
    start = text.index('COSING Ref No')
    reader = csv.reader(io.StringIO(text[start:]))
    header = next(reader)
    assert header[:2] == ['COSING Ref No', 'INCI name'], header
    rows, seen = [], set()
    for r in reader:
        if len(r) < 10 or not r[0].strip().isdigit(): continue
        ref, inci = r[0].strip(), clean(r[1])
        key = inci.upper()
        if not inci or ref in have_refs or key in have_names or key in seen: continue
        seen.add(key)
        # Official function names ("HAIR CONDITIONING") become OBF-style codes ("hair-conditioning"); unknown ones are dropped.
        fns = [c for c in (clean(f).lower().replace(' ', '-') for f in r[8].split(',')) if c in valid]
        row = {'i': inci, 'r': ref}
        if ids(r[4]): row['c'] = ids(r[4])
        if ids(r[5]): row['e'] = ids(r[5])
        if fns: row['f'] = fns
        if clean(r[6]): row['d'] = clean(r[6])[:600]
        if clean(r[7]): row['x'] = clean(r[7])
        if clean(r[9]): row['u'] = clean(r[9])
        rows.append(row)
    meta = {'source': 'European Commission CosIng Ingredients/Fragrance Inventory export (last update 15/02/2016), via the Open Beauty Facts repository', 'url': 'https://github.com/openfoodfacts/openbeautyfacts/blob/master/cosing/COSING_Ingredients-Fragrance.Inventory_v2.csv', 'count': len(rows), 'note': 'Only records absent from cosing-ingredients.json.gz (by reference or INCI name).'}
    with gzip.open(out, 'wt', encoding='utf-8') as fh:
        json.dump({'_meta': meta, 'rows': rows}, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(rows)} supplementary ingredients written to {out}')

if __name__ == '__main__':
    main(*sys.argv[1:5])
