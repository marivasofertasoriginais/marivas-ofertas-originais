const url = "https://api.mercadolibre.com/trends/MLB";

const resposta = await fetch(url);

if (!resposta.ok) {
  throw new Error(`Erro na API: ${resposta.status}`);
}

const tendencias = await resposta.json();

console.log("TENDÊNCIAS DO MERCADO LIVRE:");

for (const item of tendencias) {
  console.log(`- ${item.keyword}`);
}
