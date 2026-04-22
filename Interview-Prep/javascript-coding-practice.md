# JavaScript Coding Practice — 200+ Questions (No Solutions)

> A massive list of JavaScript coding practice questions covering every topic. No answers — just problems to solve. Try each one yourself, then cross-check with MDN, docs, or AI. Organized by topic for focused practice.

---

## Table of Contents

1. [Variables, Scope & Hoisting](#1-variables-scope--hoisting)
2. [Data Types & Type Coercion](#2-data-types--type-coercion)
3. [Strings](#3-strings)
4. [Numbers & Math](#4-numbers--math)
5. [Arrays](#5-arrays)
6. [Objects](#6-objects)
7. [Functions](#7-functions)
8. [Closures](#8-closures)
9. [`this` & Context](#9-this--context)
10. [Prototypes & Inheritance](#10-prototypes--inheritance)
11. [ES6 Classes & OOP](#11-es6-classes--oop)
12. [Destructuring, Spread & Rest](#12-destructuring-spread--rest)
13. [Iterators & Generators](#13-iterators--generators)
14. [Promises & Async/Await](#14-promises--asyncawait)
15. [Event Loop & Timing](#15-event-loop--timing)
16. [Error Handling](#16-error-handling)
17. [Modules](#17-modules)
18. [Regex](#18-regex)
19. [JSON](#19-json)
20. [Map, Set, WeakMap, WeakSet](#20-map-set-weakmap-weakset)
21. [Functional Programming](#21-functional-programming)
22. [Recursion](#22-recursion)
23. [Currying & Partial Application](#23-currying--partial-application)
24. [Debounce, Throttle & Rate Limiting](#24-debounce-throttle--rate-limiting)
25. [Memoization & Caching](#25-memoization--caching)
26. [Polyfills](#26-polyfills)
27. [DOM & Events](#27-dom--events)
28. [Browser APIs & Storage](#28-browser-apis--storage)
29. [Data Structures](#29-data-structures)
30. [Algorithms](#30-algorithms)
31. [Design Patterns](#31-design-patterns)
32. [Output-Based Tricky Questions](#32-output-based-tricky-questions)

---

## 1. Variables, Scope & Hoisting

1. Predict the output of a script using `var`, `let`, and `const` declared before initialization.
2. Write a function that demonstrates block scope vs function scope.
3. Show three ways a `var` variable can leak outside a block.
4. Write code that triggers a `ReferenceError` due to TDZ.
5. Implement a function that returns different results depending on whether `var` or `let` is used in a loop.
6. Create an example where `const` prevents reassignment but allows object mutation — then freeze it so it can't.
7. Write a snippet that shows the difference between declaration hoisting and initialization.
8. Hoist a function expression vs a function declaration and compare.
9. Given three nested scopes, write code that shadows a variable at each level.
10. Implement a simple module pattern using an IIFE.

---

## 2. Data Types & Type Coercion

11. Write `typeof` tests for: `null`, `undefined`, `NaN`, `[]`, `{}`, a function, a Symbol, a BigInt.
12. Show five examples where `==` behaves unexpectedly vs `===`.
13. Implement `isEqual(a, b)` that handles `NaN === NaN` as true.
14. Write a function that returns `true` only if a value is a primitive.
15. Convert: `"42"` to a number using 4 different methods.
16. Explain the output of `[] + []`, `[] + {}`, `{} + []`, `{} + {}`.
17. Write a function `typeOf(value)` that returns the accurate type (`"array"`, `"null"`, etc.).
18. Compare `Number.isNaN(x)` and the global `isNaN(x)` — write a test case that shows the difference.
19. Implement a function that converts `"true"`, `"false"`, `"null"`, `"undefined"` strings to their real values.
20. Write code that triggers implicit coercion in a conditional and log the coerced value.

---

## 3. Strings

21. Reverse a string without using `.reverse()`.
22. Check if a string is a palindrome (ignoring case and spaces).
23. Count occurrences of each character in a string.
24. Find the first non-repeating character in a string.
25. Find the longest substring without repeating characters.
26. Capitalize the first letter of every word in a string.
27. Convert a string to camelCase, snake_case, and kebab-case.
28. Check if two strings are anagrams.
29. Compress a string: `"aaabbc"` → `"a3b2c1"`.
30. Expand compressed string: `"a3b2c1"` → `"aaabbc"`.
31. Find all permutations of a string.
32. Remove duplicate characters from a string.
33. Implement `repeat(str, n)` without using `.repeat()`.
34. Truncate a string to N characters and append `"..."`.
35. Convert a string with template placeholders like `"Hello {name}"` into a final string.
36. Pad a string on the left to a given length (polyfill `padStart`).
37. Find the longest common prefix across an array of strings.
38. Count words in a string, ignoring multiple spaces.
39. Detect if a string contains only unique characters — solve in O(n) and O(1) space if ASCII.
40. Replace all occurrences of a substring without using `.replaceAll()`.

---

## 4. Numbers & Math

41. Check if a number is an integer without using `Number.isInteger`.
42. Round a number to N decimal places.
43. Generate a random integer between `min` and `max` inclusive.
44. Convert a number to its binary, octal, and hex representation.
45. Check if a number is a power of 2.
46. Reverse the digits of an integer.
47. Find the GCD and LCM of two numbers.
48. Sum all digits of a number until a single digit remains.
49. Check if a number is prime.
50. Generate the first N prime numbers.
51. Compute factorial iteratively and recursively.
52. Compute nth Fibonacci (iterative, recursive, memoized, matrix-power).
53. Convert a decimal to a Roman numeral.
54. Convert a Roman numeral to decimal.
55. Format a number as currency with commas (e.g., `1234567` → `"1,234,567"`).

---

## 5. Arrays

56. Find the maximum and minimum in an array in a single pass.
57. Remove duplicates from an array (4 different ways).
58. Flatten a nested array to any depth without using `.flat()`.
59. Chunk an array into subarrays of size N.
60. Rotate an array by K positions (left and right).
61. Find the intersection of two arrays.
62. Find the union of two arrays.
63. Find the difference between two arrays.
64. Find all pairs in an array that sum to a target (Two Sum).
65. Find three numbers that sum to zero (3-Sum).
66. Move all zeros to the end of an array in-place.
67. Merge two sorted arrays into one sorted array.
68. Implement `.map`, `.filter`, `.reduce`, `.forEach`, `.some`, `.every` polyfills.
69. Group an array of objects by a property.
70. Find the most frequent element in an array.
71. Shuffle an array (Fisher–Yates).
72. Find the second largest element without sorting.
73. Find the longest consecutive sequence in an unsorted array.
74. Find the majority element (>n/2 occurrences) in O(n) time and O(1) space.
75. Check if an array is sorted.
76. Binary search on a sorted array (iterative and recursive).
77. Find the minimum number of swaps to sort an array.
78. Compute the running sum / prefix sum of an array.
79. Find the maximum sum of a contiguous subarray (Kadane's).
80. Find the maximum product of a contiguous subarray.
81. Find the longest increasing subsequence.
82. Remove an element from an array in-place and return the new length.
83. Partition an array around a pivot (Lomuto and Hoare schemes).
84. Implement `Array.from` polyfill.
85. Implement `Array.prototype.flat(depth)` from scratch.

---

## 6. Objects

86. Deep clone an object (handle nested, arrays, Date, RegExp, circular refs).
87. Deep freeze an object.
88. Check deep equality of two objects.
89. Merge two objects deeply.
90. Convert a flat object with dot-notation keys to a nested object (and vice versa).
91. Invert keys and values of an object.
92. Count frequency of values in an object.
93. Pick only specified keys from an object (like lodash `pick`).
94. Omit specified keys from an object.
95. Get all paths to leaves in a nested object.
96. Compare two objects and return the diff.
97. Convert an object to query string and back.
98. Sort an object's keys alphabetically.
99. Convert an object into an array of `[key, value]` pairs and back.
100. Check if an object is empty.
101. Safely access a nested property without optional chaining (polyfill).
102. Implement `Object.assign` polyfill.
103. Implement `Object.keys`, `Object.values`, `Object.entries` polyfills.
104. Make an object immutable including nested objects.
105. Implement a method chaining pattern on an object.

---

## 7. Functions

106. Write a function that returns another function that remembers its arguments.
107. Implement a function that accepts any number of arguments and returns their sum.
108. Implement `once(fn)` — runs only the first time.
109. Implement `after(n, fn)` — runs only after being called N times.
110. Implement `before(n, fn)` — runs only the first N-1 times.
111. Implement a function composition helper.
112. Implement `pipe` and `compose`.
113. Implement a `negate(fn)` function that returns the boolean negation.
114. Implement `noop`, `identity`, and `constant(value)` utility functions.
115. Write a function that returns a new function with its arguments reversed.
116. Write a function that converts a callback-based API to a Promise-based one.
117. Write a `promisify(fn)` polyfill.
118. Write a function that limits how many times another function can be called.
119. Implement a function queue — pass tasks, execute in order.
120. Implement a function that takes a function and returns one with default arguments.

---

## 8. Closures

121. Create a counter using closures with `increment`, `decrement`, `reset`.
122. Create a private variable using a closure.
123. Fix the classic `for` loop closure bug using an IIFE.
124. Fix the same bug using `let`.
125. Create a function that generates unique IDs.
126. Implement a simple toggle function that flips between true/false.
127. Write a function that creates a bank account with deposit, withdraw, and balance methods.
128. Build a cache using closure without exposing the internal storage.
129. Write `sum(1)(2)(3)()` that accumulates values until called with no args.
130. Build a function that returns an object with `on`, `off`, `emit` methods — all sharing a hidden listeners map.

---

## 9. `this` & Context

131. Predict the output when the same function is called as method, standalone, and with `new`.
132. Write a class where a method loses `this` when used as a callback — then fix it with bind and arrow.
133. Implement `call`, `apply`, and `bind` polyfills.
134. Predict what `this` refers to inside a nested arrow function within a method.
135. Write code where `bind` is used to partially apply arguments.
136. Predict output when an arrow function is used as an object method.
137. Show three ways to preserve `this` inside a `setTimeout` callback.
138. Write a function that logs its context regardless of how it's called (use `this`).
139. Predict what `this` is inside a constructor function called without `new`.
140. Chain multiple `.bind` calls and predict the result — only the first bind sticks.

---

## 10. Prototypes & Inheritance

141. Implement `Object.create` polyfill.
142. Implement `instanceof` polyfill.
143. Implement classical inheritance using constructor functions and prototypes.
144. Convert constructor-function inheritance to `class extends` syntax.
145. Extend a native class like `Array` or `Error` and add a custom method.
146. Show the prototype chain of an instance, a class, and an object literal.
147. Use `Object.setPrototypeOf` to change an object's prototype at runtime.
148. Add a shared method to all Array instances via `Array.prototype` (and explain why it's risky).
149. Explain and demonstrate `hasOwnProperty` vs `in` vs `Object.hasOwn`.
150. Create a subclass that overrides a parent method and calls the parent version with `super`.

---

## 11. ES6 Classes & OOP

151. Build a `Shape` base class with `Circle`, `Rectangle`, `Triangle` subclasses — each implements `area()`.
152. Implement a `BankAccount` class with private fields (`#balance`) and balance history.
153. Implement a `Stack` class with `push`, `pop`, `peek`, `isEmpty`, `size`.
154. Implement a `Queue` class with `enqueue`, `dequeue`, `peek`.
155. Implement a `LinkedList` class with `append`, `prepend`, `delete`, `traverse`.
156. Implement a `PriorityQueue` using a min-heap.
157. Build a `Singleton` class that always returns the same instance.
158. Build an `Observer` pattern with `subscribe`, `unsubscribe`, `notify`.
159. Create a mixin function that adds methods from one class to another.
160. Implement a class with static factory methods and a private constructor pattern.
161. Create a class hierarchy using composition instead of inheritance.
162. Implement abstract-like methods using classes (throw if subclass doesn't override).

---

## 12. Destructuring, Spread & Rest

163. Swap two variables using destructuring.
164. Destructure nested objects with default values and renames.
165. Extract the first and last elements and collect the middle using rest.
166. Clone an array using spread.
167. Merge two arrays using spread.
168. Merge two objects and override specific keys.
169. Convert `arguments` into a real array using spread.
170. Write a function that accepts options object with defaults via destructuring.
171. Destructure a return value that is an array of tuples (like `Object.entries`).
172. Write a function that accepts any number of arguments and removes the first one using rest.

---

## 13. Iterators & Generators

173. Make an object iterable using `[Symbol.iterator]`.
174. Implement a range generator: `range(1, 10, 2)`.
175. Implement an infinite generator of Fibonacci numbers — take the first 10.
176. Implement a generator that yields characters of a string.
177. Build a generator-based pagination helper that yields pages on demand.
178. Use a generator to implement lazy evaluation for `map` and `filter`.
179. Implement async iteration over a paginated API using `for await...of`.
180. Convert a callback-based tree walker into a generator.
181. Implement a generator that pauses on each `yield` and resumes with `.next(value)`.
182. Implement a takeWhile helper using generators.

---

## 14. Promises & Async/Await

183. Implement `Promise.all` from scratch.
184. Implement `Promise.allSettled` from scratch.
185. Implement `Promise.race` from scratch.
186. Implement `Promise.any` from scratch.
187. Implement a Promise class from scratch (with pending/fulfilled/rejected states).
188. Implement a retry helper with exponential backoff.
189. Implement a timeout wrapper around a promise.
190. Implement a concurrency-limited runner: run N promises at a time.
191. Implement a promise-based `sleep(ms)`.
192. Run promises in series (sequentially).
193. Convert a function that uses `.then()` chains into `async/await`.
194. Handle errors in `Promise.all` without aborting other promises.
195. Implement a cancellable promise using `AbortController`.
196. Implement `promisify(fn)` — convert Node-style callbacks to promises.
197. Implement async `map`, `filter`, `reduce`.
198. Implement a pub/sub using promises that resolves next time an event fires.
199. Chain multiple async operations and short-circuit on the first failure.
200. Build an async queue that processes tasks with configurable concurrency.

---

## 15. Event Loop & Timing

201. Predict the output of code mixing `setTimeout`, `Promise.then`, and sync logs.
202. Predict the output of `async/await` combined with `setTimeout(0)`.
203. Show the difference between `process.nextTick`, `setImmediate`, and `setTimeout(0)` in Node.
204. Predict the order when `queueMicrotask` and `Promise.then` are used together.
205. Write code that demonstrates microtask starvation.
206. Explain and show output of `setTimeout` inside a loop vs outside.
207. Predict output when `await` is placed before vs after a `setTimeout`.
208. Build a small demo that shows why `setTimeout(fn, 0)` is not truly 0ms.
209. Implement a simple "tick scheduler" that groups updates using `queueMicrotask`.
210. Write a function that polls for a condition every N ms, with a max timeout.

---

## 16. Error Handling

211. Throw a custom error class that extends `Error`.
212. Wrap an async operation with `try/catch` and log a detailed context.
213. Handle errors in a Promise chain without using `.catch()`.
214. Write a function that retries on `TypeError` but not on any other error.
215. Implement a global error handler in the browser (`window.onerror`, `unhandledrejection`).
216. Build a safe wrapper that returns `[error, data]` tuples for async calls (Go-style).
217. Implement a circuit breaker pattern that opens after N consecutive failures.
218. Differentiate between operational and programmer errors with examples.
219. Preserve the original stack trace when re-throwing an error.
220. Write code that demonstrates why `throw` inside an async function rejects the returned promise.

---

## 17. Modules

221. Create an ES module with named and default exports.
222. Convert a CommonJS module to ESM.
223. Demonstrate circular imports with ESM — show what's `undefined` at import time.
224. Use dynamic `import()` to load a module conditionally.
225. Export an object and show the difference between live bindings (ESM) and copied values (CJS).
226. Split a large module into smaller ones with barrel exports.
227. Build a tiny module loader that resolves dependencies in topological order.

---

## 18. Regex

228. Validate an email address with regex.
229. Validate a phone number (various formats).
230. Validate a strong password (uppercase, lowercase, digit, special char, min length).
231. Extract all URLs from a block of text.
232. Extract all hashtags from a tweet.
233. Replace multiple spaces with a single space.
234. Match a date in `YYYY-MM-DD` format and extract parts via capture groups.
235. Split a camelCase string into separate words.
236. Mask all but the last 4 digits of a credit card number.
237. Find all duplicate words in a string using regex.
238. Convert a string to a URL-safe slug using regex.
239. Validate an IPv4 address.

---

## 19. JSON

240. Implement a simplified `JSON.stringify` (handle primitives, arrays, objects, nulls).
241. Implement a simplified `JSON.parse`.
242. Handle circular references when serializing an object.
243. Pretty-print JSON with custom indentation.
244. Convert a JSON string to CSV.
245. Convert CSV to JSON.
246. Deep-filter a JSON object by a schema.
247. Diff two JSON objects and produce a patch.
248. Apply a JSON patch to an object.
249. Sort keys alphabetically in a nested JSON.

---

## 20. Map, Set, WeakMap, WeakSet

250. Remove duplicate objects from an array using a `Set`.
251. Count word frequency using a `Map`.
252. Build a cache with TTL expiration using a `Map`.
253. Use a `WeakMap` to attach metadata to DOM nodes without leaking memory.
254. Implement a `Set` polyfill using an object.
255. Implement a `Map` polyfill using an array of entries.
256. Find the intersection of two Sets.
257. Find the union of two Sets.
258. Find the symmetric difference of two Sets.
259. Demonstrate why `WeakMap` keys must be objects.
260. Build an LRU cache using `Map`.
261. Build an LFU (least-frequently-used) cache.

---

## 21. Functional Programming

262. Implement `pipe` and `compose`.
263. Make a function pure by removing side effects.
264. Curry any multi-argument function.
265. Implement partial application.
266. Implement a `tap(fn)` that executes side effect and returns value unchanged.
267. Chain array transformations using functional style.
268. Implement a lazy evaluation helper using generators.
269. Implement immutable `update(obj, path, value)`.
270. Implement a small Lens helper that gets/sets nested values.
271. Write a reducer that handles multiple action types.
272. Implement `zip`, `unzip`, `partition`, `chunk`, `uniqBy`.

---

## 22. Recursion

273. Compute factorial recursively.
274. Compute nth Fibonacci recursively (with and without memoization).
275. Flatten a deeply nested array recursively.
276. Count the total number of leaves in a nested object tree.
277. Convert a nested object into dot-notation keys recursively.
278. Find all files in a directory structure represented as an object.
279. Generate all subsets of an array.
280. Generate all permutations of an array.
281. Solve the Tower of Hanoi problem.
282. Count the number of ways to climb N stairs (1 or 2 at a time).
283. Compute the power of a number recursively in O(log n).
284. Convert recursion to iteration using an explicit stack.
285. Solve N-queens using backtracking.
286. Generate all valid parentheses combinations of N pairs.
287. Word break problem: given a string and dictionary, can string be segmented?

---

## 23. Currying & Partial Application

288. Implement `curry(fn)` for a fixed-arity function.
289. Implement infinite currying: `sum(1)(2)(3)(4)()`.
290. Implement currying with placeholders (`_` for skipped args).
291. Implement `partial(fn, ...args)` that returns a partially applied function.
292. Curry an async function.
293. Build a fluent API using currying.

---

## 24. Debounce, Throttle & Rate Limiting

294. Implement `debounce(fn, delay)`.
295. Implement `debounce` with a `leading` option (fire on first call).
296. Implement `debounce` with both `leading` and `trailing` options.
297. Implement `debounce` that returns a promise resolving with the final result.
298. Implement `throttle(fn, limit)`.
299. Implement `throttle` with `leading` and `trailing` options.
300. Implement a token-bucket rate limiter.
301. Implement a sliding-window rate limiter.
302. Implement a debounce with a cancel method.
303. Implement a throttle with a flush method.

---

## 25. Memoization & Caching

304. Implement `memoize(fn)` with a basic key serializer.
305. Implement `memoize` with a custom cache key function.
306. Implement `memoize` with TTL (cache entries expire after N ms).
307. Implement `memoize` with max size (LRU eviction).
308. Memoize an async function (cache the promise, not the resolved value twice).
309. Memoize a recursive function without breaking recursion.
310. Implement a two-level cache: in-memory + localStorage fallback.

---

## 26. Polyfills

311. `Array.prototype.map`
312. `Array.prototype.filter`
313. `Array.prototype.reduce`
314. `Array.prototype.forEach`
315. `Array.prototype.find`
316. `Array.prototype.findIndex`
317. `Array.prototype.includes`
318. `Array.prototype.flat`
319. `Array.prototype.flatMap`
320. `Array.from`
321. `Array.of`
322. `Function.prototype.bind`
323. `Function.prototype.call`
324. `Function.prototype.apply`
325. `Object.assign`
326. `Object.create`
327. `Object.freeze` (shallow)
328. `Object.entries`, `Object.keys`, `Object.values`
329. `Object.fromEntries`
330. `Promise.all`
331. `Promise.allSettled`
332. `Promise.race`
333. `Promise.any`
334. `String.prototype.padStart` / `padEnd`
335. `String.prototype.repeat`
336. `Number.isInteger`
337. `Number.isFinite`
338. `Array.prototype.at` (negative index support)

---

## 27. DOM & Events

339. Create and append a DOM element with attributes and text.
340. Remove all children of a DOM node.
341. Implement event delegation — attach one listener to a parent for many children.
342. Write a helper that adds and removes multiple event listeners in one call.
343. Implement a simple drag-and-drop interaction.
344. Build an infinite scroll using `IntersectionObserver`.
345. Build a lazy image loader using `IntersectionObserver`.
346. Detect clicks outside a specific element.
347. Implement a tooltip that follows the mouse.
348. Implement a modal that closes on Escape key and outside click.
349. Build a keyboard shortcut system (`Ctrl+K` to open, etc.).
350. Implement form validation on submit without a library.
351. Build a custom dropdown with keyboard navigation.
352. Debounce an input's keystroke events.
353. Throttle the window scroll event.
354. Implement copy-to-clipboard.
355. Build a small virtual scroller (render only visible rows).
356. Capture vs bubble: attach listeners at both phases and observe order.
357. Prevent default and stop propagation — demonstrate both.
358. Build a custom event using `CustomEvent` and dispatch it.

---

## 28. Browser APIs & Storage

359. Read and write to `localStorage` with JSON.
360. Build a wrapper around `localStorage` that supports TTL.
361. Store a JSON object in a cookie (keeping within size limits).
362. Read and clear cookies from JS.
363. Use `sessionStorage` to persist a form across reloads within a tab.
364. Use `IndexedDB` to store and retrieve objects.
365. Use the Fetch API with timeout via `AbortController`.
366. Download a file from the browser using `Blob` and `URL.createObjectURL`.
367. Upload a file using `FormData` and Fetch.
368. Read a local file as text using `FileReader`.
369. Implement offline detection with `navigator.onLine` and events.
370. Use the Clipboard API to read and write text.
371. Use the Geolocation API to get the user's coordinates.
372. Build a countdown timer using `requestAnimationFrame`.
373. Throttle updates to the DOM using `requestAnimationFrame`.
374. Use `matchMedia` to react to breakpoint changes in JS.
375. Use `MutationObserver` to react to DOM changes.
376. Use `ResizeObserver` to react to element size changes.
377. Use `performance.now()` to benchmark a function.
378. Build a simple service worker that caches static assets.

---

## 29. Data Structures

379. Implement a singly linked list.
380. Implement a doubly linked list.
381. Implement a circular linked list.
382. Reverse a linked list iteratively and recursively.
383. Detect a cycle in a linked list (Floyd's algorithm).
384. Find the middle node of a linked list in one pass.
385. Merge two sorted linked lists.
386. Implement a stack using an array.
387. Implement a stack using two queues.
388. Implement a queue using two stacks.
389. Implement a min stack — retrieves min in O(1).
390. Implement a circular queue (ring buffer).
391. Implement a priority queue using a heap.
392. Implement a min-heap and max-heap.
393. Implement a binary search tree with insert, search, delete, in-order traversal.
394. Check if a binary tree is a valid BST.
395. Find the lowest common ancestor of two nodes in a BST.
396. Invert a binary tree.
397. Compute the depth of a binary tree (recursive and BFS).
398. Serialize and deserialize a binary tree.
399. Implement a Trie with insert, search, and prefix search.
400. Implement a graph with adjacency list and do BFS + DFS.
401. Detect a cycle in a directed graph.
402. Topological sort of a DAG.
403. Implement Dijkstra's shortest path algorithm.
404. Implement an LRU cache in O(1) using a doubly linked list + map.
405. Implement a disjoint set (union-find) with path compression.
406. Implement a circular buffer of fixed size.
407. Implement a Bloom filter.

---

## 30. Algorithms

408. Bubble sort, selection sort, insertion sort.
409. Merge sort.
410. Quick sort (in-place).
411. Heap sort.
412. Counting sort / radix sort.
413. Binary search — iterative and recursive.
414. Search in a rotated sorted array.
415. Find the Kth largest element.
416. Find the median of two sorted arrays.
417. Sliding window maximum.
418. Longest palindromic substring.
419. Edit distance between two strings.
420. Longest common subsequence.
421. 0/1 knapsack problem.
422. Coin change problem.
423. House robber problem.
424. Maximum rectangle in a histogram.
425. Trapping rain water.
426. Reverse bits of an integer.
427. Count set bits in an integer.
428. Implement a rate-limited API client.
429. Implement a pagination helper that fetches all pages.
430. Implement a task scheduler with dependencies.

---

## 31. Design Patterns

431. Singleton pattern.
432. Factory pattern.
433. Observer pattern (pub/sub).
434. Module pattern with IIFE.
435. Revealing module pattern.
436. Decorator pattern.
437. Proxy pattern using `Proxy` API.
438. Mediator pattern.
439. Command pattern with undo/redo.
440. State pattern for a traffic light.
441. Strategy pattern for sorting.
442. Chain of responsibility for middleware.
443. Build a simple middleware pipeline (like Express).
444. Build a simple state store (like Redux) with reducers and subscribers.
445. Build a reactivity system (like Vue refs and computed).
446. Build a small dependency injection container.

---

## 32. Output-Based Tricky Questions

447. Predict output: `console.log(0.1 + 0.2 === 0.3)`.
448. Predict output: `[] == false`, `[] == ![]`, `null == undefined`.
449. Predict output: `typeof typeof undefined`.
450. Predict output when a `for` loop uses `var` and logs in `setTimeout`.
451. Predict output when the same code uses `let`.
452. Predict output of chained `.then` vs async/await with timing.
453. Predict output of mixed microtasks and macrotasks.
454. Predict output when `this` is used in an object method vs arrow function.
455. Predict output of `console.log(1 + "2" + 3)` vs `console.log(1 + 2 + "3")`.
456. Predict output of IIFE with `var` and a timeout.
457. Predict output of destructuring with defaults and `null`/`undefined`.
458. Predict output of `Promise.resolve().then(() => console.log(1)).then(() => console.log(2))`.
459. Predict output of a hoisted function vs a hoisted variable with the same name.
460. Predict output of `const arr = [1, 2, 3]; arr.length = 0;` — what happens?
461. Predict output of mutating a `const` object.
462. Predict output of `JSON.stringify({ a: undefined, b: () => {}, c: Symbol() })`.
463. Predict output of `NaN === NaN`, `[1] == [1]`, `"5" - - "2"`.
464. Predict output of setting a property on a frozen object.
465. Predict output of spreading an iterable vs destructuring it.
466. Predict output of a generator yielding before awaiting a promise.

---

## How to Practice

- **Set a timer.** 15–25 minutes per question. If stuck, note the concept and move on.
- **Write code, don't just read.** Typing it out builds muscle memory.
- **Test edge cases.** Empty arrays, `null`, `undefined`, `NaN`, negative numbers, huge inputs.
- **Explain out loud.** If you can't explain the solution, you don't own it yet.
- **Revisit the same question a week later.** Spaced repetition beats cramming.

Good luck. Pick a category, knock out 5 a day, and you'll cover everything in ~3 months.
