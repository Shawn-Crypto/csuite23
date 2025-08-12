const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Test credentials
const razorpay = new Razorpay({
  key_id: 'rzp_test_SWb5ypxKYwCUKK',
  key_secret: 'eUqfESP2Az0g76dorqwGmHpt'
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create order endpoint
app.post('/api/create-order', async (req, res) => {
  try {
    console.log('Creating order with data:', req.body);
    
    const { amount, currency = 'INR', receipt, notes = {} } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required'
      });
    }

    const orderData = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      notes: {
        ...notes,
        source: 'lotuslion.in',
        course: 'The Complete Indian Investor'
      }
    };

    console.log('Creating Razorpay order:', orderData);
    const order = await razorpay.orders.create(orderData);
    console.log('Order created successfully:', order.id);

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      key_id: 'rzp_test_SWb5ypxKYwCUKK'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// Verify payment endpoint
app.post('/api/verify-payment', async (req, res) => {
  try {
    console.log('Verifying payment:', req.body);
    
    // For testing purposes, we'll just return success
    // In production, you'd verify the payment signature
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('Razorpay test credentials configured');
});