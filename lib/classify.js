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

// superior citado como benefício ("auxílio faculdade"), não como exigência
const EDU_BENEFIT_RE = /projetos? (pessoa|academic)|auxilio|subsidio|incentivo|reembolso|desconto|convenio|parceria|bolsas? de estudo/;

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
    out.push({ from, end, match: m[0], context: text.slice(from, end), trecho: src.slice(from, end).replace(/\s+/g, ' ').trim() });
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
  // Alternativa de verdade vem na mesma frase ("técnico ou superior"). Superior exigido numa frase
  // e "Escolaridade mínima: ensino médio" em outra não é alternativa: quem cursa já tem o médio.
  const alt = [...med, ...tec];
  const supSozinho = sup.filter(
    (x) => !OPTIONAL_RE.test(x.context) && !EDU_BENEFIT_RE.test(x.context) && !alt.some((a) => a.from < x.end && x.from < a.end)
  );
  let exigeSuperior = superior && !superiorOpcional && (alt.length ? supSozinho.length > 0 && !dispensa : !medio && !tecnico);
  // campo estruturado manda: se a fonte diz "Ensino Médio", não exige superior
  if (s && !structSuperior && (medio || tecnico)) exigeSuperior = false;
  if (structSuperior && !/medio|tecnico(?! ?logo)/.test(s)) exigeSuperior = true;

  let resumo = 'nao-menciona';
  if (exigeSuperior) resumo = 'superior';
  else if (medio && tecnico) resumo = 'medio-tecnico';
  else if (tecnico) resumo = 'tecnico';
  else if (medio) resumo = 'medio';
  else if (superiorOpcional) resumo = 'superior-opcional';

  const trecho = (exigeSuperior ? supSozinho[0] || sup[0] : tec[0] || med[0] || sup[0])?.trecho || structured || '';
  return { resumo, superior, medio, tecnico, superiorOpcional, exigeSuperior, trecho: trecho.slice(0, 220) };
}

// ---------- salário ----------
const MONEY_RE = /r\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s?(mil|k)?\b/g;
const SAL_KEY_RE = /salari|remunera|bolsa|faixa|pretens|\bclt\b|\bpj\b|por mes|mensal|\/mes|por hora|\/h\b|ganhos|proposta/;
const BENEFIT_RE = /\bvale|\b(flexfood|flash|caju|swile|alelo|ifood|sodexo|ticket)\b|\bvr\b|\bva\b|\bvt\b|auxilio|ajuda de custo|beneficio|bonus|\bplr\b|gympass|wellhub|premiac|cartao|refeicao|alimentacao|home office:|plano|seguro|creche|convenio/;

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
      // "por mês" depois do valor não transforma benefício em salário ("Flexfood (R$ 910 por mês")
      if (isBenefit && !SAL_KEY_RE.test(near)) continue;
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
// Modelo de trabalho pelo texto. Frases explícitas ("modelo híbrido", "2 dias presenciais",
// "100% remoto") valem no texto todo, porque às vezes só aparecem no fim ("Informações da vaga").
// Menções soltas ("remoto", "presencial") só contam no começo da descrição.
// "formato presencial" sozinho costuma ser da entrevista; só vale "formato de trabalho"
const W = '(modelo|regime|trabalho|atuacao|vaga|jornada|local|modalidade|formato de trabalho)( de trabalho| de atuacao| de contratacao)?:?\\s*(100% )?';
// "híbrido" solto também é app/nuvem híbrida; no texto todo só vale a forma explícita
// "possibilidade de home office" é benefício de vaga híbrida, não vaga remota
const HYBRID_RE = new RegExp(`${W}hibrid|possibilidade de (\\w+ ){0,2}(home[- ]?office|remot)|hybrid (work|model|role|position|schedule|capacity|basis|setup|arrangement)|in a hybrid|\\d+\\s*(x|vezes|dias?)( (na|por) semana)?\\s*(presencia|no escritorio|na empresa|na sede)|presencia\\w*\\s*\\d+\\s*(x|vezes|dias?)`);
const ONSITE_RE = new RegExp(`${W}presencial|100% presencial|\\bon[- ]?site\\b|in[- ]office|presencialmente`);
const REMOTE_RE = new RegExp(`${W}(remot|home[- ]?office)|100% (remot|home)|totalmente remot|full[- ]?remote|fully remote|remote[- ](first|only|position|role|work)|work from home|trabalho remoto|vaga remota|teletrabalho|anywhere in`);
function workModeFromText(location, text) {
  const all = norm(location + ' \n' + String(text ?? ''));
  const head = all.slice(0, 1500);
  if (HYBRID_RE.test(all)) return 'hybrid';
  const onsite = ONSITE_RE.test(all), remote = REMOTE_RE.test(all);
  if (onsite && remote) return 'hybrid';
  if (onsite) return 'onsite';
  if (remote) return 'remote';
  const looseHybrid = /\b(hibrid[oa]|hybrid)\b(?! (app|mobile|cloud|nuvem|aplica))/;
  if (/home office|\bremot[oa]\b|\bremote\b/.test(head)) return /presencial/.test(head) || looseHybrid.test(head) ? 'hybrid' : 'remote';
  if (looseHybrid.test(head)) return 'hybrid';
  if (/presencial/.test(head)) return 'onsite';
  return null;
}

function classifyLocation(location, workMode, text, workModeHint, hintTrusted = false) {
  const l = norm(location);
  const isPoa = /porto alegre(?! do (norte|tocantins|piaui))/.test(l) && !/greater|grande|regiao metrop/.test(l);
  const isMetro = !isPoa && METRO_RE.test(l);
  let mode = workMode || workModeFromText(location, text);
  let workModeUnconfirmed = false;
  if (!mode && workModeHint) {
    mode = workModeHint;
    // vaga "remota" com local só no nível do país é o normal; com cidade, fica a dúvida
    workModeUnconfirmed = !hintTrusted && !/^(brasil|brazil)$/.test(l.trim());
  }
  return { isPoa, isMetro, isRemote: mode === 'remote', workMode: mode, workModeUnconfirmed };
}

// ---------- idioma ----------
// Descrição em inglês: conta palavras muito comuns de cada língua. Sem descrição, olha o título.
const EN_WORDS = new Set('the and of to with for you your our we are is will in on as be this that an or have experience team skills work strong ability knowledge about who what using within across'.split(' '));
const PT_WORDS = new Set('de da do das dos e para com em os as uma um que voce nossa nosso sua seu ser na no nas nos ao experiencia conhecimento equipe trabalho vaga sobre requisitos atividades beneficios ou se mais'.split(' '));
function isEnglishText(title, description) {
  const count = (txt) => {
    let en = 0, pt = 0;
    for (const w of norm(txt).split(/[^a-z]+/)) {
      if (EN_WORDS.has(w)) en++;
      if (PT_WORDS.has(w)) pt++;
    }
    return { en, pt };
  };
  const d = count(String(description ?? '').slice(0, 4000));
  if (d.en + d.pt >= 15) return d.en > d.pt * 2;
  // pouca descrição: o título decide se não tem nenhuma palavra em português
  const t = count(title);
  const nt = norm(title);
  return d.pt + t.pt === 0 && /\b(developer|engineer|intern|internship)\b/.test(nt) && !/\b(desenvolv\w*|programad\w*|analista|engenheir\w*|estagi\w*)\b/.test(nt);
}

// ---------- PCD ----------
// Vaga exclusiva (ou afirmativa) para pessoas com deficiência. "Também aceita PCD" não conta.
const PCD = '(pcds?|pessoas? com deficiencia|pessoas? portadoras? de deficiencia|pnes?|people with disabilit\\w*)';
const PCD_TITLE_RE = new RegExp(`\\b${PCD}\\b|banco de talentos pcd`);
const PCD_DESC_RE = new RegExp(
  `(exclusiv\\w*|afirmativ\\w*|destinad\\w*|direcionad\\w*|reservad\\w*|voltad\\w*|somente|apenas|unicamente|especific\\w*)( \\w+){0,4} (a |para |ao |aos |as )?${PCD}|${PCD} exclusiv`
);
function isPcdOnly(title, description) {
  if (PCD_TITLE_RE.test(norm(title))) return true;
  return PCD_DESC_RE.test(norm(String(description ?? '').slice(0, 5000)));
}

// ---------- exclusiva para mulheres ----------
// Vaga exclusiva ou afirmativa para mulheres. Só citar mulheres ("incentivamos candidaturas de
// #mulheres", "melhor empresa para mulheres", "ONU Mulheres") não conta.
const MULHER = '(mulher(es)?|pessoas? (do genero |do sexo )?feminin[oa]s?|pessoas? que se identificam como mulher(es)?|candidatas)';
const WOMEN_TITLE_RE = /\bmulher(es)?\b|exclusiv\w* feminin|vaga feminina|\bwomen only\b|\bfor women\b/;
const WOMEN_DESC_RE = new RegExp(
  `(exclusiv\\w*|afirmativ\\w*|destinad\\w*|direcionad\\w*|reservad\\w*|somente|apenas|unicamente|especific\\w*)( \\w+){0,3} (a |para |ao |aos |as )?${MULHER}\\b|${MULHER} exclusiv|exclusiv\\w* (para o publico )?feminin|(open|restricted|exclusive) to women|women[- ]only|female candidates only`
);
function isWomenOnly(title, description) {
  // título que fala em mulheres é sempre vaga para elas ("Vaga afirmativa para mulheres", "Banco de talentos | Mulheres")
  if (WOMEN_TITLE_RE.test(norm(title))) return true;
  return WOMEN_DESC_RE.test(norm(String(description ?? '').slice(0, 5000)));
}

// Sobe quando as regras mudam: vagas salvas com versão antiga são reclassificadas ao carregar.
const VERSION = 3;

// Aplica todas as classificações a uma vaga crua vinda de uma fonte.
function enrich(job) {
  const fullText = [job.title, job.description, (job.attributes || []).join('\n')].filter(Boolean).join('\n');
  const loc = classifyLocation(job.location, job.workMode, fullText, job.workModeHint, job.workModeHintTrusted);
  return {
    ...job,
    v: VERSION,
    isEnglish: isEnglishText(job.title, job.description),
    pcdOnly: isPcdOnly(job.title, job.description),
    womenOnly: isWomenOnly(job.title, job.description),
    level: classifyLevel(job.title, job.levelHint),
    isDev: isDevJob(job.title),
    edu: classifyEducation(fullText, job.educationText),
    salary: classifySalary(fullText, job.salaryText, job.salaryEstimate),
    ...loc,
  };
}

module.exports = { VERSION, enrich, classifyLevel, classifyEducation, classifySalary, classifyLocation, isDevJob, isEnglishText, isPcdOnly, isWomenOnly, norm };
