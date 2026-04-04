# JavaScript Interview Preparation Guide - Zero to Advanced

> A complete, structured interview prep resource covering 50 critical JavaScript interview questions across all major topics, plus 50 hands-on coding problems with solutions.

---

## Table of Contents

### Interview Questions

1. [Variables, Scope & Hoisting (Q1-Q5)](#variables-scope--hoisting)
2. [Data Types & Type Coercion (Q6-Q10)](#data-types--type-coercion)
3. [Functions (Q11-Q16)](#functions)
4. [Objects & Prototypes (Q17-Q22)](#objects--prototypes)
5. [Arrays & Iteration (Q23-Q27)](#arrays--iteration)
6. [Asynchronous JavaScript (Q28-Q34)](#asynchronous-javascript)
7. [ES6+ Modern Features (Q35-Q39)](#es6-modern-features)
8. [Error Handling & Debugging (Q40-Q43)](#error-handling--debugging)
9. [DOM, Events & Browser APIs (Q44-Q47)](#dom-events--browser-apis)
10. [Performance & Design Patterns (Q48-Q50)](#performance--design-patterns)

### Coding Problems

11. [Arrays & Strings (Problems 1-10)](#arrays--strings)
12. [Objects & Data Structures (Problems 11-15)](#objects--data-structures)
13. [Functions & Closures (Problems 16-20)](#functions--closures)
14. [Recursion & Trees (Problems 21-25)](#recursion--trees)
15. [Async & Promises (Problems 26-32)](#async--promises)
16. [DOM & Browser (Problems 33-37)](#dom--browser)
17. [Advanced Algorithms (Problems 38-44)](#advanced-algorithms)
18. [Utility Functions (Problems 45-50)](#utility-functions)

---

# Part 1: Interview Questions (50 Questions)


---

## Variables, Scope & Hoisting

---

## Q1. 🟢 What are the differences between `var`, `let`, and `const`?

**Answer:**

`var`, `let`, and `const` all declare variables but differ in scope, hoisting behaviour, the Temporal Dead Zone, and re-declaration rules.

| Feature | `var` | `let` | `const` |
|---|---|---|---|
| Scope | Function (or global) | Block | Block |
| Hoisting | Hoisted & initialised to `undefined` | Hoisted but **not** initialised (TDZ) | Hoisted but **not** initialised (TDZ) |
| Re-declaration (same scope) | Allowed | Error | Error |
| Re-assignment | Allowed | Allowed | Not allowed |
| Attached to `window` | Yes (global) | No | No |

```js
// var — function-scoped, re-declaration allowed
var x = 1;
var x = 2; // no error
console.log(x); // 2

function demo() {
  var count = 10;
  if (true) {
    var count = 20; // same variable! leaks out of block
    console.log(count); // 20
  }
  console.log(count); // 20 — NOT 10
}

// let — block-scoped
let a = 1;
// let a = 2; // SyntaxError: Identifier 'a' has already been declared
if (true) {
  let a = 99; // different variable, block-scoped
  console.log(a); // 99
}
console.log(a); // 1

// const — block-scoped, must be initialised, cannot be re-assigned
const PI = 3.14159;
// PI = 3; // TypeError: Assignment to constant variable

// But object/array contents CAN be mutated
const obj = { name: "Alice" };
obj.name = "Bob"; // fine — we mutate the object, not the binding
console.log(obj.name); // "Bob"
```

**Why interviewer asks this:** This is the most fundamental variable question in JavaScript — it reveals whether the candidate understands scope rules and can write bug-free code in loops, closures, and modules.

**Follow-up:** When should you use `const` vs `let`?

Use `const` by default for every variable; switch to `let` only when you know the binding will be re-assigned. Never use `var` in modern code.

---

## Q2. 🟢 What is hoisting in JavaScript?

**Answer:**

Hoisting is the JavaScript engine's behaviour of moving declarations to the top of their scope during the compilation phase, before any code executes. Only declarations are hoisted — initialisations are not.

**`var` hoisting**

```js
console.log(name); // undefined — not ReferenceError
var name = "Alice";
// The engine treats it as:
// var name;          <- hoisted
// console.log(name); // undefined
// name = "Alice";    <- initialisation stays in place
```

**`let` and `const` hoisting (Temporal Dead Zone)**

```js
console.log(age); // ReferenceError: Cannot access 'age' before initialization
let age = 25;
// let/const ARE hoisted but placed in the TDZ until the declaration line
```

**Function declaration hoisting**

```js
greet(); // "Hello!" — works perfectly
function greet() {
  console.log("Hello!");
}
// Entire function body is hoisted
```

**Function expression hoisting**

```js
sayHi(); // TypeError: sayHi is not a function
var sayHi = function () {
  console.log("Hi!");
};
// Only the var declaration is hoisted (undefined), not the function body
```

**Class hoisting**

```js
const p = new Person(); // ReferenceError — classes are in TDZ like let
class Person {}
```

**Summary table**

| Declaration | Hoisted? | Initialised? | Usable before declaration? |
|---|---|---|---|
| `var` | Yes | `undefined` | Yes (value is `undefined`) |
| `let` | Yes | No (TDZ) | No |
| `const` | Yes | No (TDZ) | No |
| Function declaration | Yes | Full body | Yes |
| Function expression (var) | Partially | `undefined` | No (TypeError) |
| Class | Yes | No (TDZ) | No |

**Why interviewer asks this:** Hoisting causes subtle bugs (especially with `var` inside loops and conditionals). Understanding it proves a candidate grasps JS's two-phase (compile + execute) execution model.

**Follow-up:** Does hoisting move code physically?

No. The source code is never reordered. The engine registers identifiers during parsing; "hoisting" is just the observable effect of that registration.

---

## Q3. 🟡 What is the Temporal Dead Zone (TDZ)?

**Answer:**

The Temporal Dead Zone is the period between the start of a block scope and the line where a `let` or `const` variable is declared. During this period the variable exists in the scope (it has been hoisted) but is not yet initialised, so any attempt to read or write it throws a `ReferenceError`.

```js
{
  // --- TDZ for `score` begins here ---
  console.log(score); // ReferenceError: Cannot access 'score' before initialization
  let score = 42;     // TDZ ends here — score is now initialised
  console.log(score); // 42
}
```

**Why TDZ exists**

`var`'s silent `undefined` value before initialisation leads to hard-to-trace bugs. The TDZ enforces that you must declare a variable before using it, turning a subtle logical bug into an obvious runtime error.

**TDZ with default parameters**

```js
// Parameters are evaluated left-to-right; b cannot reference a yet
function add(a = b, b = 1) {} // ReferenceError when called
function add(a = 1, b = a) {} // fine
```

**TDZ with `typeof`**

```js
typeof undeclaredVar; // "undefined" — no error
typeof tdzVar;        // ReferenceError if tdzVar is declared with let below
let tdzVar = 10;
```

**Why interviewer asks this:** The TDZ is one of the trickier nuances of ES6. Knowing it demonstrates deep understanding of how `let`/`const` differ from `var` beyond just "block scope".

**Follow-up:** Does `var` have a TDZ?

No. `var` is initialised to `undefined` at hoist time, so there is no dead zone. This is precisely the behaviour that TDZ was designed to eliminate for `let`/`const`.

---

## Q4. 🟡 How does scope work in JavaScript? What is lexical scope?

**Answer:**

**Scope** determines the visibility and lifetime of variables. JavaScript has four types of scope:

| Scope | Created by | Accessible from |
|---|---|---|
| Global | Top-level code | Everywhere |
| Module | ES module file | Inside that module only |
| Function | `function` body | Inside the function |
| Block | `{}` with `let`/`const` | Inside the block |

**Lexical scope** means that a function's scope is determined by where it is *written* in the source code, not where it is *called* from. The engine looks up variables by walking the chain of scopes outward from the innermost scope to global — this chain is called the **scope chain**.

```js
const globalVar = "global";

function outer() {
  const outerVar = "outer";

  function inner() {
    const innerVar = "inner";
    // inner can see all three: innerVar, outerVar, globalVar
    console.log(innerVar, outerVar, globalVar);
  }

  inner();
  // outer cannot see innerVar
  // console.log(innerVar); // ReferenceError
}

outer();
```

**Scope chain lookup**

```js
let x = "global x";

function first() {
  let x = "first x";

  function second() {
    // x is not declared here — engine walks up to first() and finds "first x"
    console.log(x); // "first x"
  }

  second();
}

first();
```

**Block scope with `let`/`const`**

```js
if (true) {
  let blockScoped = "only here";
  var functionScoped = "leaks out";
}
// console.log(blockScoped); // ReferenceError
console.log(functionScoped); // "leaks out"
```

**Why interviewer asks this:** Scope is foundational to understanding closures, module design, and avoiding global pollution. Lexical scope in particular underpins how closures capture variables.

**Follow-up:** What is dynamic scope, and does JavaScript use it?

Dynamic scope resolves variables based on the call stack at runtime. JavaScript does **not** use dynamic scope for variable lookup (though `this` is dynamically bound in regular functions, which is a separate concept).

---

## Q5. 🟡 What are closures? Provide a practical use case.

**Answer:**

A **closure** is a function that retains access to variables from its outer (enclosing) lexical scope even after that outer function has returned. The inner function "closes over" the variables it references.

**Basic closure**

```js
function makeCounter() {
  let count = 0; // private variable

  return {
    increment() { count++; },
    decrement() { count--; },
    value()     { return count; },
  };
}

const counter = makeCounter();
counter.increment();
counter.increment();
counter.decrement();
console.log(counter.value()); // 1
// count is not accessible from outside — true data privacy
```

**Factory function pattern**

```js
function multiplier(factor) {
  return (number) => number * factor; // closes over factor
}

const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5));  // 10
console.log(triple(5));  // 15
```

**Classic loop pitfall with `var`**

```js
// Bug — all callbacks share the same `i`
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // prints 3, 3, 3
}

// Fix 1: use let (block-scoped, new binding per iteration)
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // prints 0, 1, 2
}

// Fix 2: IIFE to capture current value
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0); // prints 0, 1, 2
  })(i);
}
```

**Memoisation with closures**

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const factorial = memoize(function f(n) {
  return n <= 1 ? 1 : n * f(n - 1);
});
console.log(factorial(5)); // 120 (computed)
console.log(factorial(5)); // 120 (from cache)
```

**Why interviewer asks this:** Closures are one of the most powerful and frequently tested JavaScript concepts. They power module patterns, currying, memoisation, event handlers, and React hooks.

**Follow-up:** Do closures cause memory leaks?

They can if a closure holds a reference to a large object or a DOM node that is no longer needed, preventing garbage collection. The fix is to nullify references when the closure is no longer required.

---

## Data Types & Type Coercion

---

## Q6. 🟢 What are the primitive data types in JavaScript?

**Answer:**

JavaScript has **7 primitive types** and **1 object type**:

| Type | Example | `typeof` result |
|---|---|---|
| `undefined` | `let x;` | `"undefined"` |
| `null` | `null` | `"object"` ⚠️ (historic bug) |
| `boolean` | `true`, `false` | `"boolean"` |
| `number` | `42`, `3.14`, `NaN`, `Infinity` | `"number"` |
| `bigint` | `9007199254740991n` | `"bigint"` |
| `string` | `"hello"` | `"string"` |
| `symbol` | `Symbol("id")` | `"symbol"` |
| Object (non-primitive) | `{}`, `[]`, `function(){}` | `"object"` / `"function"` |

**Primitives are immutable and passed by value:**

```js
let a = "hello";
let b = a;
b = "world";
console.log(a); // "hello" — unchanged
```

**Objects are passed by reference:**

```js
const obj1 = { x: 1 };
const obj2 = obj1;
obj2.x = 99;
console.log(obj1.x); // 99 — same reference
```

**`typeof` quirks to memorise:**

```js
typeof null;           // "object"  — legacy bug, not fixable
typeof NaN;            // "number"  — NaN is still of type number
typeof undefined;      // "undefined"
typeof [];             // "object"  — use Array.isArray() instead
typeof function(){};   // "function"
typeof class{};        // "function"
```

**NaN is the only value not equal to itself:**

```js
NaN === NaN; // false
Number.isNaN(NaN); // true — always prefer Number.isNaN over global isNaN
```

**Why interviewer asks this:** Type awareness is critical for avoiding coercion bugs, writing correct type guards, and understanding equality comparisons.

**Follow-up:** How do you reliably check if a value is `null`?

Use strict equality: `value === null`. Do not use `typeof` because it returns `"object"` for `null`.

---

## Q7. 🟡 What is the difference between `==` and `===`? How does type coercion work?

**Answer:**

- `===` (strict equality) compares **value and type** — no coercion.
- `==` (loose equality) coerces operands to the same type before comparing.

**Surprising `==` results**

| Expression | Result | Reason |
|---|---|---|
| `0 == false` | `true` | `false` → `0` |
| `"" == false` | `true` | both → `0` |
| `null == undefined` | `true` | special rule |
| `null == 0` | `false` | null only == undefined |
| `"5" == 5` | `true` | string → number |
| `[] == false` | `true` | `[]` → `""` → `0`; `false` → `0` |
| `[] == ![]` | `true` | `![]` is `false`; then `[]` coerced |
| `NaN == NaN` | `false` | NaN is never equal to anything |

**`===` examples**

```js
1 === "1";     // false — different types
null === null; // true
undefined === undefined; // true
NaN === NaN;  // false — even with ===
```

**Abstract Equality Algorithm (simplified)**

```
If same type → compare like ===
If null/undefined vs null/undefined → true
If number vs string → convert string to number
If boolean → convert to number (true=1, false=0)
If object vs primitive → call ToPrimitive on object
Otherwise → false
```

```js
// ToPrimitive in action
[] == 0
// [] -> "" (toString) -> 0 (Number) == 0 -> true

{} == "[object Object]"
// {} -> "[object Object]" (toString) == "[object Object]" -> true
```

**Best practice:** Always use `===` unless you specifically need the `null == undefined` check (common in nullish guards before `??` was introduced).

**Why interviewer asks this:** Type coercion is a classic JavaScript "gotcha" area and a frequent source of bugs. Knowing the coercion rules shows maturity with the language.

**Follow-up:** When is `==` actually useful?

The pattern `value == null` (which is `true` for both `null` and `undefined`) was a concise null/undefined guard before the nullish coalescing operator `??` existed.

---

## Q8. 🟡 What is the difference between `null` and `undefined`?

**Answer:**

| | `undefined` | `null` |
|---|---|---|
| Meaning | Variable declared but not assigned | Intentional absence of value |
| Set by | JavaScript engine (automatically) | Developer (explicitly) |
| `typeof` | `"undefined"` | `"object"` (historic bug) |
| Loose equality | `undefined == null` → `true` | `null == undefined` → `true` |
| Strict equality | `undefined !== null` | `null !== undefined` |
| Arithmetic | `undefined + 1` → `NaN` | `null + 1` → `1` (null → 0) |

```js
let a;               // undefined — no value assigned
let b = null;        // null — explicitly empty

console.log(a);      // undefined
console.log(b);      // null

console.log(typeof a); // "undefined"
console.log(typeof b); // "object" — quirk!

// Only == treats them as interchangeable
console.log(a == b);  // true
console.log(a === b); // false

// Arithmetic difference
console.log(null + 1);      // 1
console.log(undefined + 1); // NaN
```

**Nullish coalescing (`??`) and optional chaining (`?.`)**

Both operators treat `null` and `undefined` equivalently as "no value":

```js
const name = null;
console.log(name ?? "Anonymous");    // "Anonymous"
console.log(name?.toUpperCase());    // undefined (no error)

// ?? vs ||
const count = 0;
console.log(count || 10);  // 10 — 0 is falsy
console.log(count ?? 10);  // 0  — 0 is not null/undefined
```

**Why interviewer asks this:** Confusing `null` and `undefined` leads to subtle bugs. Understanding their semantic difference helps write intentional, readable code.

**Follow-up:** Should you ever explicitly assign `undefined` to a variable?

Generally no. Reserve `undefined` for "not yet set" (engine's domain) and use `null` when you want to explicitly communicate "no value". Some style guides forbid manually assigning `undefined`.

---

## Q9. 🟡 How does type coercion work with the `+` operator?

**Answer:**

The `+` operator is overloaded: it performs **string concatenation** if either operand is a string, otherwise **numeric addition**. This asymmetry with other operators (`-`, `*`, `/`) causes frequent surprises.

**String concatenation takes priority**

```js
"5" + 3;      // "53"  — 3 is coerced to string
"5" + true;   // "5true"
"5" + null;   // "5null"
"5" + undefined; // "5undefined"
"5" + {};     // "5[object Object]"
"5" + [];     // "5"
```

**Numeric addition when no strings are involved**

```js
5 + null;      // 5    — null coerces to 0
5 + undefined; // NaN  — undefined coerces to NaN
5 + true;      // 6    — true coerces to 1
5 + false;     // 5    — false coerces to 0
5 + [];        // "5"  — [] coerces to "" (ToPrimitive), then string concat
5 + {};        // "5[object Object]"
```

**ToPrimitive algorithm for objects**

When an object participates in `+`, `ToPrimitive` is called:
1. Call `[Symbol.toPrimitive]` if it exists.
2. Otherwise try `valueOf()` — if it returns a primitive, use it.
3. Otherwise try `toString()`.

```js
const obj = {
  valueOf() { return 42; },
};
console.log(obj + 8); // 50 — valueOf returns 42

const obj2 = {
  toString() { return "hello"; },
};
console.log(obj2 + "!"); // "hello!"
```

**Other operators coerce to number first**

```js
"5" - 2;   // 3
"5" * "2"; // 10
"5" ** 2;  // 25
true + true; // 2
```

**Why interviewer asks this:** The `+` duality is one of the most common sources of JavaScript bugs, especially when handling form input (strings vs numbers).

**Follow-up:** How do you safely add numbers from user input?

Use `Number()`, `parseInt()`, or `parseFloat()` to explicitly convert: `Number(input1) + Number(input2)`.

---

## Q10. 🔴 What are Symbols in JavaScript?

**Answer:**

`Symbol` is a primitive type introduced in ES6. Every `Symbol()` call returns a **unique, immutable** value. Symbols are primarily used as unique property keys that cannot accidentally clash with other keys.

**Creating symbols**

```js
const s1 = Symbol("description");
const s2 = Symbol("description");
console.log(s1 === s2); // false — always unique

console.log(typeof s1);        // "symbol"
console.log(s1.toString());    // "Symbol(description)"
console.log(s1.description);   // "description"
```

**`Symbol.for()` — global symbol registry**

```js
const a = Symbol.for("shared");
const b = Symbol.for("shared");
console.log(a === b); // true — same entry in global registry

Symbol.keyFor(a); // "shared"
```

**Symbols as object keys**

```js
const ID = Symbol("id");
const user = {
  name: "Alice",
  [ID]: 123,
};

console.log(user[ID]);          // 123
console.log(user.name);         // "Alice"

// Symbol keys are NOT enumerable by default
console.log(Object.keys(user));                // ["name"]
console.log(Object.getOwnPropertySymbols(user)); // [Symbol(id)]
console.log(Reflect.ownKeys(user));             // ["name", Symbol(id)]
```

**Well-known symbols — customise built-in behaviour**

```js
// Symbol.iterator — make object iterable
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        return current <= end
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
    };
  }
}

console.log([...new Range(1, 5)]); // [1, 2, 3, 4, 5]

// Symbol.toPrimitive — customise coercion
const money = {
  amount: 100,
  currency: "USD",
  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `${this.amount} ${this.currency}`;
    return this.amount; // default
  },
};

console.log(+money);       // 100
console.log(`${money}`);   // "100 USD"
console.log(money + 50);   // 150
```

**Other important well-known symbols**

| Symbol | Purpose |
|---|---|
| `Symbol.iterator` | Make object iterable (`for...of`) |
| `Symbol.asyncIterator` | Make object async-iterable |
| `Symbol.toPrimitive` | Customise type coercion |
| `Symbol.hasInstance` | Customise `instanceof` |
| `Symbol.toStringTag` | Customise `Object.prototype.toString` |
| `Symbol.species` | Control what constructor derived objects use |

**Why interviewer asks this:** Symbols are an advanced but important feature used in library/framework code, metaprogramming, and avoiding property name collisions. Understanding them signals senior-level JavaScript knowledge.

**Follow-up:** Are symbol-keyed properties truly private?

Not entirely. `Object.getOwnPropertySymbols()` and `Reflect.ownKeys()` can retrieve them. They provide "soft privacy" (hidden from common enumeration) but not true encapsulation. For real privacy, use closures or private class fields (`#field`).

---

## Functions

---

## Q11. 🟢 What is the difference between function declarations and function expressions?

**Answer:**

**Function declaration**

```js
function greet(name) {
  return `Hello, ${name}!`;
}
```

**Function expression (anonymous)**

```js
const greet = function (name) {
  return `Hello, ${name}!`;
};
```

**Named function expression**

```js
const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1); // can reference itself by `fact`
};
// fact is NOT accessible outside
```

**Key differences**

| | Declaration | Expression |
|---|---|---|
| Hoisting | Fully hoisted (callable before definition) | Only variable hoisted (`undefined` until assigned) |
| Name | Required | Optional |
| Can be anonymous | No | Yes |
| IIFE usage | No | Yes |

```js
// Hoisting difference
sayHello(); // "Hello!" — works
function sayHello() { console.log("Hello!"); }

sayBye(); // TypeError: sayBye is not a function
var sayBye = function () { console.log("Bye!"); };
```

**IIFE (Immediately Invoked Function Expression)**

```js
(function () {
  const secret = "I am private";
  console.log(secret);
})();
// secret not accessible outside
```

**Why interviewer asks this:** Hoisting behaviour impacts code organisation — developers should know when they can call a function before defining it and why.

**Follow-up:** Why would you use a named function expression over an anonymous one?

Named function expressions appear in stack traces with their name (easier debugging), can reference themselves recursively, and are more self-documenting.

---

## Q12. 🟢 How do arrow functions differ from regular functions?

**Answer:**

Arrow functions (`=>`) are a concise syntax but also have important semantic differences from regular functions.

| Feature | Regular Function | Arrow Function |
|---|---|---|
| `this` binding | Dynamic (depends on call site) | Lexical (inherits from enclosing scope) |
| `arguments` object | Yes | No (use rest params `...args`) |
| `prototype` property | Yes | No |
| Used as constructor | Yes (`new`) | No (throws TypeError) |
| `super` binding | Own | Lexical |
| Method shorthand | Preferred | Avoid (loses correct `this`) |

**`this` — the critical difference**

```js
const obj = {
  name: "Alice",

  // Regular function — this is dynamically bound to obj when called as method
  greetRegular: function () {
    console.log(`Hello from ${this.name}`);
  },

  // Arrow function — this inherited from enclosing scope (module/global)
  greetArrow: () => {
    console.log(`Hello from ${this.name}`); // undefined or global name
  },
};

obj.greetRegular(); // "Hello from Alice"
obj.greetArrow();   // "Hello from undefined"
```

**Arrow functions solve the `this` problem inside callbacks**

```js
function Timer() {
  this.seconds = 0;

  // Without arrow: this is lost inside setInterval callback
  setInterval(function () {
    this.seconds++; // this is window/undefined in strict mode
  }, 1000);

  // With arrow: this is inherited from Timer constructor
  setInterval(() => {
    this.seconds++; // correctly refers to the Timer instance
  }, 1000);
}
```

**No `arguments` object**

```js
function regular() {
  console.log(arguments); // Arguments [1, 2, 3]
}

const arrow = () => {
  console.log(arguments); // ReferenceError (or outer scope's arguments)
};

// Use rest parameters instead
const arrowFixed = (...args) => {
  console.log(args); // [1, 2, 3]
};
```

**Arrow functions cannot be constructors**

```js
const Person = (name) => { this.name = name; };
new Person("Alice"); // TypeError: Person is not a constructor
```

**Why interviewer asks this:** `this` binding is one of the most misunderstood aspects of JavaScript. Arrow functions were introduced specifically to solve the common `this` confusion in callbacks and closures.

**Follow-up:** Should you use arrow functions as object methods?

No. Arrow functions inherit `this` from the outer scope, so `this` inside an arrow method will not refer to the object. Use regular method shorthand (`method() {}`) for object methods.

---

## Q13. 🟡 What are `call`, `apply`, and `bind`?

**Answer:**

All three methods allow you to explicitly set the value of `this` for a function invocation. They live on `Function.prototype`.

| Method | Invokes immediately? | Args passed as |
|---|---|---|
| `call` | Yes | Comma-separated list |
| `apply` | Yes | Array (or array-like) |
| `bind` | No (returns new function) | Comma-separated (partial application) |

**`call`**

```js
function introduce(greeting, punctuation) {
  console.log(`${greeting}, I am ${this.name}${punctuation}`);
}

const alice = { name: "Alice" };
introduce.call(alice, "Hello", "!"); // "Hello, I am Alice!"
```

**`apply`**

```js
introduce.apply(alice, ["Hi", "."]);  // "Hi, I am Alice."

// Classic use: spread an array into Math.max
const numbers = [3, 1, 4, 1, 5, 9];
console.log(Math.max.apply(null, numbers)); // 9
// Modern equivalent: Math.max(...numbers)
```

**`bind`**

```js
const greetAlice = introduce.bind(alice, "Hey");
greetAlice("?"); // "Hey, I am Alice?"

// Common use — fixing this in event handlers
class Button {
  constructor(label) {
    this.label = label;
    this.handleClick = this.handleClick.bind(this); // bind in constructor
  }

  handleClick() {
    console.log(`Clicked: ${this.label}`);
  }
}
```

**Implementing a basic `bind` manually**

```js
Function.prototype.myBind = function (context, ...boundArgs) {
  const fn = this;
  return function (...callArgs) {
    return fn.apply(context, [...boundArgs, ...callArgs]);
  };
};

function multiply(a, b) { return a * b; }
const double = multiply.myBind(null, 2);
console.log(double(5)); // 10
```

**Why interviewer asks this:** Understanding `call`/`apply`/`bind` shows mastery of `this` binding and functional programming patterns like partial application.

**Follow-up:** What is the difference between `bind` and an arrow function for fixing `this`?

`bind` creates a wrapper function that hard-codes `this`; an arrow function captures `this` from its lexical context at definition time. Arrow functions are generally preferred for callbacks, while `bind` is useful when you need to partially apply arguments or when working with existing function references.

---

## Q14. 🟡 What are higher-order functions?

**Answer:**

A **higher-order function (HOF)** is a function that either:
1. Takes one or more functions as arguments, or
2. Returns a function as its result (or both).

This is possible because JavaScript treats functions as **first-class citizens** — they can be stored in variables, passed as arguments, and returned from other functions.

**Built-in HOFs: `map`, `filter`, `reduce`**

```js
const numbers = [1, 2, 3, 4, 5];

// map — transform each element
const squares = numbers.map(n => n ** 2);
// [1, 4, 9, 16, 25]

// filter — keep elements matching predicate
const evens = numbers.filter(n => n % 2 === 0);
// [2, 4]

// reduce — fold into single value
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15
```

**Composing HOFs**

```js
const result = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .filter(n => n % 2 === 0)   // [2, 4, 6, 8, 10]
  .map(n => n ** 2)            // [4, 16, 36, 64, 100]
  .reduce((acc, n) => acc + n, 0); // 220

console.log(result); // 220
```

**Custom HOFs**

```js
// A function that returns a function
function withLogging(fn) {
  return function (...args) {
    console.log(`Calling ${fn.name} with`, args);
    const result = fn(...args);
    console.log(`Result:`, result);
    return result;
  };
}

function add(a, b) { return a + b; }
const loggedAdd = withLogging(add);
loggedAdd(2, 3);
// Calling add with [2, 3]
// Result: 5

// once — ensure a function is called at most once
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}

const init = once(() => console.log("Initialised!"));
init(); // "Initialised!"
init(); // (nothing)
```

**Why interviewer asks this:** HOFs are the backbone of functional programming in JavaScript and are used extensively in React (hooks, HOCs), utility libraries (lodash), and modern data pipelines.

**Follow-up:** What is function composition?

Function composition combines multiple functions so the output of one becomes the input of the next:

```js
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
const add1 = x => x + 1;
const double = x => x * 2;
const add1ThenDouble = compose(double, add1);
console.log(add1ThenDouble(3)); // 8
```

---

## Q15. 🟡 What is currying? How does it differ from partial application?

**Answer:**

**Currying** transforms a function that takes multiple arguments into a sequence of functions each taking one argument:

`f(a, b, c)` becomes `f(a)(b)(c)`

**Partial application** fixes some arguments of a function, returning a new function with fewer arguments to fill in.

```js
// Currying
function curry(a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
}
console.log(curry(1)(2)(3)); // 6

// Arrow function shorthand
const curriedAdd = a => b => c => a + b + c;
console.log(curriedAdd(1)(2)(3)); // 6
```

**Partial application with `bind`**

```js
function add(a, b, c) { return a + b + c; }
const add10 = add.bind(null, 10); // partial — first arg fixed
console.log(add10(5, 3)); // 18
```

**Generic curry utility**

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

function multiply(a, b, c) { return a * b * c; }
const curriedMultiply = curry(multiply);

console.log(curriedMultiply(2)(3)(4));    // 24
console.log(curriedMultiply(2, 3)(4));    // 24
console.log(curriedMultiply(2)(3, 4));    // 24
console.log(curriedMultiply(2, 3, 4));    // 24
```

**Practical example — reusable validators**

```js
const hasMinLength = min => str => str.length >= min;
const isValidEmail = str => str.includes("@");

const validate = (...validators) => value =>
  validators.every(v => v(value));

const validateUsername = validate(hasMinLength(3), hasMinLength(0));
console.log(validateUsername("Al"));    // false
console.log(validateUsername("Alice")); // true
```

**Why interviewer asks this:** Currying is heavily used in functional programming, Ramda/lodash, and React patterns (like HOCs). It also tests understanding of closures and first-class functions.

**Follow-up:** When would you prefer partial application over currying?

Partial application is simpler and more direct when you only need to pre-fill specific arguments (e.g., using `bind`). Currying is better when building pipelines where you chain unary functions.

---

## Q16. 🔴 What are debounce and throttle? Implement both.

**Answer:**

Both techniques limit how often a function is invoked in response to rapid events (scrolling, typing, resizing).

| | Debounce | Throttle |
|---|---|---|
| Fires | After quiet period ends | At most once per interval |
| Use case | Search autocomplete, form validation | Scroll handlers, resize, rate limiting |
| Behaviour | Resets timer on each call | Ignores calls within the interval |

**Debounce implementation**

```js
function debounce(fn, delay) {
  let timerId;

  return function (...args) {
    clearTimeout(timerId); // reset the timer on every call
    timerId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// Usage
const handleSearch = debounce((query) => {
  console.log("Searching for:", query);
}, 300);

// If user types quickly, only the last keystroke triggers the search
input.addEventListener("input", (e) => handleSearch(e.target.value));
```

**Throttle implementation**

```js
function throttle(fn, interval) {
  let lastCallTime = 0;

  return function (...args) {
    const now = Date.now();
    if (now - lastCallTime >= interval) {
      lastCallTime = now;
      fn.apply(this, args);
    }
  };
}

// Usage
const handleScroll = throttle(() => {
  console.log("Scroll position:", window.scrollY);
}, 200);

window.addEventListener("scroll", handleScroll);
```

**Throttle with leading + trailing edge**

```js
function throttleFull(fn, interval) {
  let lastCallTime = 0;
  let timerId;

  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - lastCallTime);

    if (remaining <= 0) {
      clearTimeout(timerId);
      lastCallTime = now;
      fn.apply(this, args);
    } else {
      // Schedule trailing call
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        lastCallTime = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

**Visual comparison**

```
Events:   | e e e e e e e e e e |
Debounce: |                    X|  (fires once after silence)
Throttle: | X         X         |  (fires at regular intervals)
```

**Why interviewer asks this:** Performance optimisation via debounce/throttle is critical for production applications. Implementing them from scratch tests closures, `this` binding, and timer management.

**Follow-up:** What is the difference between debounce with leading vs trailing edge?

- **Trailing** (default): fires after the quiet period — used for search inputs.
- **Leading**: fires immediately on first call, then ignores subsequent calls for the interval — used for button click handlers to prevent double-submits.

---

## Objects & Prototypes

---

## Q17. 🟢 What are the different ways to create objects in JavaScript?

**Answer:**

```js
// 1. Object literal (most common)
const user = {
  name: "Alice",
  greet() { return `Hi, I'm ${this.name}`; },
};

// 2. Constructor function
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function () {
  return `Hi, I'm ${this.name}`;
};
const alice = new Person("Alice", 30);

// 3. Object.create() — set prototype explicitly
const animalPrototype = {
  speak() { return `${this.name} makes a sound`; },
};
const dog = Object.create(animalPrototype);
dog.name = "Rex";
console.log(dog.speak()); // "Rex makes a sound"

// null-prototype object (no Object.prototype methods)
const cleanObj = Object.create(null);
cleanObj.key = "value";
// cleanObj.toString() would throw — no prototype chain

// 4. ES6 class syntax (syntactic sugar over constructor functions)
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound`;
  }
}
class Dog extends Animal {
  speak() {
    return `${this.name} barks`;
  }
}
const rex = new Dog("Rex");
console.log(rex.speak()); // "Rex barks"

// 5. Factory function (no new, no this, no prototype)
function createUser(name, role) {
  return {
    name,
    role,
    greet() { return `Hello, I'm ${this.name}`; },
  };
}
const bob = createUser("Bob", "admin");
```

**Comparison**

| Method | `new` required | Inheritance | Private state |
|---|---|---|---|
| Literal | No | Manual | Closure only |
| Constructor fn | Yes | `prototype` | Closure |
| `Object.create` | No | Explicit prototype | Closure |
| `class` | Yes | `extends` | `#field` |
| Factory | No | Composition | Closure |

**Why interviewer asks this:** Different creation patterns have different performance, inheritance, and privacy characteristics. The answer shows breadth of JavaScript knowledge.

**Follow-up:** What is the difference between `Object.create(proto)` and `new Constructor()`?

`Object.create(proto)` sets `proto` directly as the new object's prototype. `new Constructor()` creates an object, sets its prototype to `Constructor.prototype`, and calls the constructor with `this` bound to the new object.

---

## Q18. 🟡 How does prototypal inheritance work in JavaScript?

**Answer:**

Every JavaScript object has an internal link `[[Prototype]]` to another object (or `null`). When you access a property, the engine looks on the object itself, then walks the **prototype chain** until found or `null` is reached.

```js
const animal = {
  breathe() { return `${this.name} breathes`; },
};

const dog = Object.create(animal); // dog.__proto__ === animal
dog.name = "Rex";
dog.bark = function () { return "Woof!"; };

console.log(dog.bark());    // "Woof!" — own property
console.log(dog.breathe()); // "Rex breathes" — found on prototype
console.log(dog.toString()); // "[object Object]" — found on Object.prototype
```

**`prototype` vs `__proto__`**

```js
function Person(name) { this.name = name; }
Person.prototype.greet = function () { return `Hi, ${this.name}`; };

const alice = new Person("Alice");

// __proto__ (or Object.getPrototypeOf) is the instance's prototype link
Object.getPrototypeOf(alice) === Person.prototype; // true

// prototype is a property on constructor functions
Person.prototype.constructor === Person; // true
```

**Prototype chain diagram**

```
alice
  └─► Person.prototype  (has greet)
        └─► Object.prototype  (has toString, hasOwnProperty, …)
              └─► null
```

**Class syntax — syntactic sugar**

```js
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} speaks`; }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }
}

const d = new Dog("Rex");
d.speak();   // "Rex barks" — own class method
Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true
```

**`hasOwnProperty` vs `in`**

```js
console.log(alice.hasOwnProperty("name"));   // true  — own
console.log(alice.hasOwnProperty("greet"));  // false — on prototype
console.log("greet" in alice);               // true  — checks chain
```

**Why interviewer asks this:** Prototypal inheritance is the foundation of all OOP in JavaScript. Understanding the chain prevents bugs when subclassing or checking property existence.

**Follow-up:** Is `class` in JavaScript the same as classical inheritance?

No. `class` is syntactic sugar over prototype-based inheritance. Under the hood, methods are still placed on `prototype` objects and looked up via the prototype chain. There is no copying of methods as in classical OOP languages.

---

## Q19. 🟡 What is the difference between shallow copy and deep copy?

**Answer:**

- **Shallow copy**: creates a new top-level object but nested objects are still shared references.
- **Deep copy**: recursively copies all nested objects so no references are shared.

**Shallow copy methods**

```js
const original = { a: 1, b: { c: 2 } };

// Spread operator
const shallow1 = { ...original };
// Object.assign
const shallow2 = Object.assign({}, original);

shallow1.a = 99;
console.log(original.a); // 1 — primitive, independent copy

shallow1.b.c = 99;
console.log(original.b.c); // 99 — nested object is SHARED
```

**Deep copy methods**

```js
// 1. JSON round-trip (simple but limited)
const deep1 = JSON.parse(JSON.stringify(original));
// Limitations: loses undefined, functions, Date, RegExp, Symbol, circular refs

// 2. structuredClone (native, ES2022+)
const deep2 = structuredClone(original);
deep2.b.c = 999;
console.log(original.b.c); // 2 — truly independent

// structuredClone handles: Date, RegExp, Map, Set, ArrayBuffer, circular refs
// Does NOT handle: functions, symbols, class instances (prototype stripped)

const withDate = { date: new Date(), nested: { x: 1 } };
const cloned = structuredClone(withDate);
console.log(cloned.date instanceof Date); // true
```

**Manual recursive deep clone**

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value); // handle circular refs

  const clone = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);

  for (const key of Reflect.ownKeys(value)) {
    clone[key] = deepClone(value[key], seen);
  }
  return clone;
}
```

**Comparison table**

| Method | Type | Handles Date? | Handles circular? | Handles functions? |
|---|---|---|---|---|
| `{ ...obj }` | Shallow | No | No | No |
| `Object.assign` | Shallow | No | No | No |
| `JSON` round-trip | Deep | No (→ string) | No (throws) | No (dropped) |
| `structuredClone` | Deep | Yes | Yes | No (throws) |
| Custom recursive | Deep | Configurable | Yes (WeakMap) | Yes |

**Why interviewer asks this:** Accidental mutation of shared nested data is one of the most common bugs in JavaScript applications, especially with state management (Redux, React).

**Follow-up:** When should you use `structuredClone` vs a library like lodash `_.cloneDeep`?

`structuredClone` is native and fast — prefer it when you don't need to clone functions or class instances. Use `_.cloneDeep` when you need to preserve class prototypes or clone functions (though cloning functions is rarely necessary).

---

## Q20. 🟡 How does destructuring work? What are spread and rest operators?

**Answer:**

**Object destructuring**

```js
const user = { name: "Alice", age: 30, role: "admin" };

const { name, age } = user;
console.log(name, age); // "Alice" 30

// Rename
const { name: userName } = user;

// Default values
const { country = "Unknown" } = user;

// Nested
const { address: { city } = {} } = { address: { city: "NYC" } };

// Rest in destructuring
const { name: n, ...rest } = user;
console.log(rest); // { age: 30, role: "admin" }
```

**Array destructuring**

```js
const [first, second, ...remaining] = [1, 2, 3, 4, 5];
console.log(first);     // 1
console.log(second);    // 2
console.log(remaining); // [3, 4, 5]

// Skip elements
const [, , third] = [10, 20, 30];
console.log(third); // 30

// Swap variables
let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b); // 2 1
```

**Function parameter destructuring**

```js
function display({ name, age = 18, address: { city } = {} }) {
  console.log(name, age, city);
}
display({ name: "Bob", address: { city: "LA" } });
// "Bob" 18 "LA"
```

**Spread operator (`...`)**

```js
// Spread into array
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const combined = [...arr1, ...arr2]; // [1, 2, 3, 4, 5, 6]

// Spread into object (shallow merge)
const defaults = { color: "red", size: "M" };
const custom = { size: "L", weight: "heavy" };
const merged = { ...defaults, ...custom };
// { color: "red", size: "L", weight: "heavy" }

// Spread into function call
Math.max(...[3, 1, 4, 1, 5, 9]); // 9
```

**Rest parameters**

```js
function sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}
console.log(sum(1, 2, 3, 4)); // 10

// Rest must be last
function log(level, ...messages) {
  console.log(`[${level}]`, ...messages);
}
log("INFO", "Server started", "on port 3000");
```

**Why interviewer asks this:** Destructuring and spread/rest are used pervasively in modern JavaScript, React props, Redux reducers, and API response handling.

**Follow-up:** What is the difference between rest and spread syntax? They look identical (`...`).

The visual syntax is the same (`...`) but the context determines semantics: **spread** expands an iterable/object into individual elements (in calls, array literals, object literals), while **rest** collects multiple elements into a single array/object (in function params, destructuring).

---

## Q21. 🔴 How does `Object.defineProperty` work? What are property descriptors?

**Answer:**

`Object.defineProperty` gives fine-grained control over property behaviour through **property descriptors**.

**Data descriptor properties**

| Attribute | Default | Description |
|---|---|---|
| `value` | `undefined` | The property's value |
| `writable` | `false` | Can the value be changed? |
| `enumerable` | `false` | Shows in `for...in` / `Object.keys`? |
| `configurable` | `false` | Can descriptor be changed / deleted? |

```js
const obj = {};
Object.defineProperty(obj, "name", {
  value: "Alice",
  writable: false,
  enumerable: true,
  configurable: false,
});

console.log(obj.name); // "Alice"
obj.name = "Bob";      // silently fails (TypeError in strict mode)
console.log(obj.name); // "Alice"

delete obj.name;       // silently fails (TypeError in strict mode)
console.log(obj.name); // "Alice"
```

**Accessor descriptor (getters/setters)**

```js
const person = { _age: 0 };

Object.defineProperty(person, "age", {
  get() {
    return this._age;
  },
  set(value) {
    if (typeof value !== "number" || value < 0) {
      throw new TypeError("Age must be a non-negative number");
    }
    this._age = value;
  },
  enumerable: true,
  configurable: true,
});

person.age = 30;
console.log(person.age); // 30
// person.age = -1; // TypeError

// Shorthand getter/setter in object literal
const circle = {
  radius: 5,
  get area() { return Math.PI * this.radius ** 2; },
  set diameter(d) { this.radius = d / 2; },
};
```

**Immutability patterns**

```js
// Prevent adding new properties
Object.preventExtensions(obj);

// + prevent deleting/reconfiguring existing props (enumerable/writable still changeable)
Object.seal(obj);

// + prevent all mutations (deep-freeze requires recursion)
Object.freeze(obj);

function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach(name => {
    const value = obj[name];
    if (typeof value === "object" && value !== null) deepFreeze(value);
  });
  return Object.freeze(obj);
}
```

**Defining multiple properties at once**

```js
Object.defineProperties(obj, {
  firstName: { value: "Alice", writable: true, enumerable: true, configurable: true },
  lastName:  { value: "Smith", writable: true, enumerable: true, configurable: true },
});
```

**Why interviewer asks this:** `Object.defineProperty` is the foundation of Vue 2's reactivity system, many serialisation libraries, and immutability utilities. Understanding it shows advanced object manipulation skills.

**Follow-up:** What is the difference between `Object.freeze` and `const`?

`const` prevents re-assigning the binding (the variable itself), while `Object.freeze` prevents mutating the object's properties. A `const` object can still have its properties changed; a frozen object cannot be mutated even via a `let` variable.

---

## Q22. 🔴 What are Proxy and Reflect in JavaScript?

**Answer:**

**Proxy** wraps an object and intercepts fundamental operations (property access, assignment, function invocation, etc.) through **traps**.

**Reflect** provides the default implementations of those same operations — it mirrors the internal methods of the Proxy traps and is the idiomatic way to invoke the default behaviour inside a trap.

**Basic Proxy**

```js
const handler = {
  get(target, prop, receiver) {
    console.log(`Getting: ${prop}`);
    return Reflect.get(target, prop, receiver); // default behaviour
  },
  set(target, prop, value, receiver) {
    console.log(`Setting: ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
};

const user = new Proxy({ name: "Alice", age: 30 }, handler);
console.log(user.name); // Getting: name  →  "Alice"
user.age = 31;          // Setting: age = 31
```

**Validation proxy**

```js
function createValidatedUser(target) {
  return new Proxy(target, {
    set(obj, prop, value) {
      if (prop === "age") {
        if (typeof value !== "number" || value < 0 || value > 150) {
          throw new RangeError(`Invalid age: ${value}`);
        }
      }
      if (prop === "name" && typeof value !== "string") {
        throw new TypeError("Name must be a string");
      }
      return Reflect.set(obj, prop, value);
    },
  });
}

const user = createValidatedUser({});
user.name = "Bob";  // fine
user.age = 200;     // RangeError: Invalid age: 200
```

**Reactive data (simplified Vue-like)**

```js
function reactive(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      const result = Reflect.set(obj, prop, value);
      if (oldValue !== value) onChange(prop, value);
      return result;
    },
  });
}

const state = reactive({ count: 0 }, (prop, val) => {
  console.log(`[reactive] ${prop} changed to ${val}`);
});

state.count = 1; // [reactive] count changed to 1
state.count = 2; // [reactive] count changed to 2
```

**Common Proxy traps**

| Trap | Triggered by |
|---|---|
| `get` | Property access: `obj.prop`, `obj[key]` |
| `set` | Property assignment |
| `has` | `in` operator |
| `deleteProperty` | `delete obj.prop` |
| `apply` | Function call |
| `construct` | `new` operator |
| `ownKeys` | `Object.keys`, `for...in` |

**Reflect methods**

`Reflect` provides a clean API corresponding to each trap and is always preferred over e.g. `target[prop]` inside traps because it handles edge cases (receiver, prototype methods) correctly.

```js
Reflect.get(target, prop, receiver);
Reflect.set(target, prop, value, receiver);
Reflect.has(target, prop);           // equiv to prop in target
Reflect.ownKeys(target);             // all own keys incl. symbols
Reflect.deleteProperty(target, prop);
```

**Why interviewer asks this:** Proxy and Reflect are the foundation of modern JavaScript reactivity systems (Vue 3, MobX), validation libraries, and meta-programming. Knowing them signals advanced JavaScript mastery.

**Follow-up:** Can all objects be proxied? Are there limitations?

Most objects can be proxied. Notable limitations: the target of a Proxy cannot be a primitive; some built-in objects (like `Date`) have internal slots that Proxies cannot intercept. Also, `Proxy` identity is not transparent — `proxy === target` is `false`.

---

## Arrays & Iteration

---

## Q23. 🟢 What are the most important array methods in JavaScript?

**Answer:**

```js
const nums = [1, 2, 3, 4, 5];
const words = ["hello", "world", "foo"];

// map — transform elements, returns new array of same length
nums.map(n => n * 2);           // [2, 4, 6, 8, 10]

// filter — keep elements passing predicate, returns new array
nums.filter(n => n > 2);        // [3, 4, 5]

// reduce — fold to a single value (see Q24 for deep dive)
nums.reduce((acc, n) => acc + n, 0); // 15

// find — first element matching predicate (or undefined)
nums.find(n => n > 3);          // 4

// findIndex — index of first match (or -1)
nums.findIndex(n => n > 3);     // 3

// some — true if at least one element matches
nums.some(n => n > 4);          // true

// every — true if all elements match
nums.every(n => n > 0);         // true

// includes — check value existence (uses SameValueZero)
nums.includes(3);               // true

// indexOf — first index of value (or -1), uses ===
nums.indexOf(3);                // 2

// flat — flatten nested arrays
[1, [2, [3, [4]]]].flat();      // [1, 2, [3, [4]]] (depth 1)
[1, [2, [3, [4]]]].flat(Infinity); // [1, 2, 3, 4]

// flatMap — map then flat(1) in one pass
["hello world", "foo bar"].flatMap(s => s.split(" "));
// ["hello", "world", "foo", "bar"]

// forEach — iterate, returns undefined (no chaining)
nums.forEach(n => console.log(n));

// sort — sorts in-place (default: lexicographic!)
[10, 2, 1].sort();              // [1, 10, 2] — lexicographic
[10, 2, 1].sort((a, b) => a - b); // [1, 2, 10] — numeric ascending

// reverse — in-place
[1, 2, 3].reverse();            // [3, 2, 1]

// slice — non-destructive copy of portion
nums.slice(1, 3);               // [2, 3]

// splice — mutate in-place: remove/insert
const arr = [1, 2, 3, 4];
arr.splice(1, 2, 99, 98);       // returns [2, 3], arr is now [1, 99, 98, 4]

// Array.from — create array from iterable or array-like
Array.from("hello");            // ["h", "e", "l", "l", "o"]
Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]

// Array.isArray
Array.isArray([]);              // true
Array.isArray({});              // false
```

**Why interviewer asks this:** Array methods are the daily workhorse of JavaScript development. Fluency with them indicates productive, idiomatic coding ability.

**Follow-up:** What is the difference between `find` and `filter`?

`filter` returns all matching elements as a new array; `find` returns only the **first** matching element (or `undefined`). `find` short-circuits on the first match, so it is more efficient when you only need one result.

---

## Q24. 🟡 Explain `Array.reduce` in depth.

**Answer:**

`reduce(callback, initialValue)` executes `callback(accumulator, currentValue, index, array)` for each element, carrying forward the accumulator. The final value of the accumulator is returned.

**Syntax**

```js
array.reduce((accumulator, currentValue, index, array) => {
  // return new accumulator value
}, initialValue);
```

**Sum of numbers**

```js
[1, 2, 3, 4, 5].reduce((sum, n) => sum + n, 0); // 15
```

**Always provide an `initialValue`** — without it, the first element is used as the accumulator and the callback starts from index 1. This can cause `TypeError` on empty arrays.

```js
[].reduce((acc, n) => acc + n);       // TypeError!
[].reduce((acc, n) => acc + n, 0);    // 0 — safe
```

**Flatten arrays**

```js
[[1, 2], [3, 4], [5]].reduce((acc, arr) => acc.concat(arr), []);
// [1, 2, 3, 4, 5]
```

**Grouping (object accumulator)**

```js
const people = [
  { name: "Alice", dept: "Engineering" },
  { name: "Bob",   dept: "Marketing" },
  { name: "Carol", dept: "Engineering" },
];

const byDept = people.reduce((groups, person) => {
  const { dept } = person;
  groups[dept] = groups[dept] ?? [];
  groups[dept].push(person);
  return groups;
}, {});

// {
//   Engineering: [{ name: "Alice" }, { name: "Carol" }],
//   Marketing:   [{ name: "Bob" }]
// }
```

**Counting occurrences**

```js
const fruits = ["apple", "banana", "apple", "cherry", "banana", "apple"];
const count = fruits.reduce((acc, fruit) => {
  acc[fruit] = (acc[fruit] ?? 0) + 1;
  return acc;
}, {});
// { apple: 3, banana: 2, cherry: 1 }
```

**Function composition with reduce**

```js
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
const pipe    = (...fns) => x => fns.reduce((v, f) => f(v), x);

const process = pipe(
  x => x * 2,
  x => x + 1,
  x => x ** 2,
);
console.log(process(3)); // ((3*2)+1)^2 = 49
```

**Why interviewer asks this:** `reduce` is the most powerful and flexible array method. The ability to use it beyond simple sums (grouping, composing, flattening) signals functional programming fluency.

**Follow-up:** When should you NOT use `reduce`?

Avoid `reduce` when a simpler method suffices (`map`, `filter`, `find`), or when the accumulator logic is so complex it hurts readability. A `for...of` loop is sometimes clearer for multi-step accumulations.

---

## Q25. 🟡 What is the difference between `for...in` and `for...of`?

**Answer:**

| | `for...in` | `for...of` |
|---|---|---|
| Iterates over | **Enumerable property keys** (strings) | **Values** of any iterable |
| Works on | Objects, arrays, strings | Arrays, strings, Maps, Sets, generators, etc. |
| Includes prototype? | Yes (unless `hasOwnProperty` check) | No |
| Use with arrays | Avoid — gives index strings | Yes |
| Use with plain objects | Yes | No (not iterable by default) |

**`for...in` — enumerable keys**

```js
const obj = { a: 1, b: 2, c: 3 };
for (const key in obj) {
  console.log(key, obj[key]);
}
// "a" 1 / "b" 2 / "c" 3

// Danger: includes prototype properties
function Foo() { this.x = 1; }
Foo.prototype.y = 2;
const foo = new Foo();
for (const key in foo) {
  console.log(key); // "x" then "y" — prototype key included!
}
// Safe pattern:
for (const key in foo) {
  if (Object.hasOwn(foo, key)) console.log(key); // "x" only
}
```

**`for...of` — iterable values**

```js
// Array values
for (const value of [10, 20, 30]) {
  console.log(value); // 10, 20, 30
}

// String characters
for (const char of "hello") {
  console.log(char); // h, e, l, l, o
}

// Map entries
const map = new Map([["a", 1], ["b", 2]]);
for (const [key, value] of map) {
  console.log(key, value); // "a" 1 / "b" 2
}

// Set values
for (const item of new Set([1, 2, 2, 3])) {
  console.log(item); // 1, 2, 3
}

// Generators
function* count() { yield 1; yield 2; yield 3; }
for (const n of count()) {
  console.log(n); // 1, 2, 3
}
```

**`for...in` on arrays — the pitfall**

```js
const arr = [10, 20, 30];
arr.custom = "oops"; // someone added a property

for (const key in arr) {
  console.log(key); // "0", "1", "2", "custom" — includes non-index!
}

for (const val of arr) {
  console.log(val); // 10, 20, 30 — correct
}
```

**Why interviewer asks this:** Using `for...in` on arrays is a common beginner mistake that leads to subtle bugs when array prototypes are extended. Knowing when to use each shows professional JavaScript awareness.

**Follow-up:** How do you iterate over an object's own keys with `for...of`?

Use `Object.keys()`, `Object.values()`, or `Object.entries()` to get an iterable from the object:

```js
for (const [key, val] of Object.entries(obj)) { ... }
```

---

## Q26. 🟡 What are the Iterator and Iterable protocols?

**Answer:**

**Iterable protocol**: an object is iterable if it has a `[Symbol.iterator]()` method that returns an **iterator**.

**Iterator protocol**: an object is an iterator if it has a `next()` method that returns `{ value, done }`.

```
Iterable ──[Symbol.iterator]()──► Iterator ──next()──► { value, done }
```

**Built-in iterables**: arrays, strings, Maps, Sets, `arguments`, generators, NodeLists.

**How `for...of` works internally**

```js
const arr = [1, 2, 3];
const iterator = arr[Symbol.iterator]();

console.log(iterator.next()); // { value: 1, done: false }
console.log(iterator.next()); // { value: 2, done: false }
console.log(iterator.next()); // { value: 3, done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

**Custom iterable — range**

```js
const range = {
  from: 1,
  to: 5,

  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  },
};

console.log([...range]);           // [1, 2, 3, 4, 5]
for (const n of range) console.log(n); // 1 2 3 4 5
```

**Iterator + Iterable in one object (self-iterator)**

```js
function makeRange(start, end) {
  let current = start;
  return {
    next() {
      return current <= end
        ? { value: current++, done: false }
        : { value: undefined, done: true };
    },
    [Symbol.iterator]() { return this; },
  };
}

const r = makeRange(1, 3);
console.log([...r]); // [1, 2, 3]
```

**Iterable in destructuring, spread, Array.from**

```js
const [a, b, ...rest] = range; // destructuring consumes the iterator
const arr = Array.from(range);
const spread = [...range];
```

**Why interviewer asks this:** Understanding the iteration protocols is prerequisite for working with generators, async iteration, custom data structures, and `for...of` edge cases.

**Follow-up:** What is an "infinite" iterable, and how do you consume it safely?

An infinite iterable's `next()` never returns `done: true`. Consume it with manual `iterator.next()` calls or `for...of` with a `break` statement. Spreading or `Array.from`-ing an infinite iterable will hang the process.

---

## Q27. 🔴 What are generators in JavaScript?

**Answer:**

A **generator function** (`function*`) returns a **Generator** object — an iterator that lazily produces values one at a time via `yield`. Execution pauses at each `yield` and resumes on the next `next()` call.

**Basic generator**

```js
function* simpleGen() {
  console.log("Start");
  yield 1;
  console.log("After first yield");
  yield 2;
  console.log("After second yield");
  return 3;
}

const gen = simpleGen();
console.log(gen.next()); // "Start"        → { value: 1, done: false }
console.log(gen.next()); // "After first"  → { value: 2, done: false }
console.log(gen.next()); // "After second" → { value: 3, done: true }
console.log(gen.next()); //                → { value: undefined, done: true }
```

**Lazy evaluation — infinite sequences**

```js
function* naturals(start = 1) {
  let n = start;
  while (true) {
    yield n++;
  }
}

function take(n, iterable) {
  const result = [];
  for (const val of iterable) {
    result.push(val);
    if (result.length === n) break;
  }
  return result;
}

console.log(take(5, naturals()));     // [1, 2, 3, 4, 5]
console.log(take(5, naturals(10)));   // [10, 11, 12, 13, 14]
```

**Passing values back to generator with `next(value)`**

```js
function* calculator() {
  const a = yield "Enter first number";
  const b = yield "Enter second number";
  return a + b;
}

const calc = calculator();
calc.next();       // { value: "Enter first number", done: false }
calc.next(10);     // { value: "Enter second number", done: false } — a = 10
calc.next(20);     // { value: 30, done: true } — b = 20, returns 10+20
```

**`yield*` — delegate to another iterable**

```js
function* inner() { yield "a"; yield "b"; }
function* outer() {
  yield 1;
  yield* inner(); // delegate to inner
  yield* [2, 3];  // delegate to array iterator
  yield 4;
}

console.log([...outer()]); // [1, "a", "b", 2, 3, 4]
```

**Real-world use cases**

```js
// 1. Unique ID generator
function* idGenerator(prefix = "id") {
  let n = 0;
  while (true) yield `${prefix}-${++n}`;
}
const ids = idGenerator("user");
console.log(ids.next().value); // "user-1"
console.log(ids.next().value); // "user-2"

// 2. Paginated data fetching (async generator)
async function* fetchPages(baseUrl, totalPages) {
  for (let page = 1; page <= totalPages; page++) {
    const res = await fetch(`${baseUrl}?page=${page}`);
    yield await res.json();
  }
}

for await (const page of fetchPages("/api/posts", 5)) {
  console.log("Processing page:", page);
}

// 3. State machine
function* trafficLight() {
  while (true) {
    yield "green";
    yield "yellow";
    yield "red";
  }
}
const light = trafficLight();
console.log(light.next().value); // "green"
console.log(light.next().value); // "yellow"
console.log(light.next().value); // "red"
console.log(light.next().value); // "green" (cycles)
```

**`return()` and `throw()` on generators**

```js
function* gen() {
  try {
    yield 1;
    yield 2;
  } catch (e) {
    console.log("Caught:", e.message);
    yield 99;
  }
}

const g = gen();
g.next();               // { value: 1, done: false }
g.throw(new Error("oops")); // Caught: oops → { value: 99, done: false }
g.next();               // { value: undefined, done: true }
```

**Why interviewer asks this:** Generators are foundational to async/await (which is internally based on generators + promises), `redux-saga`, lazy data pipelines, and custom iteration. Understanding them demonstrates deep JavaScript knowledge.

**Follow-up:** How are generators related to `async/await`?

`async/await` is syntactic sugar built on generators + Promises. An `async` function behaves like a generator where `await` pauses execution (like `yield`) until the awaited Promise settles. Before `async/await`, libraries like `co` used generators manually to achieve the same effect.


---


---

## Asynchronous JavaScript

---

## Q28. 🟢 How does the JavaScript event loop work?

**Answer:**

JavaScript is single-threaded, meaning it can only execute one piece of code at a time. The event loop is the mechanism that enables non-blocking, asynchronous behavior by coordinating the **call stack**, **Web APIs**, **task queue (macrotask queue)**, and **microtask queue**.

**Key components:**

- **Call Stack** — Where synchronous code executes (LIFO). When a function is called it is pushed; when it returns it is popped.
- **Web APIs** — Browser-provided capabilities (setTimeout, fetch, DOM events) that handle async work outside the stack.
- **Macrotask Queue (Task Queue)** — Holds callbacks from setTimeout, setInterval, setImmediate, I/O events.
- **Microtask Queue** — Holds callbacks from resolved Promises (.then/.catch/.finally), queueMicrotask(), and MutationObserver. **Microtasks have higher priority** — the queue is drained completely before the next macrotask runs.

**Execution order:**
1. Run all synchronous code (call stack).
2. Drain the entire microtask queue.
3. Pick one macrotask from the macrotask queue and run it.
4. Drain the microtask queue again.
5. Repeat.

```js
console.log('1 - synchronous');

setTimeout(() => console.log('2 - macrotask (setTimeout)'), 0);

Promise.resolve().then(() => console.log('3 - microtask (Promise)'));

queueMicrotask(() => console.log('4 - microtask (queueMicrotask)'));

console.log('5 - synchronous');

// Output order:
// 1 - synchronous
// 5 - synchronous
// 3 - microtask (Promise)
// 4 - microtask (queueMicrotask)
// 2 - macrotask (setTimeout)
```

**More complex example:**

```js
console.log('start');

setTimeout(() => {
  console.log('timeout 1');
  Promise.resolve().then(() => console.log('promise inside timeout'));
}, 0);

Promise.resolve()
  .then(() => {
    console.log('promise 1');
    return Promise.resolve();
  })
  .then(() => console.log('promise 2'));

setTimeout(() => console.log('timeout 2'), 0);

console.log('end');

// Output:
// start
// end
// promise 1
// promise 2
// timeout 1
// promise inside timeout
// timeout 2
```

**Why interviewer asks this:** Understanding the event loop is foundational to writing correct async code and diagnosing bugs like unexpected execution order, UI freezes, or race conditions.

**Follow-up: What is `requestAnimationFrame` in relation to the event loop?**
`requestAnimationFrame` callbacks run after macrotasks but are coordinated with the browser's repaint cycle — typically 60 times per second. They execute before the next paint, giving smooth animation without blocking the main thread.

---

## Q29. 🟢 What are Promises and what are their three states?

**Answer:**

A **Promise** is an object representing the eventual completion or failure of an asynchronous operation. It provides a cleaner alternative to callback-based async code.

**Three states:**

| State | Description | Transition |
|---|---|---|
| `pending` | Initial state, operation not yet complete | Can move to fulfilled or rejected |
| `fulfilled` | Operation completed successfully | Terminal state, has a value |
| `rejected` | Operation failed | Terminal state, has a reason/error |

Once a Promise settles (fulfilled or rejected) it is **immutable** — it cannot change state again.

**Creating and consuming Promises:**

```js
// Creating a Promise
const fetchData = (shouldFail) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('Something went wrong'));
      } else {
        resolve({ data: 'Hello, World!' });
      }
    }, 1000);
  });
};

// .then() — handles fulfillment
// .catch() — handles rejection
// .finally() — always runs regardless of outcome
fetchData(false)
  .then((result) => {
    console.log('Fulfilled:', result.data); // "Hello, World!"
    return result.data.toUpperCase();
  })
  .then((upper) => console.log('Chained:', upper)) // "HELLO, WORLD!"
  .catch((error) => console.error('Rejected:', error.message))
  .finally(() => console.log('Cleanup — always runs'));
```

**Promise chaining:**

```js
// Each .then() returns a new Promise, enabling chaining
const processUser = (userId) =>
  getUser(userId)
    .then((user) => getOrders(user.id))
    .then((orders) => processOrders(orders))
    .then((result) => console.log('Done:', result))
    .catch((err) => console.error('Pipeline failed:', err));
```

**Promise.resolve() and Promise.reject() shorthand:**

```js
// Already-settled promises
const resolved = Promise.resolve(42);
const rejected = Promise.reject(new Error('instant failure'));

resolved.then(console.log); // 42
rejected.catch(console.error); // Error: instant failure
```

**Why interviewer asks this:** Promises are the backbone of modern async JavaScript. Interviewers want to confirm you understand state transitions, chaining, and error propagation before moving to async/await.

**Follow-up: Can a Promise be cancelled?**
No, native Promises cannot be cancelled once created. To support cancellation, use `AbortController` with fetch, or wrap your Promise in logic that checks a cancelled flag.

---

## Q30. 🟡 How does async/await relate to Promises, and how do you handle errors and parallelism?

**Answer:**

`async/await` is **syntactic sugar over Promises**. An `async` function always returns a Promise. The `await` keyword pauses execution of the async function until the awaited Promise settles, without blocking the main thread.

**Basic usage:**

```js
// Promise-based
function getUser(id) {
  return fetch(`/api/users/${id}`).then((res) => res.json());
}

// async/await equivalent — reads like synchronous code
async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json(); // implicitly wrapped in Promise.resolve()
}
```

**Error handling with try/catch:**

```js
async function loadUserProfile(userId) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch (error) {
    // catches both fetchUser and fetchPosts rejections
    console.error('Failed to load profile:', error.message);
    throw error; // re-throw if callers need to handle it
  } finally {
    console.log('Request completed'); // always runs
  }
}
```

**Sequential vs parallel execution:**

```js
// SEQUENTIAL — waits for each before starting next (~3 seconds total)
async function sequential() {
  const user = await fetchUser(1);    // wait 1s
  const posts = await fetchPosts(1);  // wait 1s
  const comments = await fetchComments(1); // wait 1s
  return { user, posts, comments };
}

// PARALLEL — all start at once (~1 second total)
async function parallel() {
  const [user, posts, comments] = await Promise.all([
    fetchUser(1),
    fetchPosts(1),
    fetchComments(1),
  ]);
  return { user, posts, comments };
}
```

**Parallel with independent error handling:**

```js
async function parallelWithFallbacks() {
  const [userResult, postsResult] = await Promise.allSettled([
    fetchUser(1),
    fetchPosts(1),
  ]);

  const user = userResult.status === 'fulfilled' ? userResult.value : null;
  const posts = postsResult.status === 'fulfilled' ? postsResult.value : [];

  return { user, posts };
}
```

**Common pitfall — await in loops:**

```js
const ids = [1, 2, 3, 4, 5];

// BAD — sequential, slow
for (const id of ids) {
  const user = await fetchUser(id); // each waits for previous
}

// GOOD — parallel
const users = await Promise.all(ids.map((id) => fetchUser(id)));
```

**Why interviewer asks this:** async/await is the dominant async pattern in modern JavaScript. Interviewers want to see if you can identify sequential vs parallel patterns and handle errors correctly.

**Follow-up: What happens if you forget `await`?**
The function returns the Promise object itself rather than the resolved value. You'd be working with `Promise { <pending> }` instead of the actual data — a silent bug that often manifests as `[object Promise]` in UI output.

---

## Q31. 🟡 What is the difference between Promise.all, Promise.allSettled, Promise.race, and Promise.any?

**Answer:**

All four methods accept an iterable of Promises and return a new Promise, but they differ in how they handle fulfillment and rejection.

| Method | Resolves when | Rejects when | Value on success |
|---|---|---|---|
| `Promise.all` | All promises fulfill | Any one rejects (fail-fast) | Array of all values (same order) |
| `Promise.allSettled` | All promises settle (either way) | Never rejects | Array of `{status, value/reason}` objects |
| `Promise.race` | First promise settles | First promise rejects | Value of the first settled promise |
| `Promise.any` | First promise fulfills | All promises reject | Value of the first fulfilled promise |

**Promise.all — all must succeed:**

```js
const results = await Promise.all([
  fetchUser(1),
  fetchPosts(1),
  fetchComments(1),
]);
// If fetchPosts rejects, the entire Promise.all rejects immediately
// results = [user, posts, comments]
```

**Promise.allSettled — get every result regardless:**

```js
const results = await Promise.allSettled([
  Promise.resolve('success'),
  Promise.reject(new Error('failed')),
  Promise.resolve('another success'),
]);

results.forEach((result) => {
  if (result.status === 'fulfilled') {
    console.log('Value:', result.value);
  } else {
    console.log('Error:', result.reason.message);
  }
});
// Value: success
// Error: failed
// Value: another success
```

**Promise.race — first to settle wins:**

```js
// Timeout pattern
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);

const result = await withTimeout(fetchData(), 5000);
```

**Promise.any — first to fulfill wins:**

```js
// Try multiple CDN sources, use whichever responds first
const asset = await Promise.any([
  fetch('https://cdn1.example.com/lib.js'),
  fetch('https://cdn2.example.com/lib.js'),
  fetch('https://cdn3.example.com/lib.js'),
]);
// Only rejects with AggregateError if ALL sources fail
```

**Why interviewer asks this:** Choosing the right combinator is a key engineering decision that affects correctness and resilience. Misusing `Promise.all` when you need `Promise.allSettled` is a common production bug.

**Follow-up: What error does Promise.any throw when all promises reject?**
It throws an `AggregateError`, which has an `errors` property containing an array of all the individual rejection reasons.

---

## Q32. 🟡 What is the difference between microtasks and macrotasks?

**Answer:**

The JavaScript runtime uses two distinct queues for async callbacks, and they have different priorities in the event loop.

**Macrotasks (Task Queue):**
- Sources: `setTimeout`, `setInterval`, `setImmediate` (Node.js), `MessageChannel`, I/O callbacks, UI rendering events
- One macrotask is dequeued per event loop iteration
- The browser may render between macrotasks

**Microtasks (Microtask Queue):**
- Sources: `Promise.then/catch/finally`, `queueMicrotask()`, `MutationObserver`, `async/await` continuations
- The entire microtask queue is drained after each task (and after each macrotask) before moving on
- Microtasks can starve macrotasks if they keep adding new microtasks

```js
console.log('--- script start ---');

setTimeout(() => console.log('macrotask: setTimeout'), 0);

Promise.resolve()
  .then(() => console.log('microtask: promise 1'))
  .then(() => console.log('microtask: promise 2'));

queueMicrotask(() => console.log('microtask: queueMicrotask'));

console.log('--- script end ---');

// Output:
// --- script start ---
// --- script end ---
// microtask: promise 1
// microtask: queueMicrotask
// microtask: promise 2
// macrotask: setTimeout
```

**Why the order matters — infinite microtask loop:**

```js
// DANGER: This will starve the event loop and freeze the browser
function infiniteMicrotasks() {
  Promise.resolve().then(infiniteMicrotasks);
}
// The microtask queue never empties, so macrotasks (like UI events) never run

// Compare with setTimeout — this is fine because it's a macrotask
function infiniteMacrotasks() {
  setTimeout(infiniteMacrotasks, 0);
  // Macrotasks yield to the event loop between iterations
}
```

**Practical implication:**

```js
async function example() {
  console.log('A');
  await Promise.resolve(); // schedules continuation as microtask
  console.log('B');        // runs before any setTimeout callbacks
}

example();
setTimeout(() => console.log('C'), 0);
console.log('D');

// Output: A, D, B, C
```

**Why interviewer asks this:** This question tests deep understanding of JavaScript's concurrency model. Getting this wrong can lead to subtle bugs in UI updates, test flakiness, or unexpected execution ordering.

**Follow-up: Can you force something to run as a microtask without a Promise?**
Yes — `queueMicrotask(fn)` schedules `fn` directly in the microtask queue without the overhead of creating a Promise.

---

## Q33. 🔴 How would you implement a simplified Promise from scratch?

**Answer:**

Implementing a Promise demonstrates understanding of state machines, callback queues, and async scheduling.

```js
class MyPromise {
  #state = 'pending';
  #value = undefined;
  #onFulfilledCallbacks = [];
  #onRejectedCallbacks = [];

  constructor(executor) {
    const resolve = (value) => {
      if (this.#state !== 'pending') return;

      // If resolving with another thenable, adopt its state
      if (value && typeof value.then === 'function') {
        value.then(resolve, reject);
        return;
      }

      this.#state = 'fulfilled';
      this.#value = value;
      // Schedule callbacks as microtasks (matching native Promise behavior)
      queueMicrotask(() => {
        this.#onFulfilledCallbacks.forEach((cb) => cb(this.#value));
      });
    };

    const reject = (reason) => {
      if (this.#state !== 'pending') return;
      this.#state = 'rejected';
      this.#value = reason;
      queueMicrotask(() => {
        this.#onRejectedCallbacks.forEach((cb) => cb(this.#value));
      });
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    // .then() always returns a new Promise (enabling chaining)
    return new MyPromise((resolve, reject) => {
      const handleFulfilled = (value) => {
        try {
          if (typeof onFulfilled === 'function') {
            resolve(onFulfilled(value));
          } else {
            resolve(value); // pass-through if no handler
          }
        } catch (err) {
          reject(err);
        }
      };

      const handleRejected = (reason) => {
        try {
          if (typeof onRejected === 'function') {
            resolve(onRejected(reason)); // note: resolve — handler "catches" the error
          } else {
            reject(reason); // propagate rejection
          }
        } catch (err) {
          reject(err);
        }
      };

      if (this.#state === 'fulfilled') {
        queueMicrotask(() => handleFulfilled(this.#value));
      } else if (this.#state === 'rejected') {
        queueMicrotask(() => handleRejected(this.#value));
      } else {
        // Still pending — store callbacks for later
        this.#onFulfilledCallbacks.push(handleFulfilled);
        this.#onRejectedCallbacks.push(handleRejected);
      }
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally();
        return value; // pass through resolved value
      },
      (reason) => {
        onFinally();
        throw reason; // re-throw rejection
      }
    );
  }

  // Static helpers
  static resolve(value) {
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let remaining = promises.length;

      if (remaining === 0) return resolve(results);

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then((value) => {
          results[index] = value;
          if (--remaining === 0) resolve(results);
        }, reject);
      });
    });
  }
}

// Usage — behaves like native Promise
const p = new MyPromise((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

p.then((val) => {
  console.log('Value:', val); // 42
  return val * 2;
})
  .then((val) => console.log('Doubled:', val)) // 84
  .catch((err) => console.error(err));
```

**Why interviewer asks this:** This is a senior-level question that tests deep understanding of Promises, microtask scheduling, and the A+ Promise specification. It reveals whether you truly understand the mechanism or just the API.

**Follow-up: What is the Promises/A+ specification?**
It is a community standard defining how `.then()` must behave — including the "promise resolution procedure" that handles thenables, state transitions, and asynchronous callback execution. Native browser Promises comply with A+.

---

## Q34. 🔴 What is AbortController and how do you use it?

**Answer:**

`AbortController` is a Web API that provides a way to cancel asynchronous operations. It consists of an `AbortController` instance and its associated `AbortSignal`, which can be passed to fetch and other APIs.

**Basic fetch cancellation:**

```js
const controller = new AbortController();
const { signal } = controller;

// Start a fetch request with the signal
fetch('/api/large-dataset', { signal })
  .then((res) => res.json())
  .then((data) => console.log('Data:', data))
  .catch((err) => {
    if (err.name === 'AbortError') {
      console.log('Fetch was cancelled');
    } else {
      console.error('Fetch failed:', err);
    }
  });

// Cancel the request after 3 seconds
setTimeout(() => controller.abort(), 3000);
```

**Cancel on user interaction (e.g., route change in SPA):**

```js
class DataService {
  #controller = null;

  async fetchUserData(userId) {
    // Cancel any in-flight request before starting a new one
    this.cancel();
    this.#controller = new AbortController();

    try {
      const res = await fetch(`/api/users/${userId}`, {
        signal: this.#controller.signal,
      });
      return await res.json();
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
      return null; // silently handle cancellation
    }
  }

  cancel() {
    this.#controller?.abort();
  }
}
```

**Custom abortable operation:**

```js
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

// Usage
const controller = new AbortController();
abortableDelay(5000, controller.signal)
  .then(() => console.log('Delay complete'))
  .catch((err) => {
    if (err.name === 'AbortError') console.log('Delay cancelled');
  });

controller.abort(); // cancel immediately
```

**Fetch with timeout using AbortSignal.timeout() (modern):**

```js
// AbortSignal.timeout() — built-in timeout without manual controller
async function fetchWithTimeout(url, ms = 5000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ms),
    });
    return await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`Request timed out after ${ms}ms`);
    }
    throw err;
  }
}
```

**Combining multiple signals:**

```js
// AbortSignal.any() — abort when any signal fires (modern browsers)
const userController = new AbortController();
const timeoutSignal = AbortSignal.timeout(10000);

const combinedSignal = AbortSignal.any([
  userController.signal,
  timeoutSignal,
]);

fetch('/api/data', { signal: combinedSignal });
```

**Why interviewer asks this:** AbortController solves real-world problems like preventing state updates on unmounted React components, avoiding race conditions in search inputs, and cancelling stale network requests. It is a mark of production-quality code.

**Follow-up: How would you implement a debounced search with AbortController?**
Keep a reference to the current controller, call `controller.abort()` at the start of each new debounced call, create a fresh controller, and pass its signal to the fetch. This ensures only the latest request's response is processed.

---

## ES6+ Modern Features

---

## Q35. 🟢 What are template literals and tagged templates?

**Answer:**

**Template literals** are string literals enclosed in backticks (`` ` ``) that support expression interpolation, multiline strings, and tagged template processing.

**Basic interpolation and multiline:**

```js
const name = 'Alice';
const age = 30;

// String concatenation (old way)
const greeting = 'Hello, ' + name + '! You are ' + age + ' years old.';

// Template literal
const greeting = `Hello, ${name}! You are ${age} years old.`;

// Expressions inside ${}
const price = 9.99;
const tax = 0.08;
console.log(`Total: $${(price * (1 + tax)).toFixed(2)}`); // Total: $10.79

// Multiline — preserves newlines
const html = `
  <div class="card">
    <h2>${name}</h2>
    <p>Age: ${age}</p>
  </div>
`;
```

**Tagged templates — advanced processing:**

A tag is a function that receives the string parts and interpolated values, returning any value.

```js
// Tag function signature: (strings, ...values)
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i] !== undefined
      ? `<mark>${values[i]}</mark>`
      : '';
    return result + str + value;
  }, '');
}

const user = 'Bob';
const score = 95;
const output = highlight`Player ${user} scored ${score} points!`;
// "Player <mark>Bob</mark> scored <mark>95</mark> points!"
```

**Practical use cases:**

```js
// SQL query builder (prevents injection by separating values)
function sql(strings, ...values) {
  const query = strings.join('?');
  return { query, params: values };
}

const userId = 42;
const { query, params } = sql`SELECT * FROM users WHERE id = ${userId}`;
// { query: "SELECT * FROM users WHERE id = ?", params: [42] }

// CSS-in-JS (like styled-components pattern)
function css(strings, ...values) {
  return strings.reduce((acc, str, i) => {
    return acc + str + (values[i] ?? '');
  }, '');
}

const primaryColor = '#3498db';
const styles = css`
  .button {
    background: ${primaryColor};
    padding: 8px 16px;
  }
`;

// Localization / i18n
function i18n(strings, ...values) {
  const key = strings.join('{?}');
  const translation = translations[key] || strings.join('{}');
  return translation.replace(/\{\}/g, () => values.shift());
}
```

**Raw strings with String.raw:**

```js
// String.raw is a built-in tag that avoids escape sequence processing
const path = String.raw`C:\Users\name\Documents`; // no need to escape backslashes
console.log(path); // C:\Users\name\Documents

const regex = String.raw`\d+\.\d+`; // useful for regex patterns
```

**Why interviewer asks this:** Template literals are ubiquitous in modern JavaScript. Tagged templates demonstrate advanced usage that powers libraries like `styled-components`, `graphql-tag`, and SQL builders.

**Follow-up: What is the difference between `strings` and `strings.raw` in a tag function?**
`strings` is an array of processed string parts (with escape sequences interpreted), while `strings.raw` contains the raw, unprocessed strings where `\n` stays as the two characters `\` and `n` rather than a newline.

---

## Q36. 🟡 How do Maps and Sets differ from plain objects and arrays, and what are WeakMap and WeakSet?

**Answer:**

**Map vs Object:**

| Feature | Object | Map |
|---|---|---|
| Key types | Strings and Symbols only | Any value (objects, functions, primitives) |
| Key order | Not guaranteed for non-string keys | Insertion order always preserved |
| Size | Manual (`Object.keys().length`) | `map.size` property |
| Iteration | Need `Object.entries()` | Directly iterable |
| Default keys | Has prototype keys (`toString`, etc.) | No default keys |
| Performance | Slower for frequent add/delete | Optimized for frequent mutations |

```js
const map = new Map();

// Any value as key
const objKey = { id: 1 };
const fnKey = () => {};

map.set(objKey, 'object key value');
map.set(fnKey, 'function key value');
map.set(42, 'number key value');
map.set('string', 'string key value');

console.log(map.get(objKey)); // "object key value"
console.log(map.size);        // 4

// Iterate in insertion order
for (const [key, value] of map) {
  console.log(key, '->', value);
}

// Convert to/from object
const obj = Object.fromEntries(map.entries()); // only string-keyed entries
const mapFromObj = new Map(Object.entries({ a: 1, b: 2 }));
```

**Set vs Array:**

| Feature | Array | Set |
|---|---|---|
| Duplicates | Allowed | No duplicates |
| Lookup | O(n) with indexOf/includes | O(1) with has() |
| Order | Index-based | Insertion order |
| Use case | Ordered list, may repeat | Unique values collection |

```js
const set = new Set([1, 2, 3, 2, 1]); // duplicates removed
console.log(set.size); // 3

set.add(4);
set.has(2); // true
set.delete(1);

// Deduplicate an array
const arr = [1, 2, 3, 2, 1, 3];
const unique = [...new Set(arr)]; // [1, 2, 3]

// Set operations
const setA = new Set([1, 2, 3, 4]);
const setB = new Set([3, 4, 5, 6]);

const union        = new Set([...setA, ...setB]);         // {1,2,3,4,5,6}
const intersection = new Set([...setA].filter(x => setB.has(x))); // {3,4}
const difference   = new Set([...setA].filter(x => !setB.has(x))); // {1,2}
```

**WeakMap and WeakSet:**

These "weak" variants hold references that do not prevent garbage collection of their keys.

| Feature | WeakMap | WeakSet |
|---|---|---|
| Key type | Objects only | Objects only |
| Prevents GC | No (weak reference) | No (weak reference) |
| Iterable | No | No |
| Size property | No | No |
| Use case | Private data, caching | Tracking object existence |

```js
// WeakMap: private data per instance
const _privateData = new WeakMap();

class User {
  constructor(name, password) {
    _privateData.set(this, { password });
    this.name = name;
  }

  checkPassword(input) {
    return _privateData.get(this).password === input;
  }
}

const user = new User('Alice', 'secret123');
console.log(user.checkPassword('secret123')); // true
// When 'user' is GC'd, its entry in _privateData is automatically removed

// WeakSet: track which objects have been processed
const processed = new WeakSet();

function process(obj) {
  if (processed.has(obj)) {
    return console.log('Already processed');
  }
  // ... do work
  processed.add(obj);
}
```

**Why interviewer asks this:** Maps and Sets are often better tools than objects/arrays for specific use cases. WeakMap/WeakSet knowledge signals awareness of memory management and advanced patterns.

**Follow-up: When would you use a Map over an object for configuration?**
When keys are not known at compile time, when keys are non-strings, or when you need to iterate in guaranteed insertion order. Maps also avoid prototype pollution risks present in plain objects.

---

## Q37. 🟡 What are optional chaining (?.) and nullish coalescing (??) and how do they differ from && and ||?

**Answer:**

**Optional chaining (`?.`)** allows safe access to nested properties without manually checking each level for `null` or `undefined`. It short-circuits and returns `undefined` if any part of the chain is nullish.

```js
const user = {
  profile: {
    address: {
      city: 'New York',
    },
  },
};

// Old way — verbose and error-prone
const city = user && user.profile && user.profile.address && user.profile.address.city;

// Optional chaining
const city = user?.profile?.address?.city; // "New York"
const zip  = user?.profile?.address?.zip;  // undefined (no error)

// With methods
const upper = user?.profile?.getName?.(); // undefined if getName doesn't exist

// With arrays
const first = user?.friends?.[0]?.name;

// With dynamic properties
const key = 'city';
const val = user?.profile?.address?.[key];
```

**Nullish coalescing (`??`)** returns the right-hand side only when the left side is `null` or `undefined` (nullish). This differs from `||` which triggers on any falsy value.

```js
// || uses falsy check — triggers on 0, '', false, NaN
const count = 0;
console.log(count || 10);  // 10 — wrong! 0 is falsy
console.log(count ?? 10);  // 0  — correct! 0 is not nullish

const name = '';
console.log(name || 'Anonymous');  // "Anonymous" — may not be desired
console.log(name ?? 'Anonymous');  // "" — preserves empty string

// Practical usage
function createWidget(options = {}) {
  return {
    width:   options.width   ?? 100,   // 0 is valid; null/undefined gets default
    height:  options.height  ?? 50,
    visible: options.visible ?? true,  // false is valid; null gets default
    label:   options.label   ?? 'Widget',
  };
}

createWidget({ width: 0, visible: false });
// { width: 0, height: 50, visible: false, label: 'Widget' }
// With ||: width would be 100 and visible would be true — wrong!
```

**Combining both:**

```js
const config = null;
const timeout = config?.settings?.timeout ?? 3000;
// If config is null, ?. returns undefined, ?? gives 3000
```

**Nullish assignment (`??=`):**

```js
let options = { theme: null, fontSize: 14 };
options.theme ??= 'dark';    // assigns because theme is null
options.fontSize ??= 16;     // does NOT assign because 14 is not nullish
console.log(options); // { theme: 'dark', fontSize: 14 }
```

**Why interviewer asks this:** These operators solve a very common class of bugs. Confusing `??` with `||` when dealing with falsy-but-valid values like `0`, `false`, or `''` is a frequent source of bugs in real applications.

**Follow-up: Can you use ?. to call a method that might not exist?**
Yes — `obj?.method?.()` is the pattern. The first `?.` checks if `obj` is nullish, the second `?.` checks if `method` is a function before calling it.

---

## Q38. 🟡 How do JavaScript modules work, and what is the difference between named and default exports, dynamic imports, and CommonJS vs ESM?

**Answer:**

JavaScript modules provide encapsulation and a standard way to share code across files.

**Named exports — multiple per file:**

```js
// math.js
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

// Importing named exports — name must match (or be aliased)
import { add, multiply, PI } from './math.js';
import { add as sum } from './math.js'; // aliased

// Import everything as a namespace
import * as math from './math.js';
math.add(1, 2);
```

**Default exports — one per file:**

```js
// logger.js
export default class Logger {
  log(msg) { console.log(`[LOG] ${msg}`); }
}

// Importing default — any name works
import Logger from './logger.js';
import MyLogger from './logger.js'; // same thing, different local name

// Combining default and named
// utils.js
export default function main() {}
export const helper = () => {};

import main, { helper } from './utils.js';
```

**Re-exporting (barrel files):**

```js
// index.js — public API surface
export { add, multiply } from './math.js';
export { default as Logger } from './logger.js';
export * from './utils.js';
```

**Dynamic imports — lazy loading:**

```js
// Static import (resolved at parse time, must be top-level)
import { heavyLib } from './heavy-lib.js';

// Dynamic import (returns a Promise, can be used anywhere)
async function loadFeature() {
  const { heavyLib } = await import('./heavy-lib.js');
  return heavyLib.process();
}

// Route-based code splitting
async function renderPage(route) {
  const { default: Page } = await import(`./pages/${route}.js`);
  document.body.appendChild(Page.render());
}
```

**CommonJS (CJS) vs ES Modules (ESM):**

| Feature | CommonJS | ESM |
|---|---|---|
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Loading | Synchronous, dynamic | Asynchronous, static |
| Tree shaking | Not supported | Supported |
| Top-level await | No | Yes |
| Environment | Node.js default (historically) | Browsers + modern Node.js |
| Live bindings | No (snapshot) | Yes (live reference) |

```js
// CommonJS
const path = require('path');
module.exports = { greet: (name) => `Hello, ${name}` };

// ESM
import path from 'path';
export const greet = (name) => `Hello, ${name}`;
```

**Live binding example (ESM-only):**

```js
// counter.js
export let count = 0;
export function increment() { count++; }

// main.js
import { count, increment } from './counter.js';
console.log(count); // 0
increment();
console.log(count); // 1 — ESM gives live binding, not a snapshot
```

**Why interviewer asks this:** Module systems underpin every modern JavaScript project. Understanding tree shaking, dynamic imports for code splitting, and CJS vs ESM interop is essential for building performant applications.

**Follow-up: How do you enable ESM in Node.js?**
Either set `"type": "module"` in `package.json` (all `.js` files become ESM), or use the `.mjs` extension for individual files. CJS files use `.cjs` extension in ESM projects.

---

## Q39. 🔴 What are WeakRef and FinalizationRegistry, and how do they relate to garbage collection?

**Answer:**

`WeakRef` and `FinalizationRegistry` are advanced GC-aware APIs that allow you to hold weak references to objects and run cleanup code when those objects are collected.

**WeakRef — weak reference to an object:**

A `WeakRef` does not prevent its target from being garbage collected. You must check if the target is still alive via `.deref()`.

```js
let obj = { data: 'important' };
const weakRef = new WeakRef(obj);

// While obj is reachable, deref() returns it
console.log(weakRef.deref()); // { data: 'important' }
console.log(weakRef.deref()?.data); // 'important'

// If obj gets GC'd (after setting to null and GC runs)
obj = null;
// At some point later:
console.log(weakRef.deref()); // undefined — object was collected
```

**FinalizationRegistry — cleanup callback on GC:**

```js
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`Object with id ${heldValue} was garbage collected`);
  // Clean up external resources associated with heldValue
});

let resource = { buffer: new ArrayBuffer(1024 * 1024) };
registry.register(resource, resource.id ?? 'resource-1');

resource = null; // eligible for GC
// When GC runs: "Object with id resource-1 was garbage collected"
```

**Practical use case — memory-sensitive cache:**

```js
class WeakCache {
  #cache = new Map();
  #registry = new FinalizationRegistry((key) => {
    // Clean up map entry when cached object is GC'd
    if (this.#cache.get(key)?.deref() === undefined) {
      this.#cache.delete(key);
      console.log(`Cache entry '${key}' evicted by GC`);
    }
  });

  set(key, value) {
    this.#cache.set(key, new WeakRef(value));
    this.#registry.register(value, key);
  }

  get(key) {
    const ref = this.#cache.get(key);
    if (!ref) return undefined;

    const value = ref.deref();
    if (value === undefined) {
      this.#cache.delete(key); // already collected, clean up
    }
    return value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}

const cache = new WeakCache();
let largeObject = { data: new Array(10000).fill(0) };
cache.set('large', largeObject);

console.log(cache.has('large')); // true
largeObject = null; // allow GC
// After GC: cache entry is automatically cleaned up
```

**Important caveats:**

```js
// GC timing is non-deterministic — NEVER rely on it for correctness
// WeakRef should be used for optimization (caching) not for correctness

// WRONG: using WeakRef as a communication channel
const ref = new WeakRef(someObj);
someObj = null;
// ref.deref() MIGHT still return the object or undefined — unpredictable

// FinalizationRegistry callbacks:
// - May never be called in short-lived programs
// - Are called asynchronously, after GC
// - Should only clean up truly optional resources
```

**Why interviewer asks this:** These APIs represent the frontier of JavaScript memory management. They are used in high-performance libraries, plugin systems, and frameworks that need to manage large or external resources without causing leaks.

**Follow-up: Why should you not use WeakRef for critical logic?**
GC behavior is implementation-defined and non-deterministic. The specification does not guarantee when (or even if) an object will be collected. Code relying on `.deref()` returning `undefined` for correctness will be unreliable across engines and environments.

---

## Error Handling & Debugging

---

## Q40. 🟢 How does error handling work in JavaScript?

**Answer:**

JavaScript uses `try/catch/finally` blocks for synchronous error handling, with specific patterns for async code.

**Synchronous error handling:**

```js
function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

try {
  const result = divide(10, 0);
  console.log(result); // never reached
} catch (error) {
  console.error('Caught:', error.message); // "Division by zero"
  console.error('Stack:', error.stack);
} finally {
  console.log('Always executes'); // cleanup code here
}
```

**Error object properties:**

```js
try {
  null.property; // TypeError
} catch (err) {
  console.log(err.name);    // "TypeError"
  console.log(err.message); // "Cannot read properties of null"
  console.log(err.stack);   // full stack trace string
}
```

**Custom error classes:**

```js
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class NetworkError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

function validateAge(age) {
  if (typeof age !== 'number') {
    throw new ValidationError('Age must be a number', 'age');
  }
  if (age < 0 || age > 150) {
    throw new ValidationError('Age must be between 0 and 150', 'age');
  }
}

try {
  validateAge('thirty');
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(`Validation failed on field: ${err.field}`); // "age"
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

**Async error handling:**

```js
// With Promises
fetch('/api/data')
  .then((res) => {
    if (!res.ok) throw new NetworkError('Request failed', res.status);
    return res.json();
  })
  .catch((err) => console.error(err));

// With async/await
async function loadData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new NetworkError('Request failed', res.status);
    return await res.json();
  } catch (err) {
    if (err instanceof NetworkError && err.statusCode === 401) {
      redirectToLogin();
    } else {
      throw err;
    }
  }
}
```

**Why interviewer asks this:** Robust error handling separates production-quality code from prototypes. Interviewers want to verify you understand synchronous vs async error propagation and custom error design.

**Follow-up: What happens if you throw inside a `finally` block?**
The error from `finally` replaces any error from `catch`. The original error is lost, which is usually undesirable. Avoid throwing in `finally` unless you explicitly want this behavior.

---

## Q41. 🟡 What are the different error types in JavaScript?

**Answer:**

JavaScript has several built-in error types, each representing a different category of problem.

| Error Type | When It Occurs |
|---|---|
| `Error` | Base type; generic errors |
| `SyntaxError` | Invalid JavaScript syntax (parse time) |
| `ReferenceError` | Accessing an undeclared variable |
| `TypeError` | Operation on wrong value type |
| `RangeError` | Value outside allowed range |
| `URIError` | Invalid URI encoding/decoding |
| `EvalError` | Issues with `eval()` (rare) |

```js
// SyntaxError — caught at parse/compile time, not runtime
// const x = ; // SyntaxError: Unexpected token ';'

// ReferenceError — accessing something that doesn't exist in scope
try {
  console.log(undeclaredVariable);
} catch (e) {
  console.log(e instanceof ReferenceError); // true
  console.log(e.message); // "undeclaredVariable is not defined"
}

// TypeError — wrong type operation
try {
  null.property;     // Cannot read properties of null
  undefined();       // undefined is not a function
  (1).toUpperCase(); // toUpperCase is not a function
} catch (e) {
  console.log(e instanceof TypeError); // true
}

// RangeError — value out of range
try {
  new Array(-1);          // Invalid array length
  (1.5).toFixed(200);    // toFixed() digits argument must be between 0 and 100
} catch (e) {
  console.log(e instanceof RangeError); // true
}
```

**Custom error hierarchy:**

```js
class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name; // automatically use subclass name
    this.code = code;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class HttpError extends AppError {
  constructor(statusCode, message) {
    super(message, `HTTP_${statusCode}`);
    this.statusCode = statusCode;
  }

  get isClientError() { return this.statusCode >= 400 && this.statusCode < 500; }
  get isServerError() { return this.statusCode >= 500; }
}

class NotFoundError extends HttpError {
  constructor(resource) {
    super(404, `${resource} not found`);
    this.resource = resource;
  }
}

// Usage
try {
  throw new NotFoundError('User');
} catch (err) {
  console.log(err instanceof NotFoundError); // true
  console.log(err instanceof HttpError);     // true
  console.log(err instanceof AppError);      // true
  console.log(err instanceof Error);         // true
  console.log(err.name);       // "NotFoundError"
  console.log(err.statusCode); // 404
  console.log(err.code);       // "HTTP_404"
}
```

**Why interviewer asks this:** Proper error typing enables precise `catch` logic, better logging, and accurate user messaging. Knowing built-in types demonstrates attention to code quality and debugging capability.

**Follow-up: Why do you need `Object.setPrototypeOf(this, new.target.prototype)` in custom errors?**
When transpiling to ES5 with Babel/TypeScript, `extends Error` breaks the prototype chain — `instanceof` checks fail for subclasses. `Object.setPrototypeOf` fixes this by explicitly restoring the correct prototype.

---

## Q42. 🟡 How do you debug and fix memory leaks in JavaScript?

**Answer:**

Memory leaks occur when objects are no longer needed but are still referenced, preventing garbage collection.

**Common causes of memory leaks:**

```js
// 1. Forgotten event listeners
const button = document.getElementById('btn');
function handleClick() { /* ... */ }

button.addEventListener('click', handleClick);
// LEAK: if button is removed from DOM but listener not removed
// FIX:
button.removeEventListener('click', handleClick);
// Or use AbortController:
const controller = new AbortController();
button.addEventListener('click', handleClick, { signal: controller.signal });
controller.abort(); // removes all listeners registered with this signal

// 2. Closures holding large objects
function createClosure() {
  const largeData = new Array(1000000).fill('data');

  return function() {
    // LEAK: largeData is captured even if not used
    console.log('hello');
  };
}

// FIX: null out the reference if not needed
function createClosure() {
  let largeData = new Array(1000000).fill('data');
  const processed = processData(largeData);
  largeData = null; // release the large array

  return function() {
    return processed;
  };
}

// 3. Growing arrays / caches without bounds
const cache = {};
function getUser(id) {
  if (!cache[id]) {
    cache[id] = fetchUser(id); // LEAK: cache grows forever
  }
  return cache[id];
}

// FIX: use LRU cache with size limit, or WeakMap
const cache = new Map();
const MAX_SIZE = 100;
function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  const user = fetchUser(id);
  if (cache.size >= MAX_SIZE) {
    cache.delete(cache.keys().next().value); // evict oldest
  }
  cache.set(id, user);
  return user;
}

// 4. Detached DOM nodes
let detachedTree;
function createLeak() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  detachedTree = el; // LEAK: keep reference after removal
  document.body.removeChild(el);
  // el is removed from DOM but JS still holds reference via detachedTree
}
```

**Using Chrome DevTools to detect leaks:**

1. Open DevTools > Memory tab
2. Take a **Heap Snapshot** (baseline)
3. Perform the action suspected of leaking
4. Take another Heap Snapshot
5. Select the second snapshot and change filter to **"Objects allocated between Snapshot 1 and Snapshot 2"**
6. Look for unexpectedly retained objects, detached DOM trees, and large arrays

```js
// Performance.measureUserAgentSpecificMemory() — programmatic check
async function checkMemory() {
  if (performance.measureUserAgentSpecificMemory) {
    const result = await performance.measureUserAgentSpecificMemory();
    console.log('Memory:', result.bytes / 1024 / 1024, 'MB');
  }
}
```

**WeakMap solution for object-associated data:**

```js
// Instead of storing metadata in a plain object (prevents GC)
const metadata = new Map(); // LEAK risk if keys are DOM nodes
metadata.set(domNode, { createdAt: Date.now() });

// Use WeakMap — key can be GC'd
const metadata = new WeakMap();
metadata.set(domNode, { createdAt: Date.now() });
// When domNode is removed and dereferenced, entry is automatically cleaned up
```

**Why interviewer asks this:** Memory leaks degrade performance over time and can crash long-running applications. The ability to diagnose them with DevTools is a practical senior engineering skill.

**Follow-up: How do you identify a memory leak in production?**
Monitor heap usage over time via performance metrics. A steadily increasing baseline that never decreases is a leak indicator. Use tools like Node.js `--inspect` with heap profiling, or browser RUM tools that expose memory metrics.

---

## Q43. 🔴 What are production error handling patterns?

**Answer:**

Production applications need layered error handling strategies beyond basic try/catch.

**Global error handlers:**

```js
// Browser — catch uncaught synchronous errors
window.onerror = (message, source, lineno, colno, error) => {
  reportError({ message, source, lineno, colno, stack: error?.stack });
  return true; // prevent default browser error dialog
};

// Browser — catch unhandled Promise rejections
window.addEventListener('unhandledrejection', (event) => {
  reportError({
    message: event.reason?.message || 'Unhandled rejection',
    stack: event.reason?.stack,
    type: 'unhandledRejection',
  });
  event.preventDefault(); // suppress console error
});

// Node.js equivalents
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1); // required — process is in undefined state
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});
```

**Retry with exponential backoff:**

```js
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryOn = (err) => err?.statusCode >= 500,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !retryOn(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100, // jitter
        maxDelay
      );

      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Usage
const data = await withRetry(
  () => fetch('/api/data').then((r) => r.json()),
  { maxAttempts: 4, baseDelay: 500 }
);
```

**Error boundary pattern (vanilla JS):**

```js
class ErrorBoundary {
  #fallback;
  #onError;

  constructor({ fallback, onError }) {
    this.#fallback = fallback;
    this.#onError = onError;
  }

  async execute(fn) {
    try {
      return await fn();
    } catch (error) {
      this.#onError?.(error);
      return this.#fallback;
    }
  }
}

const boundary = new ErrorBoundary({
  fallback: [],
  onError: (err) => reportError(err),
});

const users = await boundary.execute(() => fetchUsers());
```

**Structured error reporting:**

```js
function reportError(error, context = {}) {
  const report = {
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack,
    type: error?.name || 'Error',
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    buildVersion: process.env.BUILD_VERSION,
    ...context,
  };

  // Send to error tracking service (Sentry, Datadog, etc.)
  navigator.sendBeacon('/api/errors', JSON.stringify(report));

  // Also log to console in dev
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorReport]', report);
  }
}
```

**Circuit breaker pattern:**

```js
class CircuitBreaker {
  #state = 'closed'; // closed=normal, open=failing, half-open=testing
  #failures = 0;
  #lastFailureTime = null;
  #threshold;
  #timeout;

  constructor({ threshold = 5, timeout = 60000 } = {}) {
    this.#threshold = threshold;
    this.#timeout = timeout;
  }

  async execute(fn) {
    if (this.#state === 'open') {
      if (Date.now() - this.#lastFailureTime > this.#timeout) {
        this.#state = 'half-open';
      } else {
        throw new Error('Circuit is open — service unavailable');
      }
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure();
      throw error;
    }
  }

  #onSuccess() {
    this.#failures = 0;
    this.#state = 'closed';
  }

  #onFailure() {
    this.#failures++;
    this.#lastFailureTime = Date.now();
    if (this.#failures >= this.#threshold) {
      this.#state = 'open';
    }
  }
}
```

**Why interviewer asks this:** Production error handling demonstrates engineering maturity. Interviewers want to see you think beyond happy paths to resilience, observability, and user experience under failure.

**Follow-up: What is the difference between catching errors at the boundary vs inline?**
Inline handling is fine for expected, recoverable errors (validation, not-found). Boundary/global handlers are for unexpected errors — they prevent app crashes and ensure errors are always reported even when developers forgot a catch block.

---

## DOM, Events & Browser APIs

---

## Q44. 🟢 What is event delegation and why is it useful?

**Answer:**

**Event delegation** is the practice of attaching a single event listener to a parent element instead of individual listeners on each child. It works because of event **bubbling** — events propagate up the DOM tree from the target element to the root.

**Without delegation (inefficient):**

```js
// Adding a listener to every list item — bad for large lists or dynamic content
document.querySelectorAll('.list-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    console.log('Clicked:', e.target.textContent);
  });
});
// Problems:
// 1. Memory: N listeners for N items
// 2. Dynamic items added later won't have listeners
// 3. Must manually remove listeners to avoid leaks
```

**With delegation (efficient):**

```js
const list = document.getElementById('item-list');

list.addEventListener('click', (event) => {
  // event.target — the actual element clicked
  // event.currentTarget — the element with the listener (list)
  const item = event.target.closest('.list-item');

  if (!item) return; // click was on the list itself, not an item

  const action = item.dataset.action;

  if (action === 'delete') {
    item.remove();
  } else if (action === 'edit') {
    openEditor(item.dataset.id);
  } else {
    console.log('Selected:', item.dataset.id);
  }
});

// Dynamically added items work automatically
const newItem = document.createElement('li');
newItem.className = 'list-item';
newItem.dataset.id = '42';
newItem.dataset.action = 'delete';
newItem.textContent = 'New Item';
list.appendChild(newItem); // this item is handled by the existing listener
```

**target vs currentTarget:**

```js
document.getElementById('parent').addEventListener('click', (e) => {
  console.log(e.target);        // the element that was actually clicked
  console.log(e.currentTarget); // the element the listener is attached to (parent)
  // e.currentTarget === this (inside regular function handlers)
});
```

**Practical table row delegation:**

```js
document.querySelector('tbody').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;

  const row = button.closest('tr');
  const { action } = button.dataset;
  const { id } = row.dataset;

  const actions = {
    edit: () => editRow(id),
    delete: () => deleteRow(id),
    view: () => viewRow(id),
  };

  actions[action]?.();
});
```

**Why interviewer asks this:** Event delegation is a fundamental performance pattern for interactive UIs with lists, tables, or dynamic content. It is also the basis for understanding how frameworks like React implement their synthetic event system.

**Follow-up: Are there cases where event delegation does not work well?**
Yes — events that do not bubble (`focus`, `blur`, `mouseenter`, `mouseleave`) cannot be delegated. Use the capturing phase (`addEventListener('focus', fn, true)`) or the bubbling equivalents (`focusin`, `focusout`, `mouseover`, `mouseout`) instead.

---

## Q45. 🟡 What are the three phases of event propagation?

**Answer:**

When a DOM event fires, it travels through three distinct phases:

**1. Capture Phase (top-down)** — Event travels from `window` down through ancestors to the target.
**2. Target Phase** — Event reaches the element that triggered it.
**3. Bubble Phase (bottom-up)** — Event travels back up from the target to `window`.

```
window
  └── document
        └── html
              └── body
                    └── div#parent
                          └── button#child  ← click here
```

```js
const parent = document.getElementById('parent');
const child = document.getElementById('child');

// Third argument: true = capture phase, false/omitted = bubble phase (default)
parent.addEventListener('click', () => console.log('Parent CAPTURE'), true);
child.addEventListener('click',  () => console.log('Child CAPTURE'),  true);
parent.addEventListener('click', () => console.log('Parent BUBBLE'),  false);
child.addEventListener('click',  () => console.log('Child BUBBLE'),   false);

// Clicking #child outputs:
// Parent CAPTURE  (capture phase, top-down)
// Child CAPTURE   (capture phase, at target)
// Child BUBBLE    (bubble phase, at target)
// Parent BUBBLE   (bubble phase, bottom-up)
```

**Controlling propagation:**

```js
element.addEventListener('click', (e) => {
  // Stop bubbling — event does NOT travel further up the tree
  e.stopPropagation();

  // Stop all listeners — even other listeners ON THIS SAME ELEMENT are skipped
  e.stopImmediatePropagation();

  // Prevent default browser action (form submit, link navigation, checkbox toggle)
  e.preventDefault();

  // Check if propagation was stopped
  console.log(e.cancelable);  // true if preventDefault() has any effect
  console.log(e.bubbles);     // true if event bubbles
});
```

**Real-world example — modal close:**

```js
const modal = document.getElementById('modal');
const overlay = document.getElementById('overlay');

// Close modal when clicking the overlay, but NOT when clicking the modal content
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeModal();
  }
});

// Or using stopPropagation on the modal content
modal.addEventListener('click', (e) => {
  e.stopPropagation(); // prevent click from reaching overlay
});
```

**Why interviewer asks this:** Event propagation is essential knowledge for building correct event-driven UIs. Misunderstanding bubbling leads to bugs like modal close-on-content-click or unexpected event handlers firing.

**Follow-up: What is the difference between `stopPropagation` and `stopImmediatePropagation`?**
`stopPropagation` prevents the event from moving to parent/child elements but allows other listeners on the same element to run. `stopImmediatePropagation` also prevents other listeners registered on the same element from executing.

---

## Q46. 🟡 What are the differences between localStorage, sessionStorage, and cookies?

**Answer:**

All three provide client-side storage, but they differ significantly in scope, lifetime, capacity, and behavior.

| Feature | localStorage | sessionStorage | Cookies |
|---|---|---|---|
| Capacity | ~5–10 MB | ~5–10 MB | ~4 KB |
| Lifetime | Persistent (until cleared) | Until tab/window closed | Set by `Expires`/`Max-Age` (or session) |
| Scope | Origin (protocol + domain + port) | Origin + tab | Domain + path (configurable) |
| Server access | No (JS only) | No (JS only) | Yes (sent with every HTTP request) |
| Auto-expiry | No | Yes (on tab close) | Yes (if Max-Age set) |
| Accessible via JS | Yes | Yes | Yes (unless HttpOnly) |
| Security flags | None | None | HttpOnly, Secure, SameSite |
| Synchronous API | Yes | Yes | Yes (document.cookie) |

**localStorage — persistent across sessions:**

```js
// Store data
localStorage.setItem('theme', 'dark');
localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Alice' }));

// Retrieve data
const theme = localStorage.getItem('theme'); // "dark"
const user = JSON.parse(localStorage.getItem('user')); // { id: 1, name: 'Alice' }

// Remove data
localStorage.removeItem('theme');
localStorage.clear(); // clear all

// Listening for changes (from other tabs/windows)
window.addEventListener('storage', (e) => {
  console.log('Key changed:', e.key);
  console.log('Old value:', e.oldValue);
  console.log('New value:', e.newValue);
});
```

**sessionStorage — tab-scoped:**

```js
// Same API as localStorage
sessionStorage.setItem('formDraft', JSON.stringify(formData));
const draft = JSON.parse(sessionStorage.getItem('formDraft'));

// Cleared when:
// - Tab is closed
// - Browser is closed
// NOT cleared on page refresh
```

**Cookies — sent to server automatically:**

```js
// Setting a cookie via JS (basic)
document.cookie = 'name=Alice; path=/; max-age=3600; SameSite=Lax';

// Reading cookies
const cookies = document.cookie; // "name=Alice; theme=dark" (all at once)
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
};

// Modern Cookie Store API (async, no string parsing)
const value = await cookieStore.get('name');
await cookieStore.set({ name: 'theme', value: 'dark', maxAge: 86400 });
await cookieStore.delete('name');
```

**Security considerations:**

```js
// Cookies with security flags (set server-side):
// HttpOnly — not accessible via JS (XSS protection)
// Secure — only sent over HTTPS
// SameSite=Strict — not sent on cross-site requests (CSRF protection)

// localStorage/sessionStorage are vulnerable to XSS
// Never store auth tokens in localStorage if XSS is a concern
// Prefer HttpOnly cookies for session tokens
```

**Why interviewer asks this:** Storage choice has direct security and UX implications. Interviewers want to see you understand when to use each, especially around authentication tokens and sensitive data.

**Follow-up: Why should you not store JWT tokens in localStorage?**
localStorage is accessible to any JavaScript on the page, including injected scripts from XSS attacks. An HttpOnly cookie cannot be read by JavaScript at all, making it much safer for storing authentication tokens.

---

## Q47. 🔴 What are Web Workers and Service Workers?

**Answer:**

Both APIs enable JavaScript to run off the main thread, but they serve very different purposes.

**Web Workers — off-main-thread computation:**

Web Workers run scripts in background threads without blocking the UI. They communicate with the main thread via message passing (no shared memory by default).

```js
// worker.js — runs in a separate thread
self.addEventListener('message', (event) => {
  const { data, id } = event.data;

  // Heavy computation without blocking UI
  const result = heavyCalculation(data);

  self.postMessage({ result, id });
});

function heavyCalculation(data) {
  // Simulate expensive work
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += Math.sqrt(data[i]);
  }
  return sum;
}
```

```js
// main.js — create and communicate with worker
const worker = new Worker('./worker.js');

worker.addEventListener('message', (event) => {
  const { result, id } = event.data;
  console.log(`Task ${id} result:`, result);
});

worker.addEventListener('error', (err) => {
  console.error('Worker error:', err);
});

// Send data to worker (structured clone algorithm — no shared references)
worker.postMessage({ data: [1, 4, 9, 16, 25], id: 1 });

// SharedArrayBuffer for truly shared memory (requires COOP/COEP headers)
const buffer = new SharedArrayBuffer(1024);
const view = new Int32Array(buffer);
worker.postMessage({ buffer }, [buffer]); // transfer ownership (Transferable)
```

**Service Workers — network proxy and offline support:**

Service Workers are special workers that act as a proxy between the browser and network. They enable PWA features: offline caching, background sync, and push notifications.

```js
// service-worker.js
const CACHE_NAME = 'app-v1';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/styles.css'];

// Install event — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // activate immediately
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch event — serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached; // Cache hit

      // Cache miss — fetch from network and cache for next time
      return fetch(event.request).then((response) => {
        if (!response.ok) return response;

        const clone = response.clone(); // response is consumed once
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
```

```js
// main.js — register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/service-worker.js', { scope: '/' })
    .then((registration) => {
      console.log('SW registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUser('New version available — please refresh');
          }
        });
      });
    })
    .catch((err) => console.error('SW registration failed:', err));
}
```

**Comparison:**

| Feature | Web Worker | Service Worker |
|---|---|---|
| Purpose | CPU-intensive tasks | Network proxy, caching |
| Lifecycle | Tied to page | Independent of page |
| Access to DOM | No | No |
| HTTP intercept | No | Yes |
| Offline support | No | Yes |
| Push notifications | No | Yes |
| Multiple instances | Yes (per page) | One per scope |

**Why interviewer asks this:** These APIs enable production-quality PWAs and prevent performance degradation from heavy computation. Understanding them is essential for senior front-end roles.

**Follow-up: Can a Service Worker intercept all requests?**
No — Service Workers only intercept requests from pages within their scope. Cross-origin requests are intercepted but cannot be modified for cross-origin responses without CORS headers. Also, Service Workers are not active during the first page load before registration completes.

---

## Performance & Design Patterns

---

## Q48. 🟡 What are common JavaScript performance optimization techniques?

**Answer:**

Performance optimization in JavaScript spans computation, rendering, network, and memory concerns.

**Lazy loading — defer what is not needed now:**

```js
// Dynamic imports for code splitting
const loadChart = async () => {
  const { Chart } = await import('./chart-library.js');
  return new Chart(document.getElementById('canvas'));
};

// Intersection Observer for lazy image loading
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
}, { rootMargin: '200px' }); // load 200px before entering viewport

document.querySelectorAll('img[data-src]').forEach((img) => observer.observe(img));
```

**Memoization — cache expensive computations:**

```js
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n) => {
  console.log('Computing...');
  return n * n * n;
});

expensiveCalc(10); // "Computing..." → 1000
expensiveCalc(10); // (from cache) → 1000
```

**requestAnimationFrame — smooth animations:**

```js
// BAD — forces synchronous layout and causes jank
function animateBad() {
  element.style.left = element.offsetLeft + 1 + 'px';
  setTimeout(animateBad, 16);
}

// GOOD — synced to browser repaint cycle
function animate() {
  element.style.transform = `translateX(${position}px)`;
  position++;
  if (position < 500) {
    requestAnimationFrame(animate);
  }
}
requestAnimationFrame(animate);
```

**Avoid layout thrashing (reflows):**

```js
// BAD — reads and writes interleaved, forces multiple reflows
elements.forEach((el) => {
  const height = el.offsetHeight; // read (forces reflow)
  el.style.height = height * 2 + 'px'; // write (invalidates layout)
  const width = el.offsetWidth; // read (forces ANOTHER reflow)
  el.style.width = width + 'px'; // write
});

// GOOD — batch reads, then batch writes
const measurements = elements.map((el) => ({
  height: el.offsetHeight, // all reads first
  width: el.offsetWidth,
}));

elements.forEach((el, i) => {
  el.style.height = measurements[i].height * 2 + 'px'; // all writes after
  el.style.width = measurements[i].width + 'px';
});

// Use DocumentFragment for DOM batch inserts
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  fragment.appendChild(li);
}
list.appendChild(fragment); // single reflow
```

**Debounce and throttle:**

```js
// Debounce — run after a pause (search input)
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Throttle — run at most once per interval (scroll handler)
function throttle(fn, interval) {
  let lastTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn(...args);
    }
  };
}

window.addEventListener('scroll', throttle(updateScrollPosition, 100));
searchInput.addEventListener('input', debounce(fetchResults, 300));
```

**Why interviewer asks this:** Performance is a first-class concern in production apps. Knowing specific techniques like rAF, layout batching, and debouncing shows you can build smooth, scalable UIs.

**Follow-up: What is the difference between debounce and throttle?**
Debounce delays execution until the triggering stops for a given duration — ideal for inputs. Throttle limits execution to once per interval regardless of how often the event fires — ideal for scroll or resize handlers where you want regular but rate-limited updates.

---

## Q49. 🔴 What are common JavaScript design patterns?

**Answer:**

Design patterns are reusable solutions to common software design problems.

**Module Pattern — encapsulation:**

```js
// IIFE-based module (pre-ES6)
const Counter = (() => {
  let count = 0; // private

  return {
    increment() { count++; },
    decrement() { count--; },
    getCount() { return count; },
    reset() { count = 0; },
  };
})();

Counter.increment();
Counter.increment();
console.log(Counter.getCount()); // 2
console.log(Counter.count);      // undefined — private!

// ES6 module version (preferred)
let count = 0;
export const increment = () => ++count;
export const getCount = () => count;
```

**Singleton Pattern — single instance:**

```js
class AppConfig {
  static #instance = null;

  #settings = {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    debug: false,
  };

  constructor() {
    if (AppConfig.#instance) {
      return AppConfig.#instance;
    }
    AppConfig.#instance = this;
  }

  get(key) { return this.#settings[key]; }

  set(key, value) {
    this.#settings[key] = value;
    return this;
  }

  static getInstance() {
    if (!AppConfig.#instance) new AppConfig();
    return AppConfig.#instance;
  }
}

const config1 = AppConfig.getInstance();
const config2 = AppConfig.getInstance();
console.log(config1 === config2); // true — same instance
config1.set('debug', true);
console.log(config2.get('debug')); // true
```

**Observer Pattern — event-driven pub/sub:**

```js
class EventEmitter {
  #listeners = new Map();

  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.off(event, callback); // return unsubscribe fn
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  emit(event, ...args) {
    this.#listeners.get(event)?.forEach((cb) => cb(...args));
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

const store = new EventEmitter();

const unsubscribe = store.on('userLoggedIn', (user) => {
  console.log('Welcome,', user.name);
});

store.emit('userLoggedIn', { name: 'Alice' }); // "Welcome, Alice"
unsubscribe(); // remove listener
store.emit('userLoggedIn', { name: 'Bob' }); // no output — unsubscribed
```

**Factory Pattern — object creation abstraction:**

```js
class Animal {
  constructor(name, sound) {
    this.name = name;
    this.sound = sound;
  }
  speak() { return `${this.name} says ${this.sound}`; }
}

class Dog extends Animal {
  constructor() { super('Dog', 'Woof'); }
  fetch() { return 'Fetching...'; }
}

class Cat extends Animal {
  constructor() { super('Cat', 'Meow'); }
  purr() { return 'Purrrr...'; }
}

// Factory — centralized creation logic
class AnimalFactory {
  static #registry = new Map([
    ['dog', Dog],
    ['cat', Cat],
  ]);

  static create(type, ...args) {
    const AnimalClass = this.#registry.get(type.toLowerCase());
    if (!AnimalClass) throw new Error(`Unknown animal type: ${type}`);
    return new AnimalClass(...args);
  }

  static register(type, cls) {
    this.#registry.set(type, cls);
  }
}

const dog = AnimalFactory.create('dog');
console.log(dog.speak()); // "Dog says Woof"
```

**Strategy Pattern — interchangeable algorithms:**

```js
// Sorting strategies
const strategies = {
  bubble: (arr) => { /* bubble sort impl */ return arr; },
  quick: (arr) => { /* quicksort impl */ return [...arr].sort((a, b) => a - b); },
  merge: (arr) => { /* mergesort impl */ return arr; },
};

class Sorter {
  #strategy;

  constructor(strategyName = 'quick') {
    this.setStrategy(strategyName);
  }

  setStrategy(name) {
    if (!strategies[name]) throw new Error(`Unknown strategy: ${name}`);
    this.#strategy = strategies[name];
  }

  sort(data) {
    return this.#strategy(data);
  }
}

const sorter = new Sorter('quick');
console.log(sorter.sort([3, 1, 4, 1, 5, 9]));
sorter.setStrategy('bubble');
console.log(sorter.sort([3, 1, 4, 1, 5, 9]));
```

**Why interviewer asks this:** Design patterns demonstrate architectural thinking. Knowing them by name allows you to communicate solutions efficiently and shows you have solved complex problems before.

**Follow-up: What is the difference between the Factory and Builder patterns?**
Factory creates a complete object in one call — suitable when all configuration is known upfront. Builder constructs complex objects step-by-step, allowing incremental configuration before a final `build()` call — suitable for objects with many optional parameters.

---

## Q50. 🔴 What is the difference between imperative and declarative programming, and what are functional programming principles?

**Answer:**

**Imperative programming** describes *how* to do something — you write explicit step-by-step instructions and mutate state directly.

**Declarative programming** describes *what* you want — you express the desired outcome and let the system figure out the implementation.

```js
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// IMPERATIVE — explicit control flow and mutation
const evenSquaresImperative = [];
for (let i = 0; i < numbers.length; i++) {
  if (numbers[i] % 2 === 0) {
    evenSquaresImperative.push(numbers[i] * numbers[i]);
  }
}

// DECLARATIVE — describes the transformation
const evenSquaresDeclarative = numbers
  .filter((n) => n % 2 === 0)
  .map((n) => n * n);
// [4, 16, 36, 64, 100]
```

**Core Functional Programming principles:**

**1. Pure Functions — same input always produces same output, no side effects:**

```js
// IMPURE — depends on external state, has side effects
let total = 0;
function addToTotal(n) {
  total += n; // mutates external state
  console.log(total); // side effect
  return total;
}

// PURE — deterministic, no side effects
function add(a, b) {
  return a + b; // depends only on arguments, returns new value
}
```

**2. Immutability — never mutate data, create new versions:**

```js
// MUTABLE (imperative)
const user = { name: 'Alice', age: 30 };
user.age = 31; // mutates original

// IMMUTABLE (functional)
const updatedUser = { ...user, age: 31 }; // new object
const arr = [1, 2, 3];
const newArr = [...arr, 4]; // new array

// Deep immutability with structuredClone or libraries like Immer
const state = { users: [{ id: 1, name: 'Alice' }] };
const newState = {
  ...state,
  users: state.users.map((u) =>
    u.id === 1 ? { ...u, name: 'Alicia' } : u
  ),
};
```

**3. Higher-order functions — functions that take or return functions:**

```js
// Functions as arguments
const double = (n) => n * 2;
const isEven = (n) => n % 2 === 0;

[1, 2, 3, 4].filter(isEven).map(double); // [4, 8]

// Functions returning functions
const multiply = (factor) => (n) => n * factor;
const triple = multiply(3);
const quadruple = multiply(4);

triple(5);    // 15
quadruple(5); // 20
```

**4. Function Composition — combine simple functions into complex ones:**

```js
// Compose: apply right-to-left (mathematical convention)
const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);

// Pipe: apply left-to-right (more readable)
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const trim = (s) => s.trim();
const toLowerCase = (s) => s.toLowerCase();
const removeSpaces = (s) => s.replace(/\s+/g, '-');
const addPrefix = (s) => `blog-${s}`;

const slugify = pipe(trim, toLowerCase, removeSpaces, addPrefix);

console.log(slugify('  Hello World Post  ')); // "blog-hello-world-post"
```

**5. Currying — transform multi-arg functions into single-arg chains:**

```js
// Normal function
const add = (a, b) => a + b;

// Curried version
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5);
add5(3); // 8
add5(10); // 15

// Auto-curry utility
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
}

const curriedMultiply = curry((a, b, c) => a * b * c);
curriedMultiply(2)(3)(4); // 24
curriedMultiply(2, 3)(4); // 24
curriedMultiply(2)(3, 4); // 24
```

**6. Avoiding side effects in practice:**

```js
// Side effects are inevitable (I/O, DOM, network) — isolate them
// Pure core logic
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function applyDiscount(total, discountPercent) {
  return total * (1 - discountPercent / 100);
}

// Impure shell (side effects at the boundary)
async function processOrder(userId) {
  const items = await fetchCartItems(userId); // side effect
  const total = calculateTotal(items);        // pure
  const discounted = applyDiscount(total, 10); // pure
  await saveOrder(userId, discounted);         // side effect
  return discounted;
}
```

**Declarative patterns in modern JavaScript:**

```js
// React — declarative UI
const UserList = ({ users }) => (
  <ul>
    {users.map((user) => <li key={user.id}>{user.name}</li>)}
  </ul>
);

// SQL is declarative
// SELECT name FROM users WHERE age > 18 ORDER BY name

// CSS is declarative
// .button { color: blue; } — describe desired state, not how to render it

// Array methods — declarative data transformation
const report = transactions
  .filter((t) => t.date >= startDate)
  .map((t) => ({ ...t, amount: t.amount * exchangeRate }))
  .reduce((totals, t) => ({
    ...totals,
    [t.category]: (totals[t.category] || 0) + t.amount,
  }), {});
```

**Why interviewer asks this:** Functional and declarative thinking is foundational to modern JavaScript (React, Redux, RxJS). Pure functions are predictable, testable, and composable. Interviewers want to assess your ability to write maintainable, side-effect-free code at scale.

**Follow-up: Can JavaScript be a purely functional language?**
No — JavaScript is a multi-paradigm language. It supports functional style but also allows mutation and side effects. The goal is not to eliminate side effects (impossible in real apps) but to isolate them, keeping the majority of logic pure and composable.


---

# Part 2: Coding Problems (50 Problems)


---

## Table of Contents

### Arrays & Strings (1–10)
1. [Two Sum](#problem-1)
2. [Reverse a String](#problem-2)
3. [Find the Largest Number in an Array](#problem-3)
4. [Remove Duplicates from Array](#problem-4)
5. [Flatten a Nested Array](#problem-5)
6. [Find All Anagrams](#problem-6)
7. [Longest Substring Without Repeating Characters](#problem-7)
8. [Array Chunk](#problem-8)
9. [String Compression](#problem-9)
10. [Maximum Subarray Sum (Kadane's Algorithm)](#problem-10)

### Objects & Data Structures (11–15)
11. [Deep Clone an Object](#problem-11)
12. [Implement a Hash Map](#problem-12)
13. [Group Array of Objects by Property](#problem-13)
14. [Implement a Stack and Queue](#problem-14)
15. [LRU Cache](#problem-15)

### Functions & Closures (16–20)
16. [Counter Using Closures](#problem-16)
17. [Debounce Function](#problem-17)
18. [Throttle Function](#problem-18)
19. [Function.prototype.bind Polyfill](#problem-19)
20. [Memoize Function](#problem-20)

### Recursion & Trees (21–25)
21. [Fibonacci Sequence](#problem-21)
22. [Binary Search](#problem-22)
23. [Flatten a Nested Object to Dot-Notation Keys](#problem-23)
24. [Basic Binary Search Tree](#problem-24)
25. [Serialize and Deserialize a Binary Tree](#problem-25)

---

## Arrays & Strings

---

## Problem 1. 🟢 Two Sum

**Problem:** Given an array of integers `nums` and a target integer `target`, return the indices of the two numbers that add up to the target. Each input has exactly one solution, and the same element cannot be used twice.

**Examples:**
```
twoSum([2, 7, 11, 15], 9)  → [0, 1]   // 2 + 7 = 9
twoSum([3, 2, 4], 6)       → [1, 2]   // 2 + 4 = 6
twoSum([3, 3], 6)          → [0, 1]
```

**Solution:**
```js
/**
 * Two Sum — O(n) time using a hash map to store complements.
 * @param {number[]} nums
 * @param {number} target
 * @returns {number[]} indices of the two numbers
 */
function twoSum(nums, target) {
  // Map stores: { value → index } for O(1) lookup
  const seen = new Map();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];

    if (seen.has(complement)) {
      // Found the pair — return both indices
      return [seen.get(complement), i];
    }

    // Record this number and its index for future lookups
    seen.set(nums[i], i);
  }

  // Problem guarantees a solution exists, but guard anyway
  return [];
}

// Tests
console.log(twoSum([2, 7, 11, 15], 9));  // [0, 1]
console.log(twoSum([3, 2, 4], 6));       // [1, 2]
console.log(twoSum([3, 3], 6));          // [0, 1]
```

**Explanation:** For each number, we compute its complement (`target - num`) and check if we have already seen it in the hash map. If yes, we found our pair. If no, we store the current number and its index. This single-pass approach avoids the O(n²) brute-force nested loop. Time complexity is O(n), space complexity is O(n) for the map.

---

## Problem 2. 🟢 Reverse a String

**Problem:** Reverse a string without using the built-in `.reverse()` method. Return the reversed string.

**Examples:**
```
reverseString("hello")     → "olleh"
reverseString("JavaScript") → "tpircSavaJ"
reverseString("a")         → "a"
reverseString("")          → ""
```

**Solution:**
```js
/**
 * Reverse a string using a two-pointer swap in a character array.
 * @param {string} str
 * @returns {string}
 */
function reverseString(str) {
  // Convert to array because strings are immutable in JS
  const chars = str.split('');
  let left = 0;
  let right = chars.length - 1;

  while (left < right) {
    // Swap characters at the two pointers
    [chars[left], chars[right]] = [chars[right], chars[left]];
    left++;
    right--;
  }

  return chars.join('');
}

// Alternative: single-line using reduce (more functional style)
function reverseStringFunctional(str) {
  return str.split('').reduce((reversed, char) => char + reversed, '');
}

// Tests
console.log(reverseString("hello"));      // "olleh"
console.log(reverseString("JavaScript")); // "tpircSavaJ"
console.log(reverseString(""));           // ""
```

**Explanation:** The two-pointer approach converts the string to an array (since strings are immutable in JavaScript), then swaps characters from both ends moving inward until the pointers meet. This runs in O(n) time and O(n) space (for the character array). The functional `reduce` alternative is more concise but builds intermediate strings, making it slightly less efficient in practice.

---

## Problem 3. 🟢 Find the Largest Number in an Array

**Problem:** Find the largest number in an array of numbers. Handle edge cases: empty arrays, arrays with one element, negative numbers, and non-numeric values.

**Examples:**
```
findLargest([3, 1, 4, 1, 5, 9, 2, 6])  → 9
findLargest([-5, -1, -3])              → -1
findLargest([42])                      → 42
findLargest([])                        → null
```

**Solution:**
```js
/**
 * Find the largest number in an array.
 * @param {number[]} nums
 * @returns {number|null} largest number, or null for empty arrays
 */
function findLargest(nums) {
  // Edge case: empty array has no largest element
  if (!nums || nums.length === 0) return null;

  // Start with the first element as the baseline
  let largest = nums[0];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > largest) {
      largest = nums[i];
    }
  }

  return largest;
}

// Alternative using Math.max with spread (clean but limited by call stack size)
function findLargestBuiltIn(nums) {
  if (!nums || nums.length === 0) return null;
  return Math.max(...nums);
}

// Safe alternative for very large arrays (avoids spread stack overflow)
function findLargestSafe(nums) {
  if (!nums || nums.length === 0) return null;
  return nums.reduce((max, num) => (num > max ? num : max), nums[0]);
}

// Tests
console.log(findLargest([3, 1, 4, 1, 5, 9, 2, 6])); // 9
console.log(findLargest([-5, -1, -3]));              // -1
console.log(findLargest([]));                        // null
console.log(findLargest([42]));                      // 42
```

**Explanation:** The manual loop initializes the max to the first element (not 0 or -Infinity, to handle all-negative arrays correctly) then scans through the rest. `Math.max(...nums)` is a clean one-liner but will throw a `RangeError` for arrays with hundreds of thousands of elements due to the call-stack limit on spread. The `reduce` variant is both safe and idiomatic. All approaches run in O(n) time and O(1) auxiliary space.

---

## Problem 4. 🟢 Remove Duplicates from Array

**Problem:** Given an array, return a new array with all duplicate values removed. Preserve the original order of first occurrence.

**Examples:**
```
removeDuplicates([1, 2, 2, 3, 4, 4, 5])       → [1, 2, 3, 4, 5]
removeDuplicates(["a", "b", "a", "c", "b"])    → ["a", "b", "c"]
removeDuplicates([1, 1, 1])                    → [1]
removeDuplicates([])                           → []
```

**Solution:**
```js
/**
 * Approach 1: Using Set (cleanest — O(n) time, O(n) space)
 * A Set automatically enforces uniqueness and preserves insertion order.
 */
function removeDuplicatesSet(arr) {
  return [...new Set(arr)];
}

/**
 * Approach 2: Using filter + indexOf (more readable, O(n²) time)
 * Keeps only the first occurrence of each element.
 */
function removeDuplicatesFilter(arr) {
  return arr.filter((item, index) => arr.indexOf(item) === index);
}

/**
 * Approach 3: Using reduce + includes (explicit, O(n²) time)
 * Builds the result array manually, adding only unseen items.
 */
function removeDuplicatesReduce(arr) {
  return arr.reduce((unique, item) => {
    if (!unique.includes(item)) unique.push(item);
    return unique;
  }, []);
}

/**
 * Approach 4: Manual hash map (O(n) time — best when Set is off-limits)
 */
function removeDuplicatesMap(arr) {
  const seen = {};
  const result = [];

  for (const item of arr) {
    // Use string key to handle mixed types consistently
    const key = typeof item + ':' + item;
    if (!seen[key]) {
      seen[key] = true;
      result.push(item);
    }
  }

  return result;
}

// Tests
console.log(removeDuplicatesSet([1, 2, 2, 3, 4, 4, 5]));    // [1, 2, 3, 4, 5]
console.log(removeDuplicatesSet(["a", "b", "a", "c", "b"])); // ["a", "b", "c"]
```

**Explanation:** The `Set` approach is the production choice — it is O(n) time and space, and the spread operator converts the Set back to an array in one step. The `filter + indexOf` approach is intuitive in interviews but runs in O(n²) because `indexOf` scans the full array for each element. The manual hash map is the best alternative when `Set` is not available (e.g., ES5 environments). All approaches preserve original insertion order.

---

## Problem 5. 🟡 Flatten a Nested Array

**Problem:** Write a function that flattens a deeply nested array into a single-level array. Handle any depth. Do not use the built-in `Array.prototype.flat()`.

**Examples:**
```
flatten([1, [2, 3], [4, [5, 6]]])          → [1, 2, 3, 4, 5, 6]
flatten([1, [2, [3, [4, [5]]]]])           → [1, 2, 3, 4, 5]
flatten([1, 2, 3])                         → [1, 2, 3]
flatten([])                                → []
```

**Solution:**
```js
/**
 * Approach 1: Recursive flatten (clean and readable)
 * @param {any[]} arr - potentially nested array
 * @returns {any[]} flat array
 */
function flatten(arr) {
  const result = [];

  for (const item of arr) {
    if (Array.isArray(item)) {
      // Recursively flatten nested arrays and spread the result
      result.push(...flatten(item));
    } else {
      result.push(item);
    }
  }

  return result;
}

/**
 * Approach 2: Using reduce + recursion (functional style)
 */
function flattenReduce(arr) {
  return arr.reduce((flat, item) => {
    return flat.concat(Array.isArray(item) ? flattenReduce(item) : item);
  }, []);
}

/**
 * Approach 3: Iterative using a stack (avoids deep call stack issues)
 * Useful when arrays can be thousands of levels deep.
 */
function flattenIterative(arr) {
  const stack = [...arr];
  const result = [];

  while (stack.length > 0) {
    const item = stack.pop();

    if (Array.isArray(item)) {
      // Push individual items back onto the stack for processing
      stack.push(...item);
    } else {
      result.push(item);
    }
  }

  // Stack-based pop reverses order, so reverse at the end
  return result.reverse();
}

// Tests
console.log(flatten([1, [2, 3], [4, [5, 6]]]));     // [1, 2, 3, 4, 5, 6]
console.log(flatten([1, [2, [3, [4, [5]]]]]));       // [1, 2, 3, 4, 5]
console.log(flattenIterative([1, [2, [3, [4, [5]]]]])); // [1, 2, 3, 4, 5]
```

**Explanation:** The recursive approach is the most readable: for each element, if it is an array, recurse into it; otherwise add it to the result. The `reduce` variant is the same logic in a more functional style. For production code with deeply nested input (thousands of levels), the iterative stack-based approach prevents a call stack overflow. All three are O(n) time and O(n) space where n is the total number of leaf elements.

---

## Problem 6. 🟡 Find All Anagrams

**Problem:** Write a function to check whether two strings are anagrams of each other (same characters, same frequencies, order does not matter). Ignore case and spaces.

**Examples:**
```
isAnagram("listen", "silent")         → true
isAnagram("Astronomer", "Moon starer") → true
isAnagram("hello", "world")           → false
isAnagram("rat", "car")               → false
```

**Solution:**
```js
/**
 * Check if two strings are anagrams.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isAnagram(a, b) {
  // Normalize: lowercase, remove spaces
  const normalize = (str) => str.toLowerCase().replace(/\s/g, '');

  const strA = normalize(a);
  const strB = normalize(b);

  // Quick length check — different lengths can't be anagrams
  if (strA.length !== strB.length) return false;

  // Build a frequency map for string A
  const freq = {};
  for (const char of strA) {
    freq[char] = (freq[char] || 0) + 1;
  }

  // Decrement frequency for each char in string B
  for (const char of strB) {
    if (!freq[char]) return false; // char not found or over-used
    freq[char]--;
  }

  return true;
}

/**
 * Alternative: sort both strings and compare (simpler, O(n log n))
 */
function isAnagramSort(a, b) {
  const normalize = (str) =>
    str.toLowerCase().replace(/\s/g, '').split('').sort().join('');

  return normalize(a) === normalize(b);
}

// Tests
console.log(isAnagram("listen", "silent"));          // true
console.log(isAnagram("Astronomer", "Moon starer")); // true
console.log(isAnagram("hello", "world"));            // false
console.log(isAnagramSort("listen", "silent"));      // true
```

**Explanation:** The frequency-map approach builds a character count for the first string, then decrements it for the second string. If any character in B is missing from A or appears more times, we return false immediately. This runs in O(n) time and O(1) space (26 characters for lowercase English letters, constant). The sort approach is cleaner to write but O(n log n) due to the sort — less ideal for very long strings.

---

## Problem 7. 🟡 Longest Substring Without Repeating Characters

**Problem:** Given a string, find the length of the longest substring that contains no repeating characters.

**Examples:**
```
lengthOfLongestSubstring("abcabcbb") → 3   // "abc"
lengthOfLongestSubstring("bbbbb")    → 1   // "b"
lengthOfLongestSubstring("pwwkew")   → 3   // "wke"
lengthOfLongestSubstring("")         → 0
```

**Solution:**
```js
/**
 * Sliding window — expand right, shrink left on duplicate.
 * @param {string} s
 * @returns {number} length of longest non-repeating substring
 */
function lengthOfLongestSubstring(s) {
  // Map stores: { character → most recent index }
  const lastSeen = new Map();
  let maxLen = 0;
  let windowStart = 0; // left boundary of the current window

  for (let right = 0; right < s.length; right++) {
    const char = s[right];

    // If we have seen this char and it is inside the current window,
    // move the window start just past its previous position
    if (lastSeen.has(char) && lastSeen.get(char) >= windowStart) {
      windowStart = lastSeen.get(char) + 1;
    }

    // Record the latest position of this character
    lastSeen.set(char, right);

    // Update max length with the current window size
    maxLen = Math.max(maxLen, right - windowStart + 1);
  }

  return maxLen;
}

// Tests
console.log(lengthOfLongestSubstring("abcabcbb")); // 3
console.log(lengthOfLongestSubstring("bbbbb"));    // 1
console.log(lengthOfLongestSubstring("pwwkew"));   // 3
console.log(lengthOfLongestSubstring(""));         // 0
```

**Explanation:** The sliding window technique maintains a variable-size window `[windowStart, right]` that contains only unique characters. When we encounter a character already in the window, we jump the window's left boundary forward past its previous occurrence rather than shrinking one step at a time. This ensures we never revisit characters unnecessarily. Time complexity is O(n) — each character is visited at most twice. Space complexity is O(min(n, m)) where m is the character set size (26 for lowercase English).

---

## Problem 8. 🟡 Array Chunk

**Problem:** Given an array and a chunk size `n`, split the array into subarrays of length `n`. The last chunk may be smaller if the array length is not evenly divisible.

**Examples:**
```
chunk([1, 2, 3, 4, 5], 2) → [[1, 2], [3, 4], [5]]
chunk([1, 2, 3, 4], 2)    → [[1, 2], [3, 4]]
chunk([1, 2, 3], 5)       → [[1, 2, 3]]
chunk([], 3)              → []
```

**Solution:**
```js
/**
 * Split an array into chunks of size n.
 * @param {any[]} arr
 * @param {number} size - chunk size (must be >= 1)
 * @returns {any[][]}
 */
function chunk(arr, size) {
  if (!arr || arr.length === 0 || size < 1) return [];

  const result = [];

  for (let i = 0; i < arr.length; i += size) {
    // slice extracts [i, i+size) — automatically handles the last partial chunk
    result.push(arr.slice(i, i + size));
  }

  return result;
}

/**
 * Alternative: using Array.from with a mapping function
 */
function chunkFunctional(arr, size) {
  if (!arr || arr.length === 0 || size < 1) return [];

  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size)
  );
}

// Tests
console.log(chunk([1, 2, 3, 4, 5], 2)); // [[1, 2], [3, 4], [5]]
console.log(chunk([1, 2, 3, 4], 2));    // [[1, 2], [3, 4]]
console.log(chunk([1, 2, 3], 5));       // [[1, 2, 3]]
console.log(chunk([], 3));              // []
```

**Explanation:** The loop advances by `size` each iteration, using `Array.prototype.slice` to extract each chunk. `slice` handles the boundary condition automatically — if `i + size` exceeds the array length, it simply returns the remaining elements. The `Array.from` variant pre-calculates the number of chunks using `Math.ceil(length / size)` and uses the mapping function to build each slice. Both are O(n) time and O(n) space.

---

## Problem 9. 🟡 String Compression

**Problem:** Implement basic string compression. For each group of consecutive repeated characters, output the character followed by its count. If the compressed string is not shorter than the original, return the original string.

**Examples:**
```
compress("aabcccccaaa") → "a2b1c5a3"
compress("abcd")        → "abcd"    // compressed "a1b1c1d1" is longer
compress("aabb")        → "aabb"    // "a2b2" — same length, return original
compress("aaaa")        → "a4"
```

**Solution:**
```js
/**
 * Run-length encode a string, return original if not shorter.
 * @param {string} str
 * @returns {string}
 */
function compress(str) {
  if (!str || str.length === 0) return str;

  let compressed = '';
  let count = 1;

  for (let i = 1; i <= str.length; i++) {
    if (i < str.length && str[i] === str[i - 1]) {
      // Current char matches previous — extend the run
      count++;
    } else {
      // Run ended — append char and count to result
      compressed += str[i - 1] + count;
      count = 1; // reset for next character
    }
  }

  // Return the shorter of the two strings
  return compressed.length < str.length ? compressed : str;
}

// Tests
console.log(compress("aabcccccaaa")); // "a2b1c5a3"
console.log(compress("abcd"));        // "abcd"
console.log(compress("aabb"));        // "aabb"
console.log(compress("aaaa"));        // "a4"
console.log(compress(""));            // ""
```

**Explanation:** We iterate through the string, tracking the current run length. When the character changes (or we hit the end), we flush the buffered character and its count to the result string. The loop goes to `i <= str.length` so the final run is always flushed when `i === str.length`. At the end we compare lengths and return whichever is shorter — this satisfies the constraint without any separate check upfront. Time complexity is O(n), space complexity is O(n) for the output string.

---

## Problem 10. 🔴 Maximum Subarray Sum (Kadane's Algorithm)

**Problem:** Given an integer array, find the contiguous subarray with the largest sum and return that sum. The array can contain negative numbers.

**Examples:**
```
maxSubarraySum([-2, 1, -3, 4, -1, 2, 1, -5, 4])  → 6   // [4, -1, 2, 1]
maxSubarraySum([1])                               → 1
maxSubarraySum([-1, -2, -3])                      → -1  // all negative
maxSubarraySum([5, 4, -1, 7, 8])                  → 23  // entire array
```

**Solution:**
```js
/**
 * Kadane's Algorithm — O(n) time, O(1) space.
 * At each position, decide: extend the existing subarray or start fresh.
 * @param {number[]} nums
 * @returns {number} maximum subarray sum
 */
function maxSubarraySum(nums) {
  if (!nums || nums.length === 0) return 0;

  // Initialize with the first element to handle all-negative arrays
  let currentSum = nums[0];
  let maxSum = nums[0];

  for (let i = 1; i < nums.length; i++) {
    // Either extend the current subarray or start a new one from here
    currentSum = Math.max(nums[i], currentSum + nums[i]);

    // Track the global maximum seen so far
    maxSum = Math.max(maxSum, currentSum);
  }

  return maxSum;
}

/**
 * Extended version: also return the subarray indices.
 */
function maxSubarraySumWithIndices(nums) {
  if (!nums || nums.length === 0) return { sum: 0, start: -1, end: -1 };

  let currentSum = nums[0];
  let maxSum = nums[0];
  let start = 0, end = 0, tempStart = 0;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > currentSum + nums[i]) {
      // Starting fresh is better — reset window start
      currentSum = nums[i];
      tempStart = i;
    } else {
      currentSum += nums[i];
    }

    if (currentSum > maxSum) {
      maxSum = currentSum;
      start = tempStart;
      end = i;
    }
  }

  return { sum: maxSum, start, end, subarray: nums.slice(start, end + 1) };
}

// Tests
console.log(maxSubarraySum([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6
console.log(maxSubarraySum([-1, -2, -3]));                     // -1
console.log(maxSubarraySumWithIndices([-2, 1, -3, 4, -1, 2, 1, -5, 4]));
// { sum: 6, start: 3, end: 6, subarray: [4, -1, 2, 1] }
```

**Explanation:** Kadane's algorithm uses dynamic programming at its core: `currentSum` represents the best sum of a subarray ending exactly at index `i`. At each step we ask: is it better to extend the previous subarray (`currentSum + nums[i]`) or start a fresh one (`nums[i]`)? We take the max of the two and then update the global best. Initializing both `currentSum` and `maxSum` to `nums[0]` (rather than 0) correctly handles arrays where all numbers are negative. Time complexity is O(n), space is O(1).

---

## Objects & Data Structures

---

## Problem 11. 🟢 Deep Clone an Object

**Problem:** Write a function to create a deep clone of an object. The clone should be completely independent — mutating the clone must not affect the original. Handle nested objects, arrays, and primitive values.

**Examples:**
```js
const original = { a: 1, b: { c: 2 }, d: [3, 4] };
const copy = deepClone(original);
copy.b.c = 99;
console.log(original.b.c); // 2 — unchanged
```

**Solution:**
```js
/**
 * Deep clone using recursion — handles objects, arrays, and primitives.
 * @param {any} value
 * @returns {any} deep clone
 */
function deepClone(value) {
  // Base case: primitives (number, string, boolean, null, undefined) are copied by value
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle Date objects (they are objects, but need special treatment)
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item));
  }

  // Handle plain Objects — clone each property recursively
  const cloned = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      cloned[key] = deepClone(value[key]);
    }
  }

  return cloned;
}

// Tests
const original = { a: 1, b: { c: 2, d: [3, [4, 5]] }, e: new Date('2024-01-01') };
const copy = deepClone(original);

copy.b.c = 99;
copy.b.d[1][0] = 999;

console.log(original.b.c);    // 2  — unchanged
console.log(original.b.d[1]); // [4, 5] — unchanged
console.log(copy.e === original.e); // false — different Date instances
```

**Explanation:** The function recursively handles four distinct cases: primitives (returned as-is since they are already copied by value), `Date` instances (reconstructed from timestamp), arrays (mapped recursively), and plain objects (each own-property cloned recursively). Using `hasOwnProperty` prevents accidentally cloning inherited prototype properties. This approach handles arbitrary nesting depth but does not support circular references or special objects like `Map`, `Set`, or `RegExp` — for those, `structuredClone()` (built into modern environments) is the production choice. Time and space complexity are both O(n) where n is the total number of nodes.

---

## Problem 12. 🟡 Implement a Hash Map

**Problem:** Implement a `HashMap` class from scratch with `set(key, value)`, `get(key)`, and `delete(key)` methods. Use an array with chaining to resolve collisions.

**Solution:**
```js
/**
 * HashMap with separate chaining for collision resolution.
 * Buckets are arrays of [key, value] pairs.
 */
class HashMap {
  constructor(capacity = 53) {
    // Choose a prime number of buckets to minimize clustering
    this.capacity = capacity;
    this.buckets = new Array(capacity).fill(null).map(() => []);
    this.size = 0;
  }

  /**
   * Hash function: converts a string key into a bucket index.
   * @param {string} key
   * @returns {number} index in [0, capacity)
   */
  _hash(key) {
    const str = String(key);
    let hash = 0;
    const PRIME = 31;

    for (let i = 0; i < Math.min(str.length, 100); i++) {
      hash = (hash * PRIME + str.charCodeAt(i)) % this.capacity;
    }

    return hash;
  }

  /**
   * Insert or update a key-value pair.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    const index = this._hash(key);
    const bucket = this.buckets[index];

    // Check if key already exists — update in place
    for (const pair of bucket) {
      if (pair[0] === key) {
        pair[1] = value;
        return;
      }
    }

    // Key is new — append to the bucket chain
    bucket.push([key, value]);
    this.size++;
  }

  /**
   * Retrieve a value by key. Returns undefined if not found.
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (const [k, v] of bucket) {
      if (k === key) return v;
    }

    return undefined;
  }

  /**
   * Remove a key-value pair. Returns true if deleted, false if not found.
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0] === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }

    return false;
  }
}

// Tests
const map = new HashMap();
map.set("name", "Alice");
map.set("age", 30);
map.set("name", "Bob"); // update existing key

console.log(map.get("name")); // "Bob"
console.log(map.get("age"));  // 30
console.log(map.get("city")); // undefined

map.delete("age");
console.log(map.get("age"));  // undefined
console.log(map.size);        // 1
```

**Explanation:** The hash function converts a string key to a bucket index using polynomial rolling hash with a prime multiplier (31), which distributes keys reasonably well across the bucket array. Collisions are resolved with separate chaining — each bucket holds a list of `[key, value]` pairs. `set` and `get` both hash the key (O(1) average) then do a linear scan of the (ideally short) chain. With a good hash function and appropriate load factor, all operations are O(1) amortized average and O(n) worst case.

---

## Problem 13. 🟡 Group Array of Objects by Property

**Problem:** Given an array of objects and a property name (or key function), group the objects by the value of that property. Return an object where each key maps to an array of matching items.

**Examples:**
```js
const people = [
  { name: "Alice", dept: "Engineering" },
  { name: "Bob",   dept: "Design" },
  { name: "Carol", dept: "Engineering" },
  { name: "Dave",  dept: "Design" },
];
groupBy(people, "dept");
// {
//   Engineering: [{ name: "Alice", ... }, { name: "Carol", ... }],
//   Design:      [{ name: "Bob",   ... }, { name: "Dave",  ... }]
// }
```

**Solution:**
```js
/**
 * Group an array of objects by a property name or key function.
 * @param {object[]} arr
 * @param {string|Function} key - property name or function that returns the group key
 * @returns {Object.<string, object[]>}
 */
function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    // Support both a string key ("dept") and a function (item => item.dept)
    const groupKey = typeof key === 'function' ? key(item) : item[key];

    // Initialize the group array if it does not exist yet
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(item);
    return groups;
  }, {});
}

// Tests
const people = [
  { name: "Alice", dept: "Engineering", level: "Senior" },
  { name: "Bob",   dept: "Design",      level: "Junior" },
  { name: "Carol", dept: "Engineering", level: "Junior" },
  { name: "Dave",  dept: "Design",      level: "Senior" },
];

console.log(groupBy(people, "dept"));
// { Engineering: [...], Design: [...] }

// Group by computed key using a function
console.log(groupBy(people, item => item.level));
// { Senior: [...], Junior: [...] }

// Group array of numbers into even/odd
const numbers = [1, 2, 3, 4, 5, 6];
console.log(groupBy(numbers, n => n % 2 === 0 ? "even" : "odd"));
// { odd: [1, 3, 5], even: [2, 4, 6] }
```

**Explanation:** The `reduce` accumulates items into an object keyed by the group value. Accepting both a string property name and a callback function makes the utility flexible — the same pattern used by lodash's `_.groupBy`. The `||=` operator (or equivalent `if (!groups[key])`) initializes missing groups lazily rather than pre-populating all possible keys. Time complexity is O(n), space complexity is O(n).

---

## Problem 14. 🟡 Implement a Stack and Queue Using Arrays

**Problem:** Implement a `Stack` (LIFO) and a `Queue` (FIFO) class using JavaScript arrays. Each should support standard operations with appropriate O(1) or O(n) complexity guarantees.

**Solution:**
```js
/**
 * Stack — Last In, First Out (LIFO)
 * push and pop both operate on the tail of the array → O(1)
 */
class Stack {
  constructor() {
    this.items = [];
  }

  /** Add an item to the top. O(1) amortized */
  push(item) {
    this.items.push(item);
  }

  /** Remove and return the top item. O(1) */
  pop() {
    if (this.isEmpty()) throw new Error("Stack underflow");
    return this.items.pop();
  }

  /** Inspect the top item without removing it. O(1) */
  peek() {
    if (this.isEmpty()) return undefined;
    return this.items[this.items.length - 1];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  get size() {
    return this.items.length;
  }
}

/**
 * Queue — First In, First Out (FIFO)
 * enqueue at the tail (push), dequeue from the head.
 *
 * Note: Array.shift() is O(n) because it re-indexes every element.
 * For a true O(1) queue, use a linked list or offset-pointer approach.
 */
class Queue {
  constructor() {
    this.items = [];
    this.head = 0; // pointer to the front element — avoids expensive shift()
  }

  /** Add an item to the back. O(1) amortized */
  enqueue(item) {
    this.items.push(item);
  }

  /** Remove and return the front item. O(1) with head pointer */
  dequeue() {
    if (this.isEmpty()) throw new Error("Queue underflow");
    const item = this.items[this.head];
    this.head++;

    // Periodically compact the array to reclaim memory
    if (this.head > 50 && this.head > this.items.length / 2) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  /** Inspect the front item without removing it. O(1) */
  peek() {
    if (this.isEmpty()) return undefined;
    return this.items[this.head];
  }

  isEmpty() {
    return this.head >= this.items.length;
  }

  get size() {
    return this.items.length - this.head;
  }
}

// Tests — Stack
const stack = new Stack();
stack.push(1); stack.push(2); stack.push(3);
console.log(stack.peek());  // 3
console.log(stack.pop());   // 3
console.log(stack.size);    // 2

// Tests — Queue
const queue = new Queue();
queue.enqueue("a"); queue.enqueue("b"); queue.enqueue("c");
console.log(queue.peek());    // "a"
console.log(queue.dequeue()); // "a"
console.log(queue.dequeue()); // "b"
console.log(queue.size);      // 1
```

**Explanation:** The `Stack` directly maps to array's `push`/`pop`, both of which operate at the tail in O(1) time. The `Queue` adds items with `push` (tail) but must remove from the front. Naively using `Array.shift()` is O(n) because JavaScript must re-index every remaining element. The head-pointer trick avoids this by treating the array as a circular-ish buffer — dequeue just increments the pointer. Periodic compaction with `slice` prevents the backing array from growing indefinitely when the queue processes many items.

---

## Problem 15. 🔴 LRU Cache

**Problem:** Design an LRU (Least Recently Used) Cache that supports `get(key)` and `put(key, value)` operations, both in O(1) time. When the cache is full and a new item is inserted, evict the least recently used item.

**Solution:**
```js
/**
 * LRU Cache using a Map.
 *
 * JavaScript's Map preserves insertion order and provides O(1) get/set/delete.
 * We exploit insertion order to track recency: the first key in the Map is
 * the least recently used, and the last key is the most recently used.
 *
 * On access: delete the key and re-insert it to move it to the "most recent" end.
 * On eviction: delete the first (oldest) key from the Map.
 */
class LRUCache {
  /**
   * @param {number} capacity - maximum number of items
   */
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map maintains insertion order
  }

  /**
   * Get the value for a key. Returns -1 if not found.
   * Accessing a key promotes it to "most recently used".
   * @param {number} key
   * @returns {number}
   */
  get(key) {
    if (!this.cache.has(key)) return -1;

    const value = this.cache.get(key);

    // Promote to most-recently-used by re-inserting at the end
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Insert or update a key-value pair.
   * If capacity is exceeded, evict the least recently used item.
   * @param {number} key
   * @param {number} value
   */
  put(key, value) {
    if (this.cache.has(key)) {
      // Update existing key — remove first so re-insertion moves it to end
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict LRU: the first key in the Map is the oldest
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }

    this.cache.set(key, value);
  }

  get size() {
    return this.cache.size;
  }
}

// Tests
const lru = new LRUCache(3);
lru.put(1, 10);
lru.put(2, 20);
lru.put(3, 30);

console.log(lru.get(1));  // 10 — also promotes key 1 to most recent
lru.put(4, 40);           // evicts key 2 (least recently used)

console.log(lru.get(2));  // -1 — was evicted
console.log(lru.get(3));  // 30
console.log(lru.get(4));  // 40

lru.put(5, 50);           // evicts key 1 (now the oldest after gets above)
console.log(lru.get(1));  // -1
```

**Explanation:** The key insight is that JavaScript's `Map` maintains insertion order and provides O(1) `get`, `set`, and `delete`. We use it as an ordered dictionary: the first entry is always the LRU item, and the last entry is always the MRU item. On every `get` or `put`, we delete and re-insert the key to move it to the tail. Eviction takes the first key via `map.keys().next().value`. Both operations are O(1). A classic alternative is a doubly-linked list paired with a hash map, but the `Map` approach is cleaner in JavaScript and equally performant.

---

## Functions & Closures

---

## Problem 16. 🟢 Implement a Counter Using Closures

**Problem:** Implement a `makeCounter` factory function that returns a counter object with `increment`, `decrement`, `reset`, and `getCount` methods. The internal count must not be directly accessible from outside.

**Solution:**
```js
/**
 * Counter factory using closures to encapsulate private state.
 * @param {number} initialValue - starting value (default 0)
 * @returns {{ increment, decrement, reset, getCount }}
 */
function makeCounter(initialValue = 0) {
  // `count` is a private variable — not accessible outside this function
  let count = initialValue;

  return {
    increment(step = 1) {
      count += step;
      return count; // enable chaining or assignment
    },

    decrement(step = 1) {
      count -= step;
      return count;
    },

    reset() {
      count = initialValue;
      return count;
    },

    getCount() {
      return count;
    }
  };
}

// Tests
const counter = makeCounter(10);
console.log(counter.getCount());   // 10
console.log(counter.increment());  // 11
console.log(counter.increment(5)); // 16
console.log(counter.decrement(3)); // 13
console.log(counter.reset());      // 10

// Each counter has its own independent closure
const counterA = makeCounter();
const counterB = makeCounter(100);
counterA.increment();
counterB.increment();
console.log(counterA.getCount()); // 1
console.log(counterB.getCount()); // 101
```

**Explanation:** The `count` variable is declared inside `makeCounter` and is captured by the returned methods via closure — it is genuinely private and inaccessible from outside. Each call to `makeCounter` creates an entirely independent closure scope, so `counterA` and `counterB` do not share state. This is the classic closure-based module pattern, and a foundational JavaScript interview topic. `initialValue` is stored separately so `reset()` can always return to the original starting value.

---

## Problem 17. 🟡 Implement Debounce

**Problem:** Implement a `debounce(fn, delay)` function. The debounced function should only invoke `fn` after `delay` milliseconds have elapsed since the last call. Useful for search inputs, window resize handlers, etc.

**Solution:**
```js
/**
 * Debounce — delays execution until the function stops being called.
 * @param {Function} fn - function to debounce
 * @param {number} delay - wait time in milliseconds
 * @returns {Function} debounced version
 */
function debounce(fn, delay) {
  let timeoutId = null;

  return function (...args) {
    // `this` is preserved so the debounced function works as a method
    const context = this;

    // Cancel any previously scheduled call
    clearTimeout(timeoutId);

    // Schedule a fresh call after the delay
    timeoutId = setTimeout(() => {
      fn.apply(context, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Enhanced version with a cancel() method and immediate option.
 * @param {Function} fn
 * @param {number} delay
 * @param {boolean} immediate - if true, fire on the leading edge instead of trailing
 */
function debounceAdvanced(fn, delay, immediate = false) {
  let timeoutId = null;

  function debounced(...args) {
    const context = this;
    const shouldCallNow = immediate && timeoutId === null;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate) fn.apply(context, args);
    }, delay);

    if (shouldCallNow) fn.apply(context, args);
  }

  // Allow manual cancellation
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}

// Usage demonstration
const search = debounce((query) => {
  console.log(`Searching for: ${query}`);
}, 300);

// In a real app, these would be keystrokes:
search("j");       // timer starts
search("ja");      // timer resets
search("jav");     // timer resets
// 300ms later → logs "Searching for: jav"  (only one call)
```

**Explanation:** The closure captures `timeoutId` so each call to the debounced function can cancel the previous pending timer and schedule a new one. Only the last call in a burst (when no new calls arrive within `delay` ms) actually executes `fn`. The `this` binding is preserved with `.apply(context, args)` so the debounced function works correctly as an object method. The `immediate` option fires `fn` on the leading edge of the burst instead of the trailing edge — useful for click handlers where you want instant feedback but want to prevent double-clicks.

---

## Problem 18. 🟡 Implement Throttle

**Problem:** Implement a `throttle(fn, limit)` function. The throttled function should invoke `fn` at most once per `limit` milliseconds, regardless of how many times it is called. Useful for scroll events, mouse move tracking, etc.

**Solution:**
```js
/**
 * Throttle — ensures fn runs at most once per `limit` ms.
 * @param {Function} fn
 * @param {number} limit - minimum time between calls in ms
 * @returns {Function} throttled version
 */
function throttle(fn, limit) {
  let lastCallTime = 0;
  let timeoutId = null;

  return function (...args) {
    const context = this;
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= limit) {
      // Enough time has passed — call immediately
      lastCallTime = now;
      fn.apply(context, args);
    } else {
      // Schedule the call to fire when the remaining wait time expires.
      // This ensures the LAST call in a burst is always executed.
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn.apply(context, args);
        timeoutId = null;
      }, limit - timeSinceLastCall);
    }
  };
}

/**
 * Simpler leading-only throttle (no trailing call):
 * Once fn fires, it cannot fire again until `limit` ms pass.
 */
function throttleLeading(fn, limit) {
  let inThrottle = false;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// Demonstration
const onScroll = throttle((e) => {
  console.log("scroll handled at", Date.now());
}, 200);

// Even if the scroll event fires 60 times/second,
// the handler runs at most once every 200ms.
```

**Explanation:** The difference between debounce and throttle is subtle but important: debounce waits for the calls to stop, while throttle guarantees regular execution during a continuous stream of calls. The implementation above uses a time-based check and a trailing timeout to ensure both the first and last calls in a burst are executed. The simpler `throttleLeading` version fires on the leading edge only, dropping all calls during the cooldown window. Throttle is preferred for high-frequency events like scroll and mouse move where you want regular updates, not just a final value.

---

## Problem 19. 🟡 Implement Function.prototype.bind Polyfill

**Problem:** Implement a `myBind` method that mimics `Function.prototype.bind`. It should return a new function with `this` permanently bound to the provided context, and support partial application of arguments.

**Solution:**
```js
/**
 * Polyfill for Function.prototype.bind
 * Returns a new function with `this` bound to `context`.
 * Pre-fills any additional arguments (partial application).
 *
 * @param {object} context - value to bind as `this`
 * @param {...any} boundArgs - arguments to pre-fill
 * @returns {Function}
 */
Function.prototype.myBind = function (context, ...boundArgs) {
  // `this` inside myBind refers to the function being bound
  const originalFn = this;

  if (typeof originalFn !== 'function') {
    throw new TypeError('myBind must be called on a function');
  }

  const bound = function (...callArgs) {
    // When called with `new`, ignore the bound context
    // (mimics native bind behavior with constructors)
    if (this instanceof bound) {
      return new originalFn(...boundArgs, ...callArgs);
    }

    // Normal call: merge pre-filled args with call-time args
    return originalFn.apply(context, [...boundArgs, ...callArgs]);
  };

  // Preserve the prototype chain so `instanceof` works correctly
  if (originalFn.prototype) {
    bound.prototype = Object.create(originalFn.prototype);
  }

  return bound;
};

// Tests
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user = { name: "Alice" };

const greetAlice = greet.myBind(user, "Hello");
console.log(greetAlice("!"));  // "Hello, Alice!"
console.log(greetAlice(".")); // "Hello, Alice."

// Partial application (no context binding)
function multiply(a, b) {
  return a * b;
}
const double = multiply.myBind(null, 2);
console.log(double(5));  // 10
console.log(double(9));  // 18

// Works as a constructor (new ignores bound context)
function Person(name) {
  this.name = name;
}
const BoundPerson = Person.myBind({ name: "ignored" });
const p = new BoundPerson("Bob");
console.log(p.name); // "Bob" — constructor wins over bound context
```

**Explanation:** The polyfill captures the original function and the bound arguments in a closure, then returns a `bound` wrapper function that merges `boundArgs` with any arguments provided at call time. The `this instanceof bound` check handles the edge case where the bound function is used as a constructor with `new` — native `bind` specifies that in this case, the bound `this` is ignored and a new object is constructed normally. Preserving the prototype chain ensures `instanceof` checks work correctly on instances created from the bound constructor.

---

## Problem 20. 🟡 Implement Memoize Function

**Problem:** Implement a `memoize(fn)` higher-order function that caches the results of a function based on its arguments. Subsequent calls with the same arguments return the cached result without re-executing.

**Solution:**
```js
/**
 * Memoize — cache function results keyed by arguments.
 * @param {Function} fn
 * @returns {Function} memoized version with a .cache property
 */
function memoize(fn) {
  const cache = new Map();

  const memoized = function (...args) {
    // Create a unique cache key from the arguments
    // JSON.stringify handles arrays and simple objects; for complex keys see below
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };

  // Expose the cache so callers can inspect or clear it
  memoized.cache = cache;

  memoized.clear = () => cache.clear();

  return memoized;
}

/**
 * Advanced version using a nested Map trie (avoids JSON.stringify
 * collisions like [1, 23] vs [12, 3] in string form).
 */
function memoizeTrie(fn) {
  const root = new Map();

  return function (...args) {
    let node = root;

    // Walk/build the trie one argument at a time
    for (const arg of args) {
      if (!node.has(arg)) node.set(arg, new Map());
      node = node.get(arg);
    }

    // Sentinel key marks the leaf as a cached result
    const RESULT = Symbol.for('result');
    if (node.has(RESULT)) return node.get(RESULT);

    const result = fn.apply(this, args);
    node.set(RESULT, result);
    return result;
  };
}

// Tests
let callCount = 0;

const expensiveAdd = memoize((a, b) => {
  callCount++;
  return a + b;
});

console.log(expensiveAdd(2, 3)); // 5 — computed
console.log(expensiveAdd(2, 3)); // 5 — from cache
console.log(expensiveAdd(4, 5)); // 9 — computed
console.log(callCount);          // 2 — only called twice

// Memoizing recursive Fibonacci for dramatic speedup
const fib = memoize(function(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2); // recursive calls also hit the cache
});

console.log(fib(40)); // 102334155 — near-instant
```

**Explanation:** The basic `memoize` uses `JSON.stringify(args)` as a cache key, which works for serializable arguments but will fail for functions, circular objects, or cases where argument order matters but is semantically equivalent. The trie-based version avoids serialization entirely by navigating a tree of nested Maps, one argument per level — each unique combination of arguments leads to a unique leaf. Memoization trades space for time: O(n) extra space for n unique calls, with O(1) cache lookup. It is most impactful on expensive pure functions (no side effects, deterministic output).

---

## Recursion & Trees

---

## Problem 21. 🟢 Fibonacci Sequence

**Problem:** Return the Nth Fibonacci number. Implement iterative, recursive, and memoized-recursive versions. Compare their time and space complexities.

**Examples:**
```
fib(0)  → 0
fib(1)  → 1
fib(6)  → 8    // 0,1,1,2,3,5,8
fib(10) → 55
```

**Solution:**
```js
/**
 * Approach 1: Iterative — O(n) time, O(1) space
 * The most efficient — no recursion overhead, constant memory.
 */
function fibIterative(n) {
  if (n < 0) throw new RangeError("n must be non-negative");
  if (n <= 1) return n;

  let prev = 0, curr = 1;

  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr];
  }

  return curr;
}

/**
 * Approach 2: Naive recursive — O(2^n) time, O(n) space (call stack)
 * Elegant but catastrophically slow for large n.
 */
function fibRecursive(n) {
  if (n <= 1) return n;
  return fibRecursive(n - 1) + fibRecursive(n - 2);
}

/**
 * Approach 3: Memoized recursion (top-down DP) — O(n) time, O(n) space
 * Fixes the exponential blowup while keeping the recursive structure.
 */
function fibMemo(n, memo = new Map()) {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n);

  const result = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, result);
  return result;
}

// Tests
console.log(fibIterative(10)); // 55
console.log(fibMemo(40));      // 102334155
console.log(fibIterative(0));  // 0
console.log(fibIterative(1));  // 1

// Performance comparison
console.time("naive");
fibRecursive(35); // still reasonable at 35, terrible at 45+
console.timeEnd("naive");

console.time("memoized");
fibMemo(35);
console.timeEnd("memoized");
```

**Explanation:** The naive recursive approach is deceptively clean but recalculates every sub-problem exponentially — `fib(5)` calls `fib(4)` and `fib(3)`, and `fib(4)` also calls `fib(3)`, leading to a binary tree of 2^n calls. Memoization collapses this to O(n) by storing results in a map and short-circuiting repeated calls. The iterative approach is optimal: O(n) time with O(1) space because only the previous two values are needed at any point. In interviews, demonstrating all three and articulating their trade-offs shows depth.

---

## Problem 22. 🟡 Binary Search

**Problem:** Implement binary search on a sorted array. Return the index of the target value, or -1 if not found. Use the iterative approach to avoid recursion overhead.

**Examples:**
```
binarySearch([1, 3, 5, 7, 9, 11], 7)   → 3
binarySearch([1, 3, 5, 7, 9, 11], 6)   → -1
binarySearch([1], 1)                    → 0
binarySearch([], 1)                     → -1
```

**Solution:**
```js
/**
 * Iterative binary search on a sorted array.
 * @param {number[]} arr - sorted array in ascending order
 * @param {number} target
 * @returns {number} index of target, or -1 if not found
 */
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    // Use bitwise shift to avoid potential integer overflow
    // (less of an issue in JS, but good habit from other languages)
    const mid = left + ((right - left) >> 1);

    if (arr[mid] === target) {
      return mid; // found
    } else if (arr[mid] < target) {
      left = mid + 1; // target is in the right half
    } else {
      right = mid - 1; // target is in the left half
    }
  }

  return -1; // not found
}

/**
 * Variant: find the leftmost index where arr[i] >= target (lower bound).
 * Useful for finding insertion positions.
 */
function lowerBound(arr, target) {
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = left + ((right - left) >> 1);

    if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid; // mid could be the answer, keep it in range
    }
  }

  return left; // index where target would be inserted
}

// Tests
console.log(binarySearch([1, 3, 5, 7, 9, 11], 7));  // 3
console.log(binarySearch([1, 3, 5, 7, 9, 11], 6));  // -1
console.log(binarySearch([1], 1));                   // 0
console.log(binarySearch([], 1));                    // -1

console.log(lowerBound([1, 3, 5, 7, 9], 6)); // 3 — would insert before index 3
```

**Explanation:** Binary search repeatedly halves the search space by comparing the target to the middle element. If the target is smaller, it must be in the left half (update `right`); if larger, the right half (update `left`). The loop invariant is: if the target exists, it lies within `[left, right]`. Using `left + ((right - left) >> 1)` instead of `(left + right) / 2` prevents integer overflow (relevant in languages with 32-bit int limits). Time complexity is O(log n), space is O(1) for the iterative version.

---

## Problem 23. 🟡 Flatten a Nested Object into Dot-Notation Keys

**Problem:** Write a function that takes a deeply nested object and returns a flat object where each key represents the full path to a leaf value, separated by dots.

**Examples:**
```js
flatten({ a: 1, b: { c: 2, d: { e: 3 } } })
// → { "a": 1, "b.c": 2, "b.d.e": 3 }

flatten({ x: { y: { z: 42 } }, name: "test" })
// → { "x.y.z": 42, "name": "test" }
```

**Solution:**
```js
/**
 * Flatten a nested object into dot-notation keys.
 * @param {object} obj - the object to flatten
 * @param {string} prefix - current key path (used in recursion)
 * @param {object} result - accumulator (used in recursion)
 * @returns {object} flat object
 */
function flattenObject(obj, prefix = '', result = {}) {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    // Build the full dot-separated path for this key
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects, passing the accumulated path
      flattenObject(value, fullKey, result);
    } else {
      // Leaf node (primitive, array, or null) — write to result
      result[fullKey] = value;
    }
  }

  return result;
}

/**
 * Inverse: unflatten dot-notation keys back to a nested object.
 */
function unflattenObject(flat) {
  const result = {};

  for (const dotKey in flat) {
    const parts = dotKey.split('.');
    let node = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') {
        node[parts[i]] = {};
      }
      node = node[parts[i]];
    }

    node[parts[parts.length - 1]] = flat[dotKey];
  }

  return result;
}

// Tests
const nested = {
  a: 1,
  b: { c: 2, d: { e: 3 } },
  f: [1, 2, 3],   // arrays treated as leaf values
  g: null
};

const flat = flattenObject(nested);
console.log(flat);
// { a: 1, "b.c": 2, "b.d.e": 3, f: [1, 2, 3], g: null }

console.log(unflattenObject(flat));
// Reconstructs the original nested shape
```

**Explanation:** The recursive function builds the key path incrementally by prepending the accumulated `prefix` with a dot separator. Arrays and `null` are treated as leaf values (not recursed into), which is the most common real-world behavior — though you can modify the condition to flatten arrays too if needed. The `hasOwnProperty` guard prevents processing inherited prototype properties. Time complexity is O(n) where n is the total number of key-value pairs across all nesting levels. The inverse `unflattenObject` is a useful bonus that shows understanding of the full round-trip.

---

## Problem 24. 🟡 Implement a Basic Binary Search Tree

**Problem:** Implement a `BinarySearchTree` class with `insert(value)`, `search(value)`, and `inorder()` (in-order traversal returning a sorted array) methods.

**Solution:**
```js
/** A single node in the BST */
class TreeNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

/**
 * Binary Search Tree
 * Invariant: left subtree values < node value < right subtree values
 */
class BinarySearchTree {
  constructor() {
    this.root = null;
  }

  /**
   * Insert a value into the BST.
   * Iterative approach — no recursion stack overhead.
   * @param {number} value
   */
  insert(value) {
    const node = new TreeNode(value);

    if (!this.root) {
      this.root = node;
      return this;
    }

    let current = this.root;

    while (true) {
      if (value === current.value) return this; // ignore duplicates

      if (value < current.value) {
        if (!current.left) { current.left = node; break; }
        current = current.left;
      } else {
        if (!current.right) { current.right = node; break; }
        current = current.right;
      }
    }

    return this; // enable chaining
  }

  /**
   * Search for a value. Returns the node if found, null otherwise.
   * @param {number} value
   * @returns {TreeNode|null}
   */
  search(value) {
    let current = this.root;

    while (current) {
      if (value === current.value) return current;
      current = value < current.value ? current.left : current.right;
    }

    return null;
  }

  /**
   * In-order traversal (left → root → right) — returns sorted array.
   * @returns {number[]}
   */
  inorder() {
    const result = [];

    function traverse(node) {
      if (!node) return;
      traverse(node.left);
      result.push(node.value);
      traverse(node.right);
    }

    traverse(this.root);
    return result;
  }

  /**
   * Check if a value exists (convenience wrapper).
   * @param {number} value
   * @returns {boolean}
   */
  contains(value) {
    return this.search(value) !== null;
  }
}

// Tests
const bst = new BinarySearchTree();
bst.insert(10).insert(5).insert(15).insert(3).insert(7).insert(12).insert(20);

console.log(bst.inorder());      // [3, 5, 7, 10, 12, 15, 20]
console.log(bst.contains(7));    // true
console.log(bst.contains(99));   // false
console.log(bst.search(15));     // TreeNode { value: 15, left: ..., right: ... }
```

**Explanation:** The BST invariant — all left-subtree values are smaller and all right-subtree values are larger — enables O(log n) average-case insert and search by eliminating half the tree at each step. The iterative insert and search avoid recursion stack overhead. In-order traversal (left, root, right) visits nodes in sorted order, which is why a BST's in-order output is always a sorted array. In the worst case (inserting already-sorted data), the tree degenerates to a linked list with O(n) operations — self-balancing trees like AVL or Red-Black trees solve this.

---

## Problem 25. 🔴 Serialize and Deserialize a Binary Tree

**Problem:** Design an algorithm to serialize a binary tree to a string and deserialize that string back to the original tree structure. The serialized format must represent the full tree structure, including null children.

**Solution:**
```js
class TreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

/**
 * Serialize a binary tree to a string using pre-order traversal.
 * Null nodes are encoded as "#" to preserve structural information.
 * @param {TreeNode|null} root
 * @returns {string}
 */
function serialize(root) {
  const parts = [];

  function preorder(node) {
    if (!node) {
      parts.push('#'); // sentinel for null
      return;
    }
    parts.push(String(node.val));
    preorder(node.left);
    preorder(node.right);
  }

  preorder(root);
  return parts.join(',');
}

/**
 * Deserialize a string back to the original binary tree.
 * @param {string} data
 * @returns {TreeNode|null}
 */
function deserialize(data) {
  const tokens = data.split(',');
  let index = 0; // shared mutable pointer across recursive calls

  function buildTree() {
    const token = tokens[index++];

    if (token === '#') return null; // null node

    const node = new TreeNode(Number(token));
    node.left = buildTree();  // reconstruct left subtree
    node.right = buildTree(); // reconstruct right subtree
    return node;
  }

  return buildTree();
}

// Tests
// Build tree:
//       1
//      / \
//     2   3
//        / \
//       4   5
const root = new TreeNode(1,
  new TreeNode(2),
  new TreeNode(3,
    new TreeNode(4),
    new TreeNode(5)
  )
);

const serialized = serialize(root);
console.log(serialized);
// "1,2,#,#,3,4,#,#,5,#,#"

const deserialized = deserialize(serialized);
console.log(deserialize(serialize(deserialized)));
// Identical structure to original

// Edge cases
console.log(serialize(null));              // "#"
console.log(deserialize("#"));             // null

// Single node
const single = new TreeNode(42);
console.log(serialize(single));            // "42,#,#"
console.log(deserialize("42,#,#").val);    // 42
```

**Explanation:** Pre-order traversal (root, left, right) is chosen for serialization because it records the root first, which is exactly what we need to reconstruct the tree during deserialization. Null nodes are encoded as `"#"` — without them, we cannot distinguish between different tree shapes that produce the same values (e.g., a left-skewed vs right-skewed tree). Deserialization uses a shared `index` pointer that advances through the token array in the same pre-order sequence — each recursive call to `buildTree` consumes exactly the tokens belonging to its subtree. Both serialize and deserialize run in O(n) time and O(n) space where n is the number of nodes.

---

*End of Part 1 — Problems 1 to 25. Continue to Part 2 for Problems 26–50 covering Promises & Async, Prototypes & OOP, Sorting & Algorithms, DOM & Browser APIs, and System Design patterns.*


---


---

## Table of Contents

- [Async & Promises (26–32)](#async--promises-2632)
- [DOM & Browser (33–37)](#dom--browser-3337)
- [Advanced Algorithms (38–44)](#advanced-algorithms-3844)
- [Utility Functions (45–50)](#utility-functions-4550)

---

## Async & Promises (26–32)

---

## Problem 26. 🟢 Sleep Function

**Problem:** Implement a `sleep(ms)` function that pauses execution for a given number of milliseconds. It must work with `async/await`.

**Examples:**
```
await sleep(1000)  // pauses for 1 second, then continues
await sleep(500)   // pauses for 500ms
```

**Solution:**
```js
/**
 * Pauses async execution for `ms` milliseconds.
 * @param {number} ms - Duration to sleep in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Usage
async function demo() {
  console.log("Start");
  await sleep(1000);
  console.log("1 second later");
}
```

**Explanation:** `sleep` wraps `setTimeout` in a Promise and resolves it after the delay. Because `await` suspends the async function until the Promise resolves, it creates a true non-blocking pause. Time complexity is O(1); space complexity is O(1).

---

## Problem 27. 🟡 Implement Promise.all from Scratch

**Problem:** Implement `promiseAll(promises)` that resolves with an array of all results when every promise resolves, or rejects immediately if any promise rejects — mirroring the native `Promise.all` behaviour.

**Examples:**
```
await promiseAll([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)])
// → [1, 2, 3]

await promiseAll([Promise.resolve(1), Promise.reject("error")])
// → rejects with "error"
```

**Solution:**
```js
/**
 * Resolves when all promises settle successfully, rejects on the first failure.
 * @param {Promise[]} promises
 * @returns {Promise<any[]>}
 */
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (promises.length === 0) return resolve([]);

    const results = new Array(promises.length);
    let resolved = 0;

    promises.forEach((promise, index) => {
      // Wrap non-promise values with Promise.resolve for safety
      Promise.resolve(promise)
        .then((value) => {
          results[index] = value; // preserve original order
          resolved++;
          if (resolved === promises.length) {
            resolve(results);
          }
        })
        .catch(reject); // fail fast on first rejection
    });
  });
}
```

**Explanation:** We fire all promises concurrently and track how many have resolved. Results are stored at their original index so output order matches input order regardless of which promise finishes first. The first rejection immediately rejects the outer Promise via `reject`. Time complexity is O(n); space complexity is O(n) for the results array.

---

## Problem 28. 🟡 Retry a Failed Async Function N Times with Delay

**Problem:** Implement `retry(fn, retries, delay)` that calls an async function and retries it up to `retries` times if it throws, waiting `delay` ms between each attempt.

**Examples:**
```
let attempts = 0;
const flaky = async () => {
  attempts++;
  if (attempts < 3) throw new Error("fail");
  return "success";
};

await retry(flaky, 5, 100); // → "success" (succeeds on 3rd attempt)
await retry(flaky, 2, 100); // → throws after 2 failed attempts
```

**Solution:**
```js
/**
 * Retries an async function up to `retries` times with `delay` ms between attempts.
 * @param {Function} fn - Async function to call
 * @param {number} retries - Maximum number of retry attempts
 * @param {number} delay - Milliseconds to wait between retries
 * @returns {Promise<any>}
 */
async function retry(fn, retries, delay) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(); // return immediately on success
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(delay); // wait before next attempt
      }
    }
  }

  // All attempts exhausted — re-throw the last error
  throw lastError;
}

// Helper (from Problem 26)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Explanation:** The loop runs at most `retries + 1` times (initial attempt plus retries). On each failure we capture the error and wait `delay` ms before trying again. If all attempts fail, the last error is re-thrown to preserve the failure reason. Time complexity is O(retries); space complexity is O(1).

---

## Problem 29. 🟡 Run Async Tasks in Series

**Problem:** Implement `runSeries(tasks)` that executes an array of async functions one after another (not concurrently) and returns an array of their results in order.

**Examples:**
```
const tasks = [
  () => Promise.resolve(1),
  () => Promise.resolve(2),
  () => Promise.resolve(3),
];
await runSeries(tasks); // → [1, 2, 3]
```

**Solution:**
```js
/**
 * Runs async tasks sequentially and collects their results.
 * @param {Array<() => Promise<any>>} tasks - Array of async task functions
 * @returns {Promise<any[]>}
 */
async function runSeries(tasks) {
  const results = [];

  for (const task of tasks) {
    // await each task before starting the next — enforces serial execution
    const result = await task();
    results.push(result);
  }

  return results;
}
```

**Explanation:** Using a `for...of` loop with `await` inside guarantees each task completes before the next begins. A `forEach` with async callbacks would NOT work here because it does not await each iteration. Time complexity is O(n) tasks; space complexity is O(n) for results.

---

## Problem 30. 🟡 Concurrent Task Runner with Limit

**Problem:** Implement `runWithLimit(tasks, limit)` that runs async tasks concurrently but never allows more than `limit` tasks to be active at the same time.

**Examples:**
```
// With limit = 2, at most 2 tasks run simultaneously
await runWithLimit([task1, task2, task3, task4, task5], 2);
// → results in original order
```

**Solution:**
```js
/**
 * Runs async tasks with a maximum concurrency of `limit`.
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} limit - Maximum concurrent tasks
 * @returns {Promise<any[]>}
 */
async function runWithLimit(tasks, limit) {
  const results = new Array(tasks.length);
  let index = 0; // next task to pick up

  // Worker: pulls tasks from the queue until none remain
  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;   // claim a task slot
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  // Spin up exactly `limit` workers, each pulling from the shared queue
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);

  return results;
}
```

**Explanation:** We create `limit` concurrent worker coroutines that all pull from a shared task index counter. Because each worker `await`s before grabbing the next index, we naturally cap concurrency at `limit` without a semaphore. Results are stored at their original indices to preserve order. Time complexity is O(n) total tasks; space complexity is O(n).

---

## Problem 31. 🔴 Implement a Promise from Scratch (Simplified)

**Problem:** Implement a `MyPromise` class that supports `.then()`, `.catch()`, and `.finally()` with proper async resolution chaining.

**Examples:**
```
new MyPromise((resolve) => resolve(42))
  .then((v) => v * 2)
  .then((v) => console.log(v)); // 84

new MyPromise((_, reject) => reject("oops"))
  .catch((e) => console.log(e)); // "oops"
```

**Solution:**
```js
class MyPromise {
  #state = "pending";   // 'pending' | 'fulfilled' | 'rejected'
  #value = undefined;
  #handlers = [];       // queued { onFulfilled, onRejected, resolve, reject }

  constructor(executor) {
    try {
      executor(
        (value) => this.#resolve(value),
        (reason) => this.#reject(reason)
      );
    } catch (err) {
      this.#reject(err);
    }
  }

  #resolve(value) {
    if (this.#state !== "pending") return;

    // If resolved with another thenable, adopt its state
    if (value && typeof value.then === "function") {
      value.then(
        (v) => this.#resolve(v),
        (r) => this.#reject(r)
      );
      return;
    }

    this.#state = "fulfilled";
    this.#value = value;
    this.#processHandlers();
  }

  #reject(reason) {
    if (this.#state !== "pending") return;
    this.#state = "rejected";
    this.#value = reason;
    this.#processHandlers();
  }

  #processHandlers() {
    for (const handler of this.#handlers) {
      this.#runHandler(handler);
    }
    this.#handlers = [];
  }

  #runHandler({ onFulfilled, onRejected, resolve, reject }) {
    // Use queueMicrotask to match the native async behaviour
    queueMicrotask(() => {
      if (this.#state === "fulfilled") {
        if (typeof onFulfilled !== "function") return resolve(this.#value);
        try {
          resolve(onFulfilled(this.#value));
        } catch (err) {
          reject(err);
        }
      } else if (this.#state === "rejected") {
        if (typeof onRejected !== "function") return reject(this.#value);
        try {
          resolve(onRejected(this.#value));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handler = { onFulfilled, onRejected, resolve, reject };
      if (this.#state === "pending") {
        this.#handlers.push(handler); // queue for later
      } else {
        this.#runHandler(handler);    // already settled
      }
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (value) => {
        onFinally();
        return value;
      },
      (reason) => {
        onFinally();
        throw reason;
      }
    );
  }
}
```

**Explanation:** A Promise is a state machine with three states; once settled it never changes. Handlers are queued when the promise is still pending and flushed when it settles. `queueMicrotask` ensures callbacks run asynchronously after the current stack — matching the Promises/A+ specification. Chaining works because each `.then` returns a new `MyPromise` that resolves with the return value of the callback.

---

## Problem 32. 🔴 Implement an Async Event Emitter

**Problem:** Implement an `AsyncEventEmitter` class where handlers are `async` functions, listeners are invoked in registration order and awaited sequentially, and the emitter supports `on`, `off`, and `emit`.

**Examples:**
```
const emitter = new AsyncEventEmitter();

emitter.on("data", async (msg) => {
  await sleep(100);
  console.log("handler 1:", msg);
});

emitter.on("data", async (msg) => {
  console.log("handler 2:", msg);
});

await emitter.emit("data", "hello");
// handler 1: hello   (after ~100ms)
// handler 2: hello
```

**Solution:**
```js
class AsyncEventEmitter {
  #events = new Map(); // eventName → [handler, ...]

  on(event, handler) {
    if (!this.#events.has(event)) {
      this.#events.set(event, []);
    }
    this.#events.get(event).push(handler);
    return this; // allow chaining
  }

  off(event, handler) {
    if (!this.#events.has(event)) return this;
    const filtered = this.#events.get(event).filter((h) => h !== handler);
    this.#events.set(event, filtered);
    return this;
  }

  async emit(event, ...args) {
    if (!this.#events.has(event)) return;

    // Run handlers in series — each one is awaited before the next
    for (const handler of this.#events.get(event)) {
      await handler(...args);
    }
  }

  // Convenience: listen only once
  once(event, handler) {
    const wrapper = async (...args) => {
      this.off(event, wrapper);
      await handler(...args);
    };
    return this.on(event, wrapper);
  }
}
```

**Explanation:** Handlers are stored in a `Map` keyed by event name. `emit` iterates the listener array with a `for...of` loop and `await`s each handler sequentially, so errors in one handler bubble up and stop subsequent handlers — useful for middleware-style pipelines. The `once` wrapper unregisters itself before calling the real handler to prevent double-firing.

---

## DOM & Browser (33–37)

---

## Problem 33. 🟢 Implement a Simple Event Emitter (on, emit, off)

**Problem:** Implement an `EventEmitter` class with synchronous `on(event, fn)`, `emit(event, ...args)`, and `off(event, fn)` methods.

**Examples:**
```
const emitter = new EventEmitter();
const handler = (msg) => console.log(msg);

emitter.on("greet", handler);
emitter.emit("greet", "hello"); // logs "hello"
emitter.off("greet", handler);
emitter.emit("greet", "hello"); // nothing logged
```

**Solution:**
```js
class EventEmitter {
  constructor() {
    this._events = {}; // { eventName: Set<handler> }
  }

  on(event, fn) {
    if (!this._events[event]) {
      this._events[event] = new Set();
    }
    this._events[event].add(fn);
    return this;
  }

  off(event, fn) {
    if (this._events[event]) {
      this._events[event].delete(fn);
    }
    return this;
  }

  emit(event, ...args) {
    if (!this._events[event]) return false;
    // Snapshot to avoid issues if a handler calls off() mid-iteration
    for (const fn of [...this._events[event]]) {
      fn(...args);
    }
    return true;
  }

  once(event, fn) {
    const wrapper = (...args) => {
      fn(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}
```

**Explanation:** A `Set` is used per event so duplicate listeners are rejected automatically and deletion is O(1). The `emit` method snapshots the listener set before iterating so that handlers which remove themselves do not break the loop. Time complexity for `emit` is O(n) where n is the listener count.

---

## Problem 34. 🟡 Implement Event Delegation Helper Function

**Problem:** Implement `delegate(parent, selector, eventType, handler)` that attaches a single listener on `parent` that fires `handler` only when the event target matches `selector`, handling bubbling correctly.

**Examples:**
```
// Handles clicks on any current or future .btn inside #container
delegate(
  document.getElementById("container"),
  ".btn",
  "click",
  (e, target) => console.log("clicked:", target.textContent)
);
```

**Solution:**
```js
/**
 * Attaches a delegated event listener.
 * @param {Element} parent - Element to attach the real listener to
 * @param {string} selector - CSS selector for the target elements
 * @param {string} eventType - Event type (e.g. "click")
 * @param {Function} handler - Called with (event, matchedTarget)
 * @returns {Function} - Cleanup function to remove the listener
 */
function delegate(parent, selector, eventType, handler) {
  function listener(event) {
    // Walk up from the actual target to find the first matching ancestor
    let target = event.target;

    while (target && target !== parent) {
      if (target.matches(selector)) {
        handler(event, target);
        return;
      }
      target = target.parentElement;
    }
  }

  parent.addEventListener(eventType, listener);

  // Return a cleanup function
  return () => parent.removeEventListener(eventType, listener);
}
```

**Explanation:** Instead of attaching a listener to every matching element, we attach one listener to a common ancestor and let events bubble up to it. The walk up the DOM tree handles cases where the event fires on a child element inside the selector (e.g. a `<span>` inside a `<button>`). Returning a cleanup function follows modern best practices for managing listener lifecycles.

---

## Problem 35. 🟡 Implement a Basic Pub/Sub System

**Problem:** Implement a `PubSub` class with `subscribe(topic, fn)`, `publish(topic, data)`, and `unsubscribe(token)` where each subscription returns a unique token used for cancellation.

**Examples:**
```
const ps = new PubSub();

const token = ps.subscribe("news", (data) => console.log("A:", data));
ps.subscribe("news", (data) => console.log("B:", data));

ps.publish("news", "Breaking news!"); // logs A and B
ps.unsubscribe(token);
ps.publish("news", "More news!");     // logs B only
```

**Solution:**
```js
class PubSub {
  #topics = new Map();  // topic → Map<token, handler>
  #counter = 0;         // auto-incrementing token

  subscribe(topic, fn) {
    if (!this.#topics.has(topic)) {
      this.#topics.set(topic, new Map());
    }
    const token = ++this.#counter;
    this.#topics.get(topic).set(token, fn);
    return token; // caller uses this to unsubscribe
  }

  unsubscribe(token) {
    for (const [, subscribers] of this.#topics) {
      if (subscribers.delete(token)) return true; // found and removed
    }
    return false;
  }

  publish(topic, data) {
    if (!this.#topics.has(topic)) return;
    for (const fn of this.#topics.get(topic).values()) {
      fn(data);
    }
  }
}
```

**Explanation:** Each subscription gets a monotonically increasing integer token stored as the Map key, making O(1) subscription and O(subscribers) unsubscription. Pub/Sub decouples publishers from subscribers — publishers do not need to know who is listening. This pattern is commonly used in micro-frontend architectures and cross-component communication without a shared store.

---

## Problem 36. 🟡 Implement Infinite Scroll Logic

**Problem:** Implement `setupInfiniteScroll(container, loadMore, options)` that calls `loadMore()` when the user scrolls near the bottom of `container`, with support for a threshold distance and debouncing.

**Examples:**
```
setupInfiniteScroll(
  document.getElementById("feed"),
  async () => {
    const items = await fetchNextPage();
    renderItems(items);
  },
  { threshold: 200, debounce: 150 }
);
```

**Solution:**
```js
/**
 * Sets up infinite scroll on a scrollable container.
 * @param {Element|Window} container - Scrollable element or window
 * @param {Function} loadMore - Async function to load next page
 * @param {{ threshold?: number, debounce?: number }} options
 * @returns {Function} cleanup - Call to remove the scroll listener
 */
function setupInfiniteScroll(container, loadMore, options = {}) {
  const { threshold = 300, debounce: debounceMs = 200 } = options;
  let loading = false;  // prevents concurrent loads
  let timer = null;

  async function handleScroll() {
    // Determine remaining scroll distance to the bottom
    const { scrollTop, scrollHeight, clientHeight } =
      container === window
        ? {
            scrollTop: window.scrollY,
            scrollHeight: document.body.scrollHeight,
            clientHeight: window.innerHeight,
          }
        : container;

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom <= threshold && !loading) {
      loading = true;
      try {
        await loadMore();
      } finally {
        loading = false; // always reset, even on error
      }
    }
  }

  // Debounce wrapper to reduce scroll event frequency
  function onScroll() {
    clearTimeout(timer);
    timer = setTimeout(handleScroll, debounceMs);
  }

  container.addEventListener("scroll", onScroll, { passive: true });

  // Return cleanup so callers can remove the listener (e.g. on component unmount)
  return () => {
    container.removeEventListener("scroll", onScroll);
    clearTimeout(timer);
  };
}
```

**Explanation:** The key safeguard is the `loading` flag, which prevents triggering multiple concurrent `loadMore` calls during a fast scroll. Debouncing the scroll handler with `setTimeout` avoids running the check on every single scroll pixel. Using `passive: true` on the listener tells the browser it can render scroll frames without waiting for our handler, keeping scroll smooth.

---

## Problem 37. 🔴 Implement a Virtual DOM Diff Algorithm (Simplified)

**Problem:** Implement `diff(oldNode, newNode)` that compares two virtual DOM trees and returns a list of patches (operations) describing what changed.

**Examples:**
```
const old = { type: "div", props: { id: "a" }, children: [{ type: "span", props: {}, children: ["hello"] }] };
const next = { type: "div", props: { id: "b" }, children: [{ type: "span", props: {}, children: ["world"] }] };

diff(old, next);
// → [
//     { op: "SET_PROP", path: [0], key: "id", value: "b" },
//     { op: "SET_TEXT", path: [0, 0], value: "world" }
//   ]
```

**Solution:**
```js
/**
 * Diffs two virtual DOM nodes and returns an array of patches.
 * VNode shape: { type: string, props: object, children: (VNode|string)[] }
 *              or a string (text node)
 */
function diff(oldNode, newNode, path = []) {
  const patches = [];

  // Case 1: Both are text nodes
  if (typeof oldNode === "string" && typeof newNode === "string") {
    if (oldNode !== newNode) {
      patches.push({ op: "SET_TEXT", path, value: newNode });
    }
    return patches;
  }

  // Case 2: Node type changed — full replace
  if (typeof oldNode !== typeof newNode || oldNode.type !== newNode.type) {
    patches.push({ op: "REPLACE", path, node: newNode });
    return patches;
  }

  // Case 3: Same type — diff props
  const allKeys = new Set([
    ...Object.keys(oldNode.props),
    ...Object.keys(newNode.props),
  ]);

  for (const key of allKeys) {
    if (newNode.props[key] === undefined) {
      patches.push({ op: "REMOVE_PROP", path, key });
    } else if (oldNode.props[key] !== newNode.props[key]) {
      patches.push({ op: "SET_PROP", path, key, value: newNode.props[key] });
    }
  }

  // Case 4: Diff children
  const maxLen = Math.max(
    oldNode.children.length,
    newNode.children.length
  );

  for (let i = 0; i < maxLen; i++) {
    const oldChild = oldNode.children[i];
    const newChild = newNode.children[i];
    const childPath = [...path, i];

    if (oldChild === undefined) {
      patches.push({ op: "INSERT", path: childPath, node: newChild });
    } else if (newChild === undefined) {
      patches.push({ op: "REMOVE", path: childPath });
    } else {
      patches.push(...diff(oldChild, newChild, childPath));
    }
  }

  return patches;
}
```

**Explanation:** This is a simplified O(n) tree diff — it compares nodes at the same position (index-based, no key reconciliation). Real frameworks like React use keys to match moved nodes, but the core logic is the same: detect type changes (replace), prop changes (set/remove), and child insertions/removals. The recursive approach naturally handles arbitrarily deep trees, with O(n) time and O(d) space where d is tree depth.

---

## Advanced Algorithms (38–44)

---

## Problem 38. 🟢 Check if a String is a Palindrome (Handle Spaces & Case)

**Problem:** Implement `isPalindrome(str)` that returns `true` if the string reads the same forwards and backwards, ignoring non-alphanumeric characters and letter case.

**Examples:**
```
isPalindrome("A man, a plan, a canal: Panama") // → true
isPalindrome("race a car")                      // → false
isPalindrome("Was it a car or a cat I saw?")    // → true
isPalindrome("")                                // → true
```

**Solution:**
```js
/**
 * Checks if a string is a palindrome ignoring case and non-alphanumeric chars.
 * @param {string} str
 * @returns {boolean}
 */
function isPalindrome(str) {
  // Normalise: lowercase and strip non-alphanumeric characters
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Two-pointer check — avoids creating a reversed copy
  let left = 0;
  let right = cleaned.length - 1;

  while (left < right) {
    if (cleaned[left] !== cleaned[right]) return false;
    left++;
    right--;
  }

  return true;
}
```

**Explanation:** After normalising the string, we use two pointers that march inward from both ends, comparing characters. This avoids allocating a reversed string. Time complexity is O(n) for the regex pass and O(n) for the comparison; space complexity is O(n) for the cleaned string.

---

## Problem 39. 🟡 Find the First Non-Repeating Character in a String

**Problem:** Implement `firstUniqueChar(str)` that returns the first character that appears exactly once, or `null` if none exists.

**Examples:**
```
firstUniqueChar("leetcode")   // → "l"
firstUniqueChar("loveleetcode") // → "v"
firstUniqueChar("aabb")       // → null
```

**Solution:**
```js
/**
 * Returns the first character that appears exactly once in the string.
 * @param {string} str
 * @returns {string|null}
 */
function firstUniqueChar(str) {
  // Pass 1: count frequency of each character
  const freq = new Map();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  // Pass 2: find first character with frequency 1
  for (const char of str) {
    if (freq.get(char) === 1) return char;
  }

  return null;
}
```

**Explanation:** Two linear passes over the string — one to build a frequency map and one to find the first character with count 1. Because `Map` preserves insertion order we could also iterate the map directly, but iterating the original string in pass 2 guarantees we respect original left-to-right order. Time complexity is O(n); space complexity is O(k) where k is the alphabet size (at most O(n)).

---

## Problem 40. 🟡 Implement Merge Sort

**Problem:** Implement `mergeSort(arr)` that returns a new sorted array using the merge sort algorithm.

**Examples:**
```
mergeSort([38, 27, 43, 3, 9, 82, 10]) // → [3, 9, 10, 27, 38, 43, 82]
mergeSort([])                          // → []
mergeSort([1])                         // → [1]
```

**Solution:**
```js
/**
 * Sorts an array using the merge sort algorithm.
 * @param {number[]} arr
 * @returns {number[]} New sorted array
 */
function mergeSort(arr) {
  // Base case: arrays of length 0 or 1 are already sorted
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

/**
 * Merges two sorted arrays into one sorted array.
 */
function merge(left, right) {
  const result = [];
  let i = 0;
  let j = 0;

  // Compare heads of both arrays and pick the smaller one
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  // Append any remaining elements
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  return result;
}
```

**Explanation:** Merge sort follows the divide-and-conquer pattern — recursively split the array in half until reaching single elements, then merge sorted halves back together. The merge step is O(n) and the recursion depth is O(log n), giving an overall time complexity of O(n log n) in all cases. Space complexity is O(n) for the auxiliary arrays created during merging.

---

## Problem 41. 🟡 Valid Parentheses — Check Balanced Brackets

**Problem:** Implement `isValid(s)` that returns `true` if the string containing `(`, `)`, `{`, `}`, `[`, `]` is valid — every opening bracket has a matching closing bracket in the correct order.

**Examples:**
```
isValid("()")        // → true
isValid("()[]{}")    // → true
isValid("(]")        // → false
isValid("([)]")      // → false
isValid("{[]}")      // → true
```

**Solution:**
```js
/**
 * Checks if bracket characters in a string are balanced.
 * @param {string} s
 * @returns {boolean}
 */
function isValid(s) {
  const stack = [];
  const matching = { ")": "(", "}": "{", "]": "[" };

  for (const char of s) {
    if ("({[".includes(char)) {
      // Opening bracket: push onto stack
      stack.push(char);
    } else {
      // Closing bracket: must match the top of the stack
      if (stack.pop() !== matching[char]) return false;
    }
  }

  // Valid only if all brackets were matched
  return stack.length === 0;
}
```

**Explanation:** A stack is the natural data structure here — each opening bracket is pushed, and each closing bracket must match the most recently seen unmatched opening bracket (LIFO). If a closing bracket does not match the stack top, or if the stack is not empty at the end, the string is invalid. Time complexity is O(n); space complexity is O(n) in the worst case of all opening brackets.

---

## Problem 42. 🟡 Find All Permutations of a String

**Problem:** Implement `permutations(str)` that returns all unique permutations of the input string.

**Examples:**
```
permutations("abc") // → ["abc", "acb", "bac", "bca", "cab", "cba"]
permutations("aa")  // → ["aa"]
permutations("ab")  // → ["ab", "ba"]
```

**Solution:**
```js
/**
 * Returns all unique permutations of a string.
 * @param {string} str
 * @returns {string[]}
 */
function permutations(str) {
  const result = new Set(); // Set eliminates duplicates from repeated chars

  function backtrack(current, remaining) {
    if (remaining.length === 0) {
      result.add(current);
      return;
    }

    for (let i = 0; i < remaining.length; i++) {
      // Choose character at index i
      const char = remaining[i];
      // Recurse with that character removed from remaining
      backtrack(
        current + char,
        remaining.slice(0, i) + remaining.slice(i + 1)
      );
    }
  }

  backtrack("", str);
  return [...result];
}
```

**Explanation:** We use backtracking — at each step, pick each remaining character and recurse with that character removed. Using a `Set` for results handles duplicate characters (e.g. "aa") without needing to sort and skip. Time complexity is O(n! * n) — n! permutations each of length n; space complexity is O(n! * n) to store all results plus O(n) call stack depth.

---

## Problem 43. 🔴 Implement a Trie (Prefix Tree) with insert, search, startsWith

**Problem:** Implement a `Trie` class with:
- `insert(word)` — add a word
- `search(word)` — return `true` if the exact word exists
- `startsWith(prefix)` — return `true` if any word has that prefix

**Examples:**
```
const trie = new Trie();
trie.insert("apple");
trie.search("apple")   // → true
trie.search("app")     // → false
trie.startsWith("app") // → true
trie.insert("app");
trie.search("app")     // → true
```

**Solution:**
```js
class TrieNode {
  constructor() {
    this.children = {};   // char → TrieNode
    this.isEnd = false;   // marks the end of a complete word
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Inserts a word into the trie.
   */
  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEnd = true; // mark the terminal node
  }

  /**
   * Returns true if the exact word exists in the trie.
   */
  search(word) {
    const node = this.#traverse(word);
    return node !== null && node.isEnd;
  }

  /**
   * Returns true if any word in the trie starts with the given prefix.
   */
  startsWith(prefix) {
    return this.#traverse(prefix) !== null;
  }

  /**
   * Traverses the trie following characters of str.
   * Returns the final node, or null if path does not exist.
   */
  #traverse(str) {
    let node = this.root;
    for (const char of str) {
      if (!node.children[char]) return null;
      node = node.children[char];
    }
    return node;
  }
}
```

**Explanation:** A trie stores characters as edges between nodes rather than within nodes. Each path from root to a terminal node (`isEnd = true`) represents a complete word. The shared private `#traverse` method eliminates duplication between `search` and `startsWith` — the only difference is whether we also check `isEnd`. Time complexity for all operations is O(m) where m is the word/prefix length; space complexity is O(ALPHABET_SIZE * m * n) for n words.

---

## Problem 44. 🔴 Topological Sort of a Directed Graph

**Problem:** Implement `topologicalSort(numNodes, edges)` that returns a valid topological ordering of nodes, or `null` if the graph contains a cycle. Nodes are numbered `0` to `numNodes - 1`.

**Examples:**
```
topologicalSort(6, [[5,2],[5,0],[4,0],[4,1],[2,3],[3,1]])
// → [5, 4, 2, 3, 1, 0]  (one valid ordering)

topologicalSort(2, [[0,1],[1,0]])
// → null  (cycle detected)
```

**Solution:**
```js
/**
 * Returns a topological ordering using Kahn's algorithm (BFS-based).
 * @param {number} numNodes
 * @param {number[][]} edges - [u, v] means u must come before v
 * @returns {number[]|null} Ordering, or null if a cycle exists
 */
function topologicalSort(numNodes, edges) {
  // Build adjacency list and in-degree count
  const adj = Array.from({ length: numNodes }, () => []);
  const inDegree = new Array(numNodes).fill(0);

  for (const [u, v] of edges) {
    adj[u].push(v);
    inDegree[v]++;
  }

  // Start with all nodes that have no prerequisites
  const queue = [];
  for (let i = 0; i < numNodes; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const order = [];

  while (queue.length > 0) {
    const node = queue.shift(); // pick a node with zero in-degree
    order.push(node);

    // "Remove" this node: reduce in-degree of its neighbours
    for (const neighbour of adj[node]) {
      inDegree[neighbour]--;
      if (inDegree[neighbour] === 0) {
        queue.push(neighbour); // neighbour is now ready to be processed
      }
    }
  }

  // If we could not process all nodes, there must be a cycle
  return order.length === numNodes ? order : null;
}
```

**Explanation:** Kahn's algorithm uses BFS with in-degree tracking. A node can only be added to the result once all its prerequisites (in-edges) have been processed. If the final ordering does not include every node, at least one cycle existed — those nodes' in-degrees never reached zero. Time complexity is O(V + E) where V is nodes and E is edges; space complexity is O(V + E).

---

## Utility Functions (45–50)

---

## Problem 45. 🟡 Implement Deep Equal

**Problem:** Implement `deepEqual(a, b)` that returns `true` if two values are deeply equal, handling objects, arrays, primitives, `null`, `NaN`, and circular references.

**Examples:**
```
deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }) // → true
deepEqual({ a: 1 }, { a: 2 })                        // → false
deepEqual(NaN, NaN)                                  // → true
deepEqual(null, null)                                // → true
deepEqual(null, undefined)                           // → false
```

**Solution:**
```js
/**
 * Deep equality check for any two JavaScript values.
 * @param {*} a
 * @param {*} b
 * @param {WeakMap} [seen] - Tracks visited object pairs to detect cycles
 * @returns {boolean}
 */
function deepEqual(a, b, seen = new WeakMap()) {
  // Handle NaN (NaN !== NaN in JS)
  if (Number.isNaN(a) && Number.isNaN(b)) return true;

  // Strict equality covers primitives, same references, null === null
  if (a === b) return true;

  // If types differ, not equal
  if (typeof a !== typeof b) return false;

  // Handle null (typeof null === 'object')
  if (a === null || b === null) return false;

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle non-plain objects (RegExp, etc.) by string comparison
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  // Both must be objects (or arrays) at this point
  if (typeof a !== "object") return false;

  // Cycle detection: if we've seen this pair before, assume equal
  if (seen.has(a)) return seen.get(a) === b;
  seen.set(a, b);

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // Must have the same number of keys
  if (keysA.length !== keysB.length) return false;

  // Every key in a must exist in b and have a deeply equal value
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key], seen)) return false;
  }

  return true;
}
```

**Explanation:** The function handles every edge case methodically: `NaN` equality, `Date` comparison by timestamp, `RegExp` by string representation, and circular references via a `WeakMap` that maps object references seen in `a` to their counterpart in `b`. The `WeakMap` uses `WeakMap` (not `Map`) so references do not prevent garbage collection. Time complexity is O(n) where n is the total number of nested properties.

---

## Problem 46. 🟡 Implement pipe / compose

**Problem:** Implement both `pipe(...fns)` and `compose(...fns)`. `pipe` applies functions left-to-right; `compose` applies right-to-left. Each function takes the result of the previous one.

**Examples:**
```
const add1 = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

pipe(add1, double, square)(3)    // → ((3+1)*2)^2 = 64
compose(square, double, add1)(3) // → same: 64
```

**Solution:**
```js
/**
 * Applies functions left-to-right.
 * pipe(f, g, h)(x) === h(g(f(x)))
 * @param {...Function} fns
 * @returns {Function}
 */
function pipe(...fns) {
  return function (value) {
    return fns.reduce((acc, fn) => fn(acc), value);
  };
}

/**
 * Applies functions right-to-left.
 * compose(f, g, h)(x) === f(g(h(x)))
 * @param {...Function} fns
 * @returns {Function}
 */
function compose(...fns) {
  return pipe(...fns.reverse());
}

// Async variants that support Promise-returning functions
function pipeAsync(...fns) {
  return function (value) {
    return fns.reduce(
      (promise, fn) => promise.then(fn),
      Promise.resolve(value)
    );
  };
}
```

**Explanation:** `pipe` is implemented with `Array.reduce`, threading the accumulator through each function. `compose` is simply `pipe` with the function order reversed. These higher-order functions are foundational to functional programming — they allow building complex data transformations from small, pure, reusable functions. Time and space complexity are both O(n) where n is the number of composed functions.

---

## Problem 47. 🟡 Implement JSON.stringify from Scratch (Simplified)

**Problem:** Implement `jsonStringify(value)` that converts a JavaScript value to a JSON string, handling objects, arrays, strings, numbers, booleans, and `null`. Ignore functions and `undefined`.

**Examples:**
```
jsonStringify({ a: 1, b: [2, "hi", true, null] })
// → '{"a":1,"b":[2,"hi",true,null]}'

jsonStringify([1, undefined, function(){}, 3])
// → '[1,null,null,3]'  (undefined/functions become null inside arrays)
```

**Solution:**
```js
/**
 * Converts a value to its JSON string representation.
 * @param {*} value
 * @returns {string}
 */
function jsonStringify(value) {
  // null
  if (value === null) return "null";

  // Functions and undefined at the top level return undefined (not a string)
  if (typeof value === "undefined" || typeof value === "function") {
    return undefined;
  }

  // Booleans
  if (typeof value === "boolean") return value ? "true" : "false";

  // Numbers (NaN and Infinity serialise as null in real JSON)
  if (typeof value === "number") {
    if (!isFinite(value)) return "null";
    return String(value);
  }

  // Strings — escape special characters
  if (typeof value === "string") {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return `"${escaped}"`;
  }

  // Arrays
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      // undefined and functions in arrays become null
      const serialised = jsonStringify(item);
      return serialised === undefined ? "null" : serialised;
    });
    return `[${items.join(",")}]`;
  }

  // Plain objects
  if (typeof value === "object") {
    const pairs = Object.keys(value)
      .filter((key) => {
        const v = value[key];
        // Skip undefined values and functions (they are omitted in real JSON)
        return typeof v !== "undefined" && typeof v !== "function";
      })
      .map((key) => `${jsonStringify(key)}:${jsonStringify(value[key])}`);
    return `{${pairs.join(",")}}`;
  }
}
```

**Explanation:** The function recursively handles each JavaScript type, matching the behaviour of the native `JSON.stringify`. Key gotchas: `undefined` and functions are omitted from objects but become `null` in arrays; `NaN` and `Infinity` serialize to `null`; strings need escape sequences for special characters. Time complexity is O(n) where n is the total number of values in the structure.

---

## Problem 48. 🟡 Implement a Basic Template Engine

**Problem:** Implement `render(template, data)` that replaces `{{variable}}` placeholders in a template string with corresponding values from a data object. Support dot notation for nested properties and a fallback for missing keys.

**Examples:**
```
render("Hello, {{name}}! You are {{age}} years old.", { name: "Alice", age: 30 })
// → "Hello, Alice! You are 30 years old."

render("Hi {{user.firstName}}!", { user: { firstName: "Bob" } })
// → "Hi Bob!"

render("Value: {{missing}}", {})
// → "Value: "
```

**Solution:**
```js
/**
 * Replaces {{variable}} placeholders with values from a data object.
 * Supports dot notation for nested access (e.g. {{user.name}}).
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
function render(template, data) {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, path) => {
    const value = resolvePath(data, path.trim());
    // Coerce to string; undefined/null become empty string
    return value != null ? String(value) : "";
  });
}

/**
 * Resolves a dot-notation path against an object.
 * e.g. resolvePath({ a: { b: 1 } }, "a.b") → 1
 */
function resolvePath(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current != null ? current[key] : undefined;
  }, obj);
}
```

**Explanation:** The regex `/\{\{\s*([^}]+?)\s*\}\}/g` captures the content between `{{` and `}}`, trimming optional whitespace. `resolvePath` traverses nested properties using `reduce` on the dot-separated key array — this is how most production template engines handle nested access. Missing paths return `undefined`, which we coerce to an empty string. Time complexity is O(n * d) where n is the number of placeholders and d is the nesting depth.

---

## Problem 49. 🔴 Implement a Basic Reactive System (Like Vue's Reactivity)

**Problem:** Implement a reactive system with `reactive(obj)` that returns a proxy where mutating a property automatically triggers any effects that read that property. Implement `effect(fn)` to register a reactive side effect.

**Examples:**
```
const state = reactive({ count: 0, name: "Alice" });

effect(() => console.log("count is:", state.count));
// immediately logs: "count is: 0"

state.count++;
// automatically logs: "count is: 1"

state.name = "Bob";
// nothing logged (name was not read in the effect)
```

**Solution:**
```js
// The currently-running effect function (global for simplicity)
let activeEffect = null;

// dep map: target → key → Set<effect fn>
const targetMap = new WeakMap();

function track(target, key) {
  if (!activeEffect) return; // only track inside effects

  if (!targetMap.has(target)) targetMap.set(target, new Map());
  const depsMap = targetMap.get(target);

  if (!depsMap.has(key)) depsMap.set(key, new Set());
  depsMap.get(key).add(activeEffect); // subscribe this effect to this key
}

function trigger(target, key) {
  if (!targetMap.has(target)) return;
  const depsMap = targetMap.get(target);
  if (!depsMap.has(key)) return;

  // Re-run all effects that depend on target[key]
  for (const effectFn of depsMap.get(key)) {
    effectFn();
  }
}

/**
 * Wraps an object in a Proxy that tracks reads and triggers effects on writes.
 * @param {object} obj
 * @returns {Proxy}
 */
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      track(target, key); // record that activeEffect depends on this key
      return value;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // notify dependents of this key
      return result;
    },
  });
}

/**
 * Runs fn immediately and re-runs it whenever reactive state it reads changes.
 * @param {Function} fn
 */
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn; // set as the currently tracked effect
    fn();                    // run fn — any reactive reads inside will call track()
    activeEffect = null;     // clear after execution
  };
  effectFn(); // run immediately to perform initial tracking
}
```

**Explanation:** This is Vue 3's reactivity model in miniature. The `Proxy` intercepts property reads (`get`) to record which effect is currently executing — this is called dependency tracking. Property writes (`set`) trigger all effects that were recorded as dependents of that key. The global `activeEffect` variable is the bridge: `effect()` sets it before running the function so `track()` knows which effect to subscribe. This creates an automatic, fine-grained dependency graph at runtime.

---

## Problem 50. 🔴 Implement a JavaScript Type Checker Function

**Problem:** Implement `typeOf(value)` that returns an accurate type string for any JavaScript value, correctly distinguishing `null`, `array`, `NaN`, `date`, `regexp`, `map`, `set`, `promise`, and all other types.

**Examples:**
```
typeOf(null)           // → "null"
typeOf(undefined)      // → "undefined"
typeOf(NaN)            // → "nan"
typeOf([])             // → "array"
typeOf({})             // → "object"
typeOf(new Date())     // → "date"
typeOf(/regex/)        // → "regexp"
typeOf(new Map())      // → "map"
typeOf(new Set())      // → "set"
typeOf(Promise.resolve()) // → "promise"
typeOf(42)             // → "number"
typeOf("hi")           // → "string"
typeOf(true)           // → "boolean"
typeOf(Symbol())       // → "symbol"
typeOf(42n)            // → "bigint"
typeOf(function(){})   // → "function"
```

**Solution:**
```js
/**
 * Returns an accurate, lowercase type string for any JavaScript value.
 * Fixes all the known quirks of the built-in `typeof` operator.
 * @param {*} value
 * @returns {string}
 */
function typeOf(value) {
  // Handle null first — typeof null === "object" is a historic JS bug
  if (value === null) return "null";

  // Handle NaN — typeof NaN === "number" but it represents "not a number"
  if (typeof value === "number" && Number.isNaN(value)) return "nan";

  // For primitive types, typeof is reliable
  const primitiveTypes = ["undefined", "boolean", "number", "string", "symbol", "bigint", "function"];
  if (primitiveTypes.includes(typeof value)) return typeof value;

  // For objects, use Object.prototype.toString for precise tag
  // Returns strings like "[object Array]", "[object Date]", etc.
  const tag = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();

  return tag;
}

// Demonstration
const examples = [
  null, undefined, NaN, [], {}, new Date(), /regex/,
  new Map(), new Set(), new WeakMap(), new WeakSet(),
  Promise.resolve(), new Error("e"),
  42, "hi", true, Symbol("s"), 42n, function () {},
];

for (const val of examples) {
  console.log(`typeOf(${String(val)}) → "${typeOf(val)}"`);
}
```

**Explanation:** `typeof` has two notorious bugs: `typeof null === "object"` and `typeof NaN === "number"`. We handle both as early returns. For all true objects, `Object.prototype.toString.call(value)` returns a `[object Tag]` string where the tag is the internal `[[Class]]` — this correctly distinguishes `Array`, `Date`, `RegExp`, `Map`, `Set`, `Promise`, and more. Extracting `.slice(8, -1).toLowerCase()` gives us a clean, consistent type string. This technique is how libraries like Lodash implement `_.isArray`, `_.isDate`, etc.

---

*End of Part 2 — Problems 26–50.*
