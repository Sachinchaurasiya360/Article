# Intermediate Python — Interview Preparation (Part 2/7)

> **Series**: Python + FastAPI Interview Prep
> **Level**: Intermediate
> **Prerequisites**: [Part 1 — Python Fundamentals](./01-python-fundamentals.md)
> **Next**: [Part 3 — Advanced Python](./03-advanced-python.md)

---

## Table of Contents

| # | Section | Questions |
|---|---------|-----------|
| 1 | [List / Dict / Set Comprehensions](#section-1-list--dict--set-comprehensions) | Q1 – Q6 |
| 2 | [Exception Handling](#section-2-exception-handling) | Q7 – Q12 |
| 3 | [File Handling & Context Managers](#section-3-file-handling--context-managers) | Q13 – Q18 |
| 4 | [Modules & Packages](#section-4-modules--packages) | Q19 – Q24 |
| 5 | [Virtual Environments](#section-5-virtual-environments) | Q25 – Q28 |
| 6 | [Introduction to Decorators](#section-6-introduction-to-decorators) | Q29 – Q34 |

---

## Section 1: List / Dict / Set Comprehensions

### Q1: What are comprehensions in Python, and why are they preferred over traditional loops?

**Answer:**

Comprehensions are concise, declarative constructs for creating new collections (lists, dicts, sets, and generators) from iterables. They replace multi-line loop-and-append patterns with a single readable expression.

```python
# Traditional approach
squares = []
for n in range(10):
    squares.append(n ** 2)

# List comprehension — same result
squares = [n ** 2 for n in range(10)]
```

**Why they are preferred:**

| Aspect | Comprehension | Traditional Loop |
|--------|--------------|-----------------|
| Readability | Intent is immediately clear | Requires reading the full loop body |
| Performance | ~10-30 % faster (bytecode is optimized, avoids repeated `.append` lookups) | Slight overhead from attribute lookups |
| Scope (Python 3) | Loop variable is scoped to the comprehension | Loop variable leaks into enclosing scope |
| Debugging | Harder to set breakpoints inside | Easier to add print/debug statements |

**Trade-offs and edge cases:**

- Comprehensions that span more than ~80 characters or contain nested logic should be refactored into a loop for clarity.
- Memory: a list comprehension builds the entire list in memory. For large datasets, prefer a **generator expression** `(x for x in iterable)`.
- Side-effect-only operations (e.g., calling `print`) should **never** use comprehensions; use a loop instead.

> **Why the interviewer asks this:** They want to verify you understand *when* to use comprehensions and *when not to* — not just the syntax.

> **Follow-up:** *"What is the difference between a list comprehension and a generator expression in terms of memory usage?"*

---

### Q2: Rewrite the following nested loop as a single dict comprehension.

**Problem:**

```python
result = {}
for key in ["name", "age", "role"]:
    for val in [("Alice", 30, "Engineer"), ("Bob", 25, "Designer")]:
        result[val[0]] = dict(zip(["name", "age", "role"], val))
```

**Answer:**

```python
people = [("Alice", 30, "Engineer"), ("Bob", 25, "Designer")]
fields = ["name", "age", "role"]

result = {
    person[0]: {field: value for field, value in zip(fields, person)}
    for person in people
}

# result:
# {
#     'Alice': {'name': 'Alice', 'age': 30, 'role': 'Engineer'},
#     'Bob':   {'name': 'Bob',   'age': 25, 'role': 'Designer'},
# }
```

**Key points:**

- The outer comprehension iterates over `people` and creates dict keys.
- The inner comprehension zips `fields` with each tuple to build the nested dict.
- This is clean and PEP 8 compliant because each level of nesting is on its own line.

> **Why the interviewer asks this:** Dict comprehensions are common in data-transformation tasks (API response mapping, ORM serialization). They test your fluency with nested iteration.

> **Follow-up:** *"How would you handle the case where some tuples have missing values (e.g., `('Charlie', 40)`)?"*

---

### Q3: What will the following code print? Explain any surprises.

**Problem (Output-Based):**

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [num for row in matrix for num in row if num % 2 == 0]
print(flat)
```

**Answer:**

```
[2, 4, 6, 8]
```

**Explanation:**

The comprehension reads left-to-right as nested loops:

```python
flat = []
for row in matrix:        # outer loop
    for num in row:       # inner loop
        if num % 2 == 0:  # filter
            flat.append(num)
```

A common mistake is to read `for num in row` first, which would be a `NameError` because `row` has not been defined yet.

**Rule of thumb:** In a comprehension with multiple `for` clauses, the **leftmost** `for` is the outermost loop.

> **Why the interviewer asks this:** It tests whether you understand the evaluation order of nested comprehensions — a frequent source of bugs.

> **Follow-up:** *"How would you transpose this matrix using a list comprehension?"*

---

### Q4: Explain set comprehensions and give a practical use case.

**Answer:**

A set comprehension creates a `set` using the same syntax as a list comprehension but with curly braces `{}`:

```python
words = ["hello", "world", "hello", "Python", "python", "HELLO"]

# Unique lowercase words
unique = {word.lower() for word in words}
# {'hello', 'world', 'python'}
```

**Practical use case — finding duplicate emails in a dataset:**

```python
raw_emails = [
    "alice@example.com",
    "Bob@Example.COM",
    "alice@example.com",
    "charlie@test.org",
    "bob@example.com",
]

normalized = [e.strip().lower() for e in raw_emails]
duplicates = {e for e in normalized if normalized.count(e) > 1}
# {'alice@example.com', 'bob@example.com'}
```

**Performance caveat:** `.count()` inside a comprehension is O(n) per element, making the whole operation O(n^2). For production code, use `collections.Counter`:

```python
from collections import Counter

counts = Counter(e.strip().lower() for e in raw_emails)
duplicates = {email for email, cnt in counts.items() if cnt > 1}
```

> **Why the interviewer asks this:** Sets are underused but powerful. Interviewers want to see that you reach for the right data structure.

> **Follow-up:** *"Can you have a tuple comprehension? If not, what do you get with parentheses?"*

---

### Q5 (Debugging): The developer wants a dict mapping each character to its count. The code silently produces wrong results. Find the bug.

**Problem:**

```python
text = "mississippi"
freq = {char: text.count(char) for char in text}
print(freq)
# Expected unique character counts
```

**Answer:**

The code actually **works correctly** in terms of output — it produces:

```python
{'m': 1, 'i': 4, 's': 4, 'p': 2}
```

However, the **bug is performance**, not correctness. `text.count(char)` is called for **every character in the string**, including duplicates. For `"mississippi"` (11 characters), `.count()` is called 11 times (each O(n)), giving O(n^2) time complexity.

**Fix — iterate over unique characters only:**

```python
freq = {char: text.count(char) for char in set(text)}
```

**Better fix — use `Counter`:**

```python
from collections import Counter
freq = dict(Counter(text))
```

This is O(n) because `Counter` makes a single pass over the string.

> **Why the interviewer asks this:** Real-world bugs are often about performance, not crashes. This tests whether you can spot O(n^2) patterns hiding in clean-looking code.

> **Follow-up:** *"If the input were a 10 GB log file read line by line, how would you count character frequencies efficiently?"*

---

### Q6 (Real-World Case Study): You receive a JSON response from an API with nested user data. Transform it using comprehensions.

**Problem:**

```python
api_response = {
    "users": [
        {"id": 1, "name": "Alice",   "roles": ["admin", "user"], "active": True},
        {"id": 2, "name": "Bob",     "roles": ["user"],          "active": False},
        {"id": 3, "name": "Charlie", "roles": ["admin", "user"], "active": True},
        {"id": 4, "name": "Diana",   "roles": ["moderator"],     "active": True},
    ]
}

# Task: Build a dict of {user_id: name} for active admins only.
```

**Answer:**

```python
active_admins = {
    user["id"]: user["name"]
    for user in api_response["users"]
    if user["active"] and "admin" in user["roles"]
}
# {1: 'Alice', 3: 'Charlie'}
```

**Production hardening — handle missing keys gracefully:**

```python
active_admins = {
    user["id"]: user["name"]
    for user in api_response.get("users", [])
    if user.get("active", False) and "admin" in user.get("roles", [])
}
```

Using `.get()` with defaults prevents `KeyError` if the API response is malformed.

> **Why the interviewer asks this:** API data transformation is a daily task. The interviewer checks whether you can write clean, defensive comprehensions.

> **Follow-up:** *"How would you add type hints (e.g., using TypedDict) to validate this API response?"*

---

## Section 2: Exception Handling

### Q7: Explain the full `try / except / else / finally` block. When does each clause execute?

**Answer:**

```python
def divide(a: float, b: float) -> float | None:
    try:
        result = a / b
    except ZeroDivisionError:
        print("Cannot divide by zero")
        return None
    except TypeError as e:
        print(f"Invalid types: {e}")
        return None
    else:
        # Runs ONLY if no exception was raised in `try`
        print(f"Division successful: {result}")
        return result
    finally:
        # Runs ALWAYS — whether an exception occurred or not,
        # even if a return statement was hit above
        print("Cleanup complete")
```

**Execution flow:**

| Scenario | `try` | `except` | `else` | `finally` |
|----------|-------|----------|--------|-----------|
| No exception | Runs fully | Skipped | **Runs** | **Runs** |
| Exception matches an `except` | Runs until error | **Runs** | Skipped | **Runs** |
| Exception does NOT match any `except` | Runs until error | Skipped | Skipped | **Runs**, then exception propagates |

**Critical edge case — `finally` overrides `return`:**

```python
def tricky():
    try:
        return "from try"
    finally:
        return "from finally"  # This wins!

print(tricky())  # "from finally"
```

This is almost always a bug. **Never put `return` in a `finally` block** — it silently swallows exceptions and overrides the intended return value.

**Why `else` exists:**

The `else` clause keeps the `try` block minimal. Code in `else` is only code that should run on success — placing it inside `try` would risk catching exceptions from that code unintentionally.

> **Why the interviewer asks this:** Understanding the full flow — especially `else` and `finally` edge cases — separates intermediate developers from beginners.

> **Follow-up:** *"What happens if both the `except` block and the `finally` block raise exceptions?"*

---

### Q8: How do you create custom exceptions, and when should you use them?

**Answer:**

```python
class AppError(Exception):
    """Base exception for the application."""
    pass


class ValidationError(AppError):
    """Raised when input validation fails."""

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        self.message = message
        super().__init__(f"Validation failed on '{field}': {message}")


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""

    def __init__(self, resource: str, identifier: str | int) -> None:
        self.resource = resource
        self.identifier = identifier
        super().__init__(f"{resource} with id '{identifier}' not found")


# Usage
def get_user(user_id: int) -> dict:
    if user_id < 0:
        raise ValidationError("user_id", "must be a positive integer")
    user = database_lookup(user_id)  # hypothetical
    if user is None:
        raise NotFoundError("User", user_id)
    return user
```

**Best practices:**

1. **Always inherit from `Exception`**, not `BaseException` (which includes `KeyboardInterrupt`, `SystemExit`).
2. **Create a base exception** for your app/library (`AppError`) so callers can catch all your errors with a single `except AppError`.
3. **Store structured data** on the exception (`field`, `resource`, etc.) — this lets error handlers produce useful responses (e.g., HTTP 422 with field-level errors in FastAPI).
4. **Always call `super().__init__()`** with a human-readable message.

**When to use custom exceptions:**

- When built-in exceptions (`ValueError`, `TypeError`) do not convey enough semantic meaning.
- When you need to attach extra context (field name, error code, HTTP status).
- When you want a hierarchy that callers can catch at different granularities.

> **Why the interviewer asks this:** Custom exceptions are fundamental to clean error handling in production applications and frameworks like FastAPI / Django.

> **Follow-up:** *"How would you map these custom exceptions to HTTP status codes in a FastAPI exception handler?"*

---

### Q9 (Output-Based): What does this code print?

**Problem:**

```python
def process():
    try:
        x = int("abc")
    except ValueError:
        print("A")
        raise TypeError("converted error")
    except TypeError:
        print("B")
    finally:
        print("C")

try:
    process()
except TypeError:
    print("D")
except ValueError:
    print("E")
```

**Answer:**

```
A
C
D
```

**Step-by-step:**

1. `int("abc")` raises `ValueError`.
2. The `except ValueError` block runs and prints `"A"`.
3. Inside that block, `raise TypeError("converted error")` is executed.
4. The `except TypeError` in the **same** `try` block does **not** catch it — an exception raised inside an `except` clause is not re-matched against sibling `except` clauses.
5. `finally` runs and prints `"C"`.
6. The `TypeError` propagates to the **outer** `try/except`, which catches it and prints `"D"`.

**Key insight:** `except` clauses in the same `try` block do not chain. A new exception raised inside one `except` block propagates outward.

> **Why the interviewer asks this:** It validates understanding of exception propagation across nested `try` blocks — a common source of subtle bugs.

> **Follow-up:** *"How would you use `raise ... from ...` to chain the original `ValueError` with the new `TypeError`?"*

---

### Q10 (Coding): Write a retry decorator that catches specified exceptions and retries up to N times.

**Answer:**

```python
import time
import functools
from typing import Type


def retry(
    max_attempts: int = 3,
    exceptions: tuple[Type[Exception], ...] = (Exception,),
    delay: float = 1.0,
    backoff: float = 2.0,
) -> callable:
    """
    Retry decorator with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts (including the first call).
        exceptions:   Tuple of exception classes to catch and retry on.
        delay:        Initial delay between retries in seconds.
        backoff:      Multiplier applied to delay after each retry.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_attempts:
                        raise
                    print(
                        f"[Retry] {func.__name__} failed (attempt {attempt}/{max_attempts}): {e}. "
                        f"Retrying in {current_delay:.1f}s..."
                    )
                    time.sleep(current_delay)
                    current_delay *= backoff

            # Should never reach here, but satisfies type checkers
            raise last_exception  # type: ignore[misc]

        return wrapper
    return decorator


# Usage
@retry(max_attempts=3, exceptions=(ConnectionError, TimeoutError), delay=0.5)
def fetch_data(url: str) -> dict:
    """Simulate an unreliable network call."""
    import random
    if random.random() < 0.7:
        raise ConnectionError(f"Failed to connect to {url}")
    return {"status": "ok"}
```

**Design decisions:**

- **Exponential backoff** prevents thundering-herd problems on a recovering server.
- **`functools.wraps`** preserves the decorated function's name and docstring.
- **Re-raises on final attempt** so the caller sees the real exception with the original traceback.
- **Configurable exception tuple** prevents accidentally catching `KeyboardInterrupt` or `SystemExit`.

> **Why the interviewer asks this:** This combines exception handling, decorators, and real-world resilience patterns — all core to backend development.

> **Follow-up:** *"How would you make this decorator async-compatible for use with `httpx` or `aiohttp`?"*

---

### Q11 (Debugging): This code is supposed to log errors and re-raise them, but the traceback is wrong. Why?

**Problem:**

```python
import logging

logger = logging.getLogger(__name__)

def process_data(data):
    try:
        result = transform(data)  # may raise ValueError
    except ValueError:
        logger.error("Transform failed")
        raise ValueError("Data processing error")  # BUG: traceback lost
```

**Answer:**

The problem is that `raise ValueError("Data processing error")` creates a **brand-new exception** and discards the original traceback. When a developer reads the logs or traceback, they lose information about *where* in `transform()` the error actually occurred.

**Fix 1 — Use bare `raise` to preserve the original exception:**

```python
def process_data(data):
    try:
        result = transform(data)
    except ValueError:
        logger.error("Transform failed")
        raise  # re-raises the original ValueError with full traceback
```

**Fix 2 — Use exception chaining with `raise ... from`:**

```python
def process_data(data):
    try:
        result = transform(data)
    except ValueError as original:
        logger.error("Transform failed: %s", original)
        raise RuntimeError("Data processing error") from original
```

This produces a traceback with both the original `ValueError` and the new `RuntimeError`, connected by `"The above exception was the direct cause of the following exception"`.

**Fix 3 — Use `logger.exception()` to capture the traceback in the log:**

```python
def process_data(data):
    try:
        result = transform(data)
    except ValueError:
        logger.exception("Transform failed")  # logs traceback automatically
        raise
```

> **Why the interviewer asks this:** Lost tracebacks are one of the most common debugging headaches in production. This tests whether you know idiomatic error re-raising.

> **Follow-up:** *"What is the difference between `raise X from Y` and `raise X from None`?"*

---

### Q12 (Conceptual): What is the EAFP principle, and how does it differ from LBYL?

**Answer:**

| Principle | Full Name | Style |
|-----------|-----------|-------|
| **EAFP** | Easier to Ask Forgiveness than Permission | Use `try/except` — assume the operation will succeed |
| **LBYL** | Look Before You Leap | Check preconditions with `if` statements before acting |

**Example — accessing a dict key:**

```python
config = {"debug": True}

# LBYL
if "database_url" in config:
    url = config["database_url"]
else:
    url = "sqlite:///default.db"

# EAFP (Pythonic)
try:
    url = config["database_url"]
except KeyError:
    url = "sqlite:///default.db"

# Best in practice — use .get()
url = config.get("database_url", "sqlite:///default.db")
```

**When EAFP is better:**

- **Race conditions:** In concurrent code, checking first and then acting creates a window where the state can change between the check and the action (TOCTOU — time-of-check-to-time-of-use). `try/except` is atomic with respect to the operation.
- **Duck typing:** Python's philosophy is to try the operation and handle failure, rather than checking `isinstance()` beforehand.

**When LBYL is better:**

- When the failure path is **expensive** or has **side effects** (e.g., making an API call you know will fail).
- When the check is cheap and the exception path is slow (exceptions have overhead from traceback construction).

> **Why the interviewer asks this:** It reveals whether you write idiomatic Python or bring habits from other languages (like Java's defensive null-checking).

> **Follow-up:** *"Give an example where EAFP causes a bug due to catching too broad an exception."*

---

## Section 3: File Handling & Context Managers

### Q13: Explain file handling in Python. What are the different modes, and why should you always use `with`?

**Answer:**

```python
# Reading a file — always use a context manager
with open("config.json", "r", encoding="utf-8") as f:
    content = f.read()
```

**Common file modes:**

| Mode | Description | Creates file? | Truncates? |
|------|-------------|---------------|------------|
| `"r"` | Read (text, default) | No — raises `FileNotFoundError` | No |
| `"w"` | Write (text) | Yes | **Yes** — destroys existing content |
| `"a"` | Append (text) | Yes | No |
| `"x"` | Exclusive create | **Only** if file does not exist | N/A |
| `"rb"` / `"wb"` | Read/write binary | Same as `r`/`w` | Same as `r`/`w` |
| `"r+"` | Read and write | No | No |

**Why `with` (context manager) is mandatory:**

```python
# BAD — resource leak if an exception occurs between open() and close()
f = open("data.txt", "r")
data = f.read()
f.close()  # never reached if f.read() raises an exception

# GOOD — guaranteed cleanup
with open("data.txt", "r", encoding="utf-8") as f:
    data = f.read()
# f.close() is called automatically, even if an exception occurs
```

The `with` statement calls `f.__enter__()` on entry and `f.__exit__()` on exit. The `__exit__` method calls `f.close()` regardless of whether an exception was raised.

**Critical best practice — always specify `encoding`:**

```python
# Without encoding, Python uses the platform default (cp1252 on Windows, utf-8 on Linux)
# This causes cross-platform bugs

# Always be explicit:
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

> **Why the interviewer asks this:** File handling bugs (resource leaks, encoding issues, data loss from `"w"` mode) are common in production.

> **Follow-up:** *"What is the difference between `f.read()`, `f.readline()`, and `f.readlines()` in terms of memory usage?"*

---

### Q14 (Coding): Write a function that safely reads a large file line by line and counts word frequencies.

**Answer:**

```python
from collections import Counter
from pathlib import Path


def count_word_frequencies(filepath: str | Path) -> Counter:
    """
    Count word frequencies in a file, processing line by line
    to keep memory usage constant regardless of file size.

    Args:
        filepath: Path to the text file.

    Returns:
        Counter mapping words (lowercased) to their counts.

    Raises:
        FileNotFoundError: If the file does not exist.
        PermissionError: If the file cannot be read.
    """
    word_counts: Counter = Counter()
    filepath = Path(filepath)

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line_number, line in enumerate(f, start=1):
            # Strip punctuation and normalize to lowercase
            words = line.lower().split()
            cleaned = [
                word.strip(".,!?;:\"'()[]{}") for word in words
            ]
            word_counts.update(w for w in cleaned if w)

    return word_counts


# Usage
if __name__ == "__main__":
    freq = count_word_frequencies("large_log.txt")
    for word, count in freq.most_common(10):
        print(f"{word:>20s}: {count}")
```

**Design decisions:**

1. **Line-by-line iteration** (`for line in f`) uses a buffer — memory is O(1), not O(file_size).
2. **`errors="replace"`** prevents `UnicodeDecodeError` on malformed bytes — replaces them with the replacement character instead of crashing.
3. **`Counter.update()`** accepts an iterable and efficiently merges counts.
4. **`pathlib.Path`** for cross-platform path handling.

> **Why the interviewer asks this:** Processing large files efficiently is a common real-world requirement. Interviewers check for memory-awareness and encoding handling.

> **Follow-up:** *"How would you modify this to process a 50 GB file using multiple cores?"*

---

### Q15 (Debugging): The following code is supposed to append a timestamp to a log file, but it overwrites the previous content every time. Find the bug.

**Problem:**

```python
from datetime import datetime


def log_event(message: str, logfile: str = "app.log") -> None:
    with open(logfile, "w", encoding="utf-8") as f:
        timestamp = datetime.now().isoformat()
        f.write(f"[{timestamp}] {message}\n")
```

**Answer:**

The bug is the file mode `"w"` — it **truncates** the file to zero length before writing. Every call to `log_event` destroys all previous log entries.

**Fix — use append mode `"a"`:**

```python
from datetime import datetime


def log_event(message: str, logfile: str = "app.log") -> None:
    with open(logfile, "a", encoding="utf-8") as f:
        timestamp = datetime.now().isoformat()
        f.write(f"[{timestamp}] {message}\n")
```

**Additional improvement — flush for reliability:**

```python
import os
from datetime import datetime


def log_event(message: str, logfile: str = "app.log") -> None:
    with open(logfile, "a", encoding="utf-8") as f:
        timestamp = datetime.now().isoformat()
        f.write(f"[{timestamp}] {message}\n")
        f.flush()
        os.fsync(f.fileno())  # force write to disk
```

Calling `f.flush()` followed by `os.fsync()` ensures the data is physically written to disk — important for crash-resistant logging.

> **Why the interviewer asks this:** The `"w"` vs `"a"` mistake is one of the most common file-handling bugs. It can cause silent data loss.

> **Follow-up:** *"In a multi-process application, what happens if two processes append to the same log file simultaneously?"*

---

### Q16: How do you write a custom context manager? Show both the class-based and generator-based approaches.

**Answer:**

**Approach 1 — Class-based (`__enter__` / `__exit__`):**

```python
import time


class Timer:
    """Context manager that measures execution time of a block."""

    def __enter__(self):
        self.start = time.perf_counter()
        return self  # the value bound by `as`

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self.start
        print(f"Elapsed: {self.elapsed:.4f}s")
        return False  # do not suppress exceptions


# Usage
with Timer() as t:
    total = sum(range(1_000_000))

print(f"Recorded: {t.elapsed:.4f}s")
```

**Approach 2 — Generator-based (`contextlib.contextmanager`):**

```python
import time
from contextlib import contextmanager


@contextmanager
def timer(label: str = "Block"):
    """Lightweight context manager using a generator."""
    start = time.perf_counter()
    try:
        yield start  # value available via `as`
    finally:
        elapsed = time.perf_counter() - start
        print(f"[{label}] Elapsed: {elapsed:.4f}s")


# Usage
with timer("database query"):
    total = sum(range(1_000_000))
```

**How the generator approach works:**

1. Everything **before** `yield` is `__enter__`.
2. The `yield` value is what gets bound to the `as` variable.
3. Everything **after** `yield` (in the `finally`) is `__exit__`.

**Comparison:**

| Aspect | Class-based | Generator-based |
|--------|-------------|-----------------|
| Boilerplate | More (3 methods) | Less (single function) |
| Reusability | Better for complex state | Better for simple wrappers |
| Exception info | Full access to `exc_type`, `exc_val`, `exc_tb` | Must catch exceptions explicitly around `yield` |
| Async support | `__aenter__` / `__aexit__` | `@asynccontextmanager` |

> **Why the interviewer asks this:** Custom context managers are essential for resource management (DB connections, locks, temp files). This tests both OOP and generator knowledge.

> **Follow-up:** *"How would you write an async context manager for managing a database connection pool?"*

---

### Q17 (Coding): Write a context manager that creates a temporary file, yields its path, and guarantees cleanup.

**Answer:**

```python
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def temporary_file(
    suffix: str = ".tmp",
    prefix: str = "app_",
    content: str | None = None,
    encoding: str = "utf-8",
):
    """
    Create a temporary file that is guaranteed to be deleted on exit.

    Args:
        suffix:   File extension.
        prefix:   Filename prefix.
        content:  Optional initial content to write.
        encoding: Text encoding.

    Yields:
        pathlib.Path to the temporary file.
    """
    fd, path_str = tempfile.mkstemp(suffix=suffix, prefix=prefix)
    path = Path(path_str)

    try:
        # Close the raw file descriptor; we will use open() for writing
        os.close(fd)

        if content is not None:
            path.write_text(content, encoding=encoding)

        yield path
    finally:
        # Guarantee cleanup even if an exception occurs
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass  # best-effort cleanup


# Usage
with temporary_file(suffix=".json", content='{"key": "value"}') as tmp:
    print(f"Temp file at: {tmp}")
    data = tmp.read_text()
    print(data)  # {"key": "value"}

# File is deleted here, even if an exception occurred inside the block
```

**Why not just use `tempfile.NamedTemporaryFile`?**

On Windows, `NamedTemporaryFile` keeps the file open with an exclusive lock, so other processes (or even the same process opening it by name) cannot read it. The `mkstemp` + manual cleanup pattern avoids this cross-platform pitfall.

> **Why the interviewer asks this:** Temporary file management with guaranteed cleanup is a real-world pattern in ETL pipelines, test fixtures, and file-processing services.

> **Follow-up:** *"How does `tempfile.TemporaryDirectory` differ, and when would you use it instead?"*

---

### Q18 (Real-World Case Study): You need to write an atomic file writer — either the entire file is written successfully, or the original file remains unchanged.

**Answer:**

```python
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def atomic_write(
    target: str | Path,
    mode: str = "w",
    encoding: str = "utf-8",
):
    """
    Write to a file atomically. If the write fails or an exception
    occurs, the original file is untouched.

    Strategy: write to a temp file in the same directory, then rename.
    os.replace() is atomic on POSIX and near-atomic on Windows.
    """
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)

    # Create temp file in the SAME directory (required for atomic rename)
    fd, tmp_path = tempfile.mkstemp(
        dir=target.parent,
        prefix=f".{target.name}.",
        suffix=".tmp",
    )

    try:
        with os.fdopen(fd, mode, encoding=encoding) as f:
            yield f
        # If we reach here, writing succeeded — atomically replace
        os.replace(tmp_path, target)
    except BaseException:
        # Writing failed — clean up the temp file, leave original intact
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# Usage
with atomic_write("config.json") as f:
    import json
    json.dump({"version": 2, "debug": False}, f, indent=2)

# If json.dump() raises an exception, config.json is not corrupted
```

**Why this matters in production:**

- A naive `open("config.json", "w")` truncates the file immediately. If the process crashes mid-write, you get a corrupted, half-written file.
- `os.replace()` is an atomic filesystem operation (on POSIX). The old file is replaced in a single operation — readers never see a partial file.
- The temp file must be on the **same filesystem** as the target for `os.replace()` to be atomic; that is why we use `dir=target.parent`.

> **Why the interviewer asks this:** Atomic writes are essential for configuration files, databases, and any system where data integrity matters.

> **Follow-up:** *"How would you handle this for binary files, and what additional guarantees does `fsync` provide?"*

---

## Section 4: Modules & Packages

### Q19: What is the difference between a module and a package in Python?

**Answer:**

| Concept | Definition | Example |
|---------|-----------|---------|
| **Module** | A single `.py` file containing Python code | `utils.py` |
| **Package** | A directory containing an `__init__.py` file and (optionally) submodules | `myapp/` directory with `__init__.py` |
| **Namespace package** | A package **without** `__init__.py` (Python 3.3+, PEP 420) | Rarely used; for distributing a package across multiple directories |

**Directory structure example:**

```
myapp/                  # <-- package (because it has __init__.py)
    __init__.py         # <-- executed when `import myapp` runs
    config.py           # <-- module
    models/             # <-- sub-package
        __init__.py
        user.py         # <-- module
        product.py      # <-- module
    utils/              # <-- sub-package
        __init__.py
        helpers.py      # <-- module
```

**What `__init__.py` does:**

1. **Marks the directory as a package** (required in Python 2, optional in Python 3 for namespace packages, but still recommended).
2. **Runs initialization code** when the package is first imported.
3. **Controls the public API** via `__all__`:

```python
# myapp/__init__.py
from .config import Settings
from .models.user import User

__all__ = ["Settings", "User"]  # controls `from myapp import *`
```

> **Why the interviewer asks this:** Understanding the module system is fundamental to organizing non-trivial Python projects.

> **Follow-up:** *"What are namespace packages, and when would you use them?"*

---

### Q20: Explain absolute imports vs. relative imports. When should you use each?

**Answer:**

```
project/
    main.py
    myapp/
        __init__.py
        services/
            __init__.py
            auth.py
            email.py
        models/
            __init__.py
            user.py
```

**Absolute imports — full path from the project root:**

```python
# In myapp/services/auth.py
from myapp.models.user import User
from myapp.services.email import send_verification
```

**Relative imports — path relative to the current module:**

```python
# In myapp/services/auth.py
from ..models.user import User       # go up one level, then into models
from .email import send_verification  # same package (services)
```

**Comparison:**

| Aspect | Absolute | Relative |
|--------|----------|----------|
| Readability | Clear — full path visible | Shorter but requires understanding directory structure |
| Refactoring | Breaks if package is renamed | Survives package renames; breaks if internal structure changes |
| PEP 8 recommendation | **Preferred** for most code | Acceptable within a package |
| Runability | Works when module is run directly (`python myapp/services/auth.py`) | **Fails** when run directly — requires package context |

**Common pitfall — running a module with relative imports directly:**

```bash
$ python myapp/services/auth.py
# ImportError: attempted relative import with no known parent package

# Fix: run as a module
$ python -m myapp.services.auth
```

**Best practice:** Use absolute imports by default. Use relative imports only within tightly coupled subpackages where the relative path is shorter and clearer.

> **Why the interviewer asks this:** Import errors are one of the most common issues when structuring Python projects. Interviewers check for practical experience.

> **Follow-up:** *"What is circular import, and how do you resolve it?"*

---

### Q21 (Output-Based): What gets printed, and in what order?

**Problem:**

```
pkg/
    __init__.py    # contains: print("init")
    a.py           # contains: print("a loaded"); from .b import helper
    b.py           # contains: print("b loaded"); def helper(): print("helper")
```

```python
# main.py
print("start")
from pkg.a import helper  # noqa: E402
print("end")
helper()
```

**Answer:**

```
start
init
a loaded
b loaded
end
helper
```

**Explanation:**

1. `print("start")` runs immediately.
2. `from pkg.a import helper` triggers:
   - Python sees `pkg` is a package and runs `pkg/__init__.py` first → prints `"init"`.
   - Then Python loads `pkg/a.py` → prints `"a loaded"`.
   - Inside `a.py`, `from .b import helper` is encountered → Python loads `pkg/b.py` → prints `"b loaded"`.
3. Back in `main.py`, `print("end")` runs.
4. `helper()` prints `"helper"`.

**Key insight:** `__init__.py` always runs **before** any module in the package is loaded, and it only runs **once** (subsequent imports reuse the cached module from `sys.modules`).

> **Why the interviewer asks this:** It tests understanding of import execution order, which is critical for debugging initialization bugs and circular imports.

> **Follow-up:** *"What would happen if `__init__.py` imported from `a.py`, and `a.py` imported from `b.py`? Could this cause a circular import?"*

---

### Q22 (Debugging): A developer reports that their changes to `utils.py` are not reflected when they run the program. What is happening?

**Scenario:**

```python
# main.py
import utils
print(utils.VERSION)  # Still shows "1.0" even though utils.py says "2.0"
```

**Answer:**

There are several possible causes, ranked by likelihood:

**1. Stale `.pyc` bytecode cache (most common):**

Python caches compiled bytecode in `__pycache__/` directories. If the file's modification timestamp has not changed (e.g., due to a version control operation or filesystem issue), Python may use the old `.pyc`.

```bash
# Fix: delete the cache
find . -type d -name __pycache__ -exec rm -rf {} +
# or
python -B main.py  # -B flag disables .pyc generation
```

**2. Wrong `utils.py` is being imported:**

Another `utils.py` earlier in `sys.path` is shadowing the intended one.

```python
import utils
print(utils.__file__)  # Check WHICH file was actually loaded
```

**3. Module was already imported and cached in `sys.modules`:**

In an interactive session (REPL, Jupyter), a previously imported version is cached.

```python
import importlib
import utils
importlib.reload(utils)  # Force reload
```

**4. The file was not saved** (obvious but worth checking in live debugging).

**Debugging checklist:**

```python
import sys

# 1. Check which file was loaded
import utils
print(utils.__file__)

# 2. Check sys.path order
for p in sys.path:
    print(p)

# 3. Check if a cached version exists
print("utils" in sys.modules)
```

> **Why the interviewer asks this:** Import caching and `sys.path` confusion are real debugging scenarios that trip up even experienced developers.

> **Follow-up:** *"How does `importlib.reload()` differ from deleting from `sys.modules` and re-importing?"*

---

### Q23: What is `if __name__ == "__main__"` and why is it important?

**Answer:**

Every Python module has a built-in `__name__` attribute:

- When the module is **run directly** (e.g., `python mymodule.py`), `__name__` is set to `"__main__"`.
- When the module is **imported** by another module, `__name__` is set to the module's qualified name (e.g., `"mymodule"`).

```python
# mymodule.py

def calculate(x: int, y: int) -> int:
    return x + y


# This block runs ONLY when the file is executed directly,
# NOT when it is imported.
if __name__ == "__main__":
    result = calculate(3, 4)
    print(f"Result: {result}")
```

**Why it matters:**

1. **Prevents side effects on import:** Without it, top-level code runs when another module imports a function from this file.
2. **Enables dual use:** The file works both as a reusable library and as a standalone script.
3. **Required for `multiprocessing` on Windows:** Without this guard, spawning new processes re-imports the module and re-executes top-level code, causing infinite process spawning.

**Real-world pattern:**

```python
# app/cli.py

import argparse
from app.core import process


def main():
    parser = argparse.ArgumentParser(description="Process data")
    parser.add_argument("input", help="Input file path")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    process(args.input, verbose=args.verbose)


if __name__ == "__main__":
    main()
```

This pattern keeps the `main()` function importable and testable, while the `if __name__` guard handles CLI execution.

> **Why the interviewer asks this:** It is a basic but important concept. Getting it wrong causes real bugs, especially in multiprocessing and testing.

> **Follow-up:** *"How do you configure `pyproject.toml` to expose `main()` as a console script entry point?"*

---

### Q24 (Real-World Case Study): You are structuring a FastAPI project. Design the package layout and explain the import strategy.

**Answer:**

```
myapi/
    __init__.py
    main.py              # FastAPI app factory
    config.py            # Settings (pydantic BaseSettings)
    dependencies.py      # Shared FastAPI dependencies
    models/
        __init__.py      # Re-exports: from .user import User
        base.py          # SQLAlchemy Base
        user.py
        product.py
    schemas/
        __init__.py
        user.py          # Pydantic request/response models
        product.py
    routers/
        __init__.py
        users.py         # APIRouter for /users
        products.py      # APIRouter for /products
    services/
        __init__.py
        user_service.py  # Business logic
        email_service.py
    repositories/
        __init__.py
        user_repo.py     # Database access layer
    tests/
        __init__.py
        conftest.py
        test_users.py
```

**Import strategy:**

```python
# myapi/routers/users.py
from fastapi import APIRouter, Depends

from myapi.schemas.user import UserCreate, UserResponse
from myapi.services.user_service import UserService
from myapi.dependencies import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    payload: UserCreate,
    service: UserService = Depends(),
) -> UserResponse:
    return await service.create(payload)
```

**Key design decisions:**

1. **Absolute imports everywhere** — clear and IDE-friendly.
2. **`__init__.py` re-exports** — simplify external imports: `from myapi.models import User` instead of `from myapi.models.user import User`.
3. **Layered architecture** — routers (HTTP) -> services (business logic) -> repositories (DB). Each layer only imports from the layer below, preventing circular imports.
4. **Schemas separate from models** — Pydantic schemas (API contracts) are decoupled from SQLAlchemy models (database schema).

> **Why the interviewer asks this:** Project structure reveals engineering maturity. Interviewers want to see layered architecture and understanding of import hygiene.

> **Follow-up:** *"How would you handle circular dependencies between `user_service` and `email_service`?"*

---

## Section 5: Virtual Environments

### Q25: What is a virtual environment, and why is it essential for Python development?

**Answer:**

A virtual environment is an **isolated Python installation** with its own `site-packages` directory. It allows each project to have its own dependencies, independent of the system Python and other projects.

**Creating and using a virtual environment:**

```bash
# Create
python -m venv .venv

# Activate
# Linux / macOS:
source .venv/bin/activate
# Windows (cmd):
.venv\Scripts\activate.bat
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install dependencies
pip install fastapi uvicorn sqlalchemy

# Freeze dependencies
pip freeze > requirements.txt

# Deactivate
deactivate
```

**Why virtual environments are essential:**

| Problem without venv | How venv solves it |
|---------------------|-------------------|
| Project A needs `requests==2.28`, Project B needs `requests==2.31` | Each venv has its own `requests` version |
| `pip install` pollutes the system Python | Packages install only in the venv |
| Deploying to production fails because of missing/extra packages | `requirements.txt` captures the exact dependency set |
| OS package manager conflicts (e.g., Ubuntu's system Python) | venv is completely isolated from system packages |

**How it works internally:**

```bash
# A venv is a directory with:
.venv/
    bin/             # (Scripts/ on Windows) — python, pip, activate
    lib/
        python3.12/
            site-packages/   # installed packages go here
    pyvenv.cfg       # points to the base Python interpreter
```

When activated, the shell's `PATH` is modified so that `.venv/bin/python` is found before the system Python.

> **Why the interviewer asks this:** It is a fundamental DevOps/development practice. Not using virtual environments causes real deployment failures.

> **Follow-up:** *"What is the difference between `venv`, `virtualenv`, `conda`, and `poetry` for environment management?"*

---

### Q26: Explain `requirements.txt` vs. `pyproject.toml`. What are pinned vs. unpinned dependencies?

**Answer:**

**`requirements.txt` — the traditional approach:**

```txt
# Pinned (exact versions) — for reproducible deployments
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
pydantic==2.5.2

# Unpinned (version ranges) — for libraries
fastapi>=0.100,<1.0
uvicorn>=0.20
```

**`pyproject.toml` — the modern standard (PEP 621):**

```toml
[project]
name = "myapi"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.100,<1.0",
    "uvicorn>=0.20",
    "sqlalchemy>=2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1.0",
    "mypy>=1.7",
]
```

**Pinned vs. unpinned:**

| Strategy | When to use | Example |
|----------|------------|---------|
| **Pinned** (`==`) | Application deployments — you want exact reproducibility | `fastapi==0.104.1` |
| **Unpinned** / range | Libraries — let the consumer resolve compatible versions | `fastapi>=0.100,<1.0` |

**Best practice for applications — use a lock file:**

```bash
# Install and pin with pip-tools
pip install pip-tools
pip-compile requirements.in -o requirements.txt  # resolves and pins ALL transitive deps
pip-sync requirements.txt                         # installs exactly what is listed
```

Or use modern tools: `poetry lock`, `pdm lock`, `uv pip compile`.

**Common mistake — not pinning transitive dependencies:**

```txt
# requirements.txt
fastapi==0.104.1
# But fastapi depends on starlette, pydantic, etc.
# Without pinning those, a new starlette version could break your app
```

`pip freeze` captures everything, but `pip-compile` from `pip-tools` is more maintainable because it separates direct vs. transitive dependencies.

> **Why the interviewer asks this:** Dependency management issues cause production outages. Interviewers assess your DevOps maturity.

> **Follow-up:** *"What is dependency hell, and how do tools like `poetry` or `uv` solve it?"*

---

### Q27 (Debugging): A new team member clones the repo, creates a venv, runs `pip install -r requirements.txt`, and gets errors. Diagnose the issue.

**Problem:**

```
ERROR: Could not find a version that satisfies the requirement numpy==1.24.0 (from versions: 1.26.0, 1.26.1, 1.26.2)
ERROR: No matching distribution found for numpy==1.24.0
```

**Answer:**

**Root cause analysis:**

The pinned version `numpy==1.24.0` is no longer available for the new team member's Python version. This typically happens when:

1. **Python version mismatch:** `numpy==1.24.0` supports Python 3.8–3.11, but the new developer has Python 3.12. Newer Python versions drop support for older package versions.

2. **Platform mismatch:** The requirements were frozen on Linux but the developer is on macOS ARM (Apple Silicon), and no pre-built wheel exists for that platform+version combination.

3. **Package was yanked** from PyPI (rare but possible).

**Diagnosis steps:**

```bash
# Check Python version
python --version

# Check what numpy versions are available for this Python
pip install numpy==  # intentional error — pip will list available versions

# Check the platform
python -c "import platform; print(platform.platform())"
```

**Fixes:**

```bash
# Fix 1: Relax the pin to allow compatible versions
# In requirements.txt, change:
#   numpy==1.24.0
# To:
#   numpy>=1.24,<2.0

# Fix 2: Use python_requires markers
# In requirements.txt:
numpy==1.24.0; python_version < "3.12"
numpy==1.26.2; python_version >= "3.12"

# Fix 3: Re-freeze on the target Python version
pip-compile --python-version 3.12 requirements.in
```

**Prevention:**

- Document the required Python version in `pyproject.toml` (`requires-python = ">=3.11,<3.13"`).
- Use CI to test against multiple Python versions.
- Use a lock file tool that records `python_version` and `platform` markers.

> **Why the interviewer asks this:** Dependency resolution failures are the most common onboarding issue. Interviewers want to see systematic debugging skills.

> **Follow-up:** *"How would you set up a CI pipeline to test against Python 3.11, 3.12, and 3.13 simultaneously?"*

---

### Q28 (Conceptual): What is the difference between `pip install package` and `pip install -e .` (editable install)?

**Answer:**

```bash
# Regular install — copies the package into site-packages
pip install mypackage

# Editable install — creates a link so changes are reflected immediately
pip install -e .
# Or with extras:
pip install -e ".[dev,test]"
```

**How they differ:**

| Aspect | `pip install package` | `pip install -e .` |
|--------|----------------------|-------------------|
| Source location | Copied to `site-packages/` | Stays in your project directory |
| Code changes | Must reinstall to pick up changes | Changes are reflected **immediately** |
| Use case | Production / CI | Local development |
| Mechanism | Copies files | Creates a `.pth` file or symlink pointing to your project root |
| Requires | Package name on PyPI or a wheel | A `pyproject.toml` or `setup.py` in the current directory |

**Why editable installs matter for development:**

```
myapp/
    pyproject.toml
    src/
        myapp/
            __init__.py
            core.py
```

```bash
pip install -e .
# Now you can do `from myapp.core import something` from anywhere,
# and edits to src/myapp/core.py take effect without reinstalling.
```

**Without editable install**, you would need to either:
- Reinstall after every code change, or
- Hack `sys.path` (fragile and error-prone).

> **Why the interviewer asks this:** Editable installs are standard in professional Python development. Not knowing them suggests limited project experience.

> **Follow-up:** *"How does `pip install -e .` work under the hood with PEP 660 and the build backend?"*

---

## Section 6: Introduction to Decorators

### Q29: What is a decorator in Python? Explain step by step how it works.

**Answer:**

A decorator is a **function that takes a function as input and returns a new function** (usually with added behavior). The `@decorator` syntax is syntactic sugar for reassigning the function name.

**Step-by-step breakdown:**

```python
# Step 1: Define a decorator
def log_calls(func):
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result}")
        return result
    return wrapper


# Step 2: Apply with @ syntax
@log_calls
def add(a, b):
    return a + b


# Step 3: The @ syntax is equivalent to:
# add = log_calls(add)

# Step 4: When we call add(), we are actually calling wrapper()
add(3, 5)
# Output:
# Calling add with args=(3, 5), kwargs={}
# add returned 8
```

**What happens in memory:**

```
Before decoration:
    add  ->  <original function object>

After @log_calls:
    add  ->  <wrapper function object>  (which has a closure over the original `func`)
```

**The key concepts:**

1. **Functions are first-class objects** — they can be passed as arguments and returned from other functions.
2. **Closures** — `wrapper` has access to `func` because of Python's closure mechanism.
3. **`*args, **kwargs`** — the wrapper accepts any arguments and forwards them, making it generic.

> **Why the interviewer asks this:** Decorators are used extensively in FastAPI (`@app.get`), Flask, Django, pytest, and standard library. Understanding them is non-negotiable for Python developers.

> **Follow-up:** *"What happens to the decorated function's `__name__` and `__doc__` attributes?"*

---

### Q30: What is `functools.wraps` and why is it critical?

**Answer:**

Without `functools.wraps`, the decorated function loses its identity:

```python
def my_decorator(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


@my_decorator
def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}"


print(greet.__name__)    # "wrapper"  <-- WRONG
print(greet.__doc__)     # None       <-- WRONG
print(greet.__module__)  # Still correct, but other metadata is lost
```

**Fix with `functools.wraps`:**

```python
import functools


def my_decorator(func):
    @functools.wraps(func)  # <-- copies metadata from func to wrapper
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


@my_decorator
def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}"


print(greet.__name__)       # "greet"                    <-- Correct
print(greet.__doc__)        # "Return a greeting message" <-- Correct
print(greet.__wrapped__)    # <original greet function>   <-- Bonus: access to original
```

**What `functools.wraps` copies:**

- `__name__` — function name
- `__doc__` — docstring
- `__module__` — module where the function was defined
- `__qualname__` — qualified name (includes class name for methods)
- `__annotations__` — type hints
- `__dict__` — any custom attributes
- `__wrapped__` — reference to the original function (for introspection/testing)

**Why it matters in practice:**

1. **Debugging:** Stack traces show `wrapper` instead of the real function name.
2. **Documentation tools** (Sphinx, mkdocs) generate docs from `__doc__` and `__name__`.
3. **FastAPI/Flask** use function metadata for route registration and OpenAPI schema generation.
4. **Testing:** `__wrapped__` lets you test the original function without the decorator.

```python
# Testing the unwrapped function
original_greet = greet.__wrapped__
assert original_greet("World") == "Hello, World"
```

> **Why the interviewer asks this:** Forgetting `functools.wraps` is a common mistake that causes real bugs in frameworks that inspect function metadata.

> **Follow-up:** *"How does `functools.wraps` actually work under the hood? What is `functools.update_wrapper`?"*

---

### Q31 (Coding): Write a decorator that measures and logs the execution time of a function.

**Answer:**

```python
import functools
import logging
import time
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def timed(func: F) -> F:
    """
    Decorator that logs the execution time of a function.

    Logs at DEBUG level for fast calls (< 1s) and WARNING for slow calls.
    """
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            elapsed = time.perf_counter() - start
            level = logging.WARNING if elapsed > 1.0 else logging.DEBUG
            logger.log(
                level,
                "%s executed in %.4fs",
                func.__qualname__,
                elapsed,
            )

    return wrapper  # type: ignore[return-value]


# Usage
@timed
def compute_report(data: list[dict]) -> dict:
    """Simulate an expensive computation."""
    time.sleep(0.5)
    return {"total": len(data)}


# In production (FastAPI example):
# @app.get("/report")
# @timed
# async def get_report():
#     ...
```

**Design decisions:**

- **`time.perf_counter()`** is used instead of `time.time()` because it has the highest available resolution and is not affected by system clock adjustments.
- **`try/finally`** ensures the time is logged even if the function raises an exception.
- **Conditional log level** — slow functions trigger a `WARNING`, making them easy to spot in log aggregation tools.
- **`func.__qualname__`** includes the class name for methods (e.g., `UserService.create`).

> **Why the interviewer asks this:** Performance monitoring via decorators is a standard pattern. It tests practical decorator implementation.

> **Follow-up:** *"How would you make this decorator accept a configurable threshold parameter?"*

---

### Q32 (Coding): Write a decorator that accepts arguments (a parameterized decorator).

**Answer:**

A parameterized decorator requires **three levels of nesting**: the outer function takes the parameters, returns the actual decorator, which returns the wrapper.

```python
import functools
import time
from typing import Any, Callable


def rate_limit(max_calls: int, period: float = 60.0):
    """
    Decorator that limits how many times a function can be called
    within a given time period.

    Args:
        max_calls: Maximum number of allowed calls in the period.
        period:    Time window in seconds (default: 60).

    Raises:
        RuntimeError: If the rate limit is exceeded.
    """
    def decorator(func: Callable) -> Callable:
        call_times: list[float] = []

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            now = time.monotonic()

            # Remove timestamps outside the current window
            while call_times and call_times[0] <= now - period:
                call_times.pop(0)

            if len(call_times) >= max_calls:
                wait = period - (now - call_times[0])
                raise RuntimeError(
                    f"Rate limit exceeded for {func.__name__}. "
                    f"Try again in {wait:.1f}s."
                )

            call_times.append(now)
            return func(*args, **kwargs)

        return wrapper
    return decorator


# Usage
@rate_limit(max_calls=5, period=10.0)
def send_email(to: str, subject: str) -> None:
    """Send an email (simulated)."""
    print(f"Email sent to {to}: {subject}")


# This will work for the first 5 calls within 10 seconds,
# then raise RuntimeError until the window resets.
```

**The three levels explained:**

```python
@rate_limit(max_calls=5, period=10.0)  # calls rate_limit(5, 10.0) -> returns `decorator`
def send_email(...):                    # `decorator(send_email)` -> returns `wrapper`
    ...                                 # `send_email` is now bound to `wrapper`
```

**Alternative — using a class as a decorator:**

```python
class RateLimit:
    def __init__(self, max_calls: int, period: float = 60.0):
        self.max_calls = max_calls
        self.period = period

    def __call__(self, func: Callable) -> Callable:
        call_times: list[float] = []

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # ... same logic as above ...
            return func(*args, **kwargs)
        return wrapper
```

> **Why the interviewer asks this:** Parameterized decorators are used in every major framework (`@app.route("/path")`, `@pytest.mark.parametrize(...)`, `@retry(max_attempts=3)`). Understanding the triple nesting is essential.

> **Follow-up:** *"How would you make this decorator thread-safe for a multi-threaded web server?"*

---

### Q33 (Output-Based): What does this code print? Identify any issues.

**Problem:**

```python
def decorator_a(func):
    print("A applied")
    def wrapper(*args, **kwargs):
        print("A before")
        result = func(*args, **kwargs)
        print("A after")
        return result
    return wrapper


def decorator_b(func):
    print("B applied")
    def wrapper(*args, **kwargs):
        print("B before")
        result = func(*args, **kwargs)
        print("B after")
        return result
    return wrapper


@decorator_a
@decorator_b
def say_hello():
    print("Hello!")


print("--- Calling say_hello ---")
say_hello()
```

**Answer:**

```
B applied
A applied
--- Calling say_hello ---
A before
B before
Hello!
B after
A after
```

**Explanation:**

**Decoration phase** (at import time, not at call time):

```python
@decorator_a
@decorator_b
def say_hello(): ...

# Is equivalent to:
say_hello = decorator_a(decorator_b(say_hello))
```

1. `decorator_b(say_hello)` runs first → prints `"B applied"`, returns `wrapper_b`.
2. `decorator_a(wrapper_b)` runs second → prints `"A applied"`, returns `wrapper_a`.

**Call phase:**

3. `say_hello()` calls `wrapper_a()` → prints `"A before"`.
4. `wrapper_a` calls `func()` which is `wrapper_b` → prints `"B before"`.
5. `wrapper_b` calls the original `say_hello()` → prints `"Hello!"`.
6. `wrapper_b` finishes → prints `"B after"`.
7. `wrapper_a` finishes → prints `"A after"`.

**Key insight:** Decorators are applied **bottom-up** but execute **top-down**. Think of it like layers of an onion — the outermost decorator (`@decorator_a`) is the first to run and the last to finish.

**Issue:** Neither decorator uses `@functools.wraps(func)`, so `say_hello.__name__` would be `"wrapper"` instead of `"say_hello"`.

> **Why the interviewer asks this:** Decorator stacking order is a frequent interview question and a common source of bugs when order matters (e.g., authentication before rate limiting).

> **Follow-up:** *"In FastAPI, should `@app.get('/')` be above or below a custom `@authenticate` decorator? Why?"*

---

### Q34 (Real-World Case Study): You need to build a caching decorator for expensive database queries in a FastAPI application.

**Answer:**

```python
import functools
import hashlib
import json
import time
from typing import Any, Callable


def cache(ttl: float = 300.0, maxsize: int = 128):
    """
    In-memory cache decorator with TTL (time-to-live) expiration.

    Args:
        ttl:     Cache entry lifetime in seconds (default: 5 minutes).
        maxsize: Maximum number of cached entries. Oldest entries are
                 evicted when the limit is reached (FIFO).

    Note:
        This is suitable for single-process applications. For multi-process
        or distributed systems, use Redis or Memcached instead.
    """
    def decorator(func: Callable) -> Callable:
        _cache: dict[str, tuple[float, Any]] = {}

        def _make_key(args: tuple, kwargs: dict) -> str:
            """Create a deterministic cache key from function arguments."""
            key_data = {
                "args": [repr(a) for a in args],
                "kwargs": {k: repr(v) for k, v in sorted(kwargs.items())},
            }
            raw = json.dumps(key_data, sort_keys=True)
            return hashlib.sha256(raw.encode()).hexdigest()

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = _make_key(args, kwargs)
            now = time.monotonic()

            # Check cache hit
            if key in _cache:
                timestamp, value = _cache[key]
                if now - timestamp < ttl:
                    return value
                else:
                    del _cache[key]  # expired

            # Cache miss — call the function
            result = func(*args, **kwargs)

            # Evict oldest entries if at capacity
            if len(_cache) >= maxsize:
                oldest_key = next(iter(_cache))
                del _cache[oldest_key]

            _cache[key] = (now, result)
            return result

        # Expose cache management methods
        def cache_clear() -> None:
            """Clear all cached entries."""
            _cache.clear()

        def cache_info() -> dict:
            """Return cache statistics."""
            now = time.monotonic()
            active = sum(1 for ts, _ in _cache.values() if now - ts < ttl)
            return {
                "size": len(_cache),
                "active": active,
                "expired": len(_cache) - active,
                "maxsize": maxsize,
                "ttl": ttl,
            }

        wrapper.cache_clear = cache_clear  # type: ignore[attr-defined]
        wrapper.cache_info = cache_info    # type: ignore[attr-defined]

        return wrapper
    return decorator


# Usage in a FastAPI service
@cache(ttl=60.0, maxsize=256)
def get_user_profile(user_id: int) -> dict:
    """Simulate an expensive database query."""
    print(f"DB query for user {user_id}")  # only printed on cache miss
    return {"id": user_id, "name": "Alice", "email": "alice@example.com"}


# First call — cache miss, hits DB
profile = get_user_profile(42)

# Second call — cache hit, no DB query
profile = get_user_profile(42)

# Cache management
print(get_user_profile.cache_info())
get_user_profile.cache_clear()
```

**Why not just use `functools.lru_cache`?**

| Feature | `functools.lru_cache` | Custom `cache` above |
|---------|----------------------|---------------------|
| TTL expiration | No | Yes |
| Hashable args only | Yes (args must be hashable) | No — uses `repr()` and hashing |
| Thread safety | Yes (built-in lock) | No — would need `threading.Lock` |
| Cache stats | `cache_info()` | Custom `cache_info()` |
| Suitable for web apps | Limited (no TTL = stale data) | Better (TTL prevents serving stale data) |

**Production improvements to consider:**

1. **Thread safety:** Add a `threading.Lock` around cache reads/writes.
2. **Async support:** Use an async-compatible cache for FastAPI async endpoints.
3. **Distributed caching:** Replace the in-memory dict with Redis for multi-process deployments.
4. **Cache key collisions:** The SHA-256 hash makes collisions practically impossible.

> **Why the interviewer asks this:** Caching is a critical performance optimization in web applications. This tests decorator mastery combined with systems thinking.

> **Follow-up:** *"How would you invalidate the cache when the underlying data changes (e.g., after a `PUT /users/42` request)?"*

---

## Quick Reference Cheat Sheet

### Comprehensions

```python
# List
[x ** 2 for x in range(10) if x % 2 == 0]

# Dict
{k: v for k, v in pairs if v is not None}

# Set
{word.lower() for word in words}

# Generator (lazy, memory-efficient)
sum(x ** 2 for x in range(1_000_000))
```

### Exception Handling

```python
try:
    risky_operation()
except SpecificError as e:
    handle_error(e)
except (TypeError, ValueError):
    handle_multiple()
else:
    on_success()          # only if no exception
finally:
    cleanup()             # always runs

# Custom exception
class AppError(Exception):
    def __init__(self, message: str, code: int):
        self.code = code
        super().__init__(message)

# Exception chaining
raise NewError("msg") from original_error
```

### File Handling

```python
# Read
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()

# Write (creates or truncates)
with open("file.txt", "w", encoding="utf-8") as f:
    f.write("data")

# Append
with open("file.txt", "a", encoding="utf-8") as f:
    f.write("more data\n")

# Line-by-line (memory efficient)
with open("large.txt", "r", encoding="utf-8") as f:
    for line in f:
        process(line)
```

### Imports

```python
# Absolute (preferred)
from myapp.models.user import User

# Relative (within a package)
from ..models.user import User    # up two levels
from .helpers import format_date  # same package
```

### Virtual Environments

```bash
python -m venv .venv              # create
source .venv/bin/activate         # activate (Linux/macOS)
pip install -r requirements.txt   # install deps
pip freeze > requirements.txt     # snapshot deps
deactivate                        # exit
```

### Decorators

```python
import functools

# Simple decorator
def my_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # before
        result = func(*args, **kwargs)
        # after
        return result
    return wrapper

# Parameterized decorator
def repeat(n: int):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def greet(name):
    print(f"Hello, {name}!")
```

---

## What is Next?

Continue your preparation with **[Part 3: Advanced Python](./03-advanced-python.md)** covering:
- Generators and iterators
- Advanced OOP (metaclasses, descriptors, `__slots__`)
- Concurrency (threading, asyncio, multiprocessing)
- Type hints and `mypy`
- Design patterns in Python

---

> **Series Navigation:**
> [Part 1: Python Fundamentals](./01-python-fundamentals.md) |
> **Part 2: Intermediate Python** (You are here) |
> [Part 3: Advanced Python](./03-advanced-python.md) |
> [Part 4: FastAPI Fundamentals](./04-fastapi-fundamentals.md) |
> [Part 5: FastAPI Advanced](./05-fastapi-advanced.md) |
> [Part 6: Databases & ORMs](./06-databases-and-orms.md) |
> [Part 7: System Design & Deployment](./07-system-design-deployment.md)
