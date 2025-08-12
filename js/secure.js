// Secure Page (Upsell) - Complete Investment Journey
(function() {
    'use strict';

    // --- State Management ---
    const state = {
        basePrice: 1999,
        addons: {
            'premium-tools': { name: 'Analysis Arsenal', price: 1999, selected: false },
            '1on1-mentorship': { name: '1-on-1 Mentorship', price: 9999, selected: false }
        },
        bundle: {
            name: 'The Professional Investor Transformation',
            price: 11999,
            selected: false
        },
        customerData: null,
        get total() {
            if (this.bundle.selected) {
                return this.bundle.price;
            }
            let total = this.basePrice;
            for (const key in this.addons) {
                if (this.addons[key].selected) {
                    total += this.addons[key].price;
                }
            }
            return total;
        },
        get savings() {
            if (this.bundle.selected) {
                const individualPrice = this.basePrice + this.addons['premium-tools'].price + this.addons['1on1-mentorship'].price;
                return individualPrice - this.bundle.price;
            }
            return 0;
        }
    };

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', function() {
        loadCustomerData();
        setupEventListeners();
        render();
        trackPageView();
    });

    function loadCustomerData() {
        const leadDataString = sessionStorage.getItem('leadCaptureData');
        if (leadDataString) {
            try {
                state.customerData = JSON.parse(leadDataString);
                document.getElementById('customer-data').textContent = leadDataString;
                personalizeExperience();
                console.log('✅ Customer data loaded:', state.customerData);
            } catch (error) {
                console.warn('Failed to parse customer data:', error);
            }
        } else {
            console.warn('No customer data found.');
        }
    }

    function personalizeExperience() {
        if (!state.customerData || !state.customerData.name) return;
        const firstName = state.customerData.name.split(' ')[0];
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle && firstName) {
            heroTitle.innerHTML = `🎉 <span class="highlight">Welcome ${firstName}!</span> Maximize Your Success?`;
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        document.querySelectorAll('.add-btn').forEach(button => {
            button.addEventListener('click', () => handleAddonToggle(button.closest('.upsell-card').dataset.product));
        });

        document.getElementById('selectBundle').addEventListener('click', handleBundleSelection);
        document.getElementById('proceedToPay').addEventListener('click', handleProceedToPayment);
        document.getElementById('skipAddons').addEventListener('click', handleSkipAddons);
    }

    // --- Event Handlers ---
    function handleAddonToggle(productKey) {
        state.bundle.selected = false; // Selecting an individual addon deselects the bundle
        state.addons[productKey].selected = !state.addons[productKey].selected;
        
        if (state.addons[productKey].selected) {
            trackAddonAdded(productKey);
        } else {
            trackAddonRemoved(productKey);
        }
        
        render();
    }

    function handleBundleSelection() {
        state.bundle.selected = true;
        // Ensure individual addons are marked as selected for visual consistency
        state.addons['premium-tools'].selected = true;
        state.addons['1on1-mentorship'].selected = true;
        trackBundleSelected();
        render();
    }

    function handleProceedToPayment() {
        trackInitiateCheckout();
        initiateRazorpayPayment();
    }

    function handleSkipAddons() {
        // Reset state to base course only
        state.bundle.selected = false;
        state.addons['premium-tools'].selected = false;
        state.addons['1on1-mentorship'].selected = false;
        trackAddonsSkipped();
        initiateRazorpayPayment();
    }

    // --- Rendering / DOM Updates ---
    function render() {
        // Update Addon Buttons
        for (const key in state.addons) {
            const card = document.querySelector(`.upsell-card[data-product="${key}"]`);
            if (card) {
                const button = card.querySelector('.add-btn');
                const btnText = button.querySelector('.btn-text');
                if (state.addons[key].selected) {
                    button.classList.add('selected');
                    btnText.textContent = btnText.textContent.replace(/Yes!.*$/, '✅ Added!');
                } else {
                    button.classList.remove('selected');
                    btnText.textContent = btnText.textContent.replace('✅ Added!', `Yes! Give Me The ${state.addons[key].name}`);
                }
            }
        }

        // Update Order Summary
        document.getElementById('tools-line').style.display = state.addons['premium-tools'].selected ? 'flex' : 'none';
        document.getElementById('mentorship-line').style.display = state.addons['1on1-mentorship'].selected ? 'flex' : 'none';

        const savingsLine = document.getElementById('savings-line');
        if (state.savings > 0) {
            savingsLine.style.display = 'flex';
            document.getElementById('savings-amount').textContent = formatCurrency(state.savings);
        } else {
            savingsLine.style.display = 'none';
        }

        // Update Totals
        document.getElementById('total-amount').textContent = formatCurrency(state.total);
        document.getElementById('cta-amount').textContent = formatCurrency(state.total);
    }

    function formatCurrency(amount) {
        return `₹${amount.toLocaleString('en-IN')}`;
    }

    // --- Payment Logic ---
    async function initiateRazorpayPayment() {
        try {
            showLoadingOverlay();
            const paymentCustomerData = getPaymentCustomerData();
            trackCheckoutInitiated(paymentCustomerData);
            await createDirectRazorpayCheckout(paymentCustomerData);
        } catch (error) {
            console.error('Payment initiation error:', error);
            hideLoadingOverlay();
            alert('Payment initialization failed. Please try again or contact support.');
            trackPaymentError(error);
        }
    }

    async function createDirectRazorpayCheckout(customerData) {
        try {
            console.log('🔧 Creating direct Razorpay checkout for:', customerData);
            const orderResponse = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: state.total,
                    currency: 'INR',
                    receipt: `secure_order_${Date.now()}`,
                    notes: {
                        customer_name: customerData.name,
                        customer_email: customerData.email,
                        customer_phone: customerData.phone,
                        source: 'secure_page_direct',
                        bundle_selected: state.bundle.selected,
                        addons: Object.keys(state.addons).filter(k => state.addons[k].selected)
                    }
                })
            });

            if (!orderResponse.ok) {
                throw new Error(`Order creation failed: ${orderResponse.status}`);
            }

            const orderData = await orderResponse.json();
            console.log('✅ Order created successfully:', orderData);

            if (!window.Razorpay) await loadRazorpaySDK();
            hideLoadingOverlay();

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
                theme: { color: '#1a365d' },
                handler: handleDirectPaymentSuccess,
                modal: { ondismiss: () => hideLoadingOverlay() }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error('❌ Direct checkout failed:', error);
            hideLoadingOverlay();
            alert('Payment system error. Please try again or contact support.');
            throw error; // Re-throw to be caught by initiateRazorpayPayment
        }
    }

    function loadRazorpaySDK() {
        return new Promise((resolve, reject) => {
            if (window.Razorpay) return resolve();
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
            document.head.appendChild(script);
        });
    }

    function handleDirectPaymentSuccess(response) {
        console.log('✅ Payment successful:', response);
        // GTM tracking can be added here
        window.location.href = `/success.html?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`;
    }

    function getPaymentCustomerData() {
        return {
            name: state.customerData?.name || 'Student',
            email: state.customerData?.email || 'student@lotuslion.in',
            phone: state.customerData?.phone || '9876543210'
        };
    }

    function showLoadingOverlay() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    function hideLoadingOverlay() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    // --- Analytics & Tracking ---
    function trackPageView() {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'upsell_page_view',
                customer_data: !!state.customerData,
            });
        }
    }

    function trackAddonAdded(productKey) {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'add_to_cart',
                ecommerce: {
                    currency: 'INR',
                    value: state.addons[productKey].price,
                    items: [{
                        item_id: productKey,
                        item_name: state.addons[productKey].name,
                        price: state.addons[productKey].price,
                        quantity: 1
                    }]
                }
            });
        }
    }

    function trackAddonRemoved(productKey) {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'remove_from_cart',
                ecommerce: {
                    currency: 'INR',
                    value: state.addons[productKey].price,
                    items: [{
                        item_id: productKey,
                        item_name: state.addons[productKey].name,
                        price: state.addons[productKey].price,
                        quantity: 1
                    }]
                }
            });
        }
    }
    
    function trackBundleSelected() {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'add_to_cart',
                ecommerce: {
                    currency: 'INR',
                    value: state.bundle.price,
                    items: [{
                        item_id: 'bundle',
                        item_name: state.bundle.name,
                        price: state.bundle.price,
                        quantity: 1
                    }]
                }
            });
        }
    }

    function trackInitiateCheckout() {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'begin_checkout',
                ecommerce: {
                    currency: 'INR',
                    value: state.total,
                    items: getCartItems()
                }
            });
        }
    }
    
    function trackAddonsSkipped() {
        if (window.dataLayer) {
            window.dataLayer.push({ event: 'addons_skipped', final_amount: state.basePrice });
        }
    }

    function trackPaymentError(error) {
        if (window.dataLayer) {
            window.dataLayer.push({
                event: 'payment_error',
                error_message: error.message || 'Unknown error',
                attempted_amount: state.total
            });
        }
    }
    
    function getCartItems() {
        const items = [{
            item_id: 'base_course',
            item_name: 'The Complete Indian Investor',
            price: state.basePrice,
            quantity: 1
        }];
        if (state.bundle.selected) {
            items.push({
                item_id: 'bundle_discount',
                item_name: 'Bundle Discount',
                price: state.bundle.price - (state.basePrice + state.addons['premium-tools'].price + state.addons['1on1-mentorship'].price),
                quantity: 1
            });
        } else {
            for (const key in state.addons) {
                if (state.addons[key].selected) {
                    items.push({
                        item_id: key,
                        item_name: state.addons[key].name,
                        price: state.addons[key].price,
                        quantity: 1
                    });
                }
            }
        }
        return items;
    }

})();
