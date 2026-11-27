# Garimpo

Indexador local de vagas de dev júnior e de concursos públicos de TI. Mostra tudo em um site com filtros, em duas abas:

- **Vagas:** Gupy, LinkedIn, InfoJobs, Glassdoor, Indeed, Sólides, Catho, Empregos.com.br, Vagas.com, BNE, GeekHunter, Programathor, Remotar, Trampos, 99jobs e APInfo
- **Concursos:** PCI Concursos, Prefeitura de Porto Alegre, CIEE-RS e CIEE nacional (concursos, processos seletivos e estágios em órgãos públicos)

> Também existe uma versão publicada, atualizada sozinha uma vez por dia: https://batatinhafcbatatinha-pixel.github.io/garimpo-vagas/ (código no branch `site`, veja [Versão publicada](#versão-publicada)).

## Como usar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. Não tem dependências para instalar.

```
node server.js
```

Abra http://localhost:4321 e clique em **Atualizar vagas** (leva uns 2 minutos). No Windows, dá para abrir com dois cliques em `Abrir Garimpo.bat`.

### Atualização automática

Ao lado do botão, **Auto** escolhe de quanto em quanto tempo o site atualiza sozinho: Desligado, 1 h, 3 h, 6 h, 12 h ou 24 h. Conta a partir da última atualização e usa as fontes escolhidas, igual ao botão. A escolha fica salva no navegador, e a atualização automática só roda enquanto o site estiver aberto em alguma aba.

Ao lado, **F5 refaz a coleta**: ligado, recarregar a página (F5) faz uma atualização completa, em todas as fontes. Abrir o site pela primeira vez não dispara nada, e se já houver uma atualização rodando, o site só acompanha. Desligado, o F5 só recarrega a página. A escolha também fica salva no navegador.

As vagas aparecem enquanto a atualização acontece: cada fonte que termina já entra na lista, e as fontes que ainda estão buscando continuam com as vagas da atualização anterior. No fim, a lista é a mesma de quando tudo termina.

## Filtros

- Local: Porto Alegre, remoto Brasil, Grande POA, outros
- Nível: júnior, trainee, estágio, pleno, sênior
- Sem exigir ensino superior
- Obrigatório citar ensino médio ou técnico
- Obrigatório informar o salário, com valor mínimo
- Site, data de publicação, só vagas novas, só vagas de desenvolvimento
- Esconder vagas em inglês, exclusivas PCD ou exclusivas para mulheres (as três vêm ligadas)

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

As duas listas ficam salvas no servidor (`data/candidaturas.json` e `data/escondidas.json`), então valem no computador, no celular e na TV. A pasta `data/` está no `.gitignore` e nunca vai para o repositório nem para o site publicado.

O site também abre no celular e na TV pela rede local; o endereço aparece no rodapé.

## Versão publicada

O branch `site` tem uma versão só de leitura do Garimpo, publicada no GitHub Pages em https://batatinhafcbatatinha-pixel.github.io/garimpo-vagas/. Ela não tem servidor, botão de atualizar nem **Auto**; as candidaturas e escondidas de lá ficam no navegador de cada aparelho.

O workflow `.github/workflows/pages.yml` fica aqui no `main` porque o GitHub só dispara agendamentos a partir do branch padrão. Ele roda todo dia às 12:00 UTC (9h em Brasília), ou na mão em **Actions → Atualizar e publicar → Run workflow**, faz checkout do branch `site`, busca as vagas e publica. Detalhes no README do branch `site`.

## Limites

- No PCI Concursos, escolaridade e salário valem para o concurso inteiro, não só para o cargo de TI.

- O Indeed recusa clientes HTTP comuns, então é buscado pelo Edge (ou Chrome) em modo headless, sem abrir janela. Cada busca leva uns 7 s. Sem navegador instalado ou se o Indeed bloquear mesmo assim, o site oferece links para abrir a busca direto lá.
- O Glassdoor recusa navegador automatizado e o cliente HTTP do Node, então é buscado pelo `curl` (vem no Windows 10+). Lê até 5 páginas por busca e a descrição completa pelas APIs internas que o próprio site usa; até 500 descrições novas por atualização, o resto vem na seguinte. Quando o Glassdoor mostra a verificação anti-robô, a fonte aparece como bloqueada e mantém as vagas da atualização anterior.
- O APInfo tem uma cota curta de consultas: quando esgota no meio, a fonte fica com o que já leu e com as vagas das últimas atualizações (até 30 dias). As vagas de lá abrem na página de busca, porque o link de cada vaga exige sessão.
- Catho, Vagas.com, BNE, GeekHunter, Programathor, Trampos e 99jobs abrem a página de cada vaga nova para ler a descrição completa, com um limite por atualização; o resto entra na seguinte. Até lá a vaga aparece com o resumo da busca.
- No BNE o título é só a função ("Desenvolvedor", "Programador"), então o nível quase sempre fica como não informado.
- Na Catho o modelo de trabalho não vem nos dados; ele é deduzido da descrição.
- Vagas de "Empresa confidencial" não são juntadas com outras de mesmo título, porque não dá para saber se são a mesma vaga.
- Fora: Revelo (exige login), Mindsight (só tem a página de carreira de cada empresa, sem busca geral), Código Fonte (a seção de vagas acabou), TechRecruit e RocketJobs (nenhum site de vagas com esse nome no ar).
- Nível, escolaridade e salário são deduzidos do texto da vaga e podem errar.
- As buscas (termos e cidade) ficam no topo de cada arquivo em `sources/`.

## Testes

```
node --test
```
