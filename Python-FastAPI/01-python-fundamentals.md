# Python Fundamentals — Interview Preparation (Part 1/7)

> **Series:** Python + FastAPI Interview Prep
> **Level:** Beginner
> **Estimated Study Time:** 3–4 hours
> **Questions Covered:** 32

This is **File 1 of 7** in a structured interview preparation series that takes you from core Python all the way to production-grade FastAPI applications. Master these fundamentals first — every advanced topic builds on them.

---

## Table of Contents

- [Section 1: Data Types, Variables and Operators](#section-1-data-types-variables-and-operators)
  - [Q1: Mutable vs Immutable Types](#q1-what-is-the-difference-between-mutable-and-immutable-types-in-python)
  - [Q2: Dynamic Typing](#q2-python-is-dynamically-typed-what-does-that-mean-and-what-are-the-trade-offs)
  - [Q3: `is` vs `==`](#q3-what-is-the-difference-between-is-and--in-python)
  - [Q4: Integer Caching (Output-Based)](#q4-output-based-what-will-the-following-code-print-and-why)
  - [Q5: Type Conversion Pitfalls](#q5-debugging-a-developer-wrote-this-function-but-it-crashes-on-certain-inputs-find-and-fix-the-bug)
  - [Q6: Truthy and Falsy Values](#q6-what-are-truthy-and-falsy-values-in-python-why-do-they-matter)
  - [Q7: Short-Circuit Evaluation](#q7-explain-short-circuit-evaluation-with-and-and-or-what-do-they-actually-return)
- [Section 2: Control Flow](#section-2-control-flow)
  - [Q8: `for`/`else` Construct](#q8-what-does-the-else-clause-on-a-for-loop-do)
  - [Q9: FizzBuzz Variant](#q9-coding-write-a-function-that-returns-a-list-of-fizzbuzz-results-for-numbers-1-through-n)
  - [Q10: Walrus Operator](#q10-what-is-the-walrus-operator--and-when-is-it-useful)
  - [Q11: Match Statement](#q11-what-is-structural-pattern-matching-match-case-and-how-does-it-differ-from-if-elif-chains)
  - [Q12: Infinite Loop Debugging](#q12-debugging-this-code-causes-an-infinite-loop-identify-and-fix-it)
  - [Q13: Exception Handling in Loops](#q13-real-world-you-are-reading-rows-from-a-csv-file-that-may-contain-bad-data-how-do-you-process-all-valid-rows-while-logging-errors)
- [Section 3: Functions, Arguments and Recursion](#section-3-functions-arguments-and-recursion)
  - [Q14: Mutable Default Arguments](#q14-what-happens-when-you-use-a-mutable-default-argument-in-a-function)
  - [Q15: `*args` and `**kwargs`](#q15-explain-args-and-kwargs-when-would-you-use-each)
  - [Q16: First-Class Functions](#q16-what-does-it-mean-that-functions-are-first-class-objects-in-python)
  - [Q17: Recursion — Flatten Nested List](#q17-coding-write-a-recursive-function-to-flatten-an-arbitrarily-nested-list)
  - [Q18: Recursion Limit and Tail Calls](#q18-what-is-pythons-recursion-limit-and-why-doesnt-python-optimize-tail-recursion)
  - [Q19: Scope and the LEGB Rule](#q19-explain-the-legb-rule-in-python)
  - [Q20: Lambda and Higher-Order Functions](#q20-when-should-you-use-lambda-vs-a-named-function)
- [Section 4: Collections — List, Tuple, Set, Dict](#section-4-collections--list-tuple-set-dict)
  - [Q21: List vs Tuple](#q21-when-would-you-choose-a-tuple-over-a-list)
  - [Q22: Dictionary Ordering](#q22-are-python-dictionaries-ordered)
  - [Q23: List Comprehension (Output-Based)](#q23-output-based-what-does-this-list-comprehension-produce)
  - [Q24: Shallow vs Deep Copy](#q24-what-is-the-difference-between-shallow-copy-and-deep-copy)
  - [Q25: Set Operations for Real-World Problems](#q25-real-world-given-two-large-lists-of-user-ids-find-users-who-exist-in-both-lists-efficiently)
  - [Q26: `defaultdict` and `Counter`](#q26-explain-defaultdict-and-counter-when-are-they-better-than-plain-dicts)
  - [Q27: Dictionary Merge Debugging](#q27-debugging-a-junior-developer-is-trying-to-merge-two-config-dicts-but-the-result-is-wrong-find-the-issue)
- [Section 5: Basic OOP — Classes, Objects, Methods](#section-5-basic-oop--classes-objects-methods)
  - [Q28: `__init__` and `self`](#q28-what-is-__init__-and-why-does-every-method-take-self-as-the-first-parameter)
  - [Q29: Class vs Instance Variables](#q29-what-is-the-difference-between-class-variables-and-instance-variables)
  - [Q30: OOP Design — Bank Account](#q30-coding-design-a-bankaccount-class-with-deposit-withdraw-and-balance-checking)
  - [Q31: `__str__` vs `__repr__`](#q31-what-is-the-difference-between-__str__-and-__repr__)
  - [Q32: Inheritance and Method Resolution Order](#q32-explain-inheritance-and-method-resolution-order-mro-in-python)
- [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Section 1: Data Types, Variables and Operators

---

### Q1: What is the difference between mutable and immutable types in Python?

**Answer:**

In Python, every object has a type, and that type determines whether the object's value can be changed after creation.

| Category    | Types                                      | Key Behavior                        |
|-------------|------------------------------------------- |-------------------------------------|
| Immutable   | `int`, `float`, `str`, `tuple`, `frozenset`, `bytes`, `bool` | Value cannot be changed in place   |
| Mutable     | `list`, `dict`, `set`, `bytearray`         | Value can be changed in place       |

```python
# Immutable: reassignment creates a NEW object
x = 10
print(id(x))   # e.g., 140234866358544
x += 1
print(id(x))   # Different id — a new int object was created

# Mutable: the SAME object is modified in place
nums = [1, 2, 3]
print(id(nums))  # e.g., 140234866123456
nums.append(4)
print(id(nums))  # Same id — the list was mutated
```

**Edge case — tuples containing mutable elements:**

```python
t = ([1, 2], [3, 4])
t[0].append(99)   # This works! The list inside is mutable.
print(t)           # ([1, 2, 99], [3, 4])
t[0] = [5, 6]     # TypeError — you cannot reassign the tuple's slot
```

The tuple itself is immutable (its slots cannot point to different objects), but the objects *inside* those slots can still be mutated if they are mutable types.

**Why interviewer asks this:**
Understanding mutability is foundational. It affects how arguments are passed to functions, how variables behave in closures, whether objects can be dictionary keys, and how unintended side effects creep into production code.

**Follow-up:** *Can you use a list as a dictionary key? Why or why not?*

---

### Q2: Python is dynamically typed. What does that mean, and what are the trade-offs?

**Answer:**

In Python, variables do not have types — *objects* do. A variable is simply a name (reference) bound to an object, and you can rebind it to an object of a completely different type at any time.

```python
x = 42          # x references an int
x = "hello"     # now x references a str — no error
x = [1, 2, 3]   # now x references a list — still no error
```

**Advantages:**
- **Rapid prototyping:** No boilerplate type declarations.
- **Flexibility:** Functions can operate on any type that supports the required operations (duck typing).
- **Shorter code:** Less ceremony for simple tasks.

**Disadvantages:**
- **Runtime errors:** Type mismatches are caught at runtime, not compile time.
- **Harder refactoring:** Renaming or changing a type does not produce compiler errors across the codebase.
- **Performance:** The interpreter must check types at runtime, which adds overhead.

**Mitigation — Type Hints (PEP 484):**

```python
def greet(name: str) -> str:
    return f"Hello, {name}"
```

Type hints are **not enforced** by Python at runtime, but tools like `mypy`, `pyright`, and IDE inspections use them to catch errors statically.

**Why interviewer asks this:**
This tests whether you understand Python's type system deeply enough to write robust code, and whether you know how to use type hints to get the best of both worlds.

**Follow-up:** *What is duck typing, and how does it relate to dynamic typing?*

---

### Q3: What is the difference between `is` and `==` in Python?

**Answer:**

| Operator | Checks            | Equivalent to          |
|----------|--------------------|------------------------|
| `==`     | Value equality     | `a.__eq__(b)`          |
| `is`     | Identity (same object in memory) | `id(a) == id(b)` |

```python
a = [1, 2, 3]
b = [1, 2, 3]

print(a == b)   # True  — same values
print(a is b)   # False — different objects in memory

c = a
print(a is c)   # True  — c is just another name for the same object
```

**When to use `is`:**
- Comparing with singletons: `if x is None`, `if x is True`, `if x is NotImplemented`.
- Never use `==` to compare against `None` because a class could override `__eq__` and produce unexpected results.

```python
# Bad — fragile
if x == None:
    ...

# Good — always correct
if x is None:
    ...
```

**Why interviewer asks this:**
This is a common source of subtle bugs, especially when developers confuse identity with equality. It also reveals understanding of Python's object model.

**Follow-up:** *Why does `a = 256; b = 256; a is b` return `True` but `a = 257; b = 257; a is b` may return `False`?*

---

### Q4: (Output-Based) What will the following code print, and why?

```python
a = 256
b = 256
print(a is b)

c = 257
d = 257
print(c is d)
```

**Answer:**

```
True
False   # (in the standard CPython REPL; may vary — see below)
```

**Explanation:**

CPython caches small integers in the range **[-5, 256]** as singleton objects (this is called the *integer interning* or *small integer cache*). Any variable assigned a value in this range points to the **same object** in memory.

- `a = 256` and `b = 256` both point to the cached `256` object, so `a is b` is `True`.
- `c = 257` and `d = 257` create **two separate** `int` objects (outside the cache range), so `c is d` is `False`.

**Important caveat:** In a `.py` script (as opposed to the REPL), the compiler may intern both `257` literals within the same code block, making `c is d` return `True`. This is an implementation detail of CPython's peephole optimizer and **must never be relied upon**.

**Why interviewer asks this:**
It tests knowledge of CPython internals and, more importantly, whether the candidate knows that `is` should not be used for value comparisons.

**Follow-up:** *Does Python do similar caching for strings? If so, under what conditions?*

---

### Q5: (Debugging) A developer wrote this function, but it crashes on certain inputs. Find and fix the bug.

```python
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)
```

**Answer:**

**Bug 1 — ZeroDivisionError:** If `numbers` is an empty list, `len(numbers)` is `0`.

**Bug 2 — TypeError:** If the list contains non-numeric values (e.g., `"abc"`), the `+=` will fail.

**Fixed version:**

```python
def calculate_average(numbers: list[int | float]) -> float:
    """Return the arithmetic mean of a list of numbers.

    Raises:
        ValueError: If the input list is empty.
        TypeError: If any element is not a number.
    """
    if not numbers:
        raise ValueError("Cannot compute average of an empty sequence")

    total = 0.0
    for num in numbers:
        if not isinstance(num, (int, float)):
            raise TypeError(f"Expected a number, got {type(num).__name__}: {num!r}")
        total += num

    return total / len(numbers)
```

**Production note:** In real projects you would often use `statistics.mean()` from the standard library, which already handles these edge cases and uses a more numerically stable algorithm (Kahan summation).

**Why interviewer asks this:**
Debugging questions reveal whether you think about edge cases proactively (empty inputs, wrong types, division by zero) — a critical skill for backend development.

**Follow-up:** *How would you make this function also handle an iterator (not just a list) that can only be consumed once?*

---

### Q6: What are truthy and falsy values in Python? Why do they matter?

**Answer:**

Every Python object can be evaluated in a boolean context. An object is **falsy** if `bool(obj)` returns `False`, and **truthy** otherwise.

**Falsy values (complete list):**

| Value              | Type          |
|--------------------|---------------|
| `False`            | `bool`        |
| `None`             | `NoneType`    |
| `0`                | `int`         |
| `0.0`              | `float`       |
| `0j`               | `complex`     |
| `""`               | `str`         |
| `[]`               | `list`        |
| `()`               | `tuple`       |
| `{}`               | `dict`        |
| `set()`            | `set`         |
| `range(0)`         | `range`       |
| `Decimal(0)`       | `Decimal`     |
| `Fraction(0, 1)`   | `Fraction`    |

Everything else is truthy.

```python
# Idiomatic Python — use truthiness directly
if users:          # Better than: if len(users) > 0
    process(users)

if not name:       # Better than: if name == ""
    name = "Anonymous"
```

**Trap — when `0` is a valid value:**

```python
def get_discount(discount=None):
    # Bug: this skips discount=0 because 0 is falsy
    if not discount:
        discount = 10

    # Fix: be explicit
    if discount is None:
        discount = 10
```

**Custom classes** can define truthiness by implementing `__bool__` (or `__len__` as a fallback):

```python
class Inventory:
    def __init__(self, items: list[str]):
        self.items = items

    def __bool__(self) -> bool:
        return len(self.items) > 0
```

**Why interviewer asks this:**
Writing idiomatic Python requires understanding truthiness. This question also exposes whether you know the subtle bugs that arise when `0`, `0.0`, or `""` are valid values.

**Follow-up:** *If a class defines both `__bool__` and `__len__`, which one takes priority?*

---

### Q7: Explain short-circuit evaluation with `and` and `or`. What do they actually return?

**Answer:**

Python's `and` and `or` do **not** return `True`/`False` — they return **one of their operands**.

| Expression    | Returns                                             |
|---------------|-----------------------------------------------------|
| `a and b`     | `a` if `a` is falsy, otherwise `b`                 |
| `a or b`      | `a` if `a` is truthy, otherwise `b`                |

```python
print(0 and "hello")       # 0       (0 is falsy, so return 0 immediately)
print(1 and "hello")       # "hello" (1 is truthy, so evaluate and return "hello")

print("" or "default")     # "default"  ("" is falsy, so evaluate "default")
print("value" or "default") # "value"   ("value" is truthy, return immediately)
```

**Practical pattern — default values:**

```python
# Common idiom: use `or` to provide a fallback
username = input_name or "Guest"
```

**Danger — when falsy values are legitimate:**

```python
count = 0
result = count or 100   # result is 100, but you wanted 0!

# Safer alternative
result = count if count is not None else 100
```

**Short-circuit for guarding:**

```python
# The second condition is only evaluated if the first is True
if user and user.is_active:
    grant_access(user)
```

**Why interviewer asks this:**
This tests understanding of how Python actually evaluates logical expressions, which is essential for writing concise and correct conditional logic.

**Follow-up:** *How does short-circuit evaluation interact with side effects? Give an example where it could cause a bug.*

---

## Section 2: Control Flow

---

### Q8: What does the `else` clause on a `for` loop do?

**Answer:**

The `else` block on a `for` (or `while`) loop executes **only if the loop completed without hitting a `break`** statement.

```python
def find_first_negative(numbers: list[int]) -> int | None:
    for num in numbers:
        if num < 0:
            print(f"Found negative: {num}")
            break
    else:
        # This runs ONLY if 'break' was never executed
        print("No negative numbers found")
        return None
    return num


find_first_negative([1, 2, 3])      # "No negative numbers found"
find_first_negative([1, -5, 3])     # "Found negative: -5"
```

**Mental model:** Think of it as `for...nobreak` rather than `for...else`.

**When is it useful?**
- Searching for an item and needing to handle the "not found" case.
- Validating that all items in a collection satisfy some condition.

**Why most developers avoid it:**
The semantics are unintuitive. Many style guides recommend using a flag variable or extracting the logic into a function that returns early, which is clearer to readers unfamiliar with this feature.

**Why interviewer asks this:**
It tests depth of Python knowledge. Most candidates only know `if/else`. Knowing `for/else` (and when *not* to use it) shows a well-rounded understanding.

**Follow-up:** *Does the `else` block execute if the loop body raises an exception?*

---

### Q9: (Coding) Write a function that returns a list of FizzBuzz results for numbers 1 through n.

**Answer:**

```python
def fizzbuzz(n: int) -> list[str]:
    """Return FizzBuzz results for numbers 1 through n.

    Rules:
        - Divisible by 3 and 5 -> "FizzBuzz"
        - Divisible by 3 only  -> "Fizz"
        - Divisible by 5 only  -> "Buzz"
        - Otherwise            -> the number as a string
    """
    results = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            results.append("FizzBuzz")
        elif i % 3 == 0:
            results.append("Fizz")
        elif i % 5 == 0:
            results.append("Buzz")
        else:
            results.append(str(i))
    return results


# Example
print(fizzbuzz(15))
# ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz',
#  '11', 'Fizz', '13', '14', 'FizzBuzz']
```

**Why `i % 15` instead of `i % 3 == 0 and i % 5 == 0`?**
Both are correct. Using `% 15` is slightly more concise and avoids two modulo operations, though the performance difference is negligible. The real advantage is readability — it makes the "divisible by both" case a single, clear check.

**Extensible version (open/closed principle):**

```python
def fizzbuzz_extensible(n: int, rules: list[tuple[int, str]] = None) -> list[str]:
    """A configurable FizzBuzz that supports arbitrary divisor-word pairs."""
    if rules is None:
        rules = [(3, "Fizz"), (5, "Buzz")]

    results = []
    for i in range(1, n + 1):
        output = ""
        for divisor, word in rules:
            if i % divisor == 0:
                output += word
        results.append(output or str(i))
    return results


# Now we can add new rules without changing existing code
print(fizzbuzz_extensible(105, rules=[(3, "Fizz"), (5, "Buzz"), (7, "Bazz")]))
```

**Why interviewer asks this:**
FizzBuzz is a baseline test. The interviewer is not looking for cleverness — they are checking that you can write clean, correct code under pressure and handle the edge cases (order of checks matters).

**Follow-up:** *How would you write this as a single list comprehension?*

---

### Q10: What is the walrus operator (`:=`) and when is it useful?

**Answer:**

Introduced in Python 3.8 (PEP 572), the walrus operator (`:=`) is an **assignment expression** — it assigns a value to a variable *and* returns that value, all in a single expression.

```python
# Without walrus — you must call the function twice or use a temp variable
data = input("Enter something: ")
while data != "quit":
    process(data)
    data = input("Enter something: ")

# With walrus — cleaner, no duplication
while (data := input("Enter something: ")) != "quit":
    process(data)
```

**Common use cases:**

```python
# 1. Filtering with a computed value
results = [
    cleaned
    for raw in data
    if (cleaned := raw.strip()) != ""
]

# 2. Regex matching
import re
if match := re.search(r"\d+", text):
    print(f"Found number: {match.group()}")

# 3. Reducing repeated expensive calls
if (n := len(items)) > 10:
    print(f"Too many items: {n}")
```

**When NOT to use it:**
- When it reduces readability. Do not chain multiple walrus operators in one line.
- In simple assignments where a regular `=` is perfectly clear.

**Why interviewer asks this:**
It tests awareness of modern Python features and, more importantly, the judgment to know *when* a feature improves code and when it makes it worse.

**Follow-up:** *Can you use `:=` inside a lambda? Why or why not?*

---

### Q11: What is structural pattern matching (`match`/`case`) and how does it differ from `if/elif` chains?

**Answer:**

Introduced in Python 3.10 (PEP 634), `match`/`case` is not just a switch statement — it is **structural pattern matching** that can destructure objects.

```python
def handle_command(command: str) -> str:
    match command.split():
        case ["quit"]:
            return "Exiting..."
        case ["go", direction]:
            return f"Moving {direction}"
        case ["pick", "up", item]:
            return f"Picked up {item}"
        case ["give", item, "to", recipient]:
            return f"Gave {item} to {recipient}"
        case _:
            return f"Unknown command: {command}"


print(handle_command("go north"))          # "Moving north"
print(handle_command("pick up sword"))     # "Picked up sword"
print(handle_command("give potion to bob")) # "Gave potion to bob"
```

**Key differences from `if/elif`:**

| Feature                  | `match/case`                       | `if/elif`              |
|--------------------------|------------------------------------|------------------------|
| Destructuring            | Built-in                           | Manual unpacking       |
| Type checking            | `case int(x):`                     | `isinstance()` calls   |
| Guard clauses            | `case x if x > 0:`                | Part of condition      |
| Readability for complex  | Often cleaner                      | Can get deeply nested  |

**When `if/elif` is still better:**
- Simple value comparisons with 2-3 branches.
- When your team's minimum Python version is below 3.10.

**Why interviewer asks this:**
Tests awareness of modern Python and the ability to evaluate when a new feature adds value versus unnecessary complexity.

**Follow-up:** *Can you use pattern matching to match against class instances? How?*

---

### Q12: (Debugging) This code causes an infinite loop. Identify and fix it.

```python
def remove_duplicates(items):
    i = 0
    while i < len(items):
        if items[i] in items[i + 1:]:
            items.remove(items[i])
        i += 1
    return items

print(remove_duplicates([1, 2, 3, 2, 1, 3]))
```

**Answer:**

**Bug:** When a duplicate is found and removed, the list shrinks by one element. But `i += 1` always executes, so the pointer skips over the element that shifted into position `i`. This can cause some duplicates to survive, and in certain arrangements, the logic may loop unpredictably because `items.remove()` removes the **first** occurrence, not the one at index `i`.

**Step-by-step with `[1, 2, 3, 2, 1, 3]`:**
1. `i=0`: `1` found later? Yes. `remove(1)` removes first `1`. List: `[2, 3, 2, 1, 3]`. `i` becomes `1`.
2. `i=1`: `3` found later? Yes. `remove(3)` removes first `3`. List: `[2, 2, 1, 3]`. `i` becomes `2`.
3. `i=2`: `1` found later? No. `i` becomes `3`.
4. `i=3`: `3` found later? No. Done. Result: `[2, 2, 1, 3]` — **duplicates remain!**

**Fix — do not increment `i` when an element is removed:**

```python
def remove_duplicates(items):
    i = 0
    while i < len(items):
        if items[i] in items[i + 1:]:
            items.remove(items[i])
            # Do NOT increment i — the next element shifted into this position
        else:
            i += 1
    return items

print(remove_duplicates([1, 2, 3, 2, 1, 3]))
# [2, 1, 3]
```

**Better approach — use a set to preserve order (Python 3.7+):**

```python
def remove_duplicates(items: list) -> list:
    return list(dict.fromkeys(items))

print(remove_duplicates([1, 2, 3, 2, 1, 3]))
# [1, 2, 3]
```

**Why interviewer asks this:**
Mutating a list while iterating over it is one of the most common beginner mistakes. The interviewer wants to see if you can trace execution carefully and know the clean alternative.

**Follow-up:** *What is the time complexity of each approach?*

---

### Q13: (Real-World) You are reading rows from a CSV file that may contain bad data. How do you process all valid rows while logging errors?

**Answer:**

```python
import csv
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def process_sales_csv(filepath: str) -> list[dict]:
    """Parse a sales CSV, skip malformed rows, return valid records."""
    valid_records = []
    errors = 0

    with open(filepath, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)

        for line_num, row in enumerate(reader, start=2):  # start=2: header is line 1
            try:
                record = {
                    "product": row["product"].strip(),
                    "quantity": int(row["quantity"]),
                    "price": float(row["price"]),
                }

                if record["quantity"] < 0:
                    raise ValueError("Quantity cannot be negative")
                if record["price"] < 0:
                    raise ValueError("Price cannot be negative")

                valid_records.append(record)

            except (ValueError, KeyError) as e:
                errors += 1
                logger.warning("Skipping row %d: %s | Raw data: %s", line_num, e, row)

    logger.info(
        "Processed %d valid records, skipped %d bad rows",
        len(valid_records),
        errors,
    )
    return valid_records
```

**Key design decisions:**
1. **Catch specific exceptions** (`ValueError`, `KeyError`), not bare `except`.
2. **Log the raw data** so you can investigate failures later.
3. **Track error count** for summary reporting.
4. **Continue processing** — one bad row should not kill the entire pipeline.

**Why interviewer asks this:**
Real backend work involves messy data. This tests whether you write defensive code and understand production concerns like logging, error isolation, and graceful degradation.

**Follow-up:** *How would you modify this to stop processing if the error rate exceeds 10%?*

---

## Section 3: Functions, Arguments and Recursion

---

### Q14: What happens when you use a mutable default argument in a function?

**Answer:**

This is one of Python's most famous gotchas. Default argument values are evaluated **once** — when the function is *defined*, not each time it is *called*.

```python
def append_to(item, target=[]):
    target.append(item)
    return target

print(append_to(1))   # [1]
print(append_to(2))   # [1, 2]  <-- NOT [2]!
print(append_to(3))   # [1, 2, 3]
```

The same list object is reused across all calls that do not provide a `target` argument.

**The fix — use `None` as sentinel:**

```python
def append_to(item: int, target: list[int] | None = None) -> list[int]:
    if target is None:
        target = []
    target.append(item)
    return target

print(append_to(1))   # [1]
print(append_to(2))   # [2]  -- correct!
```

**When the mutable default is *intentional*:**

A mutable default can be used as a simple cache/memoization hack:

```python
def fibonacci(n: int, cache: dict[int, int] = {}) -> int:
    if n in cache:
        return cache[n]
    if n < 2:
        return n
    cache[n] = fibonacci(n - 1, cache) + fibonacci(n - 2, cache)
    return cache[n]
```

This is a trick, not a best practice. Use `functools.lru_cache` instead.

**Why interviewer asks this:**
This is the single most commonly asked Python gotcha question. Getting it wrong in a real codebase can cause hard-to-trace bugs that only appear in production under repeated calls.

**Follow-up:** *Where can you see the current default values of a function's parameters at runtime?*

---

### Q15: Explain `*args` and `**kwargs`. When would you use each?

**Answer:**

| Syntax       | Collects                        | Type inside function |
|------------- |---------------------------------|---------------------|
| `*args`      | Positional arguments            | `tuple`             |
| `**kwargs`   | Keyword arguments               | `dict`              |

```python
def example(*args, **kwargs):
    print(f"args: {args}")       # tuple of positional args
    print(f"kwargs: {kwargs}")   # dict of keyword args

example(1, 2, 3, name="Alice", age=30)
# args: (1, 2, 3)
# kwargs: {'name': 'Alice', 'age': 30}
```

**Use cases:**

```python
# 1. Wrapper/decorator that passes through all arguments
import functools
import time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

# 2. Extending a parent class method
class CustomHTTPClient(BaseHTTPClient):
    def request(self, method, url, *args, **kwargs):
        kwargs.setdefault("timeout", 30)
        return super().request(method, url, *args, **kwargs)

# 3. Unpacking when calling a function
def create_user(name: str, age: int, role: str) -> dict:
    return {"name": name, "age": age, "role": role}

user_data = {"name": "Alice", "age": 30, "role": "admin"}
user = create_user(**user_data)
```

**Parameter order rules:**

```python
def func(positional, /, normal, *args, keyword_only, **kwargs):
    ...
# positional   -> positional-only (Python 3.8+)
# normal       -> positional or keyword
# *args        -> extra positional
# keyword_only -> keyword-only (after *)
# **kwargs     -> extra keyword
```

**Why interviewer asks this:**
This is fundamental to writing flexible APIs, decorators, and class hierarchies — all critical for FastAPI development.

**Follow-up:** *What is the purpose of the `/` separator in function parameters (PEP 570)?*

---

### Q16: What does it mean that functions are first-class objects in Python?

**Answer:**

In Python, functions are objects like any other. They can be:

```python
# 1. Assigned to variables
def greet(name):
    return f"Hello, {name}"

say_hello = greet
print(say_hello("Alice"))  # "Hello, Alice"


# 2. Stored in data structures
operations = {
    "add": lambda a, b: a + b,
    "sub": lambda a, b: a - b,
    "mul": lambda a, b: a * b,
}
print(operations["add"](10, 3))  # 13


# 3. Passed as arguments to other functions
def apply(func, value):
    return func(value)

print(apply(str.upper, "hello"))  # "HELLO"


# 4. Returned from other functions (closures)
def make_multiplier(factor: int):
    def multiplier(n: int) -> int:
        return n * factor
    return multiplier

double = make_multiplier(2)
triple = make_multiplier(3)
print(double(5))   # 10
print(triple(5))   # 15


# 5. Inspected — they have attributes
print(greet.__name__)       # "greet"
print(greet.__doc__)        # None (no docstring)
print(greet.__code__.co_varnames)  # ('name',)
```

**Why this matters for FastAPI:**
FastAPI's entire design is built on first-class functions — route handlers, dependency injection, and middleware all rely on passing functions as arguments.

**Why interviewer asks this:**
It tests whether you understand Python's object model deeply enough to work with decorators, callbacks, and functional patterns that are pervasive in modern Python frameworks.

**Follow-up:** *What is a closure, and what problem does it solve?*

---

### Q17: (Coding) Write a recursive function to flatten an arbitrarily nested list.

**Answer:**

```python
def flatten(nested: list) -> list:
    """Recursively flatten a nested list of arbitrary depth.

    >>> flatten([1, [2, [3, 4], 5], [6, 7]])
    [1, 2, 3, 4, 5, 6, 7]
    >>> flatten([])
    []
    >>> flatten([1, 2, 3])
    [1, 2, 3]
    """
    result = []
    for item in nested:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


# Test cases
print(flatten([1, [2, [3, [4, [5]]]]]))   # [1, 2, 3, 4, 5]
print(flatten([[], [1], [[2]]]))           # [1, 2]
print(flatten([1, "hello", [2, [3]]]))     # [1, "hello", 2, 3]
```

**Iterative version (avoids recursion limit for deeply nested lists):**

```python
def flatten_iterative(nested: list) -> list:
    """Flatten using an explicit stack to avoid recursion depth issues."""
    stack = list(reversed(nested))
    result = []
    while stack:
        item = stack.pop()
        if isinstance(item, list):
            stack.extend(reversed(item))
        else:
            result.append(item)
    return result
```

**Trade-offs:**

| Approach    | Pros                          | Cons                          |
|-------------|-------------------------------|-------------------------------|
| Recursive   | Clean, readable               | Hits recursion limit (~1000)  |
| Iterative   | Handles any depth             | Slightly less readable        |
| Generator   | Memory-efficient (lazy)       | Slightly more complex         |

**Why interviewer asks this:**
Recursion is a fundamental concept. This question tests whether you can write a correct base case, handle edge cases (empty lists, non-list items), and discuss alternatives.

**Follow-up:** *How would you modify this to also flatten tuples but not strings?*

---

### Q18: What is Python's recursion limit, and why doesn't Python optimize tail recursion?

**Answer:**

Python's default recursion limit is **1000** stack frames (check with `sys.getrecursionlimit()`).

```python
import sys
print(sys.getrecursionlimit())  # 1000

# You can increase it, but this is usually a sign of a design problem
sys.setrecursionlimit(5000)
```

**Why no tail-call optimization (TCO)?**

In languages like Scheme or Haskell, a tail-recursive call (the recursive call is the last operation) can reuse the current stack frame. Python **deliberately** does not do this for two reasons:

1. **Tracebacks:** Guido van Rossum prioritized clear stack traces for debugging. TCO destroys the call stack, making errors harder to diagnose.
2. **Python's dynamic nature:** Decorators, introspection, and the `sys._getframe()` API all depend on the call stack being fully intact.

**What to do instead of deep recursion:**

```python
# Instead of recursive factorial:
def factorial_recursive(n):
    if n <= 1:
        return 1
    return n * factorial_recursive(n - 1)  # Fails for n > ~998

# Use iteration:
def factorial_iterative(n: int) -> int:
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

# Or use math.factorial for production code
import math
print(math.factorial(10000))  # Works instantly
```

**Why interviewer asks this:**
It reveals whether you understand Python's design philosophy ("practicality beats purity") and whether you can choose the right tool — recursion for tree-like structures, iteration for linear ones.

**Follow-up:** *Can you convert any recursive algorithm to an iterative one? How?*

---

### Q19: Explain the LEGB rule in Python.

**Answer:**

When Python encounters a name, it searches for it in four scopes, in this order:

| Scope       | Description                               | Example                         |
|-------------|-------------------------------------------|---------------------------------|
| **L**ocal   | Inside the current function               | Variables defined in a function |
| **E**nclosing | In the enclosing function (closures)    | Outer function's variables      |
| **G**lobal  | Module-level names                        | Top-level variables             |
| **B**uilt-in | Python's built-in names                  | `print`, `len`, `range`         |

```python
x = "global"

def outer():
    x = "enclosing"

    def inner():
        x = "local"
        print(x)  # "local" — found in Local scope

    inner()

outer()
```

**Modifying outer scopes:**

```python
count = 0

def increment():
    global count       # Required to modify the global variable
    count += 1

def outer():
    total = 0

    def inner():
        nonlocal total  # Required to modify the enclosing variable
        total += 1

    inner()
    print(total)  # 1
```

**Common pitfall — UnboundLocalError:**

```python
x = 10

def broken():
    print(x)    # UnboundLocalError!
    x = 20      # This assignment makes 'x' local to the entire function

# Python sees the assignment `x = 20` and marks `x` as local
# at compile time, so the `print(x)` tries to read a local
# variable that hasn't been assigned yet.
```

**Why interviewer asks this:**
Scope bugs are subtle and common. Understanding LEGB is essential for closures, decorators, and callback-heavy patterns used in frameworks like FastAPI.

**Follow-up:** *What happens if you shadow a built-in name like `list` or `dict`? How do you recover?*

---

### Q20: When should you use `lambda` vs a named function?

**Answer:**

A `lambda` is an anonymous, single-expression function:

```python
# Lambda
square = lambda x: x ** 2

# Equivalent named function
def square(x):
    return x ** 2
```

**Use `lambda` when:**
- The function is trivial (one expression) and used only once.
- It is passed inline as an argument to higher-order functions.

```python
# Good use of lambda — simple sort key
students = [("Alice", 88), ("Bob", 95), ("Charlie", 82)]
students.sort(key=lambda s: s[1], reverse=True)

# Good use of lambda — quick filter
adults = list(filter(lambda user: user.age >= 18, users))
```

**Use a named function when:**
- The logic needs a docstring, multiple statements, or error handling.
- It is used in more than one place.
- You need a clear name for readability.

```python
# Bad lambda — too complex, hard to debug
transform = lambda x: x.strip().lower().replace(" ", "_") if x else "unknown"

# Better as a named function
def normalize_key(value: str | None) -> str:
    """Convert a string to a lowercase, underscore-separated key."""
    if not value:
        return "unknown"
    return value.strip().lower().replace(" ", "_")
```

**Technical limitations of lambdas:**
- Cannot contain statements (`if/else` expressions are fine, but `if:` blocks are not).
- Cannot have annotations/type hints.
- Harder to debug — tracebacks show `<lambda>` instead of a meaningful name.
- PEP 8 explicitly discourages assigning a lambda to a variable (`square = lambda x: ...`).

**Why interviewer asks this:**
This tests judgment. Overusing lambdas is a code smell. The interviewer wants to see that you know the tool and when *not* to use it.

**Follow-up:** *Can a lambda have default arguments? Can it use `*args` and `**kwargs`?*

---

## Section 4: Collections — List, Tuple, Set, Dict

---

### Q21: When would you choose a tuple over a list?

**Answer:**

| Criterion          | `list`                        | `tuple`                              |
|--------------------|-------------------------------|--------------------------------------|
| Mutability         | Mutable                       | Immutable                            |
| Use case           | Collection of similar items   | Fixed record of heterogeneous fields |
| Hashable           | No                            | Yes (if all elements are hashable)   |
| Performance        | Slightly slower creation      | Slightly faster creation             |
| Memory             | More overhead (over-allocates)| Less overhead (fixed size)           |

**Choose a tuple when:**

```python
# 1. Returning multiple values from a function
def get_coordinates() -> tuple[float, float]:
    return (40.7128, -74.0060)

# 2. Using as a dictionary key (lists cannot be keys)
location_cache: dict[tuple[float, float], str] = {
    (40.7128, -74.0060): "New York",
    (51.5074, -0.1278): "London",
}

# 3. Representing a fixed-structure record
# (consider using NamedTuple for clarity)
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float

p = Point(3.0, 4.0)
print(p.x, p.y)  # 3.0 4.0
```

**Memory comparison:**

```python
import sys
print(sys.getsizeof([1, 2, 3]))    # 120 bytes (on CPython 3.12)
print(sys.getsizeof((1, 2, 3)))    # 64 bytes
```

Lists over-allocate space to make `append()` amortized O(1). Tuples allocate exactly what they need.

**Why interviewer asks this:**
This tests understanding of immutability, hashability, and when to use the right data structure — a core skill for writing efficient and correct code.

**Follow-up:** *What is `NamedTuple` and when would you prefer it over a regular tuple or a `dataclass`?*

---

### Q22: Are Python dictionaries ordered?

**Answer:**

**Since Python 3.7** (CPython 3.6 as an implementation detail), dictionaries **maintain insertion order** as a language guarantee.

```python
d = {"b": 2, "a": 1, "c": 3}
print(list(d.keys()))   # ['b', 'a', 'c'] — insertion order preserved
```

**This does NOT mean dicts are sorted:**

```python
# Insertion order != sorted order
d = {"banana": 3, "apple": 1, "cherry": 2}
print(list(d))  # ['banana', 'apple', 'cherry']

# For sorted order, use sorted() or collections.OrderedDict
for key in sorted(d):
    print(key, d[key])
# apple 1
# banana 3
# cherry 2
```

**`OrderedDict` is still useful for:**
1. `move_to_end()` and `popitem(last=True/False)` methods.
2. Equality comparisons that care about order (`OrderedDict` considers order; `dict` does not):

```python
from collections import OrderedDict

d1 = {"a": 1, "b": 2}
d2 = {"b": 2, "a": 1}
print(d1 == d2)  # True — dict ignores order for equality

od1 = OrderedDict(a=1, b=2)
od2 = OrderedDict(b=2, a=1)
print(od1 == od2)  # False — OrderedDict cares about order
```

**Why interviewer asks this:**
Historically this was a common trap. The interviewer wants to confirm you know the current behavior AND the historical context, since legacy code and older Python versions still exist in production.

**Follow-up:** *What is the average time complexity for dict lookup, insertion, and deletion?*

---

### Q23: (Output-Based) What does this list comprehension produce?

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
result = [row[i] for i in range(3) for row in matrix]
print(result)
```

**Answer:**

```
[1, 4, 7, 2, 5, 8, 3, 6, 9]
```

**Explanation:**

The comprehension is equivalent to:

```python
result = []
for i in range(3):        # Outer loop: columns
    for row in matrix:    # Inner loop: rows
        result.append(row[i])
```

It reads **column by column** (transposing the matrix):
- `i=0`: `row[0]` for each row -> `1, 4, 7`
- `i=1`: `row[1]` for each row -> `2, 5, 8`
- `i=2`: `row[2]` for each row -> `3, 6, 9`

**If you wanted row-by-row flattening, reverse the loop order:**

```python
flat = [val for row in matrix for val in row]
# [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

**Proper matrix transpose:**

```python
transposed = list(zip(*matrix))
# [(1, 4, 7), (2, 5, 8), (3, 6, 9)]

# Or as list of lists:
transposed = [list(col) for col in zip(*matrix)]
# [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
```

**Why interviewer asks this:**
Nested comprehensions are a common source of confusion. This tests whether you can mentally unroll the loops in the correct order.

**Follow-up:** *When should you avoid list comprehensions in favor of regular loops?*

---

### Q24: What is the difference between shallow copy and deep copy?

**Answer:**

| Copy Type   | What it copies                     | Nested objects        |
|-------------|------------------------------------|-----------------------|
| Assignment  | Only the reference (alias)        | Same objects          |
| Shallow     | Creates new outer container       | Inner objects shared  |
| Deep        | Recursively copies everything     | All new objects       |

```python
import copy

original = [[1, 2], [3, 4]]

# Shallow copy — three equivalent ways
shallow = original.copy()        # list.copy()
shallow = list(original)         # constructor
shallow = original[:]            # slice

# Deep copy
deep = copy.deepcopy(original)

# Mutate a nested list
original[0].append(99)

print(original)   # [[1, 2, 99], [3, 4]]
print(shallow)    # [[1, 2, 99], [3, 4]]  <-- affected!
print(deep)       # [[1, 2], [3, 4]]      <-- independent
```

**Visual model:**

```
original  -->  [ ptr_A, ptr_B ]
                  |       |
                  v       v
               [1,2,99] [3,4]
                  ^
                  |
shallow   -->  [ ptr_A, ptr_B ]   (new list, same inner lists)

deep      -->  [ ptr_C, ptr_D ]   (new list, new inner lists)
                  |       |
                  v       v
               [1,2]    [3,4]
```

**When to use each:**
- **Shallow copy:** When the collection contains only immutable elements (ints, strings, tuples).
- **Deep copy:** When the collection contains mutable elements that you need to modify independently.

**Edge case — `deepcopy` handles circular references:**

```python
a = [1, 2]
a.append(a)        # Circular reference
b = copy.deepcopy(a)  # Works correctly — deepcopy tracks seen objects
```

**Why interviewer asks this:**
This is one of the most common sources of bugs in Python. Modifying a "copy" that turns out to be a shallow copy can corrupt shared state across your application.

**Follow-up:** *How does `copy.deepcopy` handle objects with custom `__init__` methods?*

---

### Q25: (Real-World) Given two large lists of user IDs, find users who exist in both lists efficiently.

**Answer:**

```python
# Naive approach — O(n * m) time
def common_users_naive(list_a: list[int], list_b: list[int]) -> list[int]:
    return [uid for uid in list_a if uid in list_b]

# Efficient approach — O(n + m) time
def common_users(list_a: list[int], list_b: list[int]) -> set[int]:
    """Return user IDs that appear in both lists.

    Uses set intersection for O(n + m) average time complexity.
    """
    return set(list_a) & set(list_b)


# Example with realistic data
active_users = [101, 202, 303, 404, 505, 606]
premium_users = [202, 404, 707, 808]

overlap = common_users(active_users, premium_users)
print(overlap)  # {202, 404}
```

**Performance comparison:**

| Approach        | Time Complexity | 1M items each |
|-----------------|-----------------|---------------|
| Nested loop     | O(n * m)        | ~minutes      |
| Set intersection| O(n + m)        | ~milliseconds |

**If you need to preserve order:**

```python
def common_users_ordered(list_a: list[int], list_b: list[int]) -> list[int]:
    """Return common users in the order they appear in list_a."""
    set_b = set(list_b)
    return [uid for uid in list_a if uid in set_b]
```

**Why interviewer asks this:**
This is a practical data engineering question. The interviewer wants to see if you instinctively reach for the right data structure (set) and understand the time complexity implications.

**Follow-up:** *What if you also need to find users in `list_a` but not in `list_b`? What set operation would you use?*

---

### Q26: Explain `defaultdict` and `Counter`. When are they better than plain dicts?

**Answer:**

Both are in `collections` and solve common patterns more cleanly than manual dictionary code.

**`defaultdict` — auto-initializes missing keys:**

```python
from collections import defaultdict

# Without defaultdict — verbose and error-prone
word_groups = {}
words = ["apple", "banana", "avocado", "blueberry", "cherry", "apricot"]
for word in words:
    first_letter = word[0]
    if first_letter not in word_groups:
        word_groups[first_letter] = []
    word_groups[first_letter].append(word)

# With defaultdict — clean
word_groups = defaultdict(list)
for word in words:
    word_groups[word[0]].append(word)

print(dict(word_groups))
# {'a': ['apple', 'avocado', 'apricot'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
```

**`Counter` — count occurrences:**

```python
from collections import Counter

inventory = ["apple", "banana", "apple", "cherry", "banana", "apple"]
counts = Counter(inventory)

print(counts)                    # Counter({'apple': 3, 'banana': 2, 'cherry': 1})
print(counts.most_common(2))     # [('apple', 3), ('banana', 2)]
print(counts["apple"])           # 3
print(counts["mango"])           # 0 (no KeyError!)

# Arithmetic with Counters
store_a = Counter(apple=5, banana=3)
store_b = Counter(apple=2, cherry=7)

combined = store_a + store_b     # Counter({'cherry': 7, 'apple': 7, 'banana': 3})
diff = store_a - store_b         # Counter({'banana': 3, 'apple': 3}) — drops zero/negative
```

**When to use which:**

| Need                              | Use                    |
|-----------------------------------|------------------------|
| Group items by key                | `defaultdict(list)`    |
| Sum values by key                 | `defaultdict(int)`     |
| Count occurrences                 | `Counter`              |
| Nested grouping                   | `defaultdict(lambda: defaultdict(list))` |
| Simple key-value, no defaults     | Plain `dict`           |

**Why interviewer asks this:**
Using the right data structure from `collections` is a sign of an experienced Python developer. It leads to cleaner, faster, more readable code.

**Follow-up:** *What is `Counter.elements()` and what does it return?*

---

### Q27: (Debugging) A junior developer is trying to merge two config dicts, but the result is wrong. Find the issue.

```python
default_config = {
    "database": {
        "host": "localhost",
        "port": 5432,
    },
    "debug": False,
}

user_config = {
    "database": {
        "port": 3306,
    },
    "debug": True,
}

# Attempt to merge
merged = {**default_config, **user_config}
print(merged)
```

**Answer:**

**Output:**

```python
{
    "database": {"port": 3306},  # "host" is GONE!
    "debug": True,
}
```

**Bug:** The `{**a, **b}` merge is **shallow**. When both dicts have the same key (`"database"`), the value from `user_config` completely **replaces** the value from `default_config` instead of merging the nested dicts.

**Fix — recursive (deep) merge:**

```python
def deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base, returning a new dict.

    Values in override take precedence. Nested dicts are merged,
    not replaced.
    """
    merged = base.copy()
    for key, value in override.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


merged = deep_merge(default_config, user_config)
print(merged)
# {
#     "database": {"host": "localhost", "port": 3306},
#     "debug": True,
# }
```

**Production alternative:** Use a library like `pydantic` (which FastAPI uses) for configuration management, where nested models handle merging and validation automatically.

**Why interviewer asks this:**
Shallow vs deep merge is a real production bug that hits every team working with configuration files, API payloads, or ORM defaults. Spotting it quickly shows practical experience.

**Follow-up:** *What does the `|` operator do with dicts in Python 3.9+? Does it solve this problem?*

---

## Section 5: Basic OOP — Classes, Objects, Methods

---

### Q28: What is `__init__` and why does every method take `self` as the first parameter?

**Answer:**

**`__init__`** is the **initializer** (not constructor) method. It is called automatically after an object is created to set up its initial state.

```python
class User:
    def __init__(self, name: str, email: str) -> None:
        self.name = name      # Instance attribute
        self.email = email    # Instance attribute

    def greet(self) -> str:
        return f"Hi, I'm {self.name} ({self.email})"


alice = User("Alice", "alice@example.com")
print(alice.greet())  # "Hi, I'm Alice (alice@example.com)"
```

**Why `self` is explicit:**

Python passes the instance explicitly as the first argument to every method. When you call `alice.greet()`, Python translates it to `User.greet(alice)`.

```python
# These two calls are equivalent
alice.greet()
User.greet(alice)
```

This is a deliberate design choice (Zen of Python: "Explicit is better than implicit"). Benefits:
1. Makes it clear which variables are instance attributes vs local.
2. Enables decorators like `@classmethod` and `@staticmethod` to change what the first argument is.
3. Avoids the ambiguity that `this` causes in languages like JavaScript.

**`__init__` vs `__new__`:**

| Method     | Purpose                              | When called           |
|------------|--------------------------------------|-----------------------|
| `__new__`  | Creates the instance (constructor)   | Before `__init__`     |
| `__init__` | Initializes the instance             | After `__new__`       |

You rarely override `__new__` unless you are working with immutables or implementing a singleton.

**Why interviewer asks this:**
This is the most basic OOP question. Getting the terminology right (`__init__` is not the constructor) and understanding explicit `self` shows foundational knowledge.

**Follow-up:** *What is `__new__` and when would you need to override it?*

---

### Q29: What is the difference between class variables and instance variables?

**Answer:**

| Type              | Defined               | Shared across instances? | Accessed via            |
|-------------------|-----------------------|--------------------------|-------------------------|
| Class variable    | Inside class body     | Yes                      | `ClassName.var` or `self.var` |
| Instance variable | Inside `__init__` (via `self`) | No — each instance has its own | `self.var` |

```python
class Employee:
    company = "Acme Corp"          # Class variable — shared by ALL instances
    employee_count = 0             # Class variable — tracks total count

    def __init__(self, name: str, salary: float) -> None:
        self.name = name           # Instance variable — unique per object
        self.salary = salary       # Instance variable — unique per object
        Employee.employee_count += 1


e1 = Employee("Alice", 90000)
e2 = Employee("Bob", 85000)

print(Employee.employee_count)     # 2
print(e1.company)                  # "Acme Corp" (reads class variable)
print(e2.company)                  # "Acme Corp" (same class variable)

# Danger: assignment through an instance creates a NEW instance variable
e1.company = "NewCo"
print(e1.company)                  # "NewCo"     (instance variable shadows class variable)
print(e2.company)                  # "Acme Corp" (still reading class variable)
print(Employee.company)            # "Acme Corp" (class variable unchanged)
```

**The mutable class variable trap:**

```python
class BadTeam:
    members = []  # Class variable — shared!

    def add_member(self, name: str) -> None:
        self.members.append(name)

team_a = BadTeam()
team_b = BadTeam()
team_a.add_member("Alice")
print(team_b.members)  # ["Alice"] — oops, team_b is affected!
```

**Fix:**

```python
class GoodTeam:
    def __init__(self) -> None:
        self.members = []  # Instance variable — each team has its own list
```

**Why interviewer asks this:**
The class-variable-as-mutable-default is a production bug that catches many developers. Understanding the lookup chain (instance -> class -> parent classes) is essential for correct OOP.

**Follow-up:** *How would you make `employee_count` thread-safe in a multi-threaded application?*

---

### Q30: (Coding) Design a `BankAccount` class with deposit, withdraw, and balance checking.

**Answer:**

```python
class InsufficientFundsError(Exception):
    """Raised when a withdrawal exceeds the available balance."""


class BankAccount:
    """A simple bank account with deposit, withdrawal, and balance history.

    Attributes:
        owner: Name of the account holder.
        balance: Current account balance.
    """

    def __init__(self, owner: str, initial_balance: float = 0.0) -> None:
        if initial_balance < 0:
            raise ValueError("Initial balance cannot be negative")
        self.owner = owner
        self._balance = initial_balance
        self._transactions: list[str] = []

    @property
    def balance(self) -> float:
        """Read-only access to balance — prevents direct modification."""
        return self._balance

    def deposit(self, amount: float) -> float:
        """Deposit funds into the account.

        Args:
            amount: The amount to deposit (must be positive).

        Returns:
            The new balance after deposit.

        Raises:
            ValueError: If amount is not positive.
        """
        if amount <= 0:
            raise ValueError(f"Deposit amount must be positive, got {amount}")

        self._balance += amount
        self._transactions.append(f"+{amount:.2f}")
        return self._balance

    def withdraw(self, amount: float) -> float:
        """Withdraw funds from the account.

        Args:
            amount: The amount to withdraw (must be positive).

        Returns:
            The new balance after withdrawal.

        Raises:
            ValueError: If amount is not positive.
            InsufficientFundsError: If balance is too low.
        """
        if amount <= 0:
            raise ValueError(f"Withdrawal amount must be positive, got {amount}")
        if amount > self._balance:
            raise InsufficientFundsError(
                f"Cannot withdraw {amount:.2f}: balance is {self._balance:.2f}"
            )

        self._balance -= amount
        self._transactions.append(f"-{amount:.2f}")
        return self._balance

    def get_statement(self) -> str:
        """Return a formatted transaction history."""
        lines = [f"Account Statement for {self.owner}"]
        lines.append("-" * 40)
        for txn in self._transactions:
            lines.append(txn)
        lines.append("-" * 40)
        lines.append(f"Current Balance: {self._balance:.2f}")
        return "\n".join(lines)

    def __repr__(self) -> str:
        return f"BankAccount(owner={self.owner!r}, balance={self._balance:.2f})"

    def __str__(self) -> str:
        return f"{self.owner}'s Account: ${self._balance:,.2f}"


# Usage
account = BankAccount("Alice", 1000.0)
account.deposit(500)
account.withdraw(200)
print(account)                    # Alice's Account: $1,300.00
print(account.balance)            # 1300.0
print(account.get_statement())

# Error handling
try:
    account.withdraw(5000)
except InsufficientFundsError as e:
    print(e)  # "Cannot withdraw 5000.00: balance is 1300.00"
```

**Design decisions worth discussing in an interview:**

1. **`_balance` with `@property`**: Prevents direct assignment like `account.balance = 999999`.
2. **Custom exception**: `InsufficientFundsError` is more meaningful than a generic `ValueError`.
3. **Input validation**: Every public method validates its inputs.
4. **Transaction log**: Keeps an audit trail — essential for any financial system.
5. **Both `__str__` and `__repr__`**: User-friendly display and developer-friendly debugging.

**Why interviewer asks this:**
This is a classic OOP design question. The interviewer evaluates encapsulation, error handling, clean API design, and whether you think about real-world concerns.

**Follow-up:** *How would you add support for transferring funds between two accounts atomically?*

---

### Q31: What is the difference between `__str__` and `__repr__`?

**Answer:**

| Method     | Audience    | Goal                                  | Called by             |
|------------|-------------|---------------------------------------|-----------------------|
| `__repr__` | Developers  | Unambiguous, ideally eval-able string | `repr()`, REPL, logs  |
| `__str__`  | End users   | Human-readable, friendly string       | `str()`, `print()`, f-strings |

```python
import datetime

d = datetime.date(2026, 3, 26)
print(repr(d))   # datetime.date(2026, 3, 26)  — can recreate the object
print(str(d))    # 2026-03-26                   — human-friendly
```

**Implementation guidelines:**

```python
class Temperature:
    def __init__(self, celsius: float) -> None:
        self.celsius = celsius

    def __repr__(self) -> str:
        # Unambiguous — ideally you could copy-paste this to recreate the object
        return f"Temperature(celsius={self.celsius!r})"

    def __str__(self) -> str:
        # User-friendly
        return f"{self.celsius:.1f} C"


t = Temperature(36.6)
print(repr(t))  # Temperature(celsius=36.6)
print(str(t))   # 36.6 C
print(t)        # 36.6 C  (print calls __str__)
print([t])      # [Temperature(celsius=36.6)]  (containers use __repr__ for elements)
```

**Fallback behavior:**
- If `__str__` is not defined, Python falls back to `__repr__`.
- If `__repr__` is not defined, Python uses the default `<ClassName object at 0x...>`.

**Rule of thumb:**
- Always implement `__repr__`. It is used in debugging, logging, and the REPL.
- Implement `__str__` only when you need a different, user-facing representation.

**Why interviewer asks this:**
This tests understanding of Python's data model (dunder methods). The distinction matters for debugging, logging, and API response serialization.

**Follow-up:** *What does the `!r` format specifier do in f-strings?*

---

### Q32: Explain inheritance and Method Resolution Order (MRO) in Python.

**Answer:**

Inheritance allows a class to reuse and extend the behavior of a parent class.

```python
class Animal:
    def __init__(self, name: str) -> None:
        self.name = name

    def speak(self) -> str:
        raise NotImplementedError("Subclasses must implement speak()")

    def __repr__(self) -> str:
        return f"{type(self).__name__}(name={self.name!r})"


class Dog(Animal):
    def speak(self) -> str:
        return f"{self.name} says Woof!"


class Cat(Animal):
    def speak(self) -> str:
        return f"{self.name} says Meow!"


dog = Dog("Rex")
print(dog.speak())  # "Rex says Woof!"
print(repr(dog))    # "Dog(name='Rex')"  — inherited from Animal
```

**Method Resolution Order (MRO):**

When you call a method, Python searches the class hierarchy using the **C3 Linearization** algorithm:

```python
class A:
    def greet(self):
        return "A"

class B(A):
    def greet(self):
        return "B"

class C(A):
    def greet(self):
        return "C"

class D(B, C):
    pass

print(D().greet())  # "B"

# View the MRO
print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>)
```

Python searches: `D` -> `B` -> `C` -> `A` -> `object`. It finds `greet` in `B` and stops.

**`super()` follows the MRO, not just the parent:**

```python
class A:
    def __init__(self):
        print("A.__init__")

class B(A):
    def __init__(self):
        print("B.__init__")
        super().__init__()      # Calls next in MRO, not necessarily A

class C(A):
    def __init__(self):
        print("C.__init__")
        super().__init__()

class D(B, C):
    def __init__(self):
        print("D.__init__")
        super().__init__()

D()
# Output:
# D.__init__
# B.__init__
# C.__init__     <-- super() in B calls C, not A!
# A.__init__
```

**The Diamond Problem and why MRO matters:**

Without C3 linearization, `A.__init__` could be called multiple times in a diamond hierarchy. The MRO ensures every class is called exactly once.

**Best practice — always use `super()`:**

```python
class Dog(Animal):
    def __init__(self, name: str, breed: str) -> None:
        super().__init__(name)   # Do NOT use Animal.__init__(self, name)
        self.breed = breed
```

Using `super()` ensures correct behavior in multiple inheritance scenarios.

**Why interviewer asks this:**
MRO is critical for understanding how frameworks (Django, FastAPI, SQLAlchemy) use mixins and multiple inheritance. Debugging issues in complex class hierarchies requires knowing the MRO.

**Follow-up:** *What is the difference between `ABC` (Abstract Base Class) and just raising `NotImplementedError` in the base class?*

---

## Quick Reference Cheat Sheet

```python
# ---- Data Types ----
type(42)                    # <class 'int'>
isinstance(42, (int, float)) # True — check against multiple types

# ---- String Formatting (prefer f-strings) ----
name, age = "Alice", 30
f"{name!r} is {age:03d}"   # "'Alice' is 030"

# ---- Ternary Expression ----
status = "adult" if age >= 18 else "minor"

# ---- Unpacking ----
a, *rest, z = [1, 2, 3, 4, 5]   # a=1, rest=[2,3,4], z=5

# ---- Dictionary Patterns ----
d = {"a": 1, "b": 2}
d.get("c", 0)              # 0 — no KeyError
d.setdefault("c", 0)       # Sets and returns 0
d | {"c": 3}               # {'a': 1, 'b': 2, 'c': 3}  (Python 3.9+)

# ---- Comprehensions ----
squares = [x**2 for x in range(10)]                  # List
unique   = {x % 3 for x in range(10)}                # Set
mapped   = {x: x**2 for x in range(5)}               # Dict
lazy     = (x**2 for x in range(10))                  # Generator

# ---- Useful Built-ins ----
enumerate(items, start=1)   # Index + value
zip(names, scores)          # Pair up two iterables
zip(*matrix)                # Transpose
all([True, True, False])    # False
any([False, False, True])   # True
sorted(items, key=len)      # Sort by length

# ---- Common collections ----
from collections import defaultdict, Counter, namedtuple, deque
from dataclasses import dataclass

# ---- OOP Quick Patterns ----
class MyClass:
    class_var = "shared"

    def __init__(self): ...           # Initializer
    def method(self): ...             # Instance method
    @classmethod
    def from_string(cls, s): ...      # Alternative constructor
    @staticmethod
    def validate(x): ...              # No access to cls or self
    @property
    def value(self): ...              # Computed attribute (getter)
```

---

> **Next in the series:** [Part 2/7 — Intermediate Python](./02-intermediate-python.md) covering decorators, generators, context managers, error handling, file I/O, and modules/packages.

---

*This guide is part of a 7-part Python + FastAPI interview preparation series. Star the repo if you find it helpful.*
