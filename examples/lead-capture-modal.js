// Enhanced Lead Capture Modal System with API Pre-fill Support
import { countryCodes } from '../js/country-codes.js';

class LeadCaptureModal {
  constructor() {
    this.originalCashfreeURL = 'https://payments.cashfree.com/forms/beyond-deck-course';
    this.leadCaptureAPI = '/api/capture-lead-simple';
    this.formLoadedTime = Date.now();
    this.originalScrollY = null;
    this.visibilityAttempts = 0;
    this.maxVisibilityAttempts = 3;
    this.init();
  }

  init() {
    this.interceptCTAButtons();
    this.injectModalHTML();
    this.addEventListeners();
  }

  interceptCTAButtons() {
    // Wait for other scripts to load, then override their behavior
    setTimeout(() => {
      // More comprehensive selector to catch all possible CTA buttons
      // Exclude accordion buttons, FAQ buttons, navigation elements, and module dropdowns
      const ctaButtons = document.querySelectorAll('a[href*="cashfree"], button[onclick*="cashfree"], .cta-button, a[href="#"]:not(.accordion-header):not(.nav-link):not(.faq-question), button[type="button"]:not(.accordion-header):not(.module-toggle):not(.faq-question):not(.nav-trigger)');
      
      // Debug logging to help identify captured buttons
      console.log(`Lead Capture Modal: Found ${ctaButtons.length} CTA buttons to intercept:`, 
        Array.from(ctaButtons).map(btn => ({
          element: btn.tagName,
          class: btn.className,
          id: btn.id,
          text: btn.textContent?.trim().substring(0, 50) || '',
          href: btn.href || 'none'
        }))
      );
      
      ctaButtons.forEach((button, index) => {
        // Additional validation: skip if button is part of interactive content areas
        const isInteractiveContent = button.closest('.accordion-item') || 
                                   button.closest('.faq-item') || 
                                   button.closest('.module-accordion-container') ||
                                   button.closest('nav') ||
                                   button.classList.contains('accordion-header') ||
                                   button.classList.contains('faq-question') ||
                                   button.classList.contains('nav-trigger');
        
        if (isInteractiveContent) {
          console.log('Skipping button in interactive content area:', button.textContent?.trim());
          return;
        }
        
        // Remove any existing href or onclick that might cause direct redirects
        if (button.href && (button.href.includes('cashfree') || button.href.includes('#'))) {
          button.removeAttribute('href');
        }
        button.removeAttribute('onclick');
        
        // Remove all existing click listeners by cloning the element
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our modal handler
        newButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          console.log('Lead capture modal triggered by button:', newButton.textContent?.trim());
          this.showModal();
          this.formLoadedTime = Date.now();
          
          if (typeof gtag !== 'undefined') {
            gtag('event', 'lead_capture_modal_shown', {
              'event_category': 'engagement',
              'event_label': 'pre_payment_capture'
            });
          }
        }, true); // Use capture phase to ensure we catch it first
      });
    }, 1500); // Wait longer than the index.html handler (1000ms)
    
    // Additional safeguard: prevent any window.open calls to Cashfree
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      if (url && url.includes('cashfree')) {
        console.log('Intercepted window.open call to Cashfree, showing lead capture modal instead');
        if (window.leadCaptureModal) {
          window.leadCaptureModal.showModal();
        }
        return null;
      }
      return originalOpen.call(this, url, target, features);
    };
  }

  async injectModalHTML() {
    try {
      // Try multiple potential paths to handle different deployment scenarios
      const possiblePaths = [
        '/components/lead-capture-modal.html',  // Absolute path
        './components/lead-capture-modal.html', // Relative path
        'components/lead-capture-modal.html'    // Original relative path
      ];
      
      let modalHTML = null;
      let lastError = null;
      
      for (const path of possiblePaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            modalHTML = await response.text();
            break;
          }
        } catch (error) {
          lastError = error;
          continue;
        }
      }
      
      if (!modalHTML) {
        throw lastError || new Error('Modal HTML not found in any path');
      }
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      this.populateCountryCodes();
      this.attachModalButtonListeners();
      
    } catch (error) {
      // Graceful fallback - redirect directly to payment
      this.redirectToPayment();
    }
  }


  populateCountryCodes() {
    const selectElement = document.getElementById('countryCode');
    if (!selectElement) {
          return;
    }

    const sortedCountryCodes = [...countryCodes].sort((a, b) => a.name.localeCompare(b.name));

    sortedCountryCodes.forEach(country => {
        const option = document.createElement('option');
        option.value = country.dial_code;
        option.textContent = `${country.name} (${country.dial_code})`;
        selectElement.appendChild(option);
    });

    selectElement.value = '+91'; // Default to India
  }

  attachModalButtonListeners() {
    const continueButton = document.getElementById('continueToPayment');
    if (continueButton) {
        continueButton.addEventListener('click', () => {
            this.submitLeadAndProceed();
        });
    }

    const closeButton = document.getElementById('closeLCModalButton');
    if (closeButton) {
        closeButton.addEventListener('click', () => this.closeModal());
    }
  }

  showModal() {
    this.showModalWithEnhancedVisibility();
  }

  // Enhanced modal display with bulletproof visibility methods
  showModalWithEnhancedVisibility() {
    const modal = document.getElementById('leadCaptureModal');
    if (!modal) {
      console.error('Lead Capture Modal: Modal element not found!');
      this.debugModalState();
      return;
    }

    // Clear any existing classes and styles
    modal.classList.remove('modal-visible', 'force-visible', 'instant-show', 'debug-mode', 'attention-mode');
    
    // Method 1: Standard display with enhanced styles
    this.displayModalStandard(modal);
    
    // Method 2: Fallback after short delay
    setTimeout(() => {
      if (!this.isModalVisible(modal)) {
        console.warn('Lead Capture Modal: Standard display failed, trying force method');
        this.displayModalForced(modal);
      }
    }, 100);
    
    // Method 3: Emergency fallback after longer delay
    setTimeout(() => {
      if (!this.isModalVisible(modal)) {
        console.error('Lead Capture Modal: All display methods failed, using emergency override');
        this.displayModalEmergency(modal);
      }
    }, 500);
    
    // Setup additional functionality
    this.setupButtonLoading();
    this.setupModalAccessibility(modal);
    this.setupFocusTrap(modal);
    
    // Focus management with fallback
    setTimeout(() => {
      this.focusFirstInput();
    }, 150);
    
    // Prevent body scroll
    this.preventBodyScroll();
    
    // Debug logging
    this.debugModalState();
  }

  // Method 1: Standard display approach
  displayModalStandard(modal) {
    modal.style.display = 'flex';
    modal.classList.add('modal-visible');
    modal.setAttribute('data-visible', 'true');
    modal.setAttribute('aria-hidden', 'false');
  }

  // Method 2: Forced display with stronger CSS
  displayModalForced(modal) {
    modal.classList.add('force-visible');
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 2147483647 !important;
      background: rgba(0, 0, 0, 0.85) !important;
      justify-content: center !important;
      align-items: center !important;
      pointer-events: auto !important;
    `;
  }

  // Method 3: Emergency override with maximum visibility
  displayModalEmergency(modal) {
    modal.classList.add('modal-emergency-show');
    modal.setAttribute('data-emergency', 'true');
    
    // Create emergency wrapper if needed
    if (!modal.classList.contains('modal-emergency-show')) {
      const emergencyWrapper = document.createElement('div');
      emergencyWrapper.className = 'modal-emergency-show';
      emergencyWrapper.appendChild(modal.cloneNode(true));
      document.body.appendChild(emergencyWrapper);
    }
  }

  // Enhanced modal visibility detection
  isModalVisible(modal) {
    const computedStyle = window.getComputedStyle(modal);
    const isDisplayed = computedStyle.display !== 'none';
    const isVisible = computedStyle.visibility !== 'hidden';
    const hasOpacity = parseFloat(computedStyle.opacity) > 0;
    const isInViewport = modal.offsetParent !== null;
    
    return isDisplayed && isVisible && hasOpacity && isInViewport;
  }

  // Enhanced accessibility setup
  setupModalAccessibility(modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.setAttribute('aria-describedby', 'modal-description');
    
    // Add title and description IDs if not present
    const title = modal.querySelector('h2');
    if (title && !title.id) {
      title.id = 'modal-title';
    }
  }

  // Focus trap implementation
  setupFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
    
    modal.classList.add('focus-trapped');
  }

  // Enhanced focus management
  focusFirstInput() {
    const emailInput = document.getElementById('email');
    if (emailInput) {
      try {
        emailInput.focus();
        emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        console.warn('Lead Capture Modal: Could not focus email input:', error);
      }
    }
  }

  // Enhanced body scroll prevention
  preventBodyScroll() {
    const body = document.body;
    const scrollY = window.scrollY;
    
    body.style.cssText = `
      overflow: hidden !important;
      position: fixed !important;
      top: -${scrollY}px !important;
      width: 100% !important;
    `;
    
    // Store scroll position for restoration
    this.originalScrollY = scrollY;
  }

  // Debug modal state for troubleshooting
  debugModalState() {
    const modal = document.getElementById('leadCaptureModal');
    if (!modal) return;
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      modalExists: !!modal,
      modalDisplay: window.getComputedStyle(modal).display,
      modalVisibility: window.getComputedStyle(modal).visibility,
      modalOpacity: window.getComputedStyle(modal).opacity,
      modalZIndex: window.getComputedStyle(modal).zIndex,
      modalClasses: modal.className,
      modalAttributes: Array.from(modal.attributes).map(attr => `${attr.name}="${attr.value}"`),
      isVisible: this.isModalVisible(modal),
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent.substring(0, 100)
    };
    
    console.log('Lead Capture Modal Debug Info:', debugInfo);
    
    // Store debug info for external access
    window.leadCaptureModalDebug = debugInfo;
  }

  // Enable debug mode for visual troubleshooting
  enableDebugMode() {
    const modal = document.getElementById('leadCaptureModal');
    if (modal) {
      modal.classList.add('debug-mode');
      console.log('Lead Capture Modal: Debug mode enabled - modal should be visible with red border');
    }
  }

  // Enable attention mode for better visibility
  enableAttentionMode() {
    const modal = document.getElementById('leadCaptureModal');
    if (modal) {
      modal.classList.add('attention-mode');
    }
  }

  setupButtonLoading() {
    const button = document.getElementById('continueToPayment');
    if (button) {
      button.originalText = button.textContent;
      
      button.setLoading = (loading) => {
        if (loading) {
          button.textContent = 'Processing...';
          button.disabled = true;
          button.classList.add('loading');
        } else {
          button.textContent = button.originalText;
          button.disabled = false;
          button.classList.remove('loading');
        }
      };
    }
  }

  closeModal() {
    this.closeModalWithEnhancedCleanup();
  }

  // Enhanced modal closing with complete cleanup
  closeModalWithEnhancedCleanup() {
    const modal = document.getElementById('leadCaptureModal');
    if (!modal) return;
    
    // Remove all visibility classes
    modal.classList.remove('modal-visible', 'force-visible', 'instant-show', 'debug-mode', 'attention-mode', 'focus-trapped');
    
    // Reset all attributes
    modal.setAttribute('data-visible', 'false');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('data-emergency');
    
    // Reset styles
    modal.style.display = 'none';
    modal.style.cssText = 'display: none !important;';
    
    // Restore body scroll
    this.restoreBodyScroll();
    
    // Clean up any emergency wrappers
    const emergencyWrappers = document.querySelectorAll('.modal-emergency-show');
    emergencyWrappers.forEach(wrapper => {
      if (wrapper !== modal) {
        wrapper.remove();
      }
    });
  }

  // Restore original body scroll state
  restoreBodyScroll() {
    const body = document.body;
    body.style.cssText = '';
    body.style.overflow = 'auto';
    
    // Restore scroll position if saved
    if (typeof this.originalScrollY === 'number') {
      window.scrollTo(0, this.originalScrollY);
      this.originalScrollY = null;
    }
  }

  showSuccessMessage(message) {
    const modal = document.getElementById('leadCaptureModal');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'lead-message lead-success';
    messageDiv.innerHTML = `
      <div class="message-content">
        <span class="message-icon">✅</span>
        <span class="message-text">${message}</span>
      </div>
    `;
    messageDiv.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1001;
      animation: slideDown 0.3s ease;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;
    modal.appendChild(messageDiv);
    
    // Remove message after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }

  showErrorMessage(message) {
    const modal = document.getElementById('leadCaptureModal');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'lead-message lead-error';
    messageDiv.innerHTML = `
      <div class="message-content">
        <span class="message-icon">⚠️</span>
        <span class="message-text">${message}</span>
      </div>
    `;
    messageDiv.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1001;
      animation: slideDown 0.3s ease;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      max-width: 90%;
      text-align: center;
    `;
    modal.appendChild(messageDiv);
    
    // Remove message after 4 seconds for errors
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 4000);
  }

  addEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });

    setTimeout(() => {
      const modal = document.getElementById('leadCaptureModal');
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target.id === 'leadCaptureModal') {
            this.closeModal();
          }
        });
      }
    }, 1000);
  }

  validateName(name) {
    if (typeof name !== 'string' || name.length < 2) return false;
    const regex = /^[a-zA-Z\s'-]+$/;
    return regex.test(name);
  }

  validateEmail(email) {
    if (typeof email !== 'string' || email.trim() === '') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email) && !email.includes(' ');
  }

  validatePhoneNumber(numberPart, countryCode) {
    if (typeof numberPart !== 'string' || numberPart.trim() === '') return false;
    const cleanNumber = numberPart.replace(/\D/g, ''); 

    if (countryCode === '+91') {
      const indianRegex = /^[6-9]\d{9}$/; 
      return cleanNumber.length === 10 && indianRegex.test(cleanNumber);
    } 
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  }

  // MODIFIED: Corrected submitLeadAndProceed to fix the syntax error
  async submitLeadAndProceed() {
    const form = document.getElementById('leadCaptureForm');
    const formData = new FormData(form);
    
    const email = formData.get('email');
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const countryCode = formData.get('countryCode'); 
    const phoneNumberPart = formData.get('phoneNumber');
    const phone = countryCode + phoneNumberPart; 

    // --- INTEGRATE VALIDATION --- //
    if (!this.validateName(firstName)) {
        alert('Please enter a valid First Name (alphabets, spaces, hyphens, apostrophes only, min 2 characters).');
        return;
    }
    if (!this.validateName(lastName)) {
        alert('Please enter a valid Last Name (alphabets, spaces, hyphens, apostrophes only, min 2 characters).');
        return;
    }
    if (!this.validateEmail(email)) {
        alert('Please enter a valid Email Address.');
        return;
    }
    if (!this.validatePhoneNumber(phoneNumberPart, countryCode)) {
        if (countryCode === '+91') {
            alert('Please enter a valid 10-digit Indian Mobile Number (starts with 6, 7, 8, or 9).');
        } else {
            alert('Please enter a valid Mobile Number (10-15 digits, digits only).');
        }
        return;
    }
    
    // Submission Timer (2 seconds delay)
    const timeElapsed = Date.now() - this.formLoadedTime;
    if (timeElapsed < 2000) {
        alert('Please wait a moment before submitting to ensure data integrity.');
        return;
    }

    // Show loading state
    const submitButton = document.getElementById('continueToPayment');
    if (submitButton.setLoading) {
      submitButton.setLoading(true);
    } else {
      submitButton.textContent = 'Processing...';
      submitButton.disabled = true;
    }

    try {
      const leadData = {
        email: email,
        firstName: firstName,
        lastName: lastName,
        phone: phone, 
        timestamp: new Date().toISOString(),
        source: 'pre_payment_capture',
        intent: 'high', 
        amount: '1499',
        currency: 'INR'
      };

      const leadResult = await this.sendLeadData(leadData);
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'lead_captured', {
          'event_category': 'conversion',
          'event_label': 'pre_payment',
          'value': 1499,
          'custom_parameters': {
            'lead_id': leadResult.lead_id,
            'zapier_success': leadResult.integrations?.zapier?.success,
            'facebook_success': leadResult.integrations?.facebook?.success
          }
        });
      }

      // Store in both localStorage and sessionStorage for compatibility
      localStorage.setItem('leadCaptureData', JSON.stringify(leadData));
      sessionStorage.setItem('leadCaptureData', JSON.stringify(leadData));
      
      // Show success message to user
      this.showSuccessMessage('✅ Thank you! You\'ll receive free resources via email. Proceeding to checkout...');
      
      // Small delay to show success message
      setTimeout(() => {
        // Redirect to checkout page with customer data
        this.redirectToCheckout(leadData);
      }, 1500);

    } catch (error) {
      console.error('Lead capture error:', error);
      
      if (submitButton.setLoading) {
        submitButton.setLoading(false);
      } else {
        submitButton.textContent = submitButton.originalText || 'Continue to Payment →';
        submitButton.disabled = false;
      }
      
      // Show more informative error message
      const errorMessage = error.message.includes('Invalid') || error.message.includes('Missing') 
        ? error.message 
        : 'We\'ll proceed to payment. Don\'t worry, your information is saved!';
      
      this.showErrorMessage(errorMessage);
      
      // Wait a bit before proceeding to payment (unless it's a validation error)
      const delay = error.message.includes('Invalid') || error.message.includes('Missing') ? 0 : 2000;
      
      if (delay > 0) {
        setTimeout(() => {
          // Redirect to checkout page even on lead capture error
          this.redirectToCheckout({
            email: email,
            firstName: firstName,
            lastName: lastName,
            phone: phone
          });
        }, delay);
      }
    }
  }

  // Load Cashfree SDK dynamically
  loadCashfreeSDK() {
    return new Promise((resolve, reject) => {
      // Check if SDK is already loaded
      if (window.Cashfree && typeof window.Cashfree === 'function') {
        resolve(window.Cashfree);
        return;
      }

      // Create script element for Cashfree SDK
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      
      script.onload = () => {
        // Wait a bit for the SDK to fully initialize
        setTimeout(() => {
          if (window.Cashfree && typeof window.Cashfree === 'function') {
            resolve(window.Cashfree);
          } else {
            reject(new Error('Cashfree SDK failed to initialize'));
          }
        }, 100);
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Cashfree SDK'));
      };
      
      document.head.appendChild(script);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Cashfree SDK load timeout'));
      }, 10000);
    });
  }

  // Initialize Cashfree checkout using the official SDK
  async initiateCheckout(payment_session_id) {
    try {
      // Try to load and use the official Cashfree SDK
      const Cashfree = await this.loadCashfreeSDK();
      
      // Determine environment based on global config
      const environment = window.GLOBAL_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox';
      

      // Initialize Cashfree instance with proper configuration
      let cashfree;
      try {
        cashfree = Cashfree({ 
          mode: environment
        });
      } catch (initError) {
        throw new Error(`Cashfree SDK initialization failed: ${initError.message}`);
      }

      // Verify the instance was created properly
      if (!cashfree || typeof cashfree.checkout !== 'function') {
        throw new Error('Cashfree SDK initialization failed - checkout method not available');
      }
      
      // Start checkout process - exact pattern from dev studio
      const checkoutOptions = {
        paymentSessionId: payment_session_id,
        redirectTarget: "_self"
      };


      // Ensure modal is closed before checkout
      this.closeModal();
      
      // Small delay to ensure modal is fully closed
      setTimeout(() => {
        try {
          cashfree.checkout(checkoutOptions);
        } catch (checkoutError) {
          // Immediate fallback to direct URL
          window.location.href = `https://payments.cashfree.com/pay/${payment_session_id}`;
        }
      }, 100);
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'cashfree_sdk_checkout_success', {
          'event_category': 'ecommerce',
          'event_label': 'sdk_checkout',
          'value': 1499
        });
      }
      
    } catch (error) {
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'cashfree_sdk_failed', {
          'event_category': 'error',
          'event_label': 'sdk_fallback',
          'value': 1499,
          'custom_parameters': {
            'error_message': error.message,
            'environment': environment
          }
        });
      }
      
      // Enhanced fallback strategy
      // Try different URL patterns
      const alternativeURLs = [
        `https://payments.cashfree.com/pay/${payment_session_id}`,
        `https://payments${environment === 'sandbox' ? '-test' : ''}.cashfree.com/pay/${payment_session_id}`,
        `https://checkout.cashfree.com/pay/${payment_session_id}`
      ];
      
      // Ensure modal is closed before redirect
      this.closeModal();
      
      // Use the first alternative URL for now
      setTimeout(() => {
        window.location.href = alternativeURLs[0];
      }, 100);
    }
  }

  // API-based payment processing method
  async processAPIPayment(leadData) {
    try {
      
      const apiPayload = {
        customer_email: leadData.email,
        customer_name: `${leadData.firstName} ${leadData.lastName || ''}`.trim(),
        customer_phone: leadData.phone,
        order_amount: 1499.00,
        order_currency: 'INR'
      };

      const response = await fetch('/api/create-payment.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload)
      });

      const result = await response.json();
      
      if (result.success && result.payment_session_id) {

        if (typeof gtag !== 'undefined') {
          gtag('event', 'api_payment_created', {
            'event_category': 'ecommerce',
            'event_label': 'session_created',
            'value': 1499,
            'custom_parameters': {
              'order_id': result.order_id,
              'payment_session_id': result.payment_session_id
            }
          });
        }
        
        // Use official Cashfree SDK checkout instead of direct URL
        await this.initiateCheckout(result.payment_session_id);
        
      } else {
        throw new Error(result.error || 'Failed to create payment session');
      }
      
    } catch (error) {
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'api_payment_failed', {
          'event_category': 'error',
          'event_label': 'fallback_to_form',
          'value': 1499
        });
      }
      
      // Fallback to the original form-based approach
      this.redirectToPaymentWithData(leadData);
    }
  }

  // Simplified method to redirect to payment form with pre-filled data (fallback)
  redirectToPaymentWithData(leadData) {
    try {
      const baseURL = this.originalCashfreeURL;
      const params = new URLSearchParams({
        'customer_name': `${leadData.firstName} ${leadData.lastName || ''}`.trim(),
        'customer_email': leadData.email,
        'customer_phone': leadData.phone
      });
      
      const paymentURL = `${baseURL}?${params.toString()}`;
      
      
      if (typeof gtag !== 'undefined') {
        gtag('event', 'payment_redirect_with_data', {
          'event_category': 'ecommerce',
          'event_label': 'form_prefilled',
          'value': 1499
        });
      }
      
      // Ensure modal is closed before redirect
      this.closeModal();
      
      // Small delay to ensure tracking events are sent and modal is closed
      setTimeout(() => {
        window.location.href = paymentURL;
      }, 300);
      
    } catch (error) {
      // Fallback to basic redirect
      this.redirectToPayment();
    }
  }

  async sendLeadData(leadData) {
    // Enhanced lead data with source tracking
    const enhancedLeadData = {
      ...leadData,
      source_url: window.location.href,
      user_agent: navigator.userAgent,
      referrer: document.referrer,
      page_title: document.title,
      screen_resolution: `${screen.width}x${screen.height}`,
      language: navigator.language
    };

    const response = await fetch(this.leadCaptureAPI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enhancedLeadData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Lead capture failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Lead captured successfully:', result);
    
    // Track Facebook Pixel Lead event on client-side for deduplication
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: 'Beyond the Deck Course Interest',
        content_category: 'Lead Magnet',
        value: leadData.amount || 1499,
        currency: leadData.currency || 'INR'
      }, {
        eventID: result.lead_id || `lead_${Date.now()}`
      });
    }

    return result;
  }

  // Redirect to checkout page with customer data
  redirectToCheckout(leadData) {
    try {
      // Store customer data in sessionStorage for checkout page
      const checkoutData = {
        email: leadData.email,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        phone: leadData.phone,
        timestamp: new Date().toISOString(),
        source: 'lead_capture_modal'
      };

      sessionStorage.setItem('checkoutCustomerData', JSON.stringify(checkoutData));

      if (typeof gtag !== 'undefined') {
        gtag('event', 'checkout_redirect', {
          'event_category': 'conversion',
          'event_label': 'lead_to_checkout',
          'value': 1499
        });
      }

      // Close modal before redirect
      this.closeModal();

      // Small delay to ensure modal is closed and tracking events are sent
      // CRITICAL: This must redirect to /secure.html (renamed from upsell for discretion)
      // Force deployment refresh - redirect fixed 2025-08-05
      setTimeout(() => {
        window.location.href = '/secure.html';
      }, 200);

    } catch (error) {
      console.error('Checkout redirect error:', error);
      // Fallback to direct payment
      this.redirectToPayment();
    }
  }

  redirectToPayment() {
    setTimeout(() => {
      window.location.href = this.originalCashfreeURL;
    }, 500);
  }
}

// Global functions for modal interactions
function closeLCModal() {
  window.leadCaptureModal.closeModal();
}

function submitLeadAndProceed() {
  window.leadCaptureModal.submitLeadAndProceed();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.leadCaptureModal = new LeadCaptureModal();
  
  // Global debugging utilities
  window.debugLeadCaptureModal = {
    show: () => window.leadCaptureModal.showModal(),
    hide: () => window.leadCaptureModal.closeModal(),
    debug: () => window.leadCaptureModal.enableDebugMode(),
    attention: () => window.leadCaptureModal.enableAttentionMode(),
    state: () => window.leadCaptureModal.debugModalState(),
    isVisible: () => {
      const modal = document.getElementById('leadCaptureModal');
      return modal ? window.leadCaptureModal.isModalVisible(modal) : false;
    },
    forceShow: () => {
      const modal = document.getElementById('leadCaptureModal');
      if (modal) {
        window.leadCaptureModal.displayModalForced(modal);
      }
    },
    emergencyShow: () => {
      const modal = document.getElementById('leadCaptureModal');
      if (modal) {
        window.leadCaptureModal.displayModalEmergency(modal);
      }
    },
    testAllMethods: () => {
      console.log('Testing all modal display methods...');
      window.leadCaptureModal.showModal();
      setTimeout(() => {
        if (!window.debugLeadCaptureModal.isVisible()) {
          console.warn('Standard method failed, trying debug mode...');
          window.debugLeadCaptureModal.debug();
        }
      }, 1000);
    }
  };
  
  // Console helper message
  console.log('Lead Capture Modal Debug Utils Available:');
  console.log('- window.debugLeadCaptureModal.show() - Show modal');
  console.log('- window.debugLeadCaptureModal.debug() - Enable debug mode (red border)');
  console.log('- window.debugLeadCaptureModal.state() - Log current state');
  console.log('- window.debugLeadCaptureModal.isVisible() - Check visibility');
  console.log('- window.debugLeadCaptureModal.forceShow() - Force display with strong CSS');
  console.log('- window.debugLeadCaptureModal.emergencyShow() - Emergency override display');
  console.log('- window.debugLeadCaptureModal.testAllMethods() - Test all display methods');
});