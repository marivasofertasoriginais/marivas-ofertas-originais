// Processador externo da FilaPublicacao.
// MODO DE TESTE: apenas consulta a fila; não publica nem altera registros.

import { createClient } from "@base44/sdk";

const APP_ID = process.env.APP_ID;
const BOT_EMAIL = process.env.BOT_EMAIL;
const BOT_PASSWORD = process.env.BOT_PASSWORD;

if (!APP_ID || !BOT_EMAIL || !BOT_PASSWORD) {
  console.error(
    "Defina APP_ID, BOT_EMAIL e BOT_PASSWORD nos Secrets do GitHub."
  );
  process.exit(1);
}

const base44 = createClient({ appId: APP_ID });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  await base44.auth.loginViaEmailPassword(BOT_EMAIL, BOT_PASSWORD);
  log("Autenticacao realizada.");

  const agora = new Date();
  const itens = await base44.entities.FilaPublicacao.list(
    "-data_hora",
    200
  );

  const devidos = itens.filter((item) => {
    if (
      item.status === "pendente" &&
      item.data_hora &&
      new Date(item.data_hora) <= agora
    ) {
      return true;
    }

    if (
      item.status === "falhou" &&
      (item.tentativas || 0) < (item.max_tentativas || 3)
    ) {
      const proxima = item.proxima_tentativa
        ? new Date(item.proxima_tentativa)
        : null;

      return !proxima || proxima <= agora;
    }

    return false;
  });

  log(`Itens encontrados na fila: ${itens.length}`);
  log(`Itens vencidos ou prontos para nova tentativa: ${devidos.length}`);

  for (const item of devidos) {
    log(
      `TESTE — item ${item.id}; canal: ${item.canal}; status: ${item.status}`
    );
  }

  log("Teste concluido. Nenhum registro foi alterado.");
  log("Nenhuma mensagem foi enviada ao WhatsApp.");

  return {
    itensNaFila: itens.length,
    itensDevidos: devidos.length,
    modo: "teste",
  };
}

main().catch((err) => {
  console.error("Erro na execucao:", err?.message || err);
  process.exit(1);
});
