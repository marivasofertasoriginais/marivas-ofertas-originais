
const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error("Faltam ML_CLIENT_ID ou ML_CLIENT_SECRET nos segredos do GitHub.");
}

const respostaToken = await fetch("https://api.mercadolibre.com/oauth/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json"
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  })
});

const tokenData = await respostaToken.json();

if (!respostaToken.ok || !tokenData.access_token) {
  console.error("Não foi possível obter o token:", tokenData.error || tokenData.message || respostaToken.status);
  process.exit(1);
}

const resposta = await fetch("https://api.mercadolibre.com/trends/MLB", {
  headers: {
    "Authorization": `Bearer ${tokenData.access_token}`,
    "Accept": "application/json"
  }
});

console.log("Status da API de tendências:", resposta.status);

if (!resposta.ok) {
  console.error("Falha ao consultar tendências:", await resposta.text());
  process.exit(1);
}

const tendencias = await resposta.json();

console.log("TENDÊNCIAS DO MERCADO LIVRE:");

for (const item of tendencias) {
  console.log("-", item.keyword);
}
