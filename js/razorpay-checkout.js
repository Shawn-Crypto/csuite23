// Razorpay Checkout Integration
(function() {
    'use strict';

    // Configuration
    const COURSE_PRICE = 1999; // INR
    const COURSE_NAME = 'The Complete Indian Investor';
    const API_BASE = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : '/api';
    const API_TIMEOUT = 10000; // 10 second timeout for API calls

    // Load Razorpay script
    function loadRazorpayScript() {
        return new Promise((resolve, reject) => {
            if (window.Razorpay) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Create order via API with timeout protection
    async function createOrder(customerData) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            
            const response = await fetch(`${API_BASE}/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: COURSE_PRICE,
                    currency: 'INR',
                    receipt: `receipt_${Date.now()}`,
                    notes: {
                        customer_name: customerData.name,
                        customer_email: customerData.email,
                        customer_phone: customerData.phone,
                        course: COURSE_NAME
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Failed to create order`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your internet connection and try again.');
            }
            console.error('Error creating order:', error);
            throw error;
        }
    }

    // Verify payment via API with timeout protection
    async function verifyPayment(paymentData, customerData) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            
            const response = await fetch(`${API_BASE}/verify-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...paymentData,
                    customer_data: customerData
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Payment verification failed`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Verification timed out. Your payment may still be processing. Please contact support if needed.');
            }
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    // Track conversion with GTM and consistent event ID
    function trackConversion(orderData, paymentId) {
        // Generate consistent event ID for deduplication
        const eventId = `purchase_${orderData.order.id}_${paymentId}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'purchase',
                event_id: eventId,
                ecommerce: {
                    transaction_id: orderData.order.id,
                    value: COURSE_PRICE,
                    currency: 'INR',
                    items: [{
                        item_id: 'complete-indian-investor',
                        item_name: COURSE_NAME,
                        price: COURSE_PRICE,
                        quantity: 1
                    }]
                },
                payment_id: paymentId,
                payment_method: 'razorpay',
                client_timestamp: new Date().toISOString()
            });
        }

        // Store in localStorage for persistence
        localStorage.setItem('lastPurchase', JSON.stringify({
            order_id: orderData.order.id,
            payment_id: paymentId,
            event_id: eventId,
            amount: COURSE_PRICE,
            timestamp: new Date().toISOString()
        }));
    }

    // Initialize Razorpay checkout
    async function initializeCheckout(customerData) {
        try {
            // Show loading state
            showLoadingModal();

            // Load Razorpay script
            await loadRazorpayScript();

            // Create order
            const orderData = await createOrder(customerData);

            // Configure Razorpay options
            const options = {
                key: orderData.key_id,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: 'LotusLion',
                description: COURSE_NAME,
                order_id: orderData.order.id,
                prefill: {
                    name: customerData.name,
                    email: customerData.email,
                    contact: customerData.phone
                },
                theme: {
                    color: '#6366f1'
                },
                handler: async function(response) {
                    // Payment successful, verify it
                    try {
                        showProcessingModal();
                        
                        const verificationResult = await verifyPayment(response, customerData);
                        
                        if (verificationResult.success) {
                            // Track conversion
                            trackConversion(orderData, response.razorpay_payment_id);
                            
                            // Show success and redirect
                            showSuccessModal();
                            setTimeout(() => {
                                window.location.href = '/success.html';
                            }, 2000);
                        } else {
                            showErrorModal('Payment verification failed. Please contact support.');
                        }
                    } catch (error) {
                        console.error('Verification error:', error);
                        showErrorModal('Payment verification failed. Please contact support.');
                    }
                },
                modal: {
                    ondismiss: function() {
                        hideModal();
                    }
                }
            };

            // Hide loading and open Razorpay checkout
            hideModal();
            const rzp = new window.Razorpay(options);
            
            // Handle payment failures
            rzp.on('payment.failed', function(response) {
                console.error('Payment failed:', response.error);
                showErrorModal(`Payment failed: ${response.error.description || 'Unknown error'}`);
                
                // Track failed payment with consistent event ID
                const failEventId = `payment_failed_${orderData.order.id}_${Date.now()}`;
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'payment_failed',
                        event_id: failEventId,
                        error_code: response.error.code,
                        error_description: response.error.description,
                        order_id: orderData.order.id,
                        client_timestamp: new Date().toISOString()
                    });
                }
            });

            rzp.open();

        } catch (error) {
            console.error('Checkout initialization error:', error);
            hideModal();
            showErrorModal('Failed to initialize payment. Please try again.');
        }
    }

    // Modal functions
    function createModal() {
        const existingModal = document.getElementById('razorpay-modal');
        if (existingModal) {
            return existingModal;
        }

        const modal = document.createElement('div');
        modal.id = 'razorpay-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = `
            background: white;
            padding: 32px;
            border-radius: 12px;
            max-width: 400px;
            text-align: center;
            position: relative;
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);
        return modal;
    }

    function showLoadingModal() {
        const modal = createModal();
        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            <h3 style="margin: 16px 0 8px; color: #333;">Initializing Payment</h3>
            <p style="color: #666; margin: 0;">Please wait while we set up your checkout...</p>
        `;
        modal.style.display = 'flex';

        // Add spinner animation
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    function showProcessingModal() {
        const modal = createModal();
        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            <h3 style="margin: 16px 0 8px; color: #333;">Processing Payment</h3>
            <p style="color: #666; margin: 0;">Verifying your transaction...</p>
        `;
        modal.style.display = 'flex';
    }

    function showSuccessModal() {
        const modal = createModal();
        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                    <svg width="30" height="30" fill="white" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                </div>
            </div>
            <h3 style="margin: 16px 0 8px; color: #333;">Payment Successful!</h3>
            <p style="color: #666; margin: 0;">Redirecting to your course access...</p>
        `;
        modal.style.display = 'flex';
    }

    function showErrorModal(message) {
        const modal = createModal();
        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="width: 60px; height: 60px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                    <svg width="30" height="30" fill="white" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </div>
            </div>
            <h3 style="margin: 16px 0 8px; color: #333;">Payment Failed</h3>
            <p style="color: #666; margin: 0 0 20px;">${message}</p>
            <button onclick="window.hideRazorpayModal()" style="background: #6366f1; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 16px;">Close</button>
        `;
        modal.style.display = 'flex';
    }

    function hideModal() {
        const modal = document.getElementById('razorpay-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Expose hideModal globally for button onclick
    window.hideRazorpayModal = hideModal;

    // Customer form modal
    function showCustomerForm(callback) {
        const modal = createModal();
        const content = modal.querySelector('.modal-content');
        
        content.innerHTML = `
            <h2 style="margin: 0 0 24px; color: #333;">Complete Your Enrollment</h2>
            <form id="customer-form" style="text-align: left;">
                <div style="margin-bottom: 16px;">
                    <label for="customer-name" style="display: block; margin-bottom: 4px; color: #555; font-size: 14px;">Full Name *</label>
                    <input type="text" id="customer-name" name="name" required aria-describedby="name-error" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
                    <div id="name-error" class="error-message" style="color: #ef4444; font-size: 12px; margin-top: 4px; display: none;"></div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label for="customer-email" style="display: block; margin-bottom: 4px; color: #555; font-size: 14px;">Email Address *</label>
                    <input type="email" id="customer-email" name="email" required aria-describedby="email-error" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;">
                    <div id="email-error" class="error-message" style="color: #ef4444; font-size: 12px; margin-top: 4px; display: none;"></div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label for="customer-phone" style="display: block; margin-bottom: 4px; color: #555; font-size: 14px;">Phone Number * (10 digits)</label>
                    <input type="tel" id="customer-phone" name="phone" required pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" aria-describedby="phone-error" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px;" maxlength="10">
                    <div id="phone-error" class="error-message" style="color: #ef4444; font-size: 12px; margin-top: 4px; display: none;"></div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: flex-start; font-size: 14px; color: #555;">
                        <input type="checkbox" id="terms-checkbox" required aria-describedby="terms-error" style="margin-right: 8px; margin-top: 2px;">
                        <span>I agree to the <a href="/terms.html" target="_blank" style="color: #6366f1;" rel="noopener">Terms of Service</a> and <a href="/privacy.html" target="_blank" style="color: #6366f1;" rel="noopener">Privacy Policy</a></span>
                    </label>
                    <div id="terms-error" class="error-message" style="color: #ef4444; font-size: 12px; margin-top: 4px; display: none;"></div>
                </div>
                <div id="form-errors" style="margin-bottom: 16px; color: #ef4444; font-size: 14px; display: none;"></div>
                <div style="display: flex; gap: 12px;">
                    <button type="button" onclick="window.hideRazorpayModal()" style="flex: 1; background: #e5e7eb; color: #333; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 16px;">Cancel</button>
                    <button type="submit" id="submit-btn" style="flex: 1; background: #6366f1; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 16px;">Proceed to Payment</button>
                </div>
            </form>
        `;

        modal.style.display = 'flex';

        const form = document.getElementById('customer-form');
        const submitBtn = document.getElementById('submit-btn');
        
        // Add real-time validation
        addFormValidation(form);
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            clearFormErrors();
            
            const formData = new FormData(form);
            const customerData = {
                name: formData.get('name').trim(),
                email: formData.get('email').trim().toLowerCase(),
                phone: formData.get('phone').replace(/\D/g, '') // Remove non-digits
            };
            
            // Client-side validation
            const validationErrors = validateCustomerData(customerData);
            if (validationErrors.length > 0) {
                showFormErrors(validationErrors);
                return;
            }
            
            // Disable submit button to prevent double submission
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            
            try {
                // Capture lead before payment
                await captureLeadBeforePayment(customerData);
                hideModal();
                callback(customerData);
            } catch (error) {
                console.warn('Lead capture failed, but continuing with payment:', error);
                hideModal();
                callback(customerData);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Proceed to Payment';
            }
        });
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Replace all Cashfree links with Razorpay checkout
        const paymentLinks = document.querySelectorAll('a[href*="payments.cashfree.com"]');
        
        paymentLinks.forEach(link => {
            link.removeAttribute('href');
            link.style.cursor = 'pointer';
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Track checkout initiation with event ID
                const checkoutEventId = `begin_checkout_${Date.now()}`;
                if (window.dataLayer) {
                    window.dataLayer.push({
                        event: 'begin_checkout',
                        event_id: checkoutEventId,
                        value: COURSE_PRICE,
                        currency: 'INR',
                        client_timestamp: new Date().toISOString()
                    });
                }

                // Show customer form first
                showCustomerForm(function(customerData) {
                    initializeCheckout(customerData);
                });
            });
        });

        // Also handle the hero section click if it exists
        const heroSection = document.querySelector('.hero-content');
        if (heroSection && heroSection.style.cursor === 'pointer') {
            heroSection.addEventListener('click', function(e) {
                // Only trigger if not clicking on another interactive element
                if (e.target === heroSection || e.target.closest('.hero-content') === heroSection) {
                    if (!e.target.closest('a') && !e.target.closest('button')) {
                        e.preventDefault();
                        
                        const heroCheckoutEventId = `begin_checkout_hero_${Date.now()}`;
                        if (window.dataLayer) {
                            window.dataLayer.push({
                                event: 'begin_checkout',
                                event_id: heroCheckoutEventId,
                                value: COURSE_PRICE,
                                currency: 'INR',
                                client_timestamp: new Date().toISOString()
                            });
                        }

                        showCustomerForm(function(customerData) {
                            initializeCheckout(customerData);
                        });
                    }
                }
            });
        }
    });

    // Lead capture before payment
    async function captureLeadBeforePayment(customerData) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            
            const response = await fetch(`${API_BASE}/capture-lead`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: customerData.name,
                    email: customerData.email,
                    phone: customerData.phone,
                    source: 'checkout_form',
                    utm_source: getUrlParameter('utm_source'),
                    utm_medium: getUrlParameter('utm_medium'),
                    utm_campaign: getUrlParameter('utm_campaign')
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.warn('Lead capture API returned error:', response.status);
                return; // Don't block payment flow
            }
            
            const result = await response.json();
            console.log('✅ Lead captured successfully');
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Lead capture timed out, continuing with payment');
            } else {
                console.warn('Lead capture failed:', error.message);
            }
            // Don't block payment flow for lead capture failures
        }
    }
    
    // Form validation utilities
    function validateCustomerData(data) {
        const errors = [];
        
        if (!data.name || data.name.length < 2) {
            errors.push('Please enter a valid full name (at least 2 characters)');
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!data.email || !emailRegex.test(data.email)) {
            errors.push('Please enter a valid email address');
        }
        
        // Indian mobile number validation: starts with 6-9, exactly 10 digits
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!data.phone || !phoneRegex.test(data.phone)) {
            errors.push('Please enter a valid 10-digit Indian mobile number');
        }
        
        return errors;
    }
    
    function addFormValidation(form) {
        const nameInput = form.querySelector('#customer-name');
        const emailInput = form.querySelector('#customer-email');
        const phoneInput = form.querySelector('#customer-phone');
        
        // Real-time phone number formatting and validation
        phoneInput.addEventListener('input', function(e) {
            // Only allow digits
            this.value = this.value.replace(/\D/g, '');
            
            // Limit to 10 digits
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
            
            // Real-time validation
            const errorDiv = document.getElementById('phone-error');
            if (this.value.length > 0 && this.value.length < 10) {
                this.style.borderColor = '#ef4444';
                errorDiv.textContent = 'Phone number must be 10 digits';
                errorDiv.style.display = 'block';
            } else if (this.value.length === 10 && !this.value.match(/^[6-9]/)) {
                this.style.borderColor = '#ef4444';
                errorDiv.textContent = 'Indian mobile numbers start with 6, 7, 8, or 9';
                errorDiv.style.display = 'block';
            } else {
                this.style.borderColor = '#ddd';
                errorDiv.style.display = 'none';
            }
        });
        
        // Email validation
        emailInput.addEventListener('blur', function() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const errorDiv = document.getElementById('email-error');
            if (this.value && !emailRegex.test(this.value)) {
                this.style.borderColor = '#ef4444';
                errorDiv.textContent = 'Please enter a valid email address';
                errorDiv.style.display = 'block';
            } else {
                this.style.borderColor = '#ddd';
                errorDiv.style.display = 'none';
            }
        });
        
        // Name validation
        nameInput.addEventListener('blur', function() {
            const errorDiv = document.getElementById('name-error');
            if (this.value.trim().length < 2) {
                this.style.borderColor = '#ef4444';
                errorDiv.textContent = 'Please enter your full name';
                errorDiv.style.display = 'block';
            } else {
                this.style.borderColor = '#ddd';
                errorDiv.style.display = 'none';
            }
        });
    }
    
    function showFormErrors(errors) {
        const errorDiv = document.getElementById('form-errors');
        errorDiv.innerHTML = errors.map(error => `• ${error}`).join('<br>');
        errorDiv.style.display = 'block';
    }
    
    function clearFormErrors() {
        const errorDiv = document.getElementById('form-errors');
        errorDiv.style.display = 'none';
        
        // Clear individual field errors
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
        });
        
        // Reset field borders
        document.querySelectorAll('#customer-form input').forEach(input => {
            input.style.borderColor = '#ddd';
        });
    }
    
    // Utility function to get URL parameters
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || '';
    }

    // Expose functions globally for testing
    window.razorpayCheckout = {
        initializeCheckout,
        showCustomerForm,
        createOrder,
        verifyPayment,
        captureLeadBeforePayment,
        validateCustomerData
    };
})();