import { PlanLimits, PlanType } from '@/models/user.model';
import { ChatbotPlanLimits } from '@/models/document.model';

export const planHierarchy: Record<PlanType, number> = {
  free: 0,
  standard: 1,
  premium: 2,
};

export const getPlanMetadata = (plan: PlanType) => ({
  limits: PlanLimits[plan],
  botLimits: ChatbotPlanLimits[plan],
});