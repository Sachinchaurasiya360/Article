# Vector Databases: The Engine Behind Modern AI Search and Retrieval

*Why traditional databases can't keep up with AI - and how vector databases are quietly powering the next generation of intelligent applications.*

---

## The Problem Traditional Databases Can't Solve

You have a million product descriptions. A user types "comfortable summer shoes for walking all day." Try writing that SQL query. You can't - at least not well.

```sql
-- This is what we've been doing for decades
SELECT * FROM products
WHERE description LIKE '%comfortable%'
  AND description LIKE '%summer%'
  AND description LIKE '%shoes%';
```

This misses "breathable sneakers perfect for long hikes in warm weather" - a product the user would love. Keyword matching is brittle. It matches strings, not meaning.

Vector databases solve this by operating on **meaning**, not text. They store data as high-dimensional vectors (embeddings) and find items that are semantically close to each other - even when they share zero keywords.

---

## What Is a Vector, Really?

Before we talk databases, let's demystify vectors.

An **embedding** is a list of numbers that represents the meaning of a piece of data - text, images, audio, code. These numbers are produced by machine learning models (like OpenAI's `text-embedding-ada-002` or open-source models like `all-MiniLM-L6-v2`).

```
"comfortable summer shoes"  →  [0.12, -0.45, 0.78, 0.33, ..., -0.21]  (1536 dimensions)
"breathable warm-weather sneakers" →  [0.14, -0.42, 0.75, 0.31, ..., -0.19]  (1536 dimensions)
"quantum physics textbook"  →  [-0.67, 0.89, -0.12, 0.55, ..., 0.44]  (1536 dimensions)
```

Notice: the first two vectors are **close** to each other (similar numbers). The third is far away. That closeness *is* semantic similarity.

```
Vector Space (simplified to 2D):

        ▲ dimension 2
        │
        │   📚 "quantum physics textbook"
        │
        │
        │                    👟 "comfortable summer shoes"
        │                   👟 "breathable warm-weather sneakers"
        │
        └──────────────────────────────────► dimension 1

    Items with similar meaning cluster together.
```

---

## How Vector Databases Work

A vector database does three things at scale:

1. **Store** millions (or billions) of vectors alongside metadata
2. **Index** them for fast approximate nearest neighbor (ANN) search
3. **Query** them - given a vector, find the K most similar vectors

### The Naive Approach: Brute Force

Compare the query vector against every stored vector using a distance metric (cosine similarity, Euclidean distance, dot product).

```
Query vector: [0.12, -0.45, 0.78]

Compare against ALL 1,000,000 vectors:
  Vector 1: distance = 0.95  ✓ close
  Vector 2: distance = 0.12  ✗ far
  Vector 3: distance = 0.88  ✓ close
  ...
  Vector 1,000,000: distance = 0.45

Time complexity: O(n × d)  where n = vectors, d = dimensions
For 1M vectors × 1536 dimensions = 1.5 billion operations per query
```

This works at 10K vectors. At 10M, it's unusable. Vector databases use **approximate nearest neighbor (ANN)** algorithms to make this fast.

### The Indexing Strategies That Make It Fast

#### 1. HNSW (Hierarchical Navigable Small World)

The most popular index type. Think of it as a skip list for vector space.

```
Layer 2 (sparse):    A ──────────────────── D
                     │                      │
Layer 1 (medium):    A ────── C ──────────  D ──── F
                     │        │             │      │
Layer 0 (dense):     A ─ B ─ C ─ D ─ E ─ F ─ G ─ H

Search starts at the top layer, makes big jumps,
then refines at lower layers.
```

- **Pros:** Extremely fast queries, high recall
- **Cons:** High memory usage (entire graph must fit in RAM), slower inserts
- **Best for:** Read-heavy workloads where accuracy matters

#### 2. IVF (Inverted File Index)

Cluster vectors into groups. At query time, only search the nearest clusters.

```
┌─────────────────────────────────────┐
│          Vector Space               │
│                                     │
│   ┌──────┐  ┌──────┐  ┌──────┐    │
│   │Cluster│  │Cluster│  │Cluster│   │
│   │  A    │  │  B    │  │  C    │   │
│   │ •••   │  │ ••••  │  │ ••    │   │
│   │ ••    │  │ •••   │  │ •••   │   │
│   └──────┘  └──────┘  └──────┘    │
│                                     │
│   Query: ★                          │
│   → Only search Cluster B (nearest) │
│   → nprobe=2: search B + C          │
└─────────────────────────────────────┘
```

- **Pros:** Lower memory footprint, works well with disk-based storage
- **Cons:** Lower recall than HNSW (tunable with `nprobe`)
- **Best for:** Very large datasets where memory is a constraint

#### 3. Product Quantization (PQ)

Compress vectors to reduce memory. A 1536-dim float32 vector takes 6KB. With PQ, it can be compressed to ~200 bytes - a 30x reduction.

```
Original:  [0.12, -0.45, 0.78, 0.33, -0.21, 0.67, 0.15, -0.89]
            ─────────────  ─────────────  ─────────────  ────────
            Sub-vector 1   Sub-vector 2   Sub-vector 3   Sub-vector 4

Each sub-vector → mapped to nearest centroid ID:
Compressed: [42, 17, 203, 91]  (4 bytes instead of 32)
```

- **Tradeoff:** Some accuracy loss for massive memory savings
- **Used in combination** with IVF (IVF-PQ) for billion-scale datasets

---

## Distance Metrics: How "Closeness" Is Measured

```
┌──────────────────┬──────────────────────────┬──────────────────────┐
│ Metric           │ What It Measures         │ Best For             │
├──────────────────┼──────────────────────────┼──────────────────────┤
│ Cosine Similarity│ Angle between vectors    │ Text embeddings      │
│                  │ (ignores magnitude)      │ (most common)        │
├──────────────────┼──────────────────────────┼──────────────────────┤
│ Euclidean (L2)   │ Straight-line distance   │ Image embeddings,    │
│                  │                          │ spatial data         │
├──────────────────┼──────────────────────────┼──────────────────────┤
│ Dot Product      │ Magnitude + direction    │ Recommendation       │
│                  │                          │ systems (when        │
│                  │                          │ magnitude matters)   │
└──────────────────┴──────────────────────────┴──────────────────────┘
```

**Rule of thumb:** If your embeddings are normalized (most text embedding models do this), cosine similarity and dot product give identical results. When in doubt, use cosine similarity.

---

## The Vector Database Landscape

### Purpose-Built Vector Databases

#### Pinecone
```
Type:        Fully managed (cloud-only)
Index:       Proprietary (based on IVF + PQ)
Scaling:     Serverless or pod-based
Strengths:   Zero-ops, fast onboarding, metadata filtering
Limitations: No self-hosting, vendor lock-in, can get expensive at scale
```

```python
# Pinecone example
import pinecone

pc = pinecone.Pinecone(api_key="your-key")
index = pc.Index("products")

# Upsert vectors with metadata
index.upsert(vectors=[
    ("prod_1", [0.12, -0.45, ...], {"category": "shoes", "price": 89.99}),
    ("prod_2", [0.14, -0.42, ...], {"category": "shoes", "price": 129.99}),
])

# Query with metadata filter
results = index.query(
    vector=[0.13, -0.44, ...],
    top_k=5,
    filter={"category": {"$eq": "shoes"}, "price": {"$lt": 100}}
)
```

#### Weaviate
```
Type:        Open-source + managed cloud
Index:       HNSW (default), flat
Strengths:   GraphQL API, built-in vectorizers, hybrid search
Limitations: HNSW memory requirements, steeper learning curve
```

```python
# Weaviate example
import weaviate

client = weaviate.Client("http://localhost:8080")

# It can vectorize text automatically
client.data_object.create(
    class_name="Product",
    data_object={
        "name": "Trail running shoes",
        "description": "Lightweight breathable shoes for trail running",
        "price": 119.99
    }
)

# Hybrid search: combines vector + keyword (BM25)
result = client.query.get("Product", ["name", "description"]) \
    .with_hybrid(query="comfortable hiking footwear", alpha=0.75) \
    .with_limit(5) \
    .do()
```

#### Qdrant
```
Type:        Open-source + managed cloud
Index:       HNSW with custom modifications
Written in:  Rust (fast, memory-efficient)
Strengths:   Advanced filtering, payload indexes, gRPC + REST
Limitations: Smaller ecosystem than Pinecone/Weaviate
```

```python
# Qdrant example
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient(host="localhost", port=6333)

client.create_collection(
    collection_name="products",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# Upsert with rich payloads
client.upsert(
    collection_name="products",
    points=[
        PointStruct(
            id=1,
            vector=[0.12, -0.45, ...],
            payload={"name": "Trail shoes", "price": 119.99, "in_stock": True}
        )
    ]
)

# Filtered vector search
results = client.search(
    collection_name="products",
    query_vector=[0.13, -0.44, ...],
    query_filter={"must": [{"key": "in_stock", "match": {"value": True}}]},
    limit=5
)
```

#### Milvus / Zilliz
```
Type:        Open-source (Milvus) + managed (Zilliz Cloud)
Index:       IVF_FLAT, IVF_PQ, HNSW, DiskANN, and more
Strengths:   Billion-scale, GPU acceleration, most index options
Limitations: Complex to operate self-hosted, heavier resource footprint
```

### Databases With Vector Extensions

Not every project needs a dedicated vector database. If you already run PostgreSQL, you might be fine with an extension.

#### pgvector (PostgreSQL)
```sql
-- Enable the extension
CREATE EXTENSION vector;

-- Create table with vector column
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT,
    description TEXT,
    price DECIMAL,
    embedding VECTOR(1536)  -- 1536-dimensional vector
);

-- Create an HNSW index for fast search
CREATE INDEX ON products
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

-- Semantic search with metadata filtering
SELECT name, description, price,
       1 - (embedding <=> '[0.12, -0.45, ...]'::vector) AS similarity
FROM products
WHERE price < 100
ORDER BY embedding <=> '[0.12, -0.45, ...]'::vector
LIMIT 5;
```

**When to use pgvector:**
- You already use PostgreSQL
- Dataset is under ~5M vectors
- You need ACID transactions on vectors + structured data
- You want one database to maintain, not two

**When to use a dedicated vector DB:**
- Dataset exceeds 10M+ vectors
- Sub-10ms query latency is critical
- You need advanced features (multi-tenancy, hybrid search, GPU indexing)
- Vector search is a primary workload, not a secondary feature

---

## The RAG Pattern: Where Vector Databases Shine

The most common use case today is **Retrieval-Augmented Generation (RAG)** - giving LLMs access to your private data without fine-tuning.

```
┌──────────────────────────────────────────────────────┐
│                  RAG Pipeline                        │
│                                                      │
│  1. INGESTION (one-time or periodic)                │
│  ┌──────────┐    ┌────────────┐    ┌──────────────┐ │
│  │Documents │───▶│ Chunk +    │───▶│ Vector DB    │ │
│  │(PDF,docs,│    │ Embed      │    │ (store       │ │
│  │ code...) │    │            │    │  embeddings) │ │
│  └──────────┘    └────────────┘    └──────────────┘ │
│                                                      │
│  2. QUERY (every user request)                      │
│  ┌──────────┐    ┌────────────┐    ┌──────────────┐ │
│  │ User     │───▶│ Embed      │───▶│ Vector DB    │ │
│  │ Question │    │ query      │    │ (find top K  │ │
│  └──────────┘    └────────────┘    │  matches)    │ │
│                                    └──────┬───────┘ │
│                                           │         │
│  3. GENERATION                            ▼         │
│  ┌──────────┐    ┌────────────┐    ┌──────────────┐ │
│  │ Answer   │◀───│ LLM        │◀───│ Question +   │ │
│  │          │    │ (generate) │    │ Retrieved    │ │
│  │          │    │            │    │ Context      │ │
│  └──────────┘    └────────────┘    └──────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Building a RAG Pipeline (Practical Example)

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA

# Step 1: Chunk your documents
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,       # characters per chunk
    chunk_overlap=50,     # overlap to preserve context at boundaries
    separators=["\n\n", "\n", ". ", " "]  # split at natural boundaries
)
chunks = splitter.split_documents(documents)

# Step 2: Embed and store in vector database
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Qdrant.from_documents(
    chunks,
    embeddings,
    location=":memory:",  # or url="http://localhost:6333"
    collection_name="knowledge_base"
)

# Step 3: Query with retrieval
retriever = vectorstore.as_retriever(
    search_type="mmr",      # Maximum Marginal Relevance (diversity)
    search_kwargs={"k": 5}  # return 5 chunks
)

qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4"),
    retriever=retriever,
    return_source_documents=True
)

result = qa_chain.invoke({"query": "What is our refund policy?"})
print(result["result"])
```

---

## Chunking: The Make-or-Break Decision

Bad chunking ruins search quality more than a bad index or a bad embedding model. Here's what works:

```
┌──────────────────────────────────────────────────────────┐
│                  Chunking Strategies                     │
├──────────────────┬───────────────────────────────────────┤
│ Fixed-size       │ Split every N characters/tokens       │
│                  │ Simple but cuts mid-sentence          │
│                  │ Use overlap (10-20%) to mitigate      │
├──────────────────┼───────────────────────────────────────┤
│ Recursive        │ Try splitting at paragraphs, then     │
│                  │ sentences, then words                 │
│                  │ Best general-purpose strategy          │
├──────────────────┼───────────────────────────────────────┤
│ Semantic         │ Split when the topic changes          │
│                  │ (using embedding similarity)          │
│                  │ Best quality, highest complexity       │
├──────────────────┼───────────────────────────────────────┤
│ Document-aware   │ Split by markdown headers, code       │
│                  │ blocks, HTML tags, etc.               │
│                  │ Best for structured documents          │
└──────────────────┴───────────────────────────────────────┘

Chunk size guidelines:
┌─────────────────────┬───────────────────┐
│ Use case            │ Recommended size  │
├─────────────────────┼───────────────────┤
│ Q&A / FAQ           │ 200-500 tokens    │
│ Long-form documents │ 500-1000 tokens   │
│ Code                │ Per function/class│
│ Legal / compliance  │ Per clause/section│
└─────────────────────┴───────────────────┘
```

---

## Hybrid Search: The Best of Both Worlds

Pure vector search misses exact matches. Pure keyword search misses semantic matches. Hybrid search combines both.

```
User query: "error code 404 in authentication module"

Keyword search (BM25):
  ✅ Finds: docs containing "404" and "authentication"
  ❌ Misses: "auth service returns not-found response"

Vector search:
  ✅ Finds: "auth service returns not-found response"
  ❌ Might miss: exact "404" matches if embeddings don't capture codes well

Hybrid search:
  ✅ Finds both - combines BM25 scores with vector similarity scores

Score fusion:
  hybrid_score = alpha × vector_score + (1 - alpha) × bm25_score
  alpha = 0.7 is a good starting point (favor semantic, but keep keyword signal)
```

Weaviate, Qdrant, and Elasticsearch all support hybrid search natively. For pgvector, you can combine it with PostgreSQL's built-in full-text search (`tsvector`).

---

## Performance at Scale: Numbers That Matter

```
Benchmark: 1M vectors, 1536 dimensions, top-10 query

┌─────────────┬──────────┬─────────┬──────────┬──────────┐
│ System      │ Latency  │ Recall  │ RAM      │ QPS      │
│             │ (p99)    │ @10     │          │          │
├─────────────┼──────────┼─────────┼──────────┼──────────┤
│ HNSW       │ ~2ms     │ 0.98    │ ~8GB     │ ~3000    │
│ IVF-PQ     │ ~5ms     │ 0.92    │ ~1.5GB   │ ~5000    │
│ Flat (brute)│ ~200ms  │ 1.00    │ ~6GB     │ ~50      │
│ pgvector   │ ~10ms    │ 0.95    │ ~8GB     │ ~500     │
│ (HNSW)     │          │         │          │          │
└─────────────┴──────────┴─────────┴──────────┴──────────┘

(Approximate numbers - actual performance varies by hardware and config)
```

### Scaling Strategies

```
┌──────────────────────────────────────────────────────┐
│           Scaling Vector Databases                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Vertical (single node):                            │
│  • Add RAM (HNSW needs vectors in memory)           │
│  • Use quantization (reduce vector size 4-30x)      │
│  • Use disk-backed indexes (DiskANN, IVF-PQ)        │
│                                                      │
│  Horizontal (multiple nodes):                       │
│  • Shard by partition key (e.g., tenant_id)         │
│  • Replicate for read throughput                    │
│  • Separate ingestion from query nodes              │
│                                                      │
│  1M vectors:    Single node, HNSW, 8GB RAM          │
│  10M vectors:   Single node, quantized, 16GB RAM    │
│  100M vectors:  Sharded cluster, 3-5 nodes          │
│  1B+ vectors:   Dedicated vector DB, GPU indexing   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Common Pitfalls and How to Avoid Them

### 1. Using the Wrong Embedding Model for Your Data

```
❌ Using a text embedding model for code search
✅ Use code-specific models (e.g., CodeBERT, voyage-code-2)

❌ Using an English model for multilingual data
✅ Use multilingual models (e.g., multilingual-e5-large)

❌ Using a 2-year-old model when better ones exist
✅ Check MTEB leaderboard for current best models
```

### 2. Not Evaluating Retrieval Quality

```python
# Build an evaluation set BEFORE optimizing
eval_set = [
    {
        "query": "What is our refund policy?",
        "expected_doc_ids": ["policy-doc-7", "faq-doc-12"]
    },
    # ... 50-100 examples
]

# Measure recall@k
hits = 0
for item in eval_set:
    results = vectorstore.similarity_search(item["query"], k=5)
    result_ids = [r.metadata["doc_id"] for r in results]
    if any(eid in result_ids for eid in item["expected_doc_ids"]):
        hits += 1

recall_at_5 = hits / len(eval_set)
print(f"Recall@5: {recall_at_5:.2%}")
# Target: > 85% for most use cases
```

### 3. Ignoring Metadata Filtering

Vector search alone isn't enough. You almost always need to combine it with metadata filters.

```python
# ❌ Search all products, then filter in application code
results = index.query(vector=query_vec, top_k=100)
filtered = [r for r in results if r.metadata["category"] == "shoes"][:5]
# Problem: your top-5 might have been filtered out!

# ✅ Filter during search
results = index.query(
    vector=query_vec,
    top_k=5,
    filter={"category": {"$eq": "shoes"}}
)
# The vector DB searches only within "shoes" and returns top-5
```

### 4. Chunk Size Mismatches

```
❌ Short queries against long chunks
   Query: "refund policy" (2 words)
   Chunk: 2000-word document section
   Result: embedding diluted, poor match

✅ Match query length to chunk length
   Query: "What is the refund policy for digital products?"
   Chunk: 200-word focused paragraph about refund policy
   Result: strong semantic match
```

---

## When NOT to Use a Vector Database

Vector databases are powerful, but they're not always the right tool:

| Scenario | Better Alternative |
|----------|-------------------|
| Exact keyword lookup | Traditional full-text search (Elasticsearch, PostgreSQL FTS) |
| Structured queries (filtering, aggregation) | SQL/NoSQL database |
| Small dataset (< 10K items) | In-memory brute force with NumPy/FAISS |
| Graph relationships | Graph database (Neo4j) |
| Time-series patterns | Time-series database (InfluxDB, TimescaleDB) |

**The sweet spot for vector databases:** You have 10K-1B+ items, users search by *meaning* rather than exact terms, and you need sub-100ms response times.

---

## Making the Choice: Decision Framework

```
Start here:
    │
    ▼
Do you already run PostgreSQL?
    ├── Yes ──▶ Is your dataset < 5M vectors?
    │              ├── Yes ──▶ pgvector ✓
    │              └── No  ──▶ Dedicated vector DB
    └── No
         │
         ▼
    Do you want zero ops?
    ├── Yes ──▶ Pinecone (serverless) or Zilliz Cloud
    └── No
         │
         ▼
    Do you need hybrid search built-in?
    ├── Yes ──▶ Weaviate or Elasticsearch
    └── No
         │
         ▼
    Performance + low memory priority?
    ├── Yes ──▶ Qdrant (Rust-based, efficient)
    └── No  ──▶ Milvus (most index options, GPU support)
```

---

## A Working Example: Semantic Search API

Here's a production-ready semantic search service from scratch:

```python
# search_service.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from qdrant_client import QdrantClient, models
import openai
import os

app = FastAPI()
qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
openai_client = openai.OpenAI()

COLLECTION = "articles"
EMBEDDING_MODEL = "text-embedding-3-small"
VECTOR_DIM = 1536

# Ensure collection exists on startup
@app.on_event("startup")
async def setup():
    collections = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION not in collections:
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(
                size=VECTOR_DIM,
                distance=models.Distance.COSINE
            )
        )

class Article(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str] = []

class SearchQuery(BaseModel):
    query: str
    top_k: int = 5
    tags: list[str] | None = None

def get_embedding(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        input=text,
        model=EMBEDDING_MODEL
    )
    return response.data[0].embedding

@app.post("/index")
async def index_article(article: Article):
    embedding = get_embedding(f"{article.title} {article.content}")
    qdrant.upsert(
        collection_name=COLLECTION,
        points=[models.PointStruct(
            id=article.id,
            vector=embedding,
            payload={
                "title": article.title,
                "content": article.content[:500],  # store preview
                "tags": article.tags
            }
        )]
    )
    return {"status": "indexed", "id": article.id}

@app.post("/search")
async def search(query: SearchQuery):
    query_vector = get_embedding(query.query)

    search_filter = None
    if query.tags:
        search_filter = models.Filter(
            must=[models.FieldCondition(
                key="tags",
                match=models.MatchAny(any=query.tags)
            )]
        )

    results = qdrant.search(
        collection_name=COLLECTION,
        query_vector=query_vector,
        query_filter=search_filter,
        limit=query.top_k
    )

    return [{
        "id": r.id,
        "score": r.score,
        "title": r.payload["title"],
        "content_preview": r.payload["content"],
        "tags": r.payload["tags"]
    } for r in results]
```

```bash
# Run it
pip install fastapi uvicorn qdrant-client openai
docker run -p 6333:6333 qdrant/qdrant
uvicorn search_service:app --reload

# Index an article
curl -X POST http://localhost:8000/index \
  -H "Content-Type: application/json" \
  -d '{"id": "1", "title": "Introduction to Vector DBs", "content": "Vector databases store embeddings...", "tags": ["database", "ai"]}'

# Search
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "how do embedding databases work", "top_k": 3}'
```

---

## What's Coming Next

The vector database space is evolving fast:

- **Multi-modal search** - Single databases handling text, image, audio, and video vectors side by side
- **Serverless and auto-scaling** - Pay-per-query pricing instead of always-on clusters
- **Built-in embedding** - Databases that handle vectorization internally (Weaviate already does this)
- **Tighter LLM integration** - Native RAG pipelines built into the database layer
- **Sparse + dense hybrid indexes** - Better handling of both exact and semantic matches in one index

---

## Key Takeaways

1. **Vector databases store meaning, not text.** They enable search by semantic similarity, not keyword matching.
2. **HNSW is your default index.** It's fast, accurate, and well-supported everywhere. Switch to IVF-PQ only when memory is a hard constraint.
3. **Chunking matters more than your database choice.** Bad chunks = bad search, regardless of the engine.
4. **pgvector is enough for most startups.** Don't over-engineer. If you're under 5M vectors and already on PostgreSQL, start there.
5. **Always combine vector search with metadata filtering.** Pure vector search rarely solves real problems alone.
6. **Measure retrieval quality.** Build an eval set early. Recall@5 above 85% is a good target.
7. **Hybrid search is almost always better than pure vector search.** Combine semantic and keyword signals for the best results.

The best vector database is the one that fits your existing stack, handles your current scale, and doesn't make you babysit infrastructure. Start simple. Measure. Scale when the numbers tell you to.

---

*Vector databases are not magic - they're math. But applied correctly, they make your application feel like magic to users.*
