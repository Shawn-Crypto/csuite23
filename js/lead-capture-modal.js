/**
 * Lead Capture Modal - Guide 4 Implementation
 * Provides accessible, responsive lead capture with validation and timeout protection
 */

class LeadCaptureModal {
  constructor() {
    this.modal = document.getElementById('leadCaptureModal');
    this.form = document.getElementById('leadCaptureForm');
    this.isSubmitting = false;
    this.submitTimeout = null;
    
    // API configuration
    this.API_TIMEOUT = 10000; // 10 seconds as per Guide 4
    this.API_BASE = window.location.origin;
    
    this.init();
  }

  init() {
    if (!this.modal || !this.form) {
      console.error('Lead capture modal elements not found');
      return;
    }

    this.setupEventListeners();
    this.setupValidation();
  }

  setupEventListeners() {
    // Form submission
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Modal close handlers
    this.modal.addEventListener('click', this.handleOverlayClick.bind(this));
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    
    // Close button
    const closeBtn = this.modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.close.bind(this));
    }

    // Trap focus within modal when open
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableElements = this.modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    });
  }

  setupValidation() {
    const inputs = this.form.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });
  }

  validateField(input) {
    const formGroup = input.closest('.form-group');
    if (!formGroup) {
      console.warn('Form group not found for input:', input);
      return false;
    }
    
    const errorMsg = formGroup.querySelector('.error-message');
    const successMsg = formGroup.querySelector('.success-message');
    
    // Clear previous states
    formGroup.classList.remove('has-error', 'has-success');
    
    let isValid = true;
    let message = '';

    switch (input.type) {
      case 'text':
        if (input.name === 'name') {
          if (!input.value.trim()) {
            isValid = false;
            message = 'Name is required';
          } else if (input.value.trim().length < 2) {
            isValid = false;
            message = 'Name must be at least 2 characters';
          }
        }
        break;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!input.value.trim()) {
          isValid = false;
          message = 'Email is required';
        } else if (!emailRegex.test(input.value)) {
          isValid = false;
          message = 'Please enter a valid email address';
        }
        break;
        
      case 'tel':
        // Indian phone number validation: 10 digits starting with 6-9
        const phoneRegex = /^[6-9]\d{9}$/;
        const cleanPhone = input.value.replace(/\D/g, '');
        if (!input.value.trim()) {
          isValid = false;
          message = 'Phone number is required';
        } else if (!phoneRegex.test(cleanPhone)) {
          isValid = false;
          message = 'Enter valid 10-digit Indian mobile number';
        }
        break;
        
      case 'checkbox':
        if (input.required && !input.checked) {
          isValid = false;
          message = 'You must accept the terms and conditions';
        }
        break;
    }

    // Update UI based on validation
    if (isValid && (input.type === 'checkbox' ? input.checked : input.value.trim())) {
      formGroup.classList.add('has-success');
      if (successMsg) successMsg.textContent = 'Looks good!';
    } else if (!isValid) {
      formGroup.classList.add('has-error');
      if (errorMsg) errorMsg.textContent = message;
    }

    return isValid;
  }

  clearFieldError(input) {
    const formGroup = input.closest('.form-group');
    if (!formGroup) {
      console.warn('Form group not found for input:', input);
      return;
    }
    formGroup.classList.remove('has-error');
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isSubmitting) return;

    // Validate all fields
    const inputs = this.form.querySelectorAll('input[required]');
    let isFormValid = true;
    
    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isFormValid = false;
      }
    });

    if (!isFormValid) {
      this.focusFirstError();
      return;
    }

    await this.submitLead();
  }

  async submitLead() {
    const formData = new FormData(this.form);
    const leadData = {
      firstName: formData.get('name').trim().split(' ')[0] || formData.get('name').trim(),
      lastName: formData.get('name').trim().split(' ').slice(1).join(' ') || '',
      email: formData.get('email').trim().toLowerCase(),
      phone: formData.get('phone').replace(/\D/g, ''), // Clean phone number
      
      // Include Facebook tracking parameters for enhanced matching
      fbc: this.getFacebookClickId(),
      fbp: this.getFacebookBrowserId(),
      external_id: this.getExternalId()
    };

    // Check terms checkbox
    if (formData.get('terms') !== 'on') {
      this.showError('Please accept the terms and conditions to continue.');
      return;
    }

    this.setSubmitting(true);

    // Check if we're running in development mode (localhost)
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.port === '3000';

    if (isDevelopment) {
      // Skip API call in development mode and directly proceed to success
      console.log('Development mode: Skipping API call', leadData);
      
      // Generate event ID for tracking
      const eventId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Track successful lead capture
      this.trackLeadCapture({...leadData, event_id: eventId}, eventId);
      
      // Show success state and proceed to upsell page
      this.handleSubmitSuccess({...leadData, event_id: eventId});
      this.setSubmitting(false);
      return;
    }

    try {
      // Set timeout protection
      const controller = new AbortController();
      this.submitTimeout = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      const response = await fetch(`${this.API_BASE}/api/capture-lead-simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData),
        signal: controller.signal
      });

      clearTimeout(this.submitTimeout);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      
      // Track successful lead capture using returned event_id
      const eventId = result.event_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.trackLeadCapture({...leadData, event_id: eventId}, eventId);
      
      // Show success state and proceed to payment
      this.handleSubmitSuccess({...leadData, event_id: eventId});
      
    } catch (error) {
      clearTimeout(this.submitTimeout);
      this.handleSubmitError(error);
    } finally {
      this.setSubmitting(false);
    }
  }

  handleSubmitSuccess(leadData) {
    // Close modal and proceed to upsell page
    this.close();
    
    // Store lead data for the upsell page
    sessionStorage.setItem('leadCaptureData', JSON.stringify({
      name: (leadData.firstName + ' ' + (leadData.lastName || '')).trim(),
      email: leadData.email,
      phone: leadData.phone,
      timestamp: new Date().toISOString(),
      source: 'lead_capture_modal'
    }));
    
    // Redirect to upsell page instead of directly to payment
    setTimeout(() => {
      window.location.href = '/secure.html';
    }, 300); // Small delay for smooth UX
    
    // Track conversion event
    if (window.gtag) {
      window.gtag('event', 'lead_captured', {
        event_category: 'Lead Generation',
        event_label: 'Modal Form',
        value: 1999,
        custom_parameters: {
          source: 'lead_capture_modal',
          event_id: leadData.event_id
        }
      });
    }
  }

  handleSubmitError(error) {
    let errorMessage = 'Something went wrong. Please try again.';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. Please check your connection and try again.';
    } else if (error.message.includes('400')) {
      errorMessage = 'Please check your information and try again.';
    } else if (error.message.includes('500')) {
      errorMessage = 'Server error. Please try again in a moment.';
    }
    
    this.showError(errorMessage);
    
    // Track error for debugging
    console.error('Lead capture failed:', error);
    if (window.gtag) {
      window.gtag('event', 'lead_capture_error', {
        event_category: 'Error',
        event_label: error.message || 'Unknown error'
      });
    }
  }

  trackLeadCapture(leadData, eventId) {
    console.log('🎯 Tracking lead capture:', { leadData, eventId });
    
    // GTM Data Layer push
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'lead_captured',
        event_id: eventId,
        user_data: {
          email: leadData.email,
          phone: leadData.phone
        },
        custom_data: {
          content_name: 'Lead Capture Modal',
          content_category: 'Course Registration',
          value: 1999,
          currency: 'INR'
        }
      });
      console.log('✅ DataLayer lead event pushed');
    }

    // Direct Meta Pixel tracking (since meta-pixel-clean.js was removed)
    if (typeof fbq !== 'undefined') {
      try {
        fbq('track', 'Lead', {
          content_name: 'Complete Indian Investor Course',
          content_category: 'Education',
          value: 1999,
          currency: 'INR'
        }, {
          eventID: eventId
        });
        
        console.log('✅ Meta Pixel Lead event fired:', {
          eventID: eventId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Meta Pixel Lead event failed:', error);
      }
    } else {
      console.error('❌ fbq not available for lead tracking');
    }
  }

  setSubmitting(isSubmitting) {
    this.isSubmitting = isSubmitting;
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.loading-spinner');
    
    if (isSubmitting) {
      submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Submitting...';
      if (spinner) spinner.style.display = 'inline-block';
    } else {
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Get Instant Access';
      if (spinner) spinner.style.display = 'none';
    }
  }

  showError(message) {
    // Create or update error display
    let errorDiv = this.modal.querySelector('.modal-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'modal-error';
      errorDiv.style.cssText = `
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 12px 16px;
        border-radius: 6px;
        margin: 16px 0;
        font-size: 14px;
      `;
      this.form.insertBefore(errorDiv, this.form.firstChild);
    }
    
    errorDiv.textContent = message;
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 8000);
  }

  focusFirstError() {
    const firstError = this.modal.querySelector('.form-group.has-error input');
    if (firstError) {
      firstError.focus();
    }
  }

  handleOverlayClick(e) {
    if (e.target === this.modal) {
      this.close();
    }
  }

  handleEscapeKey(e) {
    if (e.key === 'Escape' && this.modal.style.display !== 'none') {
      this.close();
    }
  }

  show() {
    // Check for modal conflicts
    if (window.modalState?.isAnyModalOpen) {
      console.warn('Another modal is already open, preventing lead capture modal');
      return;
    }
    
    this.modal.style.display = 'flex';
    
    // Update modal state
    if (window.modalState) {
      window.modalState.isAnyModalOpen = true;
      window.modalState.activeModal = 'lead-capture';
    }
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.modal.classList.add('show');
    });
    
    // Focus first input for accessibility
    const firstInput = this.form.querySelector('input');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Track modal open
    if (window.gtag) {
      window.gtag('event', 'modal_opened', {
        event_category: 'Engagement',
        event_label: 'Modal Opened'
      });
    }
  }

  close() {
    this.modal.classList.remove('show');
    
    // Reset modal state
    if (window.modalState) {
      window.modalState.isAnyModalOpen = false;
      window.modalState.activeModal = null;
    }
    
    setTimeout(() => {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }, 300);
    
    // Clear any pending timeouts
    if (this.submitTimeout) {
      clearTimeout(this.submitTimeout);
    }
    
    // Reset form state
    this.form.reset();
    this.modal.querySelectorAll('.form-group').forEach(group => {
      group.classList.remove('has-error', 'has-success');
    });
    
    // Remove error messages
    const errorDiv = this.modal.querySelector('.modal-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  // Facebook tracking parameter helpers for enhanced matching
  getFacebookClickId() {
    // Check URL for fbclid parameter
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    
    if (fbclid) {
      const timestamp = Math.floor(Date.now() / 1000);
      return `fb.1.${timestamp}.${fbclid}`;
    }
    
    // Check for existing _fbc cookie
    return this.getCookieValue('_fbc');
  }

  getFacebookBrowserId() {
    // Get _fbp cookie value
    return this.getCookieValue('_fbp');
  }

  getExternalId() {
    // Get or create consistent external ID for user
    let externalId = localStorage.getItem('meta_external_id');
    if (!externalId) {
      externalId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('meta_external_id', externalId);
    }
    return externalId;
  }

  getCookieValue(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [cookieName, value] = cookie.trim().split('=');
      if (cookieName === name) {
        return value;
      }
    }
    return null;
  }
}

// Initialize lead capture modal when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.leadCapture = new LeadCaptureModal();
  
  // Auto-trigger modal based on user behavior
  setupModalTriggers();
});

function setupModalTriggers() {
  // IMPORTANT: Only bind lead capture to specific lead-capture triggers, NOT payment CTA buttons
  // This prevents conflict with Razorpay checkout flow
  const leadCaptureButtons = document.querySelectorAll('[data-action="lead-capture"], .lead-capture-trigger');
  
  leadCaptureButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling
      if (window.leadCapture) {
        window.leadCapture.show();
      }
    });
  });
  
  // Add global modal state management
  window.modalState = window.modalState || {
    isAnyModalOpen: false,
    activeModal: null
  };
}

// Export for global access
window.LeadCaptureModal = LeadCaptureModal;