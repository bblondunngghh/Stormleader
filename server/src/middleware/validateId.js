const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware that validates one or more route params as UUIDs.
 * Usage: router.get('/:id', validateId(), handler)
 *        router.delete('/:woId/milestones/:milestoneId', validateId('woId','milestoneId'), handler)
 */
export default function validateId(...paramNames) {
  const names = paramNames.length ? paramNames : ['id'];
  return (req, res, next) => {
    for (const name of names) {
      const val = req.params[name];
      if (val && !UUID_RE.test(val)) {
        return res.status(400).json({ error: `Invalid ${name} format` });
      }
    }
    next();
  };
}
