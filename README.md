# Shopify Order Webhook Receiver

I built a simple webhook application using Node.js that receives a request from Shopify whenever a new order is created. It verifies that the request comes from Shopify, validates and extracts the order data, and then sends it to a fulfillment service.

The project demonstrates the whole order flow end to end, including authentication, validation, data transformation, fulfillment, error handling, retries, and idempotency.

## Motivation

I wanted to learn more about APIs and webhooks specifically, and to build a complete project myself to understand how they work as part of a full integration.

## Order Flow

When a customer places an order, Shopify sends a webhook request to the application.

1. **Authentication**  
   The `POST /webhook` request is verified using Shopify's HMAC signature to make sure the request came from Shopify and not an impostor.

2. **Parsing**  
   Once the request is authenticated, Express parses the JSON payload so it can be handled as JavaScript data.

3. **Validation**  
   The order data is checked to make sure the required fields are present and have the expected types and values.

4. **Extraction and transformation**  
   The application extracts the order information needed for fulfillment and transforms it into the format expected by the fulfillment service.

5. **Fulfillment**  
   The fulfillment service acts as a simplified representation of a warehouse. It receives the order, checks whether the requested products are available, and returns a success or failure response.

6. **Idempotency**  
   Once fulfillment succeeds, the order ID is stored so that if Shopify sends the same webhook again, the order is not sent to fulfillment a second time.

   ## Features

- Shopify HMAC authentication
- Order data validation
- Data extraction and transformation
- Mock fulfillment process
- Mock inventory checking
- Retry logic for temporary failures
- Exponential backoff between retry attempts
- Idempotency to prevent duplicate fulfillment
- Error handling for invalid requests, fulfillment failures, and network errors

## Project Structure

```
src/
├── server.js
├── orderService.js
├── routes/
│   ├── webhooks.js
│   └── fulfillment/
│       └── orders.js
└── utils/
    ├── logger.js
    └── webhook.js
```

| File                           | Purpose                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `server.js`                    | Entry point of the application. Sets up Express, configures middleware, connects the routes, and starts the server.                |
| `orderService.js`              | Contains the functions responsible for processing order data: validation, extraction, and transformation.                          |
| `routes/webhooks.js`           | Contains the main webhook logic and coordinates the functions needed to process an incoming Shopify order.                         |
| `routes/fulfillment/orders.js` | Represents the mock fulfillment service. Receives fulfillment requests and checks product availability against the mock inventory. |
| `utils/logger.js`              | Provides a simple logging utility for information and error messages.                                                              |
| `utils/webhook.js`             | Contains reusable webhook-related utilities, including Shopify HMAC verification and the `sleep` function used for retries.        |

## Retry Strategy

The application distinguishes between failures that are likely to be temporary and failures that are unlikely to be fixed by retrying the same request.

- **4xx responses:** The request is not retried because the failure is treated as a fulfillment/business error that is unlikely to be resolved by sending the same request again.
- **5xx responses:** The request is attempted up to 3 times because the failure may be caused by a temporary problem on the fulfillment server.
- **Network/fetch errors:** These are also attempted up to 3 times because the request may have failed due to a temporary connectivity problem.

Retries use **exponential backoff**. The application waits 1 second before the second attempt and 2 seconds before the third attempt.

## Idempotency

Shopify may send the same webhook more than once, so the application keeps track of order IDs that have already been successfully fulfilled.

After a fulfillment request succeeds, the order ID is added to an in-memory `Set`. If the same order ID is received again, the application recognises it as already processed and returns without sending the order to the fulfillment service again.

The order ID is only stored after successful fulfillment, so a failed fulfillment attempt does not incorrectly mark the order as completed.

For simplicity, processed order IDs are stored in memory, so this state is lost when the application restarts. A production implementation would use persistent storage such as a database or distributed cache.

## Security

The application verifies that incoming webhook requests actually come from Shopify using HMAC authentication.

Shopify and the application share a secret. When Shopify sends a webhook, it uses this secret and the raw request body to generate an HMAC-SHA256 signature and sends the signature with the request.

The application independently generates the expected signature using the same shared secret and compares it with the signature received from Shopify. If the signatures do not match, the request is rejected with a `401 Unauthorized` response.

The raw request body is preserved before JSON parsing because the HMAC signature is calculated from the original request payload.

The Shopify secret is stored in an environment variable rather than being hard-coded in the application.

## Setup

### Prerequisites

- Node.js
- npm
- ngrok (required for receiving Shopify webhooks locally)

### Installation

Clone the repository and install the dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
SHOPIFY_SECRET=your_shopify_secret
```

The Shopify secret should not be committed to the repository.

### Running the application

Start the server with:

```bash
node src/server.js
```

The application runs locally on port `3000`.

### Receiving Shopify webhooks locally

Because Shopify needs to send requests to a publicly accessible URL, ngrok can be used to expose the local Express server:

```bash
ngrok http 3000
```

The generated ngrok URL can then be configured as the Shopify webhook destination:

```
https://your-ngrok-url.ngrok-free.dev/webhook
```

## Testing

The application was tested against several success and failure scenarios.

### Successful order

A valid Shopify order was sent through the complete flow:

```
Shopify → webhook receiver → validation → extraction → fulfillment
```

The order was successfully accepted by the fulfillment service and the webhook returned a successful response.

### Unavailable product

A product was removed from the mock inventory and the same order was sent again.

The fulfillment service returned a `422` response and the webhook did not retry the request, since the failure was treated as a business error.

### Duplicate webhook

The same Shopify order was sent more than once.

After the first successful fulfillment, the order ID was stored in the processed orders set. When the duplicate webhook was received, it was recognised as already processed and was not sent to fulfillment again.

### Fulfillment server error

A `500` response was simulated from the fulfillment service to test the retry logic.

The request was attempted up to three times with exponential backoff between attempts:

```
Attempt 1
   ↓
wait 1 second
   ↓
Attempt 2
   ↓
wait 2 seconds
   ↓
Attempt 3
```

### Invalid HMAC

An invalid Shopify HMAC signature was sent directly using Postman.

The request was rejected with a `401 Unauthorized` response.

### Invalid order data

Invalid order payloads were sent using Postman to test the validation logic.

The application rejected invalid data and returned a `400` response with information about the validation error.

### Network / fetch failure

The local server was stopped while the ngrok tunnel remained available to simulate the fulfillment request becoming unreachable.

The `fetch` request failed with a network error. The application caught the error and attempted the request up to three times using exponential backoff before returning a `500` error when the service remained unavailable.

## Limitations and Future Improvements

This project intentionally uses simplified components to focus on the core webhook and integration logic.

### Persistent order storage

Currently, processed order IDs are stored in an in-memory `Set`. This prevents duplicate fulfillment while the application is running, but the data is lost when the server restarts.

A production implementation would use a database to persist order and fulfillment information. This would also make it possible to build analytics around orders, fulfillment status, failures, and processing history.

### Real fulfillment service

The current fulfillment endpoint is a mock service with hard-coded inventory. A future version could integrate with a real fulfillment or warehouse management system and retrieve inventory from a persistent data source.

### Persistent logging

The current logger writes information and errors to the console. A production implementation could use a more advanced logging system that stores logs persistently, making it possible to retrieve and analyse the application's history after it has stopped or restarted.

## What I Learned

- I learned how a webhook works end to end and how useful it can be, even for relatively simple business operations.
- I learned how HMAC verification can be used to authenticate webhook requests, which also strengthened my understanding of application security.
- I learned how to think about and test different error scenarios rather than focusing only on the successful flow.
- I learned how retry logic can be useful for specific types of temporary failures, and why it should not be applied to every error.
- I gained a better understanding of how different parts of an application work together as a complete integration rather than as separate pieces of code.
