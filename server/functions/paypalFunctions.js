import fetch from "node-fetch";
import cors from "cors"; // Import CORS middleware if needed

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const base = "https://api-m.sandbox.paypal.com";

// Middleware to enable CORS if needed
const corsMiddleware = cors();

// Generate access token function
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
    throw new Error("Failed to generate Access Token");
  }
};

// Capture order function
const captureOrder = async (orderID) => {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders/${orderID}/capture`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        // Uncomment one of these to force an error for negative testing (in sandbox mode only)
        // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
        // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
      },
    });

    return handleResponse(response);
  } catch (error) {
    console.error("Error capturing order:", error);
    throw new Error("Failed to capture order");
  }
};

// Function to handle the response
const handleResponse = async (response) => {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
};

const paypalFunctions = {
  async createOrder(req, res) {
    try {
      // Parse request body
      const { cart } = req.body;
      // Calculate order details using cart data
      var premiumQuantity = cart[0].premiumQuantity;
      var standardQuantity = cart[1].standardQuantity;
      var studentQuantity = cart[2].studentQuantity;
      var totalPrice = cart[3].totalPrice;
      let items = [];
      // Add Premium tickets if quantity is above zero
      if (premiumQuantity > 0) {
        items.push({
          name: "Premium tickets",
          unit_amount: {
            currency_code: "USD",
            value: "65.00"
          },
          quantity: `${premiumQuantity}`
        });
      }
      // Add Standard tickets if quantity is above zero
      if (standardQuantity > 0) {
        items.push({
          name: "Standard tickets",
          unit_amount: {
            currency_code: "USD",
            value: "40.00"
          },
          quantity: `${standardQuantity}`
        });
      }
      // Add Student tickets if quantity is above zero
      if (studentQuantity > 0) {
        items.push({
          name: "Student tickets",
          unit_amount: {
            currency_code: "USD",
            value: "25.00"
          },
          quantity: `${studentQuantity}`
        });
      }
      // Generate access token
      const accessToken = await generateAccessToken();
      // Create order payload
      const orderPayload = {
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "First Presbyterian Church of Greenlawn Craig Schulman on Broadway",
            amount: {
              currency_code: "USD",
              value: `${totalPrice}`,
              breakdown: {
                item_total: {
                  currency_code: "USD",
                  value: `${totalPrice}`
                }
              }
            },
            items: items
          }
        ]
      };
      // Create order request
      const orderResponse = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });
      const orderData = await orderResponse.json();
      // Return the order data
      res.status(200).json(orderData);
    } catch (error) {
      console.error("Failed to create order:", error);
      res.status(500).json({ error: "Failed to create order." });
    }
  }
};

export default paypalFunctions;
