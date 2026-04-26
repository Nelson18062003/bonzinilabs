import { describe, it, expect } from 'vitest';
import {
  CACHE_CONFIG,
  QUERY_LIMITS,
  FILE_UPLOAD,
  BUSINESS_RULES,
  RATE_LIMITS,
} from '@/lib/constants';

describe('Constants', () => {
  describe('CACHE_CONFIG', () => {
    it('should have valid stale times', () => {
      expect(CACHE_CONFIG.STALE_TIME.OWN_DATA).toBe(5_000);
      expect(CACHE_CONFIG.STALE_TIME.LISTS).toBe(5_000);
      expect(CACHE_CONFIG.STALE_TIME.EXCHANGE_RATES).toBe(60_000);
    });

    it('should have valid gc time', () => {
      expect(CACHE_CONFIG.GC_TIME).toBe(300000); // 5 minutes
    });
  });

  describe('QUERY_LIMITS', () => {
    it('should have reasonable limits', () => {
      expect(QUERY_LIMITS.WALLET_OPERATIONS).toBeGreaterThan(0);
      expect(QUERY_LIMITS.ALL_WALLETS).toBeGreaterThan(0);
      expect(QUERY_LIMITS.ITEMS_PER_PAGE).toBeGreaterThan(0);
    });
  });

  describe('FILE_UPLOAD', () => {
    it('should have max file size limit', () => {
      expect(FILE_UPLOAD.MAX_FILE_SIZE).toBe(10485760); // 10 MB
    });

    it('should allow common image types', () => {
      expect(FILE_UPLOAD.ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(FILE_UPLOAD.ALLOWED_IMAGE_TYPES).toContain('image/png');
    });

    it('should allow PDF documents', () => {
      expect(FILE_UPLOAD.ALLOWED_DOCUMENT_TYPES).toContain('application/pdf');
    });
  });

  describe('BUSINESS_RULES', () => {
    it('should have valid amount limits', () => {
      expect(BUSINESS_RULES.MIN_DEPOSIT_AMOUNT).toBeGreaterThan(0);
      expect(BUSINESS_RULES.MAX_DEPOSIT_AMOUNT).toBeGreaterThan(
        BUSINESS_RULES.MIN_DEPOSIT_AMOUNT
      );
      expect(BUSINESS_RULES.MIN_PAYMENT_AMOUNT).toBeGreaterThan(0);
      expect(BUSINESS_RULES.MAX_PAYMENT_AMOUNT).toBeGreaterThan(
        BUSINESS_RULES.MIN_PAYMENT_AMOUNT
      );
    });

    it('should have default exchange rate', () => {
      expect(BUSINESS_RULES.DEFAULT_EXCHANGE_RATE).toBeGreaterThan(0);
    });

    it('should have multi-admin approval threshold', () => {
      expect(BUSINESS_RULES.MULTI_ADMIN_APPROVAL_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have deposit rate limit', () => {
      expect(RATE_LIMITS.DEPOSITS_PER_HOUR).toBe(10);
    });

    it('should have payment rate limit', () => {
      expect(RATE_LIMITS.PAYMENTS_PER_HOUR).toBe(20);
    });

    it('should have admin adjustment limit', () => {
      expect(RATE_LIMITS.ADMIN_ADJUSTMENTS_PER_DAY).toBe(50);
    });
  });
});
