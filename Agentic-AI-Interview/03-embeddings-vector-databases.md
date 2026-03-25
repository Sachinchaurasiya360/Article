# Section 3: Embeddings & Vector Databases

> Semantic representation of text, similarity search, indexing algorithms, and production vector store architecture.

---

## 📚 Pre-requisite Reading

> **We have covered Embeddings and Vector Databases extensively in existing deep-dive series. This section provides interview-focused questions and answers. For comprehensive learning, refer to:**
>
> - [RAG Deep Dive — Part 2: Embeddings — The Heart of RAG](../RAG/rag-deep-dive-part-2.md) — Embedding fundamentals, contrastive learning, similarity metrics, model comparisons, fine-tuning
> - [RAG Deep Dive — Part 3: Vector Databases & Indexing](../RAG/rag-deep-dive-part-3.md) — FAISS, HNSW, IVF, product quantization, database comparisons (Pinecone, Weaviate, Qdrant, ChromaDB, pgvector)
> - [AI Memory Deep Dive — Part 7: Embeddings — Teaching Meaning](../AI-Memory/ai-memory-deep-dive-part-7.md) — Sentence Transformers, multilingual embeddings, embedding optimization
> - [AI Memory Deep Dive — Part 8: Vector Databases](../AI-Memory/ai-memory-deep-dive-part-8.md) — Architecture deep dive, distributed indexing, scaling vector stores

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What are embeddings and why are they essential for LLM applications?

**Answer:**

Embeddings are dense, fixed-dimensional vector representations of text (or other data) in continuous vector space, where semantic similarity is captured by geometric proximity.

```
"king"   → [0.21, -0.45, 0.87, 0.12, ...]  (1536 dimensions)
"queen"  → [0.19, -0.42, 0.89, 0.15, ...]   ← Close to "king"
"banana" → [-0.67, 0.31, -0.12, 0.94, ...]   ← Far from "king"
```

**Why embeddings are essential for LLM apps:**

1. **Semantic search**: Find documents by meaning, not keywords ("How to fix authentication" matches "Login troubleshooting guide")
2. **RAG retrieval**: Bridge between user query and knowledge base
3. **Clustering**: Group similar documents, tickets, or user queries
4. **Classification**: Use as features for downstream classifiers
5. **Deduplication**: Detect near-duplicate content at scale
6. **Recommendation**: Find similar items based on content understanding

**Key properties of good embeddings:**
- Semantically similar texts produce similar vectors
- Dissimilar texts produce distant vectors
- Relationships are captured (king - man + woman ≈ queen)
- Robust to paraphrasing and stylistic variation

> **Deep dive**: See [RAG Part 2](../RAG/rag-deep-dive-part-2.md) for complete coverage of embedding fundamentals and training.

**Why interviewer asks this:** Foundational knowledge. If you can't explain embeddings clearly, downstream concepts (RAG, vector DBs) won't make sense.

**Follow-up:** What's the difference between static word embeddings (Word2Vec) and contextual embeddings (BERT/sentence-transformers)?

---

### Q2. 🟡 Compare cosine similarity, Euclidean distance, and dot product for vector search. When would you use each?

**Answer:**

| Metric | Formula | Range | Best When |
|--------|---------|-------|-----------|
| **Cosine similarity** | `cos(θ) = A·B / (‖A‖·‖B‖)` | [-1, 1] | Vectors are not normalized; care about direction, not magnitude |
| **Dot product** | `A·B = Σ(aᵢ × bᵢ)` | (-∞, ∞) | Vectors are normalized (then equivalent to cosine) or magnitude carries meaning |
| **Euclidean (L2)** | `√(Σ(aᵢ-bᵢ)²)` | [0, ∞) | Need true geometric distance; clustering applications |

```python
import numpy as np


def compare_metrics(a: np.ndarray, b: np.ndarray) -> dict:
    """Compare all three similarity metrics."""
    # Cosine similarity
    cosine = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    # Dot product
    dot = np.dot(a, b)

    # Euclidean distance (lower = more similar)
    euclidean = np.linalg.norm(a - b)

    return {"cosine": cosine, "dot_product": dot, "euclidean": euclidean}


# Scenario: "cat" vs "kitten" vs "car"
cat = np.array([0.8, 0.6, 0.1])
kitten = np.array([0.75, 0.65, 0.12])  # Semantically close to cat
car = np.array([0.1, 0.2, 0.95])        # Semantically distant

print("cat vs kitten:", compare_metrics(cat, kitten))
# cosine: 0.998, dot: 0.998, euclidean: 0.074  ← Very similar

print("cat vs car:", compare_metrics(cat, car))
# cosine: 0.302, dot: 0.295, euclidean: 1.151  ← Very different
```

**Practical recommendation:**
- **Most embedding models produce normalized vectors** → use **dot product** (fastest) or cosine similarity (same result)
- **OpenAI/Cohere embeddings** are normalized → dot product = cosine
- **If vectors have varying magnitudes** (e.g., TF-IDF weighted) → use **cosine similarity**
- **For clustering** (k-means, DBSCAN) → **Euclidean distance**

> **Deep dive**: See [RAG Part 2](../RAG/rag-deep-dive-part-2.md) for detailed coverage of similarity metrics with visualizations.

**Why interviewer asks this:** Understanding metric choice affects retrieval quality. Wrong metric = wrong results, even with perfect embeddings.

**Follow-up:** What happens to cosine similarity when embedding dimensions increase? (Hint: the "hubness" problem)

---

### Q3. 🟡 Explain HNSW (Hierarchical Navigable Small World). Why is it the dominant ANN algorithm?

**Answer:**

HNSW is an approximate nearest neighbor (ANN) algorithm that builds a multi-layer graph for fast similarity search.

**How it works:**

```
Layer 2 (sparse):     A -------- D                    (long-range connections)
                      |          |
Layer 1 (medium):     A --- B -- D --- F               (medium connections)
                      |    |    |    |
Layer 0 (dense):      A-B-C-D-E-F-G-H-I-J             (short-range connections)
                                                        (ALL nodes present)
```

**Search algorithm:**
1. Enter at the top layer (sparse, few nodes)
2. Greedily navigate to the nearest node at this layer
3. Drop to the next layer (same position) — more nodes visible
4. Repeat: greedily navigate → drop down
5. At Layer 0 (all nodes), do a refined local search
6. Return top-K nearest neighbors

**Why HNSW dominates:**

| Property | HNSW | IVF | Brute Force |
|----------|------|-----|-------------|
| Search speed | O(log n) | O(√n) | O(n) |
| Recall@10 | 95-99% | 90-95% | 100% |
| Memory | High (graph structure) | Low | Minimal |
| Build time | Slow | Fast | None |
| Dynamic insert | Yes | Requires rebuilding | Yes |
| Tunable | `ef_construction`, `M` | `nlist`, `nprobe` | N/A |

**HNSW parameters:**
- **M** (max connections per node): Higher M → better recall, more memory. Default: 16
- **ef_construction** (beam width during build): Higher → better graph, slower build. Default: 200
- **ef_search** (beam width during query): Higher → better recall, slower search. Runtime tunable

```python
import hnswlib
import numpy as np

# Build an HNSW index
dim = 1536  # OpenAI embedding dimension
num_vectors = 100_000

# Initialize index
index = hnswlib.Index(space='cosine', dim=dim)
index.init_index(
    max_elements=num_vectors,
    ef_construction=200,  # Build quality (higher = better but slower)
    M=16,                 # Connections per node (higher = more memory, better recall)
)

# Add vectors
vectors = np.random.randn(num_vectors, dim).astype(np.float32)
index.add_items(vectors, ids=np.arange(num_vectors))

# Search
index.set_ef(50)  # Search quality (runtime tunable)
query = np.random.randn(1, dim).astype(np.float32)
labels, distances = index.knn_query(query, k=10)
# Returns 10 nearest neighbors in ~1ms for 100K vectors
```

> **Deep dive**: See [RAG Part 3](../RAG/rag-deep-dive-part-3.md) for detailed HNSW algorithm walkthrough with visualizations.

**Why interviewer asks this:** HNSW powers most vector databases. Understanding it shows you can reason about vector search performance.

**Follow-up:** How do you tune HNSW parameters for a system that needs 99.5% recall vs one that needs <5ms latency?

---

### Q4. 🔴 When should you use pgvector vs a dedicated vector database (Pinecone/Qdrant/Weaviate)?

**Answer:**

| Factor | pgvector | Dedicated Vector DB |
|--------|----------|-------------------|
| **When to use** | < 5M vectors, existing Postgres infra, need JOINs with relational data | > 5M vectors, vector search is primary workload |
| **Scaling** | Vertical only (limited by single machine) | Horizontal (distributed sharding) |
| **Performance at scale** | Good up to ~5M vectors | Optimized for billions of vectors |
| **Hybrid search** | SQL + vector in one query | Requires separate text search integration |
| **Operations** | One fewer service to manage | New infrastructure to maintain |
| **Filtering** | Full SQL WHERE clauses with vector search | Metadata filtering (varies by vendor) |
| **Cost** | Free (open source) | $0 (self-hosted) to $$$$ (managed) |
| **Real-time updates** | ACID transactions | Eventually consistent (usually) |
| **Backup/Recovery** | Standard Postgres tooling | Vendor-specific |

```python
# pgvector: Great when you need relational + vector queries together
# Example: "Find similar products in the same category under $50"

"""
SELECT p.name, p.price, p.category,
       1 - (p.embedding <=> query_embedding) AS similarity
FROM products p
WHERE p.category = 'electronics'
  AND p.price < 50
  AND p.in_stock = true
ORDER BY p.embedding <=> query_embedding
LIMIT 10;
"""

# vs Dedicated vector DB: When vector search IS the product
# Example: Semantic search over 100M documents

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, Range

client = QdrantClient(url="http://localhost:6333")

# Create collection with HNSW configuration
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(
        size=1536,
        distance=Distance.COSINE,
        hnsw_config={"m": 16, "ef_construct": 100},
    ),
)

# Search with filtering
results = client.search(
    collection_name="documents",
    query_vector=query_embedding,
    query_filter=Filter(
        must=[
            FieldCondition(key="category", match={"value": "technical"}),
            FieldCondition(key="date", range=Range(gte="2024-01-01")),
        ]
    ),
    limit=10,
)
```

**Decision framework:**

```
Do you already use Postgres?
├── Yes → Is vector count < 5M AND vector search is secondary feature?
│         ├── Yes → Use pgvector
│         └── No → Consider dedicated vector DB
└── No → Is vector search the core product feature?
          ├── Yes → Dedicated vector DB (Qdrant/Weaviate for self-hosted, Pinecone for managed)
          └── No → pgvector (simpler to start with)
```

> **Deep dive**: See [RAG Part 3](../RAG/rag-deep-dive-part-3.md) for comprehensive vector database comparison.

**Why interviewer asks this:** Architecture decision that directly impacts cost, performance, and operational complexity. Shows practical judgment.

**Follow-up:** How does Qdrant's payload indexing differ from Pinecone's metadata filtering for pre-filtered vector search?

---

### Q5. 🔴 How do you handle embedding model migration (switching from one model to another)?

**Answer:**

Embedding model migration is one of the most painful operations in production AI systems because **embeddings from different models are not compatible** — you cannot compare vectors from model A with vectors from model B.

**Migration strategies:**

**Strategy 1: Full re-embedding (safest, most expensive)**
```python
import asyncio
from typing import AsyncGenerator


async def migrate_embeddings(
    vector_store,
    old_model,
    new_model,
    batch_size: int = 100,
) -> dict:
    """Re-embed all documents with the new model."""
    stats = {"total": 0, "success": 0, "failed": 0}

    # Create new collection (don't overwrite old one yet)
    new_collection = f"{vector_store.collection}_v2"
    vector_store.create_collection(new_collection, dimension=new_model.dimension)

    # Stream documents from old collection
    async for batch in vector_store.scroll(batch_size=batch_size):
        texts = [doc.text for doc in batch]

        try:
            # Generate new embeddings
            new_embeddings = await new_model.embed_batch(texts)

            # Insert into new collection
            await vector_store.upsert(
                collection=new_collection,
                documents=batch,
                embeddings=new_embeddings,
            )
            stats["success"] += len(batch)
        except Exception as e:
            stats["failed"] += len(batch)
            logger.error(f"Failed to migrate batch: {e}")

        stats["total"] += len(batch)

    return stats
```

**Strategy 2: Blue-Green deployment**
```
1. Create new collection with new model embeddings
2. Route a percentage of traffic to new collection
3. Compare retrieval quality metrics
4. Gradually shift traffic: 10% → 50% → 100%
5. Delete old collection after validation period

Timeline: Days to weeks depending on data size
```

**Strategy 3: Dual-write during transition**
```python
class DualEmbeddingService:
    """Write to both old and new model during migration."""

    def __init__(self, old_model, new_model, old_collection, new_collection):
        self.old_model = old_model
        self.new_model = new_model
        self.old_collection = old_collection
        self.new_collection = new_collection
        self.use_new_for_search = False  # Feature flag

    async def index(self, text: str, metadata: dict):
        """Write to both collections."""
        old_emb, new_emb = await asyncio.gather(
            self.old_model.embed(text),
            self.new_model.embed(text),
        )
        await asyncio.gather(
            self.old_collection.upsert(text, old_emb, metadata),
            self.new_collection.upsert(text, new_emb, metadata),
        )

    async def search(self, query: str, top_k: int = 10):
        """Search the active collection."""
        if self.use_new_for_search:
            emb = await self.new_model.embed(query)
            return await self.new_collection.search(emb, top_k)
        else:
            emb = await self.old_model.embed(query)
            return await self.old_collection.search(emb, top_k)
```

**Key considerations:**
- Re-embedding cost: 1M documents × $0.0001/embedding = $100 (cheap for small datasets, expensive at billions)
- Downtime: Plan for zero-downtime migration using blue-green
- Validation: Always compare retrieval quality before switching
- Dimension changes: New model may have different dimension (e.g., 1536 → 3072) — need new index

**Why interviewer asks this:** Real-world operational challenge. Models improve frequently, and migration is non-trivial.

**Follow-up:** How would you validate that the new embeddings produce better retrieval results before fully migrating?

---

## Coding Questions

### Q6. 🟢 Build an embedding-based semantic search engine from scratch.

```python
import numpy as np
from dataclasses import dataclass, field
from openai import OpenAI


@dataclass
class Document:
    id: str
    text: str
    metadata: dict = field(default_factory=dict)
    embedding: np.ndarray | None = None


class SemanticSearchEngine:
    """Simple but complete semantic search engine."""

    def __init__(self, model: str = "text-embedding-3-small"):
        self.client = OpenAI()
        self.model = model
        self.documents: list[Document] = []
        self._embeddings_matrix: np.ndarray | None = None

    def add_documents(self, documents: list[Document]):
        """Embed and index documents."""
        texts = [doc.text for doc in documents]

        # Batch embed (API supports up to 2048 inputs per call)
        embeddings = self._embed_batch(texts)

        for doc, emb in zip(documents, embeddings):
            doc.embedding = emb
            self.documents.append(doc)

        # Rebuild search matrix
        self._embeddings_matrix = np.array([doc.embedding for doc in self.documents])

    def search(
        self,
        query: str,
        top_k: int = 5,
        metadata_filter: dict | None = None,
    ) -> list[tuple[Document, float]]:
        """Search for documents similar to query."""
        if not self.documents:
            return []

        query_embedding = self._embed(query)

        # Compute cosine similarities
        similarities = self._cosine_similarity_batch(
            query_embedding, self._embeddings_matrix
        )

        # Apply metadata filter
        if metadata_filter:
            for i, doc in enumerate(self.documents):
                if not all(doc.metadata.get(k) == v for k, v in metadata_filter.items()):
                    similarities[i] = -1  # Exclude filtered documents

        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]

        return [
            (self.documents[i], float(similarities[i]))
            for i in top_indices
            if similarities[i] > 0
        ]

    def _embed(self, text: str) -> np.ndarray:
        response = self.client.embeddings.create(model=self.model, input=text)
        return np.array(response.data[0].embedding)

    def _embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        response = self.client.embeddings.create(model=self.model, input=texts)
        return [np.array(item.embedding) for item in response.data]

    @staticmethod
    def _cosine_similarity_batch(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between query and all documents."""
        # Normalize
        query_norm = query / np.linalg.norm(query)
        matrix_norms = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
        # Dot product of normalized vectors = cosine similarity
        return matrix_norms @ query_norm


# Usage
engine = SemanticSearchEngine()

docs = [
    Document("1", "Python is a programming language known for its simplicity",
             {"category": "programming"}),
    Document("2", "Machine learning uses algorithms to learn from data",
             {"category": "ai"}),
    Document("3", "FastAPI is a modern web framework for building APIs with Python",
             {"category": "programming"}),
    Document("4", "Neural networks are inspired by the human brain",
             {"category": "ai"}),
    Document("5", "Docker containers package applications with their dependencies",
             {"category": "devops"}),
]

engine.add_documents(docs)

results = engine.search("How to build web APIs?", top_k=3)
for doc, score in results:
    print(f"[{score:.3f}] {doc.text}")

# With metadata filter
results = engine.search("learning algorithms", top_k=3, metadata_filter={"category": "ai"})
```

**Why interviewer asks this:** Tests ability to build core infrastructure from scratch. Shows understanding of the embedding → index → search pipeline.

**Follow-up:** How would you make this production-ready? (Hint: persistent storage, batch processing, caching, concurrent access)

---

### Q7. 🟡 Implement hybrid search combining BM25 keyword search with vector search.

```python
import math
from collections import Counter, defaultdict
import numpy as np


class BM25:
    """BM25 keyword search implementation."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_lengths: list[int] = []
        self.avg_doc_length: float = 0
        self.doc_freqs: dict[str, int] = defaultdict(int)  # term → # docs containing term
        self.term_freqs: list[dict[str, int]] = []  # per-doc term frequencies
        self.num_docs: int = 0

    def index(self, documents: list[str]):
        """Build BM25 index from documents."""
        self.num_docs = len(documents)

        for doc in documents:
            terms = self._tokenize(doc)
            self.doc_lengths.append(len(terms))
            tf = Counter(terms)
            self.term_freqs.append(tf)

            for term in set(terms):
                self.doc_freqs[term] += 1

        self.avg_doc_length = sum(self.doc_lengths) / self.num_docs

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Return (doc_index, score) pairs."""
        query_terms = self._tokenize(query)
        scores = []

        for doc_idx in range(self.num_docs):
            score = 0
            for term in query_terms:
                if term not in self.doc_freqs:
                    continue

                df = self.doc_freqs[term]
                idf = math.log((self.num_docs - df + 0.5) / (df + 0.5) + 1)

                tf = self.term_freqs[doc_idx].get(term, 0)
                doc_len = self.doc_lengths[doc_idx]

                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_doc_length)

                score += idf * (numerator / denominator)

            scores.append((doc_idx, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return text.lower().split()


class HybridSearch:
    """
    Combine BM25 (keyword) and vector (semantic) search
    using Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, embedding_fn, alpha: float = 0.5, rrf_k: int = 60):
        """
        Args:
            embedding_fn: Function to generate embeddings
            alpha: Weight for vector search (1-alpha for BM25)
            rrf_k: RRF constant (default 60, standard value)
        """
        self.embedding_fn = embedding_fn
        self.alpha = alpha
        self.rrf_k = rrf_k
        self.bm25 = BM25()
        self.documents: list[str] = []
        self.embeddings: np.ndarray | None = None

    def index(self, documents: list[str]):
        """Index documents for both keyword and semantic search."""
        self.documents = documents
        self.bm25.index(documents)
        embeddings = [self.embedding_fn(doc) for doc in documents]
        self.embeddings = np.array(embeddings)

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float, str]]:
        """
        Hybrid search using Reciprocal Rank Fusion.
        Returns: [(doc_index, combined_score, document_text), ...]
        """
        # BM25 keyword search
        bm25_results = self.bm25.search(query, top_k=top_k * 2)

        # Vector semantic search
        query_emb = self.embedding_fn(query)
        similarities = self.embeddings @ query_emb / (
            np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_emb)
        )
        vector_ranking = np.argsort(similarities)[::-1][:top_k * 2]

        # Reciprocal Rank Fusion
        rrf_scores: dict[int, float] = defaultdict(float)

        for rank, (doc_idx, _) in enumerate(bm25_results):
            rrf_scores[doc_idx] += (1 - self.alpha) / (self.rrf_k + rank + 1)

        for rank, doc_idx in enumerate(vector_ranking):
            rrf_scores[doc_idx] += self.alpha / (self.rrf_k + rank + 1)

        # Sort by combined RRF score
        ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        return [(idx, score, self.documents[idx]) for idx, score in ranked]


# Usage
hybrid = HybridSearch(embedding_fn=get_embedding, alpha=0.6)  # 60% semantic, 40% keyword

documents = [
    "Python FastAPI framework for building REST APIs quickly",
    "The python snake is a large non-venomous reptile",
    "API design best practices for microservices architecture",
    "Building high-performance web services with async Python",
]

hybrid.index(documents)

# "python API" — keyword "python" + semantic "API development"
results = hybrid.search("python API development", top_k=3)
for idx, score, text in results:
    print(f"[{score:.4f}] {text}")
```

**Why interviewer asks this:** Hybrid search is the industry standard. Pure vector search misses exact keyword matches; pure keyword search misses semantic meaning. Tests practical search engineering.

**Follow-up:** How would you tune the `alpha` parameter between keyword and semantic search in production?

---

### Q8. 🔴 Implement embedding-based anomaly detection for monitoring user queries.

```python
import numpy as np
from collections import deque
from dataclasses import dataclass
from datetime import datetime


@dataclass
class QueryAnomaly:
    query: str
    anomaly_score: float
    nearest_cluster_distance: float
    timestamp: datetime
    reason: str


class EmbeddingAnomalyDetector:
    """
    Detect anomalous user queries by monitoring embedding space distribution.
    Useful for: detecting prompt injection, off-topic queries, abuse patterns.
    """

    def __init__(
        self,
        embedding_fn,
        window_size: int = 1000,
        anomaly_threshold: float = 2.5,
    ):
        self.embedding_fn = embedding_fn
        self.window_size = window_size
        self.anomaly_threshold = anomaly_threshold

        # Rolling window of recent embeddings
        self.recent_embeddings = deque(maxlen=window_size)
        self.centroid: np.ndarray | None = None
        self.std_distance: float = 0.0

    def _update_statistics(self):
        """Recompute centroid and standard deviation of distances."""
        if len(self.recent_embeddings) < 10:
            return

        embeddings = np.array(list(self.recent_embeddings))
        self.centroid = embeddings.mean(axis=0)

        # Compute distances from centroid
        distances = np.linalg.norm(embeddings - self.centroid, axis=1)
        self.mean_distance = distances.mean()
        self.std_distance = distances.std()

    def check(self, query: str) -> QueryAnomaly | None:
        """Check if a query is anomalous."""
        embedding = self.embedding_fn(query)

        # Add to window
        self.recent_embeddings.append(embedding)

        # Need minimum data to detect anomalies
        if len(self.recent_embeddings) < 50:
            self._update_statistics()
            return None

        # Compute distance from centroid
        distance = float(np.linalg.norm(embedding - self.centroid))

        # Z-score: how many standard deviations from the mean distance
        if self.std_distance == 0:
            z_score = 0
        else:
            z_score = (distance - self.mean_distance) / self.std_distance

        # Update statistics periodically
        if len(self.recent_embeddings) % 100 == 0:
            self._update_statistics()

        if z_score > self.anomaly_threshold:
            reason = self._classify_anomaly(query, z_score, distance)
            return QueryAnomaly(
                query=query,
                anomaly_score=z_score,
                nearest_cluster_distance=distance,
                timestamp=datetime.now(),
                reason=reason,
            )

        return None

    def _classify_anomaly(self, query: str, z_score: float, distance: float) -> str:
        """Classify the type of anomaly."""
        if z_score > 5.0:
            return "extreme_outlier"
        if any(kw in query.lower() for kw in ["ignore", "system prompt", "override"]):
            return "potential_injection"
        if len(query) > 5000:
            return "unusually_long_query"
        return "off_topic"


# Usage in a FastAPI application
from fastapi import FastAPI, HTTPException

app = FastAPI()
detector = EmbeddingAnomalyDetector(embedding_fn=get_embedding)


@app.post("/query")
async def handle_query(query: str):
    # Check for anomalous queries
    anomaly = detector.check(query)

    if anomaly and anomaly.anomaly_score > 4.0:
        # Log and potentially block
        logger.warning(f"Blocked anomalous query: {anomaly}")
        raise HTTPException(400, "Query flagged for review")

    if anomaly:
        # Log but allow (soft alert)
        logger.info(f"Anomalous query detected: {anomaly}")

    # Process normally
    return await process_query(query)
```

**Why interviewer asks this:** Novel application of embeddings beyond search. Shows creative problem-solving and production monitoring awareness.

**Follow-up:** How would you handle concept drift where the "normal" query distribution shifts over time?

---

## Debugging Scenarios

### Q9. 🟡 Debug: Semantic search returns irrelevant results for short queries.

```python
# Problem: "pricing" returns documents about "machine learning pricing models"
# instead of "our product pricing page"

results = vector_store.search("pricing", top_k=5)
# Returns ML papers about "pricing models" instead of the actual pricing page

# WHY?
```

**Answer:**

Short queries have **ambiguous semantic representation**. The word "pricing" alone could mean financial pricing, pricing models in ML, or pricing theory in economics.

**Root cause:** Single-word queries produce embedding vectors that sit in a general region of the vector space, matching any document that discusses the concept loosely. Longer, more specific queries produce more targeted embeddings.

**Fixes:**

```python
# Fix 1: Query expansion — enrich short queries with context
def expand_query(query: str, domain: str = "product") -> str:
    """Expand short queries with domain context."""
    if len(query.split()) <= 2:
        return f"{query} {domain} information page"
    return query

# Fix 2: Hybrid search — BM25 finds exact keyword matches
results = hybrid_search("pricing", alpha=0.3)  # Weight toward keyword for short queries

# Fix 3: Metadata boosting — prefer certain document types
results = vector_store.search(
    "pricing",
    filter={"document_type": "product_page"},  # Boost product pages
    top_k=5,
)

# Fix 4: Adaptive alpha — use more keyword weight for short queries
def adaptive_search(query: str) -> list:
    word_count = len(query.split())
    if word_count <= 2:
        alpha = 0.3  # 30% semantic, 70% keyword
    elif word_count <= 5:
        alpha = 0.5  # Balanced
    else:
        alpha = 0.7  # 70% semantic, 30% keyword
    return hybrid_search(query, alpha=alpha)
```

**Why interviewer asks this:** Common production issue that tests practical search debugging skills.

---

### Q10. 🔴 Debug: Vector search latency spiked from 5ms to 500ms after data growth.

```python
# Timeline:
# Month 1: 100K vectors, search latency: 5ms
# Month 6: 2M vectors, search latency: 500ms (100× slower!)

# Index configuration (hasn't changed since day 1):
index_config = {
    "type": "hnsw",
    "m": 16,
    "ef_construction": 100,
    "ef_search": 50,
}
```

**Answer:**

Multiple compounding issues:

1. **HNSW index not rebuilt**: Parameters optimized for 100K don't scale to 2M. Need to rebuild with higher `M` and `ef_construction`.

2. **Memory pressure**: HNSW keeps the graph in memory. 2M × 1536 dimensions × 4 bytes = 12 GB just for vectors, plus graph structure. If spilling to disk, performance collapses.

3. **No quantization**: Full FP32 vectors consume 4× more memory than necessary.

**Fix:**

```python
# 1. Optimize HNSW parameters for current scale
new_config = {
    "type": "hnsw",
    "m": 32,                # Increase for larger dataset
    "ef_construction": 200,  # Higher build quality
    "ef_search": 100,        # Higher for maintained recall at scale
}

# 2. Add quantization to reduce memory footprint
index_config = {
    "type": "hnsw",
    "m": 32,
    "ef_construction": 200,
    "quantization": {
        "type": "scalar",       # Scalar quantization: FP32 → INT8
        "rescoring": True,      # Re-score top candidates with full vectors
    },
}

# 3. Consider IVF+PQ for this scale
# IVF (Inverted File) + PQ (Product Quantization) is more memory-efficient
# at 2M+ vectors than HNSW
ivf_config = {
    "type": "ivf_pq",
    "nlist": 4096,          # Number of clusters (sqrt(n) rule: sqrt(2M) ≈ 1414)
    "nprobe": 64,           # Clusters to search (higher = better recall, slower)
    "pq_segments": 48,      # Product quantization segments
}

# 4. Enable memory-mapped storage if available
# This prevents OOM while keeping search fast
```

**Why interviewer asks this:** Scaling vector search is a real operational challenge. Tests infrastructure thinking.

---

## Output-Based Questions

### Q11. 🟢 What does this embedding comparison reveal?

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

def embed(text):
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return np.array(resp.data[0].embedding)

def cosine_sim(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

e1 = embed("The bank approved my loan application")
e2 = embed("I sat on the river bank and watched the water")
e3 = embed("The financial institution processed my mortgage request")

print(f"bank(finance) vs bank(river): {cosine_sim(e1, e2):.3f}")
print(f"bank(finance) vs mortgage:    {cosine_sim(e1, e3):.3f}")
print(f"bank(river) vs mortgage:      {cosine_sim(e2, e3):.3f}")
```

**Expected Output:**
```
bank(finance) vs bank(river): ~0.45-0.55  (moderate — share word "bank" but different meaning)
bank(finance) vs mortgage:    ~0.80-0.90  (high — same semantic meaning, different words)
bank(river) vs mortgage:      ~0.20-0.35  (low — completely different topics)
```

**Key insight:** Modern embedding models handle **polysemy** (same word, different meanings) correctly. "bank" in a financial context is embedded closer to "financial institution" than to "bank" in a nature context. This is because models embed the full sentence context, not individual words.

---

## Real-World Case Studies

### Q12. 🔴 Case Study: Building a duplicate detection system for a customer support platform.

**Scenario:** Your support platform receives 10,000 tickets/day. ~30% are duplicates or near-duplicates of existing tickets. Design a system to detect and merge them.

**Architecture:**

```python
from dataclasses import dataclass
import numpy as np


@dataclass
class DuplicateCandidate:
    ticket_id: str
    original_ticket_id: str
    similarity_score: float
    match_type: str  # "exact", "near_duplicate", "related"


class TicketDeduplicator:
    def __init__(
        self,
        embedding_fn,
        vector_store,
        exact_threshold: float = 0.97,
        near_dup_threshold: float = 0.88,
        related_threshold: float = 0.78,
    ):
        self.embedding_fn = embedding_fn
        self.vector_store = vector_store
        self.exact_threshold = exact_threshold
        self.near_dup_threshold = near_dup_threshold
        self.related_threshold = related_threshold

    async def check_duplicate(self, ticket_text: str) -> DuplicateCandidate | None:
        """Check if a new ticket is a duplicate of an existing one."""

        # Step 1: Embed the new ticket
        embedding = await self.embedding_fn(ticket_text)

        # Step 2: Search for similar tickets (last 30 days)
        candidates = await self.vector_store.search(
            embedding,
            top_k=5,
            filter={"status": {"$ne": "closed"}, "age_days": {"$lte": 30}},
        )

        if not candidates:
            return None

        best = candidates[0]
        score = best.score

        # Step 3: Classify match type
        if score >= self.exact_threshold:
            return DuplicateCandidate(
                ticket_id="new",
                original_ticket_id=best.id,
                similarity_score=score,
                match_type="exact",
            )
        elif score >= self.near_dup_threshold:
            # Step 4: LLM verification for near-duplicates (reduce false positives)
            is_dup = await self._llm_verify(ticket_text, best.text)
            if is_dup:
                return DuplicateCandidate(
                    ticket_id="new",
                    original_ticket_id=best.id,
                    similarity_score=score,
                    match_type="near_duplicate",
                )
        elif score >= self.related_threshold:
            return DuplicateCandidate(
                ticket_id="new",
                original_ticket_id=best.id,
                similarity_score=score,
                match_type="related",  # Suggest linking, don't auto-merge
            )

        return None

    async def _llm_verify(self, ticket_a: str, ticket_b: str) -> bool:
        """Use LLM as a judge to verify near-duplicate status."""
        response = await self.llm_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"""Are these two support tickets about the same issue?

Ticket A: {ticket_a}
Ticket B: {ticket_b}

Answer ONLY "YES" or "NO"."""
            }],
            temperature=0,
            max_tokens=5,
        )
        return "yes" in response.choices[0].message.content.lower()
```

**Threshold tuning methodology:**
1. Label 500 ticket pairs as duplicate/not-duplicate
2. Plot precision-recall curve at different thresholds
3. Choose threshold based on business requirements:
   - High precision (fewer false merges) → higher threshold
   - High recall (catch more duplicates) → lower threshold + LLM verification

**Why interviewer asks this:** Tests end-to-end system design using embeddings. Shows understanding of threshold tuning, multi-stage verification, and production concerns.

**Follow-up:** How would you handle multi-language tickets where the same issue is reported in English and Spanish?
