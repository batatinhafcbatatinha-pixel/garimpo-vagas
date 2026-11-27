// Atualização automática no modo local: de quanto em quanto tempo o site aperta "Atualizar vagas"
// sozinho (enquanto a página estiver aberta) e se o F5 refaz a coleta. Funciona no navegador e no Node.
(function (root) {
  // horas; 0 = desligado
  const OPTIONS = [
    { hours: 0, label: 'Desligado' },
    { hours: 1, label: 'A cada 1 h' },
    { hours: 3, label: 'A cada 3 h' },
    { hours: 6, label: 'A cada 6 h' },
    { hours: 12, label: 'A cada 12 h' },
    { hours: 24, label: 'A cada 24 h' },
  ];
  const valid = (h) => OPTIONS.some((o) => o.hours === Number(h));

  // Quantos ms faltam para a próxima atualização automática (0 = já passou da hora),
  // ou null se está desligada. Conta a partir da última atualização ou da última tentativa,
  // o que for mais recente, para não repetir sem parar quando a atualização falha.
  function autoRefreshDelay(hours, lastUpdate, lastAttempt, now) {
    const h = Number(hours);
    if (!h || !valid(h)) return null;
    const times = [lastUpdate, lastAttempt].map((t) => (t ? +new Date(t) : NaN)).filter((t) => !isNaN(t));
    if (!times.length) return 0;
    const due = Math.max.apply(null, times) + h * 3600e3;
    return Math.max(0, due - (now == null ? Date.now() : +new Date(now)));
  }

  // "F5 refaz a coleta": só recarregar a página de verdade (não abrir pela primeira vez, nem
  // voltar/avançar) dispara a coleta, e só se a opção estiver ligada e nada estiver rodando.
  // `navType` é performance.getEntriesByType('navigation')[0].type.
  function refreshOnReload(enabled, navType, running) {
    return !!enabled && navType === 'reload' && !running;
  }

  const api = { OPTIONS, valid, autoRefreshDelay, refreshOnReload };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoRefresh = api;
})(typeof window !== 'undefined' ? window : globalThis);
