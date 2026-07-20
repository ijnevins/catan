const db = require('../db');

async function getAuthSession(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  try {
    // Read session from DB
    const session = await db.readItem(token, 'SESSION');
    if (!session || session.type !== 'session') {
      return null;
    }

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      // Session expired, optionally cleanup from DB
      await db.deleteItem(session.id, 'SESSION');
      return null;
    }

    // Read linked user
    const user = await db.readItem(session.userId, 'USER');
    if (!user || user.type !== 'user') {
      return null;
    }

    return { user, session };
  } catch (err) {
    console.error('Error in auth session lookup:', err);
    return null;
  }
}

async function requireAuth(req, res, next) {
  const auth = await getAuthSession(req);
  if (!auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = auth.user;
  req.session = auth.session;
  next();
}

async function optionalAuth(req, res, next) {
  const auth = await getAuthSession(req);
  if (auth) {
    req.user = auth.user;
    req.session = auth.session;
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
