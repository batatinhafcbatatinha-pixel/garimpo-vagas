const test = require('node:test');
const assert = require('node:assert');
const { parsePage } = require('../sources/apinfo');

const letters = (s) => '<span>' + [...s].map((c) => `<span class="highlight"></span>${c}`).join('') + '</span>';
const box = (info, title, desc, company, code) => `
  <div class="box-vagas linha pd">
    <div class="info-data">
      ${info}\t\t\t\t\t</div>
    <div class="cargo m-tb">
      ${letters(title)}
    </div>
    <div class="texto">
<p style="white-space:pre-wrap; "> <br>${desc}\t\t\t\t\t\t</p>
      <p>
        <strong>Empresa .....:</strong>  ${company}<BR>
        <strong>Código .......:</strong>   ${code}\t\t\t\t\t\t<a class="btn3 "href="https://www.apinfo.com/apinfo/inc/enviecv.cfm?codvaga=${code}&pkey=abc"> Envie seu currículo </a>
<p><br> </p>
    </div>
  </div>`;

const html = `<html><body>
<form action="list4.cfm" method="post" id="form-busca" class="pd"><input type="hidden" name="tcv" value="1"></form>
${box('Home Office - HO - 26/11/26', 'Desenvolvedor Front End Júnior', 'Atuação 100% remota <br>React &amp; TypeScript', 'Entrust IT', '86817')}
${box('Porto Alegre - RS - 19/11/26', 'Analista Desenvolvedor Java', 'Modelo híbrido', 'Acme', '86301')}
<form METHOD="POST" ACTION="list4.cfm"><input type=hidden name=estado[] value=HO> <input type=hidden name=cargo2cod[] value=27> <input type="hidden" name="pkey"    value="wktvxq">
<input type="hidden" name="tcv"     value="61">
<input type="hidden" name="keyw"    value="">
<div class="n-paginas"><strong>Página 1 de 8 </strong></div>
<input type="text" name="pag" value="2" maxsize="4" maxlength="4">
</form></body></html>`;

test('lê as vagas da página de resultados', () => {
  const { jobs, page, pages } = parsePage(html);
  assert.strictEqual(page, 1);
  assert.strictEqual(pages, 8);
  assert.strictEqual(jobs.length, 2);
  const [a, b] = jobs;
  assert.strictEqual(a.sourceId, '86817');
  assert.strictEqual(a.title, 'Desenvolvedor Front End Júnior');
  assert.strictEqual(a.company, 'Entrust IT');
  assert.strictEqual(a.location, 'Brasil');
  assert.strictEqual(a.workModeHint, 'remote');
  assert.strictEqual(a.publishedAt, '2026-11-26T15:00:00.000Z');
  assert.strictEqual(a.description, 'Atuação 100% remota\nReact & TypeScript');
  assert.strictEqual(b.location, 'Porto Alegre, RS');
  assert.strictEqual(b.workModeHint, null);
});

test('guarda os campos ocultos para pedir a próxima página', () => {
  const { form } = parsePage(html);
  assert.deepStrictEqual(form, [['estado[]', 'HO'], ['cargo2cod[]', '27'], ['pkey', 'wktvxq'], ['tcv', '61'], ['keyw', '']]);
});

test('página sem vagas (ex.: erro do site)', () => {
  const r = parsePage('<html>Erro : 178.076-J - Seu limite de consultas esta temporariamente esgotado</html>');
  assert.deepStrictEqual(r.jobs, []);
  assert.strictEqual(r.form, null);
});
