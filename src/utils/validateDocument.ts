import { Buffer } from 'buffer';
import { BadRequestError } from '@/lib/api_response/error';
import { logger } from '@/lib/winston';

export const countPDFPages = async (buffer: Buffer): Promise<number> => {
  // We use a string search on the buffer, which is efficient in Node.js
  const content = buffer.toString('binary'); 
  const pageDefinitionRegex = /\/Type\s*\/Page\b/g;
  const matches = content.match(pageDefinitionRegex);
  return matches ? matches.length : 1;
};


export const validateDocument = async (
  file: Express.Multer.File,
  plan: string,
  userId: string,
): Promise<void> => {
  // Currently, we only enforce specific file constraints on the free plan
  if (plan === 'free') {
    
    // 1. Check File Size (2MB Limit)
    const maxFileSize = 2 * 1024 * 1024;
    if (file.size > maxFileSize) {
      logger.warn('User uploaded file exceeding size limit', {
        userId,
        size: file.size,
      });
      throw new BadRequestError('File size exceeds 2MB limit for free users.');
    }

    // 2. Check PDF Page Count (2 Page Limit)
    if (file.mimetype === 'application/pdf') {
      const pageCount = await countPDFPages(file.buffer);
      if (pageCount > 2) {
        logger.warn('User uploaded PDF exceeding page limit', {
          userId,
          pageCount,
        });
        throw new BadRequestError('PDF exceeds 2-page limit for free users.');
      }
    }
  }
};