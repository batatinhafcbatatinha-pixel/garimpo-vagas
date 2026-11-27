# Garimpo (versão publicada)

Este é o branch `site`: a versão do Garimpo que é publicada sozinha no GitHub Pages, uma vez por dia.

**Endereço:** https://batatinhafcbatatinha-pixel.github.io/garimpo-vagas/

Abre no computador, no celular e na TV, sem instalar nada. Mostra vagas de dev júnior e concursos públicos de TI com filtros, em duas abas:

- **Vagas:** Gupy, LinkedIn, InfoJobs, Glassdoor e Indeed
- **Concursos:** PCI Concursos, Prefeitura de Porto Alegre, CIEE-RS e CIEE nacional (concursos, processos seletivos e estágios em órgãos públicos)

A versão para rodar no próprio computador, com o botão **Atualizar vagas**, atualização automática e candidaturas salvas no computador, fica no branch `main`.

## Como é publicada

- O workflow `.github/workflows/pages.yml` fica no branch `main` (o GitHub só dispara agendamentos a partir do branch padrão), mas faz checkout deste branch `site` e publica o que está aqui.
- Roda todo dia às 12:00 UTC (9h em Brasília). Também dá para rodar na mão em **Actions → Atualizar e publicar → Run workflow**. O GitHub pode atrasar execuções agendadas em alguns minutos (às vezes mais).
- `scripts/build-pages.js` busca as vagas com as mesmas fontes do modo local (`sources/`, `lib/`), monta a pasta `site/` com `public/` + `jobs.json` + `cache.json` e o workflow publica no Pages.
- Nada de dados é commitado: cada execução baixa o `jobs.json` e o `cache.json` da publicação anterior, para saber o que é vaga nova e não baixar de novo as descrições.

## No site

- Não tem botão de atualizar (não há servidor). Embaixo da busca aparecem a data da última atualização e como foi cada fonte. Se alguma falhou, o aviso diz qual e por quê, e as vagas dela da última vez que deu certo continuam na lista.
- **Já me candidatei** (ou **Já me inscrevi**) tira a vaga das listas e leva para a aba **Candidaturas**. **Esconder** leva para a aba **Escondidas**, de onde ela volta com **Mostrar de novo**.
- As duas listas ficam no `localStorage` do navegador: não saem do aparelho, não são publicadas e não passam de um aparelho para outro. Limpar os dados do site no navegador apaga as marcas.
- O repositório é público (Pages grátis exige isso), então o site também é. As vagas vêm de sites públicos; as marcas pessoais ficam só no navegador.

## Filtros

- Vagas: local (Porto Alegre, remoto Brasil, Grande POA, outros), nível, sem exigir ensino superior, cita ensino médio ou técnico, salário informado e valor mínimo, site, data de publicação, só novas, só desenvolvimento, sem vagas em inglês, sem vagas exclusivas PCD.
- Concursos: região, tipo, só área de TI, aceita ensino médio ou técnico, salário ou bolsa informado, só novos.

A busca ignora acentos, trata "junior", "júnior" e "jr" como a mesma coisa, e buscar por júnior não traz vaga pleno ou sênior.

## LinkedIn (opcional)

Sem login, o LinkedIn é buscado normalmente, só que algumas vagas aparecem como **Remoto?**. Para o Actions consultar o modelo de trabalho, crie em **Settings → Secrets and variables → Actions** um segredo `LINKEDIN_LI_AT` com o valor do cookie `li_at` da sua conta. Atenção: o login passa a ser usado de servidores do GitHub, fora do Brasil, o que aumenta a chance de o LinkedIn pedir verificação ou restringir a conta. Se usar, prefira uma conta secundária. Sem o segredo, essa parte é pulada.

## Limites

- Muda só uma vez por dia. Para vagas mais frescas, use a versão local (branch `main`).
- Alguns sites bloqueiam os servidores do GitHub. Hoje o Indeed e o Glassdoor costumam vir como **bloqueado**; o aviso no site traz links para abrir a busca direto lá quando existem. As outras fontes seguem normalmente.
- No PCI Concursos, escolaridade e salário valem para o concurso inteiro, não só para o cargo de TI.
- Nível, escolaridade e salário são deduzidos do texto da vaga e podem errar.

## Testes

```
node --test
```
