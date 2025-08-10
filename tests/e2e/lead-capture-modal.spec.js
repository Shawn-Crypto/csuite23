/**
 * E2E Tests - Lead Capture Modal Integration
 * Tests the new modal system with proper selectors and flow
 */

import { test, expect } from '@playwright/test';

test.describe('Lead Capture Modal - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000');
    
    // Wait for page to fully load
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should open lead capture modal on CTA click', async ({ page }) => {
    // Find a proper CTA button (not navigation links)
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    // Should open lead capture modal (not Razorpay modal)
    await expect(page.locator('#leadCaptureModal')).toBeVisible({ timeout: 5000 });
    
    // Modal should have proper content
    await expect(page.locator('#modalTitle')).toContainText('Complete Indian Investor');
    await expect(page.locator('.modal-form')).toBeVisible();
  });

  test('should validate form fields correctly', async ({ page }) => {
    // Click CTA to open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    // Wait for modal
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Try to submit empty form
    const submitBtn = page.locator('#leadCaptureModal button[type="submit"]');
    await submitBtn.click();
    
    // Should show validation errors
    await expect(page.locator('.form-group.has-error')).toHaveCount(4); // name, email, phone, terms
  });

  test('should handle form submission with valid data', async ({ page }) => {
    // Click CTA to open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    // Wait for modal
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Fill form with valid data
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.fill('input[name="phone"]', '9123456789');
    await page.check('input[name="terms"]');
    
    // Submit form
    const submitBtn = page.locator('#leadCaptureModal button[type="submit"]');
    await submitBtn.click();
    
    // Should show loading state
    await expect(submitBtn).toHaveText(/Submitting.../);
    
    // Modal should close after submission attempt (even if API fails)
    await expect(page.locator('#leadCaptureModal')).not.toBeVisible({ timeout: 15000 });
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Click CTA to open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    // Modal should be visible and properly sized
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    const modal = page.locator('.modal-container');
    const boundingBox = await modal.boundingBox();
    
    // Modal should fit within mobile viewport with margin
    expect(boundingBox?.width).toBeLessThanOrEqual(375 - 40); // 20px margin each side
  });

  test('should close modal on escape key', async ({ page }) => {
    // Open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Press escape key
    await page.keyboard.press('Escape');
    
    // Modal should close
    await expect(page.locator('#leadCaptureModal')).not.toBeVisible();
  });

  test('should close modal on overlay click', async ({ page }) => {
    // Open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Click on overlay (outside modal content)
    await page.locator('#leadCaptureModal').click({ position: { x: 10, y: 10 } });
    
    // Modal should close
    await expect(page.locator('#leadCaptureModal')).not.toBeVisible();
  });

  test('should validate indian phone numbers correctly', async ({ page }) => {
    // Open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    const phoneInput = page.locator('input[name="phone"]');
    
    // Test invalid phone (starts with 5)
    await phoneInput.fill('5123456789');
    await phoneInput.blur();
    
    // Should show error
    await expect(page.locator('input[name="phone"]').closest('.form-group')).toHaveClass(/has-error/);
    
    // Test valid phone
    await phoneInput.fill('9123456789');
    await phoneInput.blur();
    
    // Should show success
    await expect(page.locator('input[name="phone"]').closest('.form-group')).toHaveClass(/has-success/);
  });

  test('should show course information in modal', async ({ page }) => {
    // Open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    await expect(page.locator('#leadCaptureModal')).toBeVisible();
    
    // Should show course info
    await expect(page.locator('.course-info')).toBeVisible();
    await expect(page.locator('.current-price')).toContainText('₹1,999');
    await expect(page.locator('.original-price')).toContainText('₹9,999');
    await expect(page.locator('.savings')).toContainText('80% OFF');
    
    // Should show features list
    await expect(page.locator('.features li')).toHaveCount(5);
  });

  test('should handle accessibility correctly', async ({ page }) => {
    // Open modal
    const ctaButton = page.locator('.btn, button, [data-action="enroll"]').first();
    await ctaButton.click();
    
    const modal = page.locator('#leadCaptureModal');
    await expect(modal).toBeVisible();
    
    // Should have proper ARIA attributes
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'modalTitle');
    
    // Should focus first input
    const firstInput = page.locator('input[name="name"]');
    await expect(firstInput).toBeFocused();
    
    // Should trap focus with Tab key
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="email"]')).toBeFocused();
  });
});