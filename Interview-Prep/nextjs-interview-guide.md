# Next.js Interview Preparation Guide - Zero to Advanced

> A complete, structured interview prep resource covering every critical Next.js topic with deep answers, code examples, debugging scenarios, and system design questions.

---

## Table of Contents

1. [Beginner Level](#beginner-level)
2. [Intermediate Level](#intermediate-level)
3. [Advanced Level](#advanced-level)
4. [Real-World / System Design Level](#real-world--system-design-level)

---

# Beginner Level

## Q1. What is Next.js, and why would you choose it over plain React?

**Answer:**

Next.js is a **React meta-framework** built by Vercel that provides production-ready features out of the box - server-side rendering (SSR), static site generation (SSG), file-based routing, API routes, image optimization, and more.

**Plain React** is a UI library. It gives you components and a virtual DOM, but everything else - routing, data fetching strategy, build optimization, SEO - you wire yourself.

**Next.js solves these specific problems:**

| Concern | Plain React (CRA) | Next.js |
|---|---|---|
| Routing | Manual (react-router) | File-based (automatic) |
| SEO | Poor (client-rendered) | Excellent (SSR/SSG) |
| Code splitting | Manual | Automatic per-route |
| API backend | Separate server needed | Built-in API routes |
| Image optimization | Manual | `next/image` built-in |
| Deployment | Custom config | Vercel zero-config |

**Key distinction:** Next.js gives you a **rendering strategy per page**. One page can be statically generated, another server-rendered, another client-rendered - all in the same app.

**Why interviewer asks this:** To gauge whether you understand the *problems* Next.js solves, not just that it exists. Candidates who say "it's a React framework for SSR" are giving a shallow answer.

**Follow-up:** *Can you use Next.js for a fully client-side app with no SSR at all? How?*

Yes - by using `'use client'` directives on all components (App Router) or by disabling SSR via `dynamic()` with `{ ssr: false }`. You lose SEO benefits but retain the DX advantages (routing, API routes, image optimization).

---

## Q2. Explain the difference between SSR, SSG, ISR, and CSR.

**Answer:**

These are **four rendering strategies** that determine *when* and *where* your HTML is generated.

### CSR - Client-Side Rendering
```
Browser downloads empty HTML → JS bundle loads → React renders in browser
```
- HTML is a blank shell until JavaScript executes
- Bad for SEO, slow First Contentful Paint (FCP)
- Good for dashboards, authenticated-only pages

### SSR - Server-Side Rendering
```
Request hits server → Server runs React → Sends full HTML → Browser hydrates
```
- HTML is generated **on every request**
- Good for dynamic, personalized content
- Trade-off: server compute on every request

```tsx
// App Router - SSR by default for server components
// This component fetches fresh data on every request
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`, {
    cache: 'no-store' // Forces SSR - no caching
  });
  return <div>{product.name}</div>;
}
```

### SSG - Static Site Generation
```
Build time → Next.js pre-renders HTML → Serves static files from CDN
```
- HTML generated **once at build time**
- Fastest possible delivery (CDN-cached)
- Good for blogs, docs, marketing pages

```tsx
// App Router - SSG (default behavior when no dynamic data)
async function AboutPage() {
  // This fetch is cached by default = SSG behavior
  const team = await fetch('https://api.example.com/team');
  return <div>{team.members}</div>;
}
```

### ISR - Incremental Static Regeneration
```
Build time → Serve static → After revalidation period → Regenerate in background
```
- Combines SSG speed with SSR freshness
- Page is served from cache, then regenerated after a time interval

```tsx
async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`, {
    next: { revalidate: 60 } // Regenerate every 60 seconds
  });
  return <article>{post.content}</article>;
}
```

**Mental model:**

| Strategy | When HTML is generated | Freshness | Speed |
|---|---|---|---|
| CSR | In browser (runtime) | Always fresh | Slow initial load |
| SSR | On server (per request) | Always fresh | Medium |
| SSG | At build time | Stale until rebuild | Fastest |
| ISR | At build + background | Fresh within interval | Fast |

**Why interviewer asks this:** This is foundational. If you can't articulate these four strategies clearly, everything else falls apart.

**Follow-up:** *You have a product page with 50,000 products. Which strategy would you pick and why?*

ISR with on-demand revalidation. You can't SSG 50k pages at build time (too slow). Use `generateStaticParams` for the top 500 popular products, and let the rest be generated on-demand with `dynamicParams: true`. Revalidate when the product data changes via webhook calling `revalidatePath()`.

---

## Q3. What is file-based routing in Next.js? How does it differ between Pages Router and App Router?

**Answer:**

Next.js uses the **file system** as the router. Creating a file at a specific path automatically creates a route - no manual route configuration needed.

### Pages Router (`pages/` directory)

```
pages/
├── index.tsx          → /
├── about.tsx          → /about
├── blog/
│   ├── index.tsx      → /blog
│   └── [slug].tsx     → /blog/:slug
└── api/
    └── users.ts       → /api/users
```

Every file exports a **React component** as default.

### App Router (`app/` directory) - Next.js 13+

```
app/
├── page.tsx           → /
├── layout.tsx         → Root layout (wraps all pages)
├── about/
│   └── page.tsx       → /about
├── blog/
│   ├── page.tsx       → /blog
│   └── [slug]/
│       └── page.tsx   → /blog/:slug
└── api/
    └── users/
        └── route.ts   → /api/users
```

**Key differences:**

| Feature | Pages Router | App Router |
|---|---|---|
| Route file | `pages/about.tsx` | `app/about/page.tsx` |
| Layouts | `_app.tsx` (global only) | `layout.tsx` (nested, per-route) |
| Data fetching | `getServerSideProps`, `getStaticProps` | `async` Server Components, `fetch()` |
| Loading states | Manual | `loading.tsx` (built-in) |
| Error handling | `_error.tsx` (global) | `error.tsx` (per-route) |
| API routes | `pages/api/route.ts` | `app/api/route/route.ts` |
| Default rendering | Client components | Server components |

**Why interviewer asks this:** Tests whether you've worked with the modern App Router or only the legacy Pages Router. Most production apps are migrating to App Router.

**Follow-up:** *Can you use both Pages Router and App Router in the same project?*

Yes - during migration. Routes in `app/` take precedence over `pages/` if they conflict. But you shouldn't have the same route in both.

---

## Q4. What is the `layout.tsx` file in the App Router?

**Answer:**

A `layout.tsx` defines **shared UI that wraps child routes**. Unlike the old `_app.tsx`, layouts are **nested** and **don't re-render** when navigating between child routes.

```tsx
// app/layout.tsx - Root layout (required)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>Global Navigation</nav>
        {children}
        <footer>Global Footer</footer>
      </body>
    </html>
  );
}
```

```tsx
// app/dashboard/layout.tsx - Nested layout for /dashboard/*
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <aside>Dashboard Sidebar</aside>
      <main>{children}</main>
    </div>
  );
}
```

**Critical behavior:** When a user navigates from `/dashboard/settings` to `/dashboard/analytics`, the `DashboardLayout` **preserves its state** and does NOT re-mount. Only the inner `page.tsx` changes. This means:

- Sidebar scroll position is preserved
- Form state in the layout is preserved
- No unnecessary re-renders

**Why interviewer asks this:** Tests understanding of the nested layout model, which is a fundamental architectural shift from Pages Router.

**Follow-up:** *What's the difference between `layout.tsx` and `template.tsx`?*

`template.tsx` has the same API as `layout.tsx` but **creates a new instance on every navigation** - it remounts. Use it when you need:
- Enter/exit animations per page
- A `useEffect` that should fire on every navigation
- Resetting form state per route

---

## Q5. What are dynamic routes? Explain `[slug]`, `[...slug]`, and `[[...slug]]`.

**Answer:**

Dynamic routes let you create pages where part of the URL is a **variable**.

### `[slug]` - Single dynamic segment

```
app/blog/[slug]/page.tsx → matches /blog/hello-world, /blog/nextjs-guide
```

```tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <h1>Post: {params.slug}</h1>;
}
```

### `[...slug]` - Catch-all segments

```
app/docs/[...slug]/page.tsx → matches /docs/a, /docs/a/b, /docs/a/b/c
                              → does NOT match /docs
```

```tsx
export default function Docs({ params }: { params: { slug: string[] } }) {
  // /docs/react/hooks → params.slug = ['react', 'hooks']
  return <h1>Path: {params.slug.join('/')}</h1>;
}
```

### `[[...slug]]` - Optional catch-all segments

```
app/docs/[[...slug]]/page.tsx → matches /docs, /docs/a, /docs/a/b
```

The difference: `[[...slug]]` **also matches the base path** (`/docs`), where `params.slug` is `undefined`.

**Why interviewer asks this:** Interviewers want to see if you know the subtle differences and when to use each.

**Follow-up:** *How would you handle `/products/category/electronics/brand/samsung` with dynamic routes?*

Use a catch-all route `app/products/[...filters]/page.tsx` and parse the segments in pairs:

```tsx
export default function Products({ params }: { params: { filters: string[] } }) {
  // filters = ['category', 'electronics', 'brand', 'samsung']
  const filterMap: Record<string, string> = {};
  for (let i = 0; i < params.filters.length; i += 2) {
    filterMap[params.filters[i]] = params.filters[i + 1];
  }
  // filterMap = { category: 'electronics', brand: 'samsung' }
}
```

---

## Q6. What is `next/link` and how does it differ from an HTML `<a>` tag?

**Answer:**

`next/link` provides **client-side navigation** with automatic prefetching.

```tsx
import Link from 'next/link';

// Basic usage
<Link href="/about">About</Link>

// Dynamic route
<Link href={`/blog/${post.slug}`}>Read More</Link>

// With query params
<Link href={{ pathname: '/search', query: { q: 'nextjs' } }}>Search</Link>
```

**Key differences from `<a>`:**

| Behavior | `<a>` tag | `next/link` |
|---|---|---|
| Navigation | Full page reload | Client-side (no reload) |
| Prefetching | None | Automatic on viewport entry |
| History | Browser manages | Next.js router manages |
| Active state | Manual | Can use `usePathname()` |

**Prefetching behavior:**
- In **production**, Next.js automatically prefetches the page linked by `<Link>` when it enters the viewport
- This means when a user clicks, the page loads **instantly**
- You can disable it: `<Link href="/heavy-page" prefetch={false}>`

**Why interviewer asks this:** Basic but reveals whether you understand client-side navigation and prefetching, which are key to Next.js performance.

**Follow-up:** *When would you use `router.push()` instead of `<Link>`?*

For **programmatic navigation** - after form submissions, authentication redirects, or conditional routing:

```tsx
'use client';
import { useRouter } from 'next/navigation';

function LoginForm() {
  const router = useRouter();

  async function handleSubmit(data: FormData) {
    const res = await login(data);
    if (res.success) {
      router.push('/dashboard');
      router.refresh(); // Re-fetches server components
    }
  }
}
```

---

## Q7. What is `next/image` and why should you use it?

**Answer:**

`next/image` is Next.js's built-in image optimization component. It solves the common web performance problems with images.

```tsx
import Image from 'next/image';

// Local image (automatically determines dimensions)
import heroImage from './hero.jpg';
<Image src={heroImage} alt="Hero" placeholder="blur" />

// Remote image (dimensions required)
<Image
  src="https://cdn.example.com/photo.jpg"
  alt="Photo"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

**What it does automatically:**

1. **Lazy loading** - images load only when entering viewport
2. **Responsive sizing** - serves correctly sized images per device
3. **Modern formats** - converts to WebP/AVIF automatically
4. **Prevents CLS** - reserves space before image loads (no layout shift)
5. **On-demand optimization** - images are optimized at request time, not build time

**Configuration for remote images:**

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
        pathname: '/images/**',
      },
    ],
  },
};
```

**Why interviewer asks this:** Images are the #1 cause of poor Core Web Vitals. Knowing `next/image` shows you care about performance.

**Follow-up:** *What's the difference between `fill` and explicit `width`/`height`?*

`fill` makes the image fill its parent container (like `object-fit: cover`). Use it when you don't know the image dimensions ahead of time:

```tsx
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image src={url} alt="Banner" fill style={{ objectFit: 'cover' }} />
</div>
```

---

## Q8. What is the `loading.tsx` file?

**Answer:**

`loading.tsx` is a special App Router file that creates an **instant loading UI** using React Suspense under the hood.

```
app/
├── dashboard/
│   ├── loading.tsx    ← Shows while page.tsx is loading
│   └── page.tsx
```

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
```

**How it works internally:**

Next.js wraps your `page.tsx` in a `<Suspense>` boundary with `loading.tsx` as the fallback:

```tsx
// What Next.js generates internally
<Layout>
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
</Layout>
```

**Key behavior:**
- Shows **immediately** on navigation (no blank screen)
- Layout remains interactive while the loading state shows
- Automatically wraps the entire route segment

**Why interviewer asks this:** Tests understanding of streaming and Suspense integration in the App Router.

**Follow-up:** *Can you have more granular loading states within a single page?*

Yes - use `<Suspense>` directly inside your page for component-level loading:

```tsx
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}
```

This way, `RevenueChart` and `RecentOrders` load independently - whichever resolves first shows first.

---

## Q9. What is `error.tsx` and how does error handling work in the App Router?

**Answer:**

`error.tsx` creates a **per-route error boundary** that catches runtime errors and shows a fallback UI instead of crashing the whole app.

```tsx
// app/dashboard/error.tsx
'use client'; // Error components MUST be client components

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong in Dashboard!</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

**Error boundary hierarchy:**

```
app/
├── error.tsx              ← Catches errors from all child routes
├── layout.tsx
├── dashboard/
│   ├── error.tsx          ← Catches errors only in /dashboard/*
│   ├── layout.tsx
│   └── page.tsx           ← If this throws, dashboard/error.tsx catches it
```

**Important:** `error.tsx` catches errors from `page.tsx` in the **same segment**, but NOT from `layout.tsx` in the same segment. To catch layout errors, place `error.tsx` in the **parent** segment.

**`global-error.tsx`** - catches errors in the root layout:

```tsx
// app/global-error.tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <h2>Critical Error</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

**Why interviewer asks this:** Error handling is critical in production apps. This tests whether you know the boundary hierarchy.

**Follow-up:** *What's the `digest` property on the error object?*

`digest` is a hash of the error generated on the server. It prevents leaking sensitive server error details to the client. In production, the client only sees the digest - you match it in server logs for debugging.

---

## Q10. What is `not-found.tsx`?

**Answer:**

`not-found.tsx` renders custom UI when `notFound()` is called or when a route doesn't match.

```tsx
// app/not-found.tsx - Global 404 page
import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link href="/">Go Home</Link>
    </div>
  );
}
```

**Triggering it programmatically:**

```tsx
import { notFound } from 'next/navigation';

async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  if (!product) {
    notFound(); // Renders the nearest not-found.tsx
  }

  return <div>{product.name}</div>;
}
```

You can place `not-found.tsx` at different levels for segment-specific 404 pages.

**Why interviewer asks this:** Shows understanding of how Next.js handles missing resources gracefully.

**Follow-up:** *Does `notFound()` return a 404 status code?*

Yes - Next.js automatically sends a `404` HTTP status code when `notFound()` is called or when the `not-found.tsx` page renders.

---

# Intermediate Level

## Q11. Explain Server Components vs Client Components in the App Router.

**Answer:**

This is the **most important architectural concept** in the modern App Router.

### Server Components (default)
- Run **only on the server**
- Can directly access databases, file systems, environment variables
- Have **zero JavaScript sent to the client**
- Cannot use `useState`, `useEffect`, `onClick`, or any browser API

```tsx
// app/users/page.tsx - Server Component (default, no directive needed)
import { db } from '@/lib/database';

export default async function UsersPage() {
  const users = await db.query('SELECT * FROM users'); // Direct DB access!

  return (
    <ul>
      {users.map(u => <li key={u.id}>{u.name}</li>)}
    </ul>
  );
}
```

### Client Components
- Run on **both server (for initial HTML) and client (for hydration)**
- Can use all React hooks, event handlers, browser APIs
- Must have `'use client'` directive at the top

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

### The Composition Pattern

**The key insight:** Server Components can import and render Client Components, but NOT vice versa.

```tsx
// Server Component (page.tsx)
import Counter from './Counter'; // Client component
import { db } from '@/lib/database';

export default async function Page() {
  const data = await db.query('SELECT count FROM stats');

  return (
    <div>
      <h1>Stats</h1>  {/* Server-rendered, no JS */}
      <p>Total: {data.count}</p>  {/* Server-rendered, no JS */}
      <Counter />  {/* Client-rendered, has JS */}
    </div>
  );
}
```

**However**, you CAN pass Server Components as `children` to Client Components:

```tsx
// ClientWrapper.tsx
'use client';
export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return isOpen ? <div>{children}</div> : null;
}

// page.tsx (Server Component)
import ClientWrapper from './ClientWrapper';
import ServerData from './ServerData'; // Server Component

export default function Page() {
  return (
    <ClientWrapper>
      <ServerData /> {/* This works! Rendered on server, passed as children */}
    </ClientWrapper>
  );
}
```

**Why interviewer asks this:** This is the #1 concept that separates developers who understand the App Router from those who don't. The boundary between server and client components is critical.

**Follow-up:** *What happens if you try to use `useState` in a Server Component?*

You get a build-time error: `"You're importing a component that needs useState. It only works in a Client Component."` Next.js analyzes the dependency tree and enforces this boundary at build time.

---

## Q12. How does data fetching work in the App Router?

**Answer:**

The App Router **eliminated** `getServerSideProps`, `getStaticProps`, and `getInitialProps`. Data fetching is now done with **async Server Components** and the extended `fetch` API.

### Direct `async/await` in Server Components

```tsx
// This IS the data fetching - no special function needed
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetch(`https://api.example.com/products/${params.id}`);
  const data = await product.json();

  return <h1>{data.name}</h1>;
}
```

### Controlling caching behavior with `fetch` options

```tsx
// SSG behavior (default) - cached indefinitely
fetch('https://api.example.com/data');

// SSR behavior - fresh on every request
fetch('https://api.example.com/data', { cache: 'no-store' });

// ISR behavior - revalidate every 60 seconds
fetch('https://api.example.com/data', { next: { revalidate: 60 } });

// Tag-based revalidation
fetch('https://api.example.com/data', { next: { tags: ['products'] } });
```

### Fetching without `fetch` (e.g., database queries)

```tsx
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

const getProducts = unstable_cache(
  async () => {
    return db.product.findMany();
  },
  ['products'], // Cache key
  { revalidate: 60, tags: ['products'] }
);

export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

### Parallel data fetching

```tsx
async function Dashboard() {
  // BAD - sequential (waterfall)
  const revenue = await getRevenue();
  const orders = await getOrders();

  // GOOD - parallel
  const [revenue, orders] = await Promise.all([
    getRevenue(),
    getOrders()
  ]);

  return <div>...</div>;
}
```

**Why interviewer asks this:** Shows whether you understand the modern fetch-based data architecture vs. the legacy Pages Router approach.

**Follow-up:** *How does fetch deduplication work in Next.js?*

If the **same URL with the same options** is called multiple times during a single server render, Next.js deduplicates it - only one actual network request is made. This means you can call `fetch` in multiple components without worrying about duplicate requests.

```tsx
// Both components fetch the same URL - only ONE request is made
async function Header() {
  const user = await fetch('/api/user'); // Request #1 - actually fires
  return <nav>{user.name}</nav>;
}

async function Sidebar() {
  const user = await fetch('/api/user'); // Request #2 - deduped, uses #1's result
  return <aside>{user.avatar}</aside>;
}
```

---

## Q13. What are Route Handlers (API Routes in App Router)?

**Answer:**

Route Handlers are the App Router equivalent of `pages/api/*` files. They let you create API endpoints.

```
app/api/users/route.ts → handles GET/POST/PUT/DELETE to /api/users
```

```tsx
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';

  const users = await db.user.findMany({
    skip: (Number(page) - 1) * 10,
    take: 10,
  });

  return NextResponse.json(users);
}

// POST /api/users
export async function POST(request: NextRequest) {
  const body = await request.json();

  const user = await db.user.create({
    data: { name: body.name, email: body.email },
  });

  return NextResponse.json(user, { status: 201 });
}

// DELETE /api/users?id=123
export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id');
  await db.user.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
```

### Dynamic route handlers

```tsx
// app/api/users/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.user.findUnique({ where: { id: params.id } });

  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}
```

### Caching behavior

- `GET` handlers with no `Request` object usage are **statically cached** by default
- Using `Request`, `cookies()`, `headers()`, or any dynamic function makes it dynamic

**Why interviewer asks this:** Tests whether you can build backend functionality directly in Next.js.

**Follow-up:** *Should you use Route Handlers or Server Actions for form submissions?*

**Server Actions** are better for mutations (POST/PUT/DELETE) from React components - they're type-safe, handle revalidation automatically, and work with progressive enhancement. Use Route Handlers when you need a traditional REST API for external consumers or webhooks.

---

## Q14. What are Server Actions?

**Answer:**

Server Actions are **async functions that run on the server** but can be called directly from Client Components. They replace the pattern of creating API routes for mutations.

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await db.post.create({ data: { title, content } });

  revalidatePath('/blog'); // Invalidate the blog listing cache
}
```

### Usage in forms (progressive enhancement)

```tsx
// Works even with JavaScript disabled!
import { createPost } from './actions';

export default function NewPostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Publish</button>
    </form>
  );
}
```

### Usage with `useActionState` (for loading/error states)

```tsx
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

export default function NewPostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction}>
      <input name="title" required />
      <textarea name="content" required />
      <button disabled={isPending}>
        {isPending ? 'Publishing...' : 'Publish'}
      </button>
      {state?.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}
```

### Calling Server Actions outside forms

```tsx
'use client';
import { deletePost } from './actions';

export default function DeleteButton({ postId }: { postId: string }) {
  return (
    <button onClick={async () => {
      await deletePost(postId);
    }}>
      Delete
    </button>
  );
}
```

**Security:** Server Actions get a unique, unguessable endpoint. Input should still be validated server-side (use `zod`).

**Why interviewer asks this:** Server Actions are a paradigm shift. Understanding them shows you're current with React Server Components architecture.

**Follow-up:** *How do Server Actions handle validation?*

Always validate on the server - never trust client input:

```tsx
'use server';
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export async function createPost(formData: FormData) {
  const parsed = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await db.post.create({ data: parsed.data });
  revalidatePath('/blog');
}
```

---

## Q15. What is Middleware in Next.js?

**Answer:**

Middleware runs **before every request** reaches your route. It executes at the **Edge** (not Node.js) and can modify requests, redirect, rewrite, or add headers.

```tsx
// middleware.ts (root of project - NOT inside app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  // Redirect unauthenticated users
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Add custom headers
  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());

  return response;
}

// Only run on specific paths
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

### Common use cases

```tsx
// Geo-based redirects
if (request.geo?.country === 'DE') {
  return NextResponse.redirect(new URL('/de', request.url));
}

// A/B testing
const bucket = Math.random() < 0.5 ? 'a' : 'b';
const response = NextResponse.next();
response.cookies.set('ab-test', bucket);

// Rate limiting header check
const ip = request.headers.get('x-forwarded-for');

// URL rewrites (internal proxy)
if (request.nextUrl.pathname.startsWith('/blog')) {
  return NextResponse.rewrite(new URL(`/legacy-blog${request.nextUrl.pathname}`, request.url));
}
```

**Limitations of Middleware:**
- Runs on the **Edge runtime** (no Node.js APIs like `fs`, limited `crypto`)
- Cannot modify the response body
- Cannot call databases directly (use Edge-compatible clients)
- There's only **one** middleware file per project

**Why interviewer asks this:** Middleware is a critical architectural pattern for auth, redirects, and request manipulation.

**Follow-up:** *What's the difference between middleware redirects and `next.config.js` redirects?*

`next.config.js` redirects are **static** - defined at build time, evaluated at CDN level (fastest). Middleware redirects are **dynamic** - can use runtime data (cookies, headers, geo) but are slightly slower since they execute code.

---

## Q16. How do you handle metadata and SEO in Next.js?

**Answer:**

The App Router provides a **`metadata` API** for managing `<head>` content.

### Static metadata

```tsx
// app/about/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Acme Corp',
  description: 'Learn about our company and mission.',
  openGraph: {
    title: 'About Us | Acme Corp',
    description: 'Learn about our company and mission.',
    images: ['/og-about.png'],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function AboutPage() {
  return <h1>About Us</h1>;
}
```

### Dynamic metadata

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next';

export async function generateMetadata(
  { params }: { params: { slug: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`).then(r => r.json());

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [post.coverImage],
    },
  };
}
```

### Metadata inheritance

Metadata merges from parent layouts. Child metadata overrides parent values:

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | Acme Corp',  // Template for child pages
    default: 'Acme Corp',
  },
  metadataBase: new URL('https://acme.com'),
};

// app/about/page.tsx
export const metadata: Metadata = {
  title: 'About',  // Renders as "About | Acme Corp"
};
```

### Generating sitemap and robots.txt

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  return [
    { url: 'https://acme.com', lastModified: new Date() },
    ...posts.map(post => ({
      url: `https://acme.com/blog/${post.slug}`,
      lastModified: post.updatedAt,
    })),
  ];
}

// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin/' },
    sitemap: 'https://acme.com/sitemap.xml',
  };
}
```

**Why interviewer asks this:** SEO is a core reason teams adopt Next.js. This tests whether you know the metadata API.

**Follow-up:** *How does the `generateMetadata` function interact with data fetching in the page component?*

`fetch` calls in `generateMetadata` are **deduped** with `fetch` calls in the page component. So if both call the same API endpoint, only one network request is made.

---

## Q17. Explain parallel routes and intercepting routes.

**Answer:**

### Parallel Routes (`@slot`)

Parallel routes let you render **multiple pages simultaneously** in the same layout, each with independent loading and error states.

```
app/
├── layout.tsx
├── page.tsx
├── @analytics/
│   └── page.tsx
├── @team/
│   └── page.tsx
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="grid grid-cols-2">
        {analytics}
        {team}
      </div>
    </div>
  );
}
```

Each slot loads independently - `@analytics` can show a loading state while `@team` has already loaded.

### Intercepting Routes (`(.)`, `(..)`, `(...)`)

Intercepting routes let you load a route **within the current layout** while keeping the original URL. The classic example is a **modal pattern**.

```
app/
├── feed/
│   ├── page.tsx              ← Main feed
│   └── (..)photo/[id]/
│       └── page.tsx          ← Intercepts /photo/[id], shows as modal
├── photo/
│   └── [id]/
│       └── page.tsx          ← Full photo page (direct URL access)
```

**Behavior:**
- Click a photo in the feed → URL changes to `/photo/123`, but it renders as a **modal over the feed** (intercepted)
- Navigate directly to `/photo/123` → renders the **full page** version
- Refresh the modal page → renders the full page version

**Convention:**
- `(.)` - intercept same level
- `(..)` - intercept one level up
- `(..)(..)` - intercept two levels up
- `(...)` - intercept from root

**Why interviewer asks this:** These are advanced App Router features. Knowing them shows deep understanding.

**Follow-up:** *How would you implement an Instagram-like photo feed with modal photo view using these features?*

Combine parallel routes with intercepting routes:
1. `@modal` parallel slot in the feed layout
2. Intercepting route `(..)photo/[id]` inside `@modal` that renders a `<Modal>` component
3. Full `photo/[id]/page.tsx` for direct access / sharing

---

## Q18. What is `useRouter`, `usePathname`, `useSearchParams`, and `useParams`?

**Answer:**

These are client-side navigation hooks in the App Router (from `next/navigation`, NOT `next/router`).

```tsx
'use client';
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation';

function Component() {
  // 1. useRouter - programmatic navigation
  const router = useRouter();
  router.push('/about');         // Navigate
  router.replace('/login');      // Replace (no back button entry)
  router.back();                 // Go back
  router.refresh();              // Re-fetch server components without full reload
  router.prefetch('/dashboard'); // Preload a route

  // 2. usePathname - current path without query string
  const pathname = usePathname(); // '/blog/hello-world'

  // 3. useSearchParams - query parameters (read-only)
  const searchParams = useSearchParams();
  const query = searchParams.get('q');      // ?q=nextjs → 'nextjs'
  const page = searchParams.get('page');    // ?page=2 → '2'

  // 4. useParams - dynamic route parameters
  const params = useParams();
  // In /blog/[slug] → params.slug = 'hello-world'
  // In /shop/[...categories] → params.categories = ['shoes', 'running']
}
```

**Common pattern - updating search params:**

```tsx
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

function SearchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select onChange={(e) => updateFilter('sort', e.target.value)}>
      <option value="newest">Newest</option>
      <option value="price">Price</option>
    </select>
  );
}
```

**Why interviewer asks this:** Tests whether you know the correct hooks (not the Pages Router equivalents) and how to compose them.

**Follow-up:** *What's the difference between `router.push` and `router.replace`?*

`push` adds a new entry to the browser history stack (user can go back). `replace` replaces the current entry (used for redirects where you don't want the user to go "back" to the redirect source).

---

## Q19. What is `generateStaticParams` and how does it replace `getStaticPaths`?

**Answer:**

`generateStaticParams` tells Next.js which dynamic routes to **pre-render at build time** (SSG).

```tsx
// app/blog/[slug]/page.tsx

// Equivalent of getStaticPaths
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return posts.map((post: Post) => ({
    slug: post.slug,
  }));
  // Returns: [{ slug: 'intro-to-next' }, { slug: 'react-hooks' }, ...]
}

// The page component
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`);
  return <article>{post.content}</article>;
}
```

### Handling non-pre-rendered paths

```tsx
// What happens when a user visits /blog/new-post (not pre-rendered)?
export const dynamicParams = true;  // Default: generate on-demand and cache
// export const dynamicParams = false; // Return 404 for non-pre-rendered paths
```

### Nested dynamic routes

```tsx
// app/products/[category]/[id]/page.tsx
export async function generateStaticParams() {
  const products = await getProducts();

  return products.map((product) => ({
    category: product.category,
    id: product.id,
  }));
}
```

**Why interviewer asks this:** Tests understanding of static generation in the App Router.

**Follow-up:** *Can `generateStaticParams` run at runtime for ISR?*

When combined with `revalidate`, yes - initially generated pages are cached and revalidated. For new paths (not in `generateStaticParams`), they're generated on first request and then cached.

---

## Q20. How do you handle environment variables in Next.js?

**Answer:**

Next.js has a specific convention for environment variables:

```bash
# .env.local (gitignored - local secrets)
DATABASE_URL=postgresql://localhost:5432/mydb
SECRET_KEY=super-secret-value

# Exposed to the browser (NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Rules:**

| Variable | Server Components | Client Components | API Routes |
|---|---|---|---|
| `DATABASE_URL` | Yes | **NO** | Yes |
| `NEXT_PUBLIC_API_URL` | Yes | Yes | Yes |

```tsx
// Server Component - works
async function ServerPage() {
  const dbUrl = process.env.DATABASE_URL; // Available
  const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Also available
}

// Client Component - only NEXT_PUBLIC_ works
'use client';
function ClientComp() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Works (inlined at build time)
  const dbUrl = process.env.DATABASE_URL; // undefined!
}
```

**Loading order:**

1. `.env` (all environments)
2. `.env.local` (all environments, gitignored)
3. `.env.development` / `.env.production`
4. `.env.development.local` / `.env.production.local`

**Security rule:** Never put secrets in `NEXT_PUBLIC_` variables. They're embedded in the JavaScript bundle and visible to anyone.

**Why interviewer asks this:** A misunderstanding here can leak secrets or cause bugs from undefined variables.

**Follow-up:** *What happens if you access a non-`NEXT_PUBLIC_` variable in a Client Component?*

It's `undefined`. Next.js strips non-prefixed variables from the client bundle for security. This is a common source of bugs when migrating code from server to client.

---

# Advanced Level

## Q21. Explain the Next.js caching architecture in depth.

**Answer:**

Next.js has **four layers of caching**, and understanding them is essential for debugging unexpected behavior.

### 1. Request Memoization (React-level)

**What:** Deduplicates identical `fetch` calls within a single server render.

```tsx
// Both calls in the same render → only 1 network request
async function Header() {
  const user = await fetch('/api/user'); // Actual request
}
async function Sidebar() {
  const user = await fetch('/api/user'); // Deduped - uses memoized result
}
```

**Scope:** Single server request. Cleared when the render completes.

### 2. Data Cache (Next.js-level)

**What:** Persists `fetch` results **across requests and deployments**.

```tsx
// Cached indefinitely (default)
fetch('https://api.example.com/data');

// Opt out - fresh every request
fetch('https://api.example.com/data', { cache: 'no-store' });

// Time-based revalidation
fetch('https://api.example.com/data', { next: { revalidate: 3600 } });
```

**Invalidation:**
```tsx
// Time-based
{ next: { revalidate: 60 } }

// On-demand by tag
fetch(url, { next: { tags: ['products'] } });
// Later:
revalidateTag('products');

// On-demand by path
revalidatePath('/blog');
```

### 3. Full Route Cache (Next.js-level)

**What:** Caches the **rendered HTML and RSC payload** of static routes at build time.

- Static routes → cached at build time, served from cache
- Dynamic routes (using `cookies()`, `headers()`, `searchParams`, `cache: 'no-store'`) → NOT cached

### 4. Router Cache (Client-level)

**What:** In-browser cache of visited routes' RSC payloads.

- **Static routes** → cached for 5 minutes
- **Dynamic routes** → cached for 30 seconds
- Navigating back to a cached route is **instant**
- `router.refresh()` clears this cache

### Opting out of caching

```tsx
// Route segment level
export const dynamic = 'force-dynamic'; // Like getServerSideProps
export const revalidate = 0; // No cache

// Per-fetch level
fetch(url, { cache: 'no-store' });

// Entire route is dynamic if you use:
cookies(), headers(), searchParams, or any cache: 'no-store' fetch
```

### Debugging mental model

```
Request → Router Cache (browser)
       → Full Route Cache (server static HTML)
       → Data Cache (fetch results)
       → Request Memoization (dedup within render)
       → Origin (actual API/DB call)
```

**Why interviewer asks this:** The caching model is the most complex and misunderstood part of Next.js. Senior developers must understand it.

**Follow-up:** *You updated a product's price in the database, but the product page still shows the old price. Walk through the debugging steps.*

1. Check if `fetch` is using default caching (it is by default) - add `cache: 'no-store'` or `revalidate`
2. Check if you're using `unstable_cache` without proper revalidation tags
3. Check the Full Route Cache - run `next build` and see if the route is marked `Static` or `Dynamic`
4. Check the Router Cache - `router.refresh()` or hard reload
5. For ISR, call `revalidatePath('/products/[id]')` or `revalidateTag('product-123')` after updating the DB

---

## Q22. What are Route Segment Config options?

**Answer:**

These are exports from `page.tsx` or `layout.tsx` that control how a route segment behaves.

```tsx
// app/products/page.tsx

// Force dynamic rendering (disable all caching)
export const dynamic = 'force-dynamic';
// Options: 'auto' | 'force-dynamic' | 'error' | 'force-static'

// Revalidation period
export const revalidate = 60; // ISR every 60 seconds
// 0 = no cache, false = cache forever

// Runtime
export const runtime = 'edge'; // or 'nodejs' (default)

// Dynamic params behavior
export const dynamicParams = true; // Allow params not in generateStaticParams

// Max duration for serverless function
export const maxDuration = 30; // seconds

// Fetch cache behavior
export const fetchCache = 'default-cache'; // or 'only-cache', 'force-cache', etc.
```

**`dynamic` options explained:**

| Value | Behavior |
|---|---|
| `'auto'` | Default - Next.js decides based on usage |
| `'force-dynamic'` | Always SSR, no caching (like `getServerSideProps`) |
| `'force-static'` | Forces SSG, errors if you use dynamic functions |
| `'error'` | Forces SSG, throws an error if dynamic functions are detected |

**Why interviewer asks this:** Shows knowledge of fine-grained control over rendering behavior.

**Follow-up:** *What happens if a layout sets `dynamic = 'force-static'` but a child page uses `cookies()`?*

It throws a build error. The child page requires dynamic rendering but the parent forces static. You'd need to remove the constraint from the layout or restructure your components.

---

## Q23. Explain streaming and Suspense in Next.js.

**Answer:**

Streaming lets the server **send HTML progressively** as it's generated, instead of waiting for the entire page to render.

### How it works

Traditional SSR:
```
Server: fetch all data → render all HTML → send complete response
```

Streaming SSR:
```
Server: send shell HTML instantly → stream in sections as they resolve
```

### Implementation with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1> {/* Sent immediately */}

      <Suspense fallback={<p>Loading revenue...</p>}>
        <Revenue /> {/* Streamed when data resolves */}
      </Suspense>

      <Suspense fallback={<p>Loading orders...</p>}>
        <RecentOrders /> {/* Streamed independently */}
      </Suspense>
    </div>
  );
}

// This component is async - it triggers streaming
async function Revenue() {
  const data = await fetch('https://api.example.com/revenue'); // Slow API
  return <div>Revenue: ${data.total}</div>;
}

async function RecentOrders() {
  const orders = await fetch('https://api.example.com/orders'); // Faster API
  return <ul>{orders.map(o => <li key={o.id}>{o.name}</li>)}</ul>;
}
```

### What the browser receives

```
1. Instant: <h1>Dashboard</h1> + both loading fallbacks
2. After 200ms: RecentOrders data replaces its fallback
3. After 800ms: Revenue data replaces its fallback
```

Each section resolves independently. Users see a progressively completed page.

### The underlying mechanism

Next.js uses **React Server Components streaming** over HTTP with `Transfer-Encoding: chunked`. The initial HTML includes the Suspense fallbacks, and subsequent chunks include the resolved content plus a `<script>` tag that swaps the fallback for the real content.

**Why interviewer asks this:** Streaming is a performance feature that separates intermediate from advanced engineers.

**Follow-up:** *How does streaming affect Time to First Byte (TTFB) and Largest Contentful Paint (LCP)?*

Streaming dramatically improves **TTFB** because the server sends the initial shell immediately. **LCP** improves if the largest content element is in the shell; if it's behind a Suspense boundary, LCP depends on when that chunk arrives.

---

## Q24. How does authentication work in Next.js? Explain different strategies.

**Answer:**

### Strategy 1: Middleware-based auth (most common)

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      await verifyToken(token); // JWT verification
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

### Strategy 2: Server Component auth check

```tsx
// app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) {
    redirect('/login');
  }

  const user = await verifySession(session);

  if (!user) {
    redirect('/login');
  }

  return <Dashboard user={user} />;
}
```

### Strategy 3: NextAuth.js (Auth.js) integration

```tsx
// auth.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
});

// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;

// In Server Component
import { auth } from '@/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    return <SignInButton />;
  }

  return <p>Welcome {session.user.name}</p>;
}
```

### Best practices

1. **Middleware** for route protection (redirects unauthenticated users before the page even renders)
2. **Server Components** for data-gating (fetch user-specific data safely)
3. **Never** check auth only in Client Components (can be bypassed)
4. Use **HTTP-only cookies** for session tokens (not localStorage)
5. Validate sessions on **every request** (middleware), not just login

**Why interviewer asks this:** Authentication is in every real app. Incorrect implementation is a security vulnerability.

**Follow-up:** *How do you protect both pages AND API routes?*

Middleware protects both - it runs before any route. For API routes specifically, add an extra check:

```tsx
// app/api/admin/route.ts
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }
  // ...
}
```

---

## Q25. Explain the difference between Edge Runtime and Node.js Runtime.

**Answer:**

Next.js supports two server runtimes:

### Node.js Runtime (default)

```tsx
export const runtime = 'nodejs';
```

- Full Node.js API access (`fs`, `crypto`, `Buffer`, native modules)
- No cold start limitations
- Can use any npm package
- Deployed as serverless functions or traditional servers
- Higher latency (runs in specific regions)

### Edge Runtime

```tsx
export const runtime = 'edge';
```

- Runs on V8 isolates (like Cloudflare Workers)
- **~0ms cold start** (vs 250ms+ for Node.js serverless)
- Deployed globally (runs at CDN edge locations)
- Limited API: no `fs`, no native modules, limited `crypto`
- Smaller maximum execution time
- Smaller bundle size limit (~1-4MB)

### When to use Edge

| Use Case | Runtime |
|---|---|
| Middleware | Always Edge |
| Auth checks | Edge (fast, global) |
| A/B testing | Edge |
| Database queries | Node.js (needs DB drivers) |
| Image processing | Node.js (needs native libs) |
| Simple API transformations | Edge |
| Heavy computation | Node.js |

```tsx
// Edge Route Handler
export const runtime = 'edge';

export async function GET(request: Request) {
  // Limited to Web APIs (fetch, crypto.subtle, TextEncoder, etc.)
  const data = await fetch('https://api.example.com/data');
  return Response.json(await data.json());
}
```

**Why interviewer asks this:** Shows understanding of deployment architecture and performance trade-offs.

**Follow-up:** *Can you use Prisma or Drizzle ORM at the Edge?*

Prisma requires the **Prisma Accelerate** proxy or **Prisma Data Proxy** for Edge compatibility. Drizzle works with Edge-compatible drivers like `@planetscale/database`, `@vercel/postgres`, or `d1` (Cloudflare). Traditional database drivers (pg, mysql2) don't work at the Edge.

---

## Q26. Debugging scenario: Your page renders stale data after a mutation.

**Answer:**

This is a classic caching issue. Let me walk through the debugging process:

### Step 1: Identify the caching layer

```tsx
// Check 1: Is the fetch cached?
const data = await fetch('/api/products', {
  cache: 'no-store'  // Add this to rule out Data Cache
});

// Check 2: Is it the Router Cache?
// In your client component, after mutation:
router.refresh(); // This clears the Router Cache and refetches Server Components
```

### Step 2: Check your mutation flow

**Bad pattern:**
```tsx
'use client';
async function handleDelete(id: string) {
  await fetch(`/api/products/${id}`, { method: 'DELETE' });
  // Page still shows old data! No revalidation triggered.
}
```

**Fixed pattern using Server Action:**
```tsx
'use server';
import { revalidatePath } from 'next/cache';

export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } });
  revalidatePath('/products'); // Invalidates the Full Route Cache + Data Cache
}
```

**Fixed pattern using Route Handler + client revalidation:**
```tsx
'use client';
import { useRouter } from 'next/navigation';

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    router.refresh(); // Refetch all Server Components on this page
  }
}
```

### Step 3: Check for ISR revalidation

If using ISR, the page won't update until the revalidation period passes:

```tsx
// If revalidate = 3600, data can be up to 1 hour stale
fetch(url, { next: { revalidate: 3600 } });

// Fix: Use on-demand revalidation
import { revalidateTag } from 'next/cache';

// In your mutation:
revalidateTag('products');
```

### The complete mental model

```
Mutation happens →
  1. revalidatePath/revalidateTag (server cache) ✓
  2. router.refresh() (client Router Cache) ✓
  3. Both are needed for full freshness ✓
```

**Why interviewer asks this:** Debugging stale data is the #1 problem developers face with the App Router. This tests real-world problem-solving.

**Follow-up:** *What's the difference between `revalidatePath` and `revalidateTag`?*

`revalidatePath('/products')` invalidates everything on that specific path. `revalidateTag('products')` invalidates all `fetch` calls tagged with `'products'` - which could span multiple routes. Tags are more surgical and scalable.

---

## Q27. Output-based question: What does this code render and why?

```tsx
// app/page.tsx
import ClientCounter from './ClientCounter';

let serverCount = 0;

export default function Home() {
  serverCount++;
  console.log('Server count:', serverCount);

  return (
    <div>
      <p>Server count: {serverCount}</p>
      <ClientCounter />
    </div>
  );
}
```

```tsx
// app/ClientCounter.tsx
'use client';
import { useState } from 'react';

let clientCount = 0;

export default function ClientCounter() {
  const [stateCount, setStateCount] = useState(0);
  clientCount++;

  return (
    <div>
      <p>Client module count: {clientCount}</p>
      <p>State count: {stateCount}</p>
      <button onClick={() => setStateCount(s => s + 1)}>Increment</button>
    </div>
  );
}
```

**Answer:**

**First visit:**
- `Server count: 1` - Server Component executes on the server. `serverCount` increments.
- `Client module count: 1` - ClientCounter renders initially.
- `State count: 0` - useState initializes to 0.

**Click button once:**
- Server count stays `1` (no server re-render)
- `Client module count: 2` - component re-renders, module-level `clientCount` increments
- `State count: 1`

**Navigate away and back (client-side):**
- `Server count: 1` (may show cached version due to Router Cache)
- `Client module count` keeps incrementing (module stays in memory)
- `State count: 0` (fresh mount, useState resets)

**Hard refresh:**
- `Server count: 2` on server (or 1 if serverless function cold starts - module-level state is unreliable in serverless)
- `Client module count: 1` (fresh module load)
- `State count: 0`

**Key lessons:**
1. Module-level variables in Server Components are **unreliable** in serverless (cold starts reset them)
2. Module-level variables in Client Components persist across re-renders but reset on page reload
3. `useState` is the correct way to track mutable state in Client Components

**Why interviewer asks this:** Tests deep understanding of server vs client execution models and module scope.

---

## Q28. How do you optimize bundle size in Next.js?

**Answer:**

### 1. Analyze your bundle first

```bash
# Install analyzer
npm install @next/bundle-analyzer

# next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);

# Run analysis
ANALYZE=true npm run build
```

### 2. Use dynamic imports for heavy components

```tsx
import dynamic from 'next/dynamic';

// Loaded only when rendered
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Skip SSR if it uses browser APIs
});

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart />
    </div>
  );
}
```

### 3. Keep Client Components minimal

```tsx
// BAD - entire page is a client component
'use client';
import HugeLibrary from 'huge-library';
export default function Page() { ... }

// GOOD - only the interactive part is client
// page.tsx (Server Component)
import InteractiveWidget from './InteractiveWidget';
export default function Page() {
  return (
    <div>
      <h1>Static content</h1> {/* No JS sent */}
      <InteractiveWidget /> {/* Only this sends JS */}
    </div>
  );
}
```

### 4. Tree-shake imports

```tsx
// BAD - imports entire library
import _ from 'lodash';
_.debounce(fn, 300);

// GOOD - imports only the function
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

### 5. Use `next/dynamic` for conditional features

```tsx
const AdminPanel = dynamic(() => import('./AdminPanel'));

function Page({ user }) {
  return (
    <div>
      <Content />
      {user.isAdmin && <AdminPanel />}
    </div>
  );
}
```

### 6. Leverage Server Components

Anything that doesn't need interactivity should be a Server Component - its code is **never sent to the browser**.

**Why interviewer asks this:** Performance optimization is a senior-level concern.

**Follow-up:** *How does Next.js handle code splitting automatically?*

Every route is automatically code-split. Navigating to `/about` only loads the JS for that route. Additionally, shared modules between routes are extracted into common chunks to avoid duplication.

---

## Q29. Explain Partial Prerendering (PPR) in Next.js.

**Answer:**

PPR is an **experimental rendering strategy** (Next.js 14+) that combines **static and dynamic rendering in a single route**.

### The problem PPR solves

Before PPR, a route was either fully static or fully dynamic. If even one tiny part (like a user avatar) was dynamic, the **entire page** became dynamic - losing SSG benefits.

### How PPR works

```
Build time: Pre-render static shell (HTML) with Suspense holes
Request time: Stream dynamic content into the holes
```

```tsx
// app/product/[id]/page.tsx
import { Suspense } from 'react';

export default function ProductPage({ params }) {
  return (
    <div>
      {/* Static - pre-rendered at build time */}
      <ProductDetails id={params.id} />
      <ProductImages id={params.id} />

      {/* Dynamic - streamed at request time */}
      <Suspense fallback={<PriceSkeleton />}>
        <DynamicPrice id={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <UserReviews id={params.id} />
      </Suspense>
    </div>
  );
}
```

### What happens at request time

1. **Instant:** The static shell (product details, images) is served from CDN cache - like SSG
2. **Streamed:** The Suspense boundaries (price, reviews) are filled in as they resolve - like SSR streaming

### Enabling PPR

```js
// next.config.js
module.exports = {
  experimental: {
    ppr: true,
  },
};
```

### Benefits

| Metric | Without PPR | With PPR |
|---|---|---|
| TTFB | Slow (full dynamic) | Fast (static shell from CDN) |
| FCP | Slow | Instant (static content visible) |
| Data freshness | Fresh | Static parts cached, dynamic parts fresh |

**Why interviewer asks this:** PPR is the cutting-edge direction of Next.js. Knowing it shows you're following the evolution of the framework.

**Follow-up:** *How does PPR differ from ISR?*

ISR regenerates the **entire page** after a time interval. PPR renders the **static parts once** and **streams only the dynamic parts** on every request. PPR is more granular - parts of the page are static, others are dynamic, within the same render.

---

## Q30. Explain how `next.config.js` works and key configuration options.

**Answer:**

`next.config.js` (or `next.config.mjs` / `next.config.ts`) is the central configuration file.

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Redirect rules
  async redirects() {
    return [
      {
        source: '/old-blog/:slug',
        destination: '/blog/:slug',
        permanent: true, // 308 status code
      },
    ];
  },

  // URL rewrites (proxy)
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'https://external-api.com/:path*',
      },
    ];
  },

  // Custom headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables (build-time)
  env: {
    CUSTOM_VAR: 'value',
  },

  // Webpack customization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }
    return config;
  },

  // Output mode for deployment
  output: 'standalone', // For Docker deployments

  // Strict mode
  reactStrictMode: true,

  // Turbopack (experimental)
  experimental: {
    ppr: true,
    serverActions: { bodySizeLimit: '2mb' },
  },
};

module.exports = nextConfig;
```

**Why interviewer asks this:** Configuration knowledge separates developers who've deployed production apps from those who've only done tutorials.

**Follow-up:** *What does `output: 'standalone'` do?*

It creates a self-contained build in `.next/standalone` that includes only the files needed to run the app - no `node_modules`. This is critical for Docker deployments where image size matters:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

---

# Real-World / System Design Level

## Q31. Design a large-scale e-commerce platform with Next.js.

**Answer:**

### Requirements
- Product catalog (millions of products)
- User authentication
- Shopping cart
- Checkout with payment
- Search with filters
- Admin dashboard
- SEO optimized

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          CDN (Vercel Edge)                     │
│   Static assets, ISR pages, Edge Middleware (auth, geo)       │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                     Next.js Application                        │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │ Public Pages  │  │ Auth Pages   │  │ Admin Dashboard│       │
│  │ (SSG/ISR)     │  │ (SSR)        │  │ (SSR + Client) │       │
│  └──────────────┘  └──────────────┘  └───────────────┘       │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │ Server Actions│  │ Route Handler│  │  Middleware     │       │
│  │ (mutations)   │  │ (webhooks)   │  │  (auth, A/B)   │       │
│  └──────────────┘  └──────────────┘  └───────────────┘       │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                      Backend Services                          │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │ PostgreSQL  │  │   Redis    │  │ Elasticsearch│              │
│  │ (products,  │  │ (sessions, │  │ (search,     │              │
│  │  orders)    │  │  cart)     │  │  filters)    │              │
│  └────────────┘  └────────────┘  └────────────┘              │
│                                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Stripe     │  │ S3/R2      │  │ Resend      │              │
│  │ (payments) │  │ (images)   │  │ (emails)    │              │
│  └────────────┘  └────────────┘  └────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### Rendering strategy per route

| Route | Strategy | Why |
|---|---|---|
| `/` (homepage) | ISR (60s) | Changes infrequently, high traffic |
| `/products/[slug]` | ISR (300s) + on-demand | Millions of pages, can't SSG all |
| `/search` | SSR | Dynamic (query params, filters) |
| `/cart` | CSR | User-specific, no SEO needed |
| `/checkout` | SSR | Secure, personalized |
| `/account/*` | SSR | Protected, personalized |
| `/blog/[slug]` | SSG | Static content, rarely changes |
| `/admin/*` | SSR + CSR | Protected, interactive |

### Product pages with ISR

```tsx
// app/products/[slug]/page.tsx
import { notFound } from 'next/navigation';

// Pre-render top 1000 products at build time
export async function generateStaticParams() {
  const topProducts = await db.product.findMany({
    orderBy: { views: 'desc' },
    take: 1000,
    select: { slug: true },
  });
  return topProducts.map(p => ({ slug: p.slug }));
}

export const dynamicParams = true; // Generate others on demand

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetch(`${API}/products/${params.slug}`, {
    next: { tags: [`product-${params.slug}`], revalidate: 300 },
  });

  if (!product) notFound();

  return (
    <div>
      <ProductImages images={product.images} />
      <ProductInfo product={product} />
      <Suspense fallback={<PriceSkeleton />}>
        <LivePrice productId={product.id} /> {/* Real-time price */}
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={product.id} />
      </Suspense>
      <AddToCartButton product={product} />
    </div>
  );
}
```

### On-demand revalidation via webhook

```tsx
// app/api/webhooks/product-update/route.ts
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const { slug, secret } = await request.json();

  if (secret !== process.env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  revalidateTag(`product-${slug}`);
  return Response.json({ revalidated: true });
}
```

### Shopping cart with Redis

```tsx
// Server Action for cart operations
'use server';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

export async function addToCart(productId: string, quantity: number) {
  const cartId = cookies().get('cart-id')?.value ?? createCartId();

  await redis.hset(`cart:${cartId}`, productId, quantity);

  revalidateTag('cart');
}
```

### Key architectural decisions

1. **Middleware** handles auth, geo-routing, and A/B tests (Edge, fast)
2. **Server Components** for product data (no JS shipped for static content)
3. **Client Components** only for interactive elements (cart button, search input, filters)
4. **Server Actions** for mutations (add to cart, checkout, update profile)
5. **Route Handlers** for webhooks and external API consumers
6. **Redis** for sessions and cart (fast, ephemeral data)
7. **Elasticsearch** for search (full-text, faceted filtering)
8. **ISR + on-demand revalidation** for product pages (fresh data without full rebuilds)

**Why interviewer asks this:** Tests your ability to architect a real system, not just use individual features.

**Follow-up:** *How would you handle 10,000 concurrent users during a flash sale?*

- ISR pages served from CDN (no server load for cached pages)
- Cart/checkout: queue-based system with Redis to handle burst writes
- Rate limiting in middleware
- Optimistic UI updates on client (add-to-cart feels instant)
- Server Actions with proper locking to prevent overselling
- Edge middleware to show a waiting room if server capacity is reached

---

## Q32. Design a multi-tenant SaaS application with Next.js.

**Answer:**

### Requirements
- Each tenant has a subdomain: `acme.app.com`, `globex.app.com`
- Shared codebase, isolated data
- Custom branding per tenant
- Role-based access control

### Subdomain-based routing with Middleware

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';

  // Extract subdomain: acme.app.com → acme
  const subdomain = hostname.split('.')[0];

  // Skip for main domain and API routes
  if (subdomain === 'www' || subdomain === 'app' || request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Rewrite to tenant-specific path
  // acme.app.com/dashboard → app.com/_tenant/acme/dashboard
  const url = request.nextUrl.clone();
  url.pathname = `/_tenant/${subdomain}${url.pathname}`;

  return NextResponse.rewrite(url);
}
```

### File structure

```
app/
├── _tenant/
│   └── [tenant]/
│       ├── layout.tsx       ← Tenant-specific layout (branding)
│       ├── page.tsx         ← Tenant dashboard
│       ├── settings/
│       │   └── page.tsx
│       └── members/
│           └── page.tsx
├── (marketing)/              ← Public marketing site
│   ├── page.tsx
│   └── pricing/
│       └── page.tsx
└── api/
    └── webhooks/
        └── route.ts
```

### Tenant context

```tsx
// lib/tenant.ts
import { headers } from 'next/headers';
import { cache } from 'react';
import { db } from '@/lib/db';

export const getCurrentTenant = cache(async () => {
  const headersList = headers();
  const host = headersList.get('host') ?? '';
  const subdomain = host.split('.')[0];

  const tenant = await db.tenant.findUnique({
    where: { subdomain },
    include: { branding: true },
  });

  return tenant;
});

// app/_tenant/[tenant]/layout.tsx
export default async function TenantLayout({ children, params }) {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    notFound();
  }

  return (
    <div style={{
      '--primary-color': tenant.branding.primaryColor,
      '--logo-url': `url(${tenant.branding.logoUrl})`,
    } as React.CSSProperties}>
      <TenantNav tenant={tenant} />
      {children}
    </div>
  );
}
```

### Data isolation

```tsx
// Every database query scoped to tenant
async function getProjects(tenantId: string) {
  return db.project.findMany({
    where: { tenantId }, // Always filter by tenant
    orderBy: { createdAt: 'desc' },
  });
}

// Server Component
export default async function ProjectsPage({ params }) {
  const tenant = await getCurrentTenant();
  const projects = await getProjects(tenant.id);

  return <ProjectList projects={projects} />;
}
```

### Key design decisions

1. **Middleware rewrites** map subdomains to routes (no separate deploys per tenant)
2. **`cache()`** prevents duplicate tenant lookups per request
3. **Row-Level Security** in PostgreSQL ensures data isolation at the DB level
4. **CSS custom properties** for per-tenant branding (no separate CSS bundles)
5. **ISR** for tenant pages with tag-based revalidation per tenant

**Why interviewer asks this:** Multi-tenancy is a complex real-world pattern that tests architectural depth.

**Follow-up:** *How would you handle custom domains (not just subdomains) per tenant?*

Use middleware to look up the full hostname in a domains table, then rewrite the same way. On the infrastructure side, configure a wildcard SSL certificate or use a service like Vercel's custom domains API.

---

## Q33. How would you implement real-time features in a Next.js application?

**Answer:**

### Option 1: Server-Sent Events (SSE) via Route Handlers

```tsx
// app/api/notifications/route.ts
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Listen for events (e.g., from Redis pub/sub)
      const subscriber = redis.subscribe('notifications', (message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      });

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        subscriber.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

```tsx
// Client Component
'use client';
import { useEffect, useState } from 'react';

function Notifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/notifications');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifications(prev => [...prev, data]);
    };

    return () => eventSource.close();
  }, []);

  return <ul>{notifications.map(n => <li key={n.id}>{n.message}</li>)}</ul>;
}
```

### Option 2: WebSockets with a separate server

```tsx
// Custom server approach (pages/_app or standalone WS server)
// next.config.js is NOT involved - WS runs alongside Next.js

// In production: use a dedicated WebSocket service (Pusher, Ably, Socket.io)
// and connect from Client Components

'use client';
import { useEffect } from 'react';
import Pusher from 'pusher-js';

function LiveChat({ channelId }: { channelId: string }) {
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: 'us2',
    });

    const channel = pusher.subscribe(`chat-${channelId}`);
    channel.bind('new-message', (data: Message) => {
      // Handle new message
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [channelId]);
}
```

### Option 3: Polling with `router.refresh()`

For simpler cases where near-real-time is acceptable:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function LiveDashboard() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh(); // Re-fetch all server components
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [router]);
}
```

### When to use which

| Approach | Latency | Complexity | Scale |
|---|---|---|---|
| Polling + refresh | 5-30s | Low | Good |
| SSE | ~instant | Medium | Medium (connection per client) |
| WebSockets | ~instant | High | Needs dedicated infra |
| Third-party (Pusher) | ~instant | Low | Excellent |

**Why interviewer asks this:** Real-time features are common requirements, and Next.js doesn't have built-in WebSocket support.

**Follow-up:** *How does real-time interact with Server Components?*

Server Components can't maintain persistent connections (they render once). Real-time state must live in **Client Components**. The pattern is: Server Component fetches initial data, Client Component subscribes to updates and merges them.

---

## Q34. How do you handle internationalization (i18n) in Next.js App Router?

**Answer:**

### Approach: Locale in URL path

```
/en/about
/fr/about
/de/about
```

### Middleware for locale detection

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const locales = ['en', 'fr', 'de', 'ja'];
const defaultLocale = 'en';

function getLocale(request: NextRequest): string {
  const negotiator = new Negotiator({
    headers: { 'accept-language': request.headers.get('accept-language') ?? '' },
  });
  const languages = negotiator.languages();
  return match(languages, locales, defaultLocale);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname has a locale
  const hasLocale = locales.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (hasLocale) return NextResponse.next();

  // Redirect to detected locale
  const locale = getLocale(request);
  return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### File structure

```
app/
└── [locale]/
    ├── layout.tsx
    ├── page.tsx
    └── about/
        └── page.tsx

dictionaries/
├── en.json
├── fr.json
└── de.json
```

### Dictionary loading

```tsx
// lib/dictionaries.ts
const dictionaries = {
  en: () => import('../dictionaries/en.json').then(m => m.default),
  fr: () => import('../dictionaries/fr.json').then(m => m.default),
  de: () => import('../dictionaries/de.json').then(m => m.default),
};

export async function getDictionary(locale: string) {
  return dictionaries[locale as keyof typeof dictionaries]();
}

// app/[locale]/page.tsx
export default async function Home({ params }: { params: { locale: string } }) {
  const dict = await getDictionary(params.locale);

  return (
    <div>
      <h1>{dict.home.title}</h1>
      <p>{dict.home.description}</p>
    </div>
  );
}
```

### Language switcher

```tsx
'use client';
import { usePathname, useRouter } from 'next/navigation';

function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(locale: string) {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    router.push(newPath);
  }

  return (
    <select value={currentLocale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="fr">Français</option>
      <option value="de">Deutsch</option>
    </select>
  );
}
```

**Why interviewer asks this:** i18n is common in enterprise apps and tests understanding of middleware + dynamic routing.

**Follow-up:** *How do you generate SEO metadata for each locale?*

```tsx
export async function generateMetadata({ params }: { params: { locale: string } }) {
  const dict = await getDictionary(params.locale);
  return {
    title: dict.meta.title,
    alternates: {
      languages: {
        en: '/en',
        fr: '/fr',
        de: '/de',
      },
    },
  };
}
```

---

## Q35. You need to migrate a large Pages Router application to App Router. Walk through your strategy.

**Answer:**

### Phase 1: Setup coexistence

Both routers can coexist. The `app/` directory takes precedence for matching routes.

```
// Start with app/ directory and root layout
app/
├── layout.tsx     ← Required: create root layout from _app.tsx + _document.tsx
pages/
├── index.tsx      ← Existing routes continue working
├── about.tsx
├── dashboard.tsx
```

```tsx
// app/layout.tsx - migrate from _app.tsx + _document.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers> {/* Context providers from _app.tsx */}
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
```

### Phase 2: Migrate route by route (lowest risk first)

**Priority order:**
1. Simple static pages first (about, terms, etc.)
2. Dynamic content pages (blog posts, products)
3. Authenticated pages (dashboard, settings)
4. Complex interactive pages (forms, wizards)

```
// Migration of /about
// Before: pages/about.tsx
// After:  app/about/page.tsx  ← create this, then delete pages/about.tsx
```

### Phase 3: Migrate data fetching

```tsx
// BEFORE (Pages Router)
export async function getServerSideProps() {
  const data = await fetch('https://api.example.com/data');
  return { props: { data: await data.json() } };
}
export default function Page({ data }) {
  return <div>{data.title}</div>;
}

// AFTER (App Router)
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store', // Equivalent of getServerSideProps
  });
  const json = await data.json();
  return <div>{json.title}</div>;
}
```

### Phase 4: Convert to Server/Client Components

```tsx
// Identify which components need 'use client'
// Rule: Only add 'use client' to components that use:
// - useState, useEffect, useRef
// - onClick, onChange, onSubmit
// - Browser APIs (window, document, localStorage)

// Everything else stays as Server Components (better performance)
```

### Phase 5: Migrate API routes

```tsx
// BEFORE: pages/api/users.ts
export default function handler(req, res) {
  if (req.method === 'GET') { res.json(users); }
}

// AFTER: app/api/users/route.ts
export async function GET() {
  return Response.json(users);
}
```

### Migration checklist

- [ ] Create `app/layout.tsx` from `_app.tsx` + `_document.tsx`
- [ ] Move providers (theme, auth, state) to root layout
- [ ] Migrate static pages
- [ ] Migrate dynamic pages and convert data fetching
- [ ] Split components into Server/Client components
- [ ] Migrate API routes to Route Handlers
- [ ] Convert `getServerSideProps` → `fetch` with `cache: 'no-store'`
- [ ] Convert `getStaticProps` → `fetch` (default cached)
- [ ] Convert `getStaticPaths` → `generateStaticParams`
- [ ] Test all routes, especially auth flows
- [ ] Remove `pages/` directory when fully migrated

**Why interviewer asks this:** Migration is a real-world task. This tests practical experience, not just theoretical knowledge.

**Follow-up:** *What's the biggest risk during migration?*

**Breaking authentication.** The auth patterns are fundamentally different between routers. In Pages Router, auth is often in `getServerSideProps`. In App Router, it's in middleware or Server Components. If you migrate a page but forget to migrate its auth check, you expose a protected route.

---

## Q36. Coding challenge: Build a search page with URL-synced filters, debounced input, and streaming results.

**Answer:**

```tsx
// app/search/page.tsx (Server Component)
import { Suspense } from 'react';
import SearchInput from './SearchInput';
import SearchResults from './SearchResults';
import ResultsSkeleton from './ResultsSkeleton';

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; page?: string };
}) {
  const query = searchParams.q ?? '';
  const category = searchParams.category ?? 'all';
  const page = Number(searchParams.page ?? '1');

  // Key forces Suspense to show fallback when params change
  const searchKey = `${query}-${category}-${page}`;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <SearchInput defaultQuery={query} defaultCategory={category} />

      <Suspense key={searchKey} fallback={<ResultsSkeleton />}>
        <SearchResults query={query} category={category} page={page} />
      </Suspense>
    </div>
  );
}
```

```tsx
// app/search/SearchInput.tsx (Client Component)
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useRef, useCallback } from 'react';

export default function SearchInput({
  defaultQuery,
  defaultCategory,
}: {
  defaultQuery: string;
  defaultCategory: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset page on new search
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  function handleSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateParams('q', e.target.value);
    }, 300); // 300ms debounce
  }

  return (
    <div className="flex gap-4 mb-6">
      <input
        type="text"
        defaultValue={defaultQuery}
        onChange={handleSearchInput}
        placeholder="Search products..."
        className="flex-1 border rounded px-4 py-2"
      />
      <select
        defaultValue={defaultCategory}
        onChange={(e) => updateParams('category', e.target.value)}
        className="border rounded px-4 py-2"
      >
        <option value="all">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
        <option value="books">Books</option>
      </select>
    </div>
  );
}
```

```tsx
// app/search/SearchResults.tsx (Server Component - async)
import Link from 'next/link';

export default async function SearchResults({
  query,
  category,
  page,
}: {
  query: string;
  category: string;
  page: number;
}) {
  if (!query) {
    return <p className="text-gray-500">Enter a search term to find products.</p>;
  }

  const results = await fetch(
    `${process.env.API_URL}/search?q=${encodeURIComponent(query)}&category=${category}&page=${page}`,
    { cache: 'no-store' } // Always fresh search results
  ).then(r => r.json());

  if (results.items.length === 0) {
    return <p>No results found for "{query}"</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{results.total} results</p>
      <ul className="space-y-4">
        {results.items.map((item: Product) => (
          <li key={item.id} className="border rounded p-4">
            <Link href={`/products/${item.slug}`}>
              <h2 className="font-semibold">{item.name}</h2>
              <p className="text-gray-600">{item.description}</p>
              <span className="text-green-600 font-bold">${item.price}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Pagination */}
      <div className="flex gap-2 mt-6">
        {page > 1 && (
          <Link href={`/search?q=${query}&category=${category}&page=${page - 1}`}>
            Previous
          </Link>
        )}
        {results.hasMore && (
          <Link href={`/search?q=${query}&category=${category}&page=${page + 1}`}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
```

**Key patterns demonstrated:**
1. **URL-synced state** - filters are in `searchParams`, shareable and bookmarkable
2. **Debounced input** - 300ms delay prevents API spam while typing
3. **Streaming** - `<Suspense>` shows skeleton while `SearchResults` fetches data
4. **`key` on Suspense** - forces re-trigger when search params change
5. **Server/Client split** - input is client (interactive), results are server (no JS sent)

**Why interviewer asks this:** Combines multiple concepts: streaming, server/client split, URL state, debouncing.

**Follow-up:** *How would you add "search as you type" suggestions without a full page re-render?*

Use a separate Client Component with its own `fetch` call (not through `searchParams`/server re-render) and a dropdown overlay. This keeps suggestions client-side and fast while full results still stream from the server.

---

## Q37. How do you handle testing in a Next.js application?

**Answer:**

### Unit testing with Jest + React Testing Library

```tsx
// __tests__/components/ProductCard.test.tsx
import { render, screen } from '@testing-library/react';
import ProductCard from '@/components/ProductCard';

describe('ProductCard', () => {
  it('renders product information', () => {
    render(
      <ProductCard
        product={{ name: 'Widget', price: 29.99, image: '/widget.jpg' }}
      />
    );

    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });
});
```

### Testing Server Components

Server Components can't be tested with standard React Testing Library (they're async). Test them by:

```tsx
// Option 1: Test the data fetching logic separately
// lib/__tests__/getProducts.test.ts
import { getProducts } from '@/lib/data';

jest.mock('@/lib/db', () => ({
  product: {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', name: 'Widget' },
    ]),
  },
}));

test('getProducts returns products', async () => {
  const products = await getProducts();
  expect(products).toHaveLength(1);
});

// Option 2: Use next/experimental/testing for Server Components
```

### E2E testing with Playwright

```tsx
// e2e/search.spec.ts
import { test, expect } from '@playwright/test';

test('search page filters products', async ({ page }) => {
  await page.goto('/search?q=laptop');

  // Wait for streaming results
  await expect(page.getByText('results')).toBeVisible();

  // Filter by category
  await page.selectOption('select', 'electronics');

  // URL should update
  await expect(page).toHaveURL(/category=electronics/);

  // Results should update
  await expect(page.getByText('Loading')).not.toBeVisible();
});

test('authenticated routes redirect to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});
```

### Testing API Route Handlers

```tsx
// __tests__/api/users.test.ts
import { GET, POST } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

test('GET /api/users returns users', async () => {
  const request = new NextRequest('http://localhost:3000/api/users');
  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data).toHaveLength(2);
});

test('POST /api/users creates user', async () => {
  const request = new NextRequest('http://localhost:3000/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice', email: 'alice@test.com' }),
  });

  const response = await POST(request);
  expect(response.status).toBe(201);
});
```

**Why interviewer asks this:** Testing strategy reveals production experience.

**Follow-up:** *How would you test a Server Action?*

Call the Server Action function directly in your test (it's just an async function) and mock the database/revalidation calls:

```tsx
import { createPost } from '@/app/actions';
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

test('createPost creates a post', async () => {
  const formData = new FormData();
  formData.set('title', 'Test Post');
  formData.set('content', 'Content');

  await createPost(formData);

  expect(db.post.create).toHaveBeenCalledWith({
    data: { title: 'Test Post', content: 'Content' },
  });
});
```

---

## Q38. Explain how you'd set up a CI/CD pipeline for a Next.js application.

**Answer:**

### GitHub Actions pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check   # tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: [lint-and-typecheck, test, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Docker deployment (non-Vercel)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Why interviewer asks this:** Deployment and CI/CD are essential for senior developers.

**Follow-up:** *How do you handle preview deployments for pull requests?*

Vercel does this automatically - every PR gets a unique preview URL. For self-hosted, configure the CI to deploy to a dynamic URL like `pr-123.staging.example.com` and post the link as a PR comment.

---

## Q39. Debugging scenario: Your Next.js app is slow. Walk through your performance investigation.

**Answer:**

### Step 1: Measure with Next.js built-in analytics

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

### Step 2: Identify the bottleneck

```
Slow TTFB?
├── Yes → Server-side issue
│   ├── Slow database queries → Add indexes, optimize queries
│   ├── Slow external APIs → Add caching, parallel fetching
│   ├── No caching → Add ISR or Data Cache
│   └── Cold starts → Use Edge runtime or reduce bundle
│
├── No (fast TTFB, slow render)
│   ├── Large JS bundle → Analyze with @next/bundle-analyzer
│   ├── Hydration mismatch → Check console warnings
│   ├── Too many Client Components → Move to Server Components
│   └── Re-renders → Profile with React DevTools
│
└── Slow on subsequent navigations
    ├── Large page data → Paginate, virtualize
    └── No prefetching → Ensure <Link> is used (not <a>)
```

### Step 3: Common fixes

```tsx
// Fix 1: Parallel data fetching
// BAD
const user = await getUser();
const posts = await getPosts(); // Waits for getUser to finish

// GOOD
const [user, posts] = await Promise.all([getUser(), getPosts()]);

// Fix 2: Move heavy components to dynamic imports
const HeavyEditor = dynamic(() => import('./Editor'), { ssr: false });

// Fix 3: Use streaming for slow data
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>

// Fix 4: Cache expensive computations
import { cache } from 'react';

const getExpensiveData = cache(async (id: string) => {
  return await computeExpensiveData(id);
});

// Fix 5: Optimize images
<Image
  src={url}
  width={400}
  height={300}
  sizes="(max-width: 768px) 100vw, 400px" // Don't serve 4K images on mobile
  priority // For above-the-fold images (preloads)
/>
```

### Step 4: Check the build output

```bash
npm run build
# Look for:
# ○ (Static)  - good, served from CDN
# λ (Dynamic) - check if it should be static
# Route size  - large pages indicate bundle issues
```

**Why interviewer asks this:** Performance debugging is a senior-level skill that distinguishes experienced developers.

**Follow-up:** *How would you monitor performance in production?*

Use Vercel Analytics (Web Vitals), or integrate with Datadog/New Relic for server-side metrics. Track TTFB, FCP, LCP, CLS, and INP. Set up alerts for regressions. Use Real User Monitoring (RUM) for field data, not just lab data.

---

## Q40. Compare Next.js deployment options and trade-offs.

**Answer:**

### Option 1: Vercel (recommended)

```
Pros:
✓ Zero-config deployment
✓ Automatic preview deployments per PR
✓ Edge network built-in
✓ ISR, middleware, image optimization all work perfectly
✓ Analytics and Speed Insights integrated
✓ Serverless functions auto-scale

Cons:
✗ Vendor lock-in
✗ Expensive at scale (bandwidth costs)
✗ Limited control over infrastructure
```

### Option 2: Self-hosted (Node.js)

```bash
npm run build
npm start  # Starts Node.js server on port 3000
```

```
Pros:
✓ Full control
✓ No vendor lock-in
✓ Predictable costs
✓ Can run anywhere (AWS, GCP, bare metal)

Cons:
✗ You manage scaling, CDN, SSL
✗ ISR requires additional setup
✗ No automatic preview deployments
```

### Option 3: Docker

```
Pros:
✓ Reproducible builds
✓ Works with Kubernetes, ECS, Cloud Run
✓ output: 'standalone' keeps images small (~100MB)

Cons:
✗ Cold start for serverless containers
✗ More ops overhead
```

### Option 4: Static export

```js
// next.config.js
module.exports = { output: 'export' };
```

```
Pros:
✓ Deploy anywhere (S3, GitHub Pages, Netlify)
✓ No server needed
✓ Cheapest option

Cons:
✗ No SSR, ISR, middleware, image optimization, API routes
✗ Basically just a static site
```

### Decision matrix

| Factor | Vercel | Self-hosted | Docker | Static |
|---|---|---|---|---|
| Setup time | Minutes | Hours | Hours | Minutes |
| ISR support | Full | Manual | Manual | None |
| Middleware | Full | Full | Full | None |
| Cost at scale | $$$ | $$ | $$ | $ |
| Control | Low | High | High | N/A |
| Best for | Most apps | Enterprises | Microservices | Simple sites |

**Why interviewer asks this:** Deployment decisions impact cost, performance, and team workflow.

**Follow-up:** *Your company requires all infrastructure on AWS. How do you deploy Next.js?*

Use **AWS Amplify** (managed, supports Next.js features) or **AWS Lambda + CloudFront** via the **OpenNext** adapter (open-source Vercel alternative). For container-based: ECS Fargate or EKS with the Docker approach and `output: 'standalone'`.

---

## Quick Reference: Key Concepts Summary

| Concept | One-line explanation |
|---|---|
| Server Components | Components that run only on the server - zero JS shipped to client |
| Client Components | Components that hydrate in the browser - needed for interactivity |
| `'use client'` | Directive that marks the server/client boundary |
| `'use server'` | Directive that marks a function as a Server Action |
| ISR | Serve static pages, regenerate in background after interval |
| PPR | Static shell + dynamic holes streamed on request |
| Middleware | Edge function that runs before every request |
| Route Handlers | API endpoints in the App Router (`route.ts`) |
| Server Actions | Server functions callable from client forms/buttons |
| `loading.tsx` | Automatic Suspense fallback per route |
| `error.tsx` | Automatic error boundary per route |
| `layout.tsx` | Shared UI that persists across navigations |
| `template.tsx` | Like layout but remounts on every navigation |
| `generateStaticParams` | Defines which dynamic routes to pre-render |
| `revalidatePath` | Invalidates cache for a specific path |
| `revalidateTag` | Invalidates all fetches with a specific cache tag |
| `router.refresh()` | Clears client Router Cache, re-fetches Server Components |

---

*This guide covers 40 questions across all difficulty levels. Master these and you'll be prepared for any Next.js interview - from startup to FAANG.*
