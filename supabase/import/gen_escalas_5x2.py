import json
d=json.load(open('/home/claude/fb/e52/e52.json'))
DK=['seg','ter','qua','qui','sex','sab','dom']
T={('Cozinha Dia','fixo'):'7:30-15/16-17:18',('Cozinha Noite','fixo'):'13:30-17:30/18:30-23:18',
   ('Expedição Dia','fixo'):'9:30-15/16-19:18',('Expedição Noite','fixo'):'13:30-17:30/18:30-23:18',
   ('dia','int'):'10:30-15',('noite','int'):'18-23',('dia','hor'):'11:30-15',('noite','hor'):'18:30-22:30',
   'Reforço domingo':'18-23','Gerente':'10-15/16-19:48','Estoquista':'7-12/13-16:48','Auxiliar geral':'7-12/13-16:48'}
# equipe atual (escala de novembro; Butantã = dezembro), por posição. None = vaga a contratar
# (nome, colaborador_id, funcao)
V=None
EQ={
 'perdizes':{'Cozinha Dia':[('Rafaela Alves',142,None),('Rafael Staniscia',141,None),('Sheila Rodrigues',145,None),('Paulo Pazzani',140,None),V,V],
  'Cozinha Noite':[('Romailton Miranda',144,None),('Daniel Richard',134,None),('Vitor Hugo de Oliveira',147,None),('Renata Sorrá',None,None),V,V,V],
  'Expedição Dia':[('Natha de Oliveira',139,None),('Igor Rafael',137,None),V],
  'Expedição Noite':[('Henrique Lins',136,None),('Edilson Duarte',135,None),('Thalita',146,None)],
  'Gerente':('Júlio César',138,'Gerente'),'Estoquista':V,'Auxiliar geral':V},
 'brooklyn':{'Cozinha Dia':[('Vanessa Gazolla',102,None),('Natalia Nascimento',96,None),('Gisele Ribeiro',92,None),('Henrique Farias',94,None),('Renato Tavares',99,None),V,V],
  'Cozinha Noite':[('Matheus Rocha',95,None),('Ronaldo Braga',101,None),('Raul Flores',98,None),('Henker',93,None),('Robson',100,None),('Andre Souza',86,None),V,V],
  'Expedição Dia':[('Barbara Regina Xavier Dias',87,None),('Gabriely Santos',91,None),V],
  'Expedição Noite':[('Raiane Larissa Matos',97,None),('Veridiana',103,None),V],
  'Gerente':('Eduardo Galdino',89,'Gerente'),'Estoquista':('Erick',90,'Estoquista'),'Auxiliar geral':('Carlos',88,'Auxiliar geral')},
 'vilamariana':{'Cozinha Dia':[('Stefany Santos',164,None),('Leonardo Nunes',None,None),('Elizangela Gomes',157,None),('Annia Karenina',None,None),V],
  'Cozinha Noite':[('Jemerson José',159,None),('Paulo Carvalho',162,None),('Rian Silva',163,None),('Luana Souza',161,None),V],
  'Expedição Dia':[('Daniel Sales',156,'Gerente'),('Francielly Cardoso',158,None)],
  'Expedição Noite':[('Larissa',160,None),V]},
 'tatuape':{'Cozinha Dia':[('Sandro Henrique',153,'Líder'),('Larissa Silva Santos',151,None),('Rinaldo dos Santos Junior',152,None),V,V],
  'Cozinha Noite':[('Ana Carolina Cúria',148,'Líder'),('Bruno Polido',149,None),V,V,V],
  'Expedição Dia':[('Cássia Martins',150,'Gerente'),('Thais Pereira',154,None)],
  'Expedição Noite':[('Tiago Inacio',155,None),V]},
 'butanta':{'Cozinha Dia':[('Grazi',105,None),('Renan',107,None),V,V,V],
  'Cozinha Noite':[('Venessa',None,None),('Tomaz',110,None),V,V,V],
  'Expedição Dia':[('Rodrigo',108,'Gerente'),('Isabela Souza Manha',106,None)],
  'Expedição Noite':[('Thiago Isqui',109,None),V]},
}

# o PDF traz o gerente do Brooklin com 6 dias em 3 das 4 semanas (fora do 5x2): usa o rodízio do gerente de Perdizes, que é 5x2
for _r in d['brooklyn']:
  if _r['pos']=='Gerente' and max(_r['m'][i*7:i*7+7].count('W') for i in range(4))>5:
    _r['m']=next(x['m'] for x in d['perdizes'] if x['pos']=='Gerente'); print('gerente brooklyn ajustado para 5x2')

# ---- escolhe em qual posição do rodízio fica cada líder/gerente para respeitar as regras de domingo e da manhã ----
import itertools
LID={153,148,102,95,105,144,159}; SUP={89,108,138,150,156,97}
def folgas_dom(m): return {w for w in range(4) if m[w*7+6]=='F'}
def otimiza(loja,rows):
  eq=EQ[loja]; grp={}
  for r in rows:
    if r['pos'].startswith('Fixo'): grp.setdefault(r['g'],[]).append(r['m'])
  chave=[(g,i) for g,l in eq.items() if isinstance(l,list) for i,p in enumerate(l) if p and p[1] in (LID|SUP)]
  if not chave: return
  fix={}
  for pos in ('Gerente',):
    p=eq.get(pos)
    if p and p[1] in SUP: fix[p[1]]=next(r['m'] for r in rows if r['pos']==pos)
  def custo(atr):
    ms=dict(fix); ms.update({eq[g][i][1]:grp[g][s] for (g,i),s in atr.items()})
    lids=[k for k in ms if k in LID]; sups=[k for k in ms if k in SUP]; c=0
    for a,b in itertools.combinations(lids,2): c+=len(folgas_dom(ms[a])&folgas_dom(ms[b]))
    for s in sups:
      for l in lids: c+=len(folgas_dom(ms[s])&folgas_dom(ms[l]))
    for (g,i),s in atr.items():
      if eq[g][i][1] in LID and g=='Cozinha Dia':
        m=grp[g][s]; c+=sum(m[w*7]=='F' or m[w*7+2]=='F' for w in range(4))
    return c
  opts=[range(len(grp[g])) for g,i in chave]; best=None
  for comb in itertools.product(*opts):
    atr=dict(zip(chave,comb))
    if len({(g,s) for (g,i),s in atr.items()})<len(atr): continue
    k=(custo(atr),sum(abs(s-i) for (g,i),s in atr.items()))
    if best is None or k<best[0]: best=(k,atr)
  print(loja,'violações',best[0][0],{eq[g][i][0]:f'{g} Fixo {s+1}' for (g,i),s in best[1].items()})
  for g in {g for g,i in chave}:
    lst=list(eq[g]); n=len(grp[g]); lst+= [None]*(n-len(lst)); novo=[None]*n
    mov={i:s for (gg,i),s in best[1].items() if gg==g}
    for i,s in mov.items(): novo[s]=lst[i]
    resto=[p for i,p in enumerate(lst) if i not in mov]
    for s in range(n):
      if novo[s] is None and not (s in mov.values()): novo[s]=resto.pop(0)
    eq[g]=novo
for _l,_r in d.items(): otimiza(_l,_r)

# ---- líder da manhã sem folga na segunda (contagem) e na quarta (requerimento): troca o dia de folga com um colega do mesmo grupo
#      (a troca mantém o número de pessoas de cada dia e as 2 folgas por semana de cada um) ----
def seqmax(m):
  v=[c=='W' for c in m]; r=mx=0
  for x in v+v: r=r+1 if x else 0; mx=max(mx,r)
  return min(mx,28)
TROCAS=[]
def ajusta_lider(loja,rows):
  eq=EQ[loja]; g='Cozinha Dia'; fx=[r for r in rows if r['g']==g and r['pos'].startswith('Fixo')]
  for i,p in enumerate(eq.get(g,[])):
    if not p or p[1] not in LID or i>=len(fx): continue
    L=fx[i]
    for w in range(4):
      for d in (0,2):
        j=w*7+d
        if L['m'][j]!='F': continue
        feito=False
        for o in fx:
          if o is L or feito: continue
          for d2 in (1,3,4,5):
            k=w*7+d2
            if L['m'][k]=='W' and o['m'][j]=='W' and o['m'][k]=='F':
              ml=list(L['m']); mo=list(o['m']); ml[j],ml[k]='W','F'; mo[j],mo[k]='F','W'
              ml=''.join(ml); mo=''.join(mo)
              if seqmax(ml)<=6 and seqmax(mo)<=6:
                TROCAS.append(f"{loja}: {p[0]} troca a folga de {['seg','ter','qua','qui','sex','sab'][d]} pela de {['seg','ter','qua','qui','sex','sab'][d2]} na semana {w+1} com {o['pos']}")
                L['m'],o['m']=ml,mo; feito=True; break
for _l,_r in d.items(): ajusta_lider(_l,_r)
print('\n'.join(TROCAS))

def q(s): return 'null' if s is None else "'"+str(s).replace("'","''")+"'"
out=["-- escalas 5x2 oficiais (rodízio de 4 semanas do PDF) · gerado por gen_import.py",
     "delete from public.escalas where modelo='ciclo4' and nome='Escala 5x2 oficial';"]
resumo={};ALL=[];LOJ=[];MOCK=[]
for loja,rows in d.items():
  eq=EQ[loja]; idx={}
  LOJ.append(loja)
  vals=[];vagas=0
  for o,r in enumerate(rows):
    g,pos,m=r['g'],r['pos'],r['m']
    setor='Gestão' if g=='Gestão e apoio' else ('Cozinha' if g.startswith('Cozinha') else 'Expedição')
    if pos=='Estoquista':setor='Estoque'
    if pos=='Auxiliar geral':setor='Limpeza'
    per='dia' if g.endswith('Dia') else 'noite'
    if pos.startswith('Fixo'):
      lst=eq[g]; i=int(pos.split()[1])-1; p=lst[i] if i<len(lst) else V
      h=T[(g,'fixo')]
      if p and p[2]=='Gerente': h=T['Gerente']
      vinc='CLT' if p else 'Vaga aberta'
    elif pos.startswith('Intermitente'):
      p=V; h=T[(per,'int')]; vinc='Vaga aberta'
    elif pos=='Horista':
      p=V; h=T[(per,'hor')]; vinc='Vaga aberta'
    elif pos=='Reforço domingo':
      p=('Freelancer · reforço domingo',None,None); h=T[pos]; vinc='Freelancer fixo'
    else:
      p=eq.get(pos); h=T[pos]; vinc='CLT' if p else 'Vaga aberta'
      if p is None and pos not in eq: p=V
    if vinc=='Vaga aberta': vagas+=1
    nome=p[0] if p else 'A contratar'
    fun=(p[2] if p else None) or (pos if pos in ('Gerente','Estoquista','Auxiliar geral') else ('Intermitente' if pos.startswith('Intermitente') else 'Horista' if pos=='Horista' else None))
    posicao=f"{g} · {pos}" if g!='Gestão e apoio' else pos
    MOCK.append(dict(unidade=loja,setor=setor,nome=nome,funcao=fun,vinculo=vinc,colaborador_id=(p[1] if p and p[1] else None),ordem=o,grupo=g,posicao=posicao,dias={f'w{j//7+1}'+DK[j%7]:(h if ch=='W' else 'FOLGA') for j,ch in enumerate(m) if ch!='-'}))
    vals.append(f"('{loja}',{q(setor)},{q(nome)},{q(fun)},{q(vinc)},{p[1] if p and p[1] else 'null'},{o},{q(g)},{q(posicao)},'{m}',{q(h)})")
  ALL.extend(vals)
  resumo[loja]=(len(rows),vagas)
out.append("insert into public.escalas (unidade,nome,mes,tipo,modelo,inicio,obs) select u,'Escala 5x2 oficial','2027-01','vigente','ciclo4','2026-12-14','Rodízio de 4 semanas · implantação 16/12/2026 · obrigatória a partir de 01/01/2027 · horários propostos pelos picos de venda (almoço 12h–14h30, jantar 19h–21h30)' from unnest(array["+",".join("'"+l+"'" for l in LOJ)+"]) u;")
out.append("""insert into public.escala_linhas (escala_id,setor,nome,funcao,vinculo,colaborador_id,ordem,grupo,posicao,dias)
select e.id,v.setor,v.nome,v.funcao,v.vinculo,v.colab,v.ordem,v.grupo,v.posicao,
  (select coalesce(jsonb_object_agg('w'||(i/7+1)||(array['seg','ter','qua','qui','sex','sab','dom'])[i%7+1], case substr(v.m,i+1,1) when 'W' then v.h else 'FOLGA' end),'{}'::jsonb)
     from generate_series(0,27) i where substr(v.m,i+1,1)<>'-')
from (values\n"""+",\n".join(ALL)+"""\n) v(loja,setor,nome,funcao,vinculo,colab,ordem,grupo,posicao,m,h)
join public.escalas e on e.unidade=v.loja and e.modelo='ciclo4' and e.nome='Escala 5x2 oficial';""")
out.append("select public.gerar_alertas();")
open('/home/claude/fat-buddha-portal/supabase/import/escalas_5x2.sql','w').write("\n".join(out)+"\n")
print(resumo)

json.dump(MOCK,open('/home/claude/fb/e52/mock52.json','w'),ensure_ascii=False)
