# Advanced Python - Interview Preparation (Part 3/7)

> **Series:** Python + FastAPI Interview Prep
> **Level:** Advanced
> **Prerequisites:** Parts 1 (Python Fundamentals) and 2 (Intermediate Python)
> **Estimated Study Time:** 8–10 hours

---

## Table of Contents

1. [Deep OOP (Inheritance, MRO, Metaclasses, Descriptors)](#section-1-deep-oop)
2. [Generators & Iterators](#section-2-generators--iterators)
3. [Advanced Decorators](#section-3-advanced-decorators)
4. [Context Managers](#section-4-context-managers)
5. [Multithreading vs Multiprocessing](#section-5-multithreading-vs-multiprocessing)
6. [Async Programming](#section-6-async-programming)
7. [GIL & Memory Management](#section-7-gil--memory-management)

---

## Section 1: Deep OOP

### Q1: Explain Python's Method Resolution Order (MRO) and how C3 linearization works. What problem does it solve?

**Answer:**

MRO determines the order in which base classes are searched when looking up a method. Python uses the **C3 linearization** algorithm (since Python 2.3) to compute this order. It solves the **diamond problem** - the ambiguity that arises when a class inherits from two classes that share a common ancestor.

```python
class A:
    def greet(self):
        return "Hello from A"

class B(A):
    def greet(self):
        return "Hello from B"

class C(A):
    def greet(self):
        return "Hello from C"

class D(B, C):
    pass

# Inspect the MRO
print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>)

d = D()
print(d.greet())  # "Hello from B"
```

**C3 linearization rules:**
1. The class itself comes first.
2. Then the linearization of its parents, in the order they are listed.
3. A class only appears once; if it appears in multiple inheritance chains, it is deferred until all its subclasses (in the current hierarchy) have appeared.

```python
# C3 will reject inconsistent hierarchies:
class X:
    pass

class Y(X):
    pass

# This raises TypeError - inconsistent MRO
# class Z(X, Y):
#     pass
# TypeError: Cannot create a consistent method resolution order (MRO)
#            for bases X, Y

# Correct ordering:
class Z(Y, X):  # Y before X, since Y is a subclass of X
    pass

print(Z.__mro__)
# (<class 'Z'>, <class 'Y'>, <class 'X'>, <class 'object'>)
```

**Key insight:** `super()` follows the MRO, not the direct parent. This is critical for cooperative multiple inheritance.

```python
class Base:
    def __init__(self):
        print("Base.__init__")

class Left(Base):
    def __init__(self):
        print("Left.__init__")
        super().__init__()  # Calls Right.__init__, NOT Base.__init__

class Right(Base):
    def __init__(self):
        print("Right.__init__")
        super().__init__()

class Child(Left, Right):
    def __init__(self):
        print("Child.__init__")
        super().__init__()

Child()
# Output:
# Child.__init__
# Left.__init__
# Right.__init__
# Base.__init__
```

**Why interviewer asks this:** MRO understanding is essential for debugging complex inheritance hierarchies in frameworks like Django (models, views, mixins). Misunderstanding `super()` in multiple inheritance is one of the most common sources of subtle bugs.

**Follow-up:** How would you design a mixin system where order of mixins matters, and what safeguards would you put in place to prevent MRO conflicts?

---

### Q2: What are metaclasses in Python? Implement a metaclass that enforces an interface contract.

**Answer:**

A metaclass is the "class of a class." When you write `class Foo:`, Python calls the metaclass (default: `type`) to create the class object. Metaclasses let you intercept and customize class creation.

```python
# The relationship: isinstance(obj, MyClass) and isinstance(MyClass, type)
# type is the default metaclass: type("Foo", (object,), {}) == class Foo: pass

class InterfaceEnforcer(type):
    """
    Metaclass that ensures all concrete subclasses implement
    required methods defined in _required_methods.
    """

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)

        # Skip enforcement for the abstract base itself
        if bases and hasattr(cls, "_required_methods"):
            missing = []
            for method_name in cls._required_methods:
                method = getattr(cls, method_name, None)
                if method is None or getattr(method, "__isabstractmethod__", False):
                    missing.append(method_name)

            if missing:
                raise TypeError(
                    f"Class '{name}' must implement: {', '.join(missing)}"
                )
        return cls


class Repository(metaclass=InterfaceEnforcer):
    _required_methods = ["save", "find_by_id", "delete"]

    def save(self, entity):
        raise NotImplementedError

    def find_by_id(self, entity_id):
        raise NotImplementedError

    def delete(self, entity_id):
        raise NotImplementedError


# This works - all methods are implemented
class UserRepository(Repository):
    def save(self, entity):
        return f"Saved {entity}"

    def find_by_id(self, entity_id):
        return f"Found {entity_id}"

    def delete(self, entity_id):
        return f"Deleted {entity_id}"


# This raises TypeError at class DEFINITION time (not at instantiation)
# class BrokenRepository(Repository):
#     def save(self, entity):
#         return f"Saved {entity}"
#     # Missing find_by_id and delete
# TypeError: Class 'BrokenRepository' must implement: find_by_id, delete
```

**When metaclasses are overkill** - prefer these alternatives first:
1. `abc.ABC` and `@abstractmethod` (catches at instantiation, not class definition)
2. Class decorators (simpler to reason about)
3. `__init_subclass__` (Python 3.6+ - lighter weight)

```python
# __init_subclass__ - the modern, lightweight alternative
class Plugin:
    _registry: dict[str, type] = {}

    def __init_subclass__(cls, plugin_name: str = None, **kwargs):
        super().__init_subclass__(**kwargs)
        name = plugin_name or cls.__name__.lower()
        Plugin._registry[name] = cls
        print(f"Registered plugin: {name}")


class AuthPlugin(Plugin, plugin_name="auth"):
    pass

class CachePlugin(Plugin, plugin_name="cache"):
    pass

print(Plugin._registry)
# {'auth': <class 'AuthPlugin'>, 'cache': <class 'CachePlugin'>}
```

**Why interviewer asks this:** Metaclasses appear in ORMs (Django models, SQLAlchemy declarative), serialization frameworks, and plugin architectures. Understanding them signals deep Python knowledge, but knowing when NOT to use them signals engineering maturity.

**Follow-up:** Django's `Model` class uses a metaclass. Can you explain how `ModelBase` works at a high level and why Django chose a metaclass over simpler alternatives?

---

### Q3: Explain `__slots__` - when should you use it and what are the trade-offs?

**Answer:**

By default, Python objects store attributes in a `__dict__` dictionary. `__slots__` replaces this with a fixed-size struct, eliminating the per-instance dictionary.

```python
import sys

class WithDict:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

class WithSlots:
    __slots__ = ("x", "y", "z")

    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z


obj_dict = WithDict(1, 2, 3)
obj_slots = WithSlots(1, 2, 3)

print(sys.getsizeof(obj_dict) + sys.getsizeof(obj_dict.__dict__))
# ~200 bytes (varies by Python version)
print(sys.getsizeof(obj_slots))
# ~72 bytes

# Slots objects have no __dict__
print(hasattr(obj_slots, "__dict__"))  # False

# Cannot add arbitrary attributes
# obj_slots.w = 4  # AttributeError: 'WithSlots' object has no attribute 'w'
```

**Trade-offs:**

| Advantage | Disadvantage |
|---|---|
| ~40-50% less memory per instance | No dynamic attribute assignment |
| Slightly faster attribute access | No `__dict__` (breaks some serialization) |
| Prevents typos in attribute names | Inheritance requires care - subclass must also define `__slots__` |
| Useful for millions of instances | Cannot use with multiple inheritance if both parents have non-empty `__slots__` (layout conflict) |

**Critical inheritance pitfall:**

```python
class Base:
    __slots__ = ("x",)

class Child(Base):
    # If you forget __slots__ here, Child gets a __dict__ anyway,
    # negating the memory savings.
    __slots__ = ("y",)  # Only NEW attributes; do NOT repeat "x"

class BrokenChild(Base):
    pass  # Has __dict__ - memory savings lost

print(hasattr(BrokenChild("val"), "__dict__"))  # True
```

**Real-world use case:** Data-heavy applications (e.g., processing millions of records, game entities, scientific computing) where each object's shape is known at class definition time.

**Why interviewer asks this:** Tests understanding of Python's object model internals and ability to make performance-aware decisions. In production systems handling high-volume data, `__slots__` can dramatically reduce memory footprint.

**Follow-up:** How does `__slots__` interact with `dataclasses`? Can you use both? What about `__weakref__`?

---

### Q4: Implement the descriptor protocol to create a type-validated attribute.

**Answer:**

Descriptors are objects that define `__get__`, `__set__`, and/or `__delete__`. They power `property`, `classmethod`, `staticmethod`, and ORM fields under the hood.

```python
from typing import Any


class TypeChecked:
    """
    A data descriptor that enforces type checking on assignment.
    This is the same pattern used by ORMs and validation frameworks.
    """

    def __init__(self, expected_type: type, *, nullable: bool = False):
        self.expected_type = expected_type
        self.nullable = nullable
        self.attr_name = None  # Set by __set_name__

    def __set_name__(self, owner: type, name: str) -> None:
        """Called automatically when the descriptor is assigned to a class attribute."""
        self.attr_name = name
        self.storage_name = f"_typechecked_{name}"

    def __get__(self, obj: Any, objtype: type = None) -> Any:
        if obj is None:
            return self  # Accessed from the class, return the descriptor itself
        return getattr(obj, self.storage_name, None)

    def __set__(self, obj: Any, value: Any) -> None:
        if value is None and self.nullable:
            setattr(obj, self.storage_name, None)
            return
        if not isinstance(value, self.expected_type):
            raise TypeError(
                f"'{self.attr_name}' must be {self.expected_type.__name__}, "
                f"got {type(value).__name__}"
            )
        setattr(obj, self.storage_name, value)

    def __delete__(self, obj: Any) -> None:
        try:
            delattr(obj, self.storage_name)
        except AttributeError:
            raise AttributeError(
                f"'{type(obj).__name__}' object has no attribute '{self.attr_name}'"
            )


class User:
    name = TypeChecked(str)
    age = TypeChecked(int)
    email = TypeChecked(str, nullable=True)

    def __init__(self, name: str, age: int, email: str = None):
        self.name = name
        self.age = age
        self.email = email


# Usage
user = User("Alice", 30, "alice@example.com")
print(user.name)   # "Alice"
print(user.age)    # 30

# user.age = "thirty"
# TypeError: 'age' must be int, got str

user.email = None  # OK - nullable=True
# user.name = None
# TypeError: 'name' must be str, got NoneType
```

**Descriptor lookup order:**
1. Data descriptors (define `__set__` or `__delete__`) take priority over instance `__dict__`.
2. Instance `__dict__` takes priority over non-data descriptors (only `__get__`).
3. Non-data descriptors come last.

```python
# Demonstrating lookup precedence
class NonDataDescriptor:
    """Only defines __get__ - instance dict wins."""
    def __get__(self, obj, objtype=None):
        return "from descriptor"

class DataDescriptor:
    """Defines __get__ and __set__ - descriptor wins."""
    def __get__(self, obj, objtype=None):
        return "from descriptor"
    def __set__(self, obj, value):
        pass  # Intercepts all sets

class Demo:
    non_data = NonDataDescriptor()
    data = DataDescriptor()

d = Demo()
d.__dict__["non_data"] = "from instance"
d.__dict__["data"] = "from instance"

print(d.non_data)  # "from instance"   (instance dict wins)
print(d.data)      # "from descriptor" (data descriptor wins)
```

**Why interviewer asks this:** Descriptors are foundational to Python's object model. Understanding them explains how `@property`, Django model fields, SQLAlchemy columns, and Pydantic validators all work internally.

**Follow-up:** How would you extend this descriptor to support validators (e.g., `min_length`, `max_value`) in a composable way?

---

### Q5: (Output-Based) What does this code print, and why?

```python
class Meta(type):
    def __call__(cls, *args, **kwargs):
        print(f"Meta.__call__ for {cls.__name__}")
        instance = super().__call__(*args, **kwargs)
        print(f"Instance created: {type(instance).__name__}")
        return instance

class Base(metaclass=Meta):
    def __new__(cls, *args, **kwargs):
        print(f"Base.__new__")
        return super().__new__(cls)

    def __init__(self):
        print(f"Base.__init__")

class Child(Base):
    def __init__(self):
        print(f"Child.__init__")
        super().__init__()

obj = Child()
print(type(obj))
```

**Answer:**

```
Meta.__call__ for Child
Base.__new__
Child.__init__
Base.__init__
Instance created: Child
<class '__main__.Child'>
```

**Explanation of the full object creation sequence:**

1. `Child()` invokes `Meta.__call__(Child)` because `Child`'s metaclass is `Meta`.
2. Inside `Meta.__call__`, `super().__call__()` calls `type.__call__()`, which orchestrates:
   - First: `Child.__new__(Child)` - but `Child` does not define `__new__`, so it falls to `Base.__new__`.
   - Then: `Child.__init__(instance)` - which calls `super().__init__()`, hitting `Base.__init__`.
3. Control returns to `Meta.__call__`, which prints the "Instance created" message.
4. `type(obj)` confirms it is a `Child` instance.

**Why interviewer asks this:** This tests deep understanding of the full object lifecycle - from metaclass to `__new__` to `__init__`. It separates candidates who memorize syntax from those who understand Python's object model.

**Follow-up:** How could you use `Meta.__call__` to implement the Singleton pattern?

---

## Section 2: Generators & Iterators

### Q6: Explain the difference between `yield`, `yield from`, and `send()`. Provide a practical example of each.

**Answer:**

```python
# --- yield: pause and produce a value ---
def countdown(n):
    while n > 0:
        yield n
        n -= 1

print(list(countdown(3)))  # [3, 2, 1]


# --- send(): push a value INTO a suspended generator ---
def accumulator():
    """A running total that accepts values via send()."""
    total = 0
    while True:
        value = yield total  # yield current total, receive next value
        if value is None:
            break
        total += value

gen = accumulator()
next(gen)          # Prime the generator; returns 0
print(gen.send(10))  # 10
print(gen.send(20))  # 30
print(gen.send(5))   # 35


# --- yield from: delegate to a sub-generator ---
def flatten(nested):
    """Recursively flatten arbitrarily nested iterables."""
    for item in nested:
        if isinstance(item, (list, tuple)):
            yield from flatten(item)  # Delegates to sub-generator
        else:
            yield item

data = [1, [2, [3, 4]], [5, 6], 7]
print(list(flatten(data)))  # [1, 2, 3, 4, 5, 6, 7]
```

**`yield from` does more than simple delegation:**

```python
def sub_generator():
    """Yields values and returns a final result."""
    total = 0
    while True:
        value = yield
        if value is None:
            return total  # This becomes the value of `yield from`
        total += value

def delegator():
    # yield from handles:
    # 1. Forwarding send() calls to the sub-generator
    # 2. Forwarding throw() and close()
    # 3. Capturing the sub-generator's return value
    result = yield from sub_generator()
    print(f"Sub-generator returned: {result}")

d = delegator()
next(d)        # Prime
d.send(10)
d.send(20)
try:
    d.send(None)  # Triggers return in sub_generator
except StopIteration:
    pass
# Output: Sub-generator returned: 30
```

**Why interviewer asks this:** Generator-based patterns appear in async frameworks (the original `asyncio` was built on `yield from`), data pipelines, and memory-efficient stream processing. `send()` is used in coroutine patterns and testing frameworks.

**Follow-up:** How does `yield from` relate to `await` in async Python? What was the historical transition?

---

### Q7: (Coding Problem) Implement a memory-efficient pipeline that processes a 10GB log file without loading it into memory.

**Answer:**

```python
import re
from collections import Counter
from itertools import islice
from typing import Generator, Iterator


def read_lines(filepath: str) -> Generator[str, None, None]:
    """Lazily read lines from a file - O(1) memory."""
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            yield line.rstrip("\n")


def filter_errors(lines: Iterator[str]) -> Generator[str, None, None]:
    """Pass through only ERROR-level log lines."""
    error_pattern = re.compile(r"\bERROR\b")
    for line in lines:
        if error_pattern.search(line):
            yield line


def extract_error_codes(lines: Iterator[str]) -> Generator[str, None, None]:
    """Extract error codes like E1001, E2003 from log lines."""
    code_pattern = re.compile(r"\b(E\d{4})\b")
    for line in lines:
        match = code_pattern.search(line)
        if match:
            yield match.group(1)


def batch(iterable: Iterator, size: int) -> Generator[list, None, None]:
    """Yield successive batches of a given size from an iterator."""
    while True:
        chunk = list(islice(iterable, size))
        if not chunk:
            break
        yield chunk


def analyze_log(filepath: str, top_n: int = 10) -> list[tuple[str, int]]:
    """
    Full pipeline: read -> filter -> extract -> count.
    Memory usage stays constant regardless of file size.
    """
    pipeline = extract_error_codes(
        filter_errors(
            read_lines(filepath)
        )
    )

    counter = Counter()

    # Process in batches to reduce Counter.update() call overhead
    for chunk in batch(pipeline, size=10_000):
        counter.update(chunk)

    return counter.most_common(top_n)


# Usage:
# top_errors = analyze_log("/var/log/app/production.log")
# for code, count in top_errors:
#     print(f"{code}: {count} occurrences")
```

**Key design decisions:**
- Each stage is a generator - the pipeline is lazy end-to-end.
- `batch()` amortizes the overhead of `Counter.update()` calls.
- The entire 10GB file is processed with constant memory (~10KB working set).
- Each function is independently testable and composable.

**Why interviewer asks this:** Real-world data engineering requires processing files that exceed available RAM. This tests whether a candidate defaults to loading everything into memory or thinks in streams.

**Follow-up:** How would you parallelize this pipeline across multiple CPU cores while maintaining the streaming property?

---

### Q8: Explain `itertools` - solve this problem using only `itertools` functions.

**Problem:** Given a stream of stock prices `[(timestamp, price), ...]`, find the longest consecutive streak where price increased.

**Answer:**

```python
import itertools
from typing import Iterator


def longest_increasing_streak(
    prices: Iterator[tuple[str, float]],
) -> list[tuple[str, float]]:
    """
    Find the longest consecutive run of increasing prices.

    Uses itertools.pairwise (3.10+) and itertools.groupby.
    """
    prices_list = list(prices)  # Need indexing for final slice
    if len(prices_list) < 2:
        return prices_list

    # Step 1: Mark each position as increasing (True) or not (False)
    is_increasing = [
        curr_price < next_price
        for (_, curr_price), (_, next_price)
        in itertools.pairwise(prices_list)
    ]

    # Step 2: Group consecutive True/False values
    best_start = 0
    best_length = 0
    current_pos = 0

    for is_up, group in itertools.groupby(is_increasing):
        run_length = sum(1 for _ in group)
        if is_up and run_length > best_length:
            best_length = run_length
            best_start = current_pos
        current_pos += run_length

    # The streak of N increases covers N+1 price points
    return prices_list[best_start : best_start + best_length + 1]


# Example
prices = [
    ("09:30", 100.0),
    ("09:31", 101.5),
    ("09:32", 99.0),
    ("09:33", 100.0),
    ("09:34", 102.0),
    ("09:35", 105.0),
    ("09:36", 107.5),
    ("09:37", 106.0),
]

streak = longest_increasing_streak(iter(prices))
print(streak)
# [('09:33', 100.0), ('09:34', 102.0), ('09:35', 105.0), ('09:36', 107.5)]
```

**Essential `itertools` functions for interviews:**

```python
import itertools

# chain - flatten one level of nesting
list(itertools.chain([1, 2], [3, 4], [5]))          # [1, 2, 3, 4, 5]
list(itertools.chain.from_iterable([[1, 2], [3]]))   # [1, 2, 3]

# accumulate - running reduction
list(itertools.accumulate([1, 2, 3, 4], lambda a, b: a + b))  # [1, 3, 6, 10]

# product - Cartesian product (replaces nested loops)
list(itertools.product("AB", "12"))  # [('A','1'),('A','2'),('B','1'),('B','2')]

# combinations vs permutations
list(itertools.combinations("ABC", 2))   # [('A','B'),('A','C'),('B','C')]
list(itertools.permutations("ABC", 2))   # [('A','B'),('A','C'),('B','A'),...]

# takewhile / dropwhile - lazy filtering
list(itertools.takewhile(lambda x: x < 5, [1, 3, 5, 2]))  # [1, 3]

# groupby (REQUIRES sorted input for meaningful groups)
data = sorted(["apple", "avocado", "banana", "blueberry"], key=lambda s: s[0])
for key, group in itertools.groupby(data, key=lambda s: s[0]):
    print(key, list(group))
# a ['apple', 'avocado']
# b ['banana', 'blueberry']
```

**Why interviewer asks this:** `itertools` mastery indicates a candidate who writes efficient, readable code using the standard library instead of reinventing solutions. It is especially relevant for data processing roles.

**Follow-up:** `itertools.groupby` requires sorted input. How would you implement a streaming `groupby` that does not require sorted input (like SQL's `GROUP BY`)?

---

## Section 3: Advanced Decorators

### Q9: Implement a parameterized decorator that retries a function with exponential backoff.

**Answer:**

```python
import functools
import logging
import random
import time
from typing import Callable, Type

logger = logging.getLogger(__name__)


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    exceptions: tuple[Type[Exception], ...] = (Exception,),
) -> Callable:
    """
    Parameterized decorator that retries a function on failure
    with exponential backoff and optional jitter.

    Args:
        max_attempts: Maximum number of total attempts.
        base_delay: Initial delay in seconds before first retry.
        backoff_factor: Multiplier applied to delay after each retry.
        jitter: Add random jitter to prevent thundering herd.
        exceptions: Tuple of exception types to catch and retry on.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    last_exception = exc
                    if attempt == max_attempts:
                        logger.error(
                            "%s failed after %d attempts: %s",
                            func.__name__,
                            max_attempts,
                            exc,
                        )
                        raise

                    delay = base_delay * (backoff_factor ** (attempt - 1))
                    if jitter:
                        delay *= 0.5 + random.random()  # jitter: 50%-150% of delay

                    logger.warning(
                        "%s attempt %d/%d failed (%s). Retrying in %.2fs...",
                        func.__name__,
                        attempt,
                        max_attempts,
                        exc,
                        delay,
                    )
                    time.sleep(delay)

            raise last_exception  # Should never reach here, but satisfies type checker

        return wrapper

    return decorator


# Usage
@retry(max_attempts=4, base_delay=0.5, exceptions=(ConnectionError, TimeoutError))
def fetch_user_data(user_id: int) -> dict:
    """Fetch user data from an external API."""
    # Simulated unreliable network call
    if random.random() < 0.7:
        raise ConnectionError("Connection refused")
    return {"id": user_id, "name": "Alice"}
```

**Anatomy of a parameterized decorator (three nested functions):**
1. **Outer function** (`retry(...)`) - receives decorator parameters, returns the decorator.
2. **Middle function** (`decorator(func)`) - receives the decorated function, returns the wrapper.
3. **Inner function** (`wrapper(*args, **kwargs)`) - runs on every call.

**Why interviewer asks this:** Retry logic is universal in distributed systems. This tests decorator fluency, error handling patterns, and understanding of production concerns (backoff, jitter, logging).

**Follow-up:** How would you make this decorator work with both sync and async functions transparently?

---

### Q10: Explain `functools.wraps` in depth. What happens when you forget it, and what edge cases does it not handle?

**Answer:**

```python
import functools


def my_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        """Wrapper docstring (will be overwritten by @wraps)."""
        return func(*args, **kwargs)
    return wrapper


@my_decorator
def process_data(items: list[int], *, threshold: int = 10) -> list[int]:
    """Filter items above threshold and return sorted results."""
    return sorted(x for x in items if x > threshold)


# WITH @functools.wraps:
print(process_data.__name__)        # "process_data"
print(process_data.__doc__)         # "Filter items above threshold..."
print(process_data.__module__)      # "__main__"
print(process_data.__qualname__)    # "process_data"
print(process_data.__wrapped__)     # <function process_data at 0x...>

# WITHOUT @functools.wraps (if we had omitted it):
# process_data.__name__    would be "wrapper"
# process_data.__doc__     would be "Wrapper docstring..."
# process_data.__wrapped__ would not exist
```

**What `functools.wraps` copies:**

| Attribute | Purpose |
|---|---|
| `__name__` | Function name for debugging, logging |
| `__qualname__` | Qualified name (includes class for methods) |
| `__doc__` | Docstring |
| `__module__` | Module where function is defined |
| `__annotations__` | Type hints |
| `__dict__` | Custom attributes on the function |
| `__wrapped__` | Reference to the original function |

**What it does NOT fix:**

```python
import inspect

@my_decorator
def example(a: int, b: str = "hello") -> bool:
    """Example function."""
    return True

# Signature is preserved (functools.wraps copies __wrapped__,
# and inspect.signature follows __wrapped__):
print(inspect.signature(example))  # (a: int, b: str = 'hello') -> bool

# BUT - if your wrapper changes the signature, this can be misleading:
def bad_decorator(func):
    @functools.wraps(func)
    def wrapper(request, *args, **kwargs):  # Added 'request' param
        return func(*args, **kwargs)
    return wrapper

@bad_decorator
def greet(name: str) -> str:
    return f"Hello {name}"

# inspect.signature(greet) still shows (name: str) -> str
# But calling greet("Alice") fails - wrapper expects 'request' as first arg!
```

**Why interviewer asks this:** Forgetting `@wraps` causes broken debugging, confusing tracebacks, and breaks tools like Sphinx, pytest, and API documentation generators. This question tests attention to production code quality.

**Follow-up:** How does `flask.route` preserve function identity for its URL routing without `functools.wraps` causing conflicts between routes?

---

### Q11: (Coding Problem) Implement a class decorator that adds automatic JSON serialization to a class.

**Answer:**

```python
import functools
import json
from datetime import datetime
from typing import Any


def json_serializable(cls=None, *, date_format: str = "%Y-%m-%dT%H:%M:%S"):
    """
    Class decorator that adds .to_json() and .from_json() methods.

    Can be used with or without arguments:
        @json_serializable
        @json_serializable(date_format="%Y-%m-%d")
    """

    def decorator(cls):
        def _serialize_value(value: Any) -> Any:
            if isinstance(value, datetime):
                return value.strftime(date_format)
            if hasattr(value, "to_dict"):
                return value.to_dict()
            if isinstance(value, (list, tuple)):
                return [_serialize_value(v) for v in value]
            return value

        def to_dict(self) -> dict:
            """Convert instance to a dictionary."""
            result = {}
            for key, value in self.__dict__.items():
                if not key.startswith("_"):
                    result[key] = _serialize_value(value)
            return result

        def to_json(self, indent: int = 2) -> str:
            """Serialize instance to JSON string."""
            return json.dumps(self.to_dict(), indent=indent)

        @classmethod
        def from_json(klass, json_str: str) -> "cls":
            """Deserialize a JSON string into an instance."""
            data = json.loads(json_str)
            return klass(**data)

        def __repr__(self) -> str:
            attrs = ", ".join(
                f"{k}={v!r}" for k, v in self.__dict__.items()
                if not k.startswith("_")
            )
            return f"{cls.__name__}({attrs})"

        cls.to_dict = to_dict
        cls.to_json = to_json
        cls.from_json = from_json
        cls.__repr__ = __repr__

        return cls

    # Handle both @json_serializable and @json_serializable(...)
    if cls is not None:
        return decorator(cls)
    return decorator


@json_serializable(date_format="%Y-%m-%d")
class Event:
    def __init__(self, name: str, date: str, attendees: int):
        self.name = name
        self.date = date
        self.attendees = attendees


event = Event("PyCon", "2025-05-15", 3000)
print(event)                # Event(name='PyCon', date='2025-05-15', attendees=3000)
print(event.to_json())
# {
#   "name": "PyCon",
#   "date": "2025-05-15",
#   "attendees": 3000
# }

restored = Event.from_json('{"name": "PyCon", "date": "2025-05-15", "attendees": 3000}')
print(restored)             # Event(name='PyCon', date='2025-05-15', attendees=3000)
```

**Decorator stacking - execution order matters:**

```python
def decorator_a(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print("A before")
        result = func(*args, **kwargs)
        print("A after")
        return result
    return wrapper

def decorator_b(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print("B before")
        result = func(*args, **kwargs)
        print("B after")
        return result
    return wrapper

@decorator_a
@decorator_b
def hello():
    print("hello")

hello()
# A before
# B before
# hello
# B after
# A after

# Equivalent to: hello = decorator_a(decorator_b(hello))
# Decorators apply bottom-up, but execute top-down (like layers of an onion).
```

**Why interviewer asks this:** Class decorators are a cleaner alternative to metaclasses for many use cases. Understanding the `cls=None` pattern for optional parameters shows decorator mastery.

**Follow-up:** How does `@dataclass` implement a similar pattern internally? What are the differences between your approach and `dataclass`?

---

## Section 4: Context Managers

### Q12: Implement a context manager that provides database transaction semantics (commit on success, rollback on exception).

**Answer:**

```python
from __future__ import annotations

import logging
from types import TracebackType
from typing import Optional

logger = logging.getLogger(__name__)


class Transaction:
    """
    Context manager providing transactional semantics.

    Usage:
        with Transaction(connection) as tx:
            tx.execute("INSERT INTO users (name) VALUES (?)", ("Alice",))
            tx.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
        # Auto-commits on clean exit, auto-rollbacks on exception.
    """

    def __init__(self, connection, *, savepoint: bool = False):
        self.connection = connection
        self.savepoint = savepoint
        self._savepoint_name: Optional[str] = None

    def __enter__(self) -> "Transaction":
        if self.savepoint:
            import uuid
            self._savepoint_name = f"sp_{uuid.uuid4().hex[:8]}"
            self.connection.execute(f"SAVEPOINT {self._savepoint_name}")
            logger.debug("Created savepoint: %s", self._savepoint_name)
        else:
            self.connection.execute("BEGIN")
            logger.debug("Transaction started")
        return self

    def __exit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> bool:
        if exc_type is not None:
            # Exception occurred - rollback
            if self.savepoint and self._savepoint_name:
                self.connection.execute(
                    f"ROLLBACK TO SAVEPOINT {self._savepoint_name}"
                )
                logger.warning("Rolled back to savepoint %s due to %s: %s",
                               self._savepoint_name, exc_type.__name__, exc_val)
            else:
                self.connection.execute("ROLLBACK")
                logger.warning("Transaction rolled back due to %s: %s",
                               exc_type.__name__, exc_val)
            return False  # Re-raise the exception
        else:
            # Clean exit - commit
            if self.savepoint and self._savepoint_name:
                self.connection.execute(
                    f"RELEASE SAVEPOINT {self._savepoint_name}"
                )
                logger.debug("Released savepoint: %s", self._savepoint_name)
            else:
                self.connection.execute("COMMIT")
                logger.debug("Transaction committed")
            return True

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.connection.execute(sql, params)
```

**The same thing using `contextlib`:**

```python
import contextlib


@contextlib.contextmanager
def transaction(connection, *, savepoint=False):
    """
    Generator-based context manager - less boilerplate,
    but harder to extend with additional methods.
    """
    connection.execute("BEGIN")
    try:
        yield connection
        connection.execute("COMMIT")
    except Exception:
        connection.execute("ROLLBACK")
        raise  # Always re-raise after rollback


# Nesting with contextlib.ExitStack - managing dynamic number of resources:
@contextlib.contextmanager
def multi_resource_operation(file_paths: list[str]):
    """Open multiple files safely - all are cleaned up even if one fails."""
    with contextlib.ExitStack() as stack:
        files = [
            stack.enter_context(open(path, "r"))
            for path in file_paths
        ]
        yield files
```

**`__exit__` return value semantics:**
- `return False` (or `None`) - exception is **re-raised** after `__exit__` completes.
- `return True` - exception is **suppressed** (swallowed).
- **Best practice:** Almost never return `True`. Suppressing exceptions silently hides bugs.

**Why interviewer asks this:** Transaction management is fundamental in backend systems. This tests understanding of resource management, exception handling, and the difference between class-based and generator-based context managers.

**Follow-up:** How would you implement a context manager that supports nested transactions using database savepoints?

---

### Q13: (Debugging Scenario) This code has a subtle bug. Find it and explain the fix.

```python
import contextlib
import tempfile
import os

@contextlib.contextmanager
def temp_workspace():
    """Create a temporary directory, work in it, then clean up."""
    original_dir = os.getcwd()
    tmp_dir = tempfile.mkdtemp()
    os.chdir(tmp_dir)
    yield tmp_dir
    os.chdir(original_dir)
    os.rmdir(tmp_dir)  # Clean up
```

**Answer:**

**Bug:** If an exception occurs inside the `with` block, the code after `yield` never executes. The process stays in the temp directory (which is now leaked), and `original_dir` is never restored.

**Fixed version:**

```python
@contextlib.contextmanager
def temp_workspace():
    """Create a temporary directory, work in it, then clean up."""
    original_dir = os.getcwd()
    tmp_dir = tempfile.mkdtemp()
    os.chdir(tmp_dir)
    try:
        yield tmp_dir
    finally:
        os.chdir(original_dir)
        # Use shutil.rmtree for directories with contents
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
```

**Additional improvements for production:**

```python
import shutil

@contextlib.contextmanager
def temp_workspace(prefix: str = "workspace_", keep_on_error: bool = False):
    """
    Production-grade temporary workspace context manager.

    Args:
        prefix: Prefix for the temp directory name.
        keep_on_error: If True, don't delete the temp dir on exception
                       (useful for debugging).
    """
    original_dir = os.getcwd()
    tmp_dir = tempfile.mkdtemp(prefix=prefix)
    error_occurred = False
    try:
        os.chdir(tmp_dir)
        yield tmp_dir
    except BaseException:
        error_occurred = True
        raise
    finally:
        os.chdir(original_dir)
        if not (keep_on_error and error_occurred):
            shutil.rmtree(tmp_dir, ignore_errors=True)
```

**Rule of thumb:** In a `@contextmanager` generator, always wrap `yield` in `try/finally` if you have cleanup logic. This is the generator equivalent of implementing `__exit__` properly.

**Why interviewer asks this:** Resource leaks in context managers are a common production bug. The generator-based syntax makes it easy to forget that `yield` can raise.

**Follow-up:** What is the difference between catching `Exception` and `BaseException` in the cleanup path, and when does it matter?

---

### Q14: Implement an async context manager for connection pooling.

**Answer:**

```python
import asyncio
from collections import deque
from typing import AsyncIterator
import contextlib


class AsyncConnectionPool:
    """
    Async context manager that manages a pool of database connections
    with a maximum size. Callers wait if all connections are in use.
    """

    def __init__(self, dsn: str, min_size: int = 2, max_size: int = 10):
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self._pool: deque = deque()
        self._semaphore = asyncio.Semaphore(max_size)
        self._initialized = False

    async def __aenter__(self) -> "AsyncConnectionPool":
        """Initialize the pool with min_size connections."""
        for _ in range(self.min_size):
            conn = await self._create_connection()
            self._pool.append(conn)
        self._initialized = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Close all connections in the pool."""
        while self._pool:
            conn = self._pool.popleft()
            await self._close_connection(conn)
        self._initialized = False

    @contextlib.asynccontextmanager
    async def acquire(self) -> AsyncIterator:
        """
        Acquire a connection from the pool.

        Usage:
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
        """
        await self._semaphore.acquire()
        conn = None
        try:
            if self._pool:
                conn = self._pool.popleft()
            else:
                conn = await self._create_connection()

            yield conn

        except Exception:
            # Connection may be in a bad state - discard it
            if conn is not None:
                await self._close_connection(conn)
                conn = None
            raise
        finally:
            self._semaphore.release()
            if conn is not None:
                self._pool.append(conn)  # Return healthy connection to pool

    async def _create_connection(self):
        """Simulate creating a database connection."""
        await asyncio.sleep(0.01)  # Simulate connection time
        return {"dsn": self.dsn, "id": id(object())}

    async def _close_connection(self, conn) -> None:
        """Simulate closing a connection."""
        await asyncio.sleep(0.001)


# Usage:
async def main():
    async with AsyncConnectionPool("postgresql://localhost/mydb") as pool:
        async with pool.acquire() as conn:
            print(f"Using connection: {conn}")

        # Multiple concurrent acquisitions
        async def worker(worker_id: int):
            async with pool.acquire() as conn:
                await asyncio.sleep(0.1)  # Simulate work
                print(f"Worker {worker_id} done with {conn}")

        await asyncio.gather(*[worker(i) for i in range(5)])

# asyncio.run(main())
```

**Key async context manager patterns:**
- `__aenter__` / `__aexit__` - class-based async context manager.
- `@contextlib.asynccontextmanager` - generator-based async context manager.
- `async with` - must be used inside an `async def` function.

**Why interviewer asks this:** Connection pooling is a core backend pattern. This tests understanding of async resource management, semaphores for concurrency control, and proper error handling in async contexts.

**Follow-up:** What happens if a connection becomes stale (e.g., TCP timeout) while sitting in the pool? How would you add health checking?

---

## Section 5: Multithreading vs Multiprocessing

### Q15: When should you use threading vs multiprocessing vs asyncio? Provide a decision framework.

**Answer:**

| Criterion | `threading` | `multiprocessing` | `asyncio` |
|---|---|---|---|
| **Best for** | I/O-bound + legacy blocking APIs | CPU-bound computation | I/O-bound + high concurrency |
| **GIL impact** | Blocked by GIL for CPU work | Bypasses GIL (separate processes) | Not affected (single-thread) |
| **Overhead** | Low (shared memory) | High (process creation, IPC) | Very low (coroutine switching) |
| **Memory sharing** | Shared (requires locks) | Isolated (needs explicit sharing) | Shared (single thread) |
| **Max concurrency** | ~100s of threads | ~number of CPU cores | ~10,000s of coroutines |
| **Debugging** | Hard (race conditions) | Moderate (isolated state) | Moderate (stack traces less clear) |
| **Use case** | File I/O, legacy DB drivers | Image processing, ML training | Web servers, API clients |

**Decision flowchart:**

```
Is the bottleneck CPU or I/O?
├── CPU-bound → multiprocessing (or C extension / Cython)
└── I/O-bound
    ├── Can you use async libraries? → asyncio
    └── Must use blocking libraries? → threading
```

```python
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor


# I/O-bound: threading or asyncio
def fetch_url_blocking(url: str) -> str:
    """Simulates a blocking HTTP request."""
    import urllib.request
    with urllib.request.urlopen(url) as response:
        return response.read().decode()


async def fetch_urls_async(urls: list[str]) -> list[str]:
    """Use ThreadPoolExecutor to run blocking I/O in async context."""
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=10) as pool:
        tasks = [
            loop.run_in_executor(pool, fetch_url_blocking, url)
            for url in urls
        ]
        return await asyncio.gather(*tasks)


# CPU-bound: multiprocessing
def compute_heavy(n: int) -> int:
    """CPU-intensive computation."""
    return sum(i * i for i in range(n))


def parallel_compute(values: list[int]) -> list[int]:
    """Use ProcessPoolExecutor for CPU-bound work."""
    with ProcessPoolExecutor() as pool:
        return list(pool.map(compute_heavy, values))
```

**Why interviewer asks this:** This is one of the most asked questions in Python backend interviews. The answer reveals whether a candidate can make architecture-level decisions about concurrency.

**Follow-up:** You have a web scraper that needs to fetch 10,000 pages and parse HTML from each. Which combination of concurrency tools would you use, and why?

---

### Q16: (Coding Problem) Implement a thread-safe LRU cache without using `functools.lru_cache`.

**Answer:**

```python
import threading
from collections import OrderedDict
from typing import Any, Hashable


class ThreadSafeLRUCache:
    """
    A thread-safe Least Recently Used (LRU) cache.

    Uses OrderedDict for O(1) get/put and a reentrant lock
    for thread safety.
    """

    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("Capacity must be positive")
        self.capacity = capacity
        self._cache: OrderedDict[Hashable, Any] = OrderedDict()
        self._lock = threading.RLock()  # Reentrant lock for nested calls
        self._hits = 0
        self._misses = 0

    def get(self, key: Hashable) -> Any:
        """
        Retrieve a value. Returns None if key not found.
        Moves accessed key to end (most recently used).
        """
        with self._lock:
            if key in self._cache:
                self._hits += 1
                self._cache.move_to_end(key)  # Mark as recently used
                return self._cache[key]
            self._misses += 1
            return None

    def put(self, key: Hashable, value: Any) -> None:
        """
        Insert or update a key-value pair.
        Evicts the least recently used item if at capacity.
        """
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._cache[key] = value
            else:
                if len(self._cache) >= self.capacity:
                    evicted_key, _ = self._cache.popitem(last=False)  # Remove oldest
                self._cache[key] = value

    def delete(self, key: Hashable) -> bool:
        """Remove a key. Returns True if the key existed."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    @property
    def hit_rate(self) -> float:
        """Cache hit rate as a percentage."""
        total = self._hits + self._misses
        return (self._hits / total * 100) if total > 0 else 0.0

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)

    def __repr__(self) -> str:
        with self._lock:
            return (
                f"ThreadSafeLRUCache(capacity={self.capacity}, "
                f"size={len(self._cache)}, hit_rate={self.hit_rate:.1f}%)"
            )


# Verification under concurrent access
def test_thread_safety():
    cache = ThreadSafeLRUCache(capacity=100)
    errors = []

    def writer(thread_id: int):
        try:
            for i in range(1000):
                cache.put(f"t{thread_id}_k{i}", i)
        except Exception as e:
            errors.append(e)

    def reader(thread_id: int):
        try:
            for i in range(1000):
                cache.get(f"t{thread_id}_k{i}")
        except Exception as e:
            errors.append(e)

    threads = []
    for tid in range(10):
        threads.append(threading.Thread(target=writer, args=(tid,)))
        threads.append(threading.Thread(target=reader, args=(tid,)))

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Thread safety violation: {errors}"
    assert len(cache) <= 100, "Cache exceeded capacity"
    print(f"Test passed: {cache}")

# test_thread_safety()
```

**Why `RLock` instead of `Lock`:** A reentrant lock allows the same thread to acquire it multiple times without deadlocking. This is safer when methods call other methods on the same object internally.

**Why interviewer asks this:** LRU cache is a classic data structures question, and adding thread safety tests real-world engineering skills. This also tests knowledge of `OrderedDict`, locking granularity, and the difference between `Lock` and `RLock`.

**Follow-up:** How would you add TTL (time-to-live) expiration to this cache? What about sharded locking for higher throughput?

---

### Q17: (Debugging Scenario) This code has a deadlock. Identify it and propose two different fixes.

```python
import threading

lock_a = threading.Lock()
lock_b = threading.Lock()

def worker_1():
    with lock_a:
        print("Worker 1 acquired lock_a")
        with lock_b:
            print("Worker 1 acquired lock_b")

def worker_2():
    with lock_b:
        print("Worker 2 acquired lock_b")
        with lock_a:
            print("Worker 2 acquired lock_a")

t1 = threading.Thread(target=worker_1)
t2 = threading.Thread(target=worker_2)
t1.start()
t2.start()
t1.join()
t2.join()
```

**Answer:**

**The deadlock:** `worker_1` acquires `lock_a` then waits for `lock_b`. `worker_2` acquires `lock_b` then waits for `lock_a`. Neither can proceed - classic circular wait.

**Fix 1: Consistent lock ordering (recommended)**

```python
def worker_1():
    with lock_a:       # Always acquire lock_a first
        print("Worker 1 acquired lock_a")
        with lock_b:
            print("Worker 1 acquired lock_b")

def worker_2():
    with lock_a:       # Same order: lock_a before lock_b
        print("Worker 2 acquired lock_a")
        with lock_b:
            print("Worker 2 acquired lock_b")
```

**Fix 2: Timeout-based acquisition with retry**

```python
import time

def acquire_both_locks(name: str, first: threading.Lock, second: threading.Lock):
    while True:
        acquired_first = first.acquire(timeout=0.1)
        if acquired_first:
            acquired_second = second.acquire(timeout=0.1)
            if acquired_second:
                return  # Both acquired
            first.release()  # Back off and retry
        time.sleep(0.01)  # Small jitter to reduce contention

def worker_1():
    acquire_both_locks("Worker 1", lock_a, lock_b)
    try:
        print("Worker 1 acquired both locks")
    finally:
        lock_b.release()
        lock_a.release()
```

**Fix 3: Use a single coarser lock (simplest, but reduces parallelism)**

```python
combined_lock = threading.Lock()

def worker_1():
    with combined_lock:
        print("Worker 1 has exclusive access")

def worker_2():
    with combined_lock:
        print("Worker 2 has exclusive access")
```

**Why interviewer asks this:** Deadlocks are the most feared concurrency bug. The ability to identify deadlock conditions (mutual exclusion, hold and wait, no preemption, circular wait) and systematically resolve them is a critical backend skill.

**Follow-up:** How would you detect deadlocks at runtime in a production Python application?

---

## Section 6: Async Programming

### Q18: Explain the asyncio event loop lifecycle. What happens when you call `await`?

**Answer:**

```python
import asyncio


async def demo():
    print("1. Coroutine starts executing synchronously")
    await asyncio.sleep(1)  # Suspends here, returns control to event loop
    print("2. Resumed after sleep completed")
    return "done"
```

**What happens step by step:**

1. `asyncio.run(demo())` creates an event loop and schedules the coroutine.
2. The event loop calls `demo().__next__()` (coroutines are built on generators).
3. `demo()` runs synchronously until it hits `await asyncio.sleep(1)`.
4. `await` suspends the coroutine and registers a callback with the event loop: "wake me up in 1 second."
5. The event loop is now free to run other scheduled coroutines/tasks.
6. After 1 second, the event loop resumes `demo()` from where it was suspended.
7. `demo()` runs to completion, and its return value resolves the Future.

**Critical concept - `await` does NOT mean "run in background":**

```python
import time

async def blocking_mistake():
    """THIS BLOCKS THE ENTIRE EVENT LOOP."""
    time.sleep(5)  # Synchronous! No await = no suspension = no concurrency

async def correct_approach():
    """This yields control to the event loop."""
    await asyncio.sleep(5)

# Running CPU-bound work properly:
async def cpu_bound_correct():
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, heavy_computation)
    return result

def heavy_computation():
    return sum(i * i for i in range(10_000_000))
```

**Concurrency with `gather` vs `create_task`:**

```python
async def fetch(url: str) -> str:
    await asyncio.sleep(0.5)  # Simulate network I/O
    return f"Response from {url}"


async def main():
    # Option 1: asyncio.gather - run concurrently, await all results
    results = await asyncio.gather(
        fetch("https://api.example.com/users"),
        fetch("https://api.example.com/orders"),
        fetch("https://api.example.com/products"),
    )
    # All three ran concurrently - total time ~0.5s, not ~1.5s

    # Option 2: create_task - fire-and-forget with manual awaiting
    task1 = asyncio.create_task(fetch("https://api.example.com/users"))
    task2 = asyncio.create_task(fetch("https://api.example.com/orders"))
    # Tasks start running immediately, even before we await them
    result1 = await task1
    result2 = await task2

    # Option 3: TaskGroup (Python 3.11+) - structured concurrency
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("https://api.example.com/users"))
        t2 = tg.create_task(fetch("https://api.example.com/orders"))
    # All tasks guaranteed complete (or all cancelled on error)
    print(t1.result(), t2.result())
```

**Why interviewer asks this:** Understanding the event loop is essential for anyone working with FastAPI, aiohttp, or any async Python framework. The most common mistake is accidentally blocking the event loop with synchronous code.

**Follow-up:** What is structured concurrency, and why did Python 3.11 introduce `TaskGroup`? What problems does it solve that `gather` does not?

---

### Q19: (Coding Problem) Implement an async rate limiter using the token bucket algorithm.

**Answer:**

```python
import asyncio
import time
from typing import Optional


class AsyncRateLimiter:
    """
    Token bucket rate limiter for async code.

    Allows up to `rate` requests per second, with bursts up to `burst` size.
    """

    def __init__(self, rate: float, burst: int = 1):
        """
        Args:
            rate: Number of tokens (requests) added per second.
            burst: Maximum number of tokens the bucket can hold.
        """
        self.rate = rate
        self.burst = burst
        self._tokens = float(burst)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        """Add tokens based on elapsed time since last refill."""
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self.burst, self._tokens + elapsed * self.rate)
        self._last_refill = now

    async def acquire(self, tokens: int = 1, timeout: Optional[float] = None) -> bool:
        """
        Wait until enough tokens are available.

        Args:
            tokens: Number of tokens to acquire.
            timeout: Maximum time to wait (None = wait forever).

        Returns:
            True if tokens were acquired, False if timed out.
        """
        deadline = time.monotonic() + timeout if timeout is not None else None

        while True:
            async with self._lock:
                self._refill()

                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return True

                # Calculate wait time until enough tokens are available
                deficit = tokens - self._tokens
                wait_time = deficit / self.rate

            if deadline is not None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False  # Timed out
                wait_time = min(wait_time, remaining)

            await asyncio.sleep(wait_time)

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, *exc_info):
        pass  # Nothing to clean up


# Usage: rate limit API calls to 10 requests per second
async def main():
    limiter = AsyncRateLimiter(rate=10, burst=10)

    async def make_api_call(request_id: int) -> str:
        async with limiter:
            print(f"[{time.monotonic():.2f}] Request {request_id} sent")
            await asyncio.sleep(0.05)  # Simulate API call
            return f"Response {request_id}"

    # Fire 30 requests - only 10 per second will go through
    tasks = [make_api_call(i) for i in range(30)]
    results = await asyncio.gather(*tasks)
    print(f"Completed {len(results)} requests")

# asyncio.run(main())
```

**Why interviewer asks this:** Rate limiting is essential in API clients, web scrapers, and microservices. Implementing it correctly in async code tests understanding of locks, timing, and the token bucket algorithm.

**Follow-up:** How would you implement distributed rate limiting across multiple service instances (e.g., using Redis)?

---

### Q20: (Output-Based) What does this code print, and what is the common mistake it demonstrates?

```python
import asyncio

async def task(name, delay):
    print(f"{name} started")
    await asyncio.sleep(delay)
    print(f"{name} finished")
    return name

async def main():
    result1 = await task("A", 2)
    result2 = await task("B", 1)
    result3 = await task("C", 1)
    print(f"Results: {result1}, {result2}, {result3}")

asyncio.run(main())
```

**Answer:**

```
A started
A finished
B started
B finished
C started
C finished
Results: A, B, C
```

**Total time: ~4 seconds** (2 + 1 + 1), NOT ~2 seconds.

**The mistake:** Each `await` is sequential. `task("B")` does not start until `task("A")` finishes. This is the most common async antipattern - writing "synchronous-looking" async code that gets zero concurrency benefit.

**The fix:**

```python
async def main_concurrent():
    # All three tasks run concurrently
    result1, result2, result3 = await asyncio.gather(
        task("A", 2),
        task("B", 1),
        task("C", 1),
    )
    print(f"Results: {result1}, {result2}, {result3}")

# Output:
# A started
# B started
# C started
# B finished
# C finished
# A finished
# Results: A, B, C
# Total time: ~2 seconds
```

**Why interviewer asks this:** This is the single most common mistake developers make when transitioning from sync to async Python. If a candidate does not immediately spot this, they likely have not shipped production async code.

**Follow-up:** When IS sequential `await` the correct pattern? Give a real-world example.

---

### Q21: Explain async generators and async iterators. When would you use them?

**Answer:**

```python
import asyncio
from typing import AsyncIterator


# --- Async Generator ---
async def fetch_pages(url: str, max_pages: int = 10) -> AsyncIterator[dict]:
    """
    Async generator that paginates through an API.
    Each iteration makes an async HTTP call and yields one page.
    """
    for page in range(1, max_pages + 1):
        # Simulate async API call
        await asyncio.sleep(0.1)
        data = {"page": page, "items": [f"item_{i}" for i in range(10)]}

        if not data["items"]:
            return  # StopAsyncIteration - no more pages

        yield data  # Suspend and produce a value


# --- Consuming with async for ---
async def process_all_pages():
    async for page_data in fetch_pages("https://api.example.com/items"):
        print(f"Processing page {page_data['page']} "
              f"with {len(page_data['items'])} items")


# --- Async Iterator class (manual implementation) ---
class AsyncDatabaseCursor:
    """
    Async iterator that fetches database rows in batches.
    Useful when the database driver supports async but not generators.
    """

    def __init__(self, query: str, batch_size: int = 100):
        self.query = query
        self.batch_size = batch_size
        self._offset = 0
        self._buffer: list = []
        self._exhausted = False

    def __aiter__(self):
        return self

    async def __anext__(self) -> dict:
        if not self._buffer:
            if self._exhausted:
                raise StopAsyncIteration

            # Simulate fetching a batch from the database
            await asyncio.sleep(0.05)
            batch = [
                {"id": self._offset + i, "value": f"row_{self._offset + i}"}
                for i in range(self.batch_size)
            ]

            if len(batch) < self.batch_size:
                self._exhausted = True
            if not batch:
                raise StopAsyncIteration

            self._buffer = batch
            self._offset += self.batch_size

        return self._buffer.pop(0)


# Usage:
async def main():
    async for row in AsyncDatabaseCursor("SELECT * FROM users", batch_size=50):
        if row["id"] >= 200:
            break
        print(row)

# asyncio.run(main())
```

**Async comprehensions (Python 3.6+):**

```python
async def get_active_users():
    # Async generator expression
    users = [
        user async for user in AsyncDatabaseCursor("SELECT * FROM users")
        if user["id"] < 100
    ]
    return users
```

**Why interviewer asks this:** Async generators are essential for streaming data in async applications - paginated APIs, database cursors, WebSocket message streams, and server-sent events in FastAPI.

**Follow-up:** How would you implement backpressure in an async generator to prevent a fast producer from overwhelming a slow consumer?

---

## Section 7: GIL & Memory Management

### Q22: Explain the GIL in depth. Why does it exist, and what are the real-world performance implications?

**Answer:**

The **Global Interpreter Lock (GIL)** is a mutex in CPython that allows only one thread to execute Python bytecode at a time, even on multi-core machines.

**Why the GIL exists:**
1. CPython's memory management uses **reference counting** for garbage collection. Without the GIL, every `Py_INCREF`/`Py_DECREF` operation would need atomic operations or per-object locks - massive overhead.
2. Many C extensions assume they have exclusive access to Python objects.
3. The GIL makes single-threaded code faster (no lock overhead on every operation).

**When the GIL matters and when it does not:**

```python
import threading
import time

# CPU-BOUND: GIL is a bottleneck
def cpu_bound():
    total = 0
    for i in range(50_000_000):
        total += i
    return total

# Single-threaded: ~4.5s
start = time.perf_counter()
cpu_bound()
cpu_bound()
print(f"Sequential: {time.perf_counter() - start:.2f}s")

# Two threads: ~4.5s (NO speedup - GIL serializes execution)
start = time.perf_counter()
t1 = threading.Thread(target=cpu_bound)
t2 = threading.Thread(target=cpu_bound)
t1.start(); t2.start()
t1.join(); t2.join()
print(f"Threaded: {time.perf_counter() - start:.2f}s")


# I/O-BOUND: GIL is released during I/O - threads work fine
import urllib.request

def io_bound(url):
    # GIL is released during socket I/O
    urllib.request.urlopen(url).read()

# Threads provide real speedup for I/O
```

**GIL release points:**
- I/O operations (file, network, socket)
- `time.sleep()`
- NumPy/SciPy heavy computations (implemented in C, release GIL)
- `ctypes` calls to C functions
- Every 5ms (Python 3.2+ - `sys.getswitchinterval()`)

**Workarounds for CPU-bound parallelism:**
1. `multiprocessing` - separate processes, each with its own GIL.
2. C extensions that release the GIL (NumPy, Cython with `nogil`).
3. `concurrent.futures.ProcessPoolExecutor`.
4. **Python 3.13+ (PEP 703):** Experimental free-threaded build (`--disable-gil`).

**Why interviewer asks this:** The GIL is the most misunderstood aspect of Python. Many developers incorrectly believe "Python cannot do multithreading." Understanding the GIL's actual scope demonstrates deep runtime knowledge.

**Follow-up:** Python 3.13 introduced an experimental no-GIL mode (PEP 703). What are the trade-offs, and why does it make single-threaded code slower?

---

### Q23: Explain Python's garbage collection: reference counting + generational GC. How can reference cycles cause memory leaks?

**Answer:**

```python
import gc
import sys


# --- Reference Counting (primary GC mechanism) ---
a = [1, 2, 3]          # refcount = 1
b = a                    # refcount = 2
print(sys.getrefcount(a))  # 3 (includes getrefcount's own reference)

del b                    # refcount = 1
del a                    # refcount = 0 → immediately deallocated


# --- Circular Reference (reference counting alone cannot handle this) ---
class Node:
    def __init__(self, name):
        self.name = name
        self.neighbor = None
    def __del__(self):
        print(f"Node {self.name} being garbage collected")

# Create a cycle
node_a = Node("A")
node_b = Node("B")
node_a.neighbor = node_b  # A -> B
node_b.neighbor = node_a  # B -> A

# Delete our references
del node_a
del node_b
# Reference count is now 1 (each node is referenced by the other).
# They are UNREACHABLE but NOT DEALLOCATED by reference counting alone.

# The generational GC handles this:
gc.collect()  # Forces cycle detection
# Output:
# Node A being garbage collected
# Node B being garbage collected
```

**Generational GC details:**

```python
# Python has 3 generations:
# Generation 0: newly created objects (collected most frequently)
# Generation 1: survived one collection
# Generation 2: survived two collections (collected least frequently)

print(gc.get_threshold())  # (700, 10, 10)
# Generation 0 collected after 700 allocations - deallocations
# Generation 1 collected every 10 generation-0 collections
# Generation 2 collected every 10 generation-1 collections

# Monitoring GC activity:
gc.set_debug(gc.DEBUG_STATS)

# Manually tuning thresholds for performance-sensitive applications:
gc.set_threshold(1000, 15, 15)  # Less frequent collection
```

**Real-world memory leak scenarios:**

```python
# Leak 1: Circular reference with __del__ (Python < 3.4 could not collect these)
# Python 3.4+ CAN collect these, but __del__ order is non-deterministic.

# Leak 2: Hidden closures holding references
def create_handler():
    large_data = bytearray(10_000_000)  # 10 MB

    def handler():
        # Closes over large_data even if it does not use it
        return "processed"

    return handler  # large_data is kept alive by the closure!


# Leak 3: Caches that grow unboundedly
_cache = {}

def process(key, data):
    if key not in _cache:
        _cache[key] = expensive_transform(data)  # Grows forever!
    return _cache[key]

# Fix: use functools.lru_cache, weakref.WeakValueDictionary, or TTL cache
```

**Why interviewer asks this:** Memory leaks in long-running Python services (web servers, data pipelines) are a real operational issue. Understanding GC internals helps debug them.

**Follow-up:** How would you use `gc.get_referrers()` and `objgraph` to track down a memory leak in a production Django application?

---

### Q24: (Coding Problem) Demonstrate `weakref` usage for implementing an observer pattern that does not prevent garbage collection.

**Answer:**

```python
import weakref
from typing import Any, Callable


class EventEmitter:
    """
    Observer pattern using weak references.

    Listeners are stored as weak references so that subscribing
    to events does not prevent objects from being garbage collected.
    """

    def __init__(self):
        # WeakSet for bound methods does not work (bound methods are
        # created on the fly), so we use WeakMethod for methods and
        # regular weakrefs for functions.
        self._listeners: dict[str, list[weakref.ref]] = {}

    def on(self, event: str, callback: Callable) -> None:
        """Subscribe to an event."""
        if event not in self._listeners:
            self._listeners[event] = []

        # Use WeakMethod for bound methods, regular ref for functions
        if hasattr(callback, "__self__"):
            ref = weakref.WeakMethod(callback, self._make_cleanup(event))
        else:
            ref = weakref.ref(callback, self._make_cleanup(event))

        self._listeners[event].append(ref)

    def _make_cleanup(self, event: str) -> Callable:
        """Create a callback that removes dead references."""
        def cleanup(dead_ref):
            if event in self._listeners:
                self._listeners[event] = [
                    r for r in self._listeners[event] if r() is not None
                ]
        return cleanup

    def emit(self, event: str, *args: Any, **kwargs: Any) -> int:
        """
        Emit an event, calling all live listeners.
        Returns the number of listeners that were called.
        """
        if event not in self._listeners:
            return 0

        called = 0
        alive = []
        for ref in self._listeners[event]:
            callback = ref()
            if callback is not None:
                callback(*args, **kwargs)
                alive.append(ref)
                called += 1

        self._listeners[event] = alive  # Prune dead references
        return called


class UserService:
    def __init__(self, emitter: EventEmitter):
        self.emitter = emitter
        emitter.on("user_created", self.handle_user_created)

    def handle_user_created(self, user: dict):
        print(f"UserService: Sending welcome email to {user['email']}")


class AuditService:
    def __init__(self, emitter: EventEmitter):
        self.emitter = emitter
        emitter.on("user_created", self.handle_user_created)

    def handle_user_created(self, user: dict):
        print(f"AuditService: Logging user creation for {user['name']}")


# Usage
emitter = EventEmitter()
user_svc = UserService(emitter)
audit_svc = AuditService(emitter)

emitter.emit("user_created", {"name": "Alice", "email": "alice@example.com"})
# UserService: Sending welcome email to alice@example.com
# AuditService: Logging user creation for Alice

# Delete the audit service - it should be garbage collected
del audit_svc

emitter.emit("user_created", {"name": "Bob", "email": "bob@example.com"})
# Only UserService responds - AuditService was garbage collected
# UserService: Sending welcome email to bob@example.com
```

**Key `weakref` concepts:**
- `weakref.ref(obj)` - does not increment reference count.
- `weakref.WeakMethod(method)` - needed for bound methods (bound methods are ephemeral).
- `weakref.WeakValueDictionary` - dict whose values are weak references (great for caches).
- `weakref.finalize(obj, callback)` - safer alternative to `__del__`.

**Why interviewer asks this:** Weak references solve a common problem in event systems, caching, and plugin architectures where objects need to observe each other without creating ownership relationships that prevent GC.

**Follow-up:** Why do `weakref.ref` calls not work directly on bound methods, and how does `WeakMethod` solve this?

---

### Q25: (Real-World Case Study) Your FastAPI application is consuming 4GB of RAM and growing. Walk through your debugging process.

**Answer:**

```python
# Step 1: Identify if it is a leak or expected growth
# Add memory monitoring middleware

import os
import tracemalloc
from fastapi import FastAPI, Request

app = FastAPI()

# Enable tracemalloc at startup
tracemalloc.start(25)  # Store 25 frames of traceback


@app.middleware("http")
async def memory_profiling_middleware(request: Request, call_next):
    """Log memory usage per request in development."""
    import psutil
    process = psutil.Process(os.getpid())
    mem_before = process.memory_info().rss / 1024 / 1024  # MB

    response = await call_next(request)

    mem_after = process.memory_info().rss / 1024 / 1024
    delta = mem_after - mem_before
    if delta > 10:  # Alert if a single request uses >10MB
        print(
            f"MEMORY WARNING: {request.url.path} used {delta:.1f}MB "
            f"(total: {mem_after:.1f}MB)"
        )
    return response


# Step 2: Take memory snapshots and compare
@app.get("/debug/memory-snapshot")
async def memory_snapshot():
    """Compare current memory state to the previous snapshot."""
    snapshot = tracemalloc.take_snapshot()
    top_stats = snapshot.statistics("lineno")

    result = []
    for stat in top_stats[:20]:
        result.append({
            "file": str(stat.traceback),
            "size_mb": stat.size / 1024 / 1024,
            "count": stat.count,
        })
    return {"top_allocations": result}


# Step 3: Inspect GC for circular references
@app.get("/debug/gc-stats")
async def gc_stats():
    import gc
    gc.collect()  # Force collection
    return {
        "gc_counts": gc.get_count(),
        "gc_threshold": gc.get_threshold(),
        "uncollectable": len(gc.garbage),
        "tracked_objects": len(gc.get_objects()),
    }
```

**Common causes and fixes:**

```python
# Cause 1: Unbounded in-memory cache
# BAD:
_user_cache = {}
def get_user(user_id):
    if user_id not in _user_cache:
        _user_cache[user_id] = db.fetch_user(user_id)
    return _user_cache[user_id]

# FIX: Use bounded cache
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_user(user_id):
    return db.fetch_user(user_id)


# Cause 2: Large objects held in closures or global state
# BAD: Middleware that accumulates request data
request_log = []  # Grows forever!

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    body = await request.body()
    request_log.append({"path": request.url.path, "body": body})
    return await call_next(request)

# FIX: Use a bounded deque or external logging
from collections import deque
request_log = deque(maxlen=1000)


# Cause 3: Database connection/session leaks
# BAD: Sessions not properly closed
async def get_data():
    session = SessionLocal()
    result = session.query(User).all()
    return result  # Session never closed!

# FIX: Use dependency injection with proper cleanup
from fastapi import Depends

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users")
async def list_users(db = Depends(get_db)):
    return db.query(User).all()


# Step 4: Profile with objgraph for visual reference graphs
# pip install objgraph
# import objgraph
# objgraph.show_most_common_types(limit=20)
# objgraph.show_growth(limit=10)  # What types are increasing?
# objgraph.show_backrefs(objgraph.by_type('MyClass')[0], max_depth=5)
```

**Systematic debugging checklist:**
1. Add memory monitoring (psutil + tracemalloc).
2. Compare snapshots over time to find growing allocations.
3. Check for unbounded caches, global lists, and leaked connections.
4. Use `gc.get_referrers()` to find what is holding objects alive.
5. Use `objgraph` for visual reference chain analysis.
6. Check for C extensions that might leak (not tracked by Python GC).

**Why interviewer asks this:** Memory debugging is a critical production skill. This question distinguishes candidates who have actually operated Python services from those who have only written scripts.

**Follow-up:** How would you set up automated memory regression testing in your CI pipeline?

---

### Q26: (Coding Problem) Write a memory-efficient data processor that handles 1 million records using `__slots__`, generators, and proper cleanup.

**Answer:**

```python
import gc
import sys
import weakref
from typing import Generator, Iterator


class Record:
    """
    Memory-optimized record using __slots__.
    Saves ~50% memory compared to a regular class.
    """
    __slots__ = ("id", "name", "value", "category")

    def __init__(self, id: int, name: str, value: float, category: str):
        self.id = id
        self.name = name
        self.value = value
        self.category = category

    def __repr__(self) -> str:
        return f"Record(id={self.id}, name={self.name!r}, value={self.value})"


def generate_records(n: int) -> Generator[Record, None, None]:
    """Lazily generate n records - O(1) memory."""
    categories = ["A", "B", "C", "D"]
    for i in range(n):
        yield Record(
            id=i,
            name=f"item_{i}",
            value=float(i) * 1.5,
            category=categories[i % len(categories)],
        )


def batch_process(
    records: Iterator[Record],
    batch_size: int = 10_000,
) -> Generator[dict, None, None]:
    """
    Process records in batches, yielding aggregated results.
    Each batch is processed and then freed from memory.
    """
    batch: list[Record] = []

    for record in records:
        batch.append(record)

        if len(batch) >= batch_size:
            yield _aggregate_batch(batch)
            batch.clear()  # Free memory immediately

    if batch:
        yield _aggregate_batch(batch)


def _aggregate_batch(batch: list[Record]) -> dict:
    """Aggregate a batch of records by category."""
    totals: dict[str, float] = {}
    counts: dict[str, int] = {}

    for record in batch:
        cat = record.category
        totals[cat] = totals.get(cat, 0.0) + record.value
        counts[cat] = counts.get(cat, 0) + 1

    return {
        "batch_size": len(batch),
        "averages": {
            cat: totals[cat] / counts[cat] for cat in totals
        },
        "totals": totals,
    }


def main():
    """Process 1 million records with minimal memory footprint."""
    n = 1_000_000

    # Memory comparison
    regular_obj_size = sys.getsizeof(type("Reg", (), {"id": 0, "name": "", "value": 0.0, "category": ""})())
    slots_obj_size = sys.getsizeof(Record(0, "", 0.0, ""))
    print(f"Regular object: ~{regular_obj_size + 200} bytes")  # + __dict__
    print(f"Slots object:   ~{slots_obj_size} bytes")
    print(f"Savings per object: ~{regular_obj_size + 200 - slots_obj_size} bytes")
    print(f"Total savings for {n:,} records: "
          f"~{(regular_obj_size + 200 - slots_obj_size) * n / 1024 / 1024:.0f} MB")

    # Stream processing - only one batch in memory at a time
    final_totals: dict[str, float] = {}
    final_counts: dict[str, int] = {}

    for batch_result in batch_process(generate_records(n), batch_size=50_000):
        for cat, total in batch_result["totals"].items():
            final_totals[cat] = final_totals.get(cat, 0.0) + total
        for cat, avg in batch_result["averages"].items():
            count = batch_result["batch_size"] // len(batch_result["averages"])
            final_counts[cat] = final_counts.get(cat, 0) + count

    print("\nFinal aggregation:")
    for cat in sorted(final_totals):
        print(f"  Category {cat}: total={final_totals[cat]:,.2f}")


if __name__ == "__main__":
    main()
```

**Why interviewer asks this:** Combines multiple advanced concepts (`__slots__`, generators, batch processing) into a practical scenario. Tests whether a candidate can design memory-efficient data pipelines.

**Follow-up:** How would you add multiprocessing to this pipeline to utilize all CPU cores while maintaining the streaming property?

---

### Q27: (Output-Based) What does this code print? Explain the garbage collection behavior.

```python
import weakref
import gc

class Foo:
    def __init__(self, name):
        self.name = name
    def __repr__(self):
        return f"Foo({self.name!r})"

callback_log = []

def weak_callback(ref):
    callback_log.append(f"Reference died")

a = Foo("alpha")
weak_a = weakref.ref(a, weak_callback)

print(f"1: {weak_a()}")
print(f"2: {weak_a() is a}")

b = a
del a
print(f"3: {weak_a()}")

del b
print(f"4: {weak_a()}")
print(f"5: {callback_log}")
```

**Answer:**

```
1: Foo('alpha')
2: True
3: Foo('alpha')
4: None
5: ['Reference died']
```

**Explanation:**
1. `weak_a()` dereferences the weak reference, returning the `Foo` object. It is still alive (refcount >= 1).
2. `weak_a()` returns the same object as `a` - it is the identical object (`is` returns `True`).
3. After `del a`, the refcount is still 1 because `b` also references the object. The weak reference still works.
4. After `del b`, the refcount drops to 0. CPython immediately deallocates the object. The weak reference callback fires, appending to `callback_log`. Now `weak_a()` returns `None`.
5. The callback ran synchronously at deallocation time, so the log has one entry.

**Edge case to note:** In implementations other than CPython (PyPy, Jython), deallocation may be deferred because they use different GC strategies. The output of step 4 could potentially still show the object alive on those platforms.

**Why interviewer asks this:** Tests precise understanding of reference counting, weak references, and callback timing. This knowledge is critical for building caches, observers, and debugging memory issues.

**Follow-up:** What happens if the weak reference callback itself creates a new strong reference to another object that participates in a reference cycle?

---

### Q28: (Real-World Case Study) You need to process images in a FastAPI endpoint. The processing is CPU-intensive and takes 2-5 seconds per image. Design the architecture.

**Answer:**

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor
from io import BytesIO
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse

app = FastAPI()

# Create a process pool - reuse across requests.
# max_workers = number of CPU cores dedicated to image processing.
process_pool = ProcessPoolExecutor(max_workers=4)


def process_image_sync(image_bytes: bytes, operation: str) -> bytes:
    """
    CPU-intensive image processing - runs in a separate PROCESS
    to bypass the GIL.

    This function must be picklable (top-level function, no closures).
    """
    from PIL import Image, ImageFilter

    img = Image.open(BytesIO(image_bytes))

    if operation == "blur":
        img = img.filter(ImageFilter.GaussianBlur(radius=10))
    elif operation == "thumbnail":
        img.thumbnail((200, 200))
    elif operation == "grayscale":
        img = img.convert("L")
    else:
        raise ValueError(f"Unknown operation: {operation}")

    output = BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


@app.post("/process-image/{operation}")
async def process_image(
    operation: str,
    file: UploadFile = File(...),
    timeout: Optional[float] = 10.0,
):
    """
    Architecture:
    1. FastAPI handles the I/O (receiving upload) on the async event loop.
    2. CPU-heavy processing runs in a ProcessPoolExecutor.
    3. The event loop is NOT blocked - other requests are served concurrently.
    """
    image_bytes = await file.read()

    loop = asyncio.get_running_loop()

    try:
        result_bytes = await asyncio.wait_for(
            loop.run_in_executor(process_pool, process_image_sync, image_bytes, operation),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Image processing timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}")

    return StreamingResponse(BytesIO(result_bytes), media_type="image/png")


@app.on_event("shutdown")
async def shutdown_pool():
    """Gracefully shut down the process pool."""
    process_pool.shutdown(wait=True, cancel_futures=True)
```

**Architecture decision rationale:**

| Concern | Decision | Why |
|---|---|---|
| GIL bypass | `ProcessPoolExecutor` | Image processing is CPU-bound; threads would serialize under the GIL |
| Event loop protection | `run_in_executor` | Keeps the async loop responsive for other requests |
| Timeout | `asyncio.wait_for` | Prevents runaway processing from blocking resources |
| Pool lifecycle | App startup/shutdown hooks | Avoids per-request process creation overhead |
| Serialization | Top-level function | Process pool uses pickle; closures and lambdas are not picklable |

**For higher scale (> 100 requests/min):**
- Use a task queue (Celery/RQ) instead of in-process pool.
- Return a job ID immediately; client polls for completion.
- Store results in object storage (S3/MinIO).

```python
# Scale-out pattern: background task with polling
from fastapi import BackgroundTasks
import uuid

jobs: dict[str, dict] = {}  # In production, use Redis

@app.post("/process-image-async/{operation}")
async def process_image_async(
    operation: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
):
    job_id = str(uuid.uuid4())
    image_bytes = await file.read()
    jobs[job_id] = {"status": "processing"}

    background_tasks.add_task(
        _process_and_store, job_id, image_bytes, operation
    )
    return {"job_id": job_id, "status_url": f"/jobs/{job_id}"}


async def _process_and_store(job_id: str, image_bytes: bytes, operation: str):
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(
            process_pool, process_image_sync, image_bytes, operation
        )
        jobs[job_id] = {"status": "completed", "size": len(result)}
    except Exception as e:
        jobs[job_id] = {"status": "failed", "error": str(e)}


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]
```

**Why interviewer asks this:** This is a direct FastAPI production scenario. It tests understanding of the GIL, async/sync boundary, process pools, and scalability patterns.

**Follow-up:** How would you handle backpressure - what happens when 1,000 image processing requests arrive simultaneously and your pool only has 4 workers?

---

### Q29: (Conceptual) Compare `threading.Lock`, `threading.RLock`, `threading.Semaphore`, `threading.Event`, and `threading.Condition`. When would you use each?

**Answer:**

```python
import threading
import time
from queue import Queue


# --- Lock: basic mutual exclusion ---
# Use when: You need simple exclusive access to a shared resource.
lock = threading.Lock()
shared_counter = 0

def increment():
    global shared_counter
    with lock:
        temp = shared_counter
        temp += 1
        shared_counter = temp


# --- RLock: reentrant lock ---
# Use when: The same thread may need to acquire the lock multiple times
# (e.g., recursive functions, method calling another method on same object).
rlock = threading.RLock()

class SafeList:
    def __init__(self):
        self._items = []
        self._lock = threading.RLock()

    def append(self, item):
        with self._lock:
            self._items.append(item)

    def extend(self, items):
        with self._lock:
            for item in items:
                self.append(item)  # This re-acquires _lock - OK with RLock!


# --- Semaphore: limit concurrent access ---
# Use when: You want to allow N threads to access a resource simultaneously
# (e.g., connection pool, rate limiter).
db_semaphore = threading.Semaphore(value=5)  # Max 5 concurrent DB connections

def query_database(query_id):
    with db_semaphore:
        print(f"Query {query_id}: executing (up to 5 concurrent)")
        time.sleep(1)


# --- Event: one-time or repeatable signal ---
# Use when: Threads need to wait for a condition to become true.
ready_event = threading.Event()

def worker():
    print("Worker: waiting for setup to complete...")
    ready_event.wait()  # Blocks until set()
    print("Worker: proceeding with work")

def setup():
    time.sleep(2)
    print("Setup: complete")
    ready_event.set()  # All waiting threads are released


# --- Condition: wait for complex state changes ---
# Use when: Threads need to wait for AND signal specific conditions
# (e.g., producer-consumer with bounded buffer).
condition = threading.Condition()
buffer = []
MAX_SIZE = 10

def producer():
    for i in range(20):
        with condition:
            while len(buffer) >= MAX_SIZE:
                condition.wait()  # Release lock and wait
            buffer.append(i)
            print(f"Produced: {i} (buffer size: {len(buffer)})")
            condition.notify()  # Wake up a consumer

def consumer():
    for _ in range(20):
        with condition:
            while not buffer:
                condition.wait()
            item = buffer.pop(0)
            print(f"Consumed: {item} (buffer size: {len(buffer)})")
            condition.notify()  # Wake up the producer
```

**Quick reference:**

| Primitive | Key Property | Use Case |
|---|---|---|
| `Lock` | Binary, non-reentrant | Simple mutual exclusion |
| `RLock` | Reentrant (same thread can re-acquire) | Recursive/nested locking |
| `Semaphore` | Counter-based (allows N holders) | Connection pools, rate limiting |
| `BoundedSemaphore` | Semaphore that errors on too many releases | Catching bugs in release logic |
| `Event` | Boolean flag with wait/set/clear | Startup gates, shutdown signals |
| `Condition` | Lock + wait/notify | Producer-consumer, complex state |
| `Barrier` | N threads must arrive before any proceed | Phased computation |

**Why interviewer asks this:** Using the wrong synchronization primitive leads to deadlocks, race conditions, or unnecessary serialization. This tests the candidate's ability to choose the right tool.

**Follow-up:** How do these primitives differ from their `asyncio` equivalents (`asyncio.Lock`, `asyncio.Semaphore`, etc.)?

---

### Q30: (Coding Problem) Implement a thread-safe bounded producer-consumer queue with graceful shutdown, using `concurrent.futures`.

**Answer:**

```python
import concurrent.futures
import queue
import signal
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional


@dataclass
class WorkItem:
    """Represents a unit of work with metadata."""
    id: int
    payload: Any
    created_at: float = 0.0

    def __post_init__(self):
        if self.created_at == 0.0:
            self.created_at = time.monotonic()


_SENTINEL = object()  # Poison pill for shutdown


class WorkerPool:
    """
    Thread-safe producer-consumer system with:
    - Bounded work queue (backpressure)
    - Graceful shutdown
    - Error handling with dead-letter queue
    - Metrics tracking
    """

    def __init__(
        self,
        handler: Callable[[WorkItem], Any],
        num_workers: int = 4,
        max_queue_size: int = 100,
    ):
        self.handler = handler
        self.num_workers = num_workers
        self._queue: queue.Queue[Any] = queue.Queue(maxsize=max_queue_size)
        self._dead_letter: queue.Queue[tuple[WorkItem, Exception]] = queue.Queue()
        self._shutdown_event = threading.Event()
        self._executor: Optional[concurrent.futures.ThreadPoolExecutor] = None
        self._futures: list[concurrent.futures.Future] = []

        # Metrics
        self._processed = 0
        self._failed = 0
        self._lock = threading.Lock()

    def start(self) -> "WorkerPool":
        """Start the worker pool."""
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=self.num_workers,
            thread_name_prefix="worker",
        )
        self._futures = [
            self._executor.submit(self._worker_loop, worker_id=i)
            for i in range(self.num_workers)
        ]
        return self

    def submit(self, item: WorkItem, timeout: float = 5.0) -> bool:
        """
        Submit work. Blocks if queue is full (backpressure).
        Returns False if shutdown is in progress.
        """
        if self._shutdown_event.is_set():
            return False
        try:
            self._queue.put(item, timeout=timeout)
            return True
        except queue.Full:
            return False

    def _worker_loop(self, worker_id: int) -> None:
        """Main loop for each worker thread."""
        while not self._shutdown_event.is_set():
            try:
                item = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if item is _SENTINEL:
                self._queue.task_done()
                break  # Graceful shutdown

            try:
                self.handler(item)
                with self._lock:
                    self._processed += 1
            except Exception as exc:
                with self._lock:
                    self._failed += 1
                self._dead_letter.put((item, exc))
            finally:
                self._queue.task_done()

    def shutdown(self, wait: bool = True, timeout: float = 30.0) -> None:
        """
        Gracefully shut down all workers.

        1. Signal shutdown (no new work accepted).
        2. Send poison pills to wake up blocked workers.
        3. Wait for all workers to finish.
        """
        self._shutdown_event.set()

        # Send sentinel for each worker
        for _ in range(self.num_workers):
            try:
                self._queue.put(_SENTINEL, timeout=1.0)
            except queue.Full:
                pass

        if wait and self._executor:
            done, not_done = concurrent.futures.wait(
                self._futures, timeout=timeout
            )
            if not_done:
                print(f"WARNING: {len(not_done)} workers did not finish in time")

            self._executor.shutdown(wait=False)

    @property
    def stats(self) -> dict:
        with self._lock:
            return {
                "processed": self._processed,
                "failed": self._failed,
                "queue_size": self._queue.qsize(),
                "dead_letter_size": self._dead_letter.qsize(),
            }

    def __enter__(self):
        return self.start()

    def __exit__(self, *exc_info):
        self.shutdown()


# Usage
def process_order(item: WorkItem) -> None:
    """Simulate processing an order."""
    if item.id % 7 == 0:
        raise ValueError(f"Order {item.id} failed validation")
    time.sleep(0.01)  # Simulate work


def main():
    with WorkerPool(handler=process_order, num_workers=4, max_queue_size=50) as pool:
        # Producer: submit 200 work items
        for i in range(200):
            success = pool.submit(WorkItem(id=i, payload={"order": i}))
            if not success:
                print(f"Failed to submit item {i}")

        # Wait for queue to drain
        pool._queue.join()
        print(f"Final stats: {pool.stats}")


if __name__ == "__main__":
    main()
```

**Why interviewer asks this:** Producer-consumer is the foundational pattern for background processing in web applications (task queues, event processors, batch jobs). This tests understanding of thread safety, graceful shutdown, backpressure, and error handling.

**Follow-up:** How would you add priority ordering so that high-priority work items are processed first?

---

## Bonus: Quick-Fire Conceptual Questions

### Q31: What is the difference between `__new__` and `__init__`?

**Answer:** `__new__` is a static method that creates and returns a new instance. `__init__` initializes an already-created instance. `__new__` is called first and receives the class; `__init__` is called second and receives the instance. Use `__new__` when you need to control instance creation (e.g., singletons, immutable types like `int`/`str` subclasses, caching).

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value):
        self.value = value  # Called every time, even if __new__ returned existing instance

a = Singleton(1)
b = Singleton(2)
print(a is b)       # True
print(a.value)      # 2 (overwritten by second __init__ call!)
```

**Why interviewer asks this:** Distinguishes surface-level Python knowledge from object model understanding.

**Follow-up:** Why is `__init__` called even when `__new__` returns an existing instance? How would you prevent that?

---

### Q32: What are `__enter__` and `__exit__` called on when you nest context managers with a comma?

```python
with open("a.txt") as f1, open("b.txt") as f2:
    pass
```

**Answer:** This is equivalent to nested `with` statements. `f1.__enter__()` is called first, then `f2.__enter__()`. On exit, `f2.__exit__()` is called first (LIFO order), then `f1.__exit__()`. If `f2.__enter__()` raises, `f1.__exit__()` is still called (cleanup is guaranteed). In Python 3.10+, you can use parentheses for multi-line context managers:

```python
with (
    open("a.txt") as f1,
    open("b.txt") as f2,
    open("c.txt") as f3,
):
    pass
```

**Why interviewer asks this:** Tests understanding of resource cleanup ordering, which matters when resources have dependencies (e.g., closing a cursor before closing a database connection).

**Follow-up:** What happens if `f2.__exit__()` raises an exception - does `f1.__exit__()` still run?

---

### Q33: (Debugging Scenario) Why does this async code hang forever?

```python
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return {"status": "ok"}

def main():
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(fetch_data())
    print(result)

    # Later in the code...
    loop.run_until_complete(fetch_data())  # Hangs or raises!
```

**Answer:**

Starting with Python 3.10, `asyncio.get_event_loop()` emits a deprecation warning if there is no running loop. But the actual bug depends on context:

1. If `loop.run_until_complete()` is called while a loop is already running (e.g., inside a Jupyter notebook or inside another async framework), it raises `RuntimeError: This event loop is already running`.

2. If the loop was closed (by `asyncio.run()` or explicit `loop.close()`), the second call raises `RuntimeError: Event loop is closed`.

**The fix - use `asyncio.run()` (Python 3.7+):**

```python
async def main():
    result1 = await fetch_data()
    print(result1)
    result2 = await fetch_data()
    print(result2)

asyncio.run(main())  # Creates a new loop, runs, then closes it
```

**Or, if you need to call async code from sync context multiple times:**

```python
# Each asyncio.run() creates a fresh loop
result1 = asyncio.run(fetch_data())
result2 = asyncio.run(fetch_data())
```

**Why interviewer asks this:** Event loop lifecycle mismanagement is one of the most common async Python bugs, especially when integrating async code into existing sync codebases (Django management commands, CLI tools, etc.).

**Follow-up:** How does `nest_asyncio` solve the "event loop already running" problem in Jupyter notebooks, and why is it considered a hack?

---

## Summary: What to Study Next

| This Part Covered | Next Part (Part 4) |
|---|---|
| Deep OOP, metaclasses, descriptors | FastAPI fundamentals and routing |
| Generators, itertools | Request/response lifecycle |
| Advanced decorators | Dependency injection |
| Context managers | Middleware and error handling |
| Threading, multiprocessing | Background tasks |
| Async/await, asyncio | Async endpoints and WebSockets |
| GIL, memory management | Performance profiling FastAPI apps |

---

> **Tip:** Do not just read these answers. Open a Python REPL and experiment with each code sample. Modify them, break them, and observe what happens. That is how you build the intuition interviewers are looking for.
