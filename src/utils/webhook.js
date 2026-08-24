import crypto from "node:crypto";

// Pause for the given number of milliseconds, used between retry attempts.
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Verify that the webhook was signed by Shopify using our shared secret.
export function verify_shopify_webhook(req) {
  // Shopify sends its HMAC signature in this request header.
  const hmac = req.headers["x-shopify-hmac-sha256"];

  // Reject the request if Shopify did not provide a signature.
  if (!hmac) {
    return false;
  }
  // Generate our own HMAC using the raw request body and the shared Shopify secret.
  const generated_hmac = crypto
    .createHmac("sha256", process.env.SHOPIFY_SECRET)
    .update(req.rawBody)
    .digest("base64");
  // Convert both signatures into Buffers so they can be compared securely.
  const received_buffer = Buffer.from(hmac);
  const generated_buffer = Buffer.from(generated_hmac);

  // timingSafeEqual requires buffers of the same length.
  if (received_buffer.length !== generated_buffer.length) {
    return false;
  }

  // Compare Shopify's signature with the signature we generated.
  // timingSafeEqual helps avoid timing-based attacks.
  return crypto.timingSafeEqual(received_buffer, generated_buffer);
}
