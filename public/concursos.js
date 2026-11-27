// Aba "Concursos": concursos públicos, processos seletivos e estágios em órgãos públicos na área de TI.
// Usa os utilitários globais definidos em index.html ($, esc, safeUrl, store, Applied, Hidden, actions) e JobSearch.norm.
(function () {
  var norm = JobSearch.norm;
  var DEFAULTS = { q: '', regiao: ['poa', 'rs'], tipo: ['concurso', 'processo-seletivo', 'estagio', 'aprendiz'], fonte: null, soTi: true, semSuperior: true, comSalario: false, soNovas: false, sort: 'prazo' };
  var F = Object.assign({}, DEFAULTS, store.get('garimpo.concursos', {}));
  var ALL = [];
  var previousUpdate = null;
  var shown = 40;

  var SRC = { pci: 'PCI Concursos', poa: 'Prefeitura POA', cieers: 'CIEE-RS', ciee: 'CIEE nacional' };
  var TIPO = { concurso: 'Concurso', 'processo-seletivo': 'Processo seletivo', estagio: 'Estágio', residencia: 'Residência', aprendiz: 'Aprendiz' };
  var DAY = 864e5;

  function regiaoOf(c) { return c.isPoa ? 'poa' : c.isRs ? 'rs' : 'outro'; }
  function tipoOf(c) { return c.tipo === 'residencia' ? 'estagio' : c.tipo; }
  function isNew(c) { return previousUpdate && c.firstSeen > previousUpdate; }
  function daysLeft(c) { return c.inscricaoAte ? Math.ceil((new Date(c.inscricaoAte) - Date.now()) / DAY) : null; }
  // prazo vencido depois da última atualização: some da lista mesmo antes de atualizar de novo
  function closed(c) { return c.situacao === 'encerrada' || (c.inscricaoAte && new Date(c.inscricaoAte).getTime() + DAY < Date.now()); }

  function passes(c, terms, skip) {
    if (closed(c)) return false;
    if (Applied.has(c.id) || Hidden.has(c.id)) return false; // só aparece nas abas Candidaturas / Escondidas
    for (var i = 0; i < terms.length; i++) if (c._text.indexOf(terms[i]) === -1) return false;
    if (skip !== 'regiao' && F.regiao.indexOf(c._regiao) === -1) return false;
    if (skip !== 'tipo' && F.tipo.indexOf(c._tipo) === -1) return false;
    if (skip !== 'fonte' && F.fonte && F.fonte.indexOf(c.source) === -1) return false;
    if (F.soTi && !c.ti) return false;
    if (F.semSuperior && !c.semSuperior) return false;
    if (F.comSalario && !c.salary.informado) return false;
    if (F.soNovas && !isNew(c)) return false;
    return true;
  }

  function sortList(a) {
    var far = 8.64e15;
    var end = function (c) { return c.inscricaoAte ? +new Date(c.inscricaoAte) : far; };
    if (F.sort === 'salario') return a.sort(function (x, y) { return (y.salary.max || 0) - (x.salary.max || 0) || end(x) - end(y); });
    if (F.sort === 'novas') return a.sort(function (x, y) { return isNew(y) - isNew(x) || end(x) - end(y); });
    return a.sort(function (x, y) { return end(x) - end(y); });
  }

  function fmtDate(iso) { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }); }

  function prazoTag(c) {
    var d = daysLeft(c);
    if (c.situacao === 'em-breve' && c.inscricaoDe) return '<span class="tag info">Abre em ' + fmtDate(c.inscricaoDe) + (c.inscricaoAte ? ' · até ' + fmtDate(c.inscricaoAte) : '') + '</span>';
    if (d === null) return '<span class="tag">' + (c.situacao === 'em-andamento' ? 'Em andamento' : c.situacao === 'aberta' ? 'Inscrições abertas' : 'Prazo não informado') + '</span>';
    if (d < 0) return '<span class="tag">Inscrições encerradas em ' + fmtDate(c.inscricaoAte) + '</span>';
    var quando = d <= 0 ? 'último dia' : d === 1 ? 'falta 1 dia' : 'faltam ' + d + ' dias';
    return '<span class="tag ' + (d <= 5 ? 'bad' : d <= 15 ? 'warn' : 'good') + '">Inscrições até ' + fmtDate(c.inscricaoAte) + ' · ' + quando + '</span>';
  }

  function card(c) {
    var niveis = [c.niveis.fundamental && 'Fundamental', c.niveis.medio && 'Médio', c.niveis.tecnico && 'Técnico', c.niveis.superior && 'Superior'].filter(Boolean).join(' / ');
    var tiList = (c.cargosTi && c.cargosTi.length ? c.cargosTi : c.cursosTi || []);
    var local = c.city ? c.city + ' · ' + c.uf : c.uf === 'BR' ? 'UF não informada' : c.uf;
    var done = Applied.has(c.id);
    var hid = Hidden.has(c.id);
    var tags = [
      done ? '<span class="tag done">Inscrição marcada em ' + Applied.day(c.id) + '</span>' : '',
      hid ? '<span class="tag done">Escondido em ' + Hidden.day(c.id) + '</span>' : '',
      isNew(c) ? '<span class="tag new">Novo</span>' : '',
      prazoTag(c),
      c.salary.informado ? '<span class="tag money">até ' + esc(c.salary.texto) + '</span>' : '',
      '<span class="tag">' + (TIPO[c.tipo] || 'Concurso') + '</span>',
      c.ti ? '<span class="tag info">Área de TI</span>' : '<span class="tag">TI não confirmada</span>',
      niveis ? '<span class="tag ' + (c.semSuperior ? 'good' : 'bad') + '">' + niveis + '</span>' : '<span class="tag">Escolaridade no edital</span>',
      c.vagasText ? '<span class="tag">' + esc(c.vagasText) + '</span>' : '',
      '<span class="tag src-c">' + SRC[c.source] + '</span>',
      actions(c.id, 'Já me inscrevi'),
    ].join('');
    var first = (c.title || '?').replace(/^(prefeitura|c[aâ]mara|munic[ií]pio)\s+(municipal\s+)?(de\s+vereadores\s+)?(de\s+|do\s+|da\s+)?/i, '')[0] || '?';
    var logo = c.logo && /^https:\/\//.test(c.logo)
      ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      : esc(first.toUpperCase());
    return '<article class="job' + (done || hid ? ' applied' : '') + '">' +
      '<div class="logo">' + logo + '</div>' +
      '<h3><a href="' + esc(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(c.title) + '</a></h3>' +
      '<div class="when">' + esc(local) + '</div>' +
      '<div class="meta"><b>' + esc(c.cargos || 'Vários cargos') + '</b></div>' +
      '<div class="tags">' + tags + '</div>' +
      '<details class="more"><summary>Detalhes</summary>' +
        (tiList.length ? '<p class="edu"><b>' + (c.cursosTi && c.cursosTi.length ? 'Cursos de TI aceitos' : 'Cargos de TI encontrados') + ':</b> ' + esc(tiList.join(', ')) + '</p>' : '') +
        (c.chamada ? '<p class="desc">' + esc(c.chamada) + '</p>' : '') +
        (c.description ? '<p class="desc">' + esc(c.description) + '</p>' : '') +
        (c.source === 'pci' ? '<p class="desc">A escolaridade e o salário acima valem para o concurso inteiro; confira no edital os requisitos do cargo de TI.</p>' : '') +
        '<a class="open" href="' + esc(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">Abrir no ' + SRC[c.source] + ' ↗</a>' +
        (c.editalUrl ? ' &nbsp; <a class="open" href="' + esc(safeUrl(c.editalUrl)) + '" target="_blank" rel="noopener noreferrer">Edital de abertura (PDF) ↗</a>' : '') +
      '</details></article>';
  }

  function terms() { return norm(F.q).split(/[^a-z0-9#+.]+/).filter(function (t) { return t.length > 1 && ['de', 'da', 'do', 'em', 'para', 'ou'].indexOf(t) === -1; }); }

  function render() {
    var t = terms();
    var list = sortList(ALL.filter(function (c) { return passes(c, t); }));
    var open = ALL.filter(function (c) { return !closed(c); }).length;
    $('#cCount').textContent = list.length === 1 ? '1 concurso' : list.length + ' concursos';
    $('#cSub').textContent = open ? 'de ' + open + ' abertos ou previstos' : '';

    var counts = {};
    var add = function (k) { counts[k] = (counts[k] || 0) + 1; };
    ALL.forEach(function (c) {
      if (passes(c, t, 'regiao')) add(c._regiao);
      if (passes(c, t, 'tipo')) add(c._tipo);
      if (passes(c, t, 'fonte')) add('src-' + c.source);
    });
    document.querySelectorAll('#cFilters [data-ccount]').forEach(function (el) { el.textContent = counts[el.dataset.ccount] || 0; });

    var el = $('#cList');
    if (!ALL.length) el.innerHTML = '<div class="empty"><h3>Nenhum concurso indexado ainda</h3><p>Clique em <b>Atualizar vagas</b> para buscar no PCI Concursos, Prefeitura de Porto Alegre e CIEE.</p><button class="btn primary" onclick="startRefresh()">Atualizar vagas</button></div>';
    else if (!list.length) el.innerHTML = '<div class="empty"><h3>Nada com esses filtros</h3><p>Tente incluir outros estados ou desligar “Só área de TI”.</p><button class="btn" onclick="Concursos.reset()">Restaurar filtro</button></div>';
    else el.innerHTML = list.slice(0, shown).map(card).join('');
    var rest = list.length - shown;
    $('#cMore').hidden = rest <= 0;
    $('#cMore').textContent = 'Mostrar mais ' + Math.min(rest, 40) + ' de ' + rest;
  }

  function sync() {
    ['regiao', 'tipo'].forEach(function (set) {
      document.querySelectorAll('#cFilters [data-cset="' + set + '"] input').forEach(function (i) { i.checked = F[set].indexOf(i.value) !== -1; });
    });
    document.querySelectorAll('#cFonte input').forEach(function (i) { i.checked = !F.fonte || F.fonte.indexOf(i.value) !== -1; });
    ['soTi', 'semSuperior', 'comSalario', 'soNovas'].forEach(function (id) { $('#c_' + id).checked = F[id]; });
    $('#cSort').value = F.sort;
  }
  function changed() { shown = 40; store.set('garimpo.concursos', F); render(); }

  $('#cFilters').addEventListener('change', function (e) {
    var t = e.target, group = t.closest('[data-cset]');
    if (group) {
      var vals = [].slice.call(group.querySelectorAll('input:checked')).map(function (i) { return i.value; });
      var set = group.dataset.cset;
      F[set] = set === 'fonte' && vals.length === group.querySelectorAll('input').length ? null : vals;
    } else if (t.type === 'checkbox') F[t.id.replace('c_', '')] = t.checked;
    changed();
  });
  $('#cSort').onchange = function (e) { F.sort = e.target.value; changed(); };
  $('#cMore').onclick = function () { shown += 40; render(); };
  $('#cReset').onclick = function () { Concursos.reset(); };

  window.Concursos = {
    setData: function (data) {
      ALL = data.concursos || [];
      previousUpdate = data.previousUpdate;
      ALL.forEach(function (c) {
        c._text = norm([c.title, c.cargos, c.chamada, (c.cargosTi || []).join(' '), (c.cursosTi || []).join(' '), c.city, c.uf].join(' '));
        c._regiao = regiaoOf(c);
        c._tipo = tipoOf(c);
      });
      $('#cFonte').innerHTML = (data.sources || []).filter(function (s) { return s.kind === 'concursos'; }).map(function (s) {
        return '<label class="chip"><input type="checkbox" value="' + s.id + '"><span>' + esc(s.name) + ' <small data-ccount="src-' + s.id + '"></small></span></label>';
      }).join('');
      sync();
      render();
    },
    setQuery: function (q) { F.q = q; changed(); },
    getQuery: function () { return F.q; },
    render: render,
    card: card,
    reset: function () { F = Object.assign({}, DEFAULTS); $('#q').value = ''; $('#searchBox').classList.remove('has'); sync(); changed(); },
  };
})();
