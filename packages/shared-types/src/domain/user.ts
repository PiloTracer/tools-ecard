/**
 * User domain model
 * Shared across all services
 */

export type SubscriptionTier = 'free' | 'basic' | 'professional' | 'enterprise';

export type User = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  subscriptionTier: SubscriptionTier;
  rateLimit: UserRateLimit;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRateLimit = {
  cardsPerMonth: number;
  currentUsage: number;
  llmCredits: number;
  resetDate: Date;
};
