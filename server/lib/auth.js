import jwt from 'jsonwebtoken';

// Read lazily so dotenv.config() in index.js applies before first access
// (route modules are imported before dotenv runs)
const getJwtSecret = () => process.env.JWT_SECRET;

export function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded; // { userId, email, iat, exp }
  } catch (err) {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
}
