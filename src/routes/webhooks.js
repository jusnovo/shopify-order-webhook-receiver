import express from "express";
import logger from "../utils/logger.js";
import {
  validate_data,
  extract_data,
  transform_for_fulfillment,
} from "./orderService.js";
import { verify_shopify_webhook, sleep } from "../utils/webhook.js";

const router = express.Router();

// Storing processed order IDs in memory to prevent duplicate fulfillment.
const processed_orders = new Set();

router.post("/", async (req, res) => {
  logger.info("Webhook received");

  // Shopify signs the raw request body, so verification must happen before the body is modified or transformed.
  if (!verify_shopify_webhook(req)) {
    logger.error("Invalid Shopify authentication");
    res.status(401).send("Unauthorized");
    return;
  }

  const data = req.body;

  if (processed_orders.has(data.id)) {
    logger.info("Order " + data.id + " already processed.");
    res.status(200).send("Already processed.");
    return;
  }

  const result = validate_data(data);
  if (result.valid === true) {
    logger.info("Order " + data.id + " is validated.");
    const extracted_data = extract_data(data);
    logger.info("Data from order " + data.id + " is extracted.");

    const fulfillment_order = transform_for_fulfillment(extracted_data);

    // Retry temporary fulfillment failures up to 3 times.
    for (let attempt = 1; attempt <= 3; attempt++) {
      let response;
      try {
        response = await fetch("http://localhost:3000/fulfillment/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fulfillment_order),
        });
      } catch (error) {
        if (attempt < 3) {
          // Retry temporary failures using exponential backoff.
          const delay = 1000 * 2 ** (attempt - 1);
          await sleep(delay);
          continue;
        }
        logger.error("Fulfillment request failed: " + error.message);
        res.status(500).json({
          success: false,
          status: "Error. Fulfillment failed.",
        });
        return;
      }

      if (response.ok) {
        // Mark the order as processed only after successful fulfillment.
        processed_orders.add(data.id);

        res.status(200).json({
          success: true,
          status: "Success.",
        });
        return;
      }

      // Fulfillment business errors are not retried because repeating the same request will not change the result.
      if (response.status >= 400 && response.status < 500) {
        logger.error("Fulfillment failed. Status: " + response.status);

        res.status(500).json({
          success: false,
          status: "Fulfillment request failed.",
        });
        return;
      }

      if (response.status >= 500) {
        if (attempt < 3) {
          const delay = 1000 * 2 ** (attempt - 1);
          await sleep(delay);
        } else {
          logger.error("Fulfillment failed. Status: " + response.status);
          res.status(500).json({
            success: false,
            status: "Error. Fulfillment failed.",
          });
          return;
        }
      }
    }
  } else {
    logger.error("Error: wrong data: " + result.error);
    res.status(400);
    res.send("Error: wrong data: " + result.error);
  }
});

export default router;
