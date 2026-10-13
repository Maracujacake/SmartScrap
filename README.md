# SmartScrap Exchange

Marketplace de sucata industrial para conectar empresas, ONGs e cooperativas. Interface em português inspirada na referência visual do projeto, com React, Tailwind CSS, Vite e Lucide. API em JavaScript com Express e banco SQLite persistente.

## Executar localmente

Requisito: **Node.js 22.13 ou superior** (recomendado Node 24 ou 25).

```powershell
npm install
npm run dev
```

Abra **http://127.0.0.1:5173**. A API funciona na porta 3001. O comando inicia os dois processos. Use Ctrl+C para encerrá-los.

Na tela de login, clique em **Explorar demonstração** para entrar como Ana Paula, da Metalúrgica Horizonte. Os dados são fictícios, persistem no SQLite e permitem negociar de verdade dentro da demonstração.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Empresa vendedora | ana@horizonte.com.br | Demo@123 |
| Colega da mesma empresa | pedro@horizonte.com.br | Demo@123 |
| Empresa compradora | lucas@ecometal.com.br | Demo@123 |
| Outra empresa | marina@alumitech.com.br | Demo@123 |
| ONG | bia@recomeco.org.br | Demo@123 |
| Cooperativa | joao@verdevida.org.br | Demo@123 |

Para testar organizações diferentes ao mesmo tempo, use perfis diferentes do navegador ou uma janela anônima. Cada navegador compartilha sua sessão entre as abas.

## Fluxo para o hackathon

1. Entre na demonstração e veja o dashboard da Metalúrgica Horizonte.
2. Publique um lote ou abra um lote que já recebeu proposta na aba **Propostas**.
3. Entre como Lucas em uma janela anônima. Em **Postagens gerais**, filtre pela Metalúrgica Horizonte e envie uma oferta por kg para o lote completo.
4. Volte à conta da Ana, abra **Propostas** e confirme o aceite. O lote é marcado como negociado, as propostas concorrentes são recusadas e uma coleta é criada.
5. Em **Coletas e entregas**, agende a retirada, informe a transportadora e avance para transporte e entrega concluída.
6. Confira os indicadores da empresa e as notificações de ambas as organizações. Atualize a página da outra janela para buscar as alterações.
7. Em **Configurações**, copie o código de convite. No cadastro, use **Já faço parte de uma** para adicionar um novo usuário à mesma organização.

## O que está implementado

- Login, logout, cadastro de empresa/ONG, ingresso por convite e edição de perfil/senha.
- Dashboard por organização com período de 7, 30, 90 ou 365 dias; vendas, compras, valor movimentado, lotes ativos, composição dos metais e gráfico.
- Publicação de lotes com peso em toneladas e preço por kg. Valores totais calculados em centavos.
- Meus lotes compartilhados entre colegas; filtros por material, status e busca.
- Postagens de outras organizações, filtro por empresa/ONG e visualização em lista ou cartões.
- Propostas recebidas/enviadas, privacidade das ofertas entre compradores, aceite e recusa pelo vendedor.
- Diretórios de empresas e ONGs/cooperativas que já publicaram lotes.
- Coletas automáticas após aceite, agendamento e progressão de situação, acessíveis somente às partes da negociação.
- Notificações dentro do aplicativo por organização, com leitura compartilhada entre membros.
- Layout responsivo, navegação móvel, estados vazios, mensagens de erro, confirmações e formulários acessíveis.

## Banco de dados e segurança

O banco é criado automaticamente em `data/smartscrap.sqlite`, fora do código-fonte. O histórico de demonstração é criado somente quando o banco está vazio. Não é necessário instalar um serviço SQLite: o projeto usa o módulo nativo `node:sqlite` (algumas versões do Node exibem um aviso de recurso experimental).

As tabelas são `organizations`, `users`, `sessions`, `lots`, `proposals`, `trades`, `pickups` e `notifications`. Os usuários pertencem a uma organização; lotes e negociações pertencem à organização. Todos os membros têm as mesmas permissões neste MVP.

Senhas usam scrypt com salt individual. Sessões usam cookies HttpOnly/SameSite e tokens aleatórios cujo hash é salvo no banco. Consultas usam parâmetros, as ações validam a organização participante e o aceite de propostas ocorre em transação para evitar vendas duplicadas. Os dados financeiros são salvos em centavos; peso em toneladas.

O código de convite permite ingresso na organização: compartilhe somente com sua equipe. O MVP não inclui aprovação administrativa, validação documental, pagamento, frete real, anexos ou notificações externas. As notificações são consultadas ao abrir/atualizar telas e após ações; não há push ou WebSocket.

Para iniciar sem contas de demonstração, use um caminho de banco novo e desative a carga inicial:

```powershell
$env:SEED_DEMO = 'false'
$env:DB_PATH = 'data/real.sqlite'
npm run dev
```

`DB_PATH`, `PORT`, `SEED_DEMO` e `COOKIE_SECURE` são variáveis de ambiente opcionais. A porta 3001 deve ser mantida no desenvolvimento, pois é o destino configurado do proxy Vite.

## Verificação e build

```powershell
npm test
npm run build
npm start
```

Após o build, **http://127.0.0.1:3001** serve a interface e a API juntas. O servidor fica restrito à máquina local. Para hospedar futuramente, configure HTTPS, `COOKIE_SECURE=true`, acesso de rede, backup persistente do SQLite e desative as contas de demonstração. O projeto não foi publicado na internet.

Os testes usam um banco isolado em memória e cobrem autenticação, organizações, convites, filtros, propostas, privacidade, concorrência de aceite, atualização do dashboard, coletas, notificações e troca de senha.

## Organização do projeto

```text
src/          Interface React e estilos
server/       API, regras de acesso, schema e dados de demonstração
scripts/      Inicialização conjunta da interface e API
tests/        Testes de integração do fluxo completo
public/       Identidade visual
data/         SQLite gerado localmente (ignorado pelo Git)
```
