# Part 2: Intermediate SQL & Query Optimization

> Move beyond basics. Master subqueries, window functions, indexing, normalization, and transactions — the core toolkit for mid-level and senior SQL interviews.

---

## Table of Contents

- [2.1 Subqueries — Scalar, Row, Table, Correlated](#21-subqueries--scalar-row-table-correlated)
- [2.2 Common Table Expressions (CTEs)](#22-common-table-expressions-ctes)
- [2.3 Window Functions](#23-window-functions)
- [2.4 Indexing Basics](#24-indexing-basics)
- [2.5 Query Optimization Basics](#25-query-optimization-basics)
- [2.6 Normalization (1NF, 2NF, 3NF, BCNF)](#26-normalization-1nf-2nf-3nf-bcnf)
- [2.7 Transactions & ACID Properties](#27-transactions--acid-properties)
- [2.8 Views & Materialized Views](#28-views--materialized-views)
- [2.9 Intermediate Query Problems & Practice](#29-intermediate-query-problems--practice)

---

## Sample Schema (Extended)

```sql
-- Building on Part 1's schema, adding:

CREATE TABLE orders (
    order_id    SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id),
    order_date  TIMESTAMP NOT NULL DEFAULT NOW(),
    total       NUMERIC(12, 2) NOT NULL,
    status      VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    city        VARCHAR(50),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    item_id    SERIAL PRIMARY KEY,
    order_id   INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity   INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE products (
    product_id   SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    category     VARCHAR(50),
    price        NUMERIC(10, 2) NOT NULL,
    stock        INT DEFAULT 0
);
```

---

## 2.1 Subqueries — Scalar, Row, Table, Correlated

### Question: What are the different types of subqueries? When should you use each?

**Answer:**

A subquery is a query nested inside another query. There are four main types:

#### 1. Scalar Subquery — Returns a single value

```sql
-- Find employees who earn more than the company average
SELECT first_name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- Use a scalar subquery in SELECT
SELECT
    first_name,
    salary,
    salary - (SELECT AVG(salary) FROM employees) AS diff_from_avg
FROM employees;
```

#### 2. Row Subquery — Returns a single row with multiple columns

```sql
-- Find the employee with the highest salary (handles ties — returns one)
SELECT * FROM employees
WHERE (dept_id, salary) = (
    SELECT dept_id, MAX(salary)
    FROM employees
    GROUP BY dept_id
    ORDER BY MAX(salary) DESC
    LIMIT 1
);
```

#### 3. Table Subquery — Returns multiple rows and columns

```sql
-- Find departments whose average salary is above 80000
SELECT dept_name
FROM departments
WHERE dept_id IN (
    SELECT dept_id
    FROM employees
    GROUP BY dept_id
    HAVING AVG(salary) > 80000
);
```

#### 4. Correlated Subquery — References the outer query (executes once per outer row)

```sql
-- Find employees who earn more than their department's average
SELECT e.first_name, e.salary, e.dept_id
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.dept_id = e.dept_id  -- references outer query's dept_id
);
```

**Performance comparison:**

```sql
-- Correlated subquery: executes inner query for EACH row of outer query
-- This can be O(n × m) — slow for large tables!

-- Equivalent JOIN version (usually faster — optimizer can choose best algorithm):
SELECT e.first_name, e.salary, e.dept_id
FROM employees e
INNER JOIN (
    SELECT dept_id, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept_id
) dept_avg ON e.dept_id = dept_avg.dept_id
WHERE e.salary > dept_avg.avg_sal;
```

**EXISTS vs IN:**

```sql
-- EXISTS: stops at the first match (short-circuits)
-- Better when inner query returns many rows

SELECT * FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
);

-- IN: evaluates the entire inner query, then checks membership
-- Better when inner query returns few rows

SELECT * FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders);

-- Key difference: EXISTS handles NULLs correctly; IN does not (with NOT IN)
```

> **Why the interviewer asks this:** Subquery type selection and the EXISTS vs IN debate come up in every intermediate SQL interview. The correlated subquery performance trap is especially important.

**Follow-up:** *Can you always rewrite a correlated subquery as a JOIN? Are there cases where a correlated subquery is preferred?*

---

## 2.2 Common Table Expressions (CTEs)

### Question: What are CTEs and when should you use them over subqueries?

**Answer:**

A CTE (Common Table Expression) is a **named temporary result set** defined with the `WITH` keyword. It exists only for the duration of a single query.

```sql
-- Basic CTE
WITH dept_stats AS (
    SELECT
        dept_id,
        COUNT(*) AS headcount,
        AVG(salary) AS avg_salary
    FROM employees
    GROUP BY dept_id
)
SELECT
    d.dept_name,
    ds.headcount,
    ROUND(ds.avg_salary, 2) AS avg_salary
FROM dept_stats ds
JOIN departments d ON ds.dept_id = d.dept_id
WHERE ds.headcount > 3
ORDER BY ds.avg_salary DESC;
```

**Multiple CTEs (chained):**

```sql
WITH
-- Step 1: Calculate department stats
dept_stats AS (
    SELECT dept_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY dept_id
),
-- Step 2: Find the overall average
company_avg AS (
    SELECT AVG(avg_salary) AS overall_avg FROM dept_stats
),
-- Step 3: Flag departments above/below average
dept_comparison AS (
    SELECT
        ds.dept_id,
        ds.avg_salary,
        ca.overall_avg,
        CASE
            WHEN ds.avg_salary > ca.overall_avg THEN 'Above Average'
            ELSE 'Below Average'
        END AS comparison
    FROM dept_stats ds
    CROSS JOIN company_avg ca
)
SELECT d.dept_name, dc.avg_salary, dc.comparison
FROM dept_comparison dc
JOIN departments d ON dc.dept_id = d.dept_id;
```

**Recursive CTE — for hierarchical data:**

```sql
-- Find the entire management chain for employee 'Dave'
WITH RECURSIVE management_chain AS (
    -- Base case: start with Dave
    SELECT emp_id, first_name, manager_id, 1 AS level
    FROM employees
    WHERE first_name = 'Dave'

    UNION ALL

    -- Recursive case: find each person's manager
    SELECT e.emp_id, e.first_name, e.manager_id, mc.level + 1
    FROM employees e
    INNER JOIN management_chain mc ON e.emp_id = mc.manager_id
)
SELECT level, first_name
FROM management_chain
ORDER BY level;

-- Output:
-- level | first_name
-- 1     | Dave
-- 2     | Bob        (Dave's manager)
-- 3     | Alice      (Bob's manager / CEO)
```

**CTE vs Subquery — when to use which:**

| Feature | CTE | Subquery |
|---|---|---|
| Readability | Excellent for complex logic | Fine for simple cases |
| Reusability | Can reference multiple times | Must repeat the query |
| Recursion | Supported | Not supported |
| Performance | Usually same as subquery | Usually same as CTE |
| Materialization | PostgreSQL may materialize | Inlined by optimizer |

**Performance note:** In PostgreSQL 12+, CTEs are **inlined by default** (optimized like subqueries). In older versions, CTEs were **always materialized** (executed once, stored in temp table), which could be slower or faster depending on context. You can force materialization with:

```sql
WITH dept_stats AS MATERIALIZED (
    SELECT dept_id, COUNT(*) AS cnt FROM employees GROUP BY dept_id
)
SELECT * FROM dept_stats WHERE cnt > 5;
```

> **Why the interviewer asks this:** CTEs show you can write maintainable SQL. Recursive CTEs are a must-know for any role dealing with hierarchical data (org charts, category trees, bill of materials).

**Follow-up:** *What is the maximum recursion depth in PostgreSQL and how can you control it?*

---

## 2.3 Window Functions

### Question: Explain window functions. How are they different from GROUP BY?

**Answer:**

Window functions perform calculations **across a set of rows related to the current row** without collapsing them into groups. Unlike `GROUP BY`, window functions preserve individual rows.

```sql
-- GROUP BY: collapses rows → one row per group
SELECT dept_id, AVG(salary) FROM employees GROUP BY dept_id;
-- Returns 3 rows (one per department)

-- Window function: computes per group, but KEEPS all rows
SELECT
    emp_id,
    first_name,
    dept_id,
    salary,
    AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg
FROM employees;
-- Returns ALL employee rows, each with their department's average salary
```

**Window function anatomy:**

```sql
function_name() OVER (
    PARTITION BY column      -- defines the "window" (like GROUP BY but without collapsing)
    ORDER BY column          -- defines ordering within each partition
    ROWS/RANGE BETWEEN ...   -- defines the frame (which rows to include)
)
```

### Ranking Functions

```sql
SELECT
    first_name,
    dept_id,
    salary,
    ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS row_num,
    RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rank,
    DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dense_rank
FROM employees;

-- For dept_id = 1 with salaries: 100k, 90k, 90k, 80k:
-- first_name | salary  | row_num | rank | dense_rank
-- Alice      | 100000  | 1       | 1    | 1
-- Bob        | 90000   | 2       | 2    | 2
-- Carol      | 90000   | 3       | 2    | 2      ← tied
-- Dave       | 80000   | 4       | 4    | 3      ← rank skips to 4, dense_rank doesn't
```

**Key differences:**
- `ROW_NUMBER()`: Always unique (1, 2, 3, 4) — arbitrarily breaks ties
- `RANK()`: Ties get same rank, then skips (1, 2, 2, 4)
- `DENSE_RANK()`: Ties get same rank, no skip (1, 2, 2, 3)

### Aggregate Window Functions

```sql
SELECT
    first_name,
    dept_id,
    salary,
    SUM(salary) OVER (PARTITION BY dept_id) AS dept_total,
    SUM(salary) OVER () AS company_total,  -- empty OVER = entire table
    ROUND(salary::NUMERIC / SUM(salary) OVER (PARTITION BY dept_id) * 100, 1)
        AS pct_of_dept
FROM employees;
```

### LAG and LEAD — Access previous/next rows

```sql
-- Compare each employee's salary with the previous hire's salary
SELECT
    first_name,
    hire_date,
    salary,
    LAG(salary, 1) OVER (ORDER BY hire_date) AS prev_hire_salary,
    salary - LAG(salary, 1) OVER (ORDER BY hire_date) AS salary_diff
FROM employees;

-- LAG(column, n, default): look back n rows
-- LEAD(column, n, default): look forward n rows
```

### Running Totals and Moving Averages

```sql
-- Running total of orders by date
SELECT
    order_date,
    total,
    SUM(total) OVER (ORDER BY order_date
                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders;

-- 7-day moving average of daily revenue
SELECT
    order_date,
    daily_revenue,
    AVG(daily_revenue) OVER (ORDER BY order_date
                             ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7d
FROM daily_revenue_summary;
```

### Frame Specification (ROWS vs RANGE)

```sql
-- ROWS: physical rows
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW     -- current row + 2 rows before
ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  -- all rows up to current

-- RANGE: logical range based on values
RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW  -- date-based window

-- IMPORTANT: Default frame when ORDER BY is specified:
-- RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
-- This means all rows from start to current row (with ties included!)
```

### NTILE, FIRST_VALUE, LAST_VALUE, NTH_VALUE

```sql
SELECT
    first_name,
    salary,
    NTILE(4) OVER (ORDER BY salary DESC) AS salary_quartile,
    FIRST_VALUE(first_name) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS top_earner,
    LAST_VALUE(first_name) OVER (
        PARTITION BY dept_id ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_earner
FROM employees;

-- Note: LAST_VALUE requires explicit frame!
-- Default frame only goes up to current row, so LAST_VALUE
-- would just return the current row without the full frame.
```

> **Why the interviewer asks this:** Window functions are the #1 topic for intermediate-to-senior SQL interviews. They separate "I know SQL" from "I'm good at SQL."

**Follow-up:** *Write a query to find the top 3 earners in each department using a window function.*

---

### Question: Write a query to find the top 3 earners in each department.

**Answer:**

```sql
WITH ranked_employees AS (
    SELECT
        e.emp_id,
        e.first_name,
        d.dept_name,
        e.salary,
        DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rnk
    FROM employees e
    JOIN departments d ON e.dept_id = d.dept_id
)
SELECT emp_id, first_name, dept_name, salary, rnk
FROM ranked_employees
WHERE rnk <= 3
ORDER BY dept_name, rnk;
```

**Why DENSE_RANK over ROW_NUMBER?**
- `DENSE_RANK`: If two people tie for #2, both get rank 2, and the next person gets rank 3. You get **at least** 3 salary levels.
- `ROW_NUMBER`: Arbitrarily assigns different numbers to ties. You get **exactly** 3 people but might miss someone with the same salary.

Choose based on requirements: "top 3 people" → `ROW_NUMBER`; "top 3 salary tiers" → `DENSE_RANK`.

---

## 2.4 Indexing Basics

### Question: What are indexes, how do they work, and when should you create them?

**Answer:**

An index is a **data structure** (usually a B-tree) that speeds up data retrieval at the cost of slower writes and additional storage space. Think of it like a book's index — instead of reading every page, you look up the topic and jump to the right page.

**Without index (Sequential Scan):**
```
Table: 1,000,000 rows
Query: SELECT * FROM employees WHERE email = 'alice@test.com'
→ Scans ALL 1,000,000 rows → O(n)
```

**With index (Index Scan):**
```
B-tree index on email
→ Binary search through index → O(log n)
→ ~20 comparisons for 1 million rows
```

#### Creating Indexes

```sql
-- Basic single-column index
CREATE INDEX idx_employees_email ON employees (email);

-- Composite index (column order matters!)
CREATE INDEX idx_employees_dept_salary ON employees (dept_id, salary);

-- Unique index (also enforces uniqueness)
CREATE UNIQUE INDEX idx_employees_email_unique ON employees (email);

-- Partial index (index only a subset of rows)
CREATE INDEX idx_active_orders ON orders (customer_id)
WHERE status = 'pending';  -- only indexes pending orders

-- Expression index
CREATE INDEX idx_employees_lower_email ON employees (LOWER(email));
-- Now this query uses the index:
SELECT * FROM employees WHERE LOWER(email) = 'alice@test.com';
```

#### Composite Index — Column Order Matters

```sql
CREATE INDEX idx_dept_salary ON employees (dept_id, salary);

-- ✅ Uses index (leftmost prefix match)
SELECT * FROM employees WHERE dept_id = 1;

-- ✅ Uses index (both columns)
SELECT * FROM employees WHERE dept_id = 1 AND salary > 80000;

-- ❌ Cannot use this index efficiently (missing leading column)
SELECT * FROM employees WHERE salary > 80000;
-- Would need a separate index: CREATE INDEX idx_salary ON employees (salary);

-- Think of it like a phone book:
-- Sorted by (last_name, first_name)
-- You can look up "Smith" → fast
-- You can look up "Smith, John" → fast
-- You can look up just "John" → must scan the whole book
```

#### When to Create Indexes

**DO index:**
- Columns in `WHERE` clauses (especially with `=`, `<`, `>`, `BETWEEN`)
- Columns in `JOIN` conditions
- Columns in `ORDER BY` (eliminates sort operations)
- Columns in `GROUP BY`
- Foreign key columns (PostgreSQL doesn't auto-index FKs!)

**Do NOT index:**
- Small tables (< 1000 rows) — sequential scan is faster
- Columns with very low cardinality (e.g., `gender` with only 2 values)
- Tables with heavy write load — each INSERT/UPDATE/DELETE must update all indexes
- Columns that are rarely queried

**Cost of indexes:**

| Benefit | Cost |
|---|---|
| Faster SELECT/WHERE/JOIN | Slower INSERT (must update index) |
| Faster ORDER BY | Slower UPDATE (may need to update index) |
| Faster GROUP BY | Slower DELETE (must update index) |
| | Additional disk space |
| | More choices for query planner (can sometimes pick wrong plan) |

> **Why the interviewer asks this:** Every performance question eventually comes down to indexing. The composite index column order question is a classic interview trap.

**Follow-up:** *How do you check if an index is actually being used by a query?*

---

## 2.5 Query Optimization Basics

### Question: How do you identify and fix slow queries?

**Answer:**

#### Step 1: Use EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT e.first_name, d.dept_name
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
WHERE e.salary > 80000;
```

**Reading the output:**

```
Hash Join  (cost=1.09..24.53 rows=333 width=218) (actual time=0.045..0.152 rows=250 loops=1)
  Hash Cond: (e.dept_id = d.dept_id)
  ->  Seq Scan on employees e  (cost=0.00..18.50 rows=333 width=122) (actual time=0.009..0.065 rows=250 loops=1)
        Filter: (salary > 80000)
        Rows Removed by Filter: 750
  ->  Hash  (cost=1.05..1.05 rows=3 width=104) (actual time=0.015..0.015 rows=3 loops=1)
        ->  Seq Scan on departments d  (cost=0.00..1.05 rows=3 width=104) (actual time=0.003..0.005 rows=3 loops=1)
Planning Time: 0.215 ms
Execution Time: 0.198 ms
```

**Key things to look for:**
- **Seq Scan on large tables** → Need an index?
- **High `Rows Removed by Filter`** → Index on filter column could help
- **Nested Loop with large tables** → Consider if a Hash/Merge Join is better
- **Sort operations** → Index on ORDER BY columns?
- **Large difference between estimated and actual rows** → Stale statistics (`ANALYZE table`)

#### Common Optimization Patterns

**1. Add appropriate indexes:**

```sql
-- Before: Seq Scan (scans all rows)
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
-- Seq Scan on orders  (cost=0.00..1520.00 rows=50 width=...)

-- Add index:
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

-- After: Index Scan (jumps directly to matching rows)
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
-- Index Scan using idx_orders_customer_id on orders  (cost=0.29..8.50 rows=50 width=...)
```

**2. Avoid SELECT * — select only needed columns:**

```sql
-- ❌ Bad: fetches all columns (more I/O, can't use covering index)
SELECT * FROM employees WHERE dept_id = 1;

-- ✅ Good: fetch only what you need
SELECT first_name, salary FROM employees WHERE dept_id = 1;

-- Even better with a covering index:
CREATE INDEX idx_dept_name_salary ON employees (dept_id) INCLUDE (first_name, salary);
-- Now the query can be answered entirely from the index (Index Only Scan)
```

**3. Use EXISTS instead of COUNT for existence checks:**

```sql
-- ❌ Slow: counts ALL matching rows
SELECT * FROM customers c
WHERE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) > 0;

-- ✅ Fast: stops at first match
SELECT * FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

**4. Avoid functions on indexed columns:**

```sql
-- ❌ Cannot use index on salary (function applied to column)
SELECT * FROM employees WHERE YEAR(hire_date) = 2024;

-- ✅ Rewrite to use range (index-friendly)
SELECT * FROM employees
WHERE hire_date >= '2024-01-01' AND hire_date < '2025-01-01';
```

**5. Fix N+1 query problems:**

```sql
-- ❌ N+1 Problem (application code):
-- Query 1: SELECT * FROM departments;  (fetches 10 departments)
-- Then for EACH department:
-- Query 2-11: SELECT * FROM employees WHERE dept_id = ?;  (10 more queries)

-- ✅ Single query with JOIN:
SELECT d.dept_name, e.first_name, e.salary
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id;
```

> **Why the interviewer asks this:** Query optimization is a daily task for backend engineers. They want to see systematic debugging (EXPLAIN → identify bottleneck → fix) rather than random guessing.

**Follow-up:** *What are PostgreSQL's different scan types and when does the optimizer choose each one?*

---

## 2.6 Normalization (1NF, 2NF, 3NF, BCNF)

### Question: Explain database normalization forms with examples.

**Answer:**

Normalization is the process of organizing data to **minimize redundancy** and **prevent anomalies** (insertion, update, deletion anomalies).

#### Unnormalized Table (The Problem)

```
orders_raw:
order_id | customer_name | customer_email    | product_names          | product_prices
1        | Alice         | alice@test.com    | Laptop, Mouse          | 1200, 25
2        | Alice         | alice@test.com    | Keyboard               | 75
3        | Bob           | bob@test.com      | Laptop                 | 1200
```

**Problems:**
- **Update anomaly:** If Alice changes her email, you must update multiple rows
- **Insertion anomaly:** Can't add a new customer without an order
- **Deletion anomaly:** If you delete Bob's only order, you lose Bob's customer info
- **Data inconsistency:** What if "Laptop" is $1200 in one row and $1100 in another?

---

#### First Normal Form (1NF) — Atomic values, no repeating groups

**Rule:** Each column contains only **atomic (indivisible) values**. No arrays, no comma-separated lists.

```sql
-- ❌ Violates 1NF (multi-valued columns)
-- product_names: "Laptop, Mouse"
-- product_prices: "1200, 25"

-- ✅ 1NF: One value per cell
-- order_id | customer_name | customer_email  | product_name | product_price
-- 1        | Alice         | alice@test.com  | Laptop       | 1200
-- 1        | Alice         | alice@test.com  | Mouse        | 25
-- 2        | Alice         | alice@test.com  | Keyboard     | 75
-- 3        | Bob           | bob@test.com    | Laptop       | 1200
```

---

#### Second Normal Form (2NF) — No partial dependencies

**Rule:** Must be in 1NF + every non-key column must depend on the **entire** primary key (not just part of a composite key).

```sql
-- The 1NF table has composite key: (order_id, product_name)
-- customer_name depends only on order_id (partial dependency!) → violates 2NF

-- ✅ 2NF: Split into separate tables
CREATE TABLE orders (
    order_id       SERIAL PRIMARY KEY,
    customer_name  VARCHAR(100),
    customer_email VARCHAR(100)
);

CREATE TABLE order_items (
    order_id      INT REFERENCES orders(order_id),
    product_name  VARCHAR(100),
    product_price NUMERIC(10,2),
    PRIMARY KEY (order_id, product_name)
);
```

---

#### Third Normal Form (3NF) — No transitive dependencies

**Rule:** Must be in 2NF + no non-key column depends on another non-key column.

```sql
-- In the orders table: customer_email depends on customer_name
-- (customer_name → customer_email), which depends on order_id
-- This is a transitive dependency: order_id → customer_name → customer_email

-- ✅ 3NF: Extract customers into their own table
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name        VARCHAR(100),
    email       VARCHAR(100)
);

CREATE TABLE orders (
    order_id    SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(customer_id),
    order_date  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name       VARCHAR(100),
    price      NUMERIC(10, 2)
);

CREATE TABLE order_items (
    order_id   INT REFERENCES orders(order_id),
    product_id INT REFERENCES products(product_id),
    quantity   INT DEFAULT 1,
    unit_price NUMERIC(10, 2),  -- price at time of order (may differ from current price)
    PRIMARY KEY (order_id, product_id)
);
```

---

#### Boyce-Codd Normal Form (BCNF) — Stricter 3NF

**Rule:** For every functional dependency X → Y, X must be a **superkey**. This handles edge cases where 3NF still allows anomalies when there are multiple candidate keys.

```sql
-- Example that's 3NF but NOT BCNF:
-- student_courses(student_id, course, professor)
-- Functional dependencies:
--   (student_id, course) → professor     (each student has one professor per course)
--   professor → course                    (each professor teaches only one course)
--
-- professor → course, but professor is NOT a superkey → violates BCNF

-- ✅ BCNF: Split the table
-- professors(professor_id, professor_name, course)
-- student_enrollments(student_id, professor_id)
```

**Normalization summary:**

| Form | Rule | Eliminates |
|---|---|---|
| 1NF | Atomic values | Repeating groups |
| 2NF | No partial dependencies | Partial dependency on composite key |
| 3NF | No transitive dependencies | Non-key → non-key dependencies |
| BCNF | Every determinant is a superkey | Anomalies from multiple candidate keys |

**When to denormalize:**

- Read-heavy workloads where JOINs are too expensive
- Data warehouses / analytics (star schema, snowflake schema)
- Caching frequently accessed computed values
- When write frequency is low but read frequency is extremely high

> **Why the interviewer asks this:** Normalization demonstrates you can design schemas that prevent data corruption. Knowing when to denormalize shows you can make practical trade-offs.

**Follow-up:** *What is the difference between a star schema and a snowflake schema?*

---

## 2.7 Transactions & ACID Properties

### Question: What are ACID properties? Explain each with real-world examples.

**Answer:**

A **transaction** is a sequence of operations treated as a single unit of work. ACID properties guarantee data reliability.

#### Atomicity — All or Nothing

```sql
-- Transfer $500 from Account A to Account B
BEGIN;
    UPDATE accounts SET balance = balance - 500 WHERE account_id = 'A';
    UPDATE accounts SET balance = balance + 500 WHERE account_id = 'B';
COMMIT;

-- If the system crashes after the first UPDATE but before COMMIT:
-- The entire transaction is rolled back → Account A still has its money
-- You never end up in a state where money "disappeared"
```

#### Consistency — Valid state to valid state

```sql
-- Constraints ensure the database moves from one valid state to another
-- Example: balance cannot go negative

ALTER TABLE accounts ADD CONSTRAINT chk_positive_balance CHECK (balance >= 0);

BEGIN;
    UPDATE accounts SET balance = balance - 500 WHERE account_id = 'A';
    -- If Account A only has $300, this CHECK constraint fails
    -- → Entire transaction is rolled back
    UPDATE accounts SET balance = balance + 500 WHERE account_id = 'B';
COMMIT;
```

#### Isolation — Concurrent transactions don't interfere

```sql
-- Two concurrent transactions:
-- Transaction 1: Transfer $500 from A to B
-- Transaction 2: Read balance of A and B for a report

-- Without isolation, Transaction 2 might read:
--   A after debit (-500) but B before credit (+500)
--   → Report shows $500 "missing"

-- With proper isolation, Transaction 2 sees either:
--   Both BEFORE the transfer, or both AFTER — never a partial state
```

#### Durability — Committed = Permanent

```sql
-- After COMMIT returns successfully:
COMMIT;
-- ↑ At this point, the data is guaranteed to survive a crash
-- The database writes to WAL (Write-Ahead Log) BEFORE confirming commit
-- Even if power goes out 1ms later, the transaction is safe
```

#### Transaction Control

```sql
-- Basic transaction
BEGIN;
    INSERT INTO orders (customer_id, total) VALUES (1, 99.99);
    INSERT INTO order_items (order_id, product_id, quantity) VALUES (LASTVAL(), 5, 2);
COMMIT;

-- Rollback on error
BEGIN;
    UPDATE inventory SET stock = stock - 1 WHERE product_id = 5;
    -- Oops, something went wrong
ROLLBACK;  -- undo everything since BEGIN

-- Savepoints (partial rollback)
BEGIN;
    INSERT INTO orders (customer_id, total) VALUES (1, 99.99);
    SAVEPOINT sp1;
    INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 999, 1);
    -- product_id 999 doesn't exist → error
    ROLLBACK TO sp1;  -- undo only the order_items insert
    INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 5, 1);
    -- This works fine
COMMIT;  -- order + correct order_item are committed
```

**Real-world scenario — What happens without ACID:**

```
Scenario: E-commerce checkout
1. Deduct inventory: stock = stock - 1
2. Charge credit card
3. Create order record
4. Send confirmation email

If step 3 fails WITHOUT a transaction:
- Inventory is deducted (step 1 committed)
- Credit card is charged (step 2 committed)
- But no order exists in the system!
- Customer is charged with no order to track

WITH a transaction:
- Steps 1-3 are in a single transaction
- If step 3 fails, steps 1-2 are rolled back
- Customer is not charged, inventory is restored
- Step 4 (email) is outside the transaction (sent only after commit)
```

> **Why the interviewer asks this:** ACID understanding is non-negotiable for any backend role. Real-world scenarios (bank transfers, e-commerce) are the most common interview format.

**Follow-up:** *What are the different transaction isolation levels and what anomalies does each prevent?*

---

## 2.8 Views & Materialized Views

### Question: What are views and materialized views? When should you use each?

**Answer:**

#### Regular View — A stored query (not data)

```sql
-- Create a view for department statistics
CREATE VIEW v_department_stats AS
SELECT
    d.dept_id,
    d.dept_name,
    COUNT(e.emp_id) AS headcount,
    ROUND(AVG(e.salary), 2) AS avg_salary,
    SUM(e.salary) AS total_salary
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_id, d.dept_name;

-- Use it like a table
SELECT * FROM v_department_stats WHERE headcount > 5;

-- The query is re-executed every time you SELECT from the view
-- No data is stored — it's just a named query
```

#### Materialized View — Cached query results

```sql
-- Create a materialized view (stores actual data)
CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*) AS order_count,
    SUM(total) AS revenue
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;

-- Query it (reads from cached data — very fast)
SELECT * FROM mv_monthly_revenue WHERE month >= '2024-01-01';

-- Refresh when underlying data changes
REFRESH MATERIALIZED VIEW mv_monthly_revenue;

-- Concurrent refresh (doesn't lock reads during refresh)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
-- Requires a UNIQUE index on the materialized view
CREATE UNIQUE INDEX idx_mv_monthly_revenue ON mv_monthly_revenue (month);
```

**Comparison:**

| Feature | View | Materialized View |
|---|---|---|
| Stores data | No (query only) | Yes (cached results) |
| Read speed | Recomputes each time | Fast (pre-computed) |
| Data freshness | Always current | Stale until refreshed |
| Write overhead | None | Refresh cost |
| Indexes | No | Yes (can add indexes) |
| Use case | Simplify complex queries | Dashboard/reporting, expensive aggregations |

> **Why the interviewer asks this:** Materialized views are a practical tool for optimizing read-heavy reporting workloads. Understanding the trade-off between freshness and performance is essential.

**Follow-up:** *How would you set up automatic refresh for a materialized view?*

---

## 2.9 Intermediate Query Problems & Practice

### Problem 1: Running Total

```sql
-- Question: Calculate the running total of order amounts per customer, ordered by date.

SELECT
    customer_id,
    order_date,
    total,
    SUM(total) OVER (
        PARTITION BY customer_id
        ORDER BY order_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total
FROM orders
ORDER BY customer_id, order_date;
```

---

### Problem 2: Year-over-Year Growth

```sql
-- Question: Calculate the month-over-month revenue growth percentage.

WITH monthly_revenue AS (
    SELECT
        DATE_TRUNC('month', order_date) AS month,
        SUM(total) AS revenue
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue,
    ROUND(
        (revenue - LAG(revenue) OVER (ORDER BY month))
        / LAG(revenue) OVER (ORDER BY month) * 100,
        2
    ) AS growth_pct
FROM monthly_revenue
ORDER BY month;
```

**Step-by-step:**
1. CTE aggregates revenue by month
2. `LAG(revenue)` gets the previous month's revenue
3. Growth formula: `(current - previous) / previous * 100`
4. First month shows NULL (no previous month to compare)

---

### Problem 3: Find Gaps in Sequential IDs

```sql
-- Question: Find missing order IDs (gaps in the sequence).

WITH id_range AS (
    SELECT generate_series(
        (SELECT MIN(order_id) FROM orders),
        (SELECT MAX(order_id) FROM orders)
    ) AS id
)
SELECT ir.id AS missing_order_id
FROM id_range ir
LEFT JOIN orders o ON ir.id = o.order_id
WHERE o.order_id IS NULL
ORDER BY ir.id;
```

---

### Problem 4: Percentile / Median Salary

```sql
-- Question: Find the median salary per department.

-- Method 1: Using PERCENTILE_CONT (exact)
SELECT
    dept_id,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary
FROM employees
GROUP BY dept_id;

-- Method 2: Using window functions (manual approach)
WITH ranked AS (
    SELECT
        dept_id,
        salary,
        ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS rn,
        COUNT(*) OVER (PARTITION BY dept_id) AS cnt
    FROM employees
)
SELECT dept_id, AVG(salary) AS median_salary
FROM ranked
WHERE rn IN (FLOOR((cnt + 1.0) / 2), CEIL((cnt + 1.0) / 2))
GROUP BY dept_id;
```

---

### Problem 5: Customers Who Bought All Products

```sql
-- Question: Find customers who have purchased every product in the catalog.

SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (
    SELECT p.product_id
    FROM products p
    WHERE NOT EXISTS (
        SELECT 1
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.customer_id = c.customer_id
          AND oi.product_id = p.product_id
    )
);

-- This is "relational division":
-- "Find customers where there is NO product that they have NOT purchased"
-- Double NOT EXISTS = for all
```

**Step-by-step:**
1. Outer: for each customer
2. First NOT EXISTS: check if there's any product...
3. Second NOT EXISTS: ...that the customer has NOT bought
4. If no such "unbought" product exists, the customer bought everything

---

### Problem 6: Debugging — Incorrect Aggregation

```sql
-- Bug: This query is supposed to show total order amount per customer,
-- but the totals are inflated. Why?

SELECT
    c.name,
    COUNT(*) AS total_items,
    SUM(oi.unit_price * oi.quantity) AS total_spent
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY c.name;

-- The totals are CORRECT in this case. But what if we also join payments?

SELECT
    c.name,
    SUM(oi.unit_price * oi.quantity) AS total_spent,
    SUM(p.amount) AS total_paid
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN payments p ON o.order_id = p.order_id
GROUP BY c.name;

-- ❌ BUG: If an order has 3 items and 2 payments, each item is duplicated
-- for each payment → 3 × 2 = 6 rows per order → inflated totals!

-- ✅ FIX: Aggregate separately, then join
WITH order_totals AS (
    SELECT order_id, SUM(unit_price * quantity) AS order_total
    FROM order_items
    GROUP BY order_id
),
payment_totals AS (
    SELECT order_id, SUM(amount) AS payment_total
    FROM payments
    GROUP BY order_id
)
SELECT
    c.name,
    SUM(ot.order_total) AS total_spent,
    SUM(pt.payment_total) AS total_paid
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_totals ot ON o.order_id = ot.order_id
LEFT JOIN payment_totals pt ON o.order_id = pt.order_id
GROUP BY c.name;
```

> This "fan-out" or "row explosion" bug is one of the most common aggregation mistakes in production code.

---

### Problem 7: Output-Based Question

```sql
-- What does this query output?

WITH RECURSIVE nums AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM nums WHERE n < 5
)
SELECT n, n * n AS square FROM nums;
```

**Answer:**

```
 n | square
---+--------
 1 |      1
 2 |      4
 3 |      9
 4 |     16
 5 |     25
```

**Explanation:** The recursive CTE starts with `n = 1`, then repeatedly adds 1 until `n = 5`. The outer query computes the square of each number.

---

## Key Takeaways

| Topic | What to Remember |
|---|---|
| Correlated subqueries | Execute per row — can be slow; try rewriting as JOIN |
| CTEs | Improve readability; PostgreSQL 12+ inlines them by default |
| Window functions | PARTITION BY + ORDER BY; know RANK vs DENSE_RANK vs ROW_NUMBER |
| Indexes | B-tree by default; composite index order matters; FKs need manual indexing |
| Optimization | EXPLAIN ANALYZE first; index filter columns; avoid functions on indexed cols |
| Normalization | 3NF eliminates anomalies; denormalize intentionally for read performance |
| ACID | Atomicity (all-or-nothing), Consistency (valid states), Isolation (no interference), Durability (committed = permanent) |
| Fan-out bug | JOINing two one-to-many relationships causes row explosion |

---

**Previous:** [← Part 1 — SQL Fundamentals](./01-sql-fundamentals.md)
**Next:** [Part 3 — Advanced SQL & Database Internals →](./03-advanced-sql.md)
