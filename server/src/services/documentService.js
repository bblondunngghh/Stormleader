import pool from '../db/pool.js';
import { randomUUID } from 'crypto';

export async function getDocuments(tenantId, filters = {}) {
  const { leadId, type, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['d.tenant_id = $1'];

  if (leadId) {
    params.push(leadId);
    conditions.push(`d.lead_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`d.type = $${params.length}`);
  }

  params.push(limit, offset);
  const where = conditions.join(' AND ');

  const [docsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT d.*, u.first_name AS uploaded_by_name, l.address AS lead_address
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       LEFT JOIN leads l ON l.id = d.lead_id
       WHERE ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) FROM documents d WHERE ${where}`,
      params.slice(0, -2)
    ),
  ]);

  return {
    documents: docsResult.rows,
    total: parseInt(countResult.rows[0].count),
  };
}

export async function getDocument(tenantId, documentId) {
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND tenant_id = $2',
    [documentId, tenantId]
  );
  return rows[0] || null;
}

export async function createDocument(tenantId, userId, data) {
  const id = randomUUID();
  const { lead_id, type, filename, file_url, file_size, mime_type, description, tags } = data;

  const { rows } = await pool.query(
    `INSERT INTO documents (id, tenant_id, lead_id, uploaded_by, type, filename, file_url, file_size, mime_type, description, tags, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     RETURNING *`,
    [id, tenantId, lead_id || null, userId, type || 'other', filename, file_url, file_size || 0, mime_type || 'application/octet-stream', description || null, tags || null]
  );
  return rows[0];
}

export async function deleteDocument(tenantId, documentId) {
  const { rowCount } = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND tenant_id = $2',
    [documentId, tenantId]
  );
  return { deleted: rowCount > 0 };
}
