import { Request, Response, NextFunction } from 'express';
import { UAParser } from 'ua-parser-js';
import { logger } from '@/lib/winston';
import config from '@/config';
import { GuardianConfig, BotDetectionResult } from '@/types';

/**
 * Validates consistency between User-Agent and other HTTP Headers.
 * Detects bots pretending to be browsers and checks Origin validity.
 */
const analyzeHeaders = (req: Request, browserName: string) => {
  const headers = req.headers;
  const reasons: string[] = [];
  let score = 0;
  if (!headers.host) {
    score += 1.0;
    reasons.push('Missing Host Header');
  }
  const referer = headers['referer'];
  const origin = headers['origin'];
  if (referer && /semalt|buttons-for-website|seo-analyses/i.test(referer)) {
    score += 1.0;
    reasons.push('Spam Referer Detected');
  }
  if (origin) {
    const isTrustedOrigin = config.WHITELIST_ORIGINS.includes(origin);
    if (!isTrustedOrigin && headers.host) {
      const cleanOrigin = origin.replace(/^https?:\/\//, '');
      if (!cleanOrigin.includes(headers.host)) {
        score += 0.2;
        reasons.push('Origin/Host Mismatch');
      }
    }
  }
  const isMajorBrowser = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'].includes(
    browserName,
  );

  if (isMajorBrowser) {
    if (!headers['accept-language']) {
      score += 0.5;
      reasons.push('Browser missing Accept-Language');
    }
    if (headers['accept'] === '*/*') {
      score += 0.3;
      reasons.push('Suspicious Accept Header');
    }
    if (browserName !== 'Safari') {
      if (!headers['sec-fetch-mode'] && !headers['sec-fetch-site']) {
        score += 0.4;
        reasons.push('Missing Sec-Fetch Headers');
      }
    }
  }
  const headerKeys = Object.keys(headers).join(',').toLowerCase();
  if (/headless|puppeteer|selenium|phantomjs/i.test(headerKeys)) {
    score += 1.0;
    reasons.push('Automation Tool Header Detected');
  }

  return { score, reasons };
};

const analyzeUserAgent = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const isExplicitBot = /bot|crawler|spider|crawling|scrape|headless/i.test(
    userAgent,
  );

  return {
    isBot: isExplicitBot,
    browser: result.browser.name || 'unknown',
    os: result.os.name || 'unknown',
    device: result.device.type || 'desktop',
    raw: result,
  };
};


class Guardian {
  private config: GuardianConfig;
  private knownBots = [
    'googlebot',
    'bingbot',
    'yandexbot',
    'duckduckbot',
    'baiduspider',
    'facebookexternalhit',
    'curl',
    'wget',
    'postman',
    'python-requests',
    'axios',
  ];

  constructor(config: GuardianConfig = { threshold: 0.5 }) {
    this.config = config;
  }

  public detect(req: Request): BotDetectionResult {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const ip = req.ip || 'unknown';
    const reasons: string[] = [];
    let score = 0;
    if (config.NODE_ENV === 'local') {
      if (userAgent.includes('postman')) {
        return {
          isBot: false,
          score: 0,
          reasons: ['Allowed Dev Tool'],
          meta: {
            browser: 'DevTool',
            os: 'unknown',
            device: 'desktop',
            ip,
          },
        };
      }
    }
    const isKnownBot = this.knownBots.some((bot) => userAgent.includes(bot));
    if (isKnownBot) {
      score += 1.0;
      reasons.push('Known General Bot Pattern');
    }
    const uaResult = analyzeUserAgent(req.headers['user-agent'] || '');
    if (uaResult.isBot) {
      score += 0.5;
      reasons.push('Generic Bot Keyword in UA');
    }
    if (!req.headers['user-agent']) {
      score += 1.0;
      reasons.push('Missing User-Agent Header');
    }

    const headerResult = analyzeHeaders(req, uaResult.browser);
    score += headerResult.score;
    reasons.push(...headerResult.reasons);

    return {
      isBot: score >= this.config.threshold,
      score,
      reasons,
      meta: {
        browser: uaResult.browser,
        os: uaResult.os,
        device: uaResult.device,
        ip,
      },
    };
  }
}

const guardian = new Guardian({ threshold: 0.8 });

export const botGuard = (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = guardian.detect(req);

    logger.info('Guardian check', {
      path: req.path,
      ip: req.ip,
      reasons: result.reasons,
      score: result.score,
      meta: result.meta,
      userAgent: req.headers['user-agent'],
    });

    if (result.isBot) {
      logger.warn('Guardian blocked request', {
        path: req.path,
        ip: req.ip,
        reasons: result.reasons,
        score: result.score,
        userAgent: req.headers['user-agent'],
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
        reasons: process.env.NODE_ENV === 'local' ? result.reasons : undefined,
      });
    }

    next();
  } catch (error) {
    logger.error('Guardian middleware error', error);
    next();
  }
};
