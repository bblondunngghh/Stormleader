import pool from '../db/pool.js';

export async function globalSearch(tenantId, query, limit = 20) {
  if (!query || query.trim().length < 2) return { leads: [], contacts: [], estimates: [] };

  const q = `%${query.trim()}%`;

  const [leadsRes, contactsRes, estimatesRes] = await Promise.all([
    pool.query(
      `SELECT id, contact_name, contact_email, contact_phone, address, city, stage, priority, estimated_value
       FROM leads
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND (contact_name ILIKE $2 OR address ILIKE $2 OR city ILIKE $2 OR contact_email ILIKE $2 OR contact_phone ILIKE $2)
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, q, limit]
    ),
    pool.query(
      `SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.role, c.lead_id,
              l.address AS lead_address
       FROM contacts c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.tenant_id = $1
         AND (c.first_name ILIKE $2 OR c.last_name ILIKE $2 OR c.phone ILIKE $2 OR c.email ILIKE $2)
       ORDER BY c.created_at DESC LIMIT $3`,
      [tenantId, q, limit]
    ),
    pool.query(
      `SELECT id, estimate_number, customer_name, customer_address, status, total
       FROM estimates
       WHERE tenant_id = $1
         AND (customer_name ILIKE $2 OR customer_address ILIKE $2 OR estimate_number ILIKE $2)
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, q, limit]
    ),
  ]);

  return {
    leads: leadsRes.rows,
    contacts: contactsRes.rows,
    estimates: estimatesRes.rows,
  };
}
