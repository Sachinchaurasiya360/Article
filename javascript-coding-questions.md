# JavaScript Coding Interview Questions — Must-Know

> A focused collection of the most frequently asked JavaScript coding questions in interviews. Each problem includes a clean implementation, key edge cases, and *why interviewers ask it*. Practice these until you can write them from scratch.

---

## Table of Contents

### Polyfills & Implementations (The Classics)
1. [Implement `debounce`](#q1-implement-debounce)
2. [Implement `throttle`](#q2-implement-throttle)
3. [Implement `Function.prototype.bind`](#q3-implement-functionprototypebind)
4. [Implement `Function.prototype.call` and `apply`](#q4-implement-functionprototypecall-and-apply)
5. [Implement `new` operator](#q5-implement-new-operator)
6. [Implement `instanceof`](#q6-implement-instanceof)
7. [Implement `Object.create`](#q7-implement-objectcreate)

### Async & Promises
8. [Implement `Promise.all`](#q8-implement-promiseall)
9. [Implement `Promise.race` and `Promise.any`](#q9-implement-promiserace-and-promiseany)
10. [Retry an async function with exponential backoff](#q10-retry-async-with-exponential-backoff)
11. [Run async tasks with concurrency limit](#q11-run-async-tasks-with-concurrency-limit)
12. [Implement `sleep` / `delay`](#q12-implement-sleep--delay)

### Functional Patterns
13. [Implement `curry` (infinite currying)](#q13-implement-curry-infinite-currying)
14. [Implement `memoize`](#q14-implement-memoize)
15. [Implement `pipe` and `compose`](#q15-implement-pipe-and-compose)
16. [Implement `once`](#q16-implement-once)

### Objects & Arrays
17. [Deep clone an object](#q17-deep-clone-an-object)
18. [Deep equal comparison](#q18-deep-equal-comparison)
19. [Flatten a nested array](#q19-flatten-a-nested-array)
20. [Implement `EventEmitter`](#q20-implement-eventemitter)

### Output-Based (Tricky Concepts)
21. [Closures + loop: classic `var` vs `let`](#q21-closures--loop-classic-var-vs-let)
22. [Event loop ordering (sync / micro / macro)](#q22-event-loop-ordering)
23. [`this` binding quiz](#q23-this-binding-quiz)

---

## Polyfills & Implementations (The Classics)

---

## Q1. Implement `debounce`

**Problem:** Create a function that delays invoking `fn` until after `delay` ms have elapsed since the last call. Useful for search inputs, resize handlers.

```js
function debounce(fn, delay) {
  let timerId;

  function debounced(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  }

  debounced.cancel = () => clearTimeout(timerId);

  return debounced;
}

// Usage
const handleSearch = debounce((query) => {
  console.log('Searching:', query);
}, 300);

handleSearch('a');
handleSearch('ab');
handleSearch('abc'); // Only this fires after 300ms
```

**Key points:**
- Use `fn.apply(this, args)` to preserve context and arguments.
- Add `.cancel()` for cleanup (React `useEffect`, unmount scenarios).
- Rest/spread `...args` handles any argument count.

**Why interviewers ask this:** Tests closures, `this` binding, timers, and real-world UI performance knowledge.

---

## Q2. Implement `throttle`

**Problem:** Limit `fn` to execute at most once every `limit` ms — regardless of call frequency. Useful for scroll, mousemove, API rate limits.

```js
function throttle(fn, limit) {
  let inThrottle = false;
  let lastArgs = null;

  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args; // Save for trailing call
    }
  };
}
```

**Debounce vs Throttle:**
- **Debounce:** Wait until the user *stops* — good for search-as-you-type.
- **Throttle:** Fire at a steady rate — good for scroll tracking.

**Why interviewers ask this:** Often paired with debounce. Tests ability to distinguish subtle behavioral differences.

---

## Q3. Implement `Function.prototype.bind`

**Problem:** Create `myBind` that works like the native `bind` — returns a new function with `this` permanently set, with optional pre-set arguments (partial application).

```js
Function.prototype.myBind = function (context, ...boundArgs) {
  const fn = this;

  return function boundFn(...callArgs) {
    // Handle `new boundFn()` — ignore bound context, use the new instance
    if (this instanceof boundFn) {
      return fn.apply(this, [...boundArgs, ...callArgs]);
    }
    return fn.apply(context, [...boundArgs, ...callArgs]);
  };
};

// Usage
function greet(greeting, name) {
  return `${greeting}, ${this.title} ${name}`;
}

const user = { title: 'Dr.' };
const sayHi = greet.myBind(user, 'Hello');
sayHi('Smith'); // "Hello, Dr. Smith"
```

**Key points:**
- Support partial application (pre-bound arguments).
- Handle `new` — when `bound` is called with `new`, ignore the bound `this`.

**Why interviewers ask this:** Tests deep understanding of `this`, closures, prototype, and `new`.

---

## Q4. Implement `Function.prototype.call` and `apply`

**Problem:** Implement `myCall` and `myApply` without using the native versions.

```js
Function.prototype.myCall = function (context, ...args) {
  context = context ?? globalThis;
  const fnKey = Symbol('fn'); // avoid collision with existing keys
  context[fnKey] = this;
  const result = context[fnKey](...args);
  delete context[fnKey];
  return result;
};

Function.prototype.myApply = function (context, args = []) {
  return this.myCall(context, ...args);
};

// Usage
function sum(a, b) { return a + b + this.base; }
sum.myCall({ base: 10 }, 2, 3); // 15
sum.myApply({ base: 10 }, [2, 3]); // 15
```

**Trick:** Attach the function as a temporary property on the context, invoke it, then delete. `Symbol` prevents key collisions.

**Why interviewers ask this:** Shows you understand `this` is determined by the call site.

---

## Q5. Implement `new` operator

**Problem:** Write `myNew(Constructor, ...args)` that mimics `new Constructor(...args)`.

```js
function myNew(Constructor, ...args) {
  // 1. Create a new object with Constructor's prototype
  const obj = Object.create(Constructor.prototype);

  // 2. Call constructor with `this` set to the new object
  const result = Constructor.apply(obj, args);

  // 3. If constructor returns an object, use that; otherwise use obj
  return result instanceof Object ? result : obj;
}

function User(name) {
  this.name = name;
}
User.prototype.greet = function () { return `Hi, ${this.name}`; };

const u = myNew(User, 'Alice');
u.greet(); // "Hi, Alice"
u instanceof User; // true
```

**The four steps `new` performs:**
1. Create a blank object.
2. Link its `[[Prototype]]` to `Constructor.prototype`.
3. Execute the constructor with `this` bound to the new object.
4. Return the object (unless the constructor explicitly returns an object).

**Why interviewers ask this:** Tests prototype chain, `Object.create`, and the quirky "return object" rule.

---

## Q6. Implement `instanceof`

**Problem:** Write `myInstanceof(obj, Constructor)` that returns `true` if `Constructor.prototype` appears in `obj`'s prototype chain.

```js
function myInstanceof(obj, Constructor) {
  if (obj == null || typeof obj !== 'object' && typeof obj !== 'function') {
    return false;
  }
  let proto = Object.getPrototypeOf(obj);
  const target = Constructor.prototype;

  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

class Animal {}
class Dog extends Animal {}
const d = new Dog();
myInstanceof(d, Dog);    // true
myInstanceof(d, Animal); // true
myInstanceof(d, Object); // true
```

**Why interviewers ask this:** Fundamental check for prototype chain understanding.

---

## Q7. Implement `Object.create`

**Problem:** Implement `myCreate(proto)` which returns a new object whose `[[Prototype]]` is `proto`.

```js
function myCreate(proto) {
  function F() {}
  F.prototype = proto;
  return new F();
}

const parent = { greet() { return 'hi'; } };
const child = myCreate(parent);
child.greet(); // "hi"
Object.getPrototypeOf(child) === parent; // true
```

**Why interviewers ask this:** Reveals whether you understand that `new F()` creates an object linked to `F.prototype`.

---

## Async & Promises

---

## Q8. Implement `Promise.all`

**Problem:** Takes an iterable of promises. Resolves with an array of results when *all* resolve. Rejects immediately if *any* rejects.

```js
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let completed = 0;
    const total = promises.length;

    if (total === 0) return resolve([]);

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then((value) => {
          results[i] = value; // preserve order via index
          completed++;
          if (completed === total) resolve(results);
        })
        .catch(reject); // first rejection wins
    });
  });
}

promiseAll([Promise.resolve(1), 2, Promise.resolve(3)])
  .then(console.log); // [1, 2, 3]
```

**Key points:**
- Use the index `i` — `.push` would give wrong order on async resolves.
- `Promise.resolve(p)` wraps non-promise values (like plain `2`).
- Empty iterable must resolve immediately with `[]`.

**Why interviewers ask this:** Classic async question — tests Promise internals and indexing logic.

---

## Q9. Implement `Promise.race` and `Promise.any`

```js
function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    promises.forEach((p) => Promise.resolve(p).then(resolve, reject));
  });
}

function promiseAny(promises) {
  return new Promise((resolve, reject) => {
    const errors = [];
    let rejected = 0;
    const total = promises.length;

    if (total === 0) return reject(new AggregateError([], 'All promises rejected'));

    promises.forEach((p, i) => {
      Promise.resolve(p).then(resolve, (err) => {
        errors[i] = err;
        rejected++;
        if (rejected === total) {
          reject(new AggregateError(errors, 'All promises rejected'));
        }
      });
    });
  });
}
```

- **`race`:** Settles as soon as *any* promise settles (resolve OR reject).
- **`any`:** Resolves with first success. Rejects only if *all* fail, with `AggregateError`.

---

## Q10. Retry async with exponential backoff

**Problem:** Retry a failing async function up to N times, with increasing delay between attempts.

```js
async function retry(fn, retries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelay * 2 ** attempt; // 1s, 2s, 4s, 8s...
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// Usage
await retry(() => fetch('/api/data').then((r) => r.json()), 3, 500);
```

**Why interviewers ask this:** Real-world network pattern — exponential backoff avoids hammering a failing server.

---

## Q11. Run async tasks with concurrency limit

**Problem:** Run N async tasks with at most K running in parallel.

```js
async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const [i, task] of tasks.entries()) {
    const p = Promise.resolve().then(() => task());
    results[i] = p;
    executing.add(p);
    p.finally(() => executing.delete(p));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// Usage
const tasks = urls.map((url) => () => fetch(url));
const responses = await runWithConcurrency(tasks, 5);
```

**Why interviewers ask this:** Common real-world problem — tests `Promise.race`, `Set`, and concurrency control.

---

## Q12. Implement `sleep` / `delay`

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Usage
async function demo() {
  console.log('Start');
  await sleep(1000);
  console.log('1 second later');
}
```

**Why interviewers ask this:** Quick warm-up question. Shows you can bridge callback-based APIs (`setTimeout`) to Promise-based code.

---

## Functional Patterns

---

## Q13. Implement `curry` (infinite currying)

**Problem:** Convert `fn(a, b, c)` into `fn(a)(b)(c)` — and support partial application like `fn(a, b)(c)`.

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...nextArgs) => curried.apply(this, [...args, ...nextArgs]);
  };
}

const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1)(2)(3);   // 6
curriedAdd(1, 2)(3);   // 6
curriedAdd(1)(2, 3);   // 6
curriedAdd(1, 2, 3);   // 6
```

**Key points:**
- `fn.length` = number of expected arguments.
- Recursively build up argument list until enough are collected.

**Why interviewers ask this:** Tests recursion, closures, and functional patterns.

---

## Q14. Implement `memoize`

**Problem:** Cache a function's results so repeat calls with the same arguments return instantly.

```js
function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();

  return function memoized(...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const slowSquare = (n) => {
  for (let i = 0; i < 1e8; i++); // pretend slow
  return n * n;
};

const fastSquare = memoize(slowSquare);
fastSquare(5); // slow first call
fastSquare(5); // instant — served from cache
```

**Key points:**
- `Map` (not plain object) avoids prototype-key collisions.
- Custom `keyFn` for non-primitive args (objects, arrays).

**Why interviewers ask this:** Tests closures and real-world optimization instincts.

---

## Q15. Implement `pipe` and `compose`

```js
const pipe = (...fns) => (x) => fns.reduce((v, fn) => fn(v), x);
const compose = (...fns) => (x) => fns.reduceRight((v, fn) => fn(v), x);

const trim = (s) => s.trim();
const toLower = (s) => s.toLowerCase();
const slugify = (s) => s.replace(/\s+/g, '-');

const toSlug = pipe(trim, toLower, slugify);
toSlug('  Hello World  '); // "hello-world"
```

- **`pipe`:** Left-to-right — reads naturally.
- **`compose`:** Right-to-left — mathematical convention `f(g(h(x)))`.

---

## Q16. Implement `once`

**Problem:** Create a function that can only be invoked once. Subsequent calls return the first result.

```js
function once(fn) {
  let called = false;
  let result;

  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => console.log('initialized'));
init(); // "initialized"
init(); // (nothing)
```

**Why interviewers ask this:** Tests closures. Useful for one-time setup (DB connection, analytics init).

---

## Objects & Arrays

---

## Q17. Deep clone an object

**Problem:** Create an independent copy of an object — nested objects, arrays, dates all cloned.

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (seen.has(value)) return seen.get(value); // handle circular refs

  const clone = Array.isArray(value) ? [] : {};
  seen.set(value, clone);

  for (const key of Reflect.ownKeys(value)) {
    clone[key] = deepClone(value[key], seen);
  }
  return clone;
}

// Modern alternative (when available):
// structuredClone(obj)
```

**Edge cases:**
- Circular references → `WeakMap` tracking.
- `Date`, `RegExp`, `Map`, `Set` — need special handling.
- Functions and Symbols — `JSON.parse(JSON.stringify(...))` loses these.

**Why interviewers ask this:** Tests recursion, edge-case awareness, and understanding of reference vs value.

---

## Q18. Deep equal comparison

```js
function deepEqual(a, b) {
  if (a === b) return true; // primitive equality or same reference
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (a.constructor !== b.constructor) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }); // true
```

**Why interviewers ask this:** Tests recursion and understanding that `===` only compares references for objects.

---

## Q19. Flatten a nested array

```js
// Recursive
function flatten(arr, depth = Infinity) {
  return arr.reduce((flat, item) => {
    if (Array.isArray(item) && depth > 0) {
      return flat.concat(flatten(item, depth - 1));
    }
    return flat.concat(item);
  }, []);
}

// Iterative (stack-based) — safe for very deep arrays
function flattenIter(arr) {
  const stack = [...arr];
  const result = [];
  while (stack.length) {
    const next = stack.pop();
    if (Array.isArray(next)) stack.push(...next);
    else result.unshift(next);
  }
  return result;
}

flatten([1, [2, [3, [4]]]]);     // [1, 2, 3, 4]
flatten([1, [2, [3, [4]]]], 2);  // [1, 2, 3, [4]]
```

**Follow-up:** `Array.prototype.flat(depth)` is native. Interviewer will ask you to write it from scratch anyway.

---

## Q20. Implement `EventEmitter`

**Problem:** Build a pub/sub class with `on`, `off`, `emit`, and `once`.

```js
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, listener) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(listener);
    return () => this.off(event, listener); // unsubscribe fn
  }

  off(event, listener) {
    this.events.get(event)?.delete(listener);
  }

  emit(event, ...args) {
    this.events.get(event)?.forEach((fn) => fn(...args));
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// Usage
const bus = new EventEmitter();
const unsub = bus.on('login', (user) => console.log('hi', user));
bus.emit('login', 'Alice'); // "hi Alice"
unsub();
```

**Why interviewers ask this:** Pub/sub is foundational — used in Node streams, Redux, browser events, React hooks.

---

## Output-Based (Tricky Concepts)

---

## Q21. Closures + loop: classic `var` vs `let`

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 3, 3, 3

for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// Output: 0, 1, 2
```

**Why:**
- `var` is function-scoped — all three callbacks share the *same* `i`. By the time they run, the loop is done and `i = 3`.
- `let` is block-scoped — each iteration creates a *new* binding.

**Pre-ES6 fix with IIFE:**
```js
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}
// Output: 0, 1, 2
```

**Why interviewers ask this:** The single most iconic JS trick question. Tests closures, scope, and event loop.

---

## Q22. Event loop ordering

```js
console.log('1');

setTimeout(() => console.log('2'), 0);

Promise.resolve().then(() => console.log('3'));

console.log('4');

// Output: 1, 4, 3, 2
```

**Why this order:**
1. `console.log('1')` — sync, runs first.
2. `setTimeout` schedules a **macrotask**.
3. `Promise.then` schedules a **microtask**.
4. `console.log('4')` — sync.
5. Call stack empties → runs *all* microtasks (`3`).
6. Then runs next macrotask (`2`).

**Rule:** Microtasks (Promises, `queueMicrotask`, `MutationObserver`) always drain fully before the next macrotask (`setTimeout`, `setInterval`, I/O).

**Trickier version:**
```js
async function foo() {
  console.log('A');
  await Promise.resolve();
  console.log('B');
}

console.log('1');
foo();
console.log('2');
// Output: 1, A, 2, B
```
`await` pauses `foo` and schedules the rest (`console.log('B')`) as a microtask.

**Why interviewers ask this:** Tests deep understanding of the event loop, async/await sugar, and microtask/macrotask distinction.

---

## Q23. `this` binding quiz

```js
const obj = {
  name: 'Alice',
  regular: function () { return this.name; },
  arrow: () => this.name,
  greet() {
    const inner = () => this.name;
    return inner();
  },
  delayed() {
    setTimeout(function () { console.log(this.name); }, 0);
  },
  delayedArrow() {
    setTimeout(() => console.log(this.name), 0);
  },
};

obj.regular();         // "Alice" — called as method
obj.arrow();           // undefined — arrow takes `this` from outer (module/global)
obj.greet();           // "Alice" — inner arrow inherits from greet()
const fn = obj.regular;
fn();                  // undefined/strict or global.name — `this` lost
obj.delayed();         // undefined — plain function in setTimeout loses `this`
obj.delayedArrow();    // "Alice" — arrow preserves `this`
```

**Rules to remember:**
1. Arrow functions never have their own `this` — they inherit lexically.
2. Method call → `this` is the object.
3. Standalone call → `this` is `undefined` (strict) or global.
4. `setTimeout` callback — regular function loses `this`; arrow preserves it.

**Why interviewers ask this:** Real debugging scenarios — "why is `this.state` undefined in my React class method?"

---

## Final Tips

- **Don't memorize — understand.** Interviewers often tweak these problems (debounce with leading edge, curry with placeholders, throttle with trailing option). If you understand the mechanism, you can adapt.
- **Write, don't whiteboard from memory.** Practice typing these out. Muscle memory counts.
- **Always think out loud.** Narrate edge cases: empty arrays, null inputs, `this` context, async timing.
- **Know the native equivalents.** Say "the native version handles X, but for this polyfill I'll focus on the core behavior."

Good luck — these 23 problems cover about 80% of JS coding interview scope.
