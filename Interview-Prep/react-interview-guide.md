# React Interview Guide: 50 Questions + 30 Coding Problems

> A complete preparation guide covering every major React topic — from fundamentals to advanced patterns, performance, testing, and real-world coding challenges.

---

## Part 1: 50 React Interview Questions

---

### Fundamentals (Q1–Q10)

**Q1. What is React, and why would you choose it over vanilla JavaScript?**

React is a declarative, component-based JavaScript library for building user interfaces. You'd choose it because:

- **Declarative UI** — you describe *what* the UI should look like, not *how* to update the DOM
- **Component reusability** — build once, use everywhere
- **Virtual DOM** — efficient diffing algorithm minimizes expensive real DOM operations
- **Massive ecosystem** — React Router, Redux, Next.js, thousands of community libraries
- **One-way data flow** — predictable state management makes debugging easier

```jsx
// Vanilla JS — imperative
document.getElementById("count").innerText = count;

// React — declarative
function Counter() {
  const [count, setCount] = useState(0);
  return <p>{count}</p>; // React handles the DOM update
}
```

---

**Q2. What is JSX, and how does it differ from HTML?**

JSX is a syntax extension that lets you write HTML-like code inside JavaScript. It gets compiled to `React.createElement()` calls by Babel.

Key differences from HTML:

| HTML | JSX |
|------|-----|
| `class="btn"` | `className="btn"` |
| `for="email"` | `htmlFor="email"` |
| `onclick="fn()"` | `onClick={fn}` |
| `style="color: red"` | `style={{ color: 'red' }}` |
| Self-closing optional | Self-closing required: `<img />` |
| Can return multiple roots | Must return a single root (or use Fragments) |

```jsx
// JSX
const element = <h1 className="title">Hello, {name}!</h1>;

// Compiles to
const element = React.createElement('h1', { className: 'title' }, `Hello, ${name}!`);
```

---

**Q3. What are components in React? Explain functional vs class components.**

Components are independent, reusable pieces of UI. They accept inputs (props) and return React elements.

```jsx
// Functional Component (modern, preferred)
function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>;
}

// Class Component (legacy, still supported)
class Greeting extends React.Component {
  render() {
    return <h1>Hello, {this.props.name}!</h1>;
  }
}
```

| Feature | Functional | Class |
|---------|-----------|-------|
| State | `useState` hook | `this.state` |
| Lifecycle | `useEffect` hook | `componentDidMount`, etc. |
| Performance | Slightly lighter | Heavier due to `this` binding |
| Readability | Simpler, less boilerplate | More verbose |
| Current status | Recommended | Legacy, still works |

---

**Q4. What are props? How do they differ from state?**

**Props** (properties) are read-only inputs passed from parent to child. **State** is mutable data managed internally by a component.

| | Props | State |
|--|-------|-------|
| Owned by | Parent component | The component itself |
| Mutable? | No (read-only) | Yes (`setState` / `useState`) |
| Triggers re-render? | When parent re-renders with new props | When updated via setter |
| Direction | Top-down (parent → child) | Internal |

```jsx
function Parent() {
  const [score, setScore] = useState(0);
  // score is STATE in Parent, but a PROP in Child
  return <Child score={score} onIncrement={() => setScore(s => s + 1)} />;
}

function Child({ score, onIncrement }) {
  return <button onClick={onIncrement}>Score: {score}</button>;
}
```

---

**Q5. What is the Virtual DOM, and how does React's reconciliation work?**

The Virtual DOM is a lightweight JavaScript representation of the real DOM. When state changes:

1. React creates a **new Virtual DOM tree**
2. It **diffs** the new tree against the previous one (reconciliation)
3. It computes the **minimum set of changes** needed
4. It **batches** and applies those changes to the real DOM

**Reconciliation rules:**
- Elements of **different types** → tear down old tree, build new one
- Elements of **same type** → update attributes, recurse on children
- **Keys** help React identify which items in a list changed, were added, or removed

```jsx
// Without key — React re-renders all items on reorder
{items.map(item => <li>{item.name}</li>)}

// With key — React tracks each item efficiently
{items.map(item => <li key={item.id}>{item.name}</li>)}
```

---

**Q6. What is the difference between controlled and uncontrolled components?**

**Controlled** — React state is the single source of truth. Every change goes through a handler.

```jsx
function ControlledInput() {
  const [value, setValue] = useState('');
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
```

**Uncontrolled** — The DOM itself holds the state. You read values via refs.

```jsx
function UncontrolledInput() {
  const inputRef = useRef(null);
  const handleSubmit = () => {
    console.log(inputRef.current.value);
  };
  return <input ref={inputRef} defaultValue="hello" />;
}
```

| | Controlled | Uncontrolled |
|--|-----------|-------------|
| Source of truth | React state | DOM |
| Validation | On every keystroke | On submit |
| Dynamic behavior | Easy (disable button, format input) | Harder |
| Use case | Forms with validation, dynamic UIs | Simple forms, file inputs |

---

**Q7. What are React Fragments, and why are they useful?**

Fragments let you group multiple elements without adding extra DOM nodes.

```jsx
// Problem: unnecessary <div> wrapper
function Table() {
  return (
    <div> {/* This breaks <table> semantics */}
      <td>Name</td>
      <td>Age</td>
    </div>
  );
}

// Solution: Fragment
function Table() {
  return (
    <React.Fragment>
      <td>Name</td>
      <td>Age</td>
    </React.Fragment>
  );
}

// Short syntax
function Table() {
  return (
    <>
      <td>Name</td>
      <td>Age</td>
    </>
  );
}
```

Use `<React.Fragment key={id}>` when you need keys (short syntax doesn't support keys).

---

**Q8. What is conditional rendering in React?**

React has no special directive like `v-if`. You use JavaScript expressions:

```jsx
function Dashboard({ isLoggedIn, isAdmin, notifications }) {
  return (
    <div>
      {/* Ternary — choose between two elements */}
      {isLoggedIn ? <UserPanel /> : <LoginButton />}

      {/* Logical AND — render or nothing */}
      {isAdmin && <AdminControls />}

      {/* IIFE or variable for complex logic */}
      {(() => {
        if (notifications.length === 0) return <p>No notifications</p>;
        if (notifications.length < 5) return <NotificationList items={notifications} />;
        return <NotificationSummary count={notifications.length} />;
      })()}

      {/* Early return pattern */}
    </div>
  );
}

// Early return
function ProtectedPage({ user }) {
  if (!user) return <Navigate to="/login" />;
  return <SecretContent />;
}
```

> **Gotcha:** `{count && <Badge />}` renders `0` on screen when count is 0. Use `{count > 0 && <Badge />}` instead.

---

**Q9. How does event handling work in React?**

React uses **SyntheticEvents** — a cross-browser wrapper around native events. Key differences from vanilla JS:

```jsx
function Form() {
  // 1. camelCase event names
  // 2. Pass function reference, not string
  const handleSubmit = (e) => {
    e.preventDefault(); // Works like native
    e.stopPropagation();
    console.log(e.nativeEvent); // Access underlying native event
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 3. Passing arguments */}
      <button onClick={(e) => handleClick(id, e)}>Delete</button>

      {/* 4. Event pooling (React < 17) — e is nullified after callback */}
      {/* In React 17+, pooling is removed */}
    </form>
  );
}
```

**Event Delegation:** React attaches a single event listener at the root (React 17+: on the root DOM container, not `document`), not on individual elements.

---

**Q10. What are keys in React, and why are they important?**

Keys help React identify which items in a list have changed, been added, or removed.

```jsx
// BAD — using index as key
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}
// Problems: reordering, inserting at beginning breaks state

// GOOD — using stable unique identifier
{items.map((item) => (
  <ListItem key={item.id} data={item} />
))}
```

**Rules:**
- Keys must be **unique among siblings** (not globally)
- Keys must be **stable** across re-renders
- Don't use `Math.random()` — creates new key every render
- Index is okay **only** if the list is static and never reordered

---

### Hooks (Q11–Q20)

**Q11. What are React Hooks, and what rules must you follow?**

Hooks are functions that let you use React features (state, lifecycle, context) in functional components.

**Rules of Hooks:**
1. **Only call at the top level** — not inside loops, conditions, or nested functions
2. **Only call from React functions** — functional components or custom hooks

```jsx
// WRONG
function Component({ show }) {
  if (show) {
    const [value, setValue] = useState(''); // Conditional hook call!
  }
}

// RIGHT
function Component({ show }) {
  const [value, setValue] = useState('');
  if (!show) return null;
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

**Why?** React relies on the **call order** of hooks to associate state with the correct hook. Conditional calls break this mapping.

---

**Q12. Explain `useState` in depth. How does it handle objects and arrays?**

`useState` declares a state variable. The setter triggers a re-render.

```jsx
function Example() {
  // Primitive
  const [count, setCount] = useState(0);

  // Functional update — when new state depends on previous
  const increment = () => setCount(prev => prev + 1);

  // Object — must spread to create new reference
  const [user, setUser] = useState({ name: 'Alice', age: 25 });
  const updateName = (name) => setUser(prev => ({ ...prev, name }));

  // Array — same principle
  const [items, setItems] = useState([]);
  const addItem = (item) => setItems(prev => [...prev, item]);
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id, data) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));

  // Lazy initialization — expensive computation runs only on first render
  const [data, setData] = useState(() => {
    return JSON.parse(localStorage.getItem('data')) || [];
  });

  return <div>{count}</div>;
}
```

> **Key point:** `setState` doesn't merge like `this.setState` in class components. You must spread manually.

---

**Q13. Explain `useEffect` — lifecycle mapping, cleanup, and common pitfalls.**

`useEffect` runs side effects after render. It replaces `componentDidMount`, `componentDidUpdate`, and `componentWillUnmount`.

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  // componentDidMount + componentDidUpdate(userId)
  useEffect(() => {
    let cancelled = false; // cleanup flag to avoid state update on unmounted component

    async function fetchUser() {
      const res = await fetch(`/api/users/${userId}`);
      const data = await res.json();
      if (!cancelled) setUser(data);
    }
    fetchUser();

    // componentWillUnmount (or before re-run)
    return () => {
      cancelled = true;
    };
  }, [userId]); // dependency array

  return <div>{user?.name}</div>;
}
```

**Dependency array behaviors:**
| Dependency | When it runs |
|-----------|-------------|
| `useEffect(fn)` | After every render |
| `useEffect(fn, [])` | Once after mount |
| `useEffect(fn, [a, b])` | When `a` or `b` changes |

**Common pitfalls:**
- Missing dependencies → stale closures
- Object/array in deps → infinite loop (reference changes each render)
- Fetching without cleanup → race conditions

---

**Q14. What is `useRef`, and when should you use it?**

`useRef` returns a mutable object `{ current: value }` that persists across renders **without causing re-renders** when changed.

```jsx
function StopWatch() {
  const [time, setTime] = useState(0);
  const intervalRef = useRef(null); // persists across renders

  const start = () => {
    intervalRef.current = setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  };

  const stop = () => clearInterval(intervalRef.current);

  return (
    <>
      <p>{time}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </>
  );
}

// DOM access
function AutoFocusInput() {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current.focus();
  }, []);
  return <input ref={inputRef} />;
}

// Storing previous value
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
```

**Use cases:** DOM access, storing interval/timeout IDs, previous values, any mutable value that shouldn't trigger re-render.

---

**Q15. Explain `useMemo` and `useCallback`. When should you (and shouldn't you) use them?**

Both are memoization hooks that cache values between renders.

```jsx
function ProductList({ products, taxRate }) {
  // useMemo — memoize a computed VALUE
  const total = useMemo(() => {
    return products.reduce((sum, p) => sum + p.price * (1 + taxRate), 0);
  }, [products, taxRate]);

  // useCallback — memoize a FUNCTION reference
  const handleSort = useCallback((field) => {
    // sort logic
  }, []);

  return (
    <div>
      <p>Total: ${total.toFixed(2)}</p>
      <SortButton onSort={handleSort} /> {/* Won't re-render if parent does */}
    </div>
  );
}
```

**When to use:**
- `useMemo` — expensive computations, referential equality for deps
- `useCallback` — passing callbacks to memoized children (`React.memo`)

**When NOT to use:**
- Simple calculations (overhead of memoization > recalculation)
- Values that change every render anyway
- "Just in case" — premature optimization adds complexity

---

**Q16. What is `useReducer`, and when should you prefer it over `useState`?**

`useReducer` is an alternative to `useState` for complex state logic, inspired by Redux.

```jsx
const initialState = { count: 0, step: 1 };

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + state.step };
    case 'decrement':
      return { ...state, count: state.count - state.step };
    case 'setStep':
      return { ...state, step: action.payload };
    case 'reset':
      return initialState;
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <input
        type="number"
        value={state.step}
        onChange={e => dispatch({ type: 'setStep', payload: +e.target.value })}
      />
    </div>
  );
}
```

**Prefer `useReducer` when:**
- State has multiple sub-values
- Next state depends on previous state
- Multiple actions modify state in related ways
- You want to pass `dispatch` down instead of many callbacks

---

**Q17. What is `useContext`? How do you avoid unnecessary re-renders?**

`useContext` subscribes to a React Context, allowing data to skip intermediate components.

```jsx
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('light');
  // Memoize the value to prevent unnecessary re-renders
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <Page />
    </ThemeContext.Provider>
  );
}

function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button
      className={theme}
      onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
    >
      Toggle Theme
    </button>
  );
}
```

**Avoiding re-renders:**
1. **Split contexts** — separate frequently changing state from stable state
2. **Memoize provider value** — `useMemo` on the value object
3. **Wrap consumers in `React.memo`** — prevent re-render if their own props haven't changed
4. **Use selector pattern** — libraries like `use-context-selector` let you subscribe to specific fields

---

**Q18. What are custom hooks? Give a practical example.**

Custom hooks are functions that start with `use` and compose built-in hooks to encapsulate reusable logic.

```jsx
// Custom hook for API fetching
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    return () => controller.abort();
  }, [url]);

  return { data, loading, error };
}

// Usage
function UserList() {
  const { data: users, loading, error } = useFetch('/api/users');

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

**Benefits:** Separation of concerns, testable logic, shareable across components.

---

**Q19. Explain `useLayoutEffect` vs `useEffect`.**

Both run after render, but at different times:

| | `useEffect` | `useLayoutEffect` |
|--|------------|-------------------|
| Timing | After paint (asynchronous) | Before paint (synchronous) |
| Blocks paint? | No | Yes |
| Use case | Data fetching, subscriptions, logging | DOM measurements, preventing visual flicker |

```jsx
function Tooltip({ targetRef, children }) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // useLayoutEffect prevents the tooltip from flashing at (0,0) then jumping
  useLayoutEffect(() => {
    const rect = targetRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }, [targetRef]);

  return (
    <div ref={tooltipRef} style={{ position: 'fixed', ...position }}>
      {children}
    </div>
  );
}
```

**Rule of thumb:** Use `useEffect` by default. Switch to `useLayoutEffect` only if you see visual flicker due to DOM measurements.

---

**Q20. What is `useId`, and when do you need it?**

`useId` (React 18+) generates a unique, stable ID that is consistent between server and client rendering.

```jsx
function FormField({ label }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} />
    </div>
  );
}

// Multiple IDs from one hook
function PasswordField() {
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-password`}>Password</label>
      <input id={`${id}-password`} type="password" />
      <label htmlFor={`${id}-confirm`}>Confirm</label>
      <input id={`${id}-confirm`} type="password" />
    </>
  );
}
```

**Why not just use `Math.random()`?** It causes hydration mismatches in SSR. `useId` produces deterministic IDs that match on server and client.

---

### State Management (Q21–Q26)

**Q21. What is prop drilling, and what are the solutions?**

Prop drilling is passing props through intermediate components that don't use them, just to reach a deeply nested child.

```
App → Layout → Sidebar → UserMenu → Avatar (needs user data)
```

**Solutions:**

1. **Context API** — built-in, good for low-frequency updates (theme, auth, locale)
2. **Component composition** — restructure to pass components, not data
3. **State management libraries** — Redux, Zustand, Jotai for complex state
4. **Custom hooks** — extract shared logic

```jsx
// Composition — instead of drilling user through Layout and Sidebar
function App() {
  const user = useUser();
  return (
    <Layout
      sidebar={<Sidebar userMenu={<UserMenu avatar={<Avatar user={user} />} />} />}
    />
  );
}
```

---

**Q22. Explain the Context API in depth. What are its limitations?**

Context provides a way to share values between components without prop drilling.

```jsx
// 1. Create
const AuthContext = createContext(null);

// 2. Provide
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const login = async (credentials) => { /* ... */ };
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Consume with custom hook
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// 4. Use anywhere
function NavBar() {
  const { user, logout } = useAuth();
  return user ? <button onClick={logout}>Logout</button> : <LoginLink />;
}
```

**Limitations:**
- **Any consumer re-renders when the value changes** — even if it only uses part of the value
- Not ideal for high-frequency updates (e.g., mouse position)
- No built-in selector pattern (unlike Redux or Zustand)
- Can lead to deeply nested providers ("Provider Hell")

---

**Q23. How does Redux work? Explain the data flow.**

Redux follows a strict unidirectional data flow:

```
UI → dispatch(action) → reducer(state, action) → new state → UI re-renders
```

```jsx
// 1. Define a slice (Redux Toolkit)
import { createSlice, configureStore } from '@reduxjs/toolkit';

const todosSlice = createSlice({
  name: 'todos',
  initialState: [],
  reducers: {
    addTodo: (state, action) => {
      state.push({ id: Date.now(), text: action.payload, done: false });
      // Immer handles immutability under the hood
    },
    toggleTodo: (state, action) => {
      const todo = state.find(t => t.id === action.payload);
      if (todo) todo.done = !todo.done;
    },
  },
});

// 2. Configure store
const store = configureStore({
  reducer: { todos: todosSlice.reducer },
});

// 3. Use in component
function TodoList() {
  const todos = useSelector(state => state.todos);
  const dispatch = useDispatch();

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} onClick={() => dispatch(toggleTodo(todo.id))}>
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

**Core principles:** Single source of truth, state is read-only, changes via pure functions.

---

**Q24. Compare Redux, Zustand, and Jotai. When would you pick each?**

| Feature | Redux | Zustand | Jotai |
|---------|-------|---------|-------|
| Philosophy | Centralized store, actions, reducers | Simplified flux | Atomic state |
| Boilerplate | Medium (with RTK) | Very low | Very low |
| DevTools | Excellent | Good | Good |
| Bundle size | ~11KB (RTK) | ~1KB | ~3KB |
| Learning curve | Steeper | Gentle | Gentle |
| Middleware | Built-in (thunk, saga) | Lightweight | None needed |
| SSR support | Good | Good | Excellent |

**Pick Redux** when: Large team, complex business logic, need middleware, want strict patterns.

**Pick Zustand** when: Need global state without boilerplate, small-to-medium app, want simplicity.

**Pick Jotai** when: Fine-grained reactivity, bottom-up state, lots of independent atoms, minimal re-renders.

```jsx
// Zustand — entire store in 5 lines
const useStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

// Jotai — atomic state
const countAtom = atom(0);
const doubleAtom = atom((get) => get(countAtom) * 2); // derived

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

**Q25. What is React Query (TanStack Query), and how does it manage server state?**

React Query separates **server state** (data from APIs) from **client state** (UI state like modals, form inputs).

```jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function UserList() {
  // Fetching with caching, refetching, loading/error states
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // cached for 5 minutes
  });

  const queryClient = useQueryClient();

  // Mutations with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] }); // refetch
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {user.name}
          <button onClick={() => deleteMutation.mutate(user.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

**Key features:** Automatic caching, background refetching, pagination, infinite scroll, optimistic updates, request deduplication.

---

**Q26. How would you manage form state in React? Compare approaches.**

| Approach | Best for | Trade-off |
|----------|---------|-----------|
| `useState` | Simple forms (1-3 fields) | Verbose for large forms |
| `useReducer` | Complex forms with validation | More setup |
| React Hook Form | Performance-critical forms | External dependency |
| Formik | Feature-rich forms | Larger bundle |

```jsx
// React Hook Form — minimal re-renders
import { useForm } from 'react-hook-form';

function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    await api.signup(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
        })}
      />
      {errors.email && <span>{errors.email.message}</span>}

      <input
        {...register('password', { required: true, minLength: 8 })}
        type="password"
      />
      {errors.password && <span>Min 8 characters</span>}

      <button disabled={isSubmitting}>Sign Up</button>
    </form>
  );
}
```

---

### Component Patterns (Q27–Q32)

**Q27. What is component composition, and why is it preferred over inheritance?**

React favors **composition** (combining components) over inheritance (extending classes).

```jsx
// Composition via children
function Card({ children }) {
  return <div className="card">{children}</div>;
}

function UserCard({ user }) {
  return (
    <Card>
      <Avatar src={user.avatar} />
      <h2>{user.name}</h2>
    </Card>
  );
}

// Composition via slots (named children)
function Layout({ header, sidebar, children }) {
  return (
    <div className="layout">
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{children}</main>
    </div>
  );
}

// Specialization
function WarningDialog({ message }) {
  return <Dialog title="Warning" icon="⚠" message={message} variant="warning" />;
}
```

**Why not inheritance?** React components don't benefit from deep class hierarchies. Composition is more flexible, easier to understand, and avoids tight coupling.

---

**Q28. What are Higher-Order Components (HOCs)? Are they still relevant?**

An HOC is a function that takes a component and returns a new enhanced component.

```jsx
function withAuth(WrappedComponent) {
  return function AuthenticatedComponent(props) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    return <WrappedComponent {...props} user={user} />;
  };
}

const ProtectedDashboard = withAuth(Dashboard);
```

**Status:** HOCs are largely replaced by custom hooks, which are simpler and don't create wrapper nesting. Still seen in legacy code and some libraries.

| HOC Issues | Hook Solution |
|-----------|--------------|
| Wrapper hell | No nesting |
| Props collision | Named returns |
| Hard to type (TypeScript) | Easier to type |
| Static composition | Dynamic composition |

---

**Q29. What is the render props pattern?**

A component that takes a function as children (or a prop) to share logic.

```jsx
function MouseTracker({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return children(position);
}

// Usage
function App() {
  return (
    <MouseTracker>
      {({ x, y }) => <p>Mouse: {x}, {y}</p>}
    </MouseTracker>
  );
}
```

**Modern equivalent with hooks:**
```jsx
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => { /* same logic */ }, []);
  return position;
}
```

---

**Q30. What are Compound Components? Give an example.**

Compound components are a set of components that work together implicitly, sharing state through context.

```jsx
const TabsContext = createContext();

function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function TabList({ children }) {
  return <div className="tab-list" role="tablist">{children}</div>;
}

function Tab({ value, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return (
    <button
      role="tab"
      aria-selected={activeTab === value}
      className={activeTab === value ? 'active' : ''}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

function TabPanel({ value, children }) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;
  return <div role="tabpanel">{children}</div>;
}

// Clean, expressive API
function App() {
  return (
    <Tabs defaultTab="posts">
      <TabList>
        <Tab value="posts">Posts</Tab>
        <Tab value="comments">Comments</Tab>
        <Tab value="likes">Likes</Tab>
      </TabList>
      <TabPanel value="posts"><PostList /></TabPanel>
      <TabPanel value="comments"><CommentList /></TabPanel>
      <TabPanel value="likes"><LikeList /></TabPanel>
    </Tabs>
  );
}
```

---

**Q31. What are Error Boundaries? How do you handle errors in React?**

Error Boundaries catch JavaScript errors in their child component tree and display a fallback UI.

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

// Usage — wrap at strategic boundaries
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Header />
      <ErrorBoundary fallback={<SidebarFallback />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<ContentFallback />}>
        <MainContent />
      </ErrorBoundary>
    </ErrorBoundary>
  );
}
```

**Limitations:**
- Must be class components (no hook equivalent yet)
- Don't catch: event handlers, async code, SSR, errors in the boundary itself
- For event handlers, use try/catch

---

**Q32. What is `React.memo`, and how does it prevent unnecessary re-renders?**

`React.memo` is a higher-order component that skips re-rendering when props haven't changed (shallow comparison).

```jsx
const ExpensiveList = React.memo(function ExpensiveList({ items, onItemClick }) {
  console.log('ExpensiveList rendered');
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

// Custom comparison
const UserCard = React.memo(
  function UserCard({ user, theme }) {
    return <div className={theme}>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // Return true to SKIP re-render
    return prevProps.user.id === nextProps.user.id &&
           prevProps.theme === nextProps.theme;
  }
);

// Common mistake — new function reference on every render defeats memo
function Parent() {
  const [count, setCount] = useState(0);

  // BAD — new function every render
  // <ExpensiveList onItemClick={(id) => handleClick(id)} />

  // GOOD — stable reference
  const handleClick = useCallback((id) => {
    // handle click
  }, []);

  return <ExpensiveList items={items} onItemClick={handleClick} />;
}
```

---

### Routing (Q33–Q35)

**Q33. How does client-side routing work in React? Explain React Router.**

Client-side routing changes the URL and renders different components without a full page reload. React Router intercepts navigation and matches URLs to components.

```jsx
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Outlet } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/users">Users</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/users" element={<UsersLayout />}>
          <Route index element={<UserList />} />
          <Route path=":userId" element={<UserDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function UsersLayout() {
  return (
    <div>
      <h1>Users</h1>
      <Outlet /> {/* Renders child route */}
    </div>
  );
}

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  return (
    <div>
      <p>User ID: {userId}</p>
      <button onClick={() => navigate('/users')}>Back</button>
    </div>
  );
}
```

---

**Q34. How do you implement protected/private routes?**

```jsx
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RoleRoute({ children, requiredRole }) {
  const { user } = useAuth();
  if (!user.roles.includes(requiredRole)) return <Navigate to="/unauthorized" />;
  return children;
}

// Usage
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />
  <Route path="/admin" element={
    <ProtectedRoute>
      <RoleRoute requiredRole="admin">
        <AdminPanel />
      </RoleRoute>
    </ProtectedRoute>
  } />
</Routes>
```

---

**Q35. How do you implement code splitting with React Router?**

```jsx
import { lazy, Suspense } from 'react';

// Lazy-loaded route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} /> {/* Eagerly loaded */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

Each lazy route produces a separate bundle chunk that is loaded only when the user navigates to that route.

---

### Performance (Q36–Q40)

**Q36. What are the most common causes of performance issues in React?**

1. **Unnecessary re-renders** — parent re-renders cause all children to re-render
2. **Large lists without virtualization** — rendering 10,000 DOM nodes
3. **Expensive computations in render** — filtering/sorting on every render
4. **Missing keys or index keys** — causes full list re-render on reorder
5. **Inline objects/functions in JSX** — new reference every render
6. **Unoptimized context** — single context with many values triggers all consumers
7. **Large bundle size** — no code splitting or tree shaking

**Quick wins:**
```jsx
// 1. Memoize expensive children
const MemoChild = React.memo(Child);

// 2. Virtualize long lists
<FixedSizeList height={400} width={300} itemCount={10000} itemSize={35}>
  {({ index, style }) => <div style={style}>{items[index].name}</div>}
</FixedSizeList>

// 3. Memoize expensive computations
const sorted = useMemo(() => items.sort(compareFn), [items]);

// 4. Debounce search input
const debouncedSearch = useMemo(() => debounce(search, 300), []);
```

---

**Q37. What is React.lazy and Suspense? How do they enable code splitting?**

`React.lazy` lets you dynamically import components. `Suspense` shows a fallback while they load.

```jsx
// Without code splitting — everything in one bundle
import HeavyChart from './HeavyChart'; // 500KB library

// With code splitting — loaded on demand
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

**Nested Suspense boundaries:**
```jsx
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Suspense fallback={<SidebarSkeleton />}>
    <Sidebar />
  </Suspense>
  <Suspense fallback={<ContentSkeleton />}>
    <MainContent />
  </Suspense>
</Suspense>
```

---

**Q38. How do you virtualize long lists in React?**

Virtualization renders only the visible items in a scrollable list, drastically reducing DOM nodes.

```jsx
import { FixedSizeList, VariableSizeList } from 'react-window';

// Fixed-size items
function VirtualList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style} className="row">
      {items[index].name}
    </div>
  );

  return (
    <FixedSizeList
      height={600}          // viewport height
      width="100%"
      itemCount={items.length}
      itemSize={50}          // each row is 50px
    >
      {Row}
    </FixedSizeList>
  );
}

// Variable-size items
function ChatMessages({ messages }) {
  const getItemSize = (index) => messages[index].text.length > 100 ? 80 : 40;

  return (
    <VariableSizeList
      height={600}
      width="100%"
      itemCount={messages.length}
      itemSize={getItemSize}
    >
      {({ index, style }) => (
        <div style={style}>{messages[index].text}</div>
      )}
    </VariableSizeList>
  );
}
```

**Libraries:** `react-window` (lightweight), `react-virtuoso` (feature-rich), `@tanstack/react-virtual` (headless).

---

**Q39. What is the React Profiler, and how do you use it to find performance bottlenecks?**

The React Profiler (in React DevTools) records render timings and shows why components re-rendered.

**Using DevTools:**
1. Open React DevTools → Profiler tab
2. Click Record, interact with the app, click Stop
3. Analyze the flame chart — wider bars = slower renders

**Programmatic Profiler:**
```jsx
import { Profiler } from 'react';

function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  console.log({
    id,              // "UserList"
    phase,           // "mount" or "update"
    actualDuration,  // time spent rendering (ms)
    baseDuration,    // estimated time without memoization
  });
}

function App() {
  return (
    <Profiler id="UserList" onRender={onRender}>
      <UserList />
    </Profiler>
  );
}
```

**Common findings:**
- Component re-rendering with same props → add `React.memo`
- Expensive render with unchanged deps → add `useMemo`
- Parent causing child re-renders → lift state down or memoize

---

**Q40. Explain React's batching behavior. What changed in React 18?**

**Batching** groups multiple state updates into a single re-render for performance.

```jsx
// React 17 — only batches inside React event handlers
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // ONE re-render (batched)
}

setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // TWO re-renders (NOT batched in React 17)
}, 1000);

// React 18 — automatic batching EVERYWHERE
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // ONE re-render (batched in React 18!)
}, 1000);

// Same for promises, native event handlers, etc.
fetch('/api').then(() => {
  setData(data);
  setLoading(false);
  // ONE re-render in React 18
});

// Opt out of batching (rare)
import { flushSync } from 'react-dom';
flushSync(() => setCount(c => c + 1)); // re-renders immediately
flushSync(() => setFlag(f => !f));       // re-renders immediately
```

---

### React 18+ & Concurrent Features (Q41–Q44)

**Q41. What are React Server Components (RSC)?**

RSCs run on the server and send serialized UI to the client. They never ship JavaScript to the browser.

```jsx
// Server Component (default in Next.js App Router)
// Can: access DB, file system, secrets
// Cannot: use hooks, event handlers, browser APIs
async function ProductPage({ params }) {
  const product = await db.products.findById(params.id); // Direct DB access!
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <AddToCartButton productId={product.id} /> {/* Client Component */}
    </div>
  );
}

// Client Component — opt in with 'use client'
'use client';
function AddToCartButton({ productId }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => { addToCart(productId); setAdded(true); }}>
      {added ? 'Added!' : 'Add to Cart'}
    </button>
  );
}
```

**Benefits:** Zero bundle size for server components, direct backend access, streaming HTML, better SEO.

---

**Q42. Explain `useTransition` and `useDeferredValue`.**

Both are concurrent features that let you mark updates as non-urgent.

```jsx
// useTransition — wrap a state update to mark it as low priority
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e) => {
    setQuery(e.target.value); // HIGH priority — update input immediately

    startTransition(() => {
      setResults(filterProducts(e.target.value)); // LOW priority — can be interrupted
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ProductList results={results} />
    </div>
  );
}

// useDeferredValue — defer rendering of a value
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  const results = useMemo(() => filterProducts(deferredQuery), [deferredQuery]);

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <ProductList results={results} />
    </div>
  );
}
```

**`useTransition`** — you control when the update happens.
**`useDeferredValue`** — you let React decide when to update a derived value.

---

**Q43. What is Suspense for data fetching?**

Suspense lets components "wait" for async data, showing a fallback until it's ready.

```jsx
// With a Suspense-compatible library (React Query, Relay, Next.js)
function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UserProfile />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts />
      </Suspense>
    </Suspense>
  );
}

// React Query with Suspense
function UserProfile() {
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: fetchUser,
  });
  return <h1>{user.name}</h1>; // No loading check — Suspense handles it
}
```

**Streaming SSR:** Suspense boundaries enable the server to send HTML progressively — fast parts appear first, slow parts stream in later.

---

**Q44. What is the `use` hook in React 19?**

The `use` hook reads values from Promises and Contexts. Unlike other hooks, it can be called inside conditionals and loops.

```jsx
// Reading a Promise
function UserProfile({ userPromise }) {
  const user = use(userPromise); // suspends until resolved
  return <h1>{user.name}</h1>;
}

// Reading Context conditionally (not possible with useContext)
function ThemeIcon({ showIcon }) {
  if (!showIcon) return null;
  const theme = use(ThemeContext); // allowed inside condition!
  return <Icon color={theme.primary} />;
}

// Parent passes the promise
function Page({ userId }) {
  const userPromise = fetchUser(userId); // starts fetching immediately
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

---

### Testing (Q45–Q47)

**Q45. How do you test React components? Explain the Testing Library philosophy.**

React Testing Library (RTL) encourages testing components the way users interact with them.

```jsx
// Component
function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ email, password }); }}>
      <label htmlFor="email">Email</label>
      <input id="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password}
             onChange={e => setPassword(e.target.value)} />
      <button type="submit">Sign In</button>
    </form>
  );
}

// Test
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('submits email and password', async () => {
  const handleSubmit = jest.fn();
  render(<LoginForm onSubmit={handleSubmit} />);

  // Query by role/label — not implementation details
  await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
  await userEvent.type(screen.getByLabelText('Password'), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: 'test@test.com',
    password: 'secret123',
  });
});
```

**Priority of queries:** `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId`

---

**Q46. How do you test custom hooks?**

```jsx
// Custom hook
function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initial);
  return { count, increment, decrement, reset };
}

// Test with renderHook
import { renderHook, act } from '@testing-library/react';

test('useCounter increments and decrements', () => {
  const { result } = renderHook(() => useCounter(10));

  expect(result.current.count).toBe(10);

  act(() => result.current.increment());
  expect(result.current.count).toBe(11);

  act(() => result.current.decrement());
  expect(result.current.count).toBe(10);

  act(() => result.current.reset());
  expect(result.current.count).toBe(10);
});

// Test with wrapper (for hooks that need providers)
test('hook with context', () => {
  const wrapper = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.user).toBeNull();
});
```

---

**Q47. How do you test async components and API calls?**

```jsx
// Component that fetches data
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); });
  }, []);

  if (loading) return <p>Loading...</p>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Test with MSW (Mock Service Worker) — recommended
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('renders user list after fetch', async () => {
  render(<UserList />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  // waitFor retries until the assertion passes
  await waitFor(() => {
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});

test('handles error', async () => {
  server.use(
    http.get('/api/users', () => new HttpResponse(null, { status: 500 }))
  );
  render(<UserList />);
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

---

### TypeScript with React (Q48–Q50)

**Q48. How do you type props, state, and events in React with TypeScript?**

```tsx
// Props typing
interface UserCardProps {
  name: string;
  age: number;
  email?: string;                          // optional
  role: 'admin' | 'user' | 'moderator';   // union literal
  onEdit: (id: string) => void;            // callback
  children: React.ReactNode;               // any renderable content
}

function UserCard({ name, age, role, onEdit, children }: UserCardProps) {
  return <div>{children}</div>;
}

// Event typing
function Form() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log(e.clientX);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button onClick={handleClick}>Submit</button>
    </form>
  );
}

// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}

// Usage — TypeScript infers T from items
<List items={users} renderItem={(user) => <li>{user.name}</li>} />
```

---

**Q49. How do you type hooks with TypeScript?**

```tsx
// useState
const [count, setCount] = useState<number>(0);              // inferred
const [user, setUser] = useState<User | null>(null);         // explicit for null initial
const [items, setItems] = useState<string[]>([]);            // explicit array type

// useRef
const inputRef = useRef<HTMLInputElement>(null);             // DOM ref
const timerRef = useRef<number | null>(null);                // mutable ref

// useReducer
type State = { count: number; loading: boolean };
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setLoading'; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + 1 };
    case 'decrement': return { ...state, count: state.count - 1 };
    case 'setLoading': return { ...state, loading: action.payload };
  }
}

// useContext
interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be inside ThemeProvider');
  return context;
}

// Custom hook with generics
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const; // tuple return type
}
```

---

**Q50. What are some common TypeScript patterns and utility types used in React?**

```tsx
// 1. ComponentProps — extract props from an existing component
type ButtonProps = React.ComponentProps<'button'>; // native button props
type InputProps = React.ComponentProps<typeof CustomInput>; // custom component props

// 2. Extending native element props
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: 'primary' | 'secondary';
}

function IconButton({ icon, variant = 'primary', ...rest }: IconButtonProps) {
  return <button className={variant} {...rest}><Icon name={icon} /></button>;
}

// 3. Discriminated unions for variant props
type AlertProps =
  | { variant: 'success'; message: string }
  | { variant: 'error'; message: string; retryAction: () => void }
  | { variant: 'loading' };

function Alert(props: AlertProps) {
  switch (props.variant) {
    case 'success': return <div className="success">{props.message}</div>;
    case 'error': return <div className="error">{props.message}<button onClick={props.retryAction}>Retry</button></div>;
    case 'loading': return <Spinner />;
  }
}

// 4. Polymorphic "as" prop
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, 'as' | 'children'>;

function Box<E extends React.ElementType = 'div'>({
  as,
  children,
  ...rest
}: PolymorphicProps<E>) {
  const Component = as || 'div';
  return <Component {...rest}>{children}</Component>;
}

// Usage
<Box as="section" id="hero">Content</Box>
<Box as="a" href="/about">Link</Box>

// 5. Record for mapping
const statusColors: Record<Status, string> = {
  active: 'green',
  inactive: 'gray',
  banned: 'red',
};
```

---

## Part 2: 30 React Coding Problems

---

### Problem 1: Toggle Component

Build a reusable toggle/switch component.

```jsx
function Toggle({ isOn, onToggle, label }) {
  return (
    <div className="toggle-wrapper">
      <label className="toggle">
        <input
          type="checkbox"
          checked={isOn}
          onChange={() => onToggle(!isOn)}
        />
        <span className="slider" />
      </label>
      {label && <span className="toggle-label">{label}</span>}
    </div>
  );
}

// Usage
function App() {
  const [darkMode, setDarkMode] = useState(false);
  return <Toggle isOn={darkMode} onToggle={setDarkMode} label="Dark Mode" />;
}
```

---

### Problem 2: Counter with Min/Max and Step

```jsx
function Counter({ min = 0, max = 100, step = 1, initialValue = 0 }) {
  const [count, setCount] = useState(
    Math.min(Math.max(initialValue, min), max)
  );

  const increment = () => setCount(prev => Math.min(prev + step, max));
  const decrement = () => setCount(prev => Math.max(prev - step, min));
  const reset = () => setCount(initialValue);

  return (
    <div>
      <button onClick={decrement} disabled={count <= min}>-</button>
      <span>{count}</span>
      <button onClick={increment} disabled={count >= max}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

---

### Problem 3: Debounced Search Input

```jsx
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  return (
    <input
      type="search"
      placeholder="Search..."
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}
```

---

### Problem 4: Todo List with CRUD Operations

```jsx
function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | completed
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: input.trim(), completed: false }]);
    setInput('');
  };

  const toggleTodo = (id) =>
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const deleteTodo = (id) =>
    setTodos(prev => prev.filter(t => t.id !== id));

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, text: editText } : t));
    setEditingId(null);
  };

  const filteredTodos = todos.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const remaining = todos.filter(t => !t.completed).length;

  return (
    <div>
      <form onSubmit={addTodo}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add todo..." />
        <button type="submit">Add</button>
      </form>

      <div>
        {['all', 'active', 'completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'active' : ''}>
            {f}
          </button>
        ))}
      </div>

      <ul>
        {filteredTodos.map(todo => (
          <li key={todo.id}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
            {editingId === todo.id ? (
              <>
                <input value={editText} onChange={e => setEditText(e.target.value)} />
                <button onClick={() => saveEdit(todo.id)}>Save</button>
              </>
            ) : (
              <>
                <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                  {todo.text}
                </span>
                <button onClick={() => startEdit(todo)}>Edit</button>
                <button onClick={() => deleteTodo(todo.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <p>{remaining} item{remaining !== 1 ? 's' : ''} left</p>
    </div>
  );
}
```

---

### Problem 5: Accordion Component

```jsx
function Accordion({ items, allowMultiple = false }) {
  const [openItems, setOpenItems] = useState(new Set());

  const toggle = (index) => {
    setOpenItems(prev => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="accordion">
      {items.map((item, index) => (
        <div key={index} className="accordion-item">
          <button
            className="accordion-header"
            onClick={() => toggle(index)}
            aria-expanded={openItems.has(index)}
          >
            {item.title}
            <span>{openItems.has(index) ? '−' : '+'}</span>
          </button>
          {openItems.has(index) && (
            <div className="accordion-body">{item.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Problem 6: Modal with Portal

```jsx
function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
```

---

### Problem 7: Infinite Scroll List

```jsx
function useIntersectionObserver(callback) {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) callback(); },
      { threshold: 1.0 }
    );
    const el = ref.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [callback]);

  return ref;
}

function InfiniteList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const res = await fetch(`/api/items?page=${page}&limit=20`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setPage(prev => prev + 1);
    setLoading(false);
  }, [page, loading, hasMore]);

  const sentinelRef = useIntersectionObserver(loadMore);

  useEffect(() => { loadMore(); }, []); // initial load

  return (
    <div>
      {items.map(item => <Card key={item.id} item={item} />)}
      {loading && <Spinner />}
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      {!hasMore && <p>No more items</p>}
    </div>
  );
}
```

---

### Problem 8: Multi-Step Form Wizard

```jsx
function FormWizard() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '', email: '', address: '', city: '', cardNumber: '',
  });

  const updateField = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const steps = [
    {
      title: 'Personal Info',
      content: (
        <>
          <input placeholder="Name" value={formData.name}
                 onChange={e => updateField('name', e.target.value)} />
          <input placeholder="Email" value={formData.email}
                 onChange={e => updateField('email', e.target.value)} />
        </>
      ),
      isValid: () => formData.name && formData.email,
    },
    {
      title: 'Address',
      content: (
        <>
          <input placeholder="Address" value={formData.address}
                 onChange={e => updateField('address', e.target.value)} />
          <input placeholder="City" value={formData.city}
                 onChange={e => updateField('city', e.target.value)} />
        </>
      ),
      isValid: () => formData.address && formData.city,
    },
    {
      title: 'Payment',
      content: (
        <input placeholder="Card Number" value={formData.cardNumber}
               onChange={e => updateField('cardNumber', e.target.value)} />
      ),
      isValid: () => formData.cardNumber.length >= 16,
    },
  ];

  const handleSubmit = () => {
    console.log('Submitted:', formData);
  };

  return (
    <div>
      <div className="step-indicators">
        {steps.map((s, i) => (
          <span key={i} className={i === step ? 'active' : i < step ? 'done' : ''}>
            {i + 1}. {s.title}
          </span>
        ))}
      </div>

      <div className="step-content">{steps[step].content}</div>

      <div className="step-actions">
        {step > 0 && <button onClick={() => setStep(s => s - 1)}>Back</button>}
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!steps[step].isValid()}>
            Next
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!steps[step].isValid()}>
            Submit
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### Problem 9: Drag and Drop List

```jsx
function DragDropList({ initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragStart = (index) => setDraggedIndex(index);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (index) => {
    if (draggedIndex === null) return;
    const updated = [...items];
    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, removed);
    setItems(updated);
    setDraggedIndex(null);
    setOverIndex(null);
  };

  return (
    <ul className="drag-list">
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => { setDraggedIndex(null); setOverIndex(null); }}
          className={[
            draggedIndex === index ? 'dragging' : '',
            overIndex === index ? 'over' : '',
          ].join(' ')}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}
```

---

### Problem 10: Star Rating Component

```jsx
function StarRating({ maxStars = 5, value = 0, onChange, readOnly = false }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-rating" onMouseLeave={() => !readOnly && setHovered(0)}>
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= (hovered || value);

        return (
          <span
            key={i}
            className={`star ${isFilled ? 'filled' : ''}`}
            onClick={() => !readOnly && onChange?.(starValue)}
            onMouseEnter={() => !readOnly && setHovered(starValue)}
            style={{ cursor: readOnly ? 'default' : 'pointer', fontSize: '24px' }}
          >
            {isFilled ? '\u2605' : '\u2606'}
          </span>
        );
      })}
    </div>
  );
}
```

---

### Problem 11: useLocalStorage Hook

```jsx
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    setStoredValue(prev => {
      const nextValue = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(key, JSON.stringify(nextValue));
      return nextValue;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    localStorage.removeItem(key);
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// Usage
function Settings() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme}</button>;
}
```

---

### Problem 12: Data Table with Sorting and Pagination

```jsx
function DataTable({ data, columns, pageSize = 10 }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  return (
    <div>
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: 'pointer' }}>
                {col.label}
                {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map(col => <td key={col.key}>{row[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Prev</button>
        <span>{currentPage} / {totalPages}</span>
        <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next</button>
      </div>
    </div>
  );
}
```

---

### Problem 13: Image Carousel/Slider

```jsx
function Carousel({ images, autoPlay = false, interval = 3000 }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, next]);

  return (
    <div className="carousel">
      <button className="carousel-btn prev" onClick={prev}>&lt;</button>

      <div className="carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {images.map((img, i) => (
          <img key={i} src={img.src} alt={img.alt} className="carousel-slide" />
        ))}
      </div>

      <button className="carousel-btn next" onClick={next}>&gt;</button>

      <div className="carousel-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={`dot ${i === current ? 'active' : ''}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### Problem 14: Autocomplete/Typeahead Input

```jsx
function Autocomplete({ suggestions, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const matches = suggestions.filter(s =>
      s.toLowerCase().includes(query.toLowerCase())
    );
    setFiltered(matches);
    setActiveIndex(-1);
    setIsOpen(matches.length > 0);
  }, [query, suggestions]);

  const selectItem = (item) => {
    setQuery(item);
    setIsOpen(false);
    onSelect?.(item);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      selectItem(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="autocomplete">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => filtered.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={placeholder}
      />
      {isOpen && (
        <ul className="suggestions">
          {filtered.map((item, i) => (
            <li
              key={item}
              className={i === activeIndex ? 'active' : ''}
              onMouseDown={() => selectItem(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### Problem 15: useWindowSize Hook

```jsx
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let rafId;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return size;
}

// Usage
function ResponsiveLayout() {
  const { width } = useWindowSize();
  if (width < 768) return <MobileLayout />;
  if (width < 1024) return <TabletLayout />;
  return <DesktopLayout />;
}
```

---

### Problem 16: Theme Switcher with Context

```jsx
const ThemeContext = createContext();

const themes = {
  light: { bg: '#ffffff', text: '#000000', primary: '#3b82f6' },
  dark: { bg: '#1a1a2e', text: '#e0e0e0', primary: '#60a5fa' },
};

function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() =>
    localStorage.getItem('theme') || 'light'
  );

  const toggleTheme = () => {
    setThemeName(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const value = useMemo(() => ({
    theme: themes[themeName],
    themeName,
    toggleTheme,
  }), [themeName]);

  return (
    <ThemeContext.Provider value={value}>
      <div style={{ backgroundColor: themes[themeName].bg, color: themes[themeName].text, minHeight: '100vh' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be inside ThemeProvider');
  return context;
}

function ThemeToggle() {
  const { themeName, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{themeName === 'light' ? 'Dark' : 'Light'} Mode</button>;
}
```

---

### Problem 17: Countdown Timer

```jsx
function CountdownTimer({ targetDate }) {
  const calculateTimeLeft = useCallback(() => {
    const diff = new Date(targetDate) - new Date();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false,
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => {
      const tl = calculateTimeLeft();
      setTimeLeft(tl);
      if (tl.expired) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  if (timeLeft.expired) return <p>Time is up!</p>;

  return (
    <div className="countdown">
      {['days', 'hours', 'minutes', 'seconds'].map(unit => (
        <div key={unit} className="countdown-unit">
          <span className="value">{String(timeLeft[unit]).padStart(2, '0')}</span>
          <span className="label">{unit}</span>
        </div>
      ))}
    </div>
  );
}
```

---

### Problem 18: Tic-Tac-Toe Game

```jsx
function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXTurn, setIsXTurn] = useState(true);

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(Boolean);
  const status = winner
    ? `Winner: ${winner}`
    : isDraw
    ? "It's a draw!"
    : `Next: ${isXTurn ? 'X' : 'O'}`;

  const handleClick = (index) => {
    if (board[index] || winner) return;
    const newBoard = [...board];
    newBoard[index] = isXTurn ? 'X' : 'O';
    setBoard(newBoard);
    setIsXTurn(!isXTurn);
  };

  const reset = () => { setBoard(Array(9).fill(null)); setIsXTurn(true); };

  return (
    <div>
      <p>{status}</p>
      <div className="board" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: 4 }}>
        {board.map((cell, i) => (
          <button key={i} onClick={() => handleClick(i)}
                  style={{ width: 60, height: 60, fontSize: 24 }}>
            {cell}
          </button>
        ))}
      </div>
      <button onClick={reset}>Reset</button>
    </div>
  );
}

function calculateWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6],         // diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}
```

---

### Problem 19: Fetch with Loading, Error, and Retry

```jsx
function useFetchWithRetry(url, maxRetries = 3) {
  const [state, dispatch] = useReducer(
    (state, action) => {
      switch (action.type) {
        case 'loading': return { ...state, loading: true, error: null };
        case 'success': return { data: action.payload, loading: false, error: null, retries: 0 };
        case 'error': return { ...state, loading: false, error: action.payload };
        case 'retry': return { ...state, retries: state.retries + 1 };
        default: return state;
      }
    },
    { data: null, loading: true, error: null, retries: 0 }
  );

  const fetchData = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      dispatch({ type: 'success', payload: data });
    } catch (err) {
      dispatch({ type: 'error', payload: err.message });
    }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const retry = () => {
    if (state.retries < maxRetries) {
      dispatch({ type: 'retry' });
      fetchData();
    }
  };

  return { ...state, retry, canRetry: state.retries < maxRetries };
}

function UserList() {
  const { data, loading, error, retry, canRetry } = useFetchWithRetry('/api/users');

  if (loading) return <Spinner />;
  if (error) return (
    <div>
      <p>Error: {error}</p>
      {canRetry && <button onClick={retry}>Retry</button>}
    </div>
  );
  return <ul>{data.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

---

### Problem 20: Color Picker

```jsx
function ColorPicker({ initialColor = '#3b82f6', onChange }) {
  const [color, setColor] = useState(initialColor);
  const [history, setHistory] = useState([initialColor]);

  const handleChange = (e) => {
    const newColor = e.target.value;
    setColor(newColor);
    onChange?.(newColor);
  };

  const saveToHistory = () => {
    setHistory(prev => [color, ...prev.filter(c => c !== color)].slice(0, 10));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(color);
  };

  return (
    <div className="color-picker">
      <input type="color" value={color} onChange={handleChange} onBlur={saveToHistory} />
      <input type="text" value={color} onChange={handleChange} maxLength={7} />
      <button onClick={copyToClipboard}>Copy</button>

      <div className="color-preview" style={{ backgroundColor: color, width: 100, height: 100 }} />

      <div className="color-history">
        {history.map((c, i) => (
          <button
            key={`${c}-${i}`}
            onClick={() => { setColor(c); onChange?.(c); }}
            style={{ backgroundColor: c, width: 30, height: 30, border: c === color ? '2px solid black' : 'none' }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### Problem 21: Notification Toast System

```jsx
const ToastContext = createContext();

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div className="toast-container" style={{ position: 'fixed', top: 16, right: 16 }}>
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)}>&times;</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

// Usage
function App() {
  const { addToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast('Saved!', 'success')}>Save</button>
      <button onClick={() => addToast('Something went wrong', 'error', 5000)}>Error</button>
    </div>
  );
}
```

---

### Problem 22: Tabs Component

```jsx
function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = React.Children.toArray(children).filter(
    child => child.type === TabPanel
  );

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.props.label}
            role="tab"
            aria-selected={activeTab === tab.props.label}
            className={activeTab === tab.props.label ? 'active' : ''}
            onClick={() => setActiveTab(tab.props.label)}
          >
            {tab.props.label}
          </button>
        ))}
      </div>

      {tabs.map(tab =>
        activeTab === tab.props.label ? (
          <div key={tab.props.label} role="tabpanel" className="tab-panel">
            {tab.props.children}
          </div>
        ) : null
      )}
    </div>
  );
}

function TabPanel({ label, children }) {
  return <>{children}</>;
}

// Usage
function App() {
  return (
    <Tabs defaultTab="Profile">
      <TabPanel label="Profile"><ProfileContent /></TabPanel>
      <TabPanel label="Settings"><SettingsContent /></TabPanel>
      <TabPanel label="Notifications"><NotificationsContent /></TabPanel>
    </Tabs>
  );
}
```

---

### Problem 23: Shopping Cart with useReducer

```jsx
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === action.payload.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.payload.id ? { ...i, quantity: Math.max(0, action.payload.quantity) } : i
        ).filter(i => i.quantity > 0),
      };
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
};

function ShoppingCart() {
  const [cart, dispatch] = useReducer(cartReducer, { items: [] });

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  );

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      <h2>Cart ({itemCount} items)</h2>
      {cart.items.map(item => (
        <div key={item.id} className="cart-item">
          <span>{item.name} - ${item.price}</span>
          <button onClick={() => dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.id, quantity: item.quantity - 1 } })}>-</button>
          <span>{item.quantity}</span>
          <button onClick={() => dispatch({ type: 'UPDATE_QUANTITY', payload: { id: item.id, quantity: item.quantity + 1 } })}>+</button>
          <button onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.id })}>Remove</button>
        </div>
      ))}
      <p>Total: ${total.toFixed(2)}</p>
      <button onClick={() => dispatch({ type: 'CLEAR' })}>Clear Cart</button>
    </div>
  );
}
```

---

### Problem 24: Stopwatch with Lap Times

```jsx
function Stopwatch() {
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setTime(t => t + 10), 10);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  };

  const handleLap = () => setLaps(prev => [time, ...prev]);

  const handleReset = () => {
    setRunning(false);
    setTime(0);
    setLaps([]);
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'monospace' }}>{formatTime(time)}</h1>
      <button onClick={() => setRunning(r => !r)}>{running ? 'Stop' : 'Start'}</button>
      {running && <button onClick={handleLap}>Lap</button>}
      <button onClick={handleReset}>Reset</button>

      {laps.length > 0 && (
        <ol>
          {laps.map((lap, i) => (
            <li key={i}>Lap {laps.length - i}: {formatTime(lap)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

---

### Problem 25: File Upload with Preview and Progress

```jsx
function FileUploader({ accept = "image/*", maxSize = 5 * 1024 * 1024 }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      file,
      id: Math.random().toString(36).slice(2),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      progress: 0,
      error: file.size > maxSize ? `File exceeds ${maxSize / 1024 / 1024}MB limit` : null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadAll = async () => {
    setUploading(true);
    const validFiles = files.filter(f => !f.error);

    for (const fileObj of validFiles) {
      const formData = new FormData();
      formData.append('file', fileObj.file);

      try {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, progress } : f));
          }
        };
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      } catch {
        setFiles(prev => prev.map(f =>
          f.id === fileObj.id ? { ...f, error: 'Upload failed' } : f
        ));
      }
    }
    setUploading(false);
  };

  return (
    <div>
      <input type="file" multiple accept={accept} onChange={handleFiles} />
      {files.map(f => (
        <div key={f.id} className="file-item">
          {f.preview && <img src={f.preview} alt="" style={{ width: 60, height: 60, objectFit: 'cover' }} />}
          <span>{f.file.name} ({(f.file.size / 1024).toFixed(1)}KB)</span>
          {f.error && <span className="error">{f.error}</span>}
          {f.progress > 0 && <progress value={f.progress} max={100} />}
          <button onClick={() => removeFile(f.id)}>Remove</button>
        </div>
      ))}
      {files.length > 0 && (
        <button onClick={uploadAll} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload All'}</button>
      )}
    </div>
  );
}
```

---

### Problem 26: Responsive Navbar with Mobile Menu

```jsx
function Navbar({ links, logo }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [window.location.pathname]);

  return (
    <nav ref={menuRef} className="navbar">
      <div className="navbar-brand">{logo}</div>

      <button
        className="hamburger"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle menu"
        aria-expanded={isMenuOpen}
      >
        <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
        <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
      </button>

      <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
        {links.map(link => (
          <li key={link.href}>
            <a href={link.href} onClick={() => setIsMenuOpen(false)}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

---

### Problem 27: Pagination Hook

```jsx
function usePagination({ totalItems, itemsPerPage = 10, siblingCount = 1 }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const range = (start, end) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const pages = useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 5; // siblings + first + last + current + 2 dots

    if (totalPages <= totalPageNumbers) return range(1, totalPages);

    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);
    const showLeftDots = leftSibling > 2;
    const showRightDots = rightSibling < totalPages - 1;

    if (!showLeftDots && showRightDots) {
      const leftRange = range(1, 3 + 2 * siblingCount);
      return [...leftRange, '...', totalPages];
    }
    if (showLeftDots && !showRightDots) {
      const rightRange = range(totalPages - (2 + 2 * siblingCount), totalPages);
      return [1, '...', ...rightRange];
    }
    return [1, '...', ...range(leftSibling, rightSibling), '...', totalPages];
  }, [totalPages, currentPage, siblingCount]);

  const goTo = (page) => setCurrentPage(Math.min(Math.max(1, page), totalPages));
  const nextPage = () => goTo(currentPage + 1);
  const prevPage = () => goTo(currentPage - 1);

  return {
    currentPage, totalPages, pages,
    goTo, nextPage, prevPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    startIndex: (currentPage - 1) * itemsPerPage,
    endIndex: Math.min(currentPage * itemsPerPage - 1, totalItems - 1),
  };
}

// Usage
function PaginatedList({ items }) {
  const { currentPage, pages, goTo, hasNext, hasPrev, nextPage, prevPage, startIndex, endIndex } =
    usePagination({ totalItems: items.length, itemsPerPage: 10 });

  const visibleItems = items.slice(startIndex, endIndex + 1);

  return (
    <div>
      <ul>{visibleItems.map(item => <li key={item.id}>{item.name}</li>)}</ul>
      <nav>
        <button onClick={prevPage} disabled={!hasPrev}>Prev</button>
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`dots-${i}`}>...</span>
          ) : (
            <button key={page} onClick={() => goTo(page)} className={page === currentPage ? 'active' : ''}>
              {page}
            </button>
          )
        )}
        <button onClick={nextPage} disabled={!hasNext}>Next</button>
      </nav>
    </div>
  );
}
```

---

### Problem 28: Copy to Clipboard Component

```jsx
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return { copied, copy };
}

function CodeBlock({ code, language }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button onClick={() => copy(code)}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}
```

---

### Problem 29: Lazy Loading Images

```jsx
function LazyImage({ src, alt, placeholder, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before visible
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`lazy-image-wrapper ${className || ''}`}>
      {!loaded && (
        <div className="placeholder">
          {placeholder || <div className="skeleton" />}
        </div>
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          {...props}
        />
      )}
    </div>
  );
}

// Usage
function Gallery({ images }) {
  return (
    <div className="gallery">
      {images.map(img => (
        <LazyImage key={img.id} src={img.url} alt={img.title} />
      ))}
    </div>
  );
}
```

---

### Problem 30: Real-Time Chat Component

```jsx
function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    return () => ws.close();
  }, [url]);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { messages, sendMessage, connected };
}

function ChatRoom({ roomId, username }) {
  const { messages, sendMessage, connected } = useWebSocket(`wss://chat.example.com/rooms/${roomId}`);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input, username, timestamp: Date.now() });
    setInput('');
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <h3>Room: {roomId}</h3>
        <span className={connected ? 'online' : 'offline'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.username === username ? 'own' : ''}`}>
            <span className="author">{msg.username}</span>
            <p>{msg.text}</p>
            <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button type="submit" disabled={!connected || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
```

---

## Quick Reference: Topics Covered

| # | Category | Questions/Problems |
|---|----------|--------------------|
| 1 | Fundamentals | Q1–Q10 |
| 2 | Hooks | Q11–Q20 |
| 3 | State Management | Q21–Q26 |
| 4 | Component Patterns | Q27–Q32 |
| 5 | Routing | Q33–Q35 |
| 6 | Performance | Q36–Q40 |
| 7 | Concurrent React | Q41–Q44 |
| 8 | Testing | Q45–Q47 |
| 9 | TypeScript | Q48–Q50 |
| 10 | Coding Problems | P1–P30 |

---

*Prepared for React interview preparation — covering fundamentals through advanced patterns with working code examples.*
