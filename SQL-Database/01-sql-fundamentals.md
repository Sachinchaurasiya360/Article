# Part 1: SQL Fundamentals - Beginner Level

> Master the building blocks of SQL and relational databases. Every database interview starts here.

---

## Table of Contents

- [1.1 What is a Database?](#11-what-is-a-database)
- [1.2 Relational Databases (RDBMS)](#12-relational-databases-rdbms)
- [1.3 Basic SQL Queries - SELECT](#13-basic-sql-queries--select)
- [1.4 INSERT, UPDATE, DELETE](#14-insert-update-delete)
- [1.5 Filtering with WHERE](#15-filtering-with-where)
- [1.6 Sorting with ORDER BY](#16-sorting-with-order-by)
- [1.7 Aggregation with GROUP BY and HAVING](#17-aggregation-with-group-by-and-having)
- [1.8 Joins - INNER, LEFT, RIGHT, FULL](#18-joins--inner-left-right-full)
- [1.9 Constraints - PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL](#19-constraints--primary-key-foreign-key-unique-check-not-null)
- [1.10 SQL Query Problems & Practice](#110-sql-query-problems--practice)

---

## Sample Schema Used Throughout

```sql
-- We will reference these tables in all examples

CREATE TABLE departments (
    dept_id   SERIAL PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE employees (
    emp_id      SERIAL PRIMARY KEY,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    salary      NUMERIC(10, 2),
    hire_date   DATE DEFAULT CURRENT_DATE,
    dept_id     INT REFERENCES departments(dept_id),
    manager_id  INT REFERENCES employees(emp_id)
);

CREATE TABLE projects (
    project_id   SERIAL PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    budget       NUMERIC(12, 2),
    start_date   DATE,
    end_date     DATE
);

CREATE TABLE employee_projects (
    emp_id     INT REFERENCES employees(emp_id),
    project_id INT REFERENCES projects(project_id),
    role       VARCHAR(50),
    PRIMARY KEY (emp_id, project_id)
);
```

---

## 1.1 What is a Database?

### Question: What is a database, and why do we need one?

**Answer:**

A database is an **organized collection of structured data** stored electronically, designed for efficient retrieval, manipulation, and management. Unlike flat files (CSV, text files), databases provide:

| Feature | Flat File | Database |
|---|---|---|
| Concurrent access | No (file locks) | Yes (MVCC, locking) |
| Data integrity | Manual validation | Enforced via constraints |
| Query capability | Custom parsing code | SQL - declarative language |
| Scalability | Poor (load entire file) | Excellent (indexed access) |
| ACID compliance | No | Yes (in RDBMS) |

**Key types of databases:**

- **Relational (RDBMS):** PostgreSQL, MySQL, Oracle, SQL Server - data in tables with relationships
- **Document:** MongoDB, CouchDB - JSON-like flexible documents
- **Key-Value:** Redis, DynamoDB - simple key → value lookup
- **Column-Family:** Cassandra, HBase - optimized for write-heavy, wide-column data
- **Graph:** Neo4j, Amazon Neptune - relationships are first-class citizens

> **Why the interviewer asks this:** They want to verify you understand *why* databases exist - not just how to use them. Engineers who understand the "why" make better architectural decisions.

**Follow-up:** *When would you choose a flat file over a database?*

---

## 1.2 Relational Databases (RDBMS)

### Question: What is a relational database and how does it organize data?

**Answer:**

A relational database organizes data into **tables** (also called relations). Each table consists of:

- **Rows (tuples):** Individual records
- **Columns (attributes):** Fields defining the data structure
- **Schema:** The blueprint defining table structure, types, and constraints

The "relational" in RDBMS comes from **relational algebra** (Edgar Codd, 1970), not from "relationships between tables" as commonly misconceived.

**Core principles:**

1. **Data is stored in tables** with a fixed schema
2. **Each row is unique**, identified by a primary key
3. **Tables relate to each other** via foreign keys
4. **Data integrity** is enforced through constraints
5. **SQL** is the standard interface for querying

```sql
-- Example: Viewing the structure of our employees table
-- In PostgreSQL:
\d employees

-- The output shows columns, types, constraints, and indexes
```

**How tables relate to each other:**

```
departments (1) ──────── (Many) employees
                                    │
                                    │ (Many)
                                    │
                          employee_projects
                                    │
                                    │ (Many)
                                    │
projects (1) ─────────── (Many) employee_projects
```

**Popular RDBMS comparison:**

| Feature | PostgreSQL | MySQL | SQL Server | Oracle |
|---|---|---|---|---|
| Open Source | Yes | Yes (GPL) | No | No |
| JSON Support | Excellent (JSONB) | Basic | Basic | Basic |
| Full-text Search | Built-in | Built-in | Built-in | Oracle Text |
| MVCC | Yes | InnoDB only | Yes | Yes |
| Partitioning | Declarative | Hash/Range/List | Yes | Yes |

> **Why the interviewer asks this:** Understanding the relational model shows you can design normalized schemas and reason about data integrity - critical for any backend role.

**Follow-up:** *What is the difference between a schema and a database?*

---

## 1.3 Basic SQL Queries - SELECT

### Question: Explain the SELECT statement and its execution order.

**Answer:**

`SELECT` retrieves data from one or more tables. The critical insight is that **SQL's written order differs from its execution order:**

**Written order:**
```sql
SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
```

**Actual execution order:**
```sql
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

This matters because you **cannot use a column alias** defined in `SELECT` inside the `WHERE` clause (it hasn't been evaluated yet).

```sql
-- ❌ WRONG: alias not available in WHERE
SELECT salary * 12 AS annual_salary
FROM employees
WHERE annual_salary > 100000;

-- ✅ CORRECT: repeat the expression
SELECT salary * 12 AS annual_salary
FROM employees
WHERE salary * 12 > 100000;

-- ✅ ALSO CORRECT: use a subquery or CTE
SELECT * FROM (
    SELECT emp_id, first_name, salary * 12 AS annual_salary
    FROM employees
) sub
WHERE annual_salary > 100000;
```

**Essential SELECT variations:**

```sql
-- Select all columns
SELECT * FROM employees;

-- Select specific columns
SELECT first_name, last_name, salary FROM employees;

-- Select with expression
SELECT first_name, salary, salary * 0.10 AS bonus FROM employees;

-- Select distinct values (removes duplicates)
SELECT DISTINCT dept_id FROM employees;

-- Select with limit (pagination)
SELECT * FROM employees ORDER BY emp_id LIMIT 10 OFFSET 20;

-- Count rows
SELECT COUNT(*) FROM employees;
```

> **Why the interviewer asks this:** The execution order question separates candidates who memorized syntax from those who truly understand how SQL processes queries internally.

**Follow-up:** *What is the difference between `COUNT(*)`, `COUNT(column)`, and `COUNT(DISTINCT column)`?*

---

### Question: What is the difference between COUNT(*), COUNT(column), and COUNT(DISTINCT column)?

**Answer:**

```sql
-- Setup: employees table has some NULL emails
-- emp_id | first_name | email          | dept_id
-- 1      | Alice      | alice@test.com | 1
-- 2      | Bob        | NULL           | 1
-- 3      | Carol      | carol@test.com | 2
-- 4      | Dave       | carol@test.com | 2   ← duplicate email
-- 5      | Eve        | NULL           | NULL

SELECT
    COUNT(*)              AS total_rows,       -- 5 (counts ALL rows including NULLs)
    COUNT(email)          AS non_null_emails,  -- 3 (skips NULL emails)
    COUNT(DISTINCT email) AS unique_emails,    -- 2 (unique non-null emails)
    COUNT(dept_id)        AS non_null_depts,   -- 4 (skips NULL dept_id)
    COUNT(DISTINCT dept_id) AS unique_depts    -- 2 (unique non-null dept_ids)
FROM employees;
```

| Function | Counts NULLs? | Counts Duplicates? |
|---|---|---|
| `COUNT(*)` | Yes | Yes |
| `COUNT(column)` | No | Yes |
| `COUNT(DISTINCT column)` | No | No |

**Performance consideration:** `COUNT(*)` is generally faster than `COUNT(column)` because the engine doesn't need to check for NULLs. In PostgreSQL, `COUNT(*)` on large tables can still be slow due to MVCC - consider using `pg_class.reltuples` for approximate counts.

> **Why the interviewer asks this:** NULL handling is a constant source of bugs. This question tests whether you understand SQL's three-valued logic (TRUE, FALSE, UNKNOWN).

**Follow-up:** *What does `COUNT(1)` do, and is it different from `COUNT(*)`?*

---

## 1.4 INSERT, UPDATE, DELETE

### Question: Explain INSERT, UPDATE, and DELETE with practical examples. What should you watch out for?

**Answer:**

#### INSERT

```sql
-- Single row insert
INSERT INTO departments (dept_name)
VALUES ('Engineering');

-- Multi-row insert (more efficient than multiple single inserts)
INSERT INTO departments (dept_name)
VALUES ('Engineering'), ('Marketing'), ('Sales'), ('HR');

-- Insert from a SELECT (copy data)
INSERT INTO archived_employees (emp_id, first_name, last_name)
SELECT emp_id, first_name, last_name
FROM employees
WHERE hire_date < '2020-01-01';

-- Insert with conflict handling (UPSERT) - PostgreSQL specific
INSERT INTO employees (email, first_name, last_name, salary)
VALUES ('alice@test.com', 'Alice', 'Smith', 95000)
ON CONFLICT (email)
DO UPDATE SET salary = EXCLUDED.salary;
-- If email exists, update salary; otherwise insert new row
```

#### UPDATE

```sql
-- Update specific rows
UPDATE employees
SET salary = salary * 1.10
WHERE dept_id = 1;

-- ⚠️ DANGER: Update without WHERE affects ALL rows
UPDATE employees SET salary = 0;  -- Every employee now has $0 salary!

-- Update with a join (PostgreSQL syntax)
UPDATE employees e
SET salary = salary * 1.15
FROM departments d
WHERE e.dept_id = d.dept_id
  AND d.dept_name = 'Engineering';

-- Update with RETURNING (get modified rows back)
UPDATE employees
SET salary = salary * 1.10
WHERE dept_id = 1
RETURNING emp_id, first_name, salary;
```

#### DELETE

```sql
-- Delete specific rows
DELETE FROM employees
WHERE emp_id = 42;

-- ⚠️ DANGER: Delete without WHERE removes ALL rows
DELETE FROM employees;  -- Table is now empty!

-- Delete with a subquery
DELETE FROM employees
WHERE dept_id IN (
    SELECT dept_id FROM departments WHERE dept_name = 'Obsolete'
);

-- TRUNCATE vs DELETE
TRUNCATE TABLE employees;  -- Faster, resets sequences, cannot be rolled back easily
DELETE FROM employees;     -- Row-by-row, logged, can be rolled back in a transaction
```

**Key differences between DELETE and TRUNCATE:**

| Feature | DELETE | TRUNCATE |
|---|---|---|
| WHERE clause | Yes | No |
| Trigger firing | Yes (per row) | No |
| Transaction safe | Yes | Depends on RDBMS |
| Speed | Slower (row-by-row) | Much faster |
| Resets auto-increment | No | Yes |
| Disk space reclaim | Not immediate | Immediate |

> **Why the interviewer asks this:** They're checking if you know the dangers of unqualified UPDATE/DELETE and whether you understand UPSERT patterns for real-world data pipelines.

**Follow-up:** *What is the RETURNING clause in PostgreSQL and when would you use it?*

---

## 1.5 Filtering with WHERE

### Question: Explain the WHERE clause, its operators, and common pitfalls.

**Answer:**

`WHERE` filters rows **before** grouping (unlike `HAVING`, which filters after). It supports a rich set of operators:

```sql
-- Comparison operators
SELECT * FROM employees WHERE salary > 80000;
SELECT * FROM employees WHERE salary >= 80000 AND salary <= 120000;

-- BETWEEN (inclusive on both ends)
SELECT * FROM employees WHERE salary BETWEEN 80000 AND 120000;

-- IN - matches any value in a list
SELECT * FROM employees WHERE dept_id IN (1, 2, 3);

-- LIKE - pattern matching (% = any chars, _ = single char)
SELECT * FROM employees WHERE email LIKE '%@gmail.com';
SELECT * FROM employees WHERE first_name LIKE 'J___'; -- J followed by exactly 3 chars

-- ILIKE - case-insensitive LIKE (PostgreSQL specific)
SELECT * FROM employees WHERE first_name ILIKE 'alice';

-- IS NULL / IS NOT NULL
SELECT * FROM employees WHERE manager_id IS NULL;

-- ⚠️ WRONG: = NULL does NOT work!
SELECT * FROM employees WHERE manager_id = NULL;  -- Returns NOTHING (always UNKNOWN)
```

**The NULL trap - SQL's three-valued logic:**

```sql
-- NULL is not a value; it means "unknown"
-- Any comparison with NULL yields UNKNOWN, not TRUE or FALSE

SELECT NULL = NULL;      -- NULL (not TRUE!)
SELECT NULL <> NULL;     -- NULL (not TRUE!)
SELECT NULL > 5;         -- NULL
SELECT NOT (NULL > 5);   -- NULL

-- This means NOT IN with NULLs can produce unexpected results:
-- Suppose dept_ids in subquery: (1, 2, NULL)

SELECT * FROM employees WHERE dept_id NOT IN (1, 2, NULL);
-- Returns ZERO rows! Because dept_id <> NULL is UNKNOWN
-- UNKNOWN AND TRUE AND TRUE = UNKNOWN → row excluded

-- Fix: filter out NULLs
SELECT * FROM employees
WHERE dept_id NOT IN (
    SELECT dept_id FROM departments WHERE dept_id IS NOT NULL
);

-- Or better: use NOT EXISTS
SELECT * FROM employees e
WHERE NOT EXISTS (
    SELECT 1 FROM departments d WHERE d.dept_id = e.dept_id
);
```

> **Why the interviewer asks this:** The NULL pitfall in `NOT IN` is one of the most common production bugs. Interviewers test this because it reveals depth of understanding.

**Follow-up:** *What is the difference between WHERE and HAVING?*

---

## 1.6 Sorting with ORDER BY

### Question: How does ORDER BY work, and what are NULLS FIRST / NULLS LAST?

**Answer:**

```sql
-- Basic sorting
SELECT * FROM employees ORDER BY salary DESC;

-- Multi-column sort (sort by dept first, then salary within each dept)
SELECT * FROM employees ORDER BY dept_id ASC, salary DESC;

-- Sort by column position (not recommended for readability)
SELECT first_name, last_name, salary FROM employees ORDER BY 3 DESC;

-- Sort by expression
SELECT first_name, salary FROM employees ORDER BY salary * 12 DESC;

-- Sort by alias (works because ORDER BY executes AFTER SELECT)
SELECT first_name, salary * 12 AS annual FROM employees ORDER BY annual DESC;
```

**NULL ordering:**

```sql
-- By default in PostgreSQL: NULLs are LAST in ASC, FIRST in DESC
-- You can control this explicitly:

SELECT * FROM employees ORDER BY manager_id ASC NULLS FIRST;
SELECT * FROM employees ORDER BY manager_id DESC NULLS LAST;
```

**Performance consideration:**

```sql
-- ORDER BY without an index requires a "sort" operation
-- which means PostgreSQL must load all matching rows into memory (or disk if large)
-- then sort them before returning

-- If you frequently sort by salary:
CREATE INDEX idx_employees_salary ON employees (salary);

-- Now ORDER BY salary can use an index scan (already sorted)
-- This matters enormously for large tables with LIMIT:

SELECT * FROM employees ORDER BY salary DESC LIMIT 10;
-- With index: instant (reads 10 entries from index)
-- Without index: must sort ALL rows, then take top 10
```

> **Why the interviewer asks this:** They want to see if you understand the performance implications of sorting and how indexes can eliminate sort operations.

**Follow-up:** *Can you use ORDER BY in a subquery? When would you need to?*

---

## 1.7 Aggregation with GROUP BY and HAVING

### Question: Explain GROUP BY, HAVING, and the rules around aggregation.

**Answer:**

`GROUP BY` collapses rows with the same values into summary rows. **Every column in SELECT must either be in GROUP BY or wrapped in an aggregate function.**

```sql
-- Count employees per department
SELECT dept_id, COUNT(*) AS employee_count
FROM employees
GROUP BY dept_id;

-- Average salary per department
SELECT
    d.dept_name,
    COUNT(e.emp_id) AS headcount,
    ROUND(AVG(e.salary), 2) AS avg_salary,
    MAX(e.salary) AS max_salary,
    MIN(e.salary) AS min_salary
FROM employees e
JOIN departments d ON e.dept_id = d.dept_id
GROUP BY d.dept_name
ORDER BY avg_salary DESC;
```

**HAVING - filter groups (not rows):**

```sql
-- Departments with more than 5 employees
SELECT dept_id, COUNT(*) AS headcount
FROM employees
GROUP BY dept_id
HAVING COUNT(*) > 5;

-- ⚠️ Common mistake: using WHERE instead of HAVING for aggregates
-- WHERE filters BEFORE grouping (row-level)
-- HAVING filters AFTER grouping (group-level)

-- Find departments where avg salary > 80000, but only counting active employees
SELECT dept_id, AVG(salary) AS avg_sal
FROM employees
WHERE hire_date > '2020-01-01'   -- WHERE: filters rows first
GROUP BY dept_id
HAVING AVG(salary) > 80000;      -- HAVING: filters groups after
```

**Execution order visualization:**

```
FROM employees                           -- start with all rows
  → WHERE hire_date > '2020-01-01'       -- filter rows
  → GROUP BY dept_id                     -- collapse into groups
  → HAVING AVG(salary) > 80000          -- filter groups
  → SELECT dept_id, AVG(salary)          -- compute output
  → ORDER BY avg_sal DESC               -- sort results
```

**Output-based question:**

```sql
-- Given data:
-- emp_id | dept_id | salary
-- 1      | 1       | 60000
-- 2      | 1       | 80000
-- 3      | 2       | 90000
-- 4      | 2       | 70000
-- 5      | NULL    | 50000

SELECT dept_id, SUM(salary)
FROM employees
GROUP BY dept_id;

-- Output:
-- dept_id | sum
-- 1       | 140000
-- 2       | 160000
-- NULL    | 50000    ← NULL is treated as its own group!
```

> **Why the interviewer asks this:** GROUP BY errors are extremely common in interviews. The rule about "every non-aggregated column must be in GROUP BY" catches many candidates.

**Follow-up:** *What happens if you SELECT a column that is NOT in GROUP BY and NOT aggregated? Does every database handle this the same way?*

---

## 1.8 Joins - INNER, LEFT, RIGHT, FULL

### Question: Explain all types of SQL joins with examples and Venn diagrams.

**Answer:**

Joins combine rows from two or more tables based on a related column. Here's the complete picture:

```
     INNER JOIN              LEFT JOIN              RIGHT JOIN            FULL OUTER JOIN
    ┌─────────┐           ┌─────────┐           ┌─────────┐           ┌─────────┐
    │  ┌───┐  │           │██┌───┐  │           │  ┌───┐██│           │██┌───┐██│
    │  │███│  │           │██│███│  │           │  │███│██│           │██│███│██│
    │  └───┘  │           │██└───┘  │           │  └───┘██│           │██└───┘██│
    └─────────┘           └─────────┘           └─────────┘           └─────────┘
    Only matching         All left +             All right +           All from both
    rows                  matching right         matching left         tables
```

**Setup data:**

```sql
-- departments:                    employees:
-- dept_id | dept_name             emp_id | first_name | dept_id
-- 1       | Engineering           1      | Alice      | 1
-- 2       | Marketing             2      | Bob        | 1
-- 3       | Sales (no employees)  3      | Carol      | 2
--                                 4      | Dave       | NULL (no dept)
```

#### INNER JOIN - Only matching rows from both tables

```sql
SELECT e.first_name, d.dept_name
FROM employees e
INNER JOIN departments d ON e.dept_id = d.dept_id;

-- Result:
-- first_name | dept_name
-- Alice      | Engineering
-- Bob        | Engineering
-- Carol      | Marketing
-- (Dave excluded - no matching dept; Sales excluded - no employees)
```

#### LEFT JOIN (LEFT OUTER JOIN) - All rows from left table + matches from right

```sql
SELECT e.first_name, d.dept_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.dept_id;

-- Result:
-- first_name | dept_name
-- Alice      | Engineering
-- Bob        | Engineering
-- Carol      | Marketing
-- Dave       | NULL          ← Dave included even though no matching dept
```

#### RIGHT JOIN (RIGHT OUTER JOIN) - All rows from right table + matches from left

```sql
SELECT e.first_name, d.dept_name
FROM employees e
RIGHT JOIN departments d ON e.dept_id = d.dept_id;

-- Result:
-- first_name | dept_name
-- Alice      | Engineering
-- Bob        | Engineering
-- Carol      | Marketing
-- NULL       | Sales         ← Sales included even though no employees
```

#### FULL OUTER JOIN - All rows from both tables

```sql
SELECT e.first_name, d.dept_name
FROM employees e
FULL OUTER JOIN departments d ON e.dept_id = d.dept_id;

-- Result:
-- first_name | dept_name
-- Alice      | Engineering
-- Bob        | Engineering
-- Carol      | Marketing
-- Dave       | NULL          ← from left (no matching dept)
-- NULL       | Sales         ← from right (no matching employees)
```

#### CROSS JOIN - Cartesian product (every combination)

```sql
SELECT e.first_name, d.dept_name
FROM employees e
CROSS JOIN departments d;

-- Returns 4 × 3 = 12 rows (every employee × every department)
-- Rarely useful, but important for generating combinations
```

#### SELF JOIN - Joining a table to itself

```sql
-- Find each employee's manager name
SELECT
    e.first_name AS employee,
    m.first_name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.emp_id;

-- Result:
-- employee | manager
-- Alice    | NULL     (Alice has no manager - she's the CEO)
-- Bob      | Alice
-- Carol    | Alice
-- Dave     | Bob
```

**Common join pitfall - duplicating rows:**

```sql
-- If join keys are not unique, you get a Cartesian product per group
-- Table A: (1, 'x'), (1, 'y')
-- Table B: (1, 'a'), (1, 'b')

SELECT * FROM A JOIN B ON A.id = B.id;
-- Returns 4 rows: (1,x,1,a), (1,x,1,b), (1,y,1,a), (1,y,1,b)
-- This is a common source of "why did my row count explode?"
```

**Performance insight:**

```sql
-- JOIN performance depends on:
-- 1. Are join columns indexed? (critical)
-- 2. Table sizes - smaller table should ideally be on the probe side
-- 3. Join algorithm chosen by optimizer:
--    - Nested Loop: good for small tables or indexed joins
--    - Hash Join: good for large unsorted tables
--    - Merge Join: good when both sides are sorted/indexed
```

> **Why the interviewer asks this:** Joins are the bread and butter of SQL. The interviewer checks if you understand when NULLs appear, how row counts change, and whether you can pick the right join type for a given requirement.

**Follow-up:** *What is the difference between `ON` and `WHERE` in a LEFT JOIN? Can placing a filter in the wrong clause change results?*

---

### Question: What is the difference between ON and WHERE in a LEFT JOIN?

**Answer:**

This is a critical distinction that even experienced developers get wrong:

```sql
-- Scenario: Find all employees and their projects, but only show projects from 2024

-- ❌ WRONG (filters AFTER the join - removes employees without 2024 projects)
SELECT e.first_name, p.project_name
FROM employees e
LEFT JOIN projects p ON e.emp_id = p.emp_id
WHERE p.start_date >= '2024-01-01';
-- This converts the LEFT JOIN into an INNER JOIN for the date filter!
-- Employees without 2024 projects are removed because p.start_date is NULL

-- ✅ CORRECT (filters DURING the join - preserves all employees)
SELECT e.first_name, p.project_name
FROM employees e
LEFT JOIN employee_projects ep ON e.emp_id = ep.emp_id
LEFT JOIN projects p ON ep.project_id = p.project_id
    AND p.start_date >= '2024-01-01';
-- Employees without 2024 projects show up with NULL project_name
```

**Rule of thumb:** In a LEFT JOIN, put the filter condition for the **right table** in the `ON` clause if you want to preserve all left-table rows.

> **Why the interviewer asks this:** This is one of the most common bugs in production SQL. It shows deep understanding of join mechanics.

**Follow-up:** *How would you find employees who are NOT assigned to any project?*

---

## 1.9 Constraints - PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, NOT NULL

### Question: Explain all SQL constraints and why they matter.

**Answer:**

Constraints enforce **data integrity** at the database level. They're your last line of defense against bad data - even if the application has a bug, constraints prevent invalid data from being stored.

#### PRIMARY KEY

```sql
-- Uniquely identifies each row. Implies NOT NULL + UNIQUE.
-- Each table should have exactly one primary key.

CREATE TABLE employees (
    emp_id SERIAL PRIMARY KEY,  -- auto-incrementing integer
    ...
);

-- Composite primary key (for junction/bridge tables)
CREATE TABLE employee_projects (
    emp_id     INT REFERENCES employees(emp_id),
    project_id INT REFERENCES projects(project_id),
    PRIMARY KEY (emp_id, project_id)  -- combination must be unique
);
```

#### FOREIGN KEY

```sql
-- Ensures referential integrity: the value MUST exist in the referenced table

CREATE TABLE employees (
    ...
    dept_id INT REFERENCES departments(dept_id)
        ON DELETE SET NULL      -- if department deleted, set to NULL
        ON UPDATE CASCADE       -- if dept_id changes, update here too
);

-- Foreign key actions:
-- ON DELETE CASCADE:    delete employee if department is deleted
-- ON DELETE SET NULL:   set dept_id to NULL if department deleted
-- ON DELETE RESTRICT:   prevent deletion of department if employees exist (DEFAULT)
-- ON DELETE SET DEFAULT: set to column's default value
```

**Debugging scenario:**

```sql
-- You try to insert an employee with dept_id = 99, but dept 99 doesn't exist:
INSERT INTO employees (first_name, last_name, dept_id) VALUES ('Test', 'User', 99);
-- ERROR: insert or update on table "employees" violates foreign key constraint
-- DETAIL: Key (dept_id)=(99) is not present in table "departments".
```

#### UNIQUE

```sql
-- Ensures no duplicate values (but allows multiple NULLs in PostgreSQL)
CREATE TABLE employees (
    email VARCHAR(100) UNIQUE  -- no two employees can have the same email
);

-- Multiple NULLs are allowed because NULL ≠ NULL
INSERT INTO employees (first_name, email) VALUES ('A', NULL);  -- OK
INSERT INTO employees (first_name, email) VALUES ('B', NULL);  -- OK in PostgreSQL
```

#### CHECK

```sql
-- Validates data against a condition
CREATE TABLE employees (
    salary NUMERIC(10, 2) CHECK (salary >= 0),
    hire_date DATE CHECK (hire_date <= CURRENT_DATE),
    age INT CHECK (age BETWEEN 18 AND 120)
);

-- Named constraint (better for error messages)
ALTER TABLE employees
ADD CONSTRAINT chk_positive_salary CHECK (salary >= 0);
```

#### NOT NULL

```sql
-- Column must always have a value
CREATE TABLE employees (
    first_name VARCHAR(50) NOT NULL,  -- cannot be NULL
    email VARCHAR(100)                -- can be NULL (default)
);
```

**Real-world constraint design:**

```sql
-- A well-designed orders table with comprehensive constraints
CREATE TABLE orders (
    order_id    SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(customer_id),
    order_date  TIMESTAMP NOT NULL DEFAULT NOW(),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total       NUMERIC(12, 2) NOT NULL CHECK (total >= 0),

    -- Ensure delivered orders have a delivery date
    delivery_date TIMESTAMP,
    CONSTRAINT chk_delivery CHECK (
        (status = 'delivered' AND delivery_date IS NOT NULL) OR
        (status <> 'delivered')
    )
);
```

> **Why the interviewer asks this:** Constraints show whether you design defensively. Engineers who rely solely on application-level validation create systems that are vulnerable to data corruption when bugs inevitably happen.

**Follow-up:** *What is the performance impact of foreign key constraints? Should you always use them?*

---

## 1.10 SQL Query Problems & Practice

### Problem 1: Second Highest Salary

```sql
-- Question: Find the second highest salary from the employees table.
-- Handle the case where multiple employees might share the highest salary.

-- Solution 1: Using DISTINCT + OFFSET
SELECT DISTINCT salary
FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 1;

-- Solution 2: Using subquery
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- Solution 3: Using DENSE_RANK (most robust - handles ties properly)
SELECT salary
FROM (
    SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
    FROM employees
) ranked
WHERE rnk = 2;
```

**Step-by-step explanation (Solution 2):**
1. Inner query `SELECT MAX(salary) FROM employees` finds the highest salary (e.g., 150000)
2. Outer query finds the `MAX(salary)` where salary < 150000
3. This gives the second highest distinct salary

---

### Problem 2: Find Duplicate Emails

```sql
-- Question: Find all duplicate email addresses in the employees table.

SELECT email, COUNT(*) AS occurrence_count
FROM employees
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;
```

---

### Problem 3: Employees Who Earn More Than Their Manager

```sql
-- Question: List employees who earn more than their direct manager.

SELECT
    e.first_name AS employee,
    e.salary AS employee_salary,
    m.first_name AS manager,
    m.salary AS manager_salary
FROM employees e
INNER JOIN employees m ON e.manager_id = m.emp_id
WHERE e.salary > m.salary;
```

**Step-by-step:**
1. Self-join: `employees e` is the employee, `employees m` is the manager
2. Join condition: `e.manager_id = m.emp_id` links employee to their manager
3. WHERE: filters to only those earning more than their manager

---

### Problem 4: Department with No Employees

```sql
-- Question: Find departments that have no employees.

-- Solution 1: LEFT JOIN + NULL check
SELECT d.dept_name
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
WHERE e.emp_id IS NULL;

-- Solution 2: NOT EXISTS (often more performant)
SELECT d.dept_name
FROM departments d
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id
);

-- Solution 3: NOT IN (beware of NULLs!)
SELECT dept_name
FROM departments
WHERE dept_id NOT IN (
    SELECT dept_id FROM employees WHERE dept_id IS NOT NULL
);
```

---

### Problem 5: Output-Based Question

```sql
-- What does this query return?
SELECT dept_id, COUNT(*)
FROM employees
WHERE salary > 50000
GROUP BY dept_id
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC;
```

**Answer - execution trace:**

1. `FROM employees` - start with all employee rows
2. `WHERE salary > 50000` - remove employees earning ≤ 50000
3. `GROUP BY dept_id` - group remaining rows by department
4. `HAVING COUNT(*) >= 2` - keep only groups with 2+ employees (after the salary filter)
5. `SELECT dept_id, COUNT(*)` - output department ID and count
6. `ORDER BY COUNT(*) DESC` - sort by count descending

**Result:** Departments that have **at least 2 employees earning more than $50,000**, ordered by how many such employees they have.

---

### Problem 6: Debugging Query

```sql
-- This query is supposed to find the average salary per department,
-- including departments with no employees (showing 0). What's wrong?

SELECT d.dept_name, AVG(e.salary) AS avg_salary
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_name;

-- Issue: Departments with no employees show NULL, not 0.
-- AVG of no rows returns NULL, not 0.

-- Fix:
SELECT d.dept_name, COALESCE(AVG(e.salary), 0) AS avg_salary
FROM departments d
LEFT JOIN employees e ON d.dept_id = e.dept_id
GROUP BY d.dept_name;

-- COALESCE returns the first non-NULL argument
-- So if AVG is NULL (no employees), it returns 0
```

---

### Problem 7: Consecutive Days Login

```sql
-- Question: Find users who logged in for at least 3 consecutive days.

-- Given: logins(user_id INT, login_date DATE)

WITH login_groups AS (
    SELECT
        user_id,
        login_date,
        login_date - ROW_NUMBER() OVER (
            PARTITION BY user_id ORDER BY login_date
        )::INT AS grp
    FROM (SELECT DISTINCT user_id, login_date FROM logins) t
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end,
       COUNT(*) AS consecutive_days
FROM login_groups
GROUP BY user_id, grp
HAVING COUNT(*) >= 3
ORDER BY user_id, streak_start;
```

**Step-by-step:**
1. Remove duplicate logins per day with `DISTINCT`
2. Assign a row number per user, ordered by date
3. Subtract row number from date - consecutive dates produce the same group value
4. Group by user + group identifier and count
5. Filter for groups with 3+ consecutive days

---

## Key Takeaways

| Topic | What to Remember |
|---|---|
| SELECT execution order | FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT |
| NULL comparisons | Always use `IS NULL` / `IS NOT NULL`, never `= NULL` |
| NOT IN with NULLs | Can return zero rows unexpectedly - prefer `NOT EXISTS` |
| LEFT JOIN + WHERE | Putting right-table filters in WHERE converts to INNER JOIN |
| GROUP BY rule | Every non-aggregated column in SELECT must be in GROUP BY |
| COUNT variations | `COUNT(*)` counts all rows; `COUNT(col)` skips NULLs |
| Constraints | Design them as your last line of defense against bad data |

---

**Next:** [Part 2 - Intermediate SQL & Query Optimization →](./02-intermediate-sql.md)
