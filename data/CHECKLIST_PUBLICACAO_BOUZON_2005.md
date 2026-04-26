# Checklist de Publicação — Bouzon (2005)

Data de atualização: 2026-04-26

## Itens concluídos

- [x] Curadoria taxonômica base gerada em `bouzon_2005_curadoria_publicacao.csv`.
- [x] Validação automática por filo gerada em `bouzon_2005_validacao_por_filo.json`.
- [x] Regra de sinonímia aplicada: `Enteromorpha` -> `Ulva`.
- [x] Expansão de abreviações de táxons (ex.: `C. antennina`, `S. vulgare`).
- [x] Filtros temporais do cladograma ajustados para funcionar também em `file://` (sem depender de fetch).

## Resultado de validação (versão atual)

- Chlorophyta: 26
- Phaeophyceae: 20
- Rhodophyta: 60
- Não informado: 1
- Total final: 107
- Total sem placeholder: 106

## Pendências científicas para versão final da defesa

- [ ] Resolver o 1 táxon pendente (`Taxon indeterminado 107`) com conferência direta na Tabela 1/PDF original.
- [ ] Revisar táxons com `status_curadoria = revisar` (epíteto indeterminado, ex.: `sp.`).
- [ ] Conferir e documentar status nomenclatural final (aceito/sinônimo) para cada táxon curado.
- [ ] Congelar versão final dos dados (`dataset_mestre`) após conferência com orientador(a)/banca.
