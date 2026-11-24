// Fat Buddha · API de integração
// POST /functions/v1/api-integracao/<recurso>   header: x-api-key: fbk_...
// recursos: vendas, vendas_hora, rupturas, delivery, indicadores, cmv, ifood, pedidos, notas
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const RECURSOS = ["vendas", "vendas_hora", "rupturas", "delivery", "indicadores", "cmv", "ifood", "pedidos", "notas"];
const MAX = 2000;

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const num = (v: unknown, nome: string, obrig = false): number | null => {
  if (v === null || v === undefined || v === "") { if (obrig) throw new Error(`campo "${nome}" é obrigatório`); return null; }
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!isFinite(n)) throw new Error(`campo "${nome}" não é número`);
  return n;
};
const data = (v: unknown, nome = "data"): string => {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  throw new Error(`campo "${nome}" inválido (use AAAA-MM-DD)`);
};
const mes = (v: unknown): string => { const s = String(v ?? "").trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; return data(s, "mes").slice(0, 7); };
const segunda = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const CATS = ["cmv", "cdel", "man", "mkt", "cto", "agua", "energia", "outros", "ignorar"];
const soDig = (v: unknown) => String(v ?? "").replace(/\D/g, "");
// data e hora do pedido: aceita ISO com fuso; sem fuso, considera horário de Brasília
const dataHora = (v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!s) throw new Error('campo "data_hora" é obrigatório');
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  let iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] || "00"}` : s.replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) iso += "-03:00";
  const d = new Date(iso); if (isNaN(d.getTime())) throw new Error('campo "data_hora" inválido (use AAAA-MM-DDTHH:MM:SS-03:00)');
  return d.toISOString();
};
const canalDe = (v: unknown) => { const n = norm(v); if (!n) return "delivery"; if (["salao", "balcao", "mesa", "loja", "presencial", "totem"].includes(n)) return "salao"; if (["delivery", "ifood", "app", "rappi", "site", "telefone", "entrega", "retirada", "takeout"].includes(n)) return "delivery"; throw new Error('campo "canal" deve ser salao ou delivery'); };
const statusDe = (v: unknown) => { const n = norm(v); if (!n) return "concluido"; if (/cancel/.test(n)) return "cancelado"; return "concluido"; };
// leitura simples do XML da NF-e (padrão SEFAZ)
const tagIn = (x: string, t: string) => { const m = x.match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`)); return m ? m[1].trim() : ""; };
const blocos = (x: string, t: string) => [...x.matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`, "g"))].map((m) => m[1]);
const xmlTxt = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
function lerXmlNfe(xml: string) {
  const inf = (xml.match(/<(?:\w+:)?infNFe[^>]*Id="NFe(\d{44})"/) || [])[1];
  if (!inf) throw new Error("XML não parece uma NF-e (infNFe com chave de 44 dígitos não encontrado)");
  const ide = tagIn(xml, "ide"), emit = tagIn(xml, "emit"), dest = tagIn(xml, "dest"), tot = tagIn(xml, "ICMSTot");
  const n = (t: string, b: string) => { const v = tagIn(b, t); return v === "" ? null : Number(v); };
  return {
    chave: inf, numero: tagIn(ide, "nNF"), serie: tagIn(ide, "serie"),
    emissao: (tagIn(ide, "dhEmi") || tagIn(ide, "dEmi")).slice(0, 10),
    fornecedor_cnpj: tagIn(emit, "CNPJ") || tagIn(emit, "CPF"), fornecedor_nome: xmlTxt(tagIn(emit, "xNome")),
    destinatario_cnpj: tagIn(dest, "CNPJ"),
    valor_produtos: n("vProd", tot), frete: n("vFrete", tot) ?? 0, desconto: n("vDesc", tot) ?? 0, outras: n("vOutro", tot) ?? 0, valor_total: n("vNF", tot),
    itens: blocos(xml, "det").map((d, i) => { const p = tagIn(d, "prod"); return { n: i + 1, codigo: tagIn(p, "cProd"), descricao: xmlTxt(tagIn(p, "xProd")), ncm: tagIn(p, "NCM"), cfop: tagIn(p, "CFOP"), unidade: tagIn(p, "uCom"), quantidade: n("qCom", p), valor_unit: n("vUnCom", p), valor_total: n("vProd", p) }; }),
  };
}
async function sha256(t: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

const DOC = {
  api: "Fat Buddha · API de integração",
  autenticacao: "Envie a chave no cabeçalho x-api-key. Gere e revogue chaves em Configurações › Integrações (somente administrador).",
  uso: "POST /functions/v1/api-integracao/<recurso> com JSON: um objeto, uma lista ou {\"registros\": [...]} (até 2000 por chamada).",
  loja: "Use o código (brooklyn) ou o nome (Brooklyn, Vila Mariana).",
  recursos: {
    vendas: { chave_unica: "loja + data (reenviar atualiza, não duplica)", campos: { data: "AAAA-MM-DD", loja: "código ou nome", salao: "R$", delivery: "R$", pedidos_salao: "inteiro", pedidos_delivery: "inteiro" } },
    vendas_hora: { chave_unica: "loja + data + hora", campos: { data: "AAAA-MM-DD", loja: "", hora: "0 a 23", salao: "R$", delivery: "R$" } },
    rupturas: { chave_unica: "nenhuma (cada envio é um registro)", campos: { data: "AAAA-MM-DD", loja: "", item: "texto", motivo: "texto", horas: "número", acao: "texto opcional" } },
    delivery: { chave_unica: "nenhuma", campos: { data: "", loja: "", periodo: "Diário ou Semanal", responsavel: "", preparo: "min", cancel: "%", ifood: "nota", online: "%", rupturas: "qtde", pedidos: "", ticket: "R$", conversao: "%", atrasos: "%", comissao: "%", frete: "R$", promo: "R$", custoPed: "R$" } },
    indicadores: { chave_unica: "loja + mes (campos enviados substituem; os ausentes são mantidos)", campos: { mes: "AAAA-MM", loja: "", preparo: "", cancel: "", ifood: "", online: "", comp: "%", folha_valor: "R$" } },
    ifood: { chave_unica: "loja + data", loja: "código, nome ou o merchant id do iFood cadastrado na loja", campos: { data: "AAAA-MM-DD", loja: "", pedidos: "inteiro", faturamento: "R$", cancelados: "inteiro", valor_cancelado: "R$", online_min: "minutos com a loja aberta no app", previsto_min: "minutos previstos de funcionamento", nota: "0 a 5", avaliacoes: "inteiro", preparo_min: "min", entrega_min: "min", atrasados: "pedidos atrasados", comissao: "R$", taxas: "R$", promocoes: "R$ investidos pela loja", novos_clientes: "inteiro" } },
    pedidos: { chave_unica: "origem + id (reenviar com status cancelado cancela o pedido)", observacao: "Cada pedido atualiza na hora a venda do dia e da hora da loja (painel em tempo real). Um fechamento enviado em 'vendas' ou lançado à mão tem prioridade sobre a soma dos pedidos.", campos: { id: "identificador do pedido no seu sistema", loja: "código, nome ou código do PDV cadastrado na loja", data_hora: "AAAA-MM-DDTHH:MM:SS-03:00", canal: "salao ou delivery", plataforma: "ifood, rappi, site, balcão…", valor: "R$ do pedido", itens: "inteiro", status: "concluido ou cancelado", origem: "opcional (padrão: a chave)" } },
    notas: { chave_unica: "chave de acesso da NF-e (44 dígitos)", observacao: "Envie o XML da NF-e em {\"xml\": \"...\"} ou os campos em JSON. A loja é reconhecida pelo CNPJ do destinatário (cadastrado na loja); sem loja, a nota vai para a cozinha central. A categoria do DRE é aplicada pelas regras de fornecedor.", campos: { xml: "XML completo da NF-e (opcional)", chave: "44 dígitos", numero: "", serie: "", emissao: "AAAA-MM-DD", loja: "opcional", fornecedor_cnpj: "", fornecedor_nome: "", valor_total: "R$", valor_produtos: "", frete: "", desconto: "", outras: "", categoria: "cmv, cdel, man, mkt, cto, agua, energia, outros, ignorar (opcional)", itens: "[{codigo, descricao, ncm, cfop, unidade, quantidade, valor_unit, valor_total}]" } },
    cmv: { chave_unica: "loja + semana (segunda-feira)", campos: { semana: "qualquer data da semana", loja: "", vendas: "R$", cmv_teorico: "%", estoque_inicial: "", compras: "", transf_entrada: "", transf_saida: "", devolucoes: "", estoque_final: "", responsavel: "" } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const recurso = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || null;
  let chaveId: number | null = null;
  const log = async (status: number, registros: number, erro: string | null) => {
    await admin.from("api_logs").insert({ chave_id: chaveId, recurso: RECURSOS.includes(recurso) ? recurso : recurso.slice(0, 40), status, registros, erro: erro?.slice(0, 1000) ?? null, ip });
  };
  try {
    const key = req.headers.get("x-api-key") || "";
    if (!key) { if (req.method === "GET") return json(DOC); return json({ erro: "Cabeçalho x-api-key ausente." }, 401); }
    const { data: ch } = await admin.from("api_chaves").select("*").eq("hash", await sha256(key)).maybeSingle();
    if (!ch || !ch.ativo) { await log(401, 0, "chave inválida ou revogada"); return json({ erro: "Chave inválida ou revogada." }, 401); }
    chaveId = ch.id;
    await admin.from("api_chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", ch.id);
    if (req.method === "GET") { await log(200, 0, null); return json({ ok: true, chave: ch.nome, escopos: ch.escopos, lojas: ch.lojas ?? "todas", ...DOC }); }
    if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
    if (!RECURSOS.includes(recurso)) { await log(404, 0, "recurso inexistente"); return json({ erro: `Recurso inválido. Use: ${RECURSOS.join(", ")}.` }, 404); }
    if (!ch.escopos.includes(recurso)) { await log(403, 0, "fora do escopo"); return json({ erro: `Esta chave não tem permissão para "${recurso}".` }, 403); }

    let body: any; try { body = await req.json(); } catch { await log(400, 0, "JSON inválido"); return json({ erro: "Corpo não é um JSON válido." }, 400); }
    const itens: any[] = Array.isArray(body) ? body : Array.isArray(body?.registros) ? body.registros : [body];
    if (!itens.length) return json({ erro: "Nenhum registro enviado." }, 400);
    if (itens.length > MAX) { await log(413, 0, "excesso de registros"); return json({ erro: `Máximo de ${MAX} registros por chamada.` }, 413); }

    const { data: lojas } = await admin.from("lojas").select("id,nome,ifood_merchant,codigo_pdv,cnpj");
    const lojaDe = (v: unknown) => { const n = norm(v); const l = (lojas || []).find((x: any) => x.id === n || norm(x.nome) === n || (x.ifood_merchant && norm(x.ifood_merchant) === n) || (x.codigo_pdv && norm(x.codigo_pdv) === n)); if (!l) throw new Error(`loja "${v}" não encontrada`); if (ch.lojas && !ch.lojas.includes(l.id)) throw new Error(`chave sem permissão para a loja ${l.nome}`); return l.id; };

    if (recurso === "notas") {
      if (itens.length > 200) { await log(413, 0, "excesso de notas"); return json({ erro: "Máximo de 200 notas por chamada." }, 413); }
      const errosN: { linha: number; erro: string }[] = []; let gravN = 0; const ids: number[] = [];
      for (let i = 0; i < itens.length; i++) {
        try {
          const r = itens[i]; if (!r || typeof r !== "object") throw new Error("registro não é um objeto");
          const x: any = r.xml ? lerXmlNfe(String(r.xml)) : r;
          let loja: string | null = null;
          const lv = r.loja ?? r.loja_id;
          if (lv && !["cc", "cozinha central", "cozinha_central"].includes(norm(lv))) loja = lojaDe(lv);
          else if (!lv && x.destinatario_cnpj) { const l = (lojas || []).find((y: any) => y.cnpj && soDig(y.cnpj) === soDig(x.destinatario_cnpj)); if (l) { if (ch.lojas && !ch.lojas.includes(l.id)) throw new Error(`chave sem permissão para a loja ${l.nome}`); loja = l.id; } }
          if (!loja && ch.lojas) throw new Error("esta chave só envia notas de lojas específicas: informe a loja");
          const cnpj = soDig(x.fornecedor_cnpj), numero = x.numero ? String(x.numero) : null, serie = x.serie ? String(x.serie) : null;
          let chave = soDig(x.chave);
          if (chave && chave.length !== 44) throw new Error('campo "chave" deve ter 44 dígitos');
          if (!chave) { if (!cnpj || !numero) throw new Error('informe "chave" ou "fornecedor_cnpj" + "numero"'); chave = `${cnpj}-${numero}-${serie || "0"}`; }
          if (!x.fornecedor_nome) throw new Error('campo "fornecedor_nome" é obrigatório');
          const cat = r.categoria ? norm(r.categoria) : null; if (cat && !CATS.includes(cat)) throw new Error(`categoria inválida (use ${CATS.join(", ")})`);
          const o: any = { loja_id: loja, chave, numero, serie, emissao: data(x.emissao, "emissao"), fornecedor_cnpj: cnpj || null, fornecedor_nome: String(x.fornecedor_nome).slice(0, 200),
            valor_produtos: num(x.valor_produtos, "valor_produtos"), frete: num(x.frete, "frete") ?? 0, desconto: num(x.desconto, "desconto") ?? 0, outras: num(x.outras, "outras") ?? 0,
            valor_total: num(x.valor_total, "valor_total", true), origem: r.xml ? "api-xml" : "api", obs: r.obs ? String(r.obs).slice(0, 500) : null };
          if (r.competencia) o.competencia = mes(r.competencia);
          if (cat) o.categoria = cat;
          if (o.valor_total < 0) throw new Error("valor_total negativo");
          const its = (Array.isArray(x.itens) ? x.itens : []).slice(0, 500).map((t: any, k: number) => {
            if (!t || !t.descricao) throw new Error(`item ${k + 1}: campo "descricao" é obrigatório`);
            return { n: t.n ?? k + 1, codigo: t.codigo ? String(t.codigo).slice(0, 60) : null, descricao: String(t.descricao).slice(0, 300), ncm: t.ncm ? String(t.ncm) : null, cfop: t.cfop ? String(t.cfop) : null, unidade: t.unidade ? String(t.unidade).slice(0, 10) : null, quantidade: num(t.quantidade, "quantidade"), valor_unit: num(t.valor_unit, "valor_unit"), valor_total: num(t.valor_total, "valor_total") };
          });
          const { data: nf, error } = await admin.from("notas_fiscais").upsert(o, { onConflict: "chave" }).select("id").single();
          if (error) throw new Error(error.message);
          await admin.from("notas_itens").delete().eq("nota_id", nf.id);
          if (its.length) { const { error: e2 } = await admin.from("notas_itens").insert(its.map((t: any) => ({ ...t, nota_id: nf.id }))); if (e2) throw new Error(e2.message); }
          gravN++; ids.push(nf.id);
        } catch (e) { errosN.push({ linha: i + 1, erro: (e as Error).message }); }
      }
      const st = errosN.length && !gravN ? 422 : 200;
      await log(st, gravN, errosN.length ? JSON.stringify(errosN.slice(0, 20)) : null);
      return json({ ok: gravN > 0, recurso, recebidos: itens.length, gravados: gravN, rejeitados: errosN.length, ids, erros: errosN.slice(0, 100) }, st);
    }

    const ok: any[] = [], erros: { linha: number; erro: string }[] = [];
    itens.forEach((r, i) => {
      try {
        if (!r || typeof r !== "object") throw new Error("registro não é um objeto");
        let o: any;
        switch (recurso) {
          case "vendas": o = { loja_id: lojaDe(r.loja ?? r.loja_id), data: data(r.data), salao: num(r.salao, "salao") ?? 0, delivery: num(r.delivery, "delivery") ?? 0, pedidos_salao: Math.round(num(r.pedidos_salao, "pedidos_salao") ?? 0), pedidos_delivery: Math.round(num(r.pedidos_delivery, "pedidos_delivery") ?? 0), origem: "api" };
            if (o.salao < 0 || o.delivery < 0 || o.pedidos_salao < 0 || o.pedidos_delivery < 0) throw new Error("valores negativos"); break;
          case "vendas_hora": o = { loja_id: lojaDe(r.loja ?? r.loja_id), data: data(r.data), hora: Math.round(num(r.hora, "hora", true)!), salao: num(r.salao, "salao") ?? 0, delivery: num(r.delivery, "delivery") ?? 0, origem: "api" };
            if (o.hora < 0 || o.hora > 23) throw new Error("hora deve ser de 0 a 23"); break;
          case "rupturas": if (!r.item) throw new Error('campo "item" é obrigatório');
            o = { loja_id: lojaDe(r.loja ?? r.loja_id), data: data(r.data), item: String(r.item).slice(0, 200), motivo: String(r.motivo || "Não informado").slice(0, 200), horas: num(r.horas, "horas") ?? 0, acao: r.acao ? String(r.acao).slice(0, 500) : null }; break;
          case "delivery": {
            const m: any = {}, a: any = {};
            for (const k of ["preparo", "cancel", "ifood", "online", "rupturas"]) { const v = num(r[k], k); if (v !== null) m[k] = v; }
            for (const k of ["pedidos", "ticket", "conversao", "atrasos", "comissao", "frete", "promo", "custoPed"]) { const v = num(r[k], k); if (v !== null) a[k] = v; }
            if (!Object.keys(m).length) throw new Error("envie ao menos um indicador (preparo, cancel, ifood, online, rupturas)");
            o = { loja_id: lojaDe(r.loja ?? r.loja_id), data: data(r.data), periodo: r.periodo === "Semanal" ? "Semanal" : "Diário", responsavel: r.responsavel ? String(r.responsavel).slice(0, 120) : "Integração", metas: m, acomp: a, rotina: {}, obs: r.obs ? String(r.obs).slice(0, 1000) : null }; break; }
          case "indicadores": o = { loja_id: lojaDe(r.loja ?? r.loja_id), mes: mes(r.mes ?? r.data) };
            for (const k of ["preparo", "cancel", "ifood", "online", "comp", "folha_valor"]) { if (k in r) o[k] = num(r[k], k); }
            if (Object.keys(o).length === 2) throw new Error("nenhum indicador enviado"); break;
          case "ifood": {
            o = { loja_id: lojaDe(r.loja ?? r.loja_id ?? r.merchant_id), data: data(r.data), origem: "api" };
            const ints = ["pedidos", "cancelados", "avaliacoes", "atrasados", "novos_clientes"], nums = ["faturamento", "valor_cancelado", "online_min", "previsto_min", "nota", "preparo_min", "entrega_min", "comissao", "taxas", "promocoes"];
            for (const k of ints) if (k in r) { const v = num(r[k], k); o[k] = v == null ? null : Math.round(v); }
            for (const k of nums) if (k in r) o[k] = num(r[k], k);
            if ("online_horas" in r && !("online_min" in r)) { const v = num(r.online_horas, "online_horas"); o.online_min = v == null ? null : v * 60; }
            if (Object.keys(o).length === 3) throw new Error("nenhuma métrica enviada");
            if (o.nota != null && (o.nota < 0 || o.nota > 5)) throw new Error("nota deve ser de 0 a 5");
            if (o.online_min != null && o.previsto_min != null && o.online_min > o.previsto_min * 1.2) throw new Error("online_min maior que o tempo previsto");
            for (const k of [...ints, ...nums]) if (o[k] != null && o[k] < 0) throw new Error(`campo "${k}" negativo`);
            break; }
          case "pedidos": {
            const ext = r.id ?? r.externo_id ?? r.pedido;
            if (ext === undefined || ext === null || ext === "") throw new Error('campo "id" do pedido é obrigatório');
            o = { loja_id: lojaDe(r.loja ?? r.loja_id), origem: String(r.origem || `chave-${ch.id}`).slice(0, 60), externo_id: String(ext).slice(0, 120), data_hora: dataHora(r.data_hora ?? r.datahora ?? r.criado_em),
              canal: canalDe(r.canal), plataforma: r.plataforma ? String(r.plataforma).slice(0, 40) : null, valor: num(r.valor ?? r.total, "valor", true), itens: r.itens == null ? null : Math.round(num(r.itens, "itens")!), status: statusDe(r.status) };
            if (o.valor < 0) throw new Error("valor negativo");
            // data e hora são calculadas no banco (fuso de São Paulo); valores provisórios para a validação
            o.data = o.data_hora.slice(0, 10); o.hora = 0; break; }
          case "cmv": o = { loja_id: lojaDe(r.loja ?? r.loja_id), semana: segunda(data(r.semana ?? r.data, "semana")), vendas: num(r.vendas, "vendas", true), cmv_teorico: num(r.cmv_teorico, "cmv_teorico", true), estoque_inicial: num(r.estoque_inicial, "estoque_inicial") ?? 0, compras: num(r.compras, "compras") ?? 0, transf_entrada: num(r.transf_entrada, "transf_entrada") ?? 0, transf_saida: num(r.transf_saida, "transf_saida") ?? 0, devolucoes: num(r.devolucoes, "devolucoes") ?? 0, estoque_final: num(r.estoque_final, "estoque_final") ?? 0, responsavel: r.responsavel ? String(r.responsavel).slice(0, 120) : "Integração" };
            if (o.vendas <= 0) throw new Error("vendas deve ser maior que zero"); break;
        }
        ok.push(o);
      } catch (e) { erros.push({ linha: i + 1, erro: (e as Error).message }); }
    });

    let gravados = 0;
    if (ok.length) {
      const tab: Record<string, [string, string | null]> = { ifood: ["ifood_diario", "loja_id,data"], pedidos: ["pedidos_tempo_real", "origem,externo_id"], vendas: ["vendas_diarias", "loja_id,data"], vendas_hora: ["vendas_hora", "loja_id,data,hora"], rupturas: ["rupturas", null], delivery: ["delivery_checklists", null], indicadores: ["indicadores_mensais", "loja_id,mes"], cmv: ["cmv_contagens", "loja_id,semana"] };
      const [t, oc] = tab[recurso];
      let rows = ok;
      if (oc) { const k = (o: any) => oc.split(",").map((c) => o[c]).join("|"); rows = [...new Map(ok.map((o) => [k(o), o])).values()]; }
      const q = oc ? admin.from(t).upsert(rows, { onConflict: oc }) : admin.from(t).insert(rows);
      const { error } = await q;
      if (error) { await log(500, 0, error.message); return json({ erro: "Falha ao gravar: " + error.message }, 500); }
      gravados = rows.length;
    }
    const status = erros.length && !gravados ? 422 : 200;
    await log(status, gravados, erros.length ? JSON.stringify(erros.slice(0, 20)) : null);
    return json({ ok: gravados > 0, recurso, recebidos: itens.length, gravados, rejeitados: erros.length, erros: erros.slice(0, 100) }, status);
  } catch (e) {
    await log(500, 0, String((e as Error).message || e));
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
