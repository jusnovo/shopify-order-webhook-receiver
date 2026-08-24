// Validate the Shopify payload before extracting or transforming any data.
export function validate_data(data) {
  if (data.id !== undefined && Number.isInteger(data.id) && data.id > 0) {
  } else {
    return {
      valid: false,
      error: "Error: id",
    };
  }

  if (typeof data.confirmed === "boolean" && !data.confirmed) {
  } else {
    return {
      valid: false,
      error: "Error: confirmed",
    };
  }

  if (data.created_at !== undefined && typeof data.created_at === "string") {
  } else {
    return {
      valid: false,
      error: "Error: created_at",
    };
  }

  if (data.currency !== undefined && typeof data.currency === "string") {
  } else {
    return {
      valid: false,
      error: "Error: data.currency",
    };
  }
  if (
    data.current_total_price !== undefined &&
    typeof data.current_total_price === "string" &&
    !Number.isNaN(Number(data.current_total_price))
  ) {
  } else {
    return {
      valid: false,
      error: "Error: current_total_price",
    };
  }

  if (
    data.line_items !== undefined &&
    Array.isArray(data.line_items) === true &&
    data.line_items.length > 0
  ) {
  } else {
    return {
      valid: false,
      error: "Error: line_items",
    };
  }

  const list_number = data.line_items.length;

  for (let i = 0; i < list_number; i++) {
    if (
      data.line_items[i].id !== undefined &&
      data.line_items[i].id != null &&
      Number.isInteger(data.line_items[i].id) &&
      data.line_items[i].id > 0
    ) {
    } else {
      return {
        valid: false,
        error: "data.line_items.id",
      };
    }

    if (
      data.line_items[i].name !== undefined &&
      data.line_items[i].name != null &&
      typeof data.line_items[i].name === "string"
    ) {
    } else {
      return {
        valid: false,
        error: "data.line_items.name",
      };
    }

    if (
      data.line_items[i].price !== undefined &&
      data.line_items[i].price != null &&
      typeof data.line_items[i].price === "string" &&
      !Number.isNaN(Number(data.line_items[i].price))
    ) {
    } else {
      return {
        valid: false,
        error: "data.line_items.price",
      };
    }

    if (
      data.line_items[i].quantity !== undefined &&
      data.line_items[i].quantity != null &&
      Number.isInteger(data.line_items[i].quantity) &&
      data.line_items[i].quantity > 0
    ) {
    } else {
      return {
        valid: false,
        error: "data.line_items.quantity",
      };
    }
  }

  return {
    valid: true,
  };
}

// Extract only the order fields needed by the fulfillment process.
export function extract_data(data) {
  const order_id = data.id;
  const confirmation = data.confirmed;
  const created_at = data.created_at;
  const currency = data.currency;
  const price = Number(data.current_total_price);

  const products_ordered = [];
  const list_number = data.line_items.length;
  for (let i = 0; i < list_number; i++) {
    const product_id = data.line_items[i].id;
    const product_name = data.line_items[i].name;
    const product_price = Number(data.line_items[i].price);
    const product_quantity = data.line_items[i].quantity;
    const product = {
      product_id,
      product_name,
      product_price,
      product_quantity,
    };
    products_ordered.push(product);
  }

  const order = {
    order_id,
    confirmation,
    created_at,
    currency,
    price,
    products_ordered,
  };
  return order;
}

// Convert the internal order format into the format expected by the fulfillment API.
export function transform_for_fulfillment(order) {
  const fulfillment_products = [];

  const product_count = order.products_ordered.length;

  for (let i = 0; i < product_count; i++) {
    const product_id = order.products_ordered[i].product_id;
    const product_name = order.products_ordered[i].product_name;
    const product_quantity = order.products_ordered[i].product_quantity;
    const product = {
      product_id,
      product_name,
      product_quantity,
    };
    fulfillment_products.push(product);
  }
  const order_for_fulfillment = {
    order_id: order.order_id,
    currency: order.currency,
    total: order.price,
    products: fulfillment_products,
  };
  return order_for_fulfillment;
}
