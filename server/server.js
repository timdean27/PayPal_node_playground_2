import express from "express";
import cors from "cors";
import paypalFunctions from "./functions/paypal"; // Import your PayPal functions

const app = express();

app.use(express.static("client/dist"));
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'https://greenlawn-presbyterian-church-concert.netlify.app']
}));

// Define your routes
app.post("/api/orders", paypalFunctions.createOrder);
app.post("/api/orders/:orderID/capture", paypalFunctions.captureOrder);

app.get("/", (req, res) => {
  res.json("running church API");
});

// Listen on any available port
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running.");
});

module.exports.handler = serverless(app)