# Frontend Integration Patterns Guide

**Target**: Claude Code sessions building payment frontend integration  
**Guide 4 of 8**: Frontend Integration & User Experience Patterns

## Lead Capture Modal Implementation

### Modal HTML Structure
```html
<!-- components/lead-capture-modal.html -->
<div id="leadCaptureModal" class="modal-overlay" style="display: none;" role="dialog" aria-labelledby="modalTitle" aria-modal="true">
  <div class="modal-container">
    <div class="modal-header">
      <h2 id="modalTitle">Get Instant Access to Beyond the Deck</h2>
      <button class="modal-close" onclick="leadCapture.close()" aria-label="Close modal">&times;</button>
    </div>
    
    <form id="leadCaptureForm" class="modal-form" novalidate>
      <div class="form-group">
        <label for="leadName" class="sr-only">Your Name</label>
        <input type="text" id="leadName" name="name" placeholder="Your Name" required 
               autocomplete="name" maxlength="100">
        <span class="field-error" id="nameError"></span>
      </div>
      
      <div class="form-group">
        <label for="leadEmail" class="sr-only">Your Email</label>
        <input type="email" id="leadEmail" name="email" placeholder="Your Email" required 
               autocomplete="email" maxlength="255">
        <span class="field-error" id="emailError"></span>
      </div>
      
      <div class="form-group">
        <label for="leadPhone" class="sr-only">Phone Number</label>
        <input type="tel" id="leadPhone" name="phone" placeholder="Phone Number" required 
               autocomplete="tel" maxlength="20">
        <span class="field-error" id="phoneError"></span>
      </div>
      
      <button type="submit" class="submit-btn" id="leadSubmitBtn" aria-describedby="submitStatus">
        <span class="btn-text">Continue to Payment</span>
        <div class="loading-spinner" style="display: none;" aria-hidden="true"></div>
      </button>
      
      <div id="submitStatus" class="sr-only" role="status" aria-live="polite"></div>
    </form>
    
    <div class="error-container" id="errorContainer" style="display: none;" role="alert" aria-live="assertive"></div>
  </div>
</div>
```

### Modal CSS (Optimized)
```css
/* Lead Capture Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
  transition: opacity 0.3s ease;
}

.modal-container {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  transform: translateY(0);
  transition: transform 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #000;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.form-group input.error {
  border-color: #dc3545;
}

.field-error {
  display: block;
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  min-height: 1.25rem;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background: #000;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  position: relative;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn:hover:not(:disabled) {
  background: #333;
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-left: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container {
  background: #f8d7da;
  color: #721c24;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 1rem;
  border: 1px solid #f5c6cb;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Mobile responsiveness */
@media (max-width: 480px) {
  .modal-container {
    margin: 1rem;
    padding: 1.5rem;
  }
  
  .modal-header h2 {
    font-size: 1.25rem;
  }
}
```

### Lead Capture JavaScript Class
```javascript
// js/lead-capture.js
class LeadCaptureModal {
  constructor() {
    this.modal = document.getElementById('leadCaptureModal');
    this.form = document.getElementById('leadCaptureForm');
    this.submitBtn = document.getElementById('leadSubmitBtn');
    this.errorContainer = document.getElementById('errorContainer');
    this.isSubmitting = false;
    
    this.validationRules = {
      name: { 
        required: true, 
        minLength: 2, 
        maxLength: 100,
        pattern: /^[a-zA-Z\s]+$/ 
      },
      email: { 
        required: true, 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
      },
      phone: { 
        required: true, 
        pattern: /^[\+]?[\d\s\-\(\)]{10,}$/ 
      }
    };
    
    this.init();
  }

  init() {
    // Form submission handler
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    
    // Real-time validation
    this.form.addEventListener('input', this.handleInput.bind(this));
    this.form.addEventListener('blur', this.handleBlur.bind(this), true);
    
    // Modal close handlers
    this.modal.addEventListener('click', this.handleOverlayClick.bind(this));
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    
    // Accessibility improvements
    this.setupAccessibility();
  }

  setupAccessibility() {
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

  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isSubmitting) return;
    
    // Clear previous errors
    this.clearErrors();
    
    const formData = new FormData(this.form);
    const leadData = {
      name: formData.get('name').trim(),
      email: formData.get('email').trim(),
      phone: formData.get('phone').trim()
    };

    // Validate all fields
    const validationErrors = this.validateAllFields(leadData);
    if (Object.keys(validationErrors).length > 0) {
      this.displayValidationErrors(validationErrors);
      return;
    }

    this.setLoadingState(true);

    try {
      // Submit lead with timeout protection
      const response = await this.submitLeadWithTimeout(leadData);
      
      if (response.success) {
        // Store data for payment prefill
        sessionStorage.setItem('leadData', JSON.stringify({
          ...leadData,
          timestamp: new Date().toISOString()
        }));
        
        // Track successful lead capture
        this.trackLeadCapture(leadData);
        
        // Close modal and proceed to payment
        this.close();
        await this.proceedToPayment(leadData);
      } else {
        throw new Error(response.error || 'Lead submission failed');
      }
      
    } catch (error) {
      console.error('Lead capture error:', error);
      this.displayError(this.getErrorMessage(error));
    } finally {
      this.setLoadingState(false);
    }
  }

  async submitLeadWithTimeout(leadData) {
    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch('/api/capture-lead-async', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          ...leadData,
          source: 'lead_capture_modal',
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection and try again');
      }
      
      throw error;
    }
  }

  validateAllFields(data) {
    const errors = {};
    
    // Validate name
    if (!this.validateField('name', data.name)) {
      errors.name = this.getFieldErrorMessage('name', data.name);
    }
    
    // Validate email
    if (!this.validateField('email', data.email)) {
      errors.email = this.getFieldErrorMessage('email', data.email);
    }
    
    // Validate phone
    if (!this.validateField('phone', data.phone)) {
      errors.phone = this.getFieldErrorMessage('phone', data.phone);
    }
    
    return errors;
  }

  validateField(fieldName, value) {
    const rules = this.validationRules[fieldName];
    if (!rules) return true;

    // Required check
    if (rules.required && (!value || value.length === 0)) {
      return false;
    }

    // Min length check
    if (rules.minLength && value.length < rules.minLength) {
      return false;
    }

    // Max length check
    if (rules.maxLength && value.length > rules.maxLength) {
      return false;
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(value)) {
      return false;
    }

    return true;
  }

  getFieldErrorMessage(fieldName, value) {
    const rules = this.validationRules[fieldName];
    
    if (!value || value.length === 0) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }
    
    switch (fieldName) {
      case 'name':
        if (value.length < rules.minLength) return 'Name must be at least 2 characters';
        if (!rules.pattern.test(value)) return 'Name can only contain letters and spaces';
        break;
      case 'email':
        return 'Please enter a valid email address';
      case 'phone':
        return 'Please enter a valid phone number (at least 10 digits)';
    }
    
    return 'Invalid input';
  }

  displayValidationErrors(errors) {
    Object.entries(errors).forEach(([field, message]) => {
      const input = document.getElementById(`lead${field.charAt(0).toUpperCase() + field.slice(1)}`);
      const errorElement = document.getElementById(`${field}Error`);
      
      if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
        
        // Remove error on input
        input.addEventListener('input', () => {
          input.classList.remove('error');
          errorElement.textContent = '';
        }, { once: true });
      }
    });

    // Focus first error field
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const fieldElement = document.getElementById(`lead${firstErrorField.charAt(0).toUpperCase() + firstErrorField.slice(1)}`);
      fieldElement?.focus();
    }
  }

  handleInput(e) {
    // Real-time validation feedback
    const field = e.target;
    const fieldName = field.name;
    
    if (this.validationRules[fieldName]) {
      const isValid = this.validateField(fieldName, field.value);
      const errorElement = document.getElementById(`${fieldName}Error`);
      
      if (isValid) {
        field.classList.remove('error');
        if (errorElement) errorElement.textContent = '';
      }
    }
  }

  handleBlur(e) {
    // Validate on blur for better UX
    const field = e.target;
    const fieldName = field.name;
    
    if (this.validationRules[fieldName] && field.value) {
      const isValid = this.validateField(fieldName, field.value);
      const errorElement = document.getElementById(`${fieldName}Error`);
      
      if (!isValid) {
        field.classList.add('error');
        if (errorElement) {
          errorElement.textContent = this.getFieldErrorMessage(fieldName, field.value);
        }
      }
    }
  }

  trackLeadCapture(leadData) {
    // Google Analytics tracking
    if (window.gtag) {
      gtag('event', 'generate_lead', {
        event_category: 'Lead Capture',
        event_label: 'Modal Form',
        value: 1
      });
    }

    // Meta Pixel tracking
    if (window.fbq) {
      fbq('track', 'Lead', {
        content_name: 'Lead Capture Modal',
        content_category: 'lead_generation'
      });
    }
    
    console.log('✅ Lead capture tracked:', leadData.email);
  }

  async proceedToPayment(leadData) {
    try {
      // Initialize payment flow with prefilled data
      if (window.paymentFlow) {
        await window.paymentFlow.init(leadData);
      } else {
        console.error('Payment flow not initialized');
        this.displayError('Payment system not ready. Please refresh the page and try again.');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      this.displayError('Unable to initialize payment. Please try again.');
    }
  }

  setLoadingState(loading) {
    this.isSubmitting = loading;
    const btnText = this.submitBtn.querySelector('.btn-text');
    const spinner = this.submitBtn.querySelector('.loading-spinner');
    const statusElement = document.getElementById('submitStatus');

    if (loading) {
      btnText.textContent = 'Processing...';
      spinner.style.display = 'inline-block';
      this.submitBtn.disabled = true;
      this.submitBtn.setAttribute('aria-busy', 'true');
      statusElement.textContent = 'Processing your information...';
      
      // Disable form inputs
      this.form.querySelectorAll('input').forEach(input => input.disabled = true);
    } else {
      btnText.textContent = 'Continue to Payment';
      spinner.style.display = 'none';
      this.submitBtn.disabled = false;
      this.submitBtn.removeAttribute('aria-busy');
      statusElement.textContent = '';
      
      // Re-enable form inputs
      this.form.querySelectorAll('input').forEach(input => input.disabled = false);
    }
  }

  displayError(message) {
    this.errorContainer.textContent = message;
    this.errorContainer.style.display = 'block';
    this.errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Auto-hide error after 7 seconds
    setTimeout(() => {
      this.errorContainer.style.display = 'none';
    }, 7000);
  }

  clearErrors() {
    this.errorContainer.style.display = 'none';
    
    // Clear field errors
    this.form.querySelectorAll('.field-error').forEach(error => {
      error.textContent = '';
    });
    
    this.form.querySelectorAll('input.error').forEach(input => {
      input.classList.remove('error');
    });
  }

  getErrorMessage(error) {
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  handleOverlayClick(e) {
    if (e.target === this.modal) {
      this.close();
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape' && this.modal.style.display !== 'none') {
      this.close();
    }
  }

  show() {
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus first input for accessibility
    setTimeout(() => {
      document.getElementById('leadName')?.focus();
    }, 100);
    
    // Track modal open
    if (window.gtag) {
      gtag('event', 'view_promotion', {
        event_category: 'Lead Capture',
        event_label: 'Modal Opened'
      });
    }
  }

  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Reset form
    this.form.reset();
    this.clearErrors();
    this.setLoadingState(false);
  }
}

// Initialize lead capture modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.leadCapture = new LeadCaptureModal();
  
  // Auto-trigger modal based on user behavior (customize as needed)
  setupModalTriggers();
});

function setupModalTriggers() {
  // Trigger on CTA button clicks
  document.querySelectorAll('[data-trigger="lead-capture"]').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      window.leadCapture.show();
    });
  });

  // Trigger on scroll (optional)
  let hasTriggeredOnScroll = false;
  window.addEventListener('scroll', () => {
    if (!hasTriggeredOnScroll && window.scrollY > window.innerHeight * 0.5) {
      hasTriggeredOnScroll = true;
      
      // Delay to avoid interrupting reading
      setTimeout(() => {
        if (!sessionStorage.getItem('leadData')) {
          window.leadCapture.show();
        }
      }, 2000);
    }
  });
}
```

## Payment Flow Integration

### Razorpay Payment Implementation
```javascript
// js/razorpay-payment.js
class RazorpayPaymentFlow {
  constructor() {
    this.razorpayLoaded = false;
    this.currentOrderData = null;
    this.preloadRazorpayScript();
  }

  preloadRazorpayScript() {
    // Preload Razorpay script for better performance
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = 'https://checkout.razorpay.com/v1/checkout.js';
    link.as = 'script';
    document.head.appendChild(link);

    // Preconnect to Razorpay domains
    this.preconnectToDomain('https://api.razorpay.com');
    this.preconnectToDomain('https://checkout.razorpay.com');
  }

  preconnectToDomain(domain) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    document.head.appendChild(link);
  }

  async loadRazorpayScript() {
    if (this.razorpayLoaded || window.Razorpay) {
      this.razorpayLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        this.razorpayLoaded = true;
        console.log('✅ Razorpay script loaded');
        resolve();
      };
      script.onerror = () => {
        console.error('❌ Failed to load Razorpay script');
        reject(new Error('Failed to load Razorpay payment script'));
      };
      document.head.appendChild(script);
    });
  }

  async init(leadData, selectedProducts = ['course']) {
    try {
      // Show loading state
      this.showPaymentLoading(true);
      
      // Load Razorpay script if needed
      await this.loadRazorpayScript();
      
      // Create payment order
      const orderData = await this.createPaymentOrder(leadData, selectedProducts);
      this.currentOrderData = orderData;
      
      // Configure Razorpay options
      const razorpayOptions = this.buildRazorpayOptions(orderData, leadData);
      
      // Open Razorpay checkout
      const rzp = new Razorpay(razorpayOptions);
      
      // Handle checkout open event
      rzp.on('payment.submit', (response) => {
        console.log('Payment submitted:', response.razorpay_payment_id);
      });
      
      rzp.open();
      
      console.log('✅ Razorpay checkout opened');

    } catch (error) {
      console.error('❌ Payment initialization error:', error);
      this.showPaymentError(this.getPaymentErrorMessage(error));
    } finally {
      this.showPaymentLoading(false);
    }
  }

  async createPaymentOrder(leadData, selectedProducts) {
    const amount = this.calculateTotalAmount(selectedProducts);
    
    console.log('Creating payment order:', { 
      amount, 
      products: selectedProducts, 
      email: leadData.email 
    });

    const orderRequest = {
      amount: amount,
      currency: 'INR',
      customer_email: leadData.email,
      customer_name: leadData.name,
      customer_phone: leadData.phone,
      products: selectedProducts
    };

    const response = await fetch('/api/create-razorpay-order', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(orderRequest)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Order creation failed (${response.status})`);
    }

    const orderData = await response.json();
    console.log('✅ Order created:', orderData.order_id);
    
    return orderData;
  }

  buildRazorpayOptions(orderData, leadData) {
    return {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.order_id,
      name: 'LFG Ventures',
      description: this.getProductDescription(orderData.products || ['course']),
      image: '/assets/logo.png', // Add your logo
      prefill: {
        name: orderData.customer.name,
        email: orderData.customer.email,
        contact: orderData.customer.contact
      },
      theme: {
        color: '#000000' // Customize brand color
      },
      handler: this.handlePaymentSuccess.bind(this),
      modal: {
        ondismiss: this.handlePaymentCancel.bind(this),
        escape: true,
        animation: true
      },
      notes: {
        source: 'website_checkout',
        lead_timestamp: leadData.timestamp
      }
    };
  }

  async handlePaymentSuccess(response) {
    try {
      console.log('Payment success response:', response);
      
      // Show verification loading
      this.showVerificationLoading(true);
      
      // Verify payment on server
      const verification = await this.verifyPayment(response);
      
      if (verification.success && verification.payment_verified) {
        // Track successful payment
        this.trackPaymentSuccess(verification);
        
        console.log('✅ Payment verified successfully');
        
        // Redirect to success page with order details
        const successUrl = this.buildSuccessUrl(verification);
        window.location.href = successUrl;
      } else {
        throw new Error(verification.error || 'Payment verification failed');
      }
      
    } catch (error) {
      console.error('❌ Payment verification error:', error);
      this.showPaymentError('Payment verification failed. Please contact support with your payment details.');
    } finally {
      this.showVerificationLoading(false);
    }
  }

  async verifyPayment(paymentResponse) {
    const verificationData = {
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature
    };

    console.log('Verifying payment:', verificationData.razorpay_payment_id);

    const response = await fetch('/api/verify-razorpay-payment', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(verificationData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Verification failed (${response.status})`);
    }

    return await response.json();
  }

  trackPaymentSuccess(verification) {
    const { order_id, amount, currency } = verification;
    
    // Google Analytics Enhanced Ecommerce
    if (window.gtag) {
      gtag('event', 'purchase', {
        transaction_id: order_id,
        value: amount,
        currency: currency,
        items: this.buildGAItems(verification)
      });
      
      console.log('✅ GA4 purchase event tracked');
    }

    // Meta Pixel Purchase Event
    if (window.fbq) {
      fbq('track', 'Purchase', {
        value: amount,
        currency: currency,
        content_ids: verification.products || ['course'],
        content_type: 'product',
        num_items: (verification.products || ['course']).length
      }, { eventID: `purchase_${order_id}` });
      
      console.log('✅ Meta Pixel purchase event tracked');
    }

    // Custom analytics (if needed)
    this.trackCustomPurchase(verification);
  }

  buildGAItems(verification) {
    const products = verification.products || ['course'];
    return products.map((product, index) => ({
      item_id: product,
      item_name: this.getProductName(product),
      category: 'education',
      quantity: 1,
      price: this.getProductPrice(product)
    }));
  }

  handlePaymentCancel() {
    console.log('Payment cancelled by user');
    
    // Track cancellation
    if (window.gtag) {
      gtag('event', 'payment_cancelled', {
        event_category: 'Payment',
        event_label: 'User Cancelled'
      });
    }
    
    this.showPaymentCancelled();
  }

  calculateTotalAmount(products) {
    const prices = {
      'course': 1499,
      'database': 2499,
      'strategy_call': 4999
    };
    
    return products.reduce((total, product) => {
      return total + (prices[product] || 0);
    }, 0);
  }

  getProductDescription(products) {
    if (products.includes('strategy_call') && products.includes('database') && products.includes('course')) {
      return 'Complete Bundle: Course + Database + Strategy Call';
    } else if (products.includes('course') && products.includes('strategy_call')) {
      return 'Course + Strategy Call Bundle';
    } else if (products.includes('course') && products.includes('database')) {
      return 'Course + Database Bundle';
    } else if (products.includes('course')) {
      return 'Beyond the Deck Course';
    }
    
    return 'LFG Ventures Course Access';
  }

  buildSuccessUrl(verification) {
    const params = new URLSearchParams({
      order_id: verification.order_id,
      email: encodeURIComponent(verification.customer_email),
      amount: verification.amount,
      currency: verification.currency || 'INR'
    });
    
    return `/success.html?${params.toString()}`;
  }

  showPaymentLoading(loading) {
    // Implement loading UI for payment initialization
    const loadingElement = document.getElementById('paymentLoading');
    if (loadingElement) {
      loadingElement.style.display = loading ? 'block' : 'none';
    }
  }

  showVerificationLoading(loading) {
    // Show payment verification loading
    if (loading) {
      // Create overlay if it doesn't exist
      if (!document.getElementById('verificationOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'verificationOverlay';
        overlay.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                      background: rgba(0,0,0,0.8); display: flex; align-items: center; 
                      justify-content: center; z-index: 10001; color: white; font-size: 18px;">
            <div style="text-align: center;">
              <div style="margin-bottom: 20px;">Verifying your payment...</div>
              <div class="loading-spinner" style="border-color: white; border-top-color: transparent;"></div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
    } else {
      const overlay = document.getElementById('verificationOverlay');
      if (overlay) overlay.remove();
    }
  }

  showPaymentError(message) {
    alert(message); // Replace with better modal/toast
    
    // Track error
    if (window.gtag) {
      gtag('event', 'payment_error', {
        event_category: 'Payment',
        event_label: message
      });
    }
  }

  showPaymentCancelled() {
    // Show user-friendly cancellation message
    console.log('Payment was cancelled');
    
    // Could show a modal or toast here
    // For now, just log the event
  }

  getPaymentErrorMessage(error) {
    if (error.message.includes('script')) {
      return 'Payment system failed to load. Please refresh the page and try again.';
    }
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    return error.message || 'Payment initialization failed. Please try again.';
  }

  getProductName(productId) {
    const names = {
      'course': 'Beyond the Deck Course',
      'database': 'Investor Database',
      'strategy_call': 'Strategy Call'
    };
    return names[productId] || productId;
  }

  getProductPrice(productId) {
    const prices = {
      'course': 1499,
      'database': 2499,
      'strategy_call': 4999
    };
    return prices[productId] || 0;
  }

  trackCustomPurchase(verification) {
    // Add custom tracking logic here
    console.log('Custom purchase tracking:', verification);
  }
}

// Initialize payment flow when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.paymentFlow = new RazorpayPaymentFlow();
});
```

## Success Page Implementation

### success.html Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - LFG Ventures</title>
  <link rel="stylesheet" href="/css/success.css">
</head>
<body>
  <div class="success-container">
    <div class="success-content">
      <div class="success-icon">✅</div>
      <h1>Payment Successful!</h1>
      <p class="success-message">
        Thank you for your purchase. You'll receive your course access and materials via email within the next few minutes.
      </p>
      
      <div class="order-details" id="orderDetails">
        <h3>Order Details</h3>
        <div class="detail-row">
          <span>Order ID:</span>
          <span id="orderIdDisplay">Loading...</span>
        </div>
        <div class="detail-row">
          <span>Amount:</span>
          <span id="amountDisplay">Loading...</span>
        </div>
        <div class="detail-row">
          <span>Email:</span>
          <span id="emailDisplay">Loading...</span>
        </div>
      </div>

      <div class="next-steps">
        <h3>What happens next?</h3>
        <ul>
          <li>📧 Check your email for course access details</li>
          <li>📚 Access your purchased materials instantly</li>
          <li>🎯 Start your entrepreneurship journey today</li>
        </ul>
      </div>

      <div class="cta-section">
        <a href="/" class="btn btn-primary">Return to Homepage</a>
      </div>
    </div>
  </div>

  <script src="/js/success-page.js"></script>
</body>
</html>
```

### Success Page JavaScript
```javascript
// js/success-page.js
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');
  const email = urlParams.get('email');
  const amount = urlParams.get('amount');
  const currency = urlParams.get('currency') || 'INR';

  if (!orderId || !email) {
    console.error('Missing required parameters');
    window.location.href = '/';
    return;
  }

  // Display order details
  document.getElementById('orderIdDisplay').textContent = orderId;
  document.getElementById('emailDisplay').textContent = decodeURIComponent(email);
  document.getElementById('amountDisplay').textContent = `${currency} ${amount}`;

  // Track purchase completion
  trackPurchaseCompletion(orderId, email, amount, currency);

  console.log('✅ Success page loaded:', { orderId, email, amount });
});

function trackPurchaseCompletion(orderId, email, amount, currency) {
  // Push to dataLayer for GTM
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'purchaseComplete',
    transaction_id: orderId,
    value: parseFloat(amount),
    currency: currency,
    customer_email: email
  });

  // Additional tracking can be added here
  console.log('✅ Purchase completion tracked');
}
```

## Next Steps

1. **Implement modal HTML** and CSS in your components directory
2. **Add JavaScript classes** for lead capture and payment flow
3. **Create success page** with proper tracking implementation
4. **Test user flow** from modal to payment completion
5. **Optimize for mobile** and accessibility
6. **Set up tracking** integration with your analytics platforms

## Critical Frontend Rules

1. **Always validate user input** on both client and server side
2. **Implement proper timeout handling** for all API calls
3. **Provide loading states** and error messages for better UX
4. **Use proper accessibility** attributes and keyboard navigation
5. **Track all user interactions** for analytics and optimization
6. **Handle network failures** gracefully with retry mechanisms
7. **Store session data** appropriately for payment prefill

This frontend integration guide provides a complete user experience pattern optimized for conversion and reliability.