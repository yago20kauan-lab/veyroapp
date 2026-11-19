"""Gera src/db/taco.json a partir do TACO.json (marcelosanto/tabela_taco, MIT).
Fonte dos dados: TACO 4ª ed., NEPA/UNICAMP, 2011 — reprodução permitida citando a fonte.
Uso: python3 -I scripts/build_taco.py CAMINHO/TACO.json src/db/taco.json
"""
import json, re, sys, unicodedata

src, out = sys.argv[1], sys.argv[2]
rows = json.load(open(src, encoding="utf-8"))

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0

SECTION = {
    "Cereais e derivados": "mercearia", "Verduras, hortaliças e derivados": "hortifruti", "Frutas e derivados": "hortifruti",
    "Gorduras e óleos": "mercearia", "Pescados e frutos do mar": "acougue", "Carnes e derivados": "acougue",
    "Leite e derivados": "laticinios", "Bebidas (alcoólicas e não alcoólicas)": "mercearia", "Ovos e derivados": "laticinios",
    "Produtos açucarados": "mercearia", "Miscelâneas": "mercearia", "Outros alimentos industrializados": "mercearia",
    "Alimentos preparados": "congelados", "Leguminosas e derivados": "mercearia", "Nozes e sementes": "mercearia",
}
COOKED = re.compile(r"\b(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|frit[oa]s?|refogad[oa]s?|ensopad[oa]|braseado|cozimento)\b", re.I)
RAW = re.compile(r"\b(cru|crua|crus|cruas)\b", re.I)

def group(cat, name, kcal, p, c, f):
    n = name.lower()
    if cat.startswith("Frutas"): return "fruit"
    if cat.startswith("Verduras"):
        return "carb" if kcal > 50 and c * 4 / kcal > 0.6 else "veg"
    if cat.startswith(("Carnes", "Pescados", "Ovos")): return "protein"
    if cat.startswith("Leite"): return "dairy"
    if cat.startswith(("Gorduras", "Nozes")): return "fat"
    if n.startswith(("pão", "pao", "biscoito", "torrada", "tapioca", "aveia")): return "bread"
    if cat.startswith(("Cereais", "Leguminosas")): return "carb"
    if kcal > 0:
        if p * 4 / kcal > 0.5: return "protein"
        if c * 4 / kcal > 0.6: return "carb"
        if f * 9 / kcal > 0.6: return "fat"
    return None

def key(name):
    base = COOKED.sub("", RAW.sub("", name))
    base = unicodedata.normalize("NFD", base).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]+", " ", base).strip()

foods = []
raw_by_key = {}
for r in rows:
    name = r["description"].strip()
    kcal, p, c, f, fib = (num(r.get(k)) for k in ("energy_kcal", "protein_g", "carbohydrate_g", "lipid_g", "fiber_g"))
    state = "cooked" if COOKED.search(name) else "raw" if RAW.search(name) else "na"
    item = {
        "id": f"taco-{r['id']}", "name": name, "category": r.get("category", ""),
        "per100g": {"kcal": round(kcal), "p": round(p, 1), "c": round(c, 1), "f": round(f, 1), "fiber": round(fib, 1)},
        "state": state, "section": SECTION.get(r.get("category", ""), "mercearia"),
    }
    g = group(item["category"], name, kcal, p, c, f)
    if g: item["swapGroup"] = g
    foods.append(item)
    if state == "raw":
        raw_by_key[key(name)] = item

# rendimento cozido/cru pela densidade de energia (peso cozido por grama cru)
paired = 0
for it in foods:
    if it["state"] != "cooked" or not it["per100g"]["kcal"]:
        continue
    raw = raw_by_key.get(key(it["name"]))
    if it["category"].startswith(("Verduras", "Frutas")):
        continue  # tubérculos e hortaliças: peso quase não muda ao cozinhar
    if raw and raw["per100g"]["kcal"]:
        y = raw["per100g"]["kcal"] / it["per100g"]["kcal"]
        if 0.5 <= y <= 4:
            it["yieldFactor"] = round(y, 2)
            it["rawId"] = raw["id"]
            paired += 1

# padrão quando não há par cru/cozido na tabela
for it in foods:
    if it["state"] == "cooked" and "yieldFactor" not in it:
        if it["category"].startswith(("Cereais", "Leguminosas")): it["yieldFactor"] = 2.5
        elif it["category"].startswith(("Carnes", "Pescados")): it["yieldFactor"] = 0.75

json.dump(foods, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(foods), "alimentos;", paired, "com rendimento cru/cozido")
