import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PAPEIS = ["admin", "consultor", "diretoria", "regional", "gerente", "colaborador"];
const TOTAL = ["admin", "diretoria"];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u.user) return json({ error: "Sessão inválida." }, 401);
    const { data: me } = await admin.from("perfis").select("papel,ativo").eq("user_id", u.user.id).single();
    if (!me || !TOTAL.includes(me.papel) || !me.ativo) return json({ error: "Apenas o administrador ou a diretoria gerencia usuários." }, 403);

    const body = await req.json();
    const acao = body.acao;

    if (acao === "listar") {
      const { data: ps } = await admin.from("perfis").select("user_id,nome,email,papel,ativo,created_at").order("created_at");
      const { data: pl } = await admin.from("perfil_lojas").select("user_id,loja_id");
      return json({ usuarios: (ps || []).map((p) => ({ ...p, lojas: (pl || []).filter((x) => x.user_id === p.user_id).map((x) => x.loja_id) })) });
    }

    const setLojas = async (uid: string, lojas: string[]) => {
      await admin.from("perfil_lojas").delete().eq("user_id", uid);
      if (lojas?.length) {
        const { error } = await admin.from("perfil_lojas").insert(lojas.map((l) => ({ user_id: uid, loja_id: l })));
        if (error) throw error;
      }
    };

    if (acao === "criar") {
      const { email, senha, nome, papel, lojas } = body;
      if (!email || !senha || senha.length < 8) return json({ error: "Informe e-mail e senha com pelo menos 8 caracteres." }, 400);
      if (!PAPEIS.includes(papel)) return json({ error: "Perfil inválido." }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome }, app_metadata: { papel },
      });
      if (error) return json({ error: error.message }, 400);
      const uid = data.user!.id;
      await admin.from("perfis").upsert({ user_id: uid, nome, email, papel, ativo: true });
      await setLojas(uid, lojas || []);
      return json({ ok: true, user_id: uid });
    }

    if (acao === "atualizar") {
      const { user_id, nome, papel, ativo, lojas, senha } = body;
      if (!user_id) return json({ error: "Usuário não informado." }, 400);
      if (papel && !PAPEIS.includes(papel)) return json({ error: "Perfil inválido." }, 400);
      if (user_id === u.user.id && ((papel !== undefined && !TOTAL.includes(papel)) || ativo === false)) return json({ error: "Você não pode retirar o seu próprio acesso total." }, 400);
      const upd: Record<string, unknown> = {};
      if (nome !== undefined) upd.nome = nome;
      if (papel !== undefined) upd.papel = papel;
      if (ativo !== undefined) upd.ativo = ativo;
      if (Object.keys(upd).length) { const { error } = await admin.from("perfis").update(upd).eq("user_id", user_id); if (error) return json({ error: error.message }, 400); }
      if (lojas) await setLojas(user_id, lojas);
      if (senha) {
        if (senha.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
        const { error } = await admin.auth.admin.updateUserById(user_id, { password: senha });
        if (error) return json({ error: error.message }, 400);
      }
      if (ativo === false) await admin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
      if (ativo === true) await admin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
