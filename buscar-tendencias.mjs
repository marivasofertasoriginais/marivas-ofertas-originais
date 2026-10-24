const url = "https://api.mercadolibre.com/trends/MLB";

const resposta = await fetch(url, {
  headers: {
    "User-Agent": "MarivasOfertasHub/1.0",
    "Accept": "application/json"
  }
});

console.log("Status da API:", resposta.status);

const texto = await resposta.text();

if (!resposta.ok) {
  console.error("Resposta:", texto);
  process.exit(1);
}

const tendencias = JSON.parse(texto);

console.log("TENDÊNCIAS DO MERCADO LIVRE:");

for (const item of tendencias) {
  console.log("-", item.keyword);
}
