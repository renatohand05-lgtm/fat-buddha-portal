// Fat Buddha · notas do Google (Places API New)
// Disparo: agendado todo dia (cabeçalho x-cron-secret) ou pelo portal (gestão).
// Ações: status | chave {key} | buscar {loja_id, q?} | vincular {loja_id, place_id} | desvincular {loja_id} | atualizar {loja_id?}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const API = "https://places.googleapis.com/v1";
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function google(key: string, path: string, mask: string, body?: unknown) {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((t as any)?.error?.message || `Google respondeu ${r.status}`);
  return t as any;
}
const buscar = (key: string, q: string) =>
  google(key, "/places:searchText", "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri",
    { textQuery: q, languageCode: "pt-BR", regionCode: "BR", pageSize: 5 }).then((d) => (d.places || []).map((p: any) => ({
      id: p.id, nome: p.displayName?.text || "", endereco: p.formattedAddress || "", nota: p.rating ?? null, total: p.userRatingCount ?? 0, uri: p.googleMapsUri || null })));
const detalhes = (key: string, id: string) =>
  google(key, `/places/${encodeURIComponent(id)}?languageCode=pt-BR&regionCode=BR`, "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any = {}; try { body = await req.json(); } catch { /* sem corpo */ }
  const acao = body.acao || "atualizar";

  // autorização: agendamento (segredo) ou usuário da gestão
  const hdr = req.headers.get("x-cron-secret");
  let cron = false, uid: string | null = null, papel = "";
  if (hdr) { const { data: t } = await sb.from("cron_tokens").select("valor").eq("chave", "google").maybeSingle(); cron = !!t && t.valor === hdr; }
  if (!cron) {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ erro: "Não autorizado." }, 401);
    const { data: me } = await sb.from("perfis").select("papel,ativo").eq("user_id", u.user.id).single();
    if (!me?.ativo) return json({ erro: "Usuário inativo." }, 403);
    uid = u.user.id; papel = me.papel;
    const gestor = ["admin", "consultor", "diretoria"].includes(papel);
    if (acao !== "status" && !gestor) return json({ erro: "Apenas administrador, consultor ou diretoria." }, 403);
    if (acao === "chave" && !["admin", "diretoria"].includes(papel)) return json({ erro: "Apenas o administrador ou a diretoria cadastra a chave." }, 403);
  }

  const { data: seg } = await sb.from("segredos").select("valor,atualizado_em").eq("chave", "google_places").maybeSingle();
  let KEY = Deno.env.get("GOOGLE_PLACES_KEY") || seg?.valor || "";

  if (acao === "status") {
    const { data: ult } = await sb.from("config").select("valor").eq("chave", "google_ultima").maybeSingle();
    return json({ chave: !!KEY, desde: seg?.atualizado_em || null, ultima: ult?.valor || null });
  }

  if (acao === "chave") {
    const k = String(body.key || "").trim();
    if (!k) { await sb.from("segredos").delete().eq("chave", "google_places"); return json({ ok: true, removida: true }); }
    try { await buscar(k, "Fat Buddha São Paulo"); } catch (e) { return json({ ok: false, erro: "A chave não funcionou: " + (e as Error).message }); }
    await sb.from("segredos").upsert({ chave: "google_places", valor: k, atualizado_em: new Date().toISOString(), atualizado_por: uid });
    KEY = k;
    body.auto = true; // segue para vincular automaticamente e atualizar
  }

  if (!KEY) return json({ ok: false, motivo: "sem_chave", mensagem: "Falta a chave da API do Google (Places API)." });

  try {
    if (acao === "buscar") {
      const { data: l } = await sb.from("lojas").select("nome").eq("id", body.loja_id).single();
      return json({ ok: true, resultados: await buscar(KEY, body.q || `Fat Buddha ${l?.nome || ""} São Paulo`) });
    }
    if (acao === "desvincular") {
      await sb.from("lojas").update({ google_place_id: null, google_nome: null, google_endereco: null, google_uri: null }).eq("id", body.loja_id);
      await sb.from("google_reviews").delete().eq("loja_id", body.loja_id);
      return json({ ok: true });
    }
    if (acao === "vincular") {
      const d = await detalhes(KEY, body.place_id);
      await sb.from("lojas").update({ google_place_id: d.id, google_nome: d.displayName?.text || null, google_endereco: d.formattedAddress || null, google_uri: d.googleMapsUri || null }).eq("id", body.loja_id);
      body.loja_id_unica = body.loja_id;
    }

    // vínculo automático das lojas sem local no Google (após cadastrar a chave)
    const vinculadas: string[] = [];
    if (body.auto) {
      const { data: sem } = await sb.from("lojas").select("id,nome,status").is("google_place_id", null);
      for (const l of sem || []) {
        const rs = await buscar(KEY, `Fat Buddha ${l.nome} São Paulo`).catch(() => []);
        const p = rs.find((r: any) => /fat\s*buddha/i.test(r.nome) && r.total > 0);
        if (p) { await sb.from("lojas").update({ google_place_id: p.id, google_nome: p.nome, google_endereco: p.endereco, google_uri: p.uri }).eq("id", l.id); vinculadas.push(l.nome); }
      }
    }

    // atualizar: nota, total e avaliações recentes
    let q = sb.from("lojas").select("id,nome,google_place_id").not("google_place_id", "is", null);
    const so = body.loja_id_unica || (acao === "atualizar" ? body.loja_id : null);
    if (so) q = q.eq("id", so);
    const { data: lojas } = await q;
    const hoje = hojeSP(), res: any[] = [];
    for (const l of lojas || []) {
      try {
        const d = await detalhes(KEY, l.google_place_id);
        const { data: ja } = await sb.from("google_notas").select("fonte").eq("loja_id", l.id).eq("data", hoje).maybeSingle();
        if (d.rating != null && ja?.fonte !== "manual") {
          await sb.from("google_notas").upsert({ loja_id: l.id, data: hoje, nota: Math.round(d.rating * 10) / 10, total: d.userRatingCount ?? 0, fonte: "google", created_by: null }, { onConflict: "loja_id,data" });
        }
        await sb.from("lojas").update({ google_nome: d.displayName?.text || null, google_endereco: d.formattedAddress || null, google_uri: d.googleMapsUri || null }).eq("id", l.id);
        const revs = (d.reviews || []).map((r: any) => ({
          id: r.name, loja_id: l.id, nota: r.rating, autor: r.authorAttribution?.displayName || null,
          texto: r.originalText?.text ?? r.text?.text ?? null, publicado_em: r.publishTime || null,
          relativo: r.relativePublishTimeDescription || null, uri: r.googleMapsUri || r.authorAttribution?.uri || null, atualizado_em: new Date().toISOString(),
        })).filter((r: any) => r.id && r.nota);
        // as avaliações são renovadas a cada atualização: fica só o que o Google mostra hoje
        const ids = revs.map((r: any) => r.id);
        let del = sb.from("google_reviews").delete().eq("loja_id", l.id).like("id", "places/%"); // não apaga as lidas do Maps à mão
        if (ids.length) del = del.not("id", "in", `(${ids.map((i: string) => `"${i}"`).join(",")})`);
        await del;
        if (revs.length) await sb.from("google_reviews").upsert(revs, { onConflict: "id", ignoreDuplicates: false });
        res.push({ loja: l.nome, nota: d.rating ?? null, total: d.userRatingCount ?? 0, avaliacoes: revs.length });
      } catch (e) { res.push({ loja: l.nome, erro: (e as Error).message }); }
    }
    await sb.from("config").upsert({ chave: "google_ultima", valor: { em: new Date().toISOString(), por: cron ? "agendamento" : "portal", lojas: res.length } });
    await sb.rpc("gerar_alertas");
    return json({ ok: true, vinculadas, lojas: res });
  } catch (e) {
    return json({ ok: false, erro: (e as Error).message });
  }
});
