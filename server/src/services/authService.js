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

  // Check user limit for tenant's subscription plan
  const { rows: limitRows } = await pool.query(
    `SELECT sp.max_users, COUNT(u.id)::int AS current_users
     FROM tenants t
     LEFT JOIN subscription_plans sp ON sp.key = t.subscription_tier
     LEFT JOIN users u ON u.tenant_id = t.id
     WHERE t.id = $1
     GROUP BY sp.max_users`,
    [tenantId]
  );
  if (limitRows.length > 0 && limitRows[0].max_users != null && limitRows[0].current_users >= limitRows[0].max_users) {
    const err = new Error(`User limit reached (${limitRows[0].max_users}). Upgrade your plan to add more users.`);
    err.status = 403;
    throw err;
  }

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

// ============================================================
// createTenantWithAdmin
// Used by the self-service onboarding flow. Runs everything
// in a single transaction: tenant row, admin user, default
// pipeline stages, then returns JWT tokens.
// ============================================================

const DEFAULT_PIPELINE_STAGES = [
  { key: 'new',            label: 'New',            color: 'oklch(0.70 0.15 250)', position: 0 },
  { key: 'contacted',     label: 'Contacted',      color: 'oklch(0.70 0.15 200)', position: 1 },
  { key: 'appt_set',      label: 'Appt Set',       color: 'oklch(0.75 0.15 85)',  position: 2 },
  { key: 'estimate_sent', label: 'Estimate Sent',  color: 'oklch(0.75 0.15 60)',  position: 3 },
  { key: 'sold',          label: 'Sold',           color: 'oklch(0.75 0.18 145)', position: 4 },
  { key: 'in_production', label: 'In Production',  color: 'oklch(0.70 0.12 280)', position: 5 },
  { key: 'completed',     label: 'Completed',      color: 'oklch(0.80 0.18 145)', position: 6 },
  { key: 'lost',          label: 'Lost',           color: 'oklch(0.55 0.10 25)',  position: 7 },
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createTenantWithAdmin(companyName, firstName, lastName, email, password, phone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---- 1. Generate a unique slug ----------------------------------------
    const baseSlug = generateSlug(companyName) || 'company';
    let slug = baseSlug;
    let attempt = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { rows: existing } = await client.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug],
      );
      if (existing.length === 0) break;
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    // ---- 2. Create tenant row ----------------------------------------------
    const { rows: tenantRows } = await client.query(
      `INSERT INTO tenants (name, slug, subscription_tier, subscription_status, trial_ends_at)
       VALUES ($1, $2, 'starter', 'trialing', NOW() + INTERVAL '14 days')
       RETURNING id, name, slug, subscription_tier, subscription_status, trial_ends_at, onboarding_completed`,
      [companyName, slug],
    );
    const tenant = tenantRows[0];

    // ---- 3. Guard against duplicate email within this (new) tenant --------
    const { rows: existingUser } = await client.query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [tenant.id, email],
    );
    if (existingUser.length > 0) {
      const err = new Error('An account with this email already exists');
      err.status = 409;
      throw err;
    }

    // ---- 4. Create admin user ---------------------------------------------
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, tenant_id, email, role, first_name, last_name`,
      [tenant.id, email, passwordHash, firstName, lastName],
    );
    const user = userRows[0];

    // Store phone on users row if the column exists, or on tenants
    if (phone) {
      await client.query(
        'UPDATE tenants SET company_phone = $1 WHERE id = $2',
        [phone, tenant.id],
      );
    }

    // ---- 5. Seed default pipeline stages ----------------------------------
    for (const stage of DEFAULT_PIPELINE_STAGES) {
      await client.query(
        `INSERT INTO pipeline_stages (tenant_id, key, label, color, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, key) DO NOTHING`,
        [tenant.id, stage.key, stage.label, stage.color, stage.position],
      );
    }

    // ---- 6. Generate tokens -----------------------------------------------
    const tokens = generateTokens(user);
    await client.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [tokens.refreshToken, user.id],
    );

    await client.query('COMMIT');

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenantId: user.tenant_id,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionTier: tenant.subscription_tier,
        subscriptionStatus: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        onboardingCompleted: tenant.onboarding_completed,
      },
      ...tokens,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
