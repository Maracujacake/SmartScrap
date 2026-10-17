# SmartScrap no hackathon

## Opção pronta nesta máquina: rede local

Na pasta do projeto:

```powershell
npm run share
```

O comando gera a interface de produção e inicia a aplicação inteira na porta
3001, aceitando conexões pela rede. Fotos, análise por IA e SQLite continuam neste
computador. Os visitantes usam apenas o navegador, inclusive no celular.

O terminal mostra os endereços disponíveis. Use o endereço da conexão Wi-Fi ou
Ethernet do evento, por exemplo `http://192.168.0.130:3001`. O IP muda conforme a
rede; esse exemplo não é um endereço fixo. No próprio computador, use
`http://127.0.0.1:3001`. O endereço `127.0.0.1` não funciona nos celulares dos visitantes.

1. Conecte o computador e um celular à mesma rede.
2. Execute o comando e abra o endereço da rede no celular.
3. Se o Windows pedir acesso, permita Node.js somente na rede privada confiável.
4. Entre com uma conta de demonstração. Use contas diferentes para vendedor e comprador.
5. Mantenha o computador ligado, sem suspender, e o terminal aberto. Ctrl+C encerra.

Para deixar os slides no estande, abra `/apresentacao.html` nesse mesmo endereço,
por exemplo `http://192.168.0.130:3001/apresentacao.html`. A página não exige login.
Também é possível abrir `docs/apresentacao/SmartScrap-Apresentacao.html` diretamente
no navegador, mesmo sem servidor ou internet.

Não é necessário internet para a inferência quando os pesos já estão instalados.
O Wi-Fi precisa permitir comunicação entre os dispositivos. Redes de convidados
podem bloquear isso mesmo quando todos estão no mesmo Wi-Fi. Teste antes e leve
um roteador próprio ou um hotspot que permita comunicação entre clientes como
alternativa. O acesso por outro dispositivo depende também do firewall; essa
permissão não é alterada automaticamente pelo projeto.

`npm run dev` continua restrito ao computador local. O modo compartilhado usa
uma única porta para a interface e a API, evitando configurar CORS nos celulares.
Use apenas dados fictícios nesta demonstração HTTP da rede local. Para internet,
use HTTPS e a configuração abaixo.

## Deploy na internet

É possível hospedar o projeto completo. Ele precisa de um servidor/container que
execute **Node.js e Python/PyTorch CPU**, mantenha o processo do modelo ativo e
tenha **armazenamento persistente** para SQLite e fotografias. A interface estática
isolada não executa esse backend. Esta configuração usa uma única instância,
adequada ao MVP, com fila de análises serial.

Foram preparados `Dockerfile`, `.dockerignore` e `compose.yaml`. O build instala o
ambiente CPU e baixa apenas o checkpoint oficial necessário, verificando seu
SHA-256. Não envia o banco local, as fotos locais, as senhas de arquivos `.env`
ou o ambiente Python do computador para a imagem.

Docker não estava instalado nesta máquina durante a preparação. Portanto, a
imagem/container **ainda precisa ser construída e validada no provedor escolhido**.
O build e os testes da aplicação nativa foram executados aqui. Não há deploy
público nem serviço pago criado por esta alteração.

### Executar o container, quando Docker estiver disponível

```powershell
docker compose up --build -d
```

Abra `http://127.0.0.1:3001`. O volume `smartscrap-data` preserva banco e fotografias
entre reinicializações. Para encerrar, use `docker compose down`; não use a opção
`-v` se quiser preservar os dados. O Compose padrão expõe o container somente
na própria máquina. Para o evento nesta máquina, prefira `npm run share`.

### Exemplo de configuração no Render

1. Use o repositório do projeto e escolha um Web Service com runtime Docker.
2. Comece a avaliação com CPU e pelo menos 2 GB de RAM; valide consumo de memória,
   tempo de carregamento e a análise de três fotos antes do evento. Isso é uma
   configuração inicial sugerida, não uma garantia de capacidade.
3. Anexe um disco persistente em `/app/data`, inicialmente com 5 GB. Confirme que
   o usuário do container, UID 10001, tem permissão de escrita no disco.
4. Configure `COOKIE_SECURE=true`, `HOST=0.0.0.0` e `SEED_DEMO=true` para o hackathon.
   `PORT` pode ser fornecida pelo provedor. Use `/api/health` como health check.
5. Os caminhos de Python, pesos, banco e fotos já estão no Dockerfile. Mantenha
   apenas uma instância enquanto o armazenamento for SQLite e disco local.
6. Após o deploy, teste login, upload, inferência, publicação, negociação, seleção
   de transportadora e persistência após reiniciar o serviço.

No momento da consulta, 14/10/2026, o Render informa o plano `1c-2g` com 1 CPU e
2 GB de RAM. Seu preço divulgado é US$ 25/mês, mais US$ 0,25 por GB/mês de disco.
Com 5 GB, a referência seria US$ 26,25/mês, antes de impostos, câmbio, tráfego,
builds ou outros extras. Confirme os valores na contratação. Discos persistentes
exigem serviço pago; o plano gratuito não atende à persistência deste MVP.

Fontes: [planos de computação](https://render.com/docs/compute-plans),
[preços](https://render.com/pricing),
[discos persistentes](https://render.com/docs/disks) e
[limitações do plano gratuito](https://render.com/docs/free).

Para efetivamente publicar, falta escolher o provedor, usar a conta do responsável
e autorizar seu custo. Não compartilhe senhas ou tokens no chat. Depois de conectar
a conta no ambiente adequado, o container e este roteiro permitem continuar o deploy.
