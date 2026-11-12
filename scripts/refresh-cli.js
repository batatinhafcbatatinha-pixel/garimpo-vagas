// Atualiza as vagas pelo terminal (mesma coisa que o botão do site).
const { refresh, getStatus } = require('../lib/refresh');

const timer = setInterval(() => {
  console.log(getStatus().sources.map((s) => `${s.name}: ${s.status} ${s.message}`).join(' | '));
}, 5000);

refresh().then((st) => {
  clearInterval(timer);
  for (const s of st.sources) console.log(`${s.name.padEnd(10)} ${s.status.padEnd(10)} ${String(s.count).padStart(4)} vagas  ${s.message}`);
});
