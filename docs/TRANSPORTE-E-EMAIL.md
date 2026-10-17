# Transportadoras, fretes e e-mails

## Demonstração na rede local

Execute `npm run share` normalmente. O cadastro agora oferece Empresa, ONG / Cooperativa e Transportadora. Uma nova transportadora começa sem tarifas: sua equipe deve ativar os metais atendidos em **Tarifas de frete**. Colegas podem ingressar pelo mesmo mecanismo de convite.

Com a carga de demonstração ativa, a conta **carla@transportes.example**, senha **Demo@123**, representa a **Exemplo Transporters LTDA**. As tarifas iniciais são fictícias: R$ 0,0002 por kg/km e mínimo de R$ 150 para cada metal. A conta também é adicionada automaticamente a bancos de demonstração existentes, sem remover lotes ou negócios.

1. Entre como transportadora e confira o painel e as tarifas.
2. Em outra sessão, aceite uma proposta como vendedor. A coleta será criada.
3. Em **Coletas e entregas**, escolha **Escolher/Alterar responsável**, selecione a transportadora, informe a distância e quem paga.
4. Confira a estimativa, marque a confirmação e salve. Vendedor **ou** comprador pode confirmar sozinho.
5. A transportadora verá o serviço em **Meus transportes** e poderá agendar, iniciar e concluir a entrega. Somente vendedor e comprador podem alterar a empresa responsável e confirmar preços.
6. Os indicadores da transportadora contabilizam toneladas, lotes, quilômetros e valores de fretes concluídos no período. Serviços em andamento e respectivos valores confirmados aparecem separadamente. Atualize a página ou navegue novamente para buscar alterações feitas por outra sessão.

Transportadoras não publicam lotes nem enviam propostas de compra. Seus detalhes e fotografias ficam limitados aos lotes dos serviços atribuídos à empresa. Os valores de outras propostas permanecem privados.

## Cálculo do frete

`frete = máximo(peso em kg × distância em km × tarifa do metal, frete mínimo)`

`total registrado da operação = valor acordado do material + frete confirmado`

Exemplo fictício: 25 t = 25.000 kg. Com distância de 100 km e tarifa de R$ 0,0002 por kg/km, o frete é R$ 500. O mínimo só prevalece quando o cálculo resulta em valor inferior.

Tarifas aceitam até seis casas decimais. A API calcula com unidades inteiras e arredonda o resultado final para centavos. A distância aceita uma casa decimal, de 0,1 a 20.000 km, e é informada pelas partes; não representa uma rota consultada em mapas.

A coleta guarda uma cópia da tarifa, mínimo, distância, pagador, valor e responsável pela confirmação. Alterar a tabela de preços não altera fretes confirmados. Se a tarifa mudar entre a consulta do orçamento e sua confirmação, a API exige uma nova confirmação. Alterar transportadora, distância ou pagador também exige confirmação do novo orçamento. Depois do início do transporte, a logística e o frete ficam congelados.

O frete terceirizado precisa estar confirmado antes de agendar ou iniciar o transporte. Ao escolher frota do vendedor ou comprador, o frete terceirizado é removido; custos próprios ficam fora do registro da plataforma. O total não representa pagamento efetuado. Caso o vendedor pague o frete, a soma continua indicando o valor da operação, e não uma cobrança integral ao comprador.

Transportadoras antigas cadastradas apenas por nome são preservadas. Elas aparecem como **sem tarifas** até existir configuração. Para uma coleta antiga ainda não iniciada, escolha uma transportadora com tarifas e confirme o orçamento, ou selecione frota própria. Serviços antigos sem preço não recebem valores inventados retroativamente.

## Envio de e-mails por SMTP

O aplicativo registra e-mails quando:

- Um lote é publicado: confirmação para o usuário que publicou.
- Uma proposta é enviada: confirmação para o usuário comprador e aviso para todos os membros da organização vendedora.

As mensagens ficam no SQLite na mesma transação da operação. A entrega SMTP ocorre em segundo plano e não bloqueia o cadastro ou a proposta. Cada usuário consulta apenas suas próprias mensagens em **E-mails**.

Para configurar depois:

1. Copie `.env.example` para `.env` na raiz do projeto.
2. Preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` e, quando necessário, `SMTP_USER` e `SMTP_PASS`, com os dados do seu serviço.
3. Reinicie `npm run share` ou `npm run dev`.

Na porta 587, mantenha `SMTP_SECURE=false`: a conexão exige atualização STARTTLS. Para TLS direto, normalmente porta 465, use `SMTP_SECURE=true`. A verificação dos certificados permanece ativa. A biblioteca usada é [Nodemailer](https://nodemailer.com/smtp).

Sem host ou remetente configurados, as mensagens permanecem **Aguardando envio**. Após a configuração, as pendências são processadas automaticamente, inclusive mensagens antigas de demonstração. Endereços precisam ter formato de e-mail, mas não há verificação de existência da caixa postal. Endereços de teste podem ser recusados ou aceitos pelo SMTP e falhar na entrega posterior.

Há até três tentativas automáticas, com espera crescente. O histórico mostra falhas sem expor credenciais. **Enviado** significa aceito pelo servidor SMTP; não confirma entrega na caixa de entrada. Reiniciar o serviço recupera mensagens interrompidas. O registro único evita enfileirar o mesmo evento duas vezes; uma interrupção ambígua após aceite SMTP ainda pode causar reenvio. O Message-ID é estável entre tentativas.

O servidor da aplicação precisa de acesso à internet para usar um SMTP externo. As demais funções seguem locais. Credenciais ficam no `.env`, ignorado pelo Git, e não são enviadas ao navegador. Nenhum provedor externo foi configurado nesta implementação.

## Manutenção e validação

- `server/db/logistics.js`: migração compatível com os bancos existentes, tabelas de tarifas e e-mails, conta demonstrativa.
- `server/services/freight.js`: cálculo e identificação do orçamento.
- `server/services/pickup.js`: confirmação, permissão e progressão da coleta.
- `server/services/email.js`: fila, SMTP e tentativas.
- `server/routes/transport.js`: tarifas e indicadores da transportadora.
- `src/TransportDashboard.jsx`, `src/TransportRates.jsx`, `src/Emails.jsx` e `src/pickups/`: telas e formulários.

`npm test` inclui migração do tipo de organização antigo, permissões, precisão e mínimo do frete, confirmação unilateral, preservação de preço, isolamento de mensagens, falhas e uma troca SMTP com servidor local de teste. Isso não valida a entrega em um provedor externo ainda não configurado.
