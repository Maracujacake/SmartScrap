# Verificação da integração de fotografias — 14/10/2026

Fluxo verificado: cadastro do lote → envio de três fotos → fila local → DeepLabV3+
→ resultado persistido no SQLite → revisão do operador → publicação → consulta
das imagens e observações nos detalhes do lote.

| Verificação | Resultado |
| --- | --- |
| API e regras do marketplace | 13 testes aprovados |
| Validação real de fotografias com Pillow | 4 testes aprovados |
| Build de produção | Aprovado |
| Upload pela interface | 3 fotos recebidas e processadas pelo modelo real |
| Revisão antes de publicar | Publicação bloqueada até a revisão; discordância registrada |
| Persistência | Lote e resultado consultados após reiniciar a API |
| Galeria | Original, sobreposição e máscara disponíveis |
| Tela de 390 × 844 | Sem transbordamento horizontal no diálogo; imagem carregada |
| Console da interface durante a verificação | Sem erros |

Lote demonstrativo mantido no banco local: **SS-2026-0034**, organização
Metalúrgica Horizonte. Operadora: Ana Paula. A discordância foi registrada
separadamente e não alterou a classificação do modelo.

Entradas: quadros (a), (c) e (e) da figura anteriormente fornecida. São versões
de iluminação da mesma cena, não três lotes independentes. As imagens foram
reencodificadas pelo fluxo de upload antes da inferência.

| Foto | Pixels previstos como corrosão | Inferência em CPU |
| --- | ---: | ---: |
| 1 — quadro (a) | 8,1200% | 1.947,86 ms |
| 2 — quadro (c) | 4,7630% | 1.771,06 ms |
| 3 — quadro (e) | 8,7471% | 1.691,24 ms |

Tempos referentes apenas à inferência nesta máquina, sem upload, inicialização,
carregamento dos pesos ou geração dos arquivos. Não são um benchmark geral.
Os percentuais descrevem a imagem inteira, incluindo fundo. Não são medidas de
pureza, massa ou acurácia; não há máscaras de referência dessas fotografias.

Prévia: `visual-analysis-preview.png`. Tela pequena: `visual-analysis-mobile.png`.
