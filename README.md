# SmartScrap Exchange

Marketplace de sucata industrial para conectar empresas, ONGs e cooperativas. Interface em português inspirada na referência visual do projeto, com React, Tailwind CSS, Vite e Lucide. API em JavaScript com Express e banco SQLite persistente.

O cadastro também inclui **Transportadora**, com painel próprio, tarifas por metal e acompanhamento dos serviços atribuídos. Fretes terceirizados têm orçamento por peso × distância, confirmação por vendedor ou comprador e total separado do material. Confirmações de publicação e propostas ficam em uma fila de e-mails preparada para SMTP. Veja o [guia de transporte e e-mails](docs/TRANSPORTE-E-EMAIL.md), incluindo a conta demonstrativa e a configuração posterior do envio.

## Executar localmente

Requisito: **Node.js 22.13 ou superior** (recomendado Node 24 ou 25).

```powershell
npm install
npm run dev
```

Abra **http://127.0.0.1:5173**. A API funciona na porta 3001. O comando inicia os dois processos. Use Ctrl+C para encerrá-los.

Para demonstrar a outras pessoas na mesma rede, use `npm run share`. Ele gera o
build e mostra o endereço que os visitantes devem abrir no navegador. Consulte
[`docs/ACESSO-E-DEPLOY.md`](docs/ACESSO-E-DEPLOY.md) para Wi-Fi, firewall e a
configuração Docker preparada para hospedagem na internet.

## Apresentação do projeto

Há seis slides e um roteiro de cerca de dois minutos em
[`docs/apresentacao/`](docs/apresentacao/ROTEIRO.md), nos formatos PowerPoint,
PDF e HTML independente. No aplicativo, use **Apresentação do projeto** na barra
lateral ou abra `/apresentacao.html`. A apresentação não exige login. O modo
**Reproduzir em ciclo** avança a cada 20 segundos; o arquivo HTML independente
também funciona offline, sem instalar PowerPoint.

As fontes setoriais estão nas notas dos slides, no roteiro e em **Fontes e escopo**.
Os dados do protótipo e os preços são fictícios; o material diferencia as
referências do setor dos resultados que ainda precisam de validação em piloto.

Na tela de login, clique em **Explorar demonstração** para entrar como Ana Paula, da Metalúrgica Horizonte. Os dados são fictícios, persistem no SQLite e permitem negociar de verdade dentro da demonstração.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Empresa vendedora | ana@horizonte.com.br | Demo@123 |
| Colega da mesma empresa | pedro@horizonte.com.br | Demo@123 |
| Empresa compradora | lucas@ecometal.com.br | Demo@123 |
| Outra empresa | marina@alumitech.com.br | Demo@123 |
| ONG | bia@recomeco.org.br | Demo@123 |
| Cooperativa | joao@verdevida.org.br | Demo@123 |
| Transportadora | carla@transportes.example | Demo@123 |

Para testar organizações diferentes ao mesmo tempo, use perfis diferentes do navegador ou uma janela anônima. Cada navegador compartilha sua sessão entre as abas.

## Fluxo para o hackathon

1. Entre na demonstração e veja o dashboard da Metalúrgica Horizonte.
2. Publique um lote ou abra um lote que já recebeu proposta na aba **Propostas**.
3. Entre como Lucas em uma janela anônima. Em **Postagens gerais**, filtre pela Metalúrgica Horizonte e envie uma oferta por kg para o lote completo.
4. Volte à conta da Ana, abra **Propostas** e confirme o aceite. O lote é marcado como negociado, as propostas concorrentes são recusadas e uma coleta é criada.
5. Em **Coletas e entregas**, escolha uma transportadora, informe distância e pagador e confirme o orçamento, ou selecione frota própria do vendedor/comprador. Agende a retirada e avance até a entrega. Qualquer parte pode confirmar sozinha antes do início do transporte; a transportadora acompanha seus serviços em uma conta própria.
6. Confira os indicadores da empresa e as notificações de ambas as organizações. Atualize a página da outra janela para buscar as alterações.
7. Em **Configurações**, copie o código de convite. No cadastro, use **Já faço parte de uma** para adicionar um novo usuário à mesma organização.

## O que está implementado

- Login, logout, cadastro de empresa/ONG/transportadora, ingresso por convite e edição de perfil/senha.
- Dashboard por organização com período de 7, 30, 90 ou 365 dias; vendas, compras, valor movimentado, lotes ativos, composição dos metais e gráfico.
- Publicação de lotes com peso em toneladas e preço por kg. Valores totais calculados em centavos.
- Cadastro sem campo de pureza/classificação manual; avaliação visual e observações acompanham as fotos. Exemplos fictícios de preço por kg variam conforme o metal.
- Envio de 1 a 3 fotografias por lote, análise local de corrosão com DeepLabV3+, máscaras, sobreposições e revisão do operador.
- Meus lotes compartilhados entre colegas; filtros por material, status e busca.
- Postagens de outras organizações, filtro por empresa/ONG e visualização em lista ou cartões.
- Propostas recebidas/enviadas, privacidade das ofertas entre compradores, aceite e recusa pelo vendedor.
- Diretórios de empresas e ONGs/cooperativas que já publicaram lotes.
- Coletas automáticas após aceite, agendamento e progressão de situação, acessíveis somente às partes da negociação.
- Seleção de empresa responsável pelo transporte, incluindo frota própria de uma das partes. A transportadora fictícia **Exemplo Transporters LTDA** acompanha os dados de demonstração.
- Painel da transportadora, tarifas por metal, frete mínimo, orçamento por kg/km e total da operação com frete confirmado.
- Confirmações de publicação e propostas por e-mail, com fila persistente, configuração SMTP posterior e histórico privado por usuário.
- Notificações dentro do aplicativo por organização, com leitura compartilhada entre membros.
- Layout responsivo, navegação móvel, estados vazios, mensagens de erro, confirmações e formulários acessíveis.

## Banco de dados e segurança

O banco é criado automaticamente em `data/smartscrap.sqlite`, fora do código-fonte. O histórico de demonstração é criado somente quando o banco está vazio. Não é necessário instalar um serviço SQLite: o projeto usa o módulo nativo `node:sqlite` (algumas versões do Node exibem um aviso de recurso experimental).

As tabelas são `organizations`, `users`, `sessions`, `lots`, `proposals`, `trades`, `pickups`, `transport_companies`, `transport_rates`, `email_outbox`, `notifications`, `visual_analyses` e `visual_photos`. Os usuários pertencem a uma organização; lotes e negociações pertencem à organização. Membros da mesma organização compartilham permissões; transportadoras têm acesso operacional aos seus fretes, sem publicar ou comprar lotes. O histórico de e-mails é privado por usuário.

A migração preserva os lotes e negociações existentes. A coluna legada `quality`
continua no banco para preservar dados antigos, mas não aparece na interface,
não é exigida e não recebe classificação manual nos novos cadastros. As antigas
transportadoras em texto livre são relacionadas ao cadastro de transportadoras.

O responsável pela coleta pode ser alterado por vendedor ou comprador enquanto
aguarda agendamento ou está agendada. A seleção exige uma transportadora ativa
ou uma das organizações participantes. O sistema impede agendamento/início sem
essa associação e, no transporte terceirizado, sem orçamento confirmado. Congela a escolha quando o transporte começa. A seleção é um
registro interno: não contrata frete ou serviços externos automaticamente.

Senhas usam scrypt com salt individual. Sessões usam cookies HttpOnly/SameSite e tokens aleatórios cujo hash é salvo no banco. Consultas usam parâmetros, as ações validam a organização participante e o aceite de propostas ocorre em transação para evitar vendas duplicadas. Os dados financeiros são salvos em centavos; peso em toneladas.

O código de convite permite ingresso na organização: compartilhe somente com sua equipe. O MVP não inclui aprovação administrativa, validação documental, pagamento, contratação real de frete ou anexos além das fotos do lote. E-mails de publicação e propostas dependem de configuração SMTP; sem ela, ficam pendentes. As notificações internas são consultadas ao abrir/atualizar telas e após ações; não há push ou WebSocket.

Para iniciar sem contas de demonstração, use um caminho de banco novo e desative a carga inicial:

```powershell
$env:SEED_DEMO = 'false'
$env:DB_PATH = 'data/real.sqlite'
npm run dev
```

`DB_PATH`, `HOST`, `PORT`, `SEED_DEMO` e `COOKIE_SECURE` são variáveis de ambiente opcionais. A porta 3001 deve ser mantida no desenvolvimento, pois é o destino configurado do proxy Vite. `HOST` é `127.0.0.1` por padrão e `0.0.0.0` no modo de rede local/container.

## Verificação e build

```powershell
npm test
npm run build
npm start
```

Após o build, **http://127.0.0.1:3001** serve a interface e a API juntas. `npm start`
fica restrito à máquina local, a menos que `HOST` seja configurado. `npm run share`
permite acesso pela rede. Para hospedar dados reais, configure HTTPS,
`COOKIE_SECURE=true`, backup persistente do SQLite e das fotos e desative as contas
de demonstração. O projeto ainda não foi publicado na internet.

Os testes usam um banco isolado em memória e cobrem autenticação, organizações, convites, filtros, propostas, privacidade, concorrência de aceite, atualização do dashboard, coletas, notificações e troca de senha.

## Avaliação visual integrada ao cadastro

O cadastro de lotes aceita **1 a 3 fotos opcionais**, JPG, PNG ou WebP, de até
8 MB por foto, com pelo menos 256 pixels em cada dimensão e no máximo 20 milhões
de pixels. Ao trocar o tipo de metal, selecione novamente as fotos para evitar
associar uma análise ao material errado.

1. Em **Publicar lote**, escolha o material e as fotos do mesmo lote.
2. Clique em **Analisar fotografias** e continue preenchendo os demais campos.
3. Confira cada foto nas visualizações **Original**, **Sobreposição** e **Máscara**.
4. Indique concordância ou discordância. Ao discordar, explique nas observações.
5. Publique. As fotos, o resultado original e a revisão ficam nos detalhes do lote,
   acessíveis aos colegas da organização e às organizações que consultam o marketplace.

O modelo é o **DeepLabV3+ com ResNet101**, checkpoint oficial L2 do experimento.
Avalia sinais visuais de corrosão em **aço e ferro**, sem treinamento adicional.
Para alumínio, cobre, inox e outros materiais, registramos as fotografias com uma
indicação de que não há avaliação disponível. Não produzimos uma nota fictícia.
Os percentuais são calculados sobre todos os pixels de cada foto, inclusive o
fundo; não medem pureza química, composição, fração em massa ou qualidade comercial.
`Good` e `Background` são uma classe agrupada. As observações não alteram as saídas
do modelo e não iniciam treinamento automático.

Os exemplos de preço são: aço R$ 1,25/kg, ferro R$ 0,65/kg, alumínio R$ 8,20/kg,
cobre R$ 32,00/kg, inox R$ 7,90/kg e outros R$ 1,00/kg. Servem apenas para
demonstração, sem representar cotações atuais, ligas específicas ou a região.
O valor continua sendo informado pelo anunciante; trocar o metal atualiza o
placeholder sem substituir um preço que já foi digitado.

### Ambiente local

Na máquina atual, o ambiente Python e os pesos já estão preparados. Basta executar
`npm run dev` normalmente. Em outro computador, siga a preparação em
[`experiments/corrosion/README.md`](experiments/corrosion/README.md), incluindo o
download dos pesos e de seu arquivo de procedência `.source.json`.

A API inicia um processo Python sob demanda e mantém o modelo carregado para
processar as fotos em fila, uma análise por vez. A primeira execução inclui o
carregamento do modelo e pode levar mais tempo. Há limite de 120 segundos por
análise; falhas aparecem na interface e permitem nova tentativa. Uma reinicialização
marca análises interrompidas como falhas, permitindo retomá-las pela API.

Variáveis opcionais: `CORROSION_PYTHON` (executável Python), `CORROSION_WEIGHTS`
(checkpoint `.pt`, acompanhado do `.source.json`) e `CORROSION_DATA_DIR`
(pasta persistente dos arquivos). O padrão é `.venv-corrosion/Scripts/python.exe`
no Windows, `.venv-corrosion/bin/python` em outros sistemas, e
`experiments/corrosion/weights/l2_loss_weights_35.pt` para os pesos.

Fotografias e saídas ficam em `data/visual-analyses/<UUID>/`; resultados, vínculo
com o lote e revisão ficam no SQLite. Faça backup **do banco e da pasta de fotos**.
Os arquivos não são servidos como uma pasta pública: toda leitura exige sessão.
Antes da publicação, apenas a organização de origem pode consultá-los. A versão
publicada é reencodificada, com orientação EXIF corrigida, sem EXIF/GPS, limitada
a 1600 pixels por lado. O arquivo recebido permanece privado na pasta da análise.
A inferência usa 512 × 512 e o pré-processamento BGR do código dos autores.

### API de fotografias

- `POST /api/visual-analyses`: `{material, photos:["foto.jpg"]}` cria um rascunho.
- `PUT /api/visual-analyses/:id/photos/:position`: bytes da foto, tipo
  `application/octet-stream`, posição começando em zero.
- `POST /api/visual-analyses/:id/start`: `{}` enfileira a análise.
- `GET /api/visual-analyses/:id`: situação e resultado; `GET .../status` informa limites e disponibilidade.
- `GET /api/visual-analyses/:id/images/:position/:kind`: `original`, `overlay` ou `mask`.
- `DELETE /api/visual-analyses/:id`: `{}` descarta rascunhos que não estão em execução.
- `POST /api/lots`: campos habituais, mais `visualAnalysisId`, `visualReview`
  (`agree`/`disagree`) e `visualNotes`. A vinculação é atômica e a análise só pode
  ser utilizada em um lote da mesma organização e do mesmo material.

Os testes automatizados da API usam um executor simulado para verificar regras
de acesso, limites, falhas, revisão e publicação sem carregar pesos. O fluxo real
com três fotos também foi verificado pelo navegador na máquina atual.

Para executar os quatro testes de validação das fotografias (orientação EXIF,
remoção de metadados, resolução mínima, arquivos corrompidos, animações e limite
de pixels), sem carregar o checkpoint:

```powershell
.\.venv-corrosion\Scripts\python.exe experiments/corrosion/test_worker.py
```

## Organização do projeto

Consulte [`docs/ESTRUTURA-DO-CODIGO.md`](docs/ESTRUTURA-DO-CODIGO.md) para localizar
rotas, serviços, componentes e estilos. Use `npm run format` para padronizar a
formatação e `npm run format:check` para conferi-la sem alterar arquivos.

```text
src/          Interface React e estilos
server/       API, regras de acesso, schema e dados de demonstração
scripts/      Inicialização conjunta da interface e API
tests/        Testes de integração do fluxo completo
experiments/  Modelo de corrosão, processo Python e experimento de referência
public/       Identidade visual
data/         SQLite e fotografias gerados localmente (ignorados pelo Git)
```
