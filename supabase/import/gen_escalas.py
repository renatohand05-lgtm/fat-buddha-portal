import csv, io, json, re, unicodedata, difflib, sys
L = open('/home/claude/fb/escalas/escalas.txt', encoding='utf-8').read().split('\n')
row = lambda i: next(csv.reader([L[i-1]]))  # linha 1-based
DIAS = ['seg','ter','qua','qui','sex','sab','dom1','dom2','dom3','dom4','dom5']
def norm(s): return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn').strip()
TIME = re.compile(r'\d')
def eh_turno(v):
    v = v.strip().upper()
    return v in ('FOLGA', 'FÉRIAS', 'FERIAS') or bool(re.match(r'^\d{1,2}(:\d{2})?\s*-', v))

# blocos: (unidade, escala, setor, linha_cabecalho, linhas)
B = []
def bloco(u, e, setor, hdr, ini, fim): B.append((u, e, setor, hdr, ini, fim))
# PRODUÇÃO
bloco('producao','Produção · atual','Produção',31,32,40)
# PERDIZES
bloco('perdizes','Novembro 2026','Cozinha',44,45,61); bloco('perdizes','Novembro 2026','Expedição',62,63,73)
bloco('perdizes','Proposta 5x2','Cozinha',76,77,95); bloco('perdizes','Proposta 5x2','Expedição',96,97,106)
# BROOKLIN
bloco('brooklyn','Novembro 2026','Cozinha',110,111,127); bloco('brooklyn','Novembro 2026','Expedição',128,129,138); bloco('brooklyn','Novembro 2026','Limpeza',110,139,142)
bloco('brooklyn','Proposta 5x2','Cozinha',147,148,166); bloco('brooklyn','Proposta 5x2','Expedição',167,168,177); bloco('brooklyn','Proposta 5x2','Limpeza',147,178,181)
# VILA MARIANA (outubro fica de fora: já passou)
bloco('vilamariana','Novembro 2026','Cozinha',216,217,230); bloco('vilamariana','Novembro 2026','Expedição',232,233,239)
bloco('vilamariana','Proposta 5x2','Cozinha',244,245,259); bloco('vilamariana','Proposta 5x2','Expedição',261,262,268)
# TATUAPÉ
bloco('tatuape','Novembro 2026','Cozinha',275,276,283); bloco('tatuape','Novembro 2026','Expedição',285,286,291)
bloco('tatuape','Dezembro 2026','Cozinha',297,298,305); bloco('tatuape','Dezembro 2026','Expedição',307,308,313)
bloco('tatuape','Proposta 5x2','Cozinha',319,320,329); bloco('tatuape','Proposta 5x2','Expedição',331,332,337)
# BUTANTÃ
bloco('butanta','Dezembro 2026','Cozinha',344,345,353); bloco('butanta','Dezembro 2026','Expedição',355,356,360)
bloco('butanta','Proposta 5x2','Cozinha',363,364,372); bloco('butanta','Proposta 5x2','Expedição',374,375,379)

META = {('producao','Produção · atual'):(None,'vigente'),
 ('perdizes','Novembro 2026'):('2026-11','vigente'),('perdizes','Proposta 5x2'):(None,'proposta'),
 ('brooklyn','Novembro 2026'):('2026-11','vigente'),('brooklyn','Proposta 5x2'):(None,'proposta'),
 ('vilamariana','Novembro 2026'):('2026-11','vigente'),('vilamariana','Proposta 5x2'):(None,'proposta'),
 ('tatuape','Novembro 2026'):('2026-11','vigente'),('tatuape','Dezembro 2026'):('2026-12','planejada'),('tatuape','Proposta 5x2'):(None,'proposta'),
 ('butanta','Dezembro 2026'):('2026-12','planejada'),('butanta','Proposta 5x2'):(None,'proposta')}

colab = json.load(open('/home/claude/fb/escalas/colab.json'))  # [{id,nome,unidade,cargo}]
def casar(nome, u):
    n = norm(nome).replace('.', ' ')
    if not n or n.startswith('freela') or n.startswith('vaga') or n in ('v a','a definir'): return None
    cand = [c for c in colab if c['unidade'] == u]
    if n == 'gerente':
        g = [c for c in cand if re.search(r'gerente', norm(c['cargo'] or ''))]
        return g[0] if len(g) == 1 else None
    tk = n.split()
    best, bs = None, 0
    for c in cand:
        ct = norm(c['nome']).split()
        s1 = difflib.SequenceMatcher(None, tk[0], ct[0]).ratio()
        if len(tk[0]) >= 4 and ct[0].startswith(tk[0]): s1 = max(s1, .95)
        if s1 < .8: continue
        s2 = max([max(difflib.SequenceMatcher(None, t, x).ratio() for x in ct[1:]) for t in tk[1:]] or [0])
        sc = s1 + (s2 if len(tk) > 1 else .5)
        if sc > bs: best, bs = c, sc
    if best and (bs >= 1.65 or (len(tk) == 1 and bs >= 1.4)):
        return best
    return None

saida = {}
for u, e, setor, hdr, ini, fim in B:
    h = [x.strip().upper() for x in row(hdr)]
    temfun = len(h) > 1 and h[1].startswith('FUN')
    ncol = len([x for x in h if x.startswith(('SEG','TER','QUA','QUI','SEX','SÁB','SAB','DOM'))])
    key = (u, e); esc = saida.setdefault(key, {'unidade': u, 'nome': e, 'mes': META[key][0], 'tipo': META[key][1], 'linhas': []})
    for i in range(ini, fim + 1):
        if i == hdr: continue
        r = row(i) if L[i-1].strip() else []
        if not r or not r[0].strip(): continue
        nome = r[0].strip(); funcao = None
        if norm(nome) in ('nome completo', 'estaff', 'freelas da casa', 'k', 'diurno'): continue
        vals = r[2:] if temfun else r[1:]
        if temfun: funcao = r[1].strip().title() or None
        vals = [v.strip() for v in vals][:ncol]
        if not any(eh_turno(v) for v in vals): continue          # linha sem turnos (cabeçalho, reserva vazia, lixo)
        if sum(1 for v in vals if v and not eh_turno(v)) > 2: continue
        m = re.match(r'^(L[IÍ]DER|GER[EÊ]NCIA)\s*-\s*(.+)$', nome, re.I)
        if m: funcao = 'Líder' if m.group(1).upper().startswith('L') else 'Gerente'; nome = m.group(2).strip()
        nome = re.sub(r'\s*\((NOTURNO|ESTOQUE)\)', '', nome, flags=re.I).strip()
        nn = norm(nome)
        if nn.startswith('vaga'): vinc = 'Vaga aberta'
        elif nn.startswith('freela') or nn.startswith('v.a') or nn == 'v.a.':
            vinc = 'Freelancer fixo' if 'fixo' in nn else 'Freelancer V.A'
        elif temfun and norm(nome) == norm(funcao or ''): vinc = 'A definir'
        else: vinc = 'CLT'
        st = setor
        if '(ESTOQUE)' in r[0].upper(): st = 'Estoque'
        c = casar(nome, u) if vinc == 'CLT' else None
        if c and setor == 'Limpeza' and re.search(r'estoqu', norm(c['cargo'] or '')): st = 'Estoque'
        if nn == 'gerente' and not funcao: funcao = 'Gerente'
        dias = {}
        for k, v in zip(DIAS, vals):
            if v: dias[k] = re.sub(r'\s+', ' ', v).strip()
        esc['linhas'].append({'setor': st, 'nome': nome.title() if nome.isupper() else nome, 'funcao': funcao, 'vinculo': vinc,
                              'colaborador_id': c['id'] if c else None, 'cargo_rh': c['cargo'] if c else None, 'nome_rh': c['nome'] if c else None, 'dias': dias})
out = list(saida.values())
json.dump(out, open('/home/claude/fb/escalas/escalas.json', 'w'), ensure_ascii=False, indent=1)
for e in out:
    cl = [l for l in e['linhas'] if l['vinculo'] == 'CLT']
    print(f"{e['unidade']:12} {e['nome']:18} linhas={len(e['linhas']):2} CLT={len(cl):2} casados={sum(1 for l in cl if l['colaborador_id'])}")
    for l in cl:
        print('     ', l['nome'], '->', l['nome_rh'], '|', l['setor'], '|', l['funcao'])
