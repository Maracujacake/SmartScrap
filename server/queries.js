export const lotQuery = `SELECT l.*,o.name AS organization_name,o.type AS organization_type,
    (SELECT id FROM visual_analyses a WHERE a.lot_id=l.id) AS visual_analysis_id,
    (SELECT json_extract(a.result_json,'$.scope') FROM visual_analyses a WHERE a.lot_id=l.id) AS visual_scope,
    (SELECT COUNT(*) FROM proposals p WHERE p.lot_id=l.id AND p.status='pending') AS proposal_count
    FROM lots l JOIN organizations o ON o.id=l.organization_id`;

export const pickupQuery = `SELECT p.*,t.lot_id,t.seller_id,t.buyer_id,t.total_cents,
    t.total_cents+p.freight_cents AS final_total_cents,l.title,l.material,l.weight,l.city,l.state,
    s.name AS seller_name,b.name AS buyer_name,b.city AS buyer_city,b.state AS buyer_state,
    tc.organization_id AS carrier_organization_id,u.name AS freight_confirmed_by_name
    FROM pickups p JOIN trades t ON t.id=p.trade_id
    JOIN lots l ON l.id=t.lot_id JOIN organizations s ON s.id=t.seller_id JOIN organizations b ON b.id=t.buyer_id
    LEFT JOIN transport_companies tc ON tc.id=p.transport_company_id
    LEFT JOIN users u ON u.id=p.freight_confirmed_by`;
