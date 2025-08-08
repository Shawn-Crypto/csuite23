// Razorpay Payment Integration
// This script handles the complete Razorpay checkout integration

// Function to read specific cookie value for Meta tracking
function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
}

// Function to capture client-side data for Meta CAPI
function captureClientData() {
    return {
        fbp: getCookieValue('_fbp'),
        fbc: getCookieValue('_fbc'),
        customer_info: {
            // These could be populated from form fields if available
            name: null,
            email: null,
            phone: null
        }
    };
}

// Main payment initiation function
async function initiateRazorpayPayment() {
    try {
        // Show loading state
        const loadingMessage = 'Processing payment request...';
        console.log(loadingMessage);

        // Capture client-side data for Meta tracking
        const clientData = captureClientData();

        // Call backend to create a Razorpay Order
        const orderResponse = await fetch('/api/create-order', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(clientData)
        });

        if (!orderResponse.ok) {
            throw new Error(`Order creation failed: ${orderResponse.status} ${orderResponse.statusText}`);
        }

        const order = await orderResponse.json();

        if (!order.success || !order.order_id) {
            throw new Error('Invalid order response from server');
        }

        console.log('Order created successfully:', {
            order_id: order.order_id,
            amount: order.amount,
            currency: order.currency
        });

        // Generate transaction ID for tracking (using Razorpay order_id format)
        const transactionId = order.order_id;
        const transactionValue = order.amount / 100; // Convert paise to rupees

        // Store transaction data in localStorage for success page
        localStorage.setItem('pendingTransactionId', transactionId);
        localStorage.setItem('pendingTransactionValue', transactionValue);
        localStorage.setItem('pendingOrderData', JSON.stringify({
            order_id: order.order_id,
            amount: order.amount,
            currency: order.currency,
            created_at: order.created_at
        }));

        console.log('Transaction data stored:', {
            id: transactionId,
            value: transactionValue
        });

        // Configure Razorpay Checkout modal
        const razorpayOptions = {
            key: order.key_id, // Razorpay Key ID from backend
            amount: order.amount, // Amount in paise
            currency: order.currency,
            name: 'Lotuslion',
            description: 'The Complete Indian Investor Course',
            image: '/assets/logo.webp',
            order_id: order.order_id,
            
            // Customer prefill (can be enhanced with form data)
            prefill: {
                name: '',
                email: '',
                contact: ''
            },
            
            // Theme customization
            theme: {
                color: '#F5A623'
            },
            
            // Success handler
            handler: function (response) {
                console.log('Payment successful:', response);
                
                // Store successful payment data
                localStorage.setItem('razorpay_payment_id', response.razorpay_payment_id);
                localStorage.setItem('razorpay_order_id', response.razorpay_order_id);
                localStorage.setItem('razorpay_signature', response.razorpay_signature);
                
                // Update transaction status
                localStorage.setItem('paymentStatus', 'success');
                
                // Redirect to success page
                window.location.href = '/success.html';
            },
            
            // Modal configuration
            modal: {
                ondismiss: function() {
                    console.log('Payment modal dismissed');
                    // Optional: Track abandonment
                }
            },
            
            // Error handling
            error: function(error) {
                console.error('Payment error:', error);
                alert('Payment failed. Please try again.');
                
                // Store error data for debugging
                localStorage.setItem('paymentStatus', 'failed');
                localStorage.setItem('paymentError', JSON.stringify(error));
            }
        };

        // Initialize and open Razorpay checkout
        const razorpayInstance = new window.Razorpay(razorpayOptions);
        razorpayInstance.open();

    } catch (error) {
        console.error('Payment initiation failed:', error);
        alert('Unable to process payment. Please try again later.');
        
        // Store error for debugging
        localStorage.setItem('paymentStatus', 'error');
        localStorage.setItem('paymentError', error.message);
    }
}

// Initialize payment integration when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Razorpay integration initialized');
    
    // Find all payment links and convert them to buttons
    const paymentLinks = document.querySelectorAll('a[href*="checkout.razorpay.com"]');
    
    paymentLinks.forEach((link, index) => {
        // Prevent default link behavior
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            console.log(`Payment button ${index + 1} clicked`);
            
            // Check if Razorpay is loaded
            if (typeof window.Razorpay === 'undefined') {
                console.error('Razorpay checkout script not loaded');
                alert('Payment system is loading. Please try again in a moment.');
                return;
            }
            
            // Initiate payment
            initiateRazorpayPayment();
        });
        
        // Update link styling to indicate it's a payment button
        link.style.cursor = 'pointer';
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', 'Start payment process');
    });
    
    console.log(`Converted ${paymentLinks.length} payment links to Razorpay buttons`);
});

// Export functions for potential external use
window.RazorpayIntegration = {
    initiatePayment: initiateRazorpayPayment,
    getCookieValue: getCookieValue,
    captureClientData: captureClientData
};
