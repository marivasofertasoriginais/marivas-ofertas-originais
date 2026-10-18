// Processador externo da FilaPublicacao — executa FORA do navegador.
// Não altera o app; apenas consome a mesma lógica do src/lib/filaPublicacao.js
// via SDK autenticado por usuário. Compatível com o plano gratuito.
//
// Uso:
// 1) npm install @base44/sdk
// 2) export APP_ID="..." BOT_EMAIL="bot@marivas.com" BOT_PASSWORD="..."
// 3) node scripts/processar-fila-externa.mjs
//
// Agende com cron externo gratuito (GitHub Actions, Render, cron-job.org...).
// Coexiste com o processarFila do navegador: ambos respeitam o soft-lock
// "enviando", então não há duplicação.

import { createClient } from "@base44/sdk";

const APP_ID = process.env.APP_ID;
const BOT_EMAIL = process.env.BOT_EMAIL;
const BOT_PASSWORD = process.env.BOT_PASSWORD;

if (!APP_ID || !BOT_EMAIL || !BOT_PASSWORD) {
console.error("Defina APP_ID, BOT_EMAIL e BOT_PASSWORD.");
process.exit(1);
}

const MAX_TENTATIVAS = 3;
const INTERVALO_RETRY_MIN = 5;

const base44 = createClient({ appId: APP_ID });

function log(msg) {
console.log("[" + new Date().toISOString() + "] " + msg);
}

// "Publicação" no-op — espelha o canal "teste" do app. Troque por chamada real
// quando houver integração externa configurada.
async function publicar(canal, texto) {
log(`publicar(${canal}): ${texto?.slice(0, 60)}...`);
return { ok: true, canal, texto, simulado: true };
}

async function enviarItem(item) {
// soft-lock para evitar corrida com o navegador
await base44.entities.FilaPublicacao.update(item.id, { status: "enviando" });
try {
const res = await publicar(item.canal, item.texto || "");
if (!res?.ok) throw new Error(res?.erro || "Falha no envio");

await base44.entities.FilaPublicacao.update(item.id, {
  status: "enviado",
  enviado_em: new Date().toISOString(),
  erro: "",
});
await base44.entities.Publicacao.create({
  produto: item.produto_nome,
  marketplace: item.marketplace,
  preco: item.preco,
  cupom: item.cupom,
  link: item.link,
  texto: item.texto,
  canais: [item.canal],
  status: "publicada",
});
if (item.agendamento_id) {
  await base44.entities.Agendamento.update(item.agendamento_id, {
    status: "publicada",
    publicada_em: new Date().toISOString(),
  }).catch(() => {});
}
if (item.oferta_id) {
  await base44.entities.Oferta.update(item.oferta_id, {
    status: "publicada",
    publicada_em: new Date().toISOString(),
  }).catch(() => {});
}
await base44.entities.Historico.create({
  oferta_id: item.oferta_id || item.agendamento_id,
  oferta_titulo: item.produto_nome,
  acao: "publicada",
  detalhe: `Enviado para ${item.canal} via fila externa`,
}).catch(() => {});
return { ok: true };


} catch (err) {
const tentativas = (item.tentativas || 0) + 1;
const max = item.max_tentativas || MAX_TENTATIVAS;
const aindaRetry = tentativas < max;
const proxima = aindaRetry
? new Date(Date.now() + INTERVALO_RETRY_MIN * 60000).toISOString()
: null;
await base44.entities.FilaPublicacao.update(item.id, {
status: "falhou",
tentativas,
erro: String(err?.message || err),
proxima_tentativa: proxima,
});
if (!aindaRetry && item.agendamento_id) {
await base44.entities.Agendamento.update(item.agendamento_id, {
status: "falhou",
}).catch(() => {});
}
if (!aindaRetry && item.oferta_id) {
await base44.entities.Oferta.update(item.oferta_id, { status: "erro" }).catch(() => {});
await base44.entities.Historico.create({
oferta_id: item.oferta_id,
oferta_titulo: item.produto_nome,
acao: "erro",
detalhe: Falha no envio para ${item.canal}: ${String(err?.message || err)},
}).catch(() => {});
}
return { ok: false, erro: err?.message || String(err) };
}
}

async function main() {
await base44.auth.loginViaEmailPassword(BOT_EMAIL, BOT_PASSWORD);
log("Autenticado.");

const agora = new Date();
const itens = await base44.entities.FilaPublicacao.list("-data_hora", 200);

const devidos = itens.filter((i) => {
if (i.status === "pendente" && i.data_hora && new Date(i.data_hora) <= agora) return true;
if (i.status === "falhou" && (i.tentativas || 0) < (i.max_tentativas || MAX_TENTATIVAS)) {
const prox = i.proxima_tentativa ? new Date(i.proxima_tentativa) : null;
if (!prox || prox <= agora) return true;
}
return false;
});

log(Devidos: ${devidos.length});
let sucessos = 0;
let falhas = 0;
for (const item of devidos) {
const res = await enviarItem(item);
if (res?.ok) sucessos++;
else falhas++;
}
log(Concluído — sucessos: ${sucessos}, falhas: ${falhas});
return { processados: devidos.length, sucessos, falhas };
}

main().catch((e) => {
console.error("Erro fatal:", e?.message || e);
process.exit(1);
});
