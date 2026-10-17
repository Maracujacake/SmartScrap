# Organização do código

A refatoração separa responsabilidades sem alterar URLs, contratos da API,
validações, transações, banco de dados ou fluxos da interface.

## API

- `server/app.js`: cria o Express e registra os módulos na ordem de execução.
  Saúde, login e cadastro são públicos. As demais rotas ficam depois da
  autenticação; os tratamentos de erro ficam por último.
- `server/routes/`: endpoints separados por autenticação, lotes, propostas,
  organizações, coletas, dashboard, notificações, perfil e análise visual.
- `server/services/`: sessões e limite de tentativas, negociação de propostas
  e atualização de coletas. Aceite de propostas e alterações de logística
  continuam executados nas mesmas transações.
- `server/validation.js`, `constants.js` e `queries.js`: validações e definições
  compartilhadas entre as áreas da API.
- `server/database.js`: inicializa a conexão. `server/db/` contém o esquema,
  as migrações, a transação e os dados de demonstração; `server/security/`
  contém o tratamento de senhas. As exportações anteriores de `database.js`
  continuam disponíveis.
- `server/visual-analysis.js`: coordena análises, fila, fotografias e vínculo
  com lotes. `server/visual-analysis/` isola a configuração de caminhos e a
  comunicação com o processo Python.

Para alterar uma regra de negociação, comece pelo serviço correspondente.
Para alterar um endpoint ou seu formato de resposta, comece pelo módulo em
`routes/`. Não mova uma rota protegida para antes da autenticação em `app.js`.

## Interface

- `src/App.jsx`: mantém sessão, navegação, atualizações e abertura dos modais.
- `src/layout/`: navegação lateral, barra superior, perfil e notificações.
- `src/lots/`: publicação, detalhes, cartões, ofertas e avaliação de propostas.
- `src/Proposals.jsx`: tela de propostas recebidas e enviadas.
- `src/pickups/`: cartão de acompanhamento e formulário de atualização da coleta.
- `src/dashboard/`: indicadores e gráficos do dashboard.
- `src/visual-analysis/`: apresentação das fotografias e resultados do modelo.
- `src/hooks/useData.js`: busca de dados com cancelamento e nova tentativa.
- `src/components.jsx`: elementos compartilhados de interface. Mantém também
  a exportação de `useData` para compatibilidade.

Os estados e efeitos existentes permanecem nos componentes que os controlavam.
As partes extraídas recebem dados e callbacks, sem introduzir novas regras de
negócio. As exportações nomeadas anteriores de `Lots.jsx` e `VisualAnalysis.jsx`
continuam disponíveis.

## Estilos e manutenção

`src/styles.css` é o ponto de entrada. Os arquivos em `src/styles/` seguem a
ordem original das regras, incluindo os ajustes responsivos e as extensões.
Essa ordem faz parte da cascata: não reordene os imports sem conferir a interface.

```powershell
npm test
npm run build
npm run format
npm run format:check
```

O Prettier padroniza JavaScript, JSX, CSS, testes e scripts. `format` aplica a
formatação; `format:check` verifica o padrão sem modificar os arquivos. Os
testes cobrem autenticação, negociação, logística, migração, análise visual e
os contratos de proteção e resposta da API.

## Validação da refatoração

- Os 14 testes existentes passaram antes das alterações.
- Após a refatoração, passaram os 17 testes, incluindo três testes adicionais
  para contratos e ordem das proteções da API.
- O build de produção e a checagem de formatação passaram.
- Uma verificação auxiliar renderizou 29 cenários React com dados simulados,
  incluindo páginas, menus, publicação, propostas, coletas e análise visual.
  Essa verificação não executa interações em um navegador e não representa
  uma comparação visual automática com a versão anterior.
