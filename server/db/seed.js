import { transaction } from './transaction.js';
import { hashPassword } from '../security/passwords.js';

export function seed(db) {
  transaction(db, () => {
    const org = db.prepare(
      'INSERT INTO organizations (name,type,city,state,sector,description,invite_code) VALUES (?,?,?,?,?,?,?)',
    );
    [
      [
        'Metalúrgica Horizonte',
        'company',
        'São Paulo',
        'SP',
        'Metalurgia',
        'Transformamos metais e construímos novas possibilidades para a indústria.',
        'HORIZONTE-DEMO',
      ],
      [
        'EcoMetal Reciclagem',
        'company',
        'Campinas',
        'SP',
        'Reciclagem',
        'Especialistas em recuperação de metais e soluções circulares.',
        'ECOMETAL-DEMO',
      ],
      [
        'Alumitech Indústria',
        'company',
        'Sorocaba',
        'SP',
        'Indústria de alumínio',
        'Alumínio de qualidade para um futuro mais leve.',
        'ALUMITECH-DEMO',
      ],
      [
        'Circular Brasil',
        'company',
        'Curitiba',
        'PR',
        'Gestão de resíduos',
        'Conectamos resíduos a novas cadeias de valor.',
        'CIRCULAR-DEMO',
      ],
      [
        'Instituto Recomeço',
        'ngo',
        'São Paulo',
        'SP',
        'Inclusão social',
        'Geramos renda e oportunidades por meio da reciclagem.',
        'RECOMECO-DEMO',
      ],
      [
        'Cooperativa Verde Vida',
        'ngo',
        'Santos',
        'SP',
        'Cooperativa de reciclagem',
        'Reciclagem que transforma o meio ambiente e a comunidade.',
        'VERDEVIDA-DEMO',
      ],
    ].forEach((row) => org.run(...row));
    const user = db.prepare(
      'INSERT INTO users (organization_id,name,email,password_hash) VALUES (?,?,?,?)',
    );
    [
      [1, 'Ana Paula', 'ana@horizonte.com.br'],
      [1, 'Pedro Santos', 'pedro@horizonte.com.br'],
      [2, 'Lucas Oliveira', 'lucas@ecometal.com.br'],
      [3, 'Marina Costa', 'marina@alumitech.com.br'],
      [4, 'Rafael Lima', 'rafael@circular.com.br'],
      [5, 'Beatriz Souza', 'bia@recomeco.org.br'],
      [6, 'João Silva', 'joao@verdevida.org.br'],
    ].forEach((row) => user.run(...row, hashPassword('Demo@123')));
    const lot = db.prepare(
      'INSERT INTO lots (organization_id,title,material,weight,price_cents,quality,description,city,state,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    );
    const daysAgo = (days) =>
      new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const entries = [
      [
        1,
        'Retalhos de aço carbono A36',
        'Aço',
        25,
        125,
        'A36 · 95% de pureza',
        'Retalhos de chapas de aço carbono, separados e sem contaminação. Material disponível para retirada em nosso parque industrial.',
        'São Paulo',
        'SP',
        1,
      ],
      [
        1,
        'Perfis de alumínio 6063',
        'Alumínio',
        8.4,
        820,
        'Liga 6063 · 92% de pureza',
        'Perfis de alumínio provenientes do processo de extrusão. Material limpo e separado por liga.',
        'São Paulo',
        'SP',
        2,
      ],
      [
        1,
        'Sucata de ferro misto',
        'Ferro',
        40,
        65,
        'Ferro misto · 88% de pureza',
        'Sucata ferrosa de manutenção industrial, separada e pronta para pesagem.',
        'São Paulo',
        'SP',
        1,
      ],
      [
        1,
        'Aparas de aço inox 304',
        'Inox',
        12.5,
        790,
        '304 · 98% de pureza',
        'Aparas e retalhos de aço inoxidável 304, sem mistura com outros metais.',
        'São Paulo',
        'SP',
        1,
      ],
      [
        1,
        'Cobre eletrolítico limpo',
        'Cobre',
        3.2,
        3200,
        'Eletrolítico · 99% de pureza',
        'Sobras de fios e barramentos de cobre, sem isolamento ou impurezas.',
        'São Paulo',
        'SP',
        2,
      ],
      [
        2,
        'Chapas de aço para reciclagem',
        'Aço',
        18,
        145,
        'Aço carbono · 96% de pureza',
        'Chapas e recortes de aço carbono. Lote homogêneo, armazenado em área coberta.',
        'Campinas',
        'SP',
        3,
      ],
      [
        3,
        'Cavacos de alumínio industrial',
        'Alumínio',
        6.5,
        750,
        'Liga 6061 · 94% de pureza',
        'Cavacos de usinagem de alumínio, drenados e armazenados em caçambas.',
        'Sorocaba',
        'SP',
        4,
      ],
      [
        4,
        'Tubos de cobre recuperados',
        'Cobre',
        2.8,
        2950,
        'Cobre limpo · 98% de pureza',
        'Tubos de cobre de sistemas industriais desativados. Material já separado.',
        'Curitiba',
        'PR',
        5,
      ],
      [
        5,
        'Alumínio de coleta seletiva',
        'Alumínio',
        1.2,
        680,
        'Alumínio misto · 90% de pureza',
        'Material coletado por nossa rede de parceiros. A venda apoia projetos de inclusão social.',
        'São Paulo',
        'SP',
        6,
      ],
      [
        6,
        'Sucata ferrosa selecionada',
        'Ferro',
        4,
        70,
        'Ferro selecionado · 91% de pureza',
        'Sucata separada pela cooperativa. Negociação apoia as famílias de nossos cooperados.',
        'Santos',
        'SP',
        7,
      ],
      [
        2,
        'Retalhos de inox 316',
        'Inox',
        5.8,
        980,
        '316 · 97% de pureza',
        'Retalhos de inox de equipamentos industriais, separados por liga.',
        'Campinas',
        'SP',
        3,
      ],
      [
        4,
        'Peças de aço carbono',
        'Aço',
        32,
        118,
        'Aço carbono · 93% de pureza',
        'Peças de aço provenientes da renovação de maquinário industrial.',
        'Curitiba',
        'PR',
        5,
      ],
    ];
    entries.forEach((row, i) => lot.run(...row, daysAgo(i % 7)));
    const offer = db.prepare(
      'INSERT INTO proposals (lot_id,organization_id,created_by,price_cents,message) VALUES (?,?,?,?,?)',
    );
    offer.run(
      2,
      2,
      3,
      790,
      'Temos interesse no lote completo. Podemos realizar a retirada nesta semana.',
    );
    offer.run(4, 3, 4, 765, 'Material compatível com nossa produção. Aguardamos sua avaliação.');
    db.exec("UPDATE lots SET status = 'negotiating' WHERE id IN (2,4)");
    // Histórico de demonstração consistente com as negociações e os indicadores.
    for (let i = 0; i < 18; i++) {
      const selling = i % 3 !== 0;
      const materials = ['Aço', 'Ferro', 'Alumínio', 'Cobre', 'Inox'];
      const material = materials[i % 5];
      const weight = selling ? 12 + ((i * 7) % 43) : 8 + ((i * 5) % 28);
      const price = {
        Aço: 125,
        Ferro: 65,
        Alumínio: 820,
        Cobre: 3200,
        Inox: 790,
      }[material];
      const seller = selling ? 1 : 2;
      const buyer = selling ? 2 : 1;
      const sellerUser = selling ? 1 : 3;
      const buyerUser = selling ? 3 : 1;
      const date = daysAgo(2 + i * 2);
      const id = Number(
        lot.run(
          seller,
          `Lote de ${material.toLowerCase()} selecionado`,
          material,
          weight,
          price,
          'Selecionado · 95% de pureza',
          'Material separado e negociado pela plataforma.',
          'São Paulo',
          'SP',
          sellerUser,
          date,
        ).lastInsertRowid,
      );
      const proposalId = Number(
        offer.run(id, buyer, buyerUser, price, 'Negociação concluída.').lastInsertRowid,
      );
      db.prepare("UPDATE lots SET status='sold' WHERE id=?").run(id);
      db.prepare("UPDATE proposals SET status='accepted' WHERE id=?").run(proposalId);
      const tradeId = Number(
        db
          .prepare(
            'INSERT INTO trades (lot_id,proposal_id,seller_id,buyer_id,total_cents,created_at) VALUES (?,?,?,?,?,?)',
          )
          .run(id, proposalId, seller, buyer, Math.round(weight * 1000 * price), date)
          .lastInsertRowid,
      );
      const scheduledDate = new Date(Date.now() + (i < 3 ? i + 1 : -i) * 86400000)
        .toISOString()
        .slice(0, 10);
      db.prepare(
        'INSERT INTO pickups (trade_id,status,scheduled_date,carrier) VALUES (?,?,?,?)',
      ).run(
        tradeId,
        ['scheduled', 'transit', 'awaiting'][i] || 'delivered',
        scheduledDate,
        i < 3 ? 'Logística Circular' : 'Transportadora parceira',
      );
    }
    const note = db.prepare(
      'INSERT INTO notifications (organization_id,title,message,lot_id) VALUES (?,?,?,?)',
    );
    note.run(
      1,
      'Uma nova proposta para seu lote',
      'A EcoMetal enviou uma proposta para os perfis de alumínio.',
      2,
    );
    note.run(
      1,
      'Seu inox tem uma nova proposta',
      'A Alumitech tem interesse no lote de aço inox 304.',
      4,
    );
    note.run(
      1,
      'Coleta confirmada',
      'Confira os detalhes da sua próxima coleta na área de entregas.',
      13,
    );
  });
}
