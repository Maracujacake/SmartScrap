export function registerOrganizationRoutes(app, { db }) {
  app.get('/api/organizations', (req, res) => {
    const type = req.query.type === 'ngo' ? 'ngo' : 'company';
    const organizations = db
      .prepare(
        `SELECT o.id,o.name,o.type,o.city,o.state,o.sector,o.description,
      COUNT(l.id) AS total_lots,COALESCE(SUM(CASE WHEN l.status!='sold' THEN 1 ELSE 0 END),0) AS active_lots,
      COALESCE(SUM(l.weight),0) AS total_weight FROM organizations o JOIN lots l ON l.organization_id=o.id
      WHERE o.type=? GROUP BY o.id ORDER BY active_lots DESC,o.name`,
      )
      .all(type);
    res.json({
      organizations,
    });
  });
  app.get('/api/transport-companies', (req, res) =>
    res.json({
      companies: db
        .prepare(
          `SELECT id,name,city,state,is_demo,organization_id,
          (SELECT COUNT(*) FROM transport_rates r WHERE r.transport_company_id=transport_companies.id) AS rate_count
          FROM transport_companies WHERE active=1 ORDER BY is_demo DESC,name`,
        )
        .all(),
    }),
  );
}
