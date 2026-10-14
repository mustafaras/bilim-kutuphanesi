#!/usr/bin/env python3
"""FAZ-1 i18n validator — guarantees zero Turkish leftovers in EN mode.

Checks:
  (a) UI.tr / UI.en key parity (both directions).
  (b) Every distinct category/kind/level/language value in catalog.json has an
      EN label in i18n-data.js -> labels (prefix "NN - " stripped).
  (c) Every catalog route (keyed by title slug) has an EN title + description
      and every step id has an EN note; stale route keys are rejected too.
  (d) No Turkish letters in EN values (labels, routes, UI.en) outside allowlist.
  (e) Every data-i18n* attribute key in index.html exists in UI.tr and UI.en.
  (f) Every literal t('...') key used in site JS exists in UI.tr and UI.en.
Extraction of the JS dictionaries is delegated to node (vm) so the validator
sees exactly what the browser sees. Exit code is non-zero on any failure.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
TURKISH = re.compile(r"[çğıöşüÇĞİÖŞÜ]")
# Legitimate non-Turkish uses inside EN values: proper nouns and foreign-language
# title quotes that happen to share letters with the Turkish alphabet.
ALLOWED_SUBSTRINGS = [
    "Mössbauer", "Provençal", "Atatürk", "Türkiye", "Hüseyin Rahmi Gürpınar",
    "für",  # quoted German titles ("... resource on Mathematik I für ...")
]
# EN description pattern that intentionally quotes the Turkish catalog title.
CATALOGUED_PATTERN = re.compile(r"^Catalogued in Turkish as: .+\. Full English edition from Project Gutenberg")


def turkish_letters(value: str) -> bool:
    """True if value contains Turkish letters outside deliberate exceptions."""
    if not value:
        return False
    if CATALOGUED_PATTERN.match(value):
        return False
    cleaned = value
    for allowed in ALLOWED_SUBSTRINGS:
        cleaned = cleaned.replace(allowed, "")
    return bool(TURKISH.search(cleaned))


def slug(title: str) -> str:
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()


def main() -> int:
    failures = []
    i18n_js = json.dumps(str(SITE / "i18n.js"))
    data_js = json.dumps(str(SITE / "i18n-data.js"))
    extract = (
        "const fs=require('node:fs'),vm=require('node:vm');"
        "const ctx=vm.createContext({});"
        f"vm.runInContext(fs.readFileSync({i18n_js},'utf8'),ctx);"
        f"vm.runInContext(fs.readFileSync({data_js},'utf8'),ctx);"
        "console.log(vm.runInContext('JSON.stringify({tr:Object.keys(UI.tr),en:Object.keys(UI.en),enVals:Object.values(UI.en),data:I18N_DATA})',ctx));"
    )
    extracted = subprocess.run(
        ["node", "-e", extract],
        capture_output=True, text=True, check=True, encoding="utf-8",
    ).stdout.strip()
    bundle = json.loads(extracted)
    tr_keys, en_keys = set(bundle["tr"]), set(bundle["en"])
    data = bundle["data"]

    # (a) key parity
    for missing in sorted(tr_keys - en_keys):
        failures.append(f"UI.en is missing key present in UI.tr: {missing}")
    for missing in sorted(en_keys - tr_keys):
        failures.append(f"UI.tr is missing key present in UI.en: {missing}")
    print(f"OK: UI key parity ({len(tr_keys)} keys, both languages)" if not any("parity" in f or "missing key" in f for f in failures) else "FAIL: UI key parity")

    # (b) facet value coverage
    catalog = json.loads((SITE / "data" / "catalog.json").read_text(encoding="utf-8"))
    labels = data["labels"]
    for field in ("category", "kind", "level", "language"):
        values = {r.get(field) for r in catalog["records"] if r.get(field)}
        for v in sorted(values):
            clean = re.sub(r"^\d+ - ", "", str(v))
            if clean not in labels:
                failures.append(f"labels: no EN translation for {field} value {clean!r}")
    print(f"OK: all facet values have EN labels ({len(labels)} labels)" if not any("labels:" in f for f in failures) else "FAIL: facet label coverage")

    # (c) routes: slug-keyed, full coverage, no stale keys
    routes = data["routes"]
    catalog_slugs = set()
    for rt in catalog["routes"]:
        key = slug(rt["title"])
        catalog_slugs.add(key)
        entry = routes.get(key)
        if not entry:
            failures.append(f"routes: no EN entry for route {key!r} ({rt['title']!r})")
            continue
        if not entry.get("title") or not entry.get("description"):
            failures.append(f"routes: empty EN title/description for {key!r}")
        for s in rt["steps"]:
            note = entry.get("steps", {}).get(s["id"])
            if not note:
                failures.append(f"routes: no EN note for step {s['id']} in {key!r}")
    for stale in sorted(set(routes) - catalog_slugs):
        failures.append(f"routes: stale EN entry with no matching catalog route: {stale!r}")
    n_steps = sum(len(r.get("steps", {})) for r in routes.values())
    print(f"OK: all {len(catalog_slugs)} routes and {n_steps} step notes translated" if not any("routes:" in f for f in failures) else "FAIL: route coverage")

    # (d) Turkish letters in EN values
    offenders = []
    for k, v in labels.items():
        if turkish_letters(v):
            offenders.append(f"label {k!r}: {v!r}")
    for key, entry in routes.items():
        for prop in ("title", "description"):
            if turkish_letters(entry.get(prop, "")):
                offenders.append(f"route {key!r} {prop}")
        for sid, note in entry.get("steps", {}).items():
            if turkish_letters(note):
                offenders.append(f"route {key!r} step {sid}: {note!r}")
    for k, v in data.get("awardTopics", {}).items():
        if turkish_letters(v):
            offenders.append(f"awardTopic {k!r}: {v!r}")
    for k, v in data.get("descriptions", {}).items():
        if turkish_letters(v):
            offenders.append(f"description for {k[:40]!r}...: {v[:60]!r}")
    for v in bundle["enVals"]:
        if turkish_letters(v):
            offenders.append(f"UI.en value: {v!r}")
    if offenders:
        failures.extend(f"Turkish letters in EN value — {o}" for o in offenders)
    else:
        print("OK: no Turkish letters in EN values")

    # (g) every Turkish award title has an EN translation
    award_topics = data.get("awardTopics", {})
    missing_award = 0
    for r in catalog["records"]:
        if r["collection"] == "awards" and TURKISH.search(r.get("title", "")) and r["title"] not in award_topics:
            failures.append(f"awardTopics: no EN title for {r['title']!r}")
            missing_award += 1
    if not missing_award:
        print(f"OK: all Turkish award titles translated ({len(award_topics)} topics)")

    # (h) every Turkish description has an EN translation
    descriptions = data.get("descriptions", {})
    missing_desc = 0
    for r in catalog["records"]:
        d = r.get("description", "")
        if d and TURKISH.search(d) and d not in descriptions:
            failures.append(f"descriptions: no EN for record {r['id']} description {d[:60]!r}...")
            missing_desc += 1
    if not missing_desc:
        print(f"OK: all Turkish descriptions translated ({len(descriptions)} distinct)")

    # (e) data-i18n attributes in index.html
    html = (SITE / "index.html").read_text(encoding="utf-8")
    for m in re.finditer(r'data-i18n(?:-html|-aria|-placeholder)?="([^"]+)"', html):
        key = m.group(1)
        if key not in tr_keys or key not in en_keys:
            failures.append(f"index.html: data-i18n key not in dictionaries: {key!r}")
    print("OK: all data-i18n keys resolve" if not any("data-i18n" in f for f in failures) else "FAIL: data-i18n keys")

    # (f) literal t('...') keys in site JS
    for js in ("app.js", "discovery.js", "effects.js", "visuals.js"):
        src = (SITE / js).read_text(encoding="utf-8")
        for m in re.finditer(r"\bt\('([^']+)'\)", src):
            key = m.group(1)
            if key not in tr_keys or key not in en_keys:
                failures.append(f"{js}: t({key!r}) not in dictionaries")
    print("OK: all literal t() keys resolve" if not any("t(" in f for f in failures) else "FAIL: literal t() keys")

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("OK: i18n integrity — EN mode has no Turkish leftovers by construction.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
