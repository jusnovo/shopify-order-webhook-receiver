import express from "express";
import logger from "../../utils/logger.js";

const router = express.Router();

// Mock inventory used to simulate product availability in the fulfillment service.
const inventory = [
  141249953214522980, 866550311766439000, 789012345678901200,
  890123456789012400, 257004973105704600, 271878346596884000,
];

router.post("/orders", (req, res) => {
  const fulfillment_order = req.body;
  logger.info("Fulfillment order received.");

  const count = fulfillment_order.products.length;

  for (let i = 0; i < count; i++) {
    const product_id = fulfillment_order.products[i].product_id;
    // Return a business error when any requested product is unavailable.
    if (!inventory.includes(product_id)) {
      res.status(422).json({
        success: false,
        status: "Unavailable product.",
      });
      return;
    }
  }

  res.status(201).json({
    success: true,
    status: "Success.",
  });
});

export default router;
