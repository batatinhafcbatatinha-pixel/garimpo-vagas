# Garimpo

Indexador de vagas de dev júnior e de concursos públicos de TI. Mostra tudo em um site com filtros, em duas abas:

- **Vagas:** Gupy, LinkedIn, InfoJobs, Glassdoor e Indeed
- **Concursos:** PCI Concursos, Prefeitura de Porto Alegre, CIEE-RS e CIEE nacional (concursos, processos seletivos e estágios em órgãos públicos)

Funciona de dois jeitos, com o mesmo site (`public/`):

| | Site publicado (GitHub Pages) | Modo local (`node server.js`) |
|---|---|---|
| Endereço | https://batatinhafcbatatinha-pixel.github.io/garimpo-vagas/ | http://localhost:4321 |
| Atualização | sozinha, uma vez por dia, por volta das 9h (Brasília) | botão **Atualizar vagas** e, se quiser, automática a cada 1, 3, 6, 12 ou 24 h |
| Candidaturas e escondidas | salvas no navegador (cada aparelho tem as suas) | salvas no computador, valem em todos os aparelhos da rede |
| Login do LinkedIn | só com o segredo `LINKEDIN_LI_AT` (ver abaixo) | pelo link no rodapé |

O site descobre sozinho em qual modo está: se não encontra o servidor local, lê o `jobs.json` publicado.

## Site publicado (GitHub Pages)

Abra https://batatinhafcbatatinha-pixel.github.io/garimpo-vagas/ no computador, celular ou TV. Não precisa instalar nada.

- O workflow `.github/workflows/pages.yml` roda todo dia às 12:00 UTC (9h em Brasília) e também pode ser rodado na mão em **Actions → Atualizar e publicar → Run workflow**. O GitHub pode atrasar execuções agendadas em alguns minutos (às vezes mais).
- Ele busca as vagas (`scripts/build-pages.js`), monta a pasta `site/` com `public/` + `jobs.json` + `cache.json` e publica no Pages. Nada de dados é commitado no repositório: cada execução baixa o `jobs.json` e o `cache.json` da publicação anterior, para saber o que é vaga nova e não baixar de novo as descrições.
- Não tem botão de atualizar (não há servidor). Embaixo da busca aparecem a data da última atualização e como foi cada fonte; se alguma falhou, o aviso diz qual e por quê, e as vagas dela da última vez que deu certo continuam na lista.
- **Já me candidatei** e **Esconder** ficam salvos no `localStorage` do navegador. Não saem do aparelho, não são publicados e não passam de um aparelho para outro. Limpar os dados do site no navegador apaga as marcas.
- Os arquivos pessoais do modo local (`data/candidaturas.json`, `data/escondidas.json`, `data/linkedin.json`) nunca vão para o site nem para o repositório (`data/` está no `.gitignore`).
- Repositórios em contas grátis precisam ser públicos para ter Pages, então o site publicado é público (as vagas são de sites públicos; as marcas pessoais ficam só no navegador).

### LinkedIn no GitHub Actions (opcional)

Sem login, o LinkedIn é buscado normalmente, só que algumas vagas aparecem como **Remoto?**. Para o Actions consultar o modelo de trabalho, crie em **Settings → Secrets and variables → Actions** um segredo `LINKEDIN_LI_AT` com o valor do cookie `li_at` (veja como pegar no diálogo de login do modo local). Atenção: o login passa a ser usado de servidores do GitHub, fora do Brasil, o que aumenta a chance de o LinkedIn pedir verificação ou restringir a conta. Se usar, prefira uma conta secundária. Sem o segredo, essa parte é pulada.

## Modo local

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. Não tem dependências para instalar.

```
node server.js
```

Abra http://localhost:4321 e clique em **Atualizar vagas** (leva uns 2 minutos). No Windows, dá para abrir com dois cliques em `Abrir Garimpo.bat`.

Ao lado do botão, **Auto** escolhe de quanto em quanto tempo o site atualiza sozinho (Desligado, 1 h, 3 h, 6 h, 12 h ou 24 h), contando da última atualização e usando as fontes escolhidas. A escolha fica salva no navegador, e a atualização automática só roda enquanto o site estiver aberto em alguma aba.

## Filtros

- Local: Porto Alegre, remoto Brasil, Grande POA, outros
- Nível: júnior, trainee, estágio, pleno, sênior
- Sem exigir ensino superior
- Obrigatório citar ensino médio ou técnico
- Obrigatório informar o salário, com valor mínimo
- Site, data de publicação, só vagas novas, só vagas de desenvolvimento

A busca ignora acentos, trata "junior", "júnior" e "jr" como a mesma coisa, e buscar por júnior não traz vaga pleno ou sênior.

## Filtros de concursos

- Região: Porto Alegre, resto do RS, outros estados
- Tipo: concurso, processo seletivo, estágio, aprendiz
- Só área de TI
- Aceita ensino médio ou técnico
- Obrigatório informar salário ou bolsa

A cada atualização, vagas que saíram dos sites e concursos com inscrições encerradas somem da lista.

## Candidaturas e vagas escondidas

Cada cartão tem dois botões:

- **Já me candidatei** (ou **Já me inscrevi**): a vaga sai das listas e vai para a aba **Candidaturas**.
- **Esconder**: tira da lista uma vaga que não interessa. Ela fica na aba **Escondidas**, de onde volta com **Mostrar de novo**.

No modo local, as duas listas ficam salvas no servidor (`data/candidaturas.json` e `data/escondidas.json`), então valem no computador, no celular e na TV. No site publicado, ficam no navegador de cada aparelho (veja acima).

No modo local, o site também abre no celular e na TV pela rede local; o endereço aparece no rodapé.

## Limites

- No PCI Concursos, escolaridade e salário valem para o concurso inteiro, não só para o cargo de TI.

- O Indeed recusa clientes HTTP comuns, então é buscado pelo Edge (ou Chrome) em modo headless, sem abrir janela. Cada busca leva uns 7 s. Sem navegador instalado ou se o Indeed bloquear mesmo assim, o site oferece links para abrir a busca direto lá.
- O Glassdoor recusa navegador automatizado e o cliente HTTP do Node, então é buscado pelo `curl` (vem no Windows 10+). Lê até 5 páginas por busca e a descrição completa pelas APIs internas que o próprio site usa; até 500 descrições novas por atualização, o resto vem na seguinte.
- Nível, escolaridade e salário são deduzidos do texto da vaga e podem errar.
- As buscas (termos e cidade) ficam no topo de cada arquivo em `sources/`.
- No GitHub Actions, alguns sites podem bloquear os endereços dos servidores do GitHub. A fonte bloqueada aparece com aviso no site publicado e as outras seguem normalmente; no Linux do Actions, o Indeed usa o Google Chrome que já vem instalado.
- O site publicado só muda uma vez por dia; para vagas mais frescas, use o modo local.

## Testes

```
node --test
```
