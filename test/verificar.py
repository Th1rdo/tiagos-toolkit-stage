# -*- coding: utf-8 -*-
"""Integridade do módulo: caminhos, imports, templates, i18n e classes de CSS."""
import json, re, os, sys
from html.parser import HTMLParser

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
templates = {t: ler(f"templates/{t}") for t in (os.listdir("templates") if os.path.isdir("templates") else [])}

# todos os scripts compilam. A lógica pura só importa alguns ficheiros; um erro
# de sintaxe num dos outros (o palco.js, por exemplo) passava o npm test e só
# rebentava quando o Foundry carregava o módulo. Já aconteceu.
import subprocess
for arq in sorted(scripts):
    r = subprocess.run(["node", "--check", f"scripts/{arq}"], capture_output=True, text=True)
    if r.returncode != 0:
        linha = next((l for l in r.stderr.splitlines() if "Error" in l), r.stderr.strip()[:160])
        falhas.append(f"{arq} não compila: {linha}")

# imports relativos existem
for arq, src in scripts.items():
    for imp in re.findall(r'from "\./([^"]+)"', src):
        if imp not in scripts:
            falhas.append(f"{arq} importa {imp}, inexistente")

# ---------------------------------------------------------------- templates
# O ApplicationV2 exige que cada parte renderize UM só elemento na raiz. Um
# template com dois elementos soltos não dá erro nenhum até ao momento em que a
# janela devia abrir — e depois não abre, em silêncio. Já aconteceu no Cinema.
VAZIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

class Raizes(HTMLParser):
    def __init__(self):
        super().__init__(); self.profundidade = 0; self.raizes = 0
    def handle_starttag(self, tag, attrs):
        if self.profundidade == 0: self.raizes += 1
        if tag not in VAZIOS: self.profundidade += 1
    def handle_startendtag(self, tag, attrs):
        if self.profundidade == 0: self.raizes += 1
    def handle_endtag(self, tag):
        if tag not in VAZIOS: self.profundidade = max(0, self.profundidade - 1)
    def handle_data(self, texto):
        if self.profundidade == 0 and texto.strip(): self.raizes += 1

def raizes_de(src):
    limpo = re.sub(r"\{\{![\s\S]*?\}\}", "", src)      # comentários handlebars
    limpo = re.sub(r"\{\{[^}]*\}\}", "", limpo)        # expressões e blocos
    p = Raizes(); p.feed(limpo); return p.raizes

partes = set()
for src in scripts.values():
    partes |= {t.split("/")[-1] for t in re.findall(r"template: `modules/[^`]*?(templates/[^`]+)`", src)}
for t in sorted(partes):
    if t.split("/")[-1] not in templates:
        falhas.append(f"PARTS aponta para {t}, inexistente")
        continue
    n = raizes_de(templates[t.split("/")[-1]])
    if n != 1:
        falhas.append(f"{t} renderiza {n} elementos na raiz; o ApplicationV2 exige 1")

# toda a ação declarada no template tem handler, e vice-versa
acoes_tpl = {a for src in templates.values() for a in re.findall(r'data-action="(\w+)"', src)}
acoes_js = set()
for src in scripts.values():
    if "actions: {" not in src: continue
    bloco = src[src.index("actions: {"):src.index("}", src.index("actions: {"))]
    acoes_js |= set(re.findall(r"^\s*(\w+):", bloco, re.M)) - {"actions"}
falhas += [f'botão data-action="{a}" sem handler' for a in sorted(acoes_tpl - acoes_js)]
falhas += [f'ação "{a}" registada e sem botão' for a in sorted(acoes_js - acoes_tpl)]

# ---------------------------------------------------------------- i18n
pt = json.load(open("lang/pt-BR.json", encoding="utf-8"))
en = json.load(open("lang/en.json", encoding="utf-8"))
usadas = set()
for src in list(scripts.values()) + list(templates.values()) + [ler("module.json")]:
    usadas |= set(re.findall(r"[\"'](STAGE\.[A-Za-z][\w.]*[A-Za-z])[\"']", src))
for k in sorted(usadas):
    if k not in pt: falhas.append(f"chave {k} ausente em pt-BR")
    if k not in en: falhas.append(f"chave {k} ausente em en")
if set(pt) != set(en):
    falhas.append("pt-BR e en têm conjuntos de chaves diferentes")
sobrando = sorted(set(pt) - usadas)

# ---------------------------------------------------------------- CSS
# Uma classe que não existe na folha de estilo não dá erro: apenas não pinta,
# e isso só se descobre com a mesa à espera.
classes = set()
for src in list(scripts.values()) + list(templates.values()):
    for grupo in re.findall(r'class="([^"]*)"', src):
        classes |= {c for c in re.split(r"[\s{}]+", grupo) if c.startswith("stage-")}
    classes |= {c for c in re.findall(r'classList\.(?:add|toggle|remove)\("([\w-]+)"', src) if c.startswith("stage-")}
declaradas = set(re.findall(r"\.(stage-[\w-]+)", css)) | set(re.findall(r"#(stage-[\w-]+)", css))
for c in sorted(classes - declaradas):
    falhas.append(f'classe "{c}" usada e sem regra no CSS')

ids = set(re.findall(r'\.id = "(stage-[\w-]+)"', "\n".join(scripts.values())))
ids |= {i for i in re.findall(r'id: "(stage-[\w-]+)"', "\n".join(scripts.values()))}
for i in sorted(ids - declaradas):
    falhas.append(f"#{i} criado no JS e sem regra no CSS")

print("\n".join(f"  ✖ {f}" for f in falhas) if falhas else "  ✓ integridade ok")
if sobrando:
    print("  · chaves declaradas e não usadas:", ", ".join(sobrando))
sys.exit(1 if falhas else 0)
