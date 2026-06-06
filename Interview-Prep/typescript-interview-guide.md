# TypeScript Interview Preparation Guide - Zero to Advanced

> A complete, structured interview prep resource covering 60 critical TypeScript interview questions across all major topics, plus 30 hands-on coding problems with solutions. Covers every topic from basic annotations to advanced type-level programming.

---

## Table of Contents

### Interview Questions

1. [Basics & Setup (Q1–Q5)](#basics--setup)
2. [Types & Type Annotations (Q6–Q12)](#types--type-annotations)
3. [Interfaces vs Type Aliases (Q13–Q16)](#interfaces-vs-type-aliases)
4. [Generics (Q17–Q22)](#generics)
5. [Union, Intersection & Narrowing (Q23–Q28)](#union-intersection--narrowing)
6. [Classes & OOP (Q29–Q34)](#classes--oop)
7. [Utility Types & Mapped Types (Q35–Q40)](#utility-types--mapped-types)
8. [Advanced Types (Q41–Q47)](#advanced-types)
9. [Modules, Declaration Files & tsconfig (Q48–Q52)](#modules-declaration-files--tsconfig)
10. [TypeScript in Practice (Q53–Q60)](#typescript-in-practice)

### Coding Problems

11. [Type Utilities (Problems 1–8)](#type-utilities)
12. [Generics & Constraints (Problems 9–15)](#generics--constraints)
13. [Advanced Type Challenges (Problems 16–22)](#advanced-type-challenges)
14. [Real-World Patterns (Problems 23–30)](#real-world-patterns)

---

# Part 1: Interview Questions (60 Questions)

---

## Basics & Setup

---

## Q1. 🟢 What is TypeScript, and why use it over plain JavaScript?

**Answer:**

TypeScript is a **statically typed superset of JavaScript** developed by Microsoft. It compiles to plain JavaScript and runs anywhere JavaScript runs — browsers, Node.js, Deno.

**Core advantages over plain JavaScript:**

| Concern | JavaScript | TypeScript |
|---|---|---|
| Type checking | Runtime only | Compile-time + runtime |
| IDE support | Basic autocomplete | Rich IntelliSense, refactoring |
| Bug detection | At runtime (production) | During development |
| Refactoring safety | Error-prone | Compiler catches broken references |
| Self-documenting code | Relies on JSDoc/naming | Types are the documentation |
| Large-scale collaboration | Fragile contracts | Enforced contracts via types |

```ts
// JavaScript — bug caught at runtime (maybe in production)
function add(a, b) {
  return a + b;
}
add(1, "2"); // "12" — silent bug

// TypeScript — bug caught immediately
function add(a: number, b: number): number {
  return a + b;
}
add(1, "2"); // Error: Argument of type 'string' is not assignable to parameter of type 'number'
```

**When TypeScript is NOT ideal:**
- Small scripts/prototypes where setup overhead isn't worth it
- Teams that are not willing to invest in learning its type system

**Why interviewer asks this:** To confirm you understand TypeScript's value proposition, not just that it "adds types."

---

## Q2. 🟢 How do you set up a TypeScript project from scratch?

**Answer:**

```bash
# 1. Install TypeScript
npm install --save-dev typescript

# 2. Create a tsconfig.json
npx tsc --init

# 3. Compile a file
npx tsc index.ts

# 4. Watch mode
npx tsc --watch
```

**Minimal `tsconfig.json` for a Node.js project:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key `compilerOptions`:**

| Option | Purpose |
|---|---|
| `target` | Which ECMAScript version to compile to |
| `module` | Module system (`CommonJS`, `ESNext`, etc.) |
| `strict` | Enables all strict type-checking options |
| `outDir` | Output directory for compiled JS |
| `rootDir` | Root of source TypeScript files |
| `sourceMap` | Generate `.map` files for debugging |
| `declaration` | Generate `.d.ts` files for libraries |

---

## Q3. 🟢 What is the difference between `tsc` and `ts-node`?

**Answer:**

| | `tsc` | `ts-node` |
|---|---|---|
| What it does | Compiles TS → JS | Compiles and runs TS in-memory |
| Output | `.js` files on disk | No files written |
| Use case | Production builds | Development / scripts / REPL |
| Speed | Slower (full compilation) | Fast (on-demand, JIT) |

```bash
# tsc — compiles to dist/, then run with node
npx tsc && node dist/index.js

# ts-node — compile and run in one step
npx ts-node src/index.ts

# ts-node-esm — for ESM projects
npx ts-node --esm src/index.ts
```

**Why interviewer asks this:** Common source of confusion when developers start a TS project.

---

## Q4. 🟢 What does `strict: true` enable in TypeScript?

**Answer:**

`strict: true` is a shorthand that enables a collection of individual strict checks:

| Flag | What it catches |
|---|---|
| `strictNullChecks` | `null`/`undefined` must be handled explicitly |
| `noImplicitAny` | Variables can't silently become `any` |
| `strictFunctionTypes` | Stricter function parameter contravariance |
| `strictBindCallApply` | `bind`, `call`, `apply` are fully typed |
| `strictPropertyInitialization` | Class properties must be initialized in constructor |
| `noImplicitThis` | `this` in functions must have a known type |
| `useUnknownInCatchVariables` | Catch clause variable is `unknown`, not `any` |
| `alwaysStrict` | Emits `"use strict"` in all compiled files |

```ts
// Without strictNullChecks
let name: string = null; // allowed

// With strictNullChecks
let name: string = null; // Error: Type 'null' is not assignable to type 'string'
let name2: string | null = null; // correct
```

**Best practice:** Always enable `strict: true`. The extra noise upfront is far cheaper than runtime bugs later.

---

## Q5. 🟢 What is the TypeScript compilation pipeline?

**Answer:**

```
Source (.ts) → Parser → AST → Type Checker → Emitter → JavaScript (.js)
```

1. **Scanner** — tokenizes the source into tokens
2. **Parser** — builds an Abstract Syntax Tree (AST)
3. **Binder** — creates symbols, establishes scopes
4. **Type Checker** — validates types, infers missing types
5. **Emitter** — transforms typed AST to JavaScript output

TypeScript type information is **erased at runtime** — there is no runtime type system. Types exist only at compile time.

```ts
// TypeScript source
const greet = (name: string): string => `Hello, ${name}`;

// Compiled JavaScript (no types)
const greet = (name) => `Hello, ${name}`;
```

---

## Types & Type Annotations

---

## Q6. 🟢 What primitive types does TypeScript have?

**Answer:**

TypeScript mirrors JavaScript primitives and adds its own:

| Type | Example | Notes |
|---|---|---|
| `string` | `"hello"` | UTF-16 string |
| `number` | `42`, `3.14` | All numbers (int + float) |
| `boolean` | `true`, `false` | |
| `null` | `null` | Explicit absence of value |
| `undefined` | `undefined` | Uninitialized value |
| `symbol` | `Symbol("id")` | Unique identifier |
| `bigint` | `9007199254740991n` | Arbitrary precision integer |
| `object` | `{}`, `[]` | Non-primitive values |
| `any` | anything | Opt-out of type checking |
| `unknown` | anything | Safe alternative to `any` |
| `never` | — | Type for values that never occur |
| `void` | — | Functions that return nothing |

```ts
let name: string = "Alice";
let age: number = 30;
let active: boolean = true;
let nothing: null = null;
let notSet: undefined = undefined;
let id: symbol = Symbol("id");
let bigNum: bigint = 100n;

// TypeScript-only types
let anything: any = 42; // bypass type checking (avoid!)
let safeAny: unknown = 42; // must narrow before use
function fail(): never { throw new Error("never reaches here"); }
function log(msg: string): void { console.log(msg); }
```

---

## Q7. 🟢 What is the difference between `any` and `unknown`?

**Answer:**

Both can hold any value, but `unknown` is the **type-safe** version of `any`.

| | `any` | `unknown` |
|---|---|---|
| Assignable to anything | Yes | No — must narrow first |
| Operations without check | Allowed | Error — must narrow |
| Type safety | Opt-out completely | Preserved |
| When to use | Legacy code / escape hatch | External data, APIs, catch blocks |

```ts
// any — dangerous, no errors
let a: any = "hello";
a.toFixed(2); // No error at compile time — runtime crash!
a.nonExistent(); // No error — silently wrong

// unknown — safe
let u: unknown = "hello";
// u.toUpperCase(); // Error: Object is of type 'unknown'

// Must narrow first
if (typeof u === "string") {
  u.toUpperCase(); // OK — narrowed to string
}

// useUnknownInCatchVariables (strict mode)
try {
  riskyOperation();
} catch (err) {
  // err is unknown, not any
  if (err instanceof Error) {
    console.log(err.message); // safe
  }
}
```

**Rule of thumb:** Never use `any` unless migrating legacy JS. Prefer `unknown` + narrowing.

---

## Q8. 🟢 What is type inference in TypeScript?

**Answer:**

TypeScript infers types automatically when you don't annotate them. You only need to annotate where inference is ambiguous or wrong.

```ts
// TypeScript infers all these types
let count = 0;           // inferred: number
let name = "Alice";      // inferred: string
let flags = [true, false]; // inferred: boolean[]

// Inferred from return type
function double(n: number) {
  return n * 2; // inferred return type: number
}

// Contextual typing — inferred from context
const nums = [1, 2, 3];
nums.forEach(n => {      // n is inferred as number
  console.log(n.toFixed(2));
});

// When inference is too wide
let status = "active";   // inferred: string (not "active")
// Fix: use const or as const
const status2 = "active"; // inferred: "active" (literal type)
```

**Best practice:** Let TypeScript infer types for local variables and return types. Always annotate function parameters and public API surfaces.

---

## Q9. 🟡 What are literal types and `as const`?

**Answer:**

Literal types restrict a variable to a specific value rather than a broad type.

```ts
// String literal type
type Direction = "north" | "south" | "east" | "west";

function move(dir: Direction) {
  console.log(`Moving ${dir}`);
}
move("north"); // OK
// move("up"); // Error: Argument of type '"up"' is not assignable to type 'Direction'

// Numeric literal type
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

// `as const` — makes an object/array deeply readonly with literal types
const config = {
  host: "localhost",
  port: 3000,
  env: "development"
} as const;
// config.port is inferred as 3000 (literal), not number
// config.host is inferred as "localhost", not string

// Without as const
const config2 = { port: 3000 }; // port: number

// Useful for exhaustive switch statements
type Status = "pending" | "active" | "inactive";
function handleStatus(s: Status) {
  switch (s) {
    case "pending": return "waiting";
    case "active": return "running";
    case "inactive": return "stopped";
    // TypeScript warns if you miss a case
  }
}
```

---

## Q10. 🟡 What are tuple types in TypeScript?

**Answer:**

Tuples are typed arrays with a fixed number of elements where each position has a specific type.

```ts
// Basic tuple
type Point = [number, number];
const origin: Point = [0, 0];
const moved: Point = [3, 4];
// const bad: Point = [1, 2, 3]; // Error: too many elements

// Named tuple elements (TS 4.0+)
type RGB = [red: number, green: number, blue: number];
const red: RGB = [255, 0, 0];

// Optional tuple elements
type Config = [string, number?];
const a: Config = ["host"];
const b: Config = ["host", 3000];

// Rest elements
type StringsAndNumber = [...string[], number];
const c: StringsAndNumber = ["a", "b", 42];

// Destructuring tuples
const [x, y]: Point = [10, 20];

// Function returning tuple
function useState<T>(initial: T): [T, (val: T) => void] {
  let state = initial;
  return [state, (v) => { state = v; }];
}
```

**Why interviewer asks this:** React's `useState` returns a tuple — understanding tuples is essential for React + TypeScript.

---

## Q11. 🟡 What is the `never` type and when does it occur?

**Answer:**

`never` represents a type that **never has a value** — functions that always throw or loop forever, and branches that can't be reached.

```ts
// 1. Functions that never return
function fail(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {}
}

// 2. Exhaustiveness checking (most important use case)
type Shape = "circle" | "square" | "triangle";

function area(shape: Shape): number {
  switch (shape) {
    case "circle": return Math.PI * 10 * 10;
    case "square": return 10 * 10;
    case "triangle": return 0.5 * 10 * 10;
    default:
      // If you add a new shape and forget to handle it,
      // TypeScript errors here because shape is never assignable to never
      const exhaustive: never = shape;
      throw new Error(`Unhandled shape: ${exhaustive}`);
  }
}

// 3. Intersection of incompatible types
type Impossible = string & number; // type is never

// 4. Narrowing to impossible state
function processValue(val: string | number) {
  if (typeof val === "string") {
    // val is string here
  } else if (typeof val === "number") {
    // val is number here
  } else {
    // val is never here — this branch is impossible
    const check: never = val;
  }
}
```

---

## Q12. 🟡 What is the difference between `void` and `undefined`?

**Answer:**

```ts
// void — for functions that don't return a meaningful value
function log(msg: string): void {
  console.log(msg);
  // implicitly returns undefined
}

// undefined — an actual value
let x: undefined = undefined;

// Key difference: void is more permissive in callbacks
type Callback = () => void;

const fn: Callback = () => 42; // Allowed! void means "return value is ignored"
// This allows array methods like forEach to accept callbacks that return values

[1, 2, 3].forEach((n) => n * 2); // callback returns number but forEach expects () => void

// But a function with return type void can't use its return value
const result = log("hello"); // result is void, not undefined
// result.toString(); // Error — void has no properties

// undefined must be explicitly returned or not returned
function getUndefined(): undefined {
  return undefined;
  // or just: return;
}
```

---

## Interfaces vs Type Aliases

---

## Q13. 🟡 What is the difference between `interface` and `type`?

**Answer:**

Both define shapes for objects, but they have key differences:

| Feature | `interface` | `type` |
|---|---|---|
| Extension | `extends` keyword | Intersection `&` |
| Declaration merging | Yes — can be extended later | No — closed after declaration |
| Primitives, unions, tuples | No | Yes |
| Computed properties | Limited | Yes (mapped types) |
| Performance | Slightly faster | Similar in most cases |
| Error messages | Often cleaner | Can be complex for complex types |

```ts
// interface — can be extended after declaration
interface User {
  id: number;
  name: string;
}

// Declaration merging (unique to interface)
interface User {
  email: string; // added to existing User interface
}
const user: User = { id: 1, name: "Alice", email: "a@b.com" }; // all three required

// interface extension
interface Admin extends User {
  role: "superadmin" | "admin";
}

// type — more flexible
type ID = string | number;           // union — can't do with interface
type Point = [number, number];       // tuple — can't do with interface
type Nullable<T> = T | null;         // generics + primitives

// type extension via intersection
type AdminType = User & { role: "admin" };

// When to use what:
// - interface: when you're defining object shapes that may be extended (OOP, library APIs)
// - type: for unions, tuples, computed types, utility types
```

**Common advice:** Default to `interface` for objects (especially public API surfaces), use `type` for everything else.

---

## Q14. 🟡 What is declaration merging and when is it useful?

**Answer:**

Declaration merging allows TypeScript to combine multiple declarations with the same name into a single definition.

```ts
// Merging interfaces — common in library augmentation
interface Window {
  myPlugin: () => void;
}
// Now window.myPlugin is typed without modifying original Window types

// Augmenting Express Request
declare namespace Express {
  interface Request {
    user?: { id: string; role: string };
  }
}
// Now req.user is typed in all Express route handlers

// Merging namespaces
namespace Validation {
  export interface StringRule { minLength: number; }
}
namespace Validation {
  export interface NumberRule { min: number; max: number; }
}
// Both rules are now in Validation namespace

// Merging a namespace with a function (common pattern for function+namespace)
function createUser(name: string): User { /* ... */ return { name, id: 0 }; }
namespace createUser {
  export function fromEmail(email: string): User { /* ... */ return { name: email, id: 0 }; }
}
createUser("Alice");
createUser.fromEmail("a@b.com");
```

**Real-world use:** Module augmentation — adding types to third-party libraries without modifying their source.

---

## Q15. 🟡 How does `extends` work with interfaces and what is the difference from type intersection?

**Answer:**

```ts
interface Animal {
  name: string;
  breathe(): void;
}

interface Dog extends Animal {
  breed: string;
  bark(): void;
}

// Multiple extends
interface GuideDog extends Dog, Trainable {
  owner: string;
}

// type intersection — similar result but different behavior on conflicts
type AnimalType = { name: string; breathe(): void };
type DogType = AnimalType & { breed: string };

// Key difference: conflicting properties
interface A { x: number }
interface B extends A { x: string } // Error: incompatible types

type C = { x: number };
type D = C & { x: string };       // No error at declaration, but D.x becomes never
```

---

## Q16. 🟢 What is an index signature?

**Answer:**

Index signatures allow types to describe objects with dynamic keys.

```ts
// String index signature
interface StringMap {
  [key: string]: string;
}
const headers: StringMap = {
  "Content-Type": "application/json",
  "Authorization": "Bearer token"
};

// Number index signature
interface NumberArray {
  [index: number]: string;
}

// Index signature with known properties
interface Config {
  host: string;         // known property
  port: number;         // known property
  [key: string]: string | number; // dynamic properties must be compatible with known ones
}

// Record<K, V> — cleaner alternative to index signatures
type Scores = Record<string, number>;
const scores: Scores = { alice: 95, bob: 87 };

// Readonly index signature
interface ReadonlyMap {
  readonly [key: string]: string;
}
```

---

## Generics

---

## Q17. 🟡 What are generics and why are they needed?

**Answer:**

Generics allow you to write **reusable, type-safe code** that works with multiple types without sacrificing type information.

```ts
// Without generics — forced to use any (loses type safety)
function identity(arg: any): any {
  return arg;
}
const result = identity(42); // result is any — we lost the number type

// With generics — type-safe and flexible
function identity<T>(arg: T): T {
  return arg;
}
const num = identity(42);       // inferred: identity<number>, result is number
const str = identity("hello");  // inferred: identity<string>, result is string

// Explicit type argument
const bool = identity<boolean>(true);

// Generic array
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
const firstNum = first([1, 2, 3]);  // number | undefined
const firstStr = first(["a", "b"]); // string | undefined

// Generic with multiple type parameters
function pair<K, V>(key: K, value: V): [K, V] {
  return [key, value];
}
const entry = pair("name", 42); // [string, number]
```

**Why interviewer asks this:** Generics are fundamental to TypeScript — understanding them separates intermediate from advanced developers.

---

## Q18. 🟡 What are generic constraints?

**Answer:**

Constraints limit what types can be passed as type arguments using `extends`.

```ts
// Without constraint — can't access .length
function logLength<T>(arg: T): T {
  // console.log(arg.length); // Error: T doesn't have .length
  return arg;
}

// With constraint
interface HasLength {
  length: number;
}
function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length); // OK — T is guaranteed to have .length
  return arg;
}
logLength("hello");    // string has .length
logLength([1, 2, 3]);  // array has .length
// logLength(42);      // Error: number doesn't satisfy HasLength

// keyof constraint — safe property access
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const user = { name: "Alice", age: 30 };
const name = getProperty(user, "name"); // string
const age = getProperty(user, "age");   // number
// getProperty(user, "email");          // Error: not a key of user

// Conditional default with constraint
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

---

## Q19. 🟡 What are generic interfaces and generic classes?

**Answer:**

```ts
// Generic interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

interface User { id: string; name: string; }

class UserRepository implements Repository<User> {
  private db: User[] = [];
  async findById(id: string) { return this.db.find(u => u.id === id) ?? null; }
  async findAll() { return [...this.db]; }
  async save(user: User) { this.db.push(user); return user; }
  async delete(id: string) { this.db = this.db.filter(u => u.id !== id); }
}

// Generic class
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
const top = numStack.pop(); // number | undefined
```

---

## Q20. 🟡 What are default generic type parameters?

**Answer:**

```ts
// Generic with default type
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message: string;
}

// Without specifying T — defaults to unknown
const rawResponse: ApiResponse = { data: { foo: 1 }, status: 200, message: "OK" };

// With T specified
const userResponse: ApiResponse<{ id: number; name: string }> = {
  data: { id: 1, name: "Alice" },
  status: 200,
  message: "OK"
};

// Multiple defaults
interface Table<Row = object, Key extends keyof Row = keyof Row> {
  rows: Row[];
  primaryKey: Key;
}
```

---

## Q21. 🟡 What are generic utility functions and how do you write them?

**Answer:**

```ts
// groupBy
function groupBy<T, K extends string | number | symbol>(
  arr: T[],
  key: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const group = key(item);
    acc[group] = acc[group] ?? [];
    acc[group].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

const users = [
  { name: "Alice", role: "admin" },
  { name: "Bob", role: "user" },
  { name: "Charlie", role: "admin" }
];
const byRole = groupBy(users, u => u.role);
// { admin: [...], user: [...] }

// pipe — compose functions left to right
function pipe<A>(a: A): A;
function pipe<A, B>(a: A, ab: (a: A) => B): B;
function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
function pipe(val: unknown, ...fns: Function[]) {
  return fns.reduce((acc, fn) => fn(acc), val);
}

// memoize
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}
```

---

## Q22. 🔴 What is `infer` in TypeScript?

**Answer:**

`infer` declares a type variable within a conditional type to extract/capture part of a type.

```ts
// Extract return type (how ReturnType<T> is built)
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function add(a: number, b: number): number { return a + b; }
type AddReturn = MyReturnType<typeof add>; // number

// Extract parameter types (how Parameters<T> is built)
type MyParameters<T> = T extends (...args: infer P) => any ? P : never;
type AddParams = MyParameters<typeof add>; // [number, number]

// Extract array element type
type ElementType<T> = T extends (infer E)[] ? E : never;
type Num = ElementType<number[]>; // number

// Extract Promise value
type UnwrapPromise<T> = T extends Promise<infer V> ? V : T;
type StringValue = UnwrapPromise<Promise<string>>; // string
type JustNum = UnwrapPromise<number>;              // number (not a Promise)

// Recursive infer — flatten nested arrays
type FlattenArray<T> = T extends (infer U)[]
  ? U extends any[]
    ? FlattenArray<U>
    : U
  : T;
type Flat = FlattenArray<number[][][]>; // number
```

---

## Union, Intersection & Narrowing

---

## Q23. 🟡 What are union types and how do you narrow them?

**Answer:**

A union type `A | B` means the value is either type A or type B. Narrowing uses runtime checks to tell TypeScript which branch you're in.

```ts
type StringOrNumber = string | number;

function formatValue(val: StringOrNumber): string {
  // typeof narrowing
  if (typeof val === "string") {
    return val.toUpperCase(); // val is string here
  }
  return val.toFixed(2); // val is number here
}

// Nullish narrowing
function greet(name: string | null | undefined) {
  if (name == null) {
    return "Hello, Guest!"; // handles both null and undefined
  }
  return `Hello, ${name}!`;
}

// instanceof narrowing
function logError(err: Error | string) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
}

// in operator narrowing
interface Cat { meow(): void }
interface Dog { bark(): void }

function makeSound(animal: Cat | Dog) {
  if ("meow" in animal) {
    animal.meow(); // Cat
  } else {
    animal.bark(); // Dog
  }
}
```

---

## Q24. 🟡 What are discriminated unions?

**Answer:**

Discriminated unions are union types where each member has a common **discriminant property** (literal type) that TypeScript uses for narrowing.

```ts
// Each variant has a unique 'type' literal
type Success<T> = { type: "success"; data: T };
type Failure = { type: "failure"; error: string };
type Loading = { type: "loading" };

type Result<T> = Success<T> | Failure | Loading;

function handleResult<T>(result: Result<T>): string {
  switch (result.type) {
    case "success":
      return `Got data: ${JSON.stringify(result.data)}`; // data is T
    case "failure":
      return `Error: ${result.error}`; // error is string
    case "loading":
      return "Loading...";
    // TypeScript will error if you miss a case (with exhaustiveness check)
  }
}

// Real-world Redux action pattern
type Action =
  | { type: "INCREMENT"; payload: number }
  | { type: "DECREMENT"; payload: number }
  | { type: "RESET" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "INCREMENT": return state + action.payload;
    case "DECREMENT": return state - action.payload;
    case "RESET": return 0;
  }
}
```

---

## Q25. 🟡 What are intersection types?

**Answer:**

An intersection type `A & B` means the value has **all properties of both A and B**.

```ts
interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

interface Identifiable {
  id: string;
}

// Combine multiple interfaces
type Entity = Identifiable & Timestamped;

const user: Entity & { name: string } = {
  id: "1",
  name: "Alice",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Common pattern: mixin typing
type WithLogging<T> = T & {
  log(message: string): void;
  warn(message: string): void;
};

// Common pattern: extend function signatures
type ApiHandler = (req: Request, res: Response) => void;
type AuthenticatedHandler = ApiHandler & { requiresAuth: true };
```

---

## Q26. 🟡 What are type guards?

**Answer:**

Type guards are runtime checks that narrow a type within a conditional block.

```ts
// 1. typeof guard
function isString(val: unknown): val is string {
  return typeof val === "string";
}

// 2. instanceof guard
function isError(val: unknown): val is Error {
  return val instanceof Error;
}

// 3. in guard
function hasProperty<T extends object, K extends PropertyKey>(
  obj: T, key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

// 4. Custom type predicate (user-defined type guard)
interface Fish { swim(): void }
interface Bird { fly(): void }

function isFish(animal: Fish | Bird): animal is Fish {
  return "swim" in animal;
}

function move(animal: Fish | Bird) {
  if (isFish(animal)) {
    animal.swim(); // TypeScript knows it's Fish
  } else {
    animal.fly();  // TypeScript knows it's Bird
  }
}

// 5. Assertion functions (TS 3.7+)
function assertIsString(val: unknown): asserts val is string {
  if (typeof val !== "string") {
    throw new Error(`Expected string, got ${typeof val}`);
  }
}
// After calling assertIsString(x), x is narrowed to string
```

---

## Q27. 🟡 What is the `satisfies` operator (TypeScript 4.9+)?

**Answer:**

`satisfies` validates that an expression matches a type without widening the inferred type.

```ts
type Colors = "red" | "green" | "blue";
type ColorMap = Record<Colors, string | [number, number, number]>;

// Before satisfies: explicit type annotation widens the type
const palette: ColorMap = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255]
};
palette.red.toUpperCase(); // Error! red is string | [number, number, number]

// With satisfies: validates type but keeps inferred literal types
const palette2 = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255]
} satisfies ColorMap;

palette2.red.map(c => c * 2);      // OK — TypeScript knows red is number[]
palette2.green.toUpperCase();      // OK — TypeScript knows green is string

// Great for config validation
const config = {
  port: 3000,
  host: "localhost",
  ssl: false
} satisfies Partial<ServerConfig>;
```

---

## Q28. 🔴 What is the non-null assertion operator `!` and when should you use it?

**Answer:**

The `!` postfix operator tells TypeScript "trust me, this value is not null or undefined" — it removes null and undefined from the type.

```ts
// With strictNullChecks
function getElement(id: string): HTMLElement {
  const el = document.getElementById(id); // HTMLElement | null
  // return el; // Error — could be null

  return el!; // OK — you assert it's not null
}

// Better: handle null explicitly
function getElementSafe(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

// Common use case: TypeScript can't see your runtime guarantee
class EventEmitter {
  private listeners: Map<string, Function[]> | null = null;

  init() {
    this.listeners = new Map();
  }

  emit(event: string) {
    this.listeners!.get(event); // You know init() was called first
  }
}
```

**Warning:** `!` is an escape hatch, not a fix. Overusing it means you're ignoring null safety. Use it only when you have a runtime guarantee that TypeScript can't see.

---

## Classes & OOP

---

## Q29. 🟡 How do access modifiers work in TypeScript?

**Answer:**

| Modifier | Class | Subclass | Outside |
|---|---|---|---|
| `public` (default) | Yes | Yes | Yes |
| `protected` | Yes | Yes | No |
| `private` | Yes | No | No |
| `#` (JS private) | Yes | No | No (hard private) |
| `readonly` | Read | Read | Read |

```ts
class BankAccount {
  public owner: string;         // accessible everywhere
  protected balance: number;    // accessible in BankAccount and subclasses
  private pin: string;          // accessible only in BankAccount
  readonly accountId: string;   // can't be changed after initialization

  constructor(owner: string, initialBalance: number) {
    this.owner = owner;
    this.balance = initialBalance;
    this.pin = "1234";
    this.accountId = crypto.randomUUID();
  }

  public getBalance(): number {
    return this.balance;
  }
}

class SavingsAccount extends BankAccount {
  addInterest(rate: number) {
    this.balance *= (1 + rate); // OK — protected is accessible in subclass
    // this.pin;               // Error — private not accessible
  }
}

const account = new BankAccount("Alice", 1000);
account.owner;          // OK — public
account.getBalance();   // OK — public method
// account.balance;     // Error — protected
// account.pin;         // Error — private
// account.accountId = "x"; // Error — readonly
```

---

## Q30. 🟡 What is parameter property shorthand?

**Answer:**

TypeScript lets you declare and initialize class properties directly in the constructor signature.

```ts
// Standard approach — verbose
class User {
  public name: string;
  private email: string;
  readonly id: number;

  constructor(name: string, email: string, id: number) {
    this.name = name;
    this.email = email;
    this.id = id;
  }
}

// Parameter property shorthand — same result, much cleaner
class User {
  constructor(
    public name: string,
    private email: string,
    readonly id: number
  ) {}
}

// Both compile to the same JS. Widely used in Angular, NestJS.
```

---

## Q31. 🟡 What are abstract classes in TypeScript?

**Answer:**

Abstract classes define a contract for subclasses. They can't be instantiated directly and may contain abstract methods that subclasses must implement.

```ts
abstract class Shape {
  // Concrete method — shared implementation
  toString(): string {
    return `${this.constructor.name} with area ${this.area().toFixed(2)}`;
  }

  // Abstract method — subclasses MUST implement
  abstract area(): number;
  abstract perimeter(): number;
}

class Circle extends Shape {
  constructor(private radius: number) { super(); }
  area() { return Math.PI * this.radius ** 2; }
  perimeter() { return 2 * Math.PI * this.radius; }
}

class Rectangle extends Shape {
  constructor(private width: number, private height: number) { super(); }
  area() { return this.width * this.height; }
  perimeter() { return 2 * (this.width + this.height); }
}

// const s = new Shape(); // Error — can't instantiate abstract class

const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6)];
shapes.forEach(s => console.log(s.toString()));
```

**Interface vs Abstract Class:**
- Use `interface` for pure behavioral contracts (no implementation)
- Use `abstract class` when you have shared implementation + enforced contract

---

## Q32. 🟡 How do you implement interfaces in TypeScript classes?

**Answer:**

```ts
interface Serializable {
  serialize(): string;
  deserialize(data: string): void;
}

interface Validatable {
  validate(): boolean;
  errors: string[];
}

// A class can implement multiple interfaces
class UserModel implements Serializable, Validatable {
  errors: string[] = [];

  constructor(public name: string, public email: string) {}

  serialize(): string {
    return JSON.stringify({ name: this.name, email: this.email });
  }

  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    this.name = parsed.name;
    this.email = parsed.email;
  }

  validate(): boolean {
    this.errors = [];
    if (!this.name) this.errors.push("Name is required");
    if (!this.email.includes("@")) this.errors.push("Invalid email");
    return this.errors.length === 0;
  }
}
```

---

## Q33. 🔴 What are decorators in TypeScript?

**Answer:**

Decorators are a stage-3 JavaScript proposal (and TypeScript feature) that allows you to annotate/modify classes, methods, properties, and parameters with metadata or behavior. Enable with `"experimentalDecorators": true`.

```ts
// Class decorator — wraps or enhances the class
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@sealed
class MyClass {}

// Method decorator — wraps a method
function log(target: any, name: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function(...args: any[]) {
    console.log(`Calling ${name} with`, args);
    const result = original.apply(this, args);
    console.log(`${name} returned`, result);
    return result;
  };
  return descriptor;
}

class Calculator {
  @log
  add(a: number, b: number): number {
    return a + b;
  }
}

// Property decorator
function readonly(target: any, key: string) {
  Object.defineProperty(target, key, { writable: false });
}

// Parameter decorator
function required(target: any, methodName: string, paramIndex: number) {
  // Store metadata about required params
}

// Real-world: NestJS controllers use decorators extensively
// @Controller('users')
// @Get(':id')
// @Body(), @Param(), @Injectable()
```

---

## Q34. 🟡 What is method overloading in TypeScript?

**Answer:**

TypeScript supports function/method overloading through multiple signatures followed by a single implementation.

```ts
// Function overloading
function format(val: string): string;
function format(val: number, decimals?: number): string;
function format(val: string | number, decimals = 2): string {
  if (typeof val === "string") return val.trim();
  return val.toFixed(decimals);
}

format("  hello  ");    // "hello"
format(3.14159);        // "3.14"
format(3.14159, 4);     // "3.1416"

// Method overloading in a class
class EventEmitter {
  on(event: "connect", listener: (port: number) => void): this;
  on(event: "data", listener: (chunk: Buffer) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    // implementation
    return this;
  }
}
```

---

## Utility Types & Mapped Types

---

## Q35. 🟡 What are the most important built-in utility types?

**Answer:**

```ts
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

// Partial<T> — all properties optional
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; age?: number }

// Required<T> — all properties required (removes optional)
type RequiredUser = Required<User>;
// { id: number; name: string; email: string; age: number }

// Readonly<T> — all properties readonly
type ReadonlyUser = Readonly<User>;
// Can't mutate properties

// Pick<T, K> — select a subset of properties
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string }

// Omit<T, K> — exclude properties
type UserWithoutId = Omit<User, "id">;
// { name: string; email: string; age?: number }

// Record<K, V> — create object type with key type K and value type V
type RoleMap = Record<"admin" | "user" | "guest", User[]>;

// Exclude<T, U> — remove types from union
type T1 = Exclude<string | number | boolean, boolean>; // string | number

// Extract<T, U> — keep only types assignable to U
type T2 = Extract<string | number | boolean, number | boolean>; // number | boolean

// NonNullable<T> — remove null and undefined
type T3 = NonNullable<string | null | undefined>; // string

// ReturnType<T> — get return type of function
type RT = ReturnType<typeof fetch>; // Promise<Response>

// Parameters<T> — get parameter tuple type
type Params = Parameters<typeof fetch>; // [input: RequestInfo | URL, init?: RequestInit]

// Awaited<T> — unwrap Promise type (TS 4.5+)
type Resolved = Awaited<Promise<string>>; // string
```

---

## Q36. 🟡 What are mapped types?

**Answer:**

Mapped types transform every property of an existing type using a template.

```ts
// The shape of a mapped type: { [K in keyof T]: NewType }
type Stringify<T> = { [K in keyof T]: string };

interface User { id: number; name: string; active: boolean }
type StringUser = Stringify<User>; // { id: string; name: string; active: string }

// Adding modifiers
type ReadonlyUser = { readonly [K in keyof User]: User[K] };  // same as Readonly<User>
type PartialUser = { [K in keyof User]?: User[K] };           // same as Partial<User>

// Removing modifiers
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] }; // same as Required<T>

// Remapping keys (TS 4.1+)
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
};
type UserGetters = Getters<User>;
// { getId: () => number; getName: () => string; getActive: () => boolean }

// Filtering properties by value type
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K]
};
type NumberProps = PickByValue<User, number>; // { id: number }
```

---

## Q37. 🟡 What are conditional types?

**Answer:**

Conditional types select a type based on whether another type extends a condition: `T extends U ? X : Y`.

```ts
// Basic conditional type
type IsString<T> = T extends string ? "yes" : "no";
type A = IsString<string>;  // "yes"
type B = IsString<number>;  // "no"

// Distributive conditional types — applied to each union member
type Flatten<T> = T extends Array<infer I> ? I : T;
type C = Flatten<string[]>;         // string
type D = Flatten<number | string[]>; // number | string (distributes over union)

// Filter union members
type NonNullable<T> = T extends null | undefined ? never : T;
type E = NonNullable<string | null | undefined>; // string

// How Exclude is implemented
type Exclude<T, U> = T extends U ? never : T;
type F = Exclude<"a" | "b" | "c", "a">; // "b" | "c"

// Practical: deep partial
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

interface Config {
  server: { host: string; port: number };
  database: { url: string; name: string };
}
type PartialConfig = DeepPartial<Config>;
// All nested properties become optional
```

---

## Q38. 🔴 What are template literal types?

**Answer:**

Template literal types use the same syntax as JavaScript template literals to create string types.

```ts
// Basic template literal type
type EventName = "click" | "focus" | "blur";
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

// Route type generation
type Route = "/home" | "/about" | "/users";
type ApiRoute = `/api${Route}`;
// "/api/home" | "/api/about" | "/api/users"

// CSS property helpers
type CSSProperty = "margin" | "padding";
type CSSDirection = "top" | "right" | "bottom" | "left";
type CSSSpacing = `${CSSProperty}-${CSSDirection}`;
// "margin-top" | "margin-right" | ... | "padding-left"

// EventEmitter typing
type EventMap = {
  "user:login": { userId: string };
  "user:logout": { userId: string };
  "order:created": { orderId: string; total: number };
};

type EventKey = keyof EventMap;
type PayloadFor<K extends EventKey> = EventMap[K];

// Getter/Setter patterns
type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};
```

---

## Q39. 🟡 What is `keyof` and `typeof`?

**Answer:**

```ts
interface User { id: number; name: string; email: string }

// keyof — extract keys as a union literal type
type UserKeys = keyof User; // "id" | "name" | "email"

// typeof — capture the type of a value
const config = { host: "localhost", port: 3000 };
type Config = typeof config; // { host: string; port: number }

// Combining: keyof typeof
const STATUS = { PENDING: "pending", ACTIVE: "active", CLOSED: "closed" } as const;
type Status = typeof STATUS[keyof typeof STATUS]; // "pending" | "active" | "closed"

// Practical: safe key access
function pluck<T, K extends keyof T>(arr: T[], key: K): T[K][] {
  return arr.map(item => item[key]);
}
const users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
const names = pluck(users, "name"); // string[]
const ids = pluck(users, "id");     // number[]
// pluck(users, "age");             // Error — not a key of User
```

---

## Q40. 🟡 How do you make a deep readonly type?

**Answer:**

```ts
// Built-in Readonly only goes one level deep
type Readonly<T> = { readonly [K in keyof T]: T[K] };

// Deep Readonly — recursive mapped type
type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T // leave functions alone
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T; // primitive — return as is

interface State {
  user: {
    name: string;
    address: {
      city: string;
      zip: string;
    };
  };
  settings: {
    theme: "light" | "dark";
  };
}

type FrozenState = DeepReadonly<State>;
// All nested properties become readonly — mutation is prevented at compile time

const state: FrozenState = {
  user: { name: "Alice", address: { city: "NYC", zip: "10001" } },
  settings: { theme: "dark" }
};
// state.user.address.city = "LA"; // Error — deeply readonly
```

---

## Advanced Types

---

## Q41. 🔴 What is variance in TypeScript's type system?

**Answer:**

Variance describes how subtype relationships of compound types (like functions, arrays) relate to the subtypes of their components.

```ts
// Covariance — subtype in, subtype out (safe for producers/outputs)
// Arrays are covariant in their element type (for reads)
let dogs: Dog[] = [new Dog()];
let animals: Animal[] = dogs; // OK — Dog[] is assignable to Animal[]
// But mutable arrays break this at runtime...

// Contravariance — supertype in (safe for consumers/inputs)
// Function parameters are contravariant
type AnimalHandler = (a: Animal) => void;
type DogHandler = (d: Dog) => void;

let handleAnimal: AnimalHandler = (a) => a.breathe();
// let handleDog: DogHandler = handleAnimal; // TypeScript allows with strictFunctionTypes

// Bivariance — assignable in both directions (TS method shorthand is bivariant — a known compromise)
interface Container<T> {
  value: T;                  // covariant position
  setValue(val: T): void;    // bivariant (method shorthand) — use function property for contravariance
}

// Example: return types are covariant, parameter types are contravariant
type F1 = (x: string) => number;
type F2 = (x: string | number) => number; // widens param — OK (contravariant)
type F3 = (x: string) => number | string; // narrows return — OK (covariant)
```

---

## Q42. 🔴 How do you create a builder pattern in TypeScript?

**Answer:**

```ts
class QueryBuilder<T extends object> {
  private filters: Partial<T> = {};
  private selectedFields: (keyof T)[] = [];
  private limitVal?: number;
  private offsetVal?: number;

  where<K extends keyof T>(key: K, value: T[K]): this {
    this.filters[key] = value;
    return this;
  }

  select(...fields: (keyof T)[]): this {
    this.selectedFields = fields;
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  offset(n: number): this {
    this.offsetVal = n;
    return this;
  }

  build(): { filters: Partial<T>; fields: (keyof T)[]; limit?: number; offset?: number } {
    return {
      filters: this.filters,
      fields: this.selectedFields,
      limit: this.limitVal,
      offset: this.offsetVal
    };
  }
}

interface User { id: number; name: string; email: string; role: string }

const query = new QueryBuilder<User>()
  .where("role", "admin")
  .select("id", "name", "email")
  .limit(10)
  .offset(0)
  .build();
```

---

## Q43. 🔴 What are recursive types and when do you need them?

**Answer:**

Recursive types reference themselves in their definition — essential for tree structures, nested objects, and JSON.

```ts
// JSON value type
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

const data: JSONValue = {
  name: "Alice",
  scores: [1, 2, 3],
  address: { city: "NYC", zip: "10001" }
};

// Tree node
type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};

function mapTree<A, B>(node: TreeNode<A>, fn: (val: A) => B): TreeNode<B> {
  return {
    value: fn(node.value),
    children: node.children.map(child => mapTree(child, fn))
  };
}

// Deeply nested object path access
type DeepKeys<T> = T extends object
  ? { [K in keyof T]: K extends string
      ? T[K] extends object
        ? `${K}` | `${K}.${DeepKeys<T[K]>}`
        : `${K}`
      : never
    }[keyof T]
  : never;

type ConfigKeys = DeepKeys<{ server: { host: string; port: number } }>;
// "server" | "server.host" | "server.port"
```

---

## Q44. 🔴 What is `ReturnType`, `Parameters`, `ConstructorParameters`, and `InstanceType`?

**Answer:**

```ts
// Sample types to extract from
function createUser(name: string, age: number): { id: string; name: string; age: number } {
  return { id: "1", name, age };
}

class UserService {
  constructor(private db: Database, private logger: Logger) {}
  getUser(id: string): Promise<User> { /* ... */ return Promise.resolve({} as User); }
}

// ReturnType<T> — return type of a function
type User = ReturnType<typeof createUser>;
// { id: string; name: string; age: number }

// Parameters<T> — parameter types as a tuple
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, age: number]

// ConstructorParameters<T> — constructor param types
type ServiceDeps = ConstructorParameters<typeof UserService>;
// [db: Database, logger: Logger]

// InstanceType<T> — what new T() returns
type ServiceInstance = InstanceType<typeof UserService>;
// UserService

// Practical: factory function typing
function instantiate<T extends new (...args: any[]) => any>(
  Cls: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  return new Cls(...args);
}
```

---

## Q45. 🔴 What is `Extract` and `Exclude` and how do you use them?

**Answer:**

```ts
type A = "cat" | "dog" | "fish" | "bird";

// Exclude<T, U> — remove types from union
type Mammals = Exclude<A, "fish" | "bird">; // "cat" | "dog"

// Extract<T, U> — keep only assignable types
type Aquatic = Extract<A, "fish" | "whale">; // "fish" (whale not in A)

// Practical: remove function keys from an interface
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T];

interface Service {
  name: string;
  start(): void;
  stop(): void;
  port: number;
}
type ServiceData = Pick<Service, NonFunctionKeys<Service>>;
// { name: string; port: number }

// Overloaded function fallback — get the last overload
type LastOverload<T extends (...args: any[]) => any> = Extract<
  T extends { (...args: infer A): infer R } ? (...args: A) => R : never,
  (...args: any[]) => any
>;
```

---

## Q46. 🔴 How do you type a function that accepts any number of arguments and preserves types?

**Answer:**

```ts
// Rest parameters with generics
function zip<T extends any[][]>(
  ...arrays: T
): { [K in keyof T]: T[K] extends (infer V)[] ? V : never }[] {
  const length = Math.min(...arrays.map(a => a.length));
  return Array.from({ length }, (_, i) =>
    arrays.map(a => a[i])
  ) as any;
}

const result = zip([1, 2, 3], ["a", "b", "c"]); // [number, string][]

// Spread tuple type
type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never;
type Tail<T extends any[]> = T extends [any, ...infer T] ? T : never;
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never;

type H = Head<[string, number, boolean]>; // string
type T = Tail<[string, number, boolean]>; // [number, boolean]
type L = Last<[string, number, boolean]>; // boolean

// Function composition with correct types
function compose<A, B, C>(f: (b: B) => C, g: (a: A) => B): (a: A) => C {
  return (a) => f(g(a));
}

const addOne = (n: number) => n + 1;
const toString = (n: number) => n.toString();
const addOneAndStringify = compose(toString, addOne);
const result2: string = addOneAndStringify(5); // "6"
```

---

## Q47. 🔴 What is `as const` vs `satisfies` vs explicit type annotation?

**Answer:**

```ts
type Config = {
  port: number;
  host: string;
  env: "development" | "production";
};

const myConfig1 = { port: 3000, host: "localhost", env: "development" };
// port: number, host: string, env: string — too wide

const myConfig2: Config = { port: 3000, host: "localhost", env: "development" };
// Validated + typed as Config, but loses literal inference
// myConfig2.port is number, myConfig2.env is "development" | "production"

const myConfig3 = { port: 3000, host: "localhost", env: "development" } as const;
// port: 3000, host: "localhost", env: "development" — fully literal, fully readonly
// NOT validated against Config

const myConfig4 = {
  port: 3000,
  host: "localhost",
  env: "development"
} satisfies Config;
// Validated against Config AND keeps literal types
// port: 3000, env: "development" — best of both worlds

// Summary:
// annotation (: T) — validates + types as T (loses literals for unions)
// as const — literals + readonly (no validation)
// satisfies T — validates + keeps literals (TS 4.9+)
```

---

## Modules, Declaration Files & tsconfig

---

## Q48. 🟡 What are declaration files (`.d.ts`) and when do you need them?

**Answer:**

Declaration files describe the types of JavaScript code that TypeScript can't see — third-party JS libraries, native browser APIs, or hand-crafted modules.

```ts
// example.d.ts — types for a plain JS library
declare module "legacy-lib" {
  export function processData(input: string): number;
  export class Processor {
    constructor(options: ProcessorOptions);
    run(): Promise<void>;
  }
  export interface ProcessorOptions {
    timeout: number;
    retries?: number;
  }
}

// global.d.ts — adding to Window
declare global {
  interface Window {
    analytics: {
      track(event: string, properties?: object): void;
    };
  }
  const __DEV__: boolean;
}

// Augmenting a module (e.g., Express)
declare module "express" {
  interface Request {
    user?: AuthUser;
    requestId: string;
  }
}
```

**When you need `.d.ts` files:**
- The library has no types and `@types/library-name` doesn't exist
- Augmenting existing types (module augmentation)
- Writing a library to be consumed by TypeScript projects

---

## Q49. 🟡 What is the difference between `import type` and `import`?

**Answer:**

`import type` imports only the type information — it's erased at compile time and has no runtime presence.

```ts
// Regular import — imports value AND type
import { User } from "./types";           // might import runtime code

// Type-only import — erased at compile time
import type { User } from "./types";      // guaranteed no runtime cost
import type { User as UserType } from "./types"; // with alias

// Inline type imports (TS 4.5+)
import { type User, createUser } from "./user"; // mixed import

// Why it matters:
// 1. Circular dependency prevention — type-only imports break circular dep chains
// 2. Bundle optimization — tree-shakers can eliminate type-only imports
// 3. Explicit intent — makes it clear this is type-only

// isolatedModules: true requires type-only imports for re-exported types
// This is enforced in many build tools (esbuild, Babel, SWC, Vite)
```

---

## Q50. 🟡 What are module resolution strategies in TypeScript?

**Answer:**

```json
// tsconfig.json module resolution options
{
  "compilerOptions": {
    "module": "NodeNext",          // or: CommonJS, ESNext, Bundler
    "moduleResolution": "NodeNext" // or: Node, Bundler, Classic
  }
}
```

| Strategy | Used with | Behavior |
|---|---|---|
| `Classic` | Legacy | No `node_modules`, no extensions |
| `Node` (Node10) | CJS projects | Mimics Node.js v12 resolution |
| `Node16`/`NodeNext` | ESM/CJS hybrid | Full Node.js ESM + CJS resolution |
| `Bundler` | Vite, webpack | Resolves like a bundler (no extensions needed) |

```ts
// With "moduleResolution": "NodeNext"
// Requires explicit .js extensions in imports (even for .ts source files)
import { foo } from "./utils.js"; // TS looks for utils.ts, utils.tsx

// With "moduleResolution": "Bundler"
import { foo } from "./utils";    // bundler handles extensions
```

---

## Q51. 🟡 What are the most important `tsconfig.json` compiler options?

**Answer:**

```json
{
  "compilerOptions": {
    // Code output
    "target": "ES2022",           // JS version to compile to
    "lib": ["ES2022", "DOM"],     // available APIs
    "outDir": "./dist",           // compiled output directory
    "rootDir": "./src",           // source root

    // Modules
    "module": "NodeNext",         // module system
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,      // allow default imports from CJS modules
    "resolveJsonModule": true,    // import JSON files

    // Strict checks
    "strict": true,               // enables all strict flags
    "noUncheckedIndexedAccess": true, // arr[0] is T | undefined
    "exactOptionalPropertyTypes": true, // { x?: string } vs { x?: string | undefined }

    // Source maps & declarations
    "sourceMap": true,
    "declaration": true,          // emit .d.ts files
    "declarationMap": true,       // map .d.ts to source

    // Quality
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,    // all code paths must return
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true          // skip type-checking .d.ts files
  }
}
```

---

## Q52. 🟡 What is `paths` in tsconfig and how does it help?

**Answer:**

`paths` configures module aliases so you can use cleaner imports instead of deep relative paths.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

```ts
// Without paths — verbose relative imports
import { Button } from "../../../components/ui/Button";
import { formatDate } from "../../utils/date";

// With paths — clean absolute imports
import { Button } from "@components/ui/Button";
import { formatDate } from "@utils/date";
```

**Note:** `paths` only affects TypeScript compilation. For bundlers (webpack, Vite), you must also configure aliases there (e.g., `resolve.alias` in Vite, `alias` in webpack).

---

## TypeScript in Practice

---

## Q53. 🟡 How do you type React components with TypeScript?

**Answer:**

```tsx
import React, { useState, useRef, useCallback } from "react";

// Props interface
interface ButtonProps {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children?: React.ReactNode;
}

// Functional component with typed props
const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false, variant = "primary" }) => (
  <button className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
    {label}
  </button>
);

// Or without React.FC (preferred — avoids implicit children)
function Button2({ label, onClick, variant = "primary" }: ButtonProps) {
  return <button className={`btn-${variant}`} onClick={onClick}>{label}</button>;
}

// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={keyExtractor(item)}>{renderItem(item, i)}</li>
      ))}
    </ul>
  );
}

// Hooks with types
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  const setStored = useCallback((newValue: T) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  }, [key]);

  return [value, setStored] as const; // const tuple type
}

// Ref typing
const inputRef = useRef<HTMLInputElement>(null);
// inputRef.current is HTMLInputElement | null
```

---

## Q54. 🟡 How do you type Express.js route handlers?

**Answer:**

```ts
import { Request, Response, NextFunction, RequestHandler } from "express";

// Typed request params, body, query, response
interface CreateUserBody {
  name: string;
  email: string;
  role: "admin" | "user";
}

interface UserParams {
  id: string;
}

interface UserQuery {
  includeDeleted?: "true" | "false";
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

// Fully typed handler
const createUser: RequestHandler<{}, UserResponse, CreateUserBody> = async (
  req, res, next
) => {
  const { name, email, role } = req.body; // typed!
  try {
    const user = await UserService.create({ name, email, role });
    res.status(201).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    next(err);
  }
};

// Typed error handler
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  res.status(500).json({ error: err.message });
};

// Module augmentation for custom request properties
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
      requestId: string;
    }
  }
}
```

---

## Q55. 🟡 How do you handle async/await and error types in TypeScript?

**Answer:**

```ts
// Result type pattern — avoids exceptions leaking untyped
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return { ok: false, error: new Error(`HTTP ${res.status}`) };
    const user = await res.json() as User;
    return { ok: true, value: user };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err))
    };
  }
}

// Usage — exhaustive handling
const result = await fetchUser("123");
if (result.ok) {
  console.log(result.value.name); // User
} else {
  console.error(result.error.message); // Error
}

// Custom error types
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

class ValidationError extends AppError {
  constructor(public readonly fields: Record<string, string[]>) {
    super("Validation failed", "VALIDATION_ERROR", 400);
  }
}

// Type narrowing in catch
try {
  // ...
} catch (err) {
  if (err instanceof ValidationError) {
    // err.fields is typed
  } else if (err instanceof AppError) {
    // err.code, err.statusCode are typed
  } else if (err instanceof Error) {
    // err.message
  } else {
    // err is unknown — could be anything
  }
}
```

---

## Q56. 🟡 How do you type environment variables in TypeScript?

**Answer:**

```ts
// env.ts — centralized, validated env config
const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "PORT"] as const;
type RequiredEnvKey = typeof requiredEnvVars[number];

function requireEnv(key: RequiredEnvKey): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  PORT: parseInt(requireEnv("PORT"), 10),
  NODE_ENV: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",
  DEBUG: process.env.DEBUG === "true",
} as const;

// Now env.PORT is number, env.NODE_ENV is literal union — fully typed!

// Alternative: use zod for runtime validation
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env2 = envSchema.parse(process.env);
// Fully typed AND validated at startup
```

---

## Q57. 🔴 How do you write a type-safe event emitter?

**Answer:**

```ts
type EventMap = {
  connect: { port: number; host: string };
  disconnect: { reason: string };
  message: { id: string; data: unknown };
  error: Error;
};

class TypedEventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: Events[keyof Events]) => void>>();

  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    (this.listeners.get(event) as Set<any>).add(listener);
    return this;
  }

  off<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void
  ): this {
    this.listeners.get(event)?.delete(listener as any);
    return this;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): boolean {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners?.size) return false;
    eventListeners.forEach(listener => listener(payload as any));
    return true;
  }
}

const emitter = new TypedEventEmitter<EventMap>();

emitter.on("connect", ({ port, host }) => {
  // port: number, host: string — fully typed!
  console.log(`Connected to ${host}:${port}`);
});

emitter.emit("connect", { port: 3000, host: "localhost" }); // OK
// emitter.emit("connect", { port: "3000" }); // Error — port must be number
```

---

## Q58. 🔴 How do you implement a type-safe dependency injection container?

**Answer:**

```ts
// Token-based DI container
type Token<T> = { readonly __token: T };

function token<T>(name: string): Token<T> {
  return { __token: name } as unknown as Token<T>;
}

class Container {
  private bindings = new Map<Token<any>, () => any>();

  bind<T>(token: Token<T>, factory: () => T): this {
    this.bindings.set(token, factory);
    return this;
  }

  get<T>(token: Token<T>): T {
    const factory = this.bindings.get(token);
    if (!factory) throw new Error(`No binding for token: ${JSON.stringify(token)}`);
    return factory();
  }
}

// Define tokens with their types
const DB_TOKEN = token<Database>("Database");
const LOGGER_TOKEN = token<Logger>("Logger");
const USER_REPO_TOKEN = token<UserRepository>("UserRepository");

// Wire up
const container = new Container()
  .bind(DB_TOKEN, () => new PostgresDatabase())
  .bind(LOGGER_TOKEN, () => new ConsoleLogger())
  .bind(USER_REPO_TOKEN, () => new UserRepository(
    container.get(DB_TOKEN),
    container.get(LOGGER_TOKEN)
  ));

// Retrieve — fully typed
const repo = container.get(USER_REPO_TOKEN); // UserRepository
const db = container.get(DB_TOKEN);          // Database
```

---

## Q59. 🟡 What are some common TypeScript anti-patterns to avoid?

**Answer:**

```ts
// ❌ 1. Overusing `any`
function parseData(data: any): any { /* ... */ }

// ✅ Use unknown with narrowing or generics
function parseData<T>(data: unknown): T {
  // validate/narrow, then cast
  return data as T;
}

// ❌ 2. Type assertions without validation
const user = response as User; // might be wrong at runtime

// ✅ Use type guards or validation
function isUser(val: unknown): val is User {
  return typeof val === "object" && val !== null
    && "id" in val && "name" in val;
}

// ❌ 3. ! everywhere
const el = document.getElementById("app")!.querySelector("button")!;

// ✅ Handle nullability explicitly
const app = document.getElementById("app");
if (!app) throw new Error("Root element not found");
const btn = app.querySelector("button");
if (!btn) throw new Error("Button not found");

// ❌ 4. Ignoring TypeScript errors with @ts-ignore
// @ts-ignore
doSomethingWrong();

// ✅ Use @ts-expect-error (errors if TS doesn't actually error)
// @ts-expect-error — known limitation of third-party type
doSomethingWrong();

// ❌ 5. Duplicating types across files
// ✅ Single source of truth, derived types with Pick/Omit/ReturnType

// ❌ 6. Typing objects as `object` or `{}`
function process(input: object) {} // object has no properties
function process2(input: {}) {}    // anything non-null/undefined

// ✅ Use specific shapes or generics
function process3<T extends Record<string, unknown>>(input: T): T { return input; }
```

---

## Q60. 🔴 How does TypeScript's structural typing differ from nominal typing?

**Answer:**

TypeScript uses **structural typing** (duck typing) — types are compatible if they have the same shape, regardless of what they're named.

```ts
// Structural typing — compatible despite different class names
class Dog {
  name: string;
  constructor(name: string) { this.name = name; }
}
class Cat {
  name: string;
  constructor(name: string) { this.name = name; }
}

let myDog: Dog = new Dog("Rex");
let myCat: Cat = myDog; // OK! — same structure (name: string)

// Contrast with nominal typing (Java/C#): Cat ≠ Dog regardless of shape

// Simulating nominal typing in TypeScript (branded types)
type USD = number & { readonly __brand: "USD" };
type EUR = number & { readonly __brand: "EUR" };

function toUSD(amount: number): USD {
  return amount as USD;
}

function addUSD(a: USD, b: USD): USD {
  return (a + b) as USD;
}

const price: USD = toUSD(100);
const euros: EUR = 85 as EUR;
// addUSD(price, euros); // Error — EUR is not assignable to USD

// Branded ID types — prevent mixing database IDs
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };
```

---

# Part 2: Coding Problems (30 Problems)

---

## Type Utilities

---

### Problem 1. Implement `DeepPartial<T>`

Make all properties of a type optional, recursively (nested objects too).

```ts
type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// Test
interface Config {
  server: { host: string; port: number; ssl: boolean };
  db: { url: string; name: string };
}

type PartialConfig = DeepPartial<Config>;
// All nested properties optional — perfect for update operations
const update: PartialConfig = { server: { port: 4000 } }; // no error
```

---

### Problem 2. Implement `RequiredKeys<T>` and `OptionalKeys<T>`

Extract the required and optional key names from a type.

```ts
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T];

interface User {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
}

type RK = RequiredKeys<User>; // "id" | "name"
type OK = OptionalKeys<User>; // "email" | "avatar"
```

---

### Problem 3. Implement `Flatten<T>` — flatten an array type one level

```ts
type Flatten<T> = T extends Array<infer U> ? U : T;

type A = Flatten<string[]>;    // string
type B = Flatten<number[][]>;  // number[]  (one level only)
type C = Flatten<boolean>;     // boolean   (not an array)

// Deep flatten
type DeepFlatten<T> = T extends Array<infer U> ? DeepFlatten<U> : T;
type D = DeepFlatten<number[][][]>; // number
```

---

### Problem 4. Implement `Zip<T, U>` — zip two tuples together

```ts
type Zip<T extends any[], U extends any[]> = {
  [K in keyof T]: K extends keyof U ? [T[K], U[K]] : never
};

type Zipped = Zip<[string, number, boolean], [Date, string, number]>;
// [[string, Date], [number, string], [boolean, number]]
```

---

### Problem 5. Implement `UnionToIntersection<U>` — convert union to intersection

```ts
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type A = { a: string };
type B = { b: number };
type C = { c: boolean };

type ABC = UnionToIntersection<A | B | C>; // { a: string } & { b: number } & { c: boolean }
```

---

### Problem 6. Implement `Awaited<T>` — unwrap nested Promises

```ts
type MyAwaited<T> = T extends null | undefined
  ? T
  : T extends object & { then(onfulfilled: infer F, ...args: infer _): any }
    ? F extends (value: infer V, ...args: infer _) => any
      ? MyAwaited<V>
      : never
    : T;

type A = MyAwaited<Promise<string>>;              // string
type B = MyAwaited<Promise<Promise<number>>>;     // number
type C = MyAwaited<boolean>;                      // boolean (not a Promise)
```

---

### Problem 7. Implement `OmitByValue<T, V>` — omit properties by value type

```ts
type OmitByValue<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K]
};

interface Mixed {
  id: number;
  name: string;
  active: boolean;
  onClick: () => void;
  onSubmit: (e: Event) => void;
}

type DataOnly = OmitByValue<Mixed, Function>;
// { id: number; name: string; active: boolean }
```

---

### Problem 8. Implement `FunctionKeys<T>` — extract keys whose values are functions

```ts
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T];

interface Service {
  name: string;
  port: number;
  start(): void;
  stop(): void;
  restart(): Promise<void>;
}

type ServiceMethods = FunctionKeys<Service>; // "start" | "stop" | "restart"
```

---

## Generics & Constraints

---

### Problem 9. Write a typed `pick` function

```ts
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => { result[key] = obj[key]; });
  return result;
}

const user = { id: 1, name: "Alice", email: "a@b.com", password: "secret" };
const safeUser = pick(user, ["id", "name", "email"]);
// { id: number; name: string; email: string } — password excluded from type
```

---

### Problem 10. Write a typed `omit` function

```ts
function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result as Omit<T, K>;
}

const full = { id: 1, name: "Alice", password: "secret" };
const safe = omit(full, ["password"]); // { id: number; name: string }
```

---

### Problem 11. Write a `groupBy` function with generics

```ts
function groupBy<T, K extends string | number | symbol>(
  items: T[],
  getKey: (item: T) => K
): Partial<Record<K, T[]>> {
  return items.reduce<Partial<Record<K, T[]>>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] ?? [];
    groups[key]!.push(item);
    return groups;
  }, {});
}

const orders = [
  { id: 1, status: "pending" },
  { id: 2, status: "shipped" },
  { id: 3, status: "pending" },
];
const byStatus = groupBy(orders, o => o.status);
// { pending: [...], shipped: [...] }
```

---

### Problem 12. Write a generic `cache` decorator

```ts
function cached<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) {
      cache.set(key, fn(...args));
    }
    return cache.get(key) as ReturnType<T>;
  }) as T;
}

const expensiveCalc = cached((n: number): number => {
  console.log(`Computing for ${n}`);
  return n * n;
});

expensiveCalc(5); // logs "Computing for 5", returns 25
expensiveCalc(5); // returns 25, no log (cached)
```

---

### Problem 13. Implement a typed `EventEmitter`

```ts
class EventEmitter<Events extends Record<string, any>> {
  private handlers: { [K in keyof Events]?: Array<(data: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): this {
    this.handlers[event] = this.handlers[event] ?? [];
    this.handlers[event]!.push(handler);
    return this;
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.handlers[event]?.forEach(h => h(data));
  }

  off<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): this {
    this.handlers[event] = this.handlers[event]?.filter(h => h !== handler);
    return this;
  }
}

// Usage
type AppEvents = { userJoined: { userId: string }; message: string };
const emitter = new EventEmitter<AppEvents>();
emitter.on("userJoined", ({ userId }) => console.log(userId));
emitter.emit("userJoined", { userId: "123" }); // typed!
```

---

### Problem 14. Write a `pipe` function with proper types

```ts
function pipe<A>(a: A): A;
function pipe<A, B>(a: A, f1: (a: A) => B): B;
function pipe<A, B, C>(a: A, f1: (a: A) => B, f2: (b: B) => C): C;
function pipe<A, B, C, D>(a: A, f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D): D;
function pipe(value: unknown, ...fns: ((x: any) => any)[]) {
  return fns.reduce((v, fn) => fn(v), value);
}

const result = pipe(
  "  hello world  ",
  (s: string) => s.trim(),
  (s: string) => s.split(" "),
  (arr: string[]) => arr.map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
);
// "Hello World" — typed as string
```

---

### Problem 15. Implement a `retry` function with typed result

```ts
async function retry<T>(
  fn: () => Promise<T>,
  options: { attempts: number; delay?: number; onRetry?: (err: unknown, attempt: number) => void }
): Promise<T> {
  const { attempts, delay = 0, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        onRetry?.(err, attempt);
        if (delay > 0) await new Promise(r => setTimeout(r, delay * attempt));
      }
    }
  }

  throw lastError;
}

const data = await retry(
  () => fetch("/api/data").then(r => r.json() as Promise<MyData>),
  { attempts: 3, delay: 500, onRetry: (err, n) => console.warn(`Retry ${n}:`, err) }
);
// data is MyData — fully typed
```

---

## Advanced Type Challenges

---

### Problem 16. Implement `TupleToUnion<T>` — convert a tuple to a union

```ts
type TupleToUnion<T extends any[]> = T[number];

type Tuple = [string, number, boolean];
type Union = TupleToUnion<Tuple>; // string | number | boolean
```

---

### Problem 17. Implement `UnionToTuple<U>` — convert union to tuple (advanced)

```ts
// This requires exploiting contravariant positions
type UnionToFn<U> = U extends any ? (k: U) => void : never;
type UnionToIntersection<U> = UnionToFn<U> extends (k: infer I) => void ? I : never;
type LastOfUnion<U> = UnionToIntersection<U> extends (k: infer L) => void ? L : never;

type UnionToTuple<U, Last = LastOfUnion<U>> = [U] extends [never]
  ? []
  : [...UnionToTuple<Exclude<U, Last>>, Last];

type T = UnionToTuple<"a" | "b" | "c">; // ["a", "b", "c"] (order may vary)
```

---

### Problem 18. Implement `CamelToSnake<S>` — string manipulation at the type level

```ts
type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Tail extends Uncapitalize<Tail>
      ? `${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Lowercase<Head>}_${CamelToSnake<Tail>}`
    : S;

type A = CamelToSnake<"helloWorld">;     // "hello_world"
type B = CamelToSnake<"myVariableName">; // "my_variable_name"

// Apply to object keys
type SnakeCaseKeys<T> = {
  [K in keyof T as CamelToSnake<string & K>]: T[K]
};
```

---

### Problem 19. Implement a `Schema` validator type system

```ts
type SchemaType = {
  string: string;
  number: number;
  boolean: boolean;
};

type Schema = {
  [key: string]: keyof SchemaType | { type: keyof SchemaType; optional?: boolean };
};

type InferSchema<S extends Schema> = {
  [K in keyof S as S[K] extends { optional: true } ? never : K]:
    S[K] extends keyof SchemaType
      ? SchemaType[S[K]]
      : S[K] extends { type: infer T extends keyof SchemaType }
        ? SchemaType[T]
        : never
} & {
  [K in keyof S as S[K] extends { optional: true } ? K : never]?:
    S[K] extends { type: infer T extends keyof SchemaType } ? SchemaType[T] : never
};

const userSchema = {
  name: "string",
  age: "number",
  email: { type: "string", optional: true }
} satisfies Schema;

type UserFromSchema = InferSchema<typeof userSchema>;
// { name: string; age: number; email?: string }
```

---

### Problem 20. Write an `assertNever` exhaustiveness checker

```ts
function assertNever(x: never, message?: string): never {
  throw new Error(message ?? `Unhandled case: ${JSON.stringify(x)}`);
}

type Shape = "circle" | "square" | "triangle";

function describeShape(shape: Shape): string {
  switch (shape) {
    case "circle": return "A round shape";
    case "square": return "A four-sided shape";
    case "triangle": return "A three-sided shape";
    default: return assertNever(shape); // TypeScript errors here if a case is missed
  }
}
```

---

### Problem 21. Implement `Paths<T>` — get all dot-notation paths of an object type

```ts
type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends object
    ? Paths<T[K], `${Prefix}${K}.`> | `${Prefix}${K}`
    : `${Prefix}${K}`
}[keyof T & string];

interface Config {
  database: { host: string; port: number };
  cache: { ttl: number; maxSize: number };
  logging: boolean;
}

type ConfigPaths = Paths<Config>;
// "database" | "database.host" | "database.port" | "cache" | "cache.ttl" | "cache.maxSize" | "logging"
```

---

### Problem 22. Write a type-safe `get` function for deep object access

```ts
type Get<T, K extends string> = K extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? Get<T[Head], Tail>
    : never
  : K extends keyof T
    ? T[K]
    : never;

function get<T extends object, K extends Paths<T>>(obj: T, path: K): Get<T, K> {
  return path.split(".").reduce((acc: any, key) => acc?.[key], obj) as Get<T, K>;
}

const config = {
  database: { host: "localhost", port: 5432 },
  cache: { ttl: 3600, maxSize: 1000 }
};

const host = get(config, "database.host"); // string
const port = get(config, "database.port"); // number
const ttl = get(config, "cache.ttl");      // number
// get(config, "database.url");            // Error — invalid path
```

---

## Real-World Patterns

---

### Problem 23. Type a Redux-style reducer with discriminated unions

```ts
interface CartItem { id: string; name: string; price: number; quantity: number }
interface CartState { items: CartItem[]; total: number; discount: number }

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { id: string; quantity: number } }
  | { type: "APPLY_DISCOUNT"; payload: { percent: number } }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const exists = state.items.find(i => i.id === action.payload.id);
      const items = exists
        ? state.items.map(i => i.id === action.payload.id
            ? { ...i, quantity: i.quantity + action.payload.quantity }
            : i)
        : [...state.items, action.payload];
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      return { ...state, items, total };
    }
    case "REMOVE_ITEM": {
      const items = state.items.filter(i => i.id !== action.payload.id);
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      return { ...state, items, total };
    }
    case "UPDATE_QUANTITY": {
      const items = state.items.map(i =>
        i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
      );
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      return { ...state, items, total };
    }
    case "APPLY_DISCOUNT":
      return { ...state, discount: action.payload.percent };
    case "CLEAR_CART":
      return { items: [], total: 0, discount: 0 };
  }
}
```

---

### Problem 24. Write a type-safe API client

```ts
type ApiEndpoints = {
  "GET /users": { response: User[]; query: { limit?: number; offset?: number } };
  "GET /users/:id": { response: User; params: { id: string } };
  "POST /users": { response: User; body: CreateUserDto };
  "PUT /users/:id": { response: User; params: { id: string }; body: UpdateUserDto };
  "DELETE /users/:id": { response: void; params: { id: string } };
};

type Method = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = keyof ApiEndpoints;
type EndpointConfig<E extends Endpoint> = ApiEndpoints[E];

async function apiCall<E extends Endpoint>(
  endpoint: E,
  options?: Omit<EndpointConfig<E>, "response">
): Promise<EndpointConfig<E>["response"]> {
  // Implementation would parse endpoint, substitute params, etc.
  const [method, path] = endpoint.split(" ");
  const response = await fetch(path, { method, body: JSON.stringify((options as any)?.body) });
  if (method === "DELETE") return undefined as any;
  return response.json();
}

// Fully typed calls
const users = await apiCall("GET /users", { query: { limit: 10 } }); // User[]
const user = await apiCall("GET /users/:id", { params: { id: "1" } }); // User
const newUser = await apiCall("POST /users", { body: { name: "Alice", email: "a@b.com", role: "user" } }); // User
```

---

### Problem 25. Implement a form validation system

```ts
type FieldValidator<T> = (value: T) => string | null;
type FormSchema<T> = { [K in keyof T]: FieldValidator<T[K]>[] };
type FormErrors<T> = { [K in keyof T]?: string[] };

function createValidator<T extends Record<string, unknown>>(schema: FormSchema<T>) {
  return function validate(data: T): FormErrors<T> {
    const errors: FormErrors<T> = {};
    for (const key in schema) {
      const validators = schema[key];
      const value = data[key];
      const fieldErrors = validators
        .map(v => v(value))
        .filter((e): e is string => e !== null);
      if (fieldErrors.length > 0) {
        errors[key] = fieldErrors;
      }
    }
    return errors;
  };
}

// Validators
const required = (msg = "Required"): FieldValidator<unknown> => (v) =>
  v == null || v === "" ? msg : null;

const minLength = (n: number): FieldValidator<string> => (v) =>
  v.length < n ? `Minimum ${n} characters` : null;

const email: FieldValidator<string> = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Invalid email";

// Usage
interface LoginForm { username: string; password: string; email: string }

const validate = createValidator<LoginForm>({
  username: [required(), minLength(3)],
  password: [required(), minLength(8)],
  email: [required(), email]
});

const errors = validate({ username: "ab", password: "", email: "notanemail" });
// { username: ["Minimum 3 characters"], password: ["Required", "Minimum 8 characters"], email: ["Invalid email"] }
```

---

### Problem 26. Write a typed state machine

```ts
type StateMachine<
  States extends string,
  Events extends string,
  Transitions extends Partial<Record<States, Partial<Record<Events, States>>>>
> = {
  current: States;
  send: (event: Events) => void;
  can: (event: Events) => boolean;
};

function createMachine<
  States extends string,
  Events extends string
>(config: {
  initial: States;
  transitions: Partial<Record<States, Partial<Record<Events, States>>>>;
}): StateMachine<States, Events, typeof config.transitions> {
  let current = config.initial;
  return {
    get current() { return current; },
    can(event) { return Boolean(config.transitions[current]?.[event]); },
    send(event) {
      const next = config.transitions[current]?.[event];
      if (next) current = next;
    }
  };
}

const trafficLight = createMachine({
  initial: "red" as "red" | "yellow" | "green",
  transitions: {
    red: { go: "green" },
    green: { slow: "yellow" },
    yellow: { stop: "red" }
  }
});

trafficLight.current; // "red"
trafficLight.send("go");
trafficLight.current; // "green"
```

---

### Problem 27. Implement a typed Observable/stream

```ts
class Observable<T> {
  constructor(private subscriber: (observer: Observer<T>) => () => void) {}

  subscribe(observer: Partial<Observer<T>>): Subscription {
    const unsubscribe = this.subscriber({
      next: observer.next ?? (() => {}),
      error: observer.error ?? ((e) => { throw e; }),
      complete: observer.complete ?? (() => {})
    });
    return { unsubscribe };
  }

  map<U>(fn: (val: T) => U): Observable<U> {
    return new Observable<U>(observer =>
      this.subscribe({
        next: val => observer.next(fn(val)),
        error: observer.error,
        complete: observer.complete
      }).unsubscribe
    );
  }

  filter(predicate: (val: T) => boolean): Observable<T> {
    return new Observable<T>(observer =>
      this.subscribe({
        next: val => predicate(val) && observer.next(val),
        error: observer.error,
        complete: observer.complete
      }).unsubscribe
    );
  }
}

interface Observer<T> { next(val: T): void; error(err: unknown): void; complete(): void }
interface Subscription { unsubscribe(): void }

const numbers = new Observable<number>(observer => {
  [1, 2, 3, 4, 5].forEach(n => observer.next(n));
  observer.complete();
  return () => {};
});

numbers
  .filter(n => n % 2 === 0)
  .map(n => n * 10)
  .subscribe({ next: console.log }); // 20, 40
```

---

### Problem 28. Write a type-safe query builder (SQL-like)

```ts
class TypedQuery<T extends object> {
  private conditions: string[] = [];
  private orderByField?: keyof T;
  private limitVal?: number;

  where<K extends keyof T>(field: K, op: "=" | ">" | "<" | ">=" | "<=" | "LIKE", value: T[K]): this {
    this.conditions.push(`${String(field)} ${op} '${value}'`);
    return this;
  }

  orderBy(field: keyof T, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByField = field;
    return this;
  }

  limit(n: number): this {
    this.limitVal = n;
    return this;
  }

  toSQL(table: string): string {
    let sql = `SELECT * FROM ${table}`;
    if (this.conditions.length) sql += ` WHERE ${this.conditions.join(" AND ")}`;
    if (this.orderByField) sql += ` ORDER BY ${String(this.orderByField)}`;
    if (this.limitVal) sql += ` LIMIT ${this.limitVal}`;
    return sql;
  }
}

interface Product { id: number; name: string; price: number; category: string }

const query = new TypedQuery<Product>()
  .where("price", ">", 100)
  .where("category", "=", "electronics")
  .orderBy("price")
  .limit(20)
  .toSQL("products");
// "SELECT * FROM products WHERE price > '100' AND category = 'electronics' ORDER BY price LIMIT 20"
```

---

### Problem 29. Implement a publish-subscribe system with typed topics

```ts
type TopicMap = {
  "user.created": { userId: string; email: string };
  "user.updated": { userId: string; changes: Partial<User> };
  "order.placed": { orderId: string; total: number; userId: string };
  "payment.processed": { orderId: string; success: boolean };
};

class PubSub {
  private subscribers: {
    [K in keyof TopicMap]?: Array<(data: TopicMap[K]) => void>
  } = {};

  subscribe<K extends keyof TopicMap>(
    topic: K,
    handler: (data: TopicMap[K]) => void
  ): () => void {
    this.subscribers[topic] = this.subscribers[topic] ?? [];
    (this.subscribers[topic] as any[]).push(handler);
    return () => {
      this.subscribers[topic] = (this.subscribers[topic] as any[]).filter(
        h => h !== handler
      ) as any;
    };
  }

  publish<K extends keyof TopicMap>(topic: K, data: TopicMap[K]): void {
    this.subscribers[topic]?.forEach(h => h(data));
  }
}

const bus = new PubSub();

const unsubscribe = bus.subscribe("user.created", ({ userId, email }) => {
  // userId: string, email: string — fully typed
  console.log(`New user: ${email}`);
});

bus.publish("user.created", { userId: "1", email: "a@b.com" }); // OK
// bus.publish("user.created", { userId: "1" }); // Error — missing email
```

---

### Problem 30. Write a middleware chain with typed context

```ts
interface Context {
  request: { method: string; path: string; body: unknown; headers: Record<string, string> };
  response: { status: number; body: unknown };
  user?: { id: string; role: string };
  [key: string]: unknown;
}

type Middleware<C extends Context = Context> = (
  ctx: C,
  next: () => Promise<void>
) => Promise<void>;

type MiddlewareChain<C extends Context = Context> = {
  use(middleware: Middleware<C>): MiddlewareChain<C>;
  run(ctx: C): Promise<void>;
};

function createChain<C extends Context = Context>(): MiddlewareChain<C> {
  const middlewares: Middleware<C>[] = [];

  return {
    use(middleware) {
      middlewares.push(middleware);
      return this;
    },
    async run(ctx) {
      let index = 0;
      const next = async () => {
        const middleware = middlewares[index++];
        if (middleware) await middleware(ctx, next);
      };
      await next();
    }
  };
}

// Usage
const chain = createChain()
  .use(async (ctx, next) => {
    console.log(`${ctx.request.method} ${ctx.request.path}`);
    await next();
    console.log(`Response: ${ctx.response.status}`);
  })
  .use(async (ctx, next) => {
    const token = ctx.request.headers["authorization"];
    if (token) {
      ctx.user = { id: "1", role: "admin" }; // set on context
    }
    await next();
  })
  .use(async (ctx) => {
    ctx.response = { status: 200, body: { message: "Hello!" } };
  });

await chain.run({
  request: { method: "GET", path: "/api/users", body: null, headers: {} },
  response: { status: 0, body: null }
});
```

---

# Quick Reference Cheatsheet

## Essential Utility Types

```ts
Partial<T>                     // all props optional
Required<T>                    // all props required
Readonly<T>                    // all props readonly
Record<K, V>                   // object with keys K and values V
Pick<T, K>                     // select properties K from T
Omit<T, K>                     // exclude properties K from T
Exclude<T, U>                  // T without members assignable to U
Extract<T, U>                  // T with only members assignable to U
NonNullable<T>                 // T without null and undefined
ReturnType<T>                  // return type of function T
Parameters<T>                  // parameter tuple of function T
ConstructorParameters<T>       // constructor param tuple of class T
InstanceType<T>                // instance type of class T
Awaited<T>                     // unwrap Promise<T> → T
```

## Type Guard Patterns

```ts
typeof x === "string"          // primitive narrowing
x instanceof Error             // class instance narrowing
"property" in x                // property presence narrowing
x !== null && x !== undefined  // nullish narrowing
Array.isArray(x)               // array narrowing
```

## Common Generic Patterns

```ts
<T>                            // unconstrained generic
<T extends object>             // T must be an object
<T extends keyof U>            // T must be a key of U
<T = DefaultType>              // T defaults to DefaultType
<T extends X = X>              // constrained with default
```

## tsconfig Quick Reference

```json
{ "strict": true }              // enable all strict checks
{ "noUncheckedIndexedAccess": true } // arr[0] is T | undefined
{ "exactOptionalPropertyTypes": true } // stricter optional props
{ "declaration": true }         // emit .d.ts files
{ "paths": { "@/*": ["src/*"] }} // path aliases
```

---

*This guide covers TypeScript from zero to advanced. For deeper topics, practice with [type-challenges](https://github.com/type-challenges/type-challenges) — a curated collection of type-level puzzles that sharpen your TypeScript skills.*
