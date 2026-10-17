# SmartScrap em cerca de dois minutos

Use os seis slides como apoio visual e, em seguida, mostre uma negociação no
aplicativo. Para visitantes que passam pelo estande, deixe a versão HTML em
**Reproduzir em ciclo**: ela avança a cada 20 segundos e volta ao início.

## 1. Apresentação — 15 segundos

O SmartScrap conecta organizações que oferecem sucata industrial a empresas e
ONGs que podem reaproveitar esses materiais. A equipe de cada organização
compartilha os lotes, as propostas e os indicadores.

## 2. Relevância — 25 segundos

O Instituto Aço Brasil informa que suas associadas reciclaram 7,7 milhões de
toneladas de sucata em 2023. Desse volume, 5,3 milhões vieram de fontes externas.
A sucata já participa da cadeia produtiva. Queremos facilitar o encontro entre
oferta e demanda e o acompanhamento das negociações.

A worldsteel estima que cada tonelada de sucata usada na produção de aço evita
1,5 tonelada de CO₂. Essa é uma referência do setor, não um resultado medido pelo
nosso aplicativo.

## 3. Fluxo — 25 segundos

O operador publica um lote com metal, peso, preço e fotos opcionais. Outra
organização envia uma proposta. O vendedor aceita e a negociação segue para a
coleta. Qualquer uma das partes escolhe a empresa responsável pelo transporte.
O sistema acompanha a situação até a entrega.

## 4. IA — 25 segundos

Nos lotes de aço e ferro, um modelo local destaca regiões que podem apresentar
corrosão. O operador vê a imagem, a máscara e a sobreposição. Ele pode discordar
e registrar sua observação. É uma avaliação visual experimental, que ainda
precisa de validação em campo e não mede pureza química.

## 5. Logística — 15 segundos

Vendedor ou comprador pode escolher uma transportadora cadastrada ou a frota
própria de uma das empresas. Uma empresa precisa estar associada para a coleta
avançar. A Exemplo Transporters LTDA é fictícia e serve para demonstrar a seleção.

## 6. Próximo passo — 15 segundos

O protótipo já permite demonstrar o ciclo completo. O próximo passo é um piloto
com empresas da região e especialistas em materiais. Queremos avaliar as fotos
reais e medir tempo até proposta, volume negociado e conclusão das coletas.

## Demonstração rápida no aplicativo

1. Entre como Ana, publique um lote e mostre a avaliação visual já disponível no
   lote demonstrativo **SS-2026-0034**. A primeira análise pode incluir carregamento
   do modelo; para uma passagem curta, use o resultado salvo.
2. Entre como Lucas em outro navegador/perfil, envie uma oferta e volte à conta
   da Ana para aceitar.
3. Abra **Coletas e entregas**, escolha a Exemplo Transporters LTDA ou a frota
   própria de uma das partes e mostre as etapas.

As contas, os valores, o volume negociado mostrado no dashboard e a transportadora
de exemplo são fictícios. Não apresentamos número de clientes, economia financeira
ou emissões reduzidas como resultados do SmartScrap.

## Fontes e recortes

- [Instituto Aço Brasil — Aço & Sustentabilidade 2024](https://www.acobrasil.org.br/site/wp-content/uploads/2022/08/Folder_AcoBrasil_Sustentabilidade_2024.pdf),
  páginas impressas 7 e 10. Dados das associadas em **2023**: 2,4 milhões t de sucata
  interna e 5,3 milhões t externa, totalizando 7,7 milhões t recicladas. O recorte
  não corresponde a todo o Brasil e não mede desperdício, necessidade não atendida
  ou mercado que a plataforma conseguirá capturar.
- [worldsteel — Raw materials](https://worldsteel.org/about-steel/raw-materials/),
  seção Scrap. Referência setorial de 1,5 t de CO₂ evitadas por tonelada de sucata
  utilizada na produção de aço. O aplicativo não calcula esse indicador.
- [Modelo de corrosão de Bianchi e Hebdon](https://github.com/beric7/corrosion_cs_classification).
  A apresentação mostra a execução local de um checkpoint oficial, sem treinamento
  adicional. A fotografia é um exemplo fornecido pelo usuário a partir do artigo
  *Classification and rating of steel scrap using deep learning*,
  DOI `10.1016/j.engappai.2023.106241`. Não há máscara de referência dessa foto.

Fontes consultadas em 14/10/2026. Os links e referências também estão nas notas
dos slides e na opção **Fontes e escopo** da versão HTML.

## Arquivos

- `SmartScrap-Hackathon-Final.pptx`: apresentação editável, com gráfico nativo e notas.
- `SmartScrap-Hackathon.pdf`: versão portátil para abrir em qualquer leitor de PDF.
- `SmartScrap-Apresentacao.html`: arquivo independente, abre offline no navegador.
  Teclas: esquerda/direita para navegar, espaço para iniciar/pausar o ciclo,
  Home/End para início/fim. Pode abrir também por `/apresentacao.html` no aplicativo.
