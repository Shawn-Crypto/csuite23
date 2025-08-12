// Secure Page (Upsell) - Complete Investment Journey
(function() {
    'use strict';

    // Configuration
    const BASE_COURSE_PRICE = 1999;
    let currentTotal = BASE_COURSE_PRICE;
    let selectedAddons = new Set();
    let customerData = null;

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeSecurePage();
        setupEventListeners();
    });

    function initializeSecurePage() {
        // Load customer data from lead capture
        const leadDataString = sessionStorage.getItem('leadCaptureData');
        if (leadDataString) {
            try {
                customerData = JSON.parse(leadDataString);
                
                // Personalize the experience
                personalizeExperience();
                
                // Store for hidden div (for debugging)
                document.getElementById('customer-data').textContent = leadDataString;
                
                console.log('✅ Customer data loaded:', customerData);
            } catch (error) {
                console.warn('Failed to parse customer data:', error);
                customerData = null;
            }
        } else {
            console.warn('No customer data found - user may have accessed directly');
        }

        // Track page view
        trackPageView();
    }

    function personalizeExperience() {
        if (!customerData || !customerData.name) return;

        try {
            const firstName = customerData.name.split(' ')[0];
            const heroTitle = document.querySelector('.hero-title');
            
            if (heroTitle && firstName) {
                heroTitle.innerHTML = `🎉 <span class="highlight">Welcome ${firstName}!</span> Maximize Your Success?`;
            }
        } catch (error) {
            console.warn('Failed to personalize experience:', error);
        }
    }

    function setupEventListeners() {
        // Handle individual addon selections
        document.querySelectorAll('.add-btn').forEach(button => {
            button.addEventListener('click', function() {
                handleAddonToggle(this);
            });
        });

        // Handle bundle selection
        const bundleButton = document.getElementById('selectBundle');
        if (bundleButton) {
            bundleButton.addEventListener('click', handleBundleSelection);
        }

        // Handle payment buttons
        const proceedButton = document.getElementById('proceedToPay');
        if (proceedButton) {
            proceedButton.addEventListener('click', handleProceedToPayment);
        }

        const skipButton = document.getElementById('skipAddons');
        if (skipButton) {
            skipButton.addEventListener('click', handleSkipAddons);
        }
    }

    function handleAddonToggle(button) {
        const card = button.closest('.upsell-card');
        const product = card.dataset.product;
        const price = parseInt(button.dataset.price);
        const btnText = button.querySelector('.btn-text');
        
        if (selectedAddons.has(product)) {
            // Remove addon
            selectedAddons.delete(product);
            currentTotal -= price;
            btnText.textContent = btnText.textContent.replace('✅ Added!', 'Yes! Add');
            button.classList.remove('selected');
            hideAddonLine(product);
            
            // Track removal
            trackAddonRemoved(product, price);
        } else {
            // Add addon
            selectedAddons.add(product);
            currentTotal += price;
            btnText.textContent = btnText.textContent.replace('Yes!', '✅ Added!');
            button.classList.add('selected');
            showAddonLine(product, price);
            
            // Track addition
            trackAddonAdded(product, price);
        }
        
        updateOrderSummary();
    }

    function handleBundleSelection() {
        // Clear individual selections
        selectedAddons.clear();
        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.classList.remove('selected');
            const btnText = btn.querySelector('.btn-text');
            btnText.textContent = btnText.textContent.replace('✅ Added!', 'Yes! Add');
        });
        
        // Set bundle
        currentTotal = 11999;
        selectedAddons.add('bundle');
        showBundleSelection();
        updateOrderSummary();

        // Track bundle selection
        trackBundleSelected();
    }

    function handleProceedToPayment() {
        trackInitiateCheckout();
        initiateRazorpayPayment();
    }

    function handleSkipAddons() {
        // Reset to base course only
        selectedAddons.clear();
        currentTotal = BASE_COURSE_PRICE;
        resetOrderSummary();
        
        // Track skip
        trackAddonsSkipped();
        
        // Proceed to payment
        initiateRazorpayPayment();
    }

    function showAddonLine(product, price) {
        const lineId = getAddonLineId(product);
        const line = document.getElementById(lineId);
        if (line) {
            line.style.display = 'flex';
        }
    }

    function hideAddonLine(product) {
        const lineId = getAddonLineId(product);
        const line = document.getElementById(lineId);
        if (line) {
            line.style.display = 'none';
        }
    }

    function getAddonLineId(product) {
        switch(product) {
            case 'premium-tools':
                return 'tools-line';
            case '1on1-mentorship':
                return 'mentorship-line';
            default:
                return null;
        }
    }

    function showBundleSelection() {
        document.getElementById('tools-line').style.display = 'flex';
        document.getElementById('mentorship-line').style.display = 'flex';
    }

    function updateOrderSummary() {
        // Update total amounts
        document.getElementById('total-amount').textContent = formatCurrency(currentTotal);
        document.getElementById('cta-amount').textContent = formatCurrency(currentTotal);
        
        // Show/hide savings
        const savings = calculateSavings();
        const savingsLine = document.getElementById('savings-line');
        const savingsAmount = document.getElementById('savings-amount');
        
        if (savings > 0) {
            savingsLine.style.display = 'flex';
            savingsAmount.textContent = formatCurrency(savings);
        } else {
            savingsLine.style.display = 'none';
        }
    }

    function calculateSavings() {
        let totalSavings = 0;
        
        if (selectedAddons.has('premium-tools')) {
            totalSavings += 0; // No savings shown for Analysis Arsenal
        }
        
        if (selectedAddons.has('1on1-mentorship')) {
            totalSavings += 0; // No savings shown for 1-on-1 Mentorship
        }
        
        if (selectedAddons.has('bundle')) {
            totalSavings = 998; // ₹12,997 - ₹11,999
        }
        
        return totalSavings;
    }

    function resetOrderSummary() {
        document.getElementById('tools-line').style.display = 'none';
        document.getElementById('mentorship-line').style.display = 'none';
        document.getElementById('savings-line').style.display = 'none';
        updateOrderSummary();
    }

    function formatCurrency(amount) {
        return `₹${amount.toLocaleString('en-IN')}`;
    }

    // Direct Razorpay checkout without dependencies
    async function createDirectRazorpayCheckout(customerData) {
        try {
            console.log('🔧 Creating direct Razorpay checkout for:', customerData);
            showLoadingOverlay();
            
            // Create order via API
            const orderResponse = await fetch('/api/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: currentTotal,
                    currency: 'INR',
                    receipt: `secure_order_${Date.now()}`,
                    notes: {
                        customer_name: customerData.name,
                        customer_email: customerData.email,
                        customer_phone: customerData.phone,
                        source: 'secure_page_direct'
                    }
                })
            });

            if (!orderResponse.ok) {
                throw new Error(`Order creation failed: ${orderResponse.status}`);
            }

            const orderData = await orderResponse.json();
            console.log('✅ Order created successfully:', orderData);

            // Load Razorpay SDK dynamically
            if (!window.Razorpay) {
                console.log('🔧 Loading Razorpay SDK...');
                await loadRazorpaySDK();
            }

            hideLoadingOverlay();

            // Initialize Razorpay checkout
            const options = {
                key: orderData.key_id,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: 'LotusLion Venture',
                description: 'The Complete Indian Investor Course',
                order_id: orderData.order.id,
                prefill: {
                    name: customerData.name,
                    email: customerData.email,
                    contact: customerData.phone
                },
                theme: {
                    color: '#1a365d'
                },
                handler: function(response) {
                    console.log('✅ Payment successful:', response);
                    handleDirectPaymentSuccess(response);
                },
                modal: {
                    ondismiss: function() {
                        hideLoadingOverlay();
                        console.log('ℹ️ Payment modal dismissed by user');
                    }
                }
            };

            console.log('🔧 Opening Razorpay checkout with options:', options);
            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error('❌ Direct checkout failed:', error);
            hideLoadingOverlay();
            alert('Payment system error. Please try again or contact support.');
        }
    }

    // Load Razorpay SDK dynamically
    function loadRazorpaySDK() {
        return new Promise((resolve, reject) => {
            if (window.Razorpay) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => {
                console.log('✅ Razorpay SDK loaded successfully');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ Failed to load Razorpay SDK');
                reject(new Error('Failed to load Razorpay SDK'));
            };
            document.head.appendChild(script);
        });
    }

    // Handle direct payment success
    function handleDirectPaymentSuccess(response) {
        // Track purchase with enhanced GTM
        if (window.gtmEnhanced) {
            window.gtmEnhanced.trackPurchase({
                transaction_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                value: currentTotal,
                payment_method: 'razorpay'
            });
        }
        
        // Redirect to success page
        window.location.href = `/success.html?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`;
    }

    async function initiateRazorpayPayment() {
        try {
            // Show loading
            showLoadingOverlay();

            // Prepare customer data
            const paymentCustomerData = getPaymentCustomerData();

            // Track checkout initiation
            trackCheckoutInitiated(paymentCustomerData);

            // Use existing Razorpay checkout functionality
            if (window.razorpayCheckout && window.razorpayCheckout.initializeCheckout) {
                // Hide loading overlay
                hideLoadingOverlay();
                
                // Initialize with current total and customer data
                window.razorpayCheckout.initializeCheckout({
                    ...paymentCustomerData,
                    amount: currentTotal
                });
            } else {
                // Fallback - use direct Razorpay SDK checkout
                setTimeout(() => {
                    console.log('🔧 DEBUG: Fallback triggered - window.razorpayCheckout not available');
                    console.log('🔧 DEBUG: Attempting direct Razorpay SDK integration');
                    
                    // Create order and open Razorpay directly
                    createDirectRazorpayCheckout(paymentCustomerData);
                }, 1000);
            }

        } catch (error) {
            console.error('Payment initiation error:', error);
            hideLoadingOverlay();
            
            // Show error message
            alert('Payment initialization failed. Please try again or contact support.');
            
            // Track error
            trackPaymentError(error);
        }
    }

    function getPaymentCustomerData() {
        // Use customer data from lead capture or fallback
        if (customerData) {
            return {
                name: customerData.name || 'Student',
                email: customerData.email || 'student@lotuslion.in',
                phone: customerData.phone || '9876543210'
            };
        } else {
            return {
                name: 'Student',
                email: 'student@lotuslion.in', 
                phone: '9876543210'
            };
        }
    }

    function showLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // Analytics & Tracking Functions
    function trackPageView() {
        if (window.gtag) {
            gtag('event', 'page_view', {
                page_title: 'Upsell Page',
                page_location: window.location.href,
                custom_parameters: {
                    customer_id: customerData?.email || 'unknown',
                    has_customer_data: !!customerData
                }
            });
        }

        // Track with dataLayer for consistency
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'upsell_page_view',
                customer_data: !!customerData,
                page_title: 'Complete Your Investment Journey'
            });
        }
    }

    function trackAddonAdded(product, price) {
        const eventId = `addon_added_${product}_${Date.now()}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'addon_added',
                event_id: eventId,
                addon_product: product,
                addon_price: price,
                total_amount: currentTotal,
                customer_email: customerData?.email || 'unknown'
            });
        }

        if (window.gtag) {
            gtag('event', 'addon_added', {
                event_category: 'ecommerce',
                event_label: product,
                value: price,
                custom_parameters: {
                    total_amount: currentTotal,
                    addon_count: selectedAddons.size
                }
            });
        }
    }

    function trackAddonRemoved(product, price) {
        const eventId = `addon_removed_${product}_${Date.now()}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'addon_removed', 
                event_id: eventId,
                addon_product: product,
                addon_price: price,
                total_amount: currentTotal
            });
        }
    }

    function trackBundleSelected() {
        const eventId = `bundle_selected_${Date.now()}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'bundle_selected',
                event_id: eventId,
                bundle_price: 11999,
                bundle_savings: 998,
                customer_email: customerData?.email || 'unknown'
            });
        }

        if (window.gtag) {
            gtag('event', 'bundle_selected', {
                event_category: 'ecommerce',
                event_label: 'complete_success_bundle',
                value: 11999,
                custom_parameters: {
                    savings_amount: 998,
                    discount_percent: 8
                }
            });
        }
    }

    function trackInitiateCheckout() {
        const eventId = `initiate_checkout_${Date.now()}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'initiate_checkout',
                event_id: eventId,
                value: currentTotal,
                currency: 'INR',
                items: [{
                    item_id: 'complete-indian-investor',
                    item_name: 'The Complete Indian Investor',
                    price: currentTotal,
                    quantity: 1
                }],
                customer_data: {
                    email: customerData?.email || 'unknown',
                    source: 'upsell_page'
                }
            });
        }
    }

    function trackCheckoutInitiated(paymentCustomerData) {
        const eventId = `checkout_initiated_${Date.now()}`;
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'checkout_initiated',
                event_id: eventId,
                checkout_value: currentTotal,
                currency: 'INR',
                addons_selected: Array.from(selectedAddons),
                customer_name: paymentCustomerData.name,
                customer_email: paymentCustomerData.email
            });
        }
    }

    function trackAddonsSkipped() {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'addons_skipped',
                event_id: `addons_skipped_${Date.now()}`,
                final_amount: BASE_COURSE_PRICE,
                customer_email: customerData?.email || 'unknown'
            });
        }
    }

    function trackPaymentError(error) {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'payment_error',
                event_id: `payment_error_${Date.now()}`,
                error_message: error.message || 'Unknown error',
                attempted_amount: currentTotal
            });
        }
    }

    // Expose functions for debugging and testing
    window.securePageDebug = {
        customerData: () => customerData,
        currentTotal: () => currentTotal,
        selectedAddons: () => Array.from(selectedAddons),
        initiatePayment: initiateRazorpayPayment,
        resetToBase: () => {
            selectedAddons.clear();
            currentTotal = BASE_COURSE_PRICE;
            resetOrderSummary();
        }
    };

})();