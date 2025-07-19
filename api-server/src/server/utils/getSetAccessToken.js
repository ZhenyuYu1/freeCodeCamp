import { isBefore } from 'date-fns';
import jwt from 'jsonwebtoken';

import { jwtSecret as _jwtSecret } from '../../../config/secrets';

export const jwtCookieNS = 'jwt_access_token';

export function createCookieConfig(req) {
  return {
    signed: !!req.signedCookies,
    domain: process.env.COOKIE_DOMAIN
  };
}

export function setAccessTokenToResponse(
  { accessToken },
  req,
  res,
  jwtSecret = _jwtSecret
) {
  const cookieConfig = {
    ...createCookieConfig(req),
    maxAge: accessToken.ttl || 77760000000
  };
  const jwtAccess = jwt.sign({ accessToken }, jwtSecret, {
    algorithm: 'HS256'
  });
  res.cookie(jwtCookieNS, jwtAccess, cookieConfig);
  return;
}

export function getAccessTokenFromRequest(req, jwtSecret = _jwtSecret) {
  console.log('DEBUGGG: getAccessTokenFromRequest ********************');

  console.log('DEBUGGG: req.signedCookies: ', req.signedCookies);
  console.log('DEBUGGG: req.cookies: ', req.cookies);

  const maybeToken =
    (req.signedCookies && req.signedCookies[jwtCookieNS]) ||
    (req.cookies && req.cookies[jwtCookieNS]);

  console.log('DEBUGGG: maybeToken: ', maybeToken);

  if (!maybeToken) {
    console.log('DEBUGGG: no token found');
    return {
      accessToken: null,
      error: errorTypes.noTokenFound
    };
  }
  let token;
  try {
    console.log('DEBUGGG: trying to verify token');
    token = jwt.verify(maybeToken, jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    console.log('DEBUGGG: error verifying token', err);
    return { accessToken: null, error: errorTypes.invalidToken };
  }

  const { accessToken } = token;
  const { created, ttl } = accessToken;

  console.log('DEBUGGG: accessToken: ', accessToken);
  console.log('DEBUGGG: **************************************************: ');
  console.log('DEBUGGG: **************************************************: ');
  console.log('DEBUGGG: **************************************************: ');
  console.log('DEBUGGG: created: ', created);
  console.log('DEBUGGG: ttl: ', ttl);
  console.log('DEBUGGG:  At isBefore.....: ');
  const valid = isBefore(Date.now(), Date.parse(created) + ttl);
  if (!valid) {
    console.log('DEBUGGG: token is expired');
    return {
      accessToken: null,
      error: errorTypes.expiredToken
    };
  }
  console.log('DEBUGGG: token is valid');
  return { accessToken, error: '' };
}

export function removeCookies(req, res) {
  const config = createCookieConfig(req);
  res.clearCookie(jwtCookieNS, config);
  res.clearCookie('access_token', config);
  res.clearCookie('userId', config);
  res.clearCookie('_csrf', config);
  res.clearCookie('csrf_token', config);
  return;
}

export const errorTypes = {
  noTokenFound: 'No token found',
  invalidToken: 'Invalid token',
  expiredToken: 'Token timed out'
};
