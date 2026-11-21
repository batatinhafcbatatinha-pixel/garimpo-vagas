// Deriva dos textos da vaga os campos usados pelos filtros:
// nível, escolaridade, salário, local e se é vaga de desenvolvimento.

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ---------- nível ----------
function classifyLevel(title, hint) {
  const t = norm(title);
  const has = (re) => re.test(t);
  const found = [];
  if (has(/\b(estagi\w*|intern(ship)?)\b/)) found.push('estagio');
  if (has(/\btrainee\b|jovem aprendiz|\baprendiz\b/)) found.push('trainee');
  if (has(/\b(junior|jr|entry[- ]level)\b/)) found.push('junior');
  if (has(/\b(pleno|pl|mid[- ]level|middle)\b/)) found.push('pleno');
  if (has(/\b(senior|sr|especialista|specialist|lead|lider|staff|principal|coordenador\w*|gerente|head|arquitet\w*)\b/))
    found.push('senior');
  if (!found.length) {
    // Algarismos romanos no fim do cargo: "Desenvolvedor I", "Analista III"
    const m = t.match(/\b(i{1,3})\b(?!\s*[-–]?\s*\w*\d)/);
    if (m && /\b(desenvolv|programad|analista|engenheir|develop|engineer)/.test(t))
      found.push(['junior', 'pleno', 'senior'][m[1].length - 1]);
  }
  if (found.length) return found[0]; // o mais baixo citado ("Jr/Pleno" conta como júnior)
  return hint || 'nao-informado';
}

// ---------- é vaga de dev? ----------
const DEV_RE =
  /\b(desenvolv\w*|programa[dc]\w*|developer|dev|software|front[- ]?end|back[- ]?end|full[- ]?stack|engenh\w* de (software|dados)|engineer|web|mobile|android|ios|java|javascript|typescript|python|php|node(\.?js)?|react|angular|vue|\.net|dotnet|c#|golang|ruby|kotlin|flutter|delphi|cobol|sql|dados|data|qa|quality assurance|testes|devops|sre|cloud|sistemas|ti|t\.i\.|tecnologia|suporte tecnico|infraestrutura|protheus|salesforce|sap|abap|rpa|automacao|low[- ]?code|wordpress|games?)\b/;
const NOT_DEV_RE =
  /desenvolv\w* de (negocios|vendas|pessoas|produtos? alimenticios|mercado|parcerias|contas|franquias|novos negocios|fornecedores|embalagens)|business develop|desenvolvimento (humano|organizacional|comercial|imobiliario)|\bsdr\b|\bbdr\b|vendedor|representante comercial|programa\w* (de|da|e controle de) (producao|manutencao|materiais|tv|obras)|\bpcp\b/;

function isDevJob(title) {
  const t = norm(title);
  return DEV_RE.test(t) && !NOT_DEV_RE.test(t);
}

// ---------- escolaridade ----------
const SUPERIOR_RE =
  /ensino superior|nivel superior|curso superior|superior (completo|incompleto|cursando|em andamento|em |na area)|formacao superior|graduacao|graduad[oa]|graduando|bacharel\w*|tecnologo|cursando (a partir|o \d|ciencia|engenharia|analise|sistemas)|universitari[oa]|faculdade|formacao (academica )?em (ciencias? da computacao|engenharia|sistemas|analise|tecnologia da informacao|ti\b|areas? (correlatas|afins|de tecnologia|de ti))|pos[- ]graduacao|bachelor'?s?( degree)?|college degree|university degree|degree in/g;
const MEDIO_RE = /ensino medio|nivel medio|segundo grau|2o grau|high school/g;
const TECNICO_RE =
  /ensino tecnico|nivel tecnico|curso tecnico|formacao tecnica|tecnico (completo|em informatica|em desenvolvimento|em ti\b|em analise|em programacao|em sistemas|em redes|em tecnologia)|tecnico ou superior|medio\/tecnico|medio ou tecnico|cursos? (livres?|profissionalizantes?)|bootcamp/g;
const OPTIONAL_RE = /desejave(l|is)|diferencia(l|is)|sera um diferencial|nao (e )?(obrigatori[oa]|necessari[oa]|exig\w+)|opcional|preferencialmente|nice to have|is a plus|preferred|sem (necessidade|exigencia) de/;
const NO_DEGREE_RE =
  /nao (e )?(necessari[oa]|exigi\w+|obrigatori[oa]|precisa)( ter)?( de)? (formacao|graduacao|ensino superior|diploma|faculdade)|sem (exigencia|necessidade) de (formacao|graduacao|ensino superior|diploma|faculdade)|no degree required/;

function matchesWithContext(text, re, original) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    // contexto: a frase/linha em volta da menção
    const start = Math.max(text.lastIndexOf('\n', m.index), text.lastIndexOf('. ', m.index), m.index - 90) + 1;
    let end = text.length;
    for (const sep of ['\n', '. ', ';']) {
      const i = text.indexOf(sep, m.index + m[0].length);
      if (i !== -1) end = Math.min(end, i);
    }
    end = Math.min(end, m.index + m[0].length + 130);
    const from = Math.max(0, start);
    // a normalização preserva o tamanho, então os mesmos índices valem no texto original
    const src = original && original.length === text.length ? original : text;
    out.push({ match: m[0], context: text.slice(from, end), trecho: src.slice(from, end).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

// structured: campo de escolaridade vindo pronto da fonte (ex.: InfoJobs "Ensino Médio")
function classifyEducation(text, structured) {
  const t = norm(text);
  const s = norm(structured);
  const orig = String(text ?? "");
  const sup = matchesWithContext(t, SUPERIOR_RE, orig);
  const med = matchesWithContext(t, MEDIO_RE, orig);
  const tec = matchesWithContext(t, TECNICO_RE, orig);

  let medio = med.length > 0 || /medio|segundo grau/.test(s);
  let tecnico = tec.length > 0 || /tecnico|profissionalizante/.test(s);
  const structSuperior = /superior|graduacao|pos|mestrado|doutorado|tecnologo/.test(s);
  let superior = sup.length > 0 || structSuperior;

  // superior só como "desejável/diferencial" ou "não é necessário" não conta como exigência
  const dispensa = NO_DEGREE_RE.test(t);
  const superiorOpcional =
    !structSuperior && sup.length > 0 && (dispensa || sup.every((x) => OPTIONAL_RE.test(x.context)));

  // exige superior = cita superior, não é opcional, e não oferece médio/técnico como alternativa
  let exigeSuperior = superior && !superiorOpcional && !medio && !tecnico;
  // campo estruturado manda: se a fonte diz "Ensino Médio", não exige superior
  if (s && !structSuperior && (medio || tecnico)) exigeSuperior = false;
  if (structSuperior && !/medio|tecnico(?! ?logo)/.test(s)) exigeSuperior = true;

  let resumo = 'nao-menciona';
  if (exigeSuperior) resumo = 'superior';
  else if (medio && tecnico) resumo = 'medio-tecnico';
  else if (tecnico) resumo = 'tecnico';
  else if (medio) resumo = 'medio';
  else if (superiorOpcional) resumo = 'superior-opcional';

  const trecho = (exigeSuperior ? sup[0] : tec[0] || med[0] || sup[0])?.trecho || structured || '';
  return { resumo, superior, medio, tecnico, superiorOpcional, exigeSuperior, trecho: trecho.slice(0, 220) };
}

// ---------- salário ----------
const MONEY_RE = /r\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s?(mil|k)?\b/g;
const SAL_KEY_RE = /salari|remunera|bolsa|faixa|pretens|\bclt\b|\bpj\b|por mes|mensal|\/mes|por hora|\/h\b|ganhos|proposta/;
const BENEFIT_RE = /\bvale|\bvr\b|\bva\b|\bvt\b|auxilio|ajuda de custo|beneficio|bonus|\bplr\b|gympass|wellhub|premiac|cartao|refeicao|alimentacao|home office:|plano|seguro|creche|convenio/;

function parseMoney(m) {
  let v = Number(m[1].replace(/\./g, '')) + (m[2] ? Number(m[2]) / 100 : 0);
  if (m[3]) v *= 1000;
  return v;
}

// structured: salário vindo pronto da fonte. estimate: true se é estimativa do site (não da empresa)
function classifySalary(text, structured, estimate = false) {
  const pick = (src, strict) => {
    const t = norm(src);
    const vals = [];
    MONEY_RE.lastIndex = 0;
    let m;
    while ((m = MONEY_RE.exec(t))) {
      const v = parseMoney(m);
      if (!strict) {
        vals.push(v);
        continue;
      }
      const before = t.slice(Math.max(0, m.index - 70), m.index);
      const after = t.slice(m.index, m.index + m[0].length + 30);
      const lastBreak = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('. '), before.lastIndexOf(';'));
      const near = before.slice(lastBreak + 1);
      const isBenefit = BENEFIT_RE.test(near);
      const isSalary = SAL_KEY_RE.test(near) || SAL_KEY_RE.test(after);
      const porHora = /por hora|\/h\b|\/hora/.test(after);
      if (isBenefit && !isSalary) continue;
      if (isSalary && (v >= 600 || porHora)) vals.push(porHora ? v * 160 : v);
      else if (!isBenefit && v >= 1300 && v <= 60000) vals.push(v);
    }
    return vals;
  };

  let vals = structured ? pick(structured, false) : [];
  let fonte = structured ? 'campo' : null;
  if (!vals.length) {
    vals = pick(text, true).slice(0, 2);
    fonte = vals.length ? 'descricao' : null;
    estimate = false;
  }
  if (!vals.length) return { informado: false, estimativa: false, min: null, max: null, texto: '' };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const fmt = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  return {
    informado: !estimate,
    estimativa: !!estimate,
    min,
    max,
    fonte,
    texto: min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`,
  };
}

// ---------- local ----------
const METRO_RE =
  /\b(canoas|viamao|gravatai|cachoeirinha|alvorada|sao leopoldo|novo hamburgo|esteio|sapucaia do sul|guaiba|eldorado do sul|campo bom|sapiranga|montenegro|portao|greater porto alegre|grande porto alegre|regiao metropolitana de porto alegre)\b/;

// workModeHint: pista fraca (ex.: filtro "remoto" do LinkedIn). O texto da vaga tem prioridade;
// sem nada no texto, a pista vale mas fica marcada como não confirmada.
function classifyLocation(location, workMode, text, workModeHint) {
  const l = norm(location);
  const isPoa = /porto alegre(?! do (norte|tocantins|piaui))/.test(l) && !/greater|grande|regiao metrop/.test(l);
  const isMetro = !isPoa && METRO_RE.test(l);
  let mode = workMode || null;
  if (!mode) {
    const t = norm(location + ' \n' + String(text ?? '').slice(0, 1500));
    if (/100% remoto|totalmente remoto|trabalho remoto|vaga remota|home office|\bremot[oa]\b|\bremote\b|teletrabalho|anywhere/.test(t))
      mode = /hibrid|hybrid/.test(t) ? 'hybrid' : 'remote';
    else if (/hibrid|hybrid/.test(t)) mode = 'hybrid';
    else if (/presencial|on[- ]?site/.test(t)) mode = 'onsite';
  }
  let workModeUnconfirmed = false;
  if (!mode && workModeHint) {
    mode = workModeHint;
    // vaga "remota" com local só no nível do país é o normal; com cidade, fica a dúvida
    workModeUnconfirmed = !/^(brasil|brazil)$/.test(l.trim());
  }
  return { isPoa, isMetro, isRemote: mode === 'remote', workMode: mode, workModeUnconfirmed };
}

// Aplica todas as classificações a uma vaga crua vinda de uma fonte.
function enrich(job) {
  const fullText = [job.title, job.description, (job.attributes || []).join('\n')].filter(Boolean).join('\n');
  const loc = classifyLocation(job.location, job.workMode, fullText, job.workModeHint);
  return {
    ...job,
    level: classifyLevel(job.title, job.levelHint),
    isDev: isDevJob(job.title),
    edu: classifyEducation(fullText, job.educationText),
    salary: classifySalary(fullText, job.salaryText, job.salaryEstimate),
    ...loc,
  };
}

module.exports = { enrich, classifyLevel, classifyEducation, classifySalary, classifyLocation, isDevJob, norm };
