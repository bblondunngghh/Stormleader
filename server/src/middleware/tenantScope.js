export default function tenantScope(req, res, next) {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({ error: 'Tenant context required' });
  }
  req.tenantId = req.user.tenantId;
  req.tenantWhere = { tenant_id: req.user.tenantId };
  next();
}
