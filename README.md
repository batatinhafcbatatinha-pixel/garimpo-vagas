# Garimpo

Indexador local de vagas de dev júnior e de concursos públicos de TI. Mostra tudo em um site com filtros, em duas abas:

- **Vagas:** Gupy, LinkedIn, InfoJobs e Glassdoor
- **Concursos:** PCI Concursos, Prefeitura de Porto Alegre, CIEE-RS e CIEE nacional (concursos, processos seletivos e estágios em órgãos públicos)

## Como usar

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. Não tem dependências para instalar.

```
node server.js
```

Abra http://localhost:4321 e clique em **Atualizar vagas** (leva uns 2 minutos). No Windows, dá para abrir com dois cliques em `Abrir Garimpo.bat`.

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

O site também abre no celular e na TV pela rede local; o endereço aparece no rodapé.

## Limites

- No PCI Concursos, escolaridade e salário valem para o concurso inteiro, não só para o cargo de TI.

- O Indeed bloqueia buscas automáticas; o site oferece links para abrir a busca direto lá.
- O Glassdoor só entrega a primeira página de cada busca e um resumo da descrição.
- Nível, escolaridade e salário são deduzidos do texto da vaga e podem errar.
- As buscas (termos e cidade) ficam no topo de cada arquivo em `sources/`.

## Testes

```
node --test
```
