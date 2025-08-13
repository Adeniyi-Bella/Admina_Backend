import 'reflect-metadata';
import User from '@/models/user.model';
import Document from '@/models/document.model';
import ChatBotHistory from '@/models/chatbotHistory.model';
import { logger } from '@/lib/winston';
import { ApiResponse } from '@/lib/api_response';
import resetPropertiesIfNewMonth from '@/middlewares/resetPropertiesIfNewMonth';

jest.mock('@/models/user.model');
jest.mock('@/models/document.model');
jest.mock('@/models/chatbotHistory.model');
jest.mock('@/lib/winston', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }
}));
jest.mock('@/lib/api_response', () => ({
  ApiResponse: {
    badRequest: jest.fn(),
    notFound: jest.fn(),
    serverError: jest.fn(),
  }
}));

describe('resetPropertiesIfNewMonth middleware', () => {
  const mockReq: any = { userId: 'user123' };
  const mockRes: any = {};
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return badRequest if userId is missing', async () => {
    const req = { userId: undefined } as any;
    await resetPropertiesIfNewMonth(req, mockRes, mockNext);
    expect(ApiResponse.badRequest).toHaveBeenCalledWith(
      mockRes,
      expect.stringContaining('No userId')
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return notFound if user does not exist', async () => {
    (User.findOne as any).mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) });
    await resetPropertiesIfNewMonth(mockReq, mockRes, mockNext);
    expect(ApiResponse.notFound).toHaveBeenCalledWith(mockRes, 'User not found');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reset properties if it is a new month', async () => {
    const oldDate = new Date('2025-07-30');
    (User.findOne as any).mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ plan: 'free', updatedAt: oldDate }) }) });
    (Document.findOne as any).mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
    (ChatBotHistory.findOne as any).mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });

    (User.updateOne as any).mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
    (Document.updateMany as any).mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });

    await resetPropertiesIfNewMonth(mockReq, mockRes, mockNext);

    expect(User.updateOne).toHaveBeenCalled();
    expect(Document.updateMany).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should log info if no reset needed', async () => {
    const now = new Date();
    (User.findOne as any).mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ plan: 'premium', updatedAt: now }) }) });
    (Document.findOne as any).mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });
    (ChatBotHistory.findOne as any).mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) });

    await resetPropertiesIfNewMonth(mockReq, mockRes, mockNext);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('No reset needed'),
      expect.any(Object)
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle errors and return serverError', async () => {
    (User.findOne as any).mockImplementation(() => { throw new Error('DB error'); });
    await resetPropertiesIfNewMonth(mockReq, mockRes, mockNext);
    expect(ApiResponse.serverError).toHaveBeenCalledWith(
      mockRes,
      'Error in reset PRoperties new month',
      'DB error'
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
