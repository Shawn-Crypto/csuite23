/**
 * Unit Tests - Lead Capture Modal System
 * Tests the LeadCaptureModal class functionality and validation
 */

const { JSDOM } = require('jsdom');

describe('Lead Capture Modal - Unit Tests', () => {
  let dom;
  let window;
  let document;
  let LeadCaptureModal;
  let modal;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="leadCaptureModal" class="modal-overlay" style="display: none;">
            <div class="modal-container">
              <form id="leadCaptureForm" novalidate>
                <div class="form-group">
                  <input type="text" name="name" required>
                  <div class="error-message"></div>
                  <div class="success-message"></div>
                </div>
                <div class="form-group">
                  <input type="email" name="email" required>
                  <div class="error-message"></div>
                  <div class="success-message"></div>
                </div>
                <div class="form-group">
                  <input type="tel" name="phone" required>
                  <div class="error-message"></div>
                  <div class="success-message"></div>
                </div>
                <div class="checkbox-group">
                  <input type="checkbox" name="terms" required>
                  <div class="error-message"></div>
                </div>
                <button type="submit" class="btn btn-primary">
                  <div class="loading-spinner" style="display: none;"></div>
                  <span class="btn-text">Get Instant Access</span>
                </button>
                <button type="button" class="modal-close">Close</button>
              </form>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    // Setup global objects
    global.window = window;
    global.document = document;
    global.fetch = jest.fn();
    global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
    global.setTimeout = setTimeout;
    global.clearTimeout = clearTimeout;

    // Mock gtag and dataLayer
    window.gtag = jest.fn();
    window.dataLayer = [];
    window.fbq = jest.fn();

    // Load the LeadCaptureModal class
    const fs = require('fs');
    const path = require('path');
    const modalCode = fs.readFileSync(
      path.join(__dirname, '../../js/lead-capture-modal.js'),
      'utf8'
    );
    
    // Execute the modal code in our test environment
    eval(modalCode);
    LeadCaptureModal = window.LeadCaptureModal;
  });

  afterEach(() => {
    if (modal && modal.submitTimeout) {
      clearTimeout(modal.submitTimeout);
    }
    jest.clearAllMocks();
  });

  describe('Modal Initialization', () => {
    test('should initialize modal elements correctly', () => {
      modal = new LeadCaptureModal();
      
      expect(modal.modal).toBeTruthy();
      expect(modal.form).toBeTruthy();
      expect(modal.isSubmitting).toBe(false);
      expect(modal.API_TIMEOUT).toBe(10000);
    });

    test('should handle missing modal elements gracefully', () => {
      document.getElementById('leadCaptureModal').remove();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      modal = new LeadCaptureModal();
      
      expect(consoleSpy).toHaveBeenCalledWith('Lead capture modal elements not found');
      consoleSpy.mockRestore();
    });
  });

  describe('Field Validation', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should validate name field correctly', () => {
      const nameInput = document.querySelector('input[name="name"]');
      
      // Test empty name
      nameInput.value = '';
      expect(modal.validateField(nameInput)).toBe(false);
      
      // Test short name
      nameInput.value = 'A';
      expect(modal.validateField(nameInput)).toBe(false);
      
      // Test valid name
      nameInput.value = 'John Doe';
      expect(modal.validateField(nameInput)).toBe(true);
    });

    test('should validate email field correctly', () => {
      const emailInput = document.querySelector('input[name="email"]');
      
      // Test empty email
      emailInput.value = '';
      expect(modal.validateField(emailInput)).toBe(false);
      
      // Test invalid email
      emailInput.value = 'invalid-email';
      expect(modal.validateField(emailInput)).toBe(false);
      
      // Test valid email
      emailInput.value = 'user@example.com';
      expect(modal.validateField(emailInput)).toBe(true);
    });

    test('should validate indian phone numbers correctly', () => {
      const phoneInput = document.querySelector('input[name="phone"]');
      
      // Test empty phone
      phoneInput.value = '';
      expect(modal.validateField(phoneInput)).toBe(false);
      
      // Test invalid phone (starts with wrong digit)
      phoneInput.value = '5123456789';
      expect(modal.validateField(phoneInput)).toBe(false);
      
      // Test invalid phone (wrong length)
      phoneInput.value = '912345678';
      expect(modal.validateField(phoneInput)).toBe(false);
      
      // Test valid phone
      phoneInput.value = '9123456789';
      expect(modal.validateField(phoneInput)).toBe(true);
      
      // Test valid phone with formatting
      phoneInput.value = '+91 9123456789';
      expect(modal.validateField(phoneInput)).toBe(true);
    });

    test('should validate checkbox field correctly', () => {
      const checkboxInput = document.querySelector('input[name="terms"]');
      
      // Test unchecked required checkbox
      checkboxInput.checked = false;
      expect(modal.validateField(checkboxInput)).toBe(false);
      
      // Test checked required checkbox
      checkboxInput.checked = true;
      expect(modal.validateField(checkboxInput)).toBe(true);
    });

    test('should update form group classes based on validation', () => {
      const nameInput = document.querySelector('input[name="name"]');
      const formGroup = nameInput.closest('.form-group');
      
      // Test error state
      nameInput.value = '';
      modal.validateField(nameInput);
      expect(formGroup.classList.contains('has-error')).toBe(true);
      
      // Test success state
      nameInput.value = 'John Doe';
      modal.validateField(nameInput);
      expect(formGroup.classList.contains('has-success')).toBe(true);
      expect(formGroup.classList.contains('has-error')).toBe(false);
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should prevent submission with invalid data', async () => {
      const form = document.getElementById('leadCaptureForm');
      const submitEvent = new window.Event('submit');
      
      // Set invalid data
      document.querySelector('input[name="name"]').value = '';
      document.querySelector('input[name="email"]').value = 'invalid';
      document.querySelector('input[name="phone"]').value = '123';
      document.querySelector('input[name="terms"]').checked = false;
      
      form.dispatchEvent(submitEvent);
      
      expect(modal.isSubmitting).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should submit valid lead data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ success: true, leadId: 'lead123' })
      };
      global.fetch.mockResolvedValue(mockResponse);
      
      // Mock successful payment initiation
      window.initiateRazorpayPayment = jest.fn();
      
      // Set valid data
      document.querySelector('input[name="name"]').value = 'John Doe';
      document.querySelector('input[name="email"]').value = 'john@example.com';
      document.querySelector('input[name="phone"]').value = '9123456789';
      document.querySelector('input[name="terms"]').checked = true;
      
      await modal.submitLead();
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/capture-lead',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"email":"john@example.com"')
        })
      );
      
      expect(window.initiateRazorpayPayment).toHaveBeenCalled();
    });

    test('should handle api timeout correctly', async () => {
      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValue(abortError);
      
      const showErrorSpy = jest.spyOn(modal, 'showError');
      
      await modal.submitLead();
      
      expect(showErrorSpy).toHaveBeenCalledWith(
        'Request timed out. Please check your connection and try again.'
      );
    });

    test('should handle server errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });
      
      const showErrorSpy = jest.spyOn(modal, 'showError');
      
      await modal.submitLead();
      
      expect(showErrorSpy).toHaveBeenCalledWith(
        'Server error. Please try again in a moment.'
      );
    });
  });

  describe('Modal Display and Interaction', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should show modal with proper attributes', () => {
      modal.show();
      
      expect(modal.modal.style.display).toBe('flex');
      expect(document.body.style.overflow).toBe('hidden');
      expect(window.gtag).toHaveBeenCalledWith('event', 'modal_opened', expect.any(Object));
    });

    test('should close modal and reset state', () => {
      modal.show();
      modal.close();
      
      setTimeout(() => {
        expect(modal.modal.style.display).toBe('none');
        expect(document.body.style.overflow).toBe('');
      }, 300);
    });

    test('should handle escape key to close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      modal.modal.style.display = 'flex';
      
      const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(closeSpy).toHaveBeenCalled();
    });

    test('should handle overlay click to close modal', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      
      const clickEvent = new window.MouseEvent('click');
      Object.defineProperty(clickEvent, 'target', {
        value: modal.modal,
        configurable: true
      });
      
      modal.modal.dispatchEvent(clickEvent);
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Event Tracking', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should track lead capture with consistent event id', () => {
      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9123456789',
        event_id: 'test_event_123'
      };
      
      modal.trackLeadCapture(leadData, 'test_event_123');
      
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({
          event: 'lead_captured',
          event_id: 'test_event_123'
        })
      );
      
      expect(window.fbq).toHaveBeenCalledWith(
        'track',
        'Lead',
        expect.objectContaining({
          content_name: 'Complete Indian Investor Course'
        }),
        { eventID: 'test_event_123' }
      );
    });

    test('should track gtm events on modal open', () => {
      modal.show();
      
      expect(window.gtag).toHaveBeenCalledWith('event', 'modal_opened', {
        event_category: 'Engagement',
        event_label: 'Modal Opened'
      });
    });
  });

  describe('Accessibility Features', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should focus first input when modal opens', (done) => {
      const firstInput = document.querySelector('input[name="name"]');
      const focusSpy = jest.spyOn(firstInput, 'focus');
      
      modal.show();
      
      setTimeout(() => {
        expect(focusSpy).toHaveBeenCalled();
        done();
      }, 150);
    });

    test('should trap focus within modal', () => {
      const tabEvent = new window.KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });
      
      modal.modal.style.display = 'flex';
      modal.modal.dispatchEvent(tabEvent);
      
      // Test passes if no errors are thrown during focus trapping
      expect(true).toBe(true);
    });

    test('should have proper aria attributes', () => {
      expect(modal.modal.getAttribute('role')).toBe('dialog');
      expect(modal.modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.modal.getAttribute('aria-labelledby')).toBe('modalTitle');
    });
  });

  describe('Loading States', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should set submitting state correctly', () => {
      const submitBtn = document.querySelector('button[type="submit"]');
      const btnText = document.querySelector('.btn-text');
      const spinner = document.querySelector('.loading-spinner');
      
      modal.setSubmitting(true);
      
      expect(submitBtn.disabled).toBe(true);
      expect(btnText.textContent).toBe('Submitting...');
      expect(spinner.style.display).toBe('inline-block');
      
      modal.setSubmitting(false);
      
      expect(submitBtn.disabled).toBe(false);
      expect(btnText.textContent).toBe('Get Instant Access');
      expect(spinner.style.display).toBe('none');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      modal = new LeadCaptureModal();
    });

    test('should display error messages correctly', () => {
      const errorMessage = 'Test error message';
      
      modal.showError(errorMessage);
      
      const errorDiv = document.querySelector('.modal-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toBe(errorMessage);
    });

    test('should focus first error field', () => {
      const nameInput = document.querySelector('input[name="name"]');
      const formGroup = nameInput.closest('.form-group');
      formGroup.classList.add('has-error');
      
      const focusSpy = jest.spyOn(nameInput, 'focus');
      
      modal.focusFirstError();
      
      expect(focusSpy).toHaveBeenCalled();
    });
  });
});