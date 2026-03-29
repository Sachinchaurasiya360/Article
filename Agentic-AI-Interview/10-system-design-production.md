# Section 10: System Design & Production AI Systems

> Architecture patterns, scaling strategies, monitoring, cost optimization, deployment patterns, and everything needed to run LLM-powered systems in production.

---

## 📚 Pre-requisite Reading

> **Production deployment is partially covered in existing series:**
> - [RAG Part 8: Production RAG](../RAG/rag-deep-dive-part-8.md) - Scaling RAG, monitoring, caching, latency optimization
> - [LangChain Part 2: Production Deployment](../LangChain/langchain-deep-dive-part-2.md) - LangSmith, containerization, error handling
> - [AI Memory Part 17: Scaling Memory Systems](../AI-Memory/ai-memory-deep-dive-part-17.md) - Distributed memory, production deployment

---

## Table of Contents

- [System Design Questions](#system-design-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Real-World Case Studies](#real-world-case-studies)

---

## System Design Questions

### Q1. 🔴 Design an LLM gateway that handles routing, rate limiting, fallback, and observability for multiple models.

**Answer:**

An LLM gateway sits between your application and LLM providers, abstracting provider-specific APIs and adding production-critical infrastructure.

```
┌─────────────────────────────────────────────────────────┐
│                    LLM Gateway                           │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │  Router   │→│Rate Limit│→│  Retry +   │→│ Provider│ │
│  │(model    │  │(per-user │  │  Fallback  │  │  Adapter│ │
│  │ selection)│  │ per-model)│  │            │  │         │ │
│  └──────────┘  └──────────┘  └───────────┘  └────┬───┘ │
│       ↑                            ↑              │      │
│  ┌──────────┐              ┌───────────┐         │      │
│  │  Cache   │              │Observability│←───────┘      │
│  │(semantic │              │(logging,    │               │
│  │ + exact) │              │ metrics,    │               │
│  └──────────┘              │ tracing)    │               │
│                            └───────────┘                │
└─────────────────────────────────────────────────────────┘
        │                     │                    │
   ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
   │ OpenAI  │          │Anthropic│          │  Local   │
   │  API    │          │  API    │          │ (vLLM)  │
   └─────────┘          └─────────┘          └─────────┘
```

```python
import time
import hashlib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from collections import defaultdict
import asyncio

app = FastAPI()


class LLMRequest(BaseModel):
    messages: list[dict]
    model: str = "auto"  # "auto" = gateway chooses best model
    max_tokens: int = 1000
    temperature: float = 0.7
    user_id: str = "anonymous"


class LLMResponse(BaseModel):
    content: str
    model_used: str
    tokens: dict
    latency_ms: float
    cache_hit: bool = False


class LLMGateway:
    def __init__(self):
        self.providers = {}  # model_name → provider_client
        self.rate_limits = defaultdict(lambda: {"count": 0, "window_start": time.time()})
        self.cache = {}  # hash → (response, timestamp)
        self.metrics = defaultdict(list)  # model → [latency, ...]
        self.fallback_chains = {
            "gpt-4o": ["gpt-4o", "claude-sonnet-4", "gpt-4o-mini"],
            "claude-sonnet-4": ["claude-sonnet-4", "gpt-4o", "claude-haiku-3.5"],
            "fast": ["gpt-4o-mini", "claude-haiku-3.5"],
            "auto": ["gpt-4o-mini", "gpt-4o", "claude-sonnet-4"],
        }

    async def process(self, request: LLMRequest) -> LLMResponse:
        start = time.time()

        # Layer 1: Cache check
        cache_key = self._cache_key(request)
        if cache_key in self.cache:
            cached, cached_at = self.cache[cache_key]
            if time.time() - cached_at < 3600:  # 1 hour cache
                return LLMResponse(**cached, cache_hit=True)

        # Layer 2: Rate limiting
        self._check_rate_limit(request.user_id)

        # Layer 3: Smart routing
        model = await self._route(request)

        # Layer 4: Execute with fallback chain
        chain = self.fallback_chains.get(model, [model])
        last_error = None

        for fallback_model in chain:
            try:
                response = await self._call_provider(fallback_model, request)
                latency = (time.time() - start) * 1000

                result = LLMResponse(
                    content=response["content"],
                    model_used=fallback_model,
                    tokens=response["tokens"],
                    latency_ms=latency,
                )

                # Cache the response
                self.cache[cache_key] = (result.model_dump(), time.time())

                # Record metrics
                self.metrics[fallback_model].append(latency)

                return result

            except Exception as e:
                last_error = e
                continue

        raise HTTPException(503, f"All providers failed. Last error: {last_error}")

    async def _route(self, request: LLMRequest) -> str:
        """Smart routing based on request characteristics."""
        if request.model != "auto":
            return request.model

        # Estimate complexity from message length and content
        total_chars = sum(len(m["content"]) for m in request.messages)

        if total_chars < 500 and request.max_tokens < 200:
            return "fast"  # Simple queries → cheap model
        elif any("code" in m["content"].lower() for m in request.messages):
            return "gpt-4o"  # Code tasks → strong model
        else:
            return "gpt-4o-mini"  # Default → balanced

    def _check_rate_limit(self, user_id: str, max_per_minute: int = 30):
        """Per-user rate limiting."""
        now = time.time()
        rl = self.rate_limits[user_id]
        if now - rl["window_start"] > 60:
            rl["count"] = 0
            rl["window_start"] = now
        rl["count"] += 1
        if rl["count"] > max_per_minute:
            raise HTTPException(429, "Rate limit exceeded")

    def _cache_key(self, request: LLMRequest) -> str:
        """Generate cache key from request content."""
        content = json.dumps(request.messages) + str(request.temperature)
        return hashlib.sha256(content.encode()).hexdigest()

    async def _call_provider(self, model: str, request: LLMRequest) -> dict:
        """Call the appropriate provider based on model name."""
        provider = self.providers.get(model)
        if not provider:
            raise ValueError(f"Unknown model: {model}")

        response = await provider.chat(
            messages=request.messages,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )
        return {
            "content": response.content,
            "tokens": {"input": response.input_tokens, "output": response.output_tokens},
        }


gateway = LLMGateway()


@app.post("/v1/chat/completions")
async def chat(request: LLMRequest) -> LLMResponse:
    return await gateway.process(request)


@app.get("/v1/health")
async def health():
    return {
        "status": "healthy",
        "cache_size": len(gateway.cache),
        "model_latencies": {
            model: {
                "p50": sorted(lats)[len(lats)//2] if lats else 0,
                "p99": sorted(lats)[int(len(lats)*0.99)] if lats else 0,
                "count": len(lats),
            }
            for model, lats in gateway.metrics.items()
        },
    }
```

**Why interviewer asks this:** LLM gateways are the foundational infrastructure for production AI. Tests system design thinking.

**Follow-up:** How would you add A/B testing to this gateway to compare model performance on live traffic?

---

### Q2. 🔴 Design a scalable RAG system that handles 10,000 queries per minute with sub-second latency.

**Answer:**

```
Architecture for high-throughput, low-latency RAG:

                    ┌─────────────┐
                    │  Load        │
                    │  Balancer    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴─────┐ ┌───┴─────┐
        │ RAG Node 1│ │RAG Node 2│ │RAG Node 3│  (Stateless, horizontally scalable)
        └─────┬─────┘ └────┬────┘ └────┬────┘
              │            │            │
     ┌────────┴──────────┬─┴────────────┘
     │                   │
┌────┴─────┐      ┌─────┴──────┐
│  Cache    │      │  Vector DB  │
│  Layer    │      │  Cluster    │
│(Redis)    │      │(Qdrant/     │
│           │      │ Pinecone)   │
└───────────┘      └─────────────┘
```

**Key design decisions:**

```python
class HighThroughputRAG:
    """RAG system optimized for 10K QPM with <1s latency."""

    def __init__(self):
        # 1. Multi-tier caching
        self.exact_cache = Redis(decode_responses=True)      # Exact query match: <1ms
        self.semantic_cache = SemanticCache(threshold=0.95)    # Similar query match: ~10ms
        self.embedding_cache = LRUCache(maxsize=100_000)       # Cached embeddings: <1ms

        # 2. Pre-computed embeddings for common queries
        self.hot_queries = {}

        # 3. Connection pools for all external services
        self.vector_db = QdrantClient(url="...", pool_size=50)
        self.llm_pool = AsyncClientPool(max_connections=100)

    async def query(self, question: str) -> dict:
        """Full query path with all optimizations."""
        start = time.time()

        # Tier 1: Exact cache hit (~1ms)
        cached = await self.exact_cache.get(f"rag:{hash(question)}")
        if cached:
            return {"answer": cached, "latency_ms": 1, "cache": "exact"}

        # Tier 2: Semantic cache hit (~10ms)
        semantic_hit = await self.semantic_cache.search(question, threshold=0.95)
        if semantic_hit:
            return {"answer": semantic_hit, "latency_ms": 10, "cache": "semantic"}

        # Tier 3: Full RAG pipeline
        # These can run in parallel where possible

        # 3a: Embed query (cached or computed: ~20ms)
        embedding = await self._get_embedding(question)

        # 3b: Parallel retrieval: vector search + keyword search (~50ms)
        vector_results, keyword_results = await asyncio.gather(
            self.vector_db.search(embedding, top_k=20),
            self.bm25_search(question, top_k=20),
        )

        # 3c: Merge and re-rank (~30ms with optimized cross-encoder)
        merged = self._rrf_merge(vector_results, keyword_results)
        reranked = await self._rerank(question, merged[:10])  # Re-rank top 10 only
        top_docs = reranked[:5]

        # 3d: Generate answer (~200-500ms - the bottleneck)
        answer = await self._generate(question, top_docs)

        # Cache the result
        await self.exact_cache.set(f"rag:{hash(question)}", answer, ex=3600)
        await self.semantic_cache.add(question, answer)

        latency = (time.time() - start) * 1000
        return {"answer": answer, "latency_ms": latency, "cache": "miss"}

    async def _get_embedding(self, text: str) -> list[float]:
        """Get embedding with caching."""
        cache_key = hashlib.md5(text.encode()).hexdigest()
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]

        embedding = await self.embedding_model.embed(text)
        self.embedding_cache[cache_key] = embedding
        return embedding

    async def _generate(self, question: str, docs: list) -> str:
        """Generate with streaming for time-to-first-token optimization."""
        context = "\n\n".join(doc.text for doc in docs)
        return await self.llm_pool.chat(
            model="gpt-4o-mini",  # Fast model for generation
            messages=[
                {"role": "system", "content": "Answer based on the context provided."},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
            ],
            max_tokens=500,
            temperature=0.1,
        )
```

**Latency budget:**

```
Target: <1000ms end-to-end (p95)

Embedding:        50ms  (cached: 1ms)
Vector search:    50ms  (HNSW with quantization)
Keyword search:   30ms  (in parallel with vector search)
Re-ranking:       50ms  (small cross-encoder, batch of 10)
LLM generation:  400ms  (gpt-4o-mini with streaming)
Network/other:    20ms
                -------
Total:          ~600ms (p50), ~900ms (p95)
```

**Scaling strategies:**

| Component | Scaling Approach |
|-----------|-----------------|
| RAG nodes | Horizontal (stateless, behind load balancer) |
| Vector DB | Sharding by document collection |
| Cache | Redis Cluster (distributed) |
| LLM calls | Multiple API keys, model routing, request queuing |
| Embeddings | Batch embedding service with GPU |

**Why interviewer asks this:** The ultimate system design question for AI engineers. Tests understanding of latency, throughput, caching, and distributed systems.

**Follow-up:** How would you handle cache invalidation when documents in the knowledge base are updated?

---

### Q3. 🔴 Design a cost monitoring and optimization system for a multi-model AI platform.

**Answer:**

```python
from datetime import datetime, timedelta
from collections import defaultdict


class CostMonitor:
    """
    Track, alert, and optimize LLM costs across an organization.
    """

    # Pricing per 1K tokens (input/output)
    PRICING = {
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "claude-sonnet-4": {"input": 0.003, "output": 0.015},
        "claude-haiku-3.5": {"input": 0.0008, "output": 0.004},
        "text-embedding-3-small": {"input": 0.00002, "output": 0},
    }

    def __init__(self):
        self.usage_log: list[dict] = []
        self.budgets: dict[str, float] = {}  # team → daily budget
        self.alerts: list[dict] = []

    def record_usage(self, model: str, input_tokens: int, output_tokens: int,
                     team: str, feature: str, user_id: str):
        """Record a single LLM API call."""
        pricing = self.PRICING.get(model, {"input": 0.01, "output": 0.03})
        cost = (input_tokens / 1000 * pricing["input"] +
                output_tokens / 1000 * pricing["output"])

        self.usage_log.append({
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
            "team": team,
            "feature": feature,
            "user_id": user_id,
        })

        # Check budget
        daily_spend = self._get_daily_spend(team)
        budget = self.budgets.get(team, float("inf"))
        if daily_spend > budget * 0.8:
            self._alert(f"Team {team} at {daily_spend/budget:.0%} of daily budget")
        if daily_spend > budget:
            self._alert(f"CRITICAL: Team {team} exceeded daily budget!", severity="critical")

    def get_dashboard(self, period_days: int = 30) -> dict:
        """Generate cost dashboard."""
        cutoff = datetime.now() - timedelta(days=period_days)
        recent = [u for u in self.usage_log
                  if datetime.fromisoformat(u["timestamp"]) > cutoff]

        return {
            "total_cost": sum(u["cost_usd"] for u in recent),
            "total_tokens": sum(u["input_tokens"] + u["output_tokens"] for u in recent),
            "total_calls": len(recent),
            "by_model": self._aggregate(recent, "model"),
            "by_team": self._aggregate(recent, "team"),
            "by_feature": self._aggregate(recent, "feature"),
            "daily_trend": self._daily_trend(recent),
            "top_users": self._top_n(recent, "user_id", n=10),
            "optimization_suggestions": self._suggest_optimizations(recent),
        }

    def _suggest_optimizations(self, usage: list[dict]) -> list[str]:
        """AI-powered cost optimization suggestions."""
        suggestions = []

        # 1. Model downgrade opportunities
        model_usage = self._aggregate(usage, "model")
        for model, data in model_usage.items():
            if model == "gpt-4o" and data["avg_output_tokens"] < 100:
                suggestions.append(
                    f"Consider using gpt-4o-mini for {model}: "
                    f"avg output is only {data['avg_output_tokens']} tokens. "
                    f"Estimated savings: ${data['cost'] * 0.85:.2f}/month"
                )

        # 2. Cache hit rate analysis
        # (would need cache metrics)
        suggestions.append(
            "Enable semantic caching for queries with >50% similarity. "
            "Expected 30-40% cost reduction for repetitive queries."
        )

        # 3. Prompt optimization
        for feature, data in self._aggregate(usage, "feature").items():
            if data["avg_input_tokens"] > 3000:
                suggestions.append(
                    f"Feature '{feature}' averages {data['avg_input_tokens']} input tokens. "
                    f"Consider prompt compression or reducing retrieved context."
                )

        return suggestions

    def _aggregate(self, usage: list[dict], group_by: str) -> dict:
        groups = defaultdict(lambda: {"cost": 0, "calls": 0, "input_tokens": 0, "output_tokens": 0})
        for u in usage:
            key = u[group_by]
            groups[key]["cost"] += u["cost_usd"]
            groups[key]["calls"] += 1
            groups[key]["input_tokens"] += u["input_tokens"]
            groups[key]["output_tokens"] += u["output_tokens"]

        for key in groups:
            g = groups[key]
            g["avg_input_tokens"] = g["input_tokens"] // max(g["calls"], 1)
            g["avg_output_tokens"] = g["output_tokens"] // max(g["calls"], 1)
            g["avg_cost_per_call"] = g["cost"] / max(g["calls"], 1)

        return dict(groups)

    def _daily_trend(self, usage: list[dict]) -> dict:
        daily = defaultdict(float)
        for u in usage:
            day = u["timestamp"][:10]
            daily[day] += u["cost_usd"]
        return dict(sorted(daily.items()))

    def _top_n(self, usage: list[dict], key: str, n: int) -> list:
        agg = self._aggregate(usage, key)
        return sorted(agg.items(), key=lambda x: x[1]["cost"], reverse=True)[:n]

    def _get_daily_spend(self, team: str) -> float:
        today = datetime.now().date().isoformat()
        return sum(
            u["cost_usd"] for u in self.usage_log
            if u["team"] == team and u["timestamp"].startswith(today)
        )

    def _alert(self, message: str, severity: str = "warning"):
        self.alerts.append({
            "message": message,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
        })
```

**Cost optimization techniques:**

| Technique | Savings | Implementation Effort |
|-----------|---------|----------------------|
| Prompt caching (OpenAI/Anthropic) | 50-90% on cached prefixes | Low |
| Semantic caching | 30-50% for similar queries | Medium |
| Model routing (use cheaper model when possible) | 40-70% | Medium |
| Prompt compression | 20-40% | Low |
| Batching requests | 10-20% + lower rate limit usage | Medium |
| Output length limits | 10-30% | Low |

**Why interviewer asks this:** Cost management is a top priority for every AI team. Shows operational maturity.

**Follow-up:** How would you implement automatic model downgrading during cost overruns without user-visible quality degradation?

---

### Q4. 🔴 Design an observability stack for LLM applications.

**Answer:**

LLM observability requires tracking different signals than traditional software:

```python
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field


@dataclass
class LLMTrace:
    """Complete trace of an LLM-powered operation."""
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    spans: list[dict] = field(default_factory=list)
    start_time: float = field(default_factory=time.time)

    def add_span(self, name: str, **kwargs):
        self.spans.append({"name": name, "timestamp": time.time(), **kwargs})


class LLMObservability:
    """
    Observability for LLM applications:
    - Request/response logging
    - Latency tracking (TTFT, TPS, total)
    - Token usage and cost tracking
    - Quality metrics
    - Error tracking
    - Trace correlation
    """

    def __init__(self, backend: str = "console"):
        self.backend = backend
        self.traces: list[LLMTrace] = []

    @asynccontextmanager
    async def trace(self, operation: str, metadata: dict = None):
        """Context manager for tracing an LLM operation."""
        t = LLMTrace()
        t.add_span("start", operation=operation, metadata=metadata or {})

        try:
            yield t
            t.add_span("end", status="success")
        except Exception as e:
            t.add_span("error", error=str(e), error_type=type(e).__name__)
            raise
        finally:
            t.add_span("complete", total_duration_ms=(time.time() - t.start_time) * 1000)
            self.traces.append(t)
            await self._emit(t)

    async def log_llm_call(self, trace: LLMTrace, **kwargs):
        """Log a specific LLM API call within a trace."""
        trace.add_span("llm_call", **{
            "model": kwargs.get("model"),
            "input_tokens": kwargs.get("input_tokens"),
            "output_tokens": kwargs.get("output_tokens"),
            "latency_ms": kwargs.get("latency_ms"),
            "cost_usd": kwargs.get("cost_usd"),
            "temperature": kwargs.get("temperature"),
            "prompt_preview": kwargs.get("prompt", "")[:200],
            "response_preview": kwargs.get("response", "")[:200],
        })

    async def log_retrieval(self, trace: LLMTrace, **kwargs):
        """Log a retrieval operation within a trace."""
        trace.add_span("retrieval", **{
            "query": kwargs.get("query"),
            "num_results": kwargs.get("num_results"),
            "top_score": kwargs.get("top_score"),
            "latency_ms": kwargs.get("latency_ms"),
            "source": kwargs.get("source"),  # "vector_db", "bm25", "cache"
        })

    async def log_guardrail(self, trace: LLMTrace, **kwargs):
        """Log a guardrail check."""
        trace.add_span("guardrail", **{
            "name": kwargs.get("name"),
            "verdict": kwargs.get("verdict"),
            "reason": kwargs.get("reason"),
            "latency_ms": kwargs.get("latency_ms"),
        })

    def get_metrics(self, period_hours: int = 24) -> dict:
        """Aggregate metrics for monitoring dashboards."""
        cutoff = time.time() - period_hours * 3600
        recent = [t for t in self.traces if t.start_time > cutoff]

        llm_calls = [
            s for t in recent for s in t.spans if s["name"] == "llm_call"
        ]

        return {
            "total_requests": len(recent),
            "error_rate": sum(1 for t in recent if any(s["name"] == "error" for s in t.spans)) / max(len(recent), 1),
            "avg_latency_ms": sum(s.get("latency_ms", 0) for s in llm_calls) / max(len(llm_calls), 1),
            "p95_latency_ms": sorted([s.get("latency_ms", 0) for s in llm_calls])[int(len(llm_calls) * 0.95)] if llm_calls else 0,
            "total_tokens": sum(s.get("input_tokens", 0) + s.get("output_tokens", 0) for s in llm_calls),
            "total_cost_usd": sum(s.get("cost_usd", 0) for s in llm_calls),
            "guardrail_block_rate": self._guardrail_block_rate(recent),
        }

    def _guardrail_block_rate(self, traces: list[LLMTrace]) -> float:
        checks = [s for t in traces for s in t.spans if s["name"] == "guardrail"]
        if not checks:
            return 0.0
        blocked = sum(1 for s in checks if s.get("verdict") == "fail")
        return blocked / len(checks)

    async def _emit(self, trace: LLMTrace):
        """Send trace to observability backend."""
        if self.backend == "console":
            duration = (time.time() - trace.start_time) * 1000
            print(f"[Trace {trace.trace_id[:8]}] {len(trace.spans)} spans, {duration:.0f}ms")


# Usage in a RAG endpoint
obs = LLMObservability()


@app.post("/query")
async def query(request: QueryRequest):
    async with obs.trace("rag_query", {"user_id": request.user_id}) as trace:
        # Retrieval
        start = time.time()
        docs = await vector_store.search(request.question, top_k=5)
        await obs.log_retrieval(trace,
            query=request.question,
            num_results=len(docs),
            top_score=docs[0].score if docs else 0,
            latency_ms=(time.time() - start) * 1000,
        )

        # Guardrail
        start = time.time()
        safety = await check_safety(request.question)
        await obs.log_guardrail(trace,
            name="input_safety",
            verdict=safety.verdict.value,
            latency_ms=(time.time() - start) * 1000,
        )

        # LLM call
        start = time.time()
        response = await llm.generate(request.question, docs)
        await obs.log_llm_call(trace,
            model="gpt-4o",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            latency_ms=(time.time() - start) * 1000,
            cost_usd=calculate_cost(response.usage),
        )

        return {"answer": response.content}
```

**Key metrics to monitor:**

| Metric | Alert Threshold | Why |
|--------|----------------|-----|
| p95 latency | >2000ms | User experience degradation |
| Error rate | >1% | System reliability |
| Cost per query | >$0.05 | Budget overrun |
| Guardrail block rate | >10% | Potential attack or over-blocking |
| Cache hit rate | <20% | Optimization opportunity |
| Hallucination rate (sampled) | >5% | Quality degradation |

**Why interviewer asks this:** Observability is what makes production AI systems debuggable and improvable.

**Follow-up:** How would you set up automated alerts for quality degradation that you can't detect with simple metrics?

---

## Coding Questions

### Q5. 🔴 Build a complete FastAPI-based AI application with all production concerns.

```python
"""
Production-grade AI API with:
- Streaming support
- Rate limiting
- Caching
- Observability
- Graceful degradation
- Health checks
"""

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
import asyncio
import time

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.vector_store = await init_vector_store()
    app.state.llm_pool = await init_llm_pool()
    app.state.cache = await init_cache()
    app.state.monitor = CostMonitor()
    yield
    # Shutdown
    await app.state.llm_pool.close()
    await app.state.cache.close()


app = FastAPI(title="AI API", version="1.0.0", lifespan=lifespan)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10_000)
    conversation_id: str | None = None
    stream: bool = False
    model_preference: str = "auto"


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    conversation_id: str
    model_used: str
    latency_ms: float
    tokens: dict


# Rate limiting middleware
from collections import defaultdict

rate_limits = defaultdict(lambda: {"count": 0, "reset": time.time()})


async def rate_limit(request: Request):
    client_ip = request.client.host
    rl = rate_limits[client_ip]
    now = time.time()

    if now - rl["reset"] > 60:
        rl["count"] = 0
        rl["reset"] = now

    rl["count"] += 1
    if rl["count"] > 60:  # 60 requests per minute
        raise HTTPException(429, "Rate limit exceeded. Try again in 60 seconds.")


@app.post("/v1/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit)])
async def chat(request: ChatRequest, req: Request):
    """Main chat endpoint with full production pipeline."""
    start = time.time()

    try:
        # 1. Check cache
        cache = req.app.state.cache
        cached = await cache.get(request.message)
        if cached:
            return ChatResponse(**cached, latency_ms=1)

        # 2. Input validation and safety
        safety_check = await check_input_safety(request.message)
        if not safety_check.safe:
            raise HTTPException(400, f"Input rejected: {safety_check.reason}")

        # 3. Retrieve relevant context
        vector_store = req.app.state.vector_store
        docs = await vector_store.search(request.message, top_k=5)

        # 4. Select model based on query complexity
        model = select_model(request.message, request.model_preference)

        # 5. Generate response
        if request.stream:
            return StreamingResponse(
                stream_response(request.message, docs, model, req.app.state.llm_pool),
                media_type="text/event-stream",
            )

        llm_pool = req.app.state.llm_pool
        response = await llm_pool.chat(
            model=model,
            messages=[
                {"role": "system", "content": "Answer based on the provided context. Cite sources."},
                {"role": "user", "content": f"Context:\n{format_docs(docs)}\n\nQuestion: {request.message}"},
            ],
        )

        # 6. Output safety check
        output_check = await check_output_safety(response.content)
        answer = output_check.modified_content or response.content

        # 7. Record metrics
        latency = (time.time() - start) * 1000
        req.app.state.monitor.record_usage(
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            team="default",
            feature="chat",
            user_id=str(req.client.host),
        )

        result = ChatResponse(
            answer=answer,
            sources=[{"text": d.text[:200], "score": d.score} for d in docs[:3]],
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            model_used=model,
            latency_ms=latency,
            tokens={"input": response.usage.input_tokens, "output": response.usage.output_tokens},
        )

        # 8. Cache the result
        await cache.set(request.message, result.model_dump(), ttl=3600)

        return result

    except HTTPException:
        raise
    except Exception as e:
        # Graceful degradation: return a safe fallback
        latency = (time.time() - start) * 1000
        return ChatResponse(
            answer="I'm experiencing issues right now. Please try again shortly.",
            sources=[],
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            model_used="fallback",
            latency_ms=latency,
            tokens={"input": 0, "output": 0},
        )


async def stream_response(message, docs, model, llm_pool):
    """Stream tokens as Server-Sent Events."""
    async for token in llm_pool.stream(
        model=model,
        messages=[
            {"role": "system", "content": "Answer based on context. Cite sources."},
            {"role": "user", "content": f"Context:\n{format_docs(docs)}\n\nQ: {message}"},
        ],
    ):
        yield f"data: {json.dumps({'token': token})}\n\n"
    yield "data: [DONE]\n\n"


def select_model(message: str, preference: str) -> str:
    """Select the optimal model based on query complexity and user preference."""
    if preference != "auto":
        return preference

    # Simple heuristic: longer/complex queries → stronger model
    word_count = len(message.split())
    if word_count < 20:
        return "gpt-4o-mini"
    elif any(kw in message.lower() for kw in ["compare", "analyze", "design", "explain in detail"]):
        return "gpt-4o"
    return "gpt-4o-mini"


@app.get("/health")
async def health(req: Request):
    """Health check with dependency status."""
    checks = {}
    try:
        await req.app.state.vector_store.ping()
        checks["vector_store"] = "healthy"
    except Exception:
        checks["vector_store"] = "unhealthy"

    try:
        await req.app.state.cache.ping()
        checks["cache"] = "healthy"
    except Exception:
        checks["cache"] = "unhealthy"

    all_healthy = all(v == "healthy" for v in checks.values())
    return {
        "status": "healthy" if all_healthy else "degraded",
        "components": checks,
        "metrics": req.app.state.monitor.get_dashboard(period_days=1) if hasattr(req.app.state, "monitor") else {},
    }


@app.get("/metrics")
async def metrics(req: Request):
    """Prometheus-compatible metrics endpoint."""
    dashboard = req.app.state.monitor.get_dashboard(period_days=1)
    return dashboard
```

**Why interviewer asks this:** Comprehensive test of production engineering skills - API design, error handling, caching, monitoring, security.

**Follow-up:** How would you deploy this to handle 10× traffic spikes without pre-provisioning?

---

## Debugging Scenarios

### Q6. 🔴 Debug: Production RAG system quality degraded after a deployment with no code changes.

**Investigation:**

```python
# Checklist for quality degradation without code changes:

# 1. Data changed
# - Was the knowledge base updated? New documents might be poorly chunked
# - Were documents deleted? Retrieval coverage dropped
await check_knowledge_base_changes(since=last_deployment)

# 2. Model changed
# - Did the LLM provider update the model version?
# - OpenAI often updates models without notice
await compare_model_outputs(old_model_version, current_version, eval_set)

# 3. Infrastructure changed
# - Vector DB index rebuilt with different parameters?
# - Cache cleared? (Cold cache = different retrieval behavior)
# - Network latency increased? (Timeouts causing partial results)
await check_vector_db_health()
await check_cache_hit_rate()

# 4. Traffic pattern changed
# - New users with different query patterns?
# - Bot traffic?
await analyze_query_distribution(last_7_days)

# 5. Embedding model changed
# - Did the embedding provider update?
# - New documents embedded with different model version?
await check_embedding_consistency()
```

**Most common root cause:** The LLM provider silently updated their model, changing behavior. This is why you need:
1. **Regression tests** that run on every deployment AND on a schedule
2. **Model version pinning** where available
3. **A/B testing** for model changes

---

### Q7. 🔴 Debug: 5% of requests return empty or "I don't know" responses.

**Answer:**

5% empty responses likely mean retrieval failures for specific query types.

```python
# Diagnostic: Analyze the failing 5%
async def diagnose_empty_responses(logs: list[dict]) -> dict:
    empty_responses = [l for l in logs if is_empty_response(l["response"])]

    patterns = {
        "no_retrieval_results": 0,
        "low_relevance_scores": 0,
        "context_too_short": 0,
        "topic_not_in_knowledge_base": 0,
    }

    for log in empty_responses:
        if log["retrieval_results"] == 0:
            patterns["no_retrieval_results"] += 1
        elif log["top_relevance_score"] < 0.5:
            patterns["low_relevance_scores"] += 1
        elif log["context_tokens"] < 100:
            patterns["context_too_short"] += 1
        else:
            patterns["topic_not_in_knowledge_base"] += 1

    # Find common query patterns in failures
    failure_queries = [l["query"] for l in empty_responses]
    # Cluster these queries to find systematic gaps

    return {
        "failure_patterns": patterns,
        "sample_failing_queries": failure_queries[:20],
        "recommendation": _recommend_fix(patterns),
    }

def _recommend_fix(patterns: dict) -> str:
    dominant = max(patterns, key=patterns.get)
    fixes = {
        "no_retrieval_results": "Add more documents to knowledge base or lower retrieval threshold",
        "low_relevance_scores": "Improve chunking strategy or switch to hybrid search",
        "context_too_short": "Retrieve more chunks or use larger chunk sizes",
        "topic_not_in_knowledge_base": "Identify knowledge gaps and add missing content",
    }
    return fixes.get(dominant, "Manual investigation needed")
```

---

## Real-World Case Studies

### Q8. 🔴 Case Study: Migrating from a prototype AI system to production-grade architecture.

**Scenario:** Your team built a RAG chatbot prototype in 2 weeks. It works great in demos with 100 users. Now you need to serve 100,000 users. What changes are needed?

**Prototype → Production migration checklist:**

| Aspect | Prototype | Production |
|--------|-----------|------------|
| **Deployment** | Single machine, `python app.py` | Containerized, K8s, auto-scaling |
| **Database** | In-memory ChromaDB | Managed Qdrant/Pinecone cluster |
| **Caching** | None | Redis cluster (semantic + exact) |
| **LLM calls** | Direct API calls | LLM gateway with routing, fallback, rate limits |
| **Monitoring** | print() statements | Structured logging, metrics, traces, dashboards |
| **Error handling** | Stack traces to user | Graceful degradation, retry logic, circuit breakers |
| **Security** | None | Input/output guardrails, auth, rate limiting |
| **Evaluation** | Manual spot-checking | Automated eval pipeline, regression tests |
| **Cost** | $50/month (acceptable for demo) | Cost monitoring, model routing, caching → control at scale |
| **Data pipeline** | Manual document upload | Automated ingestion, chunking, embedding, indexing |
| **Context management** | Append all messages | Summarization, windowing, retrieval-based memory |
| **CI/CD** | Manual deployment | Automated testing, staging, canary deployment |

**Migration priority order:**

```
Week 1: Observability + Error handling
  (Can't fix what you can't see)

Week 2: Caching + Cost controls
  (Prevent budget overrun at scale)

Week 3: Guardrails + Security
  (Protect against abuse and safety issues)

Week 4: Auto-scaling + Load testing
  (Prepare for real traffic)

Week 5: Evaluation pipeline + Regression tests
  (Maintain quality as you iterate)

Week 6: Advanced features (streaming, memory, personalization)
  (Improve user experience)
```

**Why interviewer asks this:** The prototype-to-production transition is where most AI projects fail. Tests practical engineering judgment.

**Follow-up:** What's the minimum viable production stack you'd ship with to get 90% of the value with 20% of the effort?
