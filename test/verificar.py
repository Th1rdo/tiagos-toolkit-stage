# -*- coding: utf-8 -*-
"""Integridade do módulo: caminhos, imports, chaves de i18n e classes de CSS."""
import json, re, os, sys

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
falhas = []
ler = lambda p: open(p, encoding="utf-8").read()

mod = json.load(open("module.json", encoding="utf-8"))
for campo in ("esmodules", "styles"):
    for c in mod.get(campo, []):
        if not os.path.exists(c):
            falhas.append(f"module.json aponta para {c}, inexistente")
for l in mod.get("languages", []):
    if not os.path.exists(l["path"]):
        falhas.append(f"idioma ausente: {l['path']}")

scripts = {a: ler(f"scripts/{a}") for a in os.listdir("scripts") if a.endswith(".js")}
css = ler(mod["styles"][0])

# imports relativos existem
for arq, src in scripts.items():
    for imp in re.findall(r'from "\./([^"]+)"', src):
        if imp not in scripts:
            falhas.append(f"{arq} importa {imp}, inexistente")

# i18n: toda a chave POI.* usada tem de existir nos dois idiomas
pt = json.load(open("lang/pt-BR.json", encoding="utf-8"))
en = json.load(open("lang/en.json", encoding="utf-8"))
usadas = set()
for src in list(scripts.values()) + [ler("module.json")]:
    usadas |= set(re.findall(r'"(STAGE\.[A-Za-z][\w.]*[A-Za-z])"', src))
for k in sorted(usadas):
    if k not in pt: falhas.append(f"chave {k} ausente em pt-BR")
    if k not in en: falhas.append(f"chave {k} ausente em en")
if set(pt) != set(en):
    falhas.append("pt-BR e en têm conjuntos de chaves diferentes")
sobrando = sorted(set(pt) - usadas)

# CSS: toda a classe stage-* usada no JS tem de existir na folha de estilo.
# (Uma classe escrita à mão que não existe no CSS não dá erro nenhum — apenas
#  não pinta, e isso só se descobre com a mesa à espera.)
usadas_css = set()
for src in scripts.values():
    usadas_css |= set(re.findall(r'class(?:Name)?="([^"]*)"', src) and [] or [])
    usadas_css |= {c for grupo in re.findall(r'classList\.(?:add|toggle|remove)\("([\w-]+)"', src) for c in [grupo]}
    usadas_css |= set(re.findall(r'class="([\w\s-]+)"', src))
classes = set()
for grupo in usadas_css:
    classes |= {c for c in grupo.split() if c.startswith("stage-")}
declaradas = set(re.findall(r'\.(stage-[\w-]+)', css)) | set(re.findall(r'#(stage-[\w-]+)', css))
for c in sorted(classes - declaradas):
    falhas.append(f'classe "{c}" usada no JS e sem regra no CSS')

# ids criados no JS existem no CSS
ids = set(re.findall(r'\.id = "(stage-[\w-]+)"', "\n".join(scripts.values())))
for i in sorted(ids - declaradas):
    falhas.append(f'#{i} criado no JS e sem regra no CSS')

print("\n".join(f"  ✖ {f}" for f in falhas) if falhas else "  ✓ integridade ok")
if sobrando:
    print("  · chaves declaradas e não usadas:", ", ".join(sobrando))
sys.exit(1 if falhas else 0)
