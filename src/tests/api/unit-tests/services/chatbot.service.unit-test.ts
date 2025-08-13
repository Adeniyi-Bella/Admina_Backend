import 'reflect-metadata';
import ChatBotHistory from '@/models/chatbotHistory.model';
import { logger } from '@/lib/winston';
import { ChatBotService } from '@/services/chatbot/chatbot.service';

jest.mock('@/models/chatbotHistory.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock('@/lib/winston', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ChatBotService', () => {
  let service: ChatBotService;
  const userId = 'user123';
  const docId = 'doc123';
  const mockChat = { userPrompt: 'Hello', response: 'Hi there', time: new Date() };

  beforeEach(() => {
    service = new ChatBotService();
    jest.clearAllMocks();
  });

  describe('getDocumentChatBotCollection', () => {
    it('should throw if userId or docId is missing', async () => {
      await expect(service.getDocumentChatBotCollection('', docId)).rejects.toThrow(
        'User ID and Document ID are required'
      );
    });

    it('should return chat history if found', async () => {
      (ChatBotHistory.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ userId, docId }),
      });

      const result = await service.getDocumentChatBotCollection(userId, docId);
      expect(result).toEqual({ userId, docId });
    });

    it('should throw on DB error', async () => {
      (ChatBotHistory.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await expect(service.getDocumentChatBotCollection(userId, docId)).rejects.toThrow(
        'Failed to retrieve chat history collection: Error: DB error'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateDocumentChatBotHistory', () => {
    it('should throw if required data is missing', async () => {
      await expect(service.updateDocumentChatBotHistory(userId, docId, {} as any)).rejects.toThrow(
        'User ID, Document ID, and valid chat data are required'
      );
    });

    it('should update chat history successfully', async () => {
      (ChatBotHistory.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.updateDocumentChatBotHistory(userId, docId, mockChat);
      expect(logger.info).toHaveBeenCalledWith('Chat history collection updated successfully', { userId, docId });
    });

    it('should throw if history not found', async () => {
      (ChatBotHistory.findOneAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.updateDocumentChatBotHistory(userId, docId, mockChat)).rejects.toThrow(
        'Chat history collection not found for update'
      );
    });
  });

  describe('addTranslatedText', () => {
    it('should throw if chatBotHistory data is invalid', async () => {
      await expect(service.addTranslatedText({})).rejects.toThrow('Valid chat history data is required');
    });

    it('should create and return chat history', async () => {
      (ChatBotHistory.create as jest.Mock).mockResolvedValue({});
      (ChatBotHistory.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ userId, docId }),
      });

      const result = await service.addTranslatedText({ userId, docId });
      expect(result).toEqual({ userId, docId });
      expect(logger.info).toHaveBeenCalledWith('New chat history collection successfully created');
    });

    it('should throw if created history not found', async () => {
      (ChatBotHistory.create as jest.Mock).mockResolvedValue({});
      (ChatBotHistory.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.addTranslatedText({ userId, docId })).rejects.toThrow(
        'Failed to retrieve New chat history collection'
      );
    });
  });

  describe('deleteChatHistoryByUserId', () => {
    it('should throw if userId missing', async () => {
      await expect(service.deleteChatHistoryByUserId('')).rejects.toThrow('User ID is required');
    });

    it('should delete chat history successfully', async () => {
      (ChatBotHistory.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      });

      const result = await service.deleteChatHistoryByUserId(userId);
      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Chat history deleted successfully', { userId });
    });

    it('should log if no chat history found', async () => {
      (ChatBotHistory.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      });

      await service.deleteChatHistoryByUserId(userId);
      expect(logger.info).toHaveBeenCalledWith('No chat history found for user', { userId });
    });

    it('should throw on DB error', async () => {
      (ChatBotHistory.deleteMany as jest.Mock).mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await expect(service.deleteChatHistoryByUserId(userId)).rejects.toThrow(
        'Failed to delete chat history: Error: DB error'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
