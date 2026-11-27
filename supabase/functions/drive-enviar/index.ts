// Fat Buddha · envio das contagens e checklists para o Drive e o e-mail do Lucas (via Apps Script na conta dele)
// Disparo: pelo portal logo depois de salvar ({"acao":"enviar"}), agendado a cada 10 min (x-cron-secret) para reenviar a fila,
// e pelo administrador: {"acao":"status"} | {"acao":"teste"} | {"acao":"script"} | {"acao":"salvar", url, para} | {"acao":"reenviar"}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SCRIPT } from "./script.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PORTAL = "https://fat-buddha-portal.vercel.app";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fmt = (v: unknown) => typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : esc(v);
const MAX_TAB = 40;

function emailHtml(e: any, lojaNome: string) {
  const res = Object.entries(e.resumo || {}).map(([k, v]) => `<td style="padding:8px 12px;border:1px solid #eee;border-radius:8px"><div style="color:#8a7c72;font-size:11px;text-transform:uppercase;letter-spacing:.4px">${esc(k)}</div><b style="font-size:16px">${fmt(v)}</b></td>`).join("");
  const dest = (e.destaques || []).length ? `<p style="margin:16px 0 6px;font-weight:700;color:#b3261e">Pontos de atenção</p><ul style="margin:0;padding-left:18px">${e.destaques.map((d: string) => `<li style="margin:3px 0">${esc(d)}</li>`).join("")}</ul>` : "";
  let tab = "";
  if (e.tabela && e.linhas.length) {
    const cols: string[] = e.colunas;
    const ls = e.linhas.slice(0, MAX_TAB);
    tab = `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:16px"><tr>${cols.map((c) => `<th style="text-align:left;padding:6px 8px;background:#f6f1ec;border-bottom:1px solid #e5dbd2">${esc(c)}</th>`).join("")}</tr>${ls.map((l: unknown[]) => `<tr>${l.map((v) => `<td style="padding:6px 8px;border-bottom:1px solid #f0e8e1">${v === null || v === "" ? "—" : fmt(v)}</td>`).join("")}</tr>`).join("")}</table>${e.linhas.length > MAX_TAB ? `<p style="color:#8a7c72;font-size:12px">Mostrando ${MAX_TAB} de ${e.linhas.length} linhas. O restante está na planilha.</p>` : ""}`;
  }
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:760px;margin:auto;color:#1d1715">
  <div style="background:#140f0e;color:#f7eee6;padding:18px 22px;border-radius:14px 14px 0 0"><b style="font-size:17px">Fat Buddha · Portal Operacional</b><div style="color:#b9aa9e;font-size:13px">${esc(lojaNome)}</div></div>
  <div style="border:1px solid #eadfd6;border-top:0;border-radius:0 0 14px 14px;padding:18px 22px">
  <h2 style="font-size:18px;margin:0 0 4px">${esc(e.titulo)}</h2>
  <p style="color:#8a7c72;font-size:13px;margin:0 0 14px">Salvo ${e.autor ? "por " + esc(e.autor) + " " : ""}em ${new Date(e.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
  ${res ? `<table style="border-collapse:separate;border-spacing:6px;margin-left:-6px"><tr>${res}</tr></table>` : ""}
  ${dest}${tab}
  <p style="margin-top:20px"><a href="{{PLANILHA}}" style="background:#e5303f;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Abrir a planilha no Drive</a>
  <a href="${PORTAL}" style="margin-left:10px;color:#e5303f;font-weight:600;text-decoration:none">Abrir o portal</a></p></div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch { /* agendado */ }
  const acao = body.acao || "enviar";
  const hdr = req.headers.get("x-cron-secret");
  let cron = false, admin = false;
  if (hdr) { const { data: t } = await sb.from("cron_tokens").select("valor").eq("chave", "drive").maybeSingle(); cron = !!t && t.valor === hdr; }
  if (!cron) {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autorizado." }, 401);
    const { data: me } = await sb.from("perfis").select("papel,ativo").eq("user_id", u.user.id).single();
    if (!me?.ativo) return json({ erro: "Não autorizado." }, 403);
    admin = ["admin", "diretoria"].includes(me.papel);
    if (acao !== "enviar" && !admin) return json({ erro: "Apenas o administrador ou a diretoria." }, 403);
  }
  const { data: c } = await sb.from("config").select("valor").eq("chave", "drive_envio").maybeSingle();
  const cfg: any = c?.valor || {};
  const { data: sg } = await sb.from("cron_tokens").select("valor").eq("chave", "drive_segredo").maybeSingle();
  const segredo = sg?.valor || "";

  if (acao === "script") return json({ script: SCRIPT.replace("__SEGREDO__", segredo) });
  if (acao === "salvar") {
    const url = String(body.url || "").trim();
    if (url && !/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(url)) return json({ ok: false, erro: "O endereço precisa ser o do App da Web do Google, terminando em /exec." });
    const para = (Array.isArray(body.para) ? body.para : String(body.para || "").split(/[,;\s]+/)).map((s: string) => s.trim()).filter((s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    const valor = { ...cfg, url: url || null, para: para.length ? para : cfg.para, ativo: body.ativo ?? cfg.ativo ?? true };
    await sb.from("config").upsert({ chave: "drive_envio", valor });
    return json({ ok: true, config: valor });
  }
  if (acao === "status") {
    const { count: pend } = await sb.from("envios_drive").select("id", { count: "exact", head: true }).is("enviado_em", null);
    const { data: ult } = await sb.from("envios_drive").select("titulo,enviado_em,planilha_url").not("enviado_em", "is", null).order("enviado_em", { ascending: false }).limit(1).maybeSingle();
    const { data: err } = await sb.from("envios_drive").select("titulo,erro,tentativas").is("enviado_em", null).not("erro", "is", null).order("id", { ascending: false }).limit(1).maybeSingle();
    return json({ config: cfg, pendentes: pend || 0, ultimo: ult, erro: err });
  }
  if (!cfg.url) return json({ ok: false, motivo: "sem_url", mensagem: "O script do Google ainda não foi ligado: falta o endereço do App da Web." });
  if (cfg.ativo === false) return json({ ok: false, motivo: "desligado" });

  const post = async (payload: unknown) => {
    const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), redirect: "follow" });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { ok: false, erro: `Resposta inesperada do Google (${r.status}): ${t.slice(0, 160)}` }; }
  };

  if (acao === "teste") {
    const r = await post({ segredo, teste: true, email: { para: cfg.para, assunto: "Fat Buddha · teste do envio para o Drive", html: emailHtml({ titulo: "Teste do envio", resumo: { Situação: "funcionando" }, destaques: [], tabela: false, linhas: [], criado_em: new Date().toISOString() }, "Portal Operacional") } });
    return json(r);
  }
  if (acao === "reenviar") await sb.from("envios_drive").update({ tentativas: 0, erro: null }).is("enviado_em", null);

  const { data: lj } = await sb.from("lojas").select("id,nome");
  const lojas = Object.fromEntries((lj || []).map((l) => [l.id, l.nome]));
  const { data: fila } = await sb.from("envios_drive").select("*").is("enviado_em", null).lt("tentativas", 12).order("id").limit(15);
  let enviados = 0, falhas = 0;
  for (const e of fila || []) {
    // trava simples: marca a tentativa antes de enviar, para dois disparos ao mesmo tempo não mandarem o mesmo item
    const { data: tr } = await sb.from("envios_drive").update({ tentativas: e.tentativas + 1 }).eq("id", e.id).eq("tentativas", e.tentativas).is("enviado_em", null).select("id");
    if (!tr?.length) continue;
    const lojaNome = e.loja_id ? (lojas[e.loja_id] || e.loja_id) : "Cozinha central";
    const r = await post({ segredo, ref: e.ref, aba: e.aba, mes: e.mes, colunas: e.colunas, linhas: e.linhas,
      email: cfg.para?.length ? { para: cfg.para, assunto: `Fat Buddha · ${e.titulo}`, html: emailHtml(e, lojaNome) } : null });
    if (r?.ok) { enviados++; await sb.from("envios_drive").update({ enviado_em: new Date().toISOString(), erro: null, planilha_url: r.url || null }).eq("id", e.id); }
    else { falhas++; await sb.from("envios_drive").update({ erro: String(r?.erro || "falha").slice(0, 500) }).eq("id", e.id); }
  }
  return json({ ok: true, enviados, falhas });
});
