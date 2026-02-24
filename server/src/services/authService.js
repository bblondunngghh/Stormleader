import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import config from '../config/env.js';

function generateTokens(user) {
  const payload = {
    id: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

export async function register(email, password, firstName, lastName, tenantSlug) {
  const { rows: tenants } = await pool.query(
    'SELECT id FROM tenants WHERE slug = $1',
    [tenantSlug]
  );
  if (tenants.length === 0) {
    const err = new Error('Tenant not found');
    err.status = 404;
    throw err;
  }
  const tenantId = tenants[0].id;

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, email, role, first_name, last_name`,
    [tenantId, email, passwordHash, firstName, lastName]
  );
  const user = rows[0];

  const tokens = generateTokens(user);

  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken,
    user.id,
  ]);

  return {
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, tenantId: user.tenant_id },
    ...tokens,
  };
}

export async function login(email, password, tenantSlug) {
  const { rows } = await pool.query(
    `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role, u.first_name, u.last_name
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1 AND t.slug = $2`,
    [email, tenantSlug]
  );

  if (rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const tokens = generateTokens(user);

  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken,
    user.id,
  ]);

  return {
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, tenantId: user.tenant_id },
    ...tokens,
  };
}

export async function refreshToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid refresh token');
    err.status = 401;
    throw err;
  }

  const { rows } = await pool.query(
    'SELECT id, tenant_id, email, role, first_name, last_name FROM users WHERE id = $1 AND refresh_token = $2',
    [payload.id, token]
  );

  if (rows.length === 0) {
    const err = new Error('Refresh token revoked or user not found');
    err.status = 401;
    throw err;
  }

  const user = rows[0];
  const tokens = generateTokens(user);

  await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken,
    user.id,
  ]);

  return {
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role, tenantId: user.tenant_id },
    ...tokens,
  };
}
