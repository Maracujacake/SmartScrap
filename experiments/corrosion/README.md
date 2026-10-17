# Teste do DeepLabV3+ com uma imagem de sucata

Experimento executado em 14/10/2026, em CPU, sem treinamento adicional. Os arquivos
do experimento original ficam separados do aplicativo React/Express. O mesmo
modelo agora também pode ser executado pelo cadastro de lotes, através de
`worker.py`; consulte o README principal para o fluxo integrado. O operador
registra sua revisão e observações, sem um campo manual de pureza do lote.

## Resultado principal

Entrada: quadro **(c)** da Figura 2 do artigo fornecido pelo usuário,
*Classification and rating of steel scrap using deep learning*,
DOI `10.1016/j.engappai.2023.106241`. A mesma cena aparece na captura de tela enviada.
Foi extraída a fotografia incorporada no PDF (520 × 333 px), sem bordas ou legendas,
para evitar a perda de resolução da captura. Nenhum ajuste de iluminação foi aplicado
pelo SmartScrap.

| Classe prevista | Pixels | Percentual da imagem |
| --- | ---: | ---: |
| Good / Background (classe agrupada) | 249329 | 95,1115% |
| Fair | 12661 | 4,8298% |
| Poor | 4 | 0,0015% |
| Severe | 150 | 0,0572% |

O tempo registrado para esse quadro foi **1.665,79 ms**, após uma execução de
aquecimento, usando oito threads de CPU. É uma medição deste teste, não um benchmark
geral de desempenho. A máscara foi calculada em 512 × 512 pixels (262.144 pixels).

Arquivos principais:

- `output/figure2_c_comparison.png`: original, máscara e sobreposição com legenda.
- `output/figure2_c_mask.png`: máscara colorida, redimensionada à resolução original.
- `output/figure2_c_ids.png`: IDs de classe 0–3, em 512 × 512, sem interpolação de rótulos.
- `output/figure2_c_overlay.png`: sobreposição das classes não nulas na fotografia.
- `output/figure2_c_result.json`: resultado numérico dessa entrada.
- `output/report.json`: modelo, execução, resultados dos seis quadros e limitações.
- `output/lighting_comparison.png`: comparação das seis versões da mesma cena.

## O que este teste permite concluir

O checkpoint oficial carrega e produz uma segmentação real em CPU. Entretanto,
não há máscaras de referência para essa fotografia, portanto **não calculamos
acurácia, F1 ou IoU**.

A sobreposição inclui regiões da carroceria vermelha, sugerindo possível confusão
entre pintura e corrosão. Isso é uma observação visual que exige revisão, não um
erro quantitativamente comprovado por rótulos.

Os seis quadros do artigo são versões de iluminação/gamma da mesma cena, com
pequenas diferenças de resolução. O percentual previsto como `Severe` muda de
0% no quadro (a) para aproximadamente 4,54% no quadro (e). Essa variação justifica
validar robustez antes de atribuir uma avaliação comercial automática ao lote.

Os percentuais têm como denominador **todos os pixels da imagem**, incluindo
chão, veículos e demais objetos. A classe `Good` está agrupada com `Background`:
95,11% nessa classe **não significa 95,11% de metal saudável ou puro**. As saídas
não estimam pureza química, fração em massa, nem composição do lote inteiro.

## Checkpoint e diferenças da documentação original

- Projeto: https://github.com/beric7/corrosion_cs_classification
- Pesos: https://doi.org/10.7294/16628668.v1
- Variante usada: `l2_loss/weights_35.pt`, escolhida porque a descrição oficial dos
  pesos associa seu melhor F1 a essa variante. O README do GitHub atribui o mesmo
  resultado à entropia cruzada ponderada; essa inconsistência não foi resolvida
  neste experimento e não presumimos que o desempenho publicado seja reproduzido.
- O carregamento revelou **ResNet101**, com blocos `[3, 4, 23, 3]` e **58.749.604
  parâmetros**, embora a descrição dos arquivos mencione ResNet50.
- SHA-256 do checkpoint:
  `07278842fb12931fa5aca2ed5573fe2d2d7529be8150ddecf65bc31f9a1ea477`.
- Download parcial verificado por tamanho e CRC do membro ZIP: 218,7 MB
  transferidos, em vez do pacote completo de 803,8 MB; arquivo extraído de 235,7 MB.
- Os metadados oficiais e o hash ficam ao lado do checkpoint em `weights/*.source.json`.

O código do modelo retém a licença MIT do autor. Os metadados dos pesos indicam
CC0. Para trabalhos e apresentações, citar Bianchi e Hebdon, o modelo e o artigo
*Development of Extendable Open-Source Structural Inspection Datasets*,
DOI `10.1061/(ASCE)CP.1943-5487.0001045`.

## Reexecutar na máquina atual

A partir da pasta principal do SmartScrap:

```powershell
.\.venv-corrosion\Scripts\python.exe experiments/corrosion/infer.py
```

Para analisar todas as versões da figura:

```powershell
.\.venv-corrosion\Scripts\python.exe experiments/corrosion/infer.py --all-panels
```

Para testar outra foto local:

```powershell
.\.venv-corrosion\Scripts\python.exe experiments/corrosion/infer.py --image "C:/caminho/foto.jpg" --output "experiments/corrosion/output/nova-foto"
```

O script aceita JPG/PNG e outros formatos suportados pelo Pillow. A entrada passa
por orientação EXIF, conversão BGR, resize para 512 × 512 e valores float em
0–255. Não usamos normalização ImageNet, pois o código original de inferência
usa pixels BGR sem essa normalização. Máscaras usam interpolação de vizinho mais
próximo; a geometria quadrada de entrada segue o código original.

## Preparar outro ambiente

Recomendado Python 3.12. O ambiente deste teste foi criado usando o Python 3.12
disponível no runtime do Codex, separado do Python 3.14 global.

```powershell
py -3.12 -m venv .venv-corrosion
.\.venv-corrosion\Scripts\python.exe -m pip install -r experiments/corrosion/requirements.txt
.\.venv-corrosion\Scripts\python.exe experiments/corrosion/download_weights.py --member "Corrosion Condition State Classification - Trained Model/l2_loss/weights_35.pt" --output "experiments/corrosion/weights/l2_loss_weights_35.pt"
```

`requirements-lock.txt` registra todas as versões instaladas. O código necessário
da rede está em `model_src/`, com licença e descrição dos dois ajustes de
compatibilidade. Não é necessário executar os scripts de treinamento originais.

O checkpoint legado contém um modelo completo serializado. O carregamento usa
`weights_only=True`, uma lista fixa de classes revisadas e verificação do hash;
não há fallback para desserialização irrestrita. O modelo fica em modo de avaliação
e a execução não usa gradientes nem acessa serviços externos.

`prepare_sample.py` permite repetir a extração dos seis quadros do PDF. Esse script
adicional requer `pypdf` e Pillow (já disponíveis no runtime usado para extrair as
imagens); ele não é necessário para inferência com uma foto ou os PNGs existentes.
