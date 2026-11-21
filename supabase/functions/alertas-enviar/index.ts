// Fat Buddha · envio de alertas por e-mail (resumo por destinatário)
// Disparo: agendado (cabeçalho x-cron-secret) ou pelo administrador no portal ({"acao":"teste"} | {"acao":"status"}).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PORTAL = "https://fat-buddha-portal.vercel.app";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function html(nome: string, itens: any[], lojas: Record<string, string>) {
  const linhas = itens.map((a) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${a.nivel === "critico" ? "#e5303f" : "#f2b33d"};margin-right:8px"></span><b>${esc(lojas[a.loja_id] || a.loja_id)}</b> · ${esc(a.titulo)}<div style="color:#8a7c72;font-size:12px;margin-top:3px">${esc(a.detalhe || "")}</div></td></tr>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px;margin:auto;color:#1d1715">
  <div style="background:#140f0e;color:#f7eee6;padding:18px 22px;border-radius:14px 14px 0 0"><b style="font-size:17px">Fat Buddha · Portal Operacional</b><div style="color:#b9aa9e;font-size:13px">Alertas de indicadores</div></div>
  <div style="border:1px solid #eadfd6;border-top:0;border-radius:0 0 14px 14px;padding:18px 22px">
  <p>Olá, ${esc(nome)}. ${itens.length === 1 ? "Há 1 novo alerta" : `Há ${itens.length} novos alertas`} nas lojas que você acompanha:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${linhas}</table>
  <p style="margin-top:18px"><a href="${PORTAL}" style="background:#e5303f;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Abrir o portal</a></p>
  <p style="color:#8a7c72;font-size:12px;margin-top:18px">Você recebe este e-mail porque os alertas por e-mail estão ligados no seu perfil. Para desligar, abra o sino de alertas no portal.</p></div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const KEY = Deno.env.get("RESEND_API_KEY") || "";
  let body: any = {}; try { body = await req.json(); } catch { /* agendado sem corpo */ }
  const hdr = req.headers.get("x-cron-secret");
  let cron = false;
  if (hdr) { const { data: t } = await sb.from("cron_tokens").select("valor").eq("chave", "alertas").maybeSingle(); cron = !!t && t.valor === hdr; }
  let adminEmail: string | null = null, adminNome = "";
  if (!cron) {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autorizado." }, 401);
    const { data: me } = await sb.from("perfis").select("papel,ativo,email,nome").eq("user_id", u.user.id).single();
    if (!me || me.papel !== "admin" || !me.ativo) return json({ erro: "Apenas o administrador." }, 403);
    adminEmail = me.email; adminNome = me.nome || "";
  }
  const { data: cfg } = await sb.from("config").select("valor").eq("chave", "alertas_email").maybeSingle();
  const remetente = (cfg?.valor as any)?.remetente || "Fat Buddha <onboarding@resend.dev>";
  if (body.acao === "status") return json({ chave_configurada: !!KEY, remetente });
  if (!KEY) return json({ ok: false, motivo: "sem_chave", mensagem: "Envio por e-mail desligado: falta a chave do Resend (RESEND_API_KEY)." });

  const enviar = async (to: string, subject: string, h: string) => {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: remetente, to: [to], subject, html: h }) });
    return r.ok ? null : await r.text();
  };
  const { data: lj } = await sb.from("lojas").select("id,nome");
  const lojas = Object.fromEntries((lj || []).map((l) => [l.id, l.nome]));

  if (body.acao === "teste") {
    const err = await enviar(adminEmail!, "Fat Buddha · teste de alertas", html(adminNome, [{ nivel: "atencao", loja_id: "brooklyn", titulo: "E-mail de teste dos alertas", detalhe: "Se você recebeu esta mensagem, o envio está funcionando." }], lojas));
    return json(err ? { ok: false, erro: err } : { ok: true, para: adminEmail });
  }

  await sb.rpc("gerar_alertas");
  const { data: al } = await sb.from("alertas").select("*").is("enviado_em", null).eq("resolvido", false).gte("criado_em", new Date(Date.now() - 3 * 864e5).toISOString()).order("nivel").order("criado_em");
  if (!al?.length) return json({ ok: true, enviados: 0 });
  const { data: ps } = await sb.from("perfis").select("user_id,nome,email,papel,ativo,alerta_email").eq("ativo", true).eq("alerta_email", true);
  const { data: pl } = await sb.from("perfil_lojas").select("user_id,loja_id");
  let enviados = 0; const falhas: string[] = [];
  for (const p of ps || []) {
    if (!p.email || !["admin", "consultor", "regional", "gerente"].includes(p.papel)) continue;
    const minhas = (pl || []).filter((x) => x.user_id === p.user_id).map((x) => x.loja_id);
    const itens = al.filter((a) => ["admin", "consultor"].includes(p.papel) || minhas.includes(a.loja_id));
    if (!itens.length) continue;
    const crit = itens.filter((a) => a.nivel === "critico").length;
    const err = await enviar(p.email, `Fat Buddha · ${itens.length} alerta${itens.length > 1 ? "s" : ""}${crit ? ` (${crit} crítico${crit > 1 ? "s" : ""})` : ""}`, html(p.nome || "", itens, lojas));
    if (err) falhas.push(`${p.email}: ${err.slice(0, 200)}`); else enviados++;
  }
  await sb.from("alertas").update({ enviado_em: new Date().toISOString() }).in("id", al.map((a) => a.id));
  return json({ ok: true, alertas: al.length, enviados, falhas });
});
