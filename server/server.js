

import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import path from "path";
import cors from "cors"; // Import the CORS middleware

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT} = process.env;
const base = "https://api-m.sandbox.paypal.com";
const app = express();

app.use(express.static("client/dist"));
// parse post params sent in body in json format
app.use(express.json());
// Enable CORS with specific origin
app.use(cors({
  origin: ['http://localhost:5173', 'https://greenlawn-presbyterian-church-concert.netlify.app']
}));

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");
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
  }
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart,
  );
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
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
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

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  return handleResponse(response);
};

async function handleResponse(response) {
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
}

app.post("/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

// serve index.html
app.get("/", (req, res) => {
  res.json("running church API")
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Node server listening at http://0.0.0.0:${PORT}/`);
});
