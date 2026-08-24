import express from "express";
import "dotenv/config";
import webhookRouter from "./routes/webhooks.js";
import fulfillmentRouter from "./routes/fulfillment/orders.js";

const app = express();

// Preserve the raw request body because Shopify's HMAC is calculated from the original payload.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use("/webhook", webhookRouter);
app.use("/fulfillment", fulfillmentRouter);

app.listen(3000, () => console.log("Listening on port 3000."));
