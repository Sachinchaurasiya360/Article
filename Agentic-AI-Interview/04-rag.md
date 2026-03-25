# Section 4: Retrieval-Augmented Generation (RAG)

> Architectures, chunking strategies, retrieval pipelines, advanced patterns, and production RAG systems.

---

## 📚 Pre-requisite Reading

> **We have a comprehensive 10-part RAG deep-dive series. This section provides interview-focused questions. For full coverage, refer to:**
>
> - [RAG Part 0: What Is RAG? Foundations](../RAG/rag-deep-dive-part-0.md) — RAG vs fine-tuning vs prompt engineering, architecture overview
> - [RAG Part 1: Text Preprocessing & Chunking](../RAG/rag-deep-dive-part-1.md) — Document loading, chunking strategies (fixed, recursive, semantic, agentic)
> - [RAG Part 2: Embeddings](../RAG/rag-deep-dive-part-2.md) — Embedding models, similarity metrics, fine-tuning
> - [RAG Part 3: Vector Databases & Indexing](../RAG/rag-deep-dive-part-3.md) — FAISS, HNSW, IVF, database comparisons
> - [RAG Part 4: Retrieval Strategies](../RAG/rag-deep-dive-part-4.md) — BM25, dense search, hybrid, HyDE, query transformation
> - [RAG Part 5: Building First RAG Pipeline](../RAG/rag-deep-dive-part-5.md) — End-to-end implementation
> - [RAG Part 6: Advanced RAG Patterns](../RAG/rag-deep-dive-part-6.md) — Re-ranking, MMR, Self-RAG, Graph RAG, RAPTOR
> - [RAG Part 7: Evaluation & Debugging](../RAG/rag-deep-dive-part-7.md) — Precision@K, Recall@K, NDCG, MRR, hallucination detection
> - [RAG Part 8: Production RAG](../RAG/rag-deep-dive-part-8.md) — Scaling, monitoring, caching, latency/cost optimization
> - [RAG Part 9: Multi-Modal & Agentic RAG](../RAG/rag-deep-dive-part-9.md) — Multi-modal retrieval, agentic RAG
>
> Also see [AI Memory Part 9: Retrieval-Augmented Generation](../AI-Memory/ai-memory-deep-dive-part-9.md) for the memory-systems perspective on RAG.

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What is RAG, and why does it exist? What problem does it solve that fine-tuning cannot?

**Answer:**

RAG (Retrieval-Augmented Generation) augments an LLM's generation with external knowledge retrieved at inference time, solving the fundamental limitations of parametric-only models.

**Problems RAG solves:**

| LLM Limitation | RAG Solution |
|----------------|-------------|
| Knowledge cutoff (training data is static) | Retrieve up-to-date information at query time |
| Hallucination (confident fabrication) | Ground responses in retrieved source documents |
| No source attribution | Return source documents alongside the answer |
| Domain knowledge gaps | Index domain-specific documents without retraining |
| Context length limits | Retrieve only relevant passages, not entire corpus |

**RAG vs Fine-Tuning decision matrix:**

| Factor | RAG | Fine-Tuning |
|--------|-----|------------|
| Knowledge that changes frequently | ✅ Update vector store | ❌ Requires retraining |
| Needs source citations | ✅ Returns source docs | ❌ Cannot cite sources |
| Response style/format | ❌ Limited control | ✅ Learns style from examples |
| Latency sensitive | ❌ +200-500ms retrieval | ✅ Single model call |
| Private/proprietary data | ✅ Data stays in your vector store | ⚠️ Data goes into model weights |
| Cost to implement | Medium (vector store infra) | High (GPU compute for training) |

**The RAG pipeline:**

```
User Query → Query Processing → Retrieval → Re-ranking → Context Assembly → LLM Generation → Response
               ↓                    ↓           ↓              ↓                ↓
         Query expansion      Vector search  Cross-encoder  Prompt template   Grounded answer
         HyDE                 BM25 hybrid    MMR diversity  Token management  + source citations
```

> **Deep dive**: See [RAG Part 0](../RAG/rag-deep-dive-part-0.md) for comprehensive foundations.

**Why interviewer asks this:** Foundational question that every AI engineer must answer precisely. Tests understanding of why RAG exists, not just how it works.

**Follow-up:** When would you choose fine-tuning over RAG, or use both together?

---

### Q2. 🟡 Compare chunking strategies: fixed-size, recursive, semantic, and document-aware. When do you use each?

**Answer:**

| Strategy | How It Works | Best For | Drawback |
|----------|-------------|----------|----------|
| **Fixed-size** | Split every N characters/tokens | Uniform processing, simple implementation | Breaks mid-sentence, ignores structure |
| **Recursive** | Split by hierarchy: paragraphs → sentences → words | General-purpose, respects structure | May produce uneven chunk sizes |
| **Semantic** | Split where embedding similarity drops (topic boundary) | Topic-focused retrieval | Expensive (requires embeddings during chunking) |
| **Document-aware** | Use document structure (headers, sections, tables) | Structured docs (HTML, Markdown, PDF) | Requires document-type-specific parsers |

```python
# Recursive chunking (most commonly used in production)
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,        # Target chunk size in characters
    chunk_overlap=50,      # Overlap between chunks (prevents context loss at boundaries)
    separators=[
        "\n\n",  # First try: paragraph breaks
        "\n",    # Then: line breaks
        ". ",    # Then: sentence boundaries
        " ",     # Last resort: word boundaries
    ],
)

chunks = splitter.split_text(document_text)


# Semantic chunking (for topic-heavy documents)
import numpy as np


def semantic_chunk(text: str, embedding_fn, threshold: float = 0.5) -> list[str]:
    """Split text at points where topic changes (embedding similarity drops)."""
    sentences = text.split(". ")
    embeddings = [embedding_fn(s) for s in sentences]

    chunks = []
    current_chunk = [sentences[0]]

    for i in range(1, len(sentences)):
        # Compute similarity between current sentence and previous
        sim = np.dot(embeddings[i], embeddings[i-1]) / (
            np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[i-1])
        )

        if sim < threshold:
            # Topic change detected — start new chunk
            chunks.append(". ".join(current_chunk) + ".")
            current_chunk = [sentences[i]]
        else:
            current_chunk.append(sentences[i])

    chunks.append(". ".join(current_chunk) + ".")
    return chunks
```

**Production recommendations:**
- **Start with recursive chunking** (chunk_size=512, overlap=50) — works well for 80% of use cases
- **Switch to semantic chunking** if retrieval quality is poor for topic-diverse documents
- **Use document-aware chunking** for structured formats (Markdown headers, HTML sections, PDF layouts)
- **Chunk size tuning**: Smaller chunks (256-512) for precise Q&A; larger chunks (1024-2048) for summarization

> **Deep dive**: See [RAG Part 1](../RAG/rag-deep-dive-part-1.md) for detailed coverage of all chunking strategies with code.

**Why interviewer asks this:** Chunking is the most impactful parameter in RAG quality. Bad chunking = bad retrieval, regardless of everything else.

**Follow-up:** What is the "lost in the middle" problem and how does chunk ordering in the context window affect LLM attention?

---

### Q3. 🟡 What is the re-ranking stage in RAG? Why is it necessary if vector search already returns relevant results?

**Answer:**

Re-ranking is a second-stage scoring step that uses a **cross-encoder** to more accurately score the relevance of retrieved documents to the query.

**Why vector search alone isn't enough:**

```
Vector search (bi-encoder):
  Query embedding + Doc embedding → cosine similarity
  - Fast (pre-computed embeddings)
  - But: scores based on independent embeddings, no cross-attention between query and doc

Re-ranking (cross-encoder):
  [Query + Document] → single model → relevance score
  - Slow (must process query-doc pair together)
  - But: full cross-attention between query and document tokens → much more accurate
```

**The retrieval funnel:**

```
All documents (1M+)
    ↓ Vector search (fast, approximate) → top 50-100 candidates
        ↓ Cross-encoder re-ranking (slow, accurate) → top 5-10 results
            ↓ LLM generation (expensive) → final answer
```

```python
# Re-ranking with a cross-encoder
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-12-v2")


def retrieve_and_rerank(query: str, vector_store, top_k: int = 5) -> list[dict]:
    """Two-stage retrieval: vector search → cross-encoder re-ranking."""

    # Stage 1: Fast vector search (retrieve more candidates than needed)
    candidates = vector_store.search(query, top_k=top_k * 5)

    # Stage 2: Re-rank with cross-encoder
    pairs = [(query, doc.text) for doc in candidates]
    scores = reranker.predict(pairs)

    # Sort by cross-encoder score and return top-k
    reranked = sorted(
        zip(candidates, scores),
        key=lambda x: x[1],
        reverse=True,
    )[:top_k]

    return [{"document": doc, "score": float(score)} for doc, score in reranked]
```

**Impact:**
- Bi-encoder alone: Recall@10 ~85%, Precision@5 ~60%
- With cross-encoder re-ranking: Recall@10 ~85%, Precision@5 ~80% (+20% improvement)
- Latency cost: +50-100ms for 50 candidates

> **Deep dive**: See [RAG Part 6](../RAG/rag-deep-dive-part-6.md) for comprehensive coverage of re-ranking including MMR and Cohere Rerank.

**Why interviewer asks this:** Re-ranking is the single highest-impact improvement for RAG quality. Tests understanding of the precision-recall tradeoff.

**Follow-up:** What is Maximal Marginal Relevance (MMR) and how does it balance relevance with diversity?

---

### Q4. 🔴 Explain Self-RAG, Graph RAG, and RAPTOR. When would you use each?

**Answer:**

These are advanced RAG architectures that address limitations of basic retrieve-and-generate:

**Self-RAG (Self-Reflective RAG):**

The model decides at each step: (1) Should I retrieve? (2) Is the retrieved content relevant? (3) Is my generation grounded in the retrieval?

```
Query: "What is the tallest building in the world?"
Step 1: [RETRIEVE] → Yes, I need external info
Step 2: Retrieve documents about tall buildings
Step 3: [IS_RELEVANT] → Document about Burj Khalifa is relevant
Step 4: Generate: "The Burj Khalifa at 828m..."
Step 5: [IS_GROUNDED] → Yes, the answer is supported by the retrieved document
Step 6: [IS_USEFUL] → Yes, this answers the question
```

**When to use**: When retrieval is sometimes unnecessary (wastes latency) or when you need built-in hallucination detection.

**Graph RAG:**

Builds a knowledge graph from documents, then uses graph traversal for retrieval — capturing relationships that vector search misses.

```python
# Graph RAG concept
# Instead of: flat document chunks → vector search
# Graph RAG: documents → entities + relationships → graph → traversal + vector search

class GraphRAG:
    def __init__(self, llm, vector_store, knowledge_graph):
        self.llm = llm
        self.vector_store = vector_store
        self.kg = knowledge_graph

    async def query(self, question: str) -> str:
        # Step 1: Extract entities from question
        entities = await self.llm.extract_entities(question)
        # e.g., ["Eiffel Tower", "Paris", "height"]

        # Step 2: Traverse graph to find related entities and relationships
        graph_context = self.kg.get_subgraph(entities, depth=2)
        # Returns: Eiffel Tower → located_in → Paris
        #          Eiffel Tower → height → 330m
        #          Paris → country → France

        # Step 3: Also do vector search for additional context
        vector_context = self.vector_store.search(question, top_k=3)

        # Step 4: Combine graph + vector context for generation
        combined_context = format_graph_context(graph_context) + format_docs(vector_context)
        return await self.llm.generate(question, combined_context)
```

**When to use**: Documents with complex relationships (legal, medical, financial), multi-hop questions ("Who is the CEO of the company that acquired Twitter?")

**RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval):**

Builds a hierarchical tree: leaf nodes are raw chunks, parent nodes are summaries of children, root is a summary of the whole document. Query can match at any level.

```
Root: "This is a comprehensive guide to machine learning..."
├── Section summary: "Supervised learning involves..."
│   ├── Chunk: "Linear regression assumes a linear relationship..."
│   ├── Chunk: "Logistic regression is used for classification..."
│   └── Chunk: "Decision trees split data based on feature values..."
├── Section summary: "Unsupervised learning discovers hidden patterns..."
│   ├── Chunk: "K-means clustering partitions data into K groups..."
│   └── Chunk: "PCA reduces dimensionality by finding..."
```

**When to use**: Long documents where questions range from specific details to broad themes; thematic questions ("What are the main arguments in this paper?")

> **Deep dive**: See [RAG Part 6](../RAG/rag-deep-dive-part-6.md) for implementation details of all three patterns.

**Why interviewer asks this:** Tests knowledge of the RAG research frontier. Senior engineers need to evaluate and implement advanced patterns.

**Follow-up:** How do you decide between basic RAG and these advanced patterns without over-engineering?

---

### Q5. 🔴 What is the "lost in the middle" problem, and how do you mitigate it?

**Answer:**

LLMs pay more attention to information at the **beginning** and **end** of their context window, while information in the **middle** gets less attention — even when it's the most relevant.

```
Attention distribution over context window:
|█████████|         |         |         |█████████|
|  High   |   Low   |  Very   |   Low   |  High   |
|attention |         |  Low    |         |attention |
| (start) |         | (middle)|         |  (end)  |
```

**Research finding**: When the relevant document is placed in position 10 out of 20 retrieved documents, LLM accuracy drops by 20-30% compared to position 1 or 20.

**Mitigation strategies:**

```python
def optimal_context_ordering(query: str, retrieved_docs: list[dict]) -> list[dict]:
    """Order retrieved documents to maximize LLM attention on the most relevant ones."""

    # Strategy 1: Put most relevant at the beginning AND end
    # "Sandwich" less relevant docs in the middle
    sorted_by_relevance = sorted(retrieved_docs, key=lambda d: d["score"], reverse=True)

    n = len(sorted_by_relevance)
    reordered = []

    # Alternate: best, 3rd best, 5th best... then worst to 2nd best
    top_half = sorted_by_relevance[:n//2]
    bottom_half = sorted_by_relevance[n//2:]

    # Top docs at start, bottom docs in middle, 2nd-top docs at end
    reordered = top_half[::2] + bottom_half + top_half[1::2][::-1]

    return reordered


def reduce_context_size(docs: list[dict], max_docs: int = 5) -> list[dict]:
    """Strategy 2: Simply use fewer, higher-quality documents."""
    # Fewer docs = less "middle" to get lost in
    # Often: 3-5 highly relevant docs > 15 mixed-relevance docs
    return sorted(docs, key=lambda d: d["score"], reverse=True)[:max_docs]
```

**Additional mitigations:**
- **Fewer, better documents**: 3-5 highly relevant > 10+ mixed relevance
- **Contextual compression**: Summarize each document to its most relevant parts before including
- **Multi-turn retrieval**: Break complex queries into sub-queries, retrieve for each independently
- **Explicit citation prompting**: "Answer based on Source 3" forces the model to attend to specific documents

**Why interviewer asks this:** Tests awareness of LLM limitations that directly impact RAG system quality.

**Follow-up:** How would you experimentally measure the "lost in the middle" effect for your specific model and use case?

---

## Coding Questions

### Q6. 🟡 Build a complete RAG pipeline with query transformation, retrieval, re-ranking, and generation.

```python
from dataclasses import dataclass
from openai import AsyncOpenAI
import numpy as np


@dataclass
class RAGResponse:
    answer: str
    sources: list[dict]
    query_transformations: list[str]
    retrieval_scores: list[float]
    confidence: float


class ProductionRAGPipeline:
    """
    Full RAG pipeline with:
    - Query understanding and transformation
    - Hybrid retrieval (vector + keyword)
    - Cross-encoder re-ranking
    - Context assembly with token management
    - Grounded generation with source attribution
    """

    def __init__(self, client: AsyncOpenAI, vector_store, bm25_index, reranker):
        self.client = client
        self.vector_store = vector_store
        self.bm25 = bm25_index
        self.reranker = reranker

    async def query(self, user_query: str, top_k: int = 5) -> RAGResponse:
        # Stage 1: Query Understanding
        transformed_queries = await self._transform_query(user_query)

        # Stage 2: Multi-Query Retrieval
        all_candidates = []
        for q in transformed_queries:
            # Vector search
            vector_results = await self.vector_store.search(q, top_k=top_k * 3)
            # BM25 keyword search
            keyword_results = self.bm25.search(q, top_k=top_k * 3)

            all_candidates.extend(vector_results)
            all_candidates.extend(keyword_results)

        # Deduplicate by document ID
        seen_ids = set()
        unique_candidates = []
        for doc in all_candidates:
            if doc.id not in seen_ids:
                seen_ids.add(doc.id)
                unique_candidates.append(doc)

        # Stage 3: Re-ranking
        if len(unique_candidates) > top_k:
            pairs = [(user_query, doc.text) for doc in unique_candidates]
            scores = self.reranker.predict(pairs)
            ranked = sorted(
                zip(unique_candidates, scores),
                key=lambda x: x[1],
                reverse=True,
            )[:top_k]
            final_docs = [doc for doc, _ in ranked]
            final_scores = [float(s) for _, s in ranked]
        else:
            final_docs = unique_candidates
            final_scores = [1.0] * len(unique_candidates)

        # Stage 4: Context Assembly
        context = self._assemble_context(final_docs, max_tokens=3000)

        # Stage 5: Generation
        answer = await self._generate(user_query, context)

        return RAGResponse(
            answer=answer,
            sources=[{"id": d.id, "text": d.text[:200], "metadata": d.metadata} for d in final_docs],
            query_transformations=transformed_queries,
            retrieval_scores=final_scores,
            confidence=np.mean(final_scores) if final_scores else 0.0,
        )

    async def _transform_query(self, query: str) -> list[str]:
        """Generate multiple query perspectives for better retrieval coverage."""
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """Generate 3 different search queries that would help answer the user's question.
Each query should approach the topic from a different angle.
Return one query per line, nothing else."""
                },
                {"role": "user", "content": query},
            ],
            temperature=0.3,
            max_tokens=200,
        )
        queries = response.choices[0].message.content.strip().split("\n")
        return [query] + [q.strip() for q in queries if q.strip()]  # Original + variations

    def _assemble_context(self, docs: list, max_tokens: int = 3000) -> str:
        """Assemble context string with source numbering and token budget."""
        context_parts = []
        total_chars = 0
        char_limit = max_tokens * 4  # Rough char-to-token ratio

        for i, doc in enumerate(docs):
            source_text = f"[Source {i+1}]: {doc.text}"
            if total_chars + len(source_text) > char_limit:
                break
            context_parts.append(source_text)
            total_chars += len(source_text)

        return "\n\n".join(context_parts)

    async def _generate(self, query: str, context: str) -> str:
        """Generate answer grounded in retrieved context."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """Answer the user's question based ONLY on the provided context.
Rules:
- If the context doesn't contain enough information, say so explicitly
- Cite sources using [Source N] notation
- Do not make up information not in the context
- Be concise and direct"""
                },
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {query}"
                },
            ],
            temperature=0.1,
        )
        return response.choices[0].message.content
```

> **Deep dive**: See [RAG Part 5](../RAG/rag-deep-dive-part-5.md) for step-by-step pipeline building tutorial.

**Why interviewer asks this:** Tests ability to build a complete RAG system, not just isolated components.

**Follow-up:** How would you add caching to this pipeline to reduce latency and cost for repeated or similar queries?

---

### Q7. 🔴 Implement Hypothetical Document Embeddings (HyDE) for improved retrieval.

```python
class HyDERetriever:
    """
    HyDE: Instead of embedding the query directly, generate a hypothetical
    answer and embed THAT. The hypothetical answer is closer in embedding
    space to the actual relevant documents.

    Query: "How does photosynthesis work?"
    → Generate hypothetical answer: "Photosynthesis is the process by which plants
       convert sunlight into chemical energy. Chlorophyll in leaves absorbs light..."
    → Embed the hypothetical answer
    → Search for similar documents (which are about photosynthesis)
    """

    def __init__(self, client: AsyncOpenAI, vector_store, embedding_fn):
        self.client = client
        self.vector_store = vector_store
        self.embedding_fn = embedding_fn

    async def search(self, query: str, top_k: int = 5, n_hypothetical: int = 3) -> list:
        """HyDE retrieval: generate hypothetical docs, embed them, search."""

        # Step 1: Generate N hypothetical documents
        hypothetical_docs = await self._generate_hypothetical(query, n=n_hypothetical)

        # Step 2: Embed hypothetical documents
        all_results = []
        for hyp_doc in hypothetical_docs:
            embedding = self.embedding_fn(hyp_doc)
            results = await self.vector_store.search_by_vector(embedding, top_k=top_k)
            all_results.extend(results)

        # Step 3: Deduplicate and rank by frequency + score
        doc_scores: dict[str, float] = {}
        doc_map: dict[str, object] = {}
        for doc in all_results:
            if doc.id in doc_scores:
                doc_scores[doc.id] = max(doc_scores[doc.id], doc.score)  # Keep best score
            else:
                doc_scores[doc.id] = doc.score
                doc_map[doc.id] = doc

        ranked = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [doc_map[doc_id] for doc_id, _ in ranked]

    async def _generate_hypothetical(self, query: str, n: int = 3) -> list[str]:
        """Generate N hypothetical documents that would answer the query."""
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""Generate {n} different hypothetical document passages that would
contain the answer to the user's question. Each passage should:
- Be 3-5 sentences long
- Sound like it came from a real reference document
- Cover different aspects of the answer
- Be factually plausible (even if not perfectly accurate)

Separate passages with ---"""
                },
                {"role": "user", "content": query},
            ],
            temperature=0.7,  # Some diversity in hypothetical docs
        )

        passages = response.choices[0].message.content.split("---")
        return [p.strip() for p in passages if p.strip()]


# Performance comparison
async def compare_retrieval_methods(query: str, vector_store, hyde_retriever):
    """Compare standard vs HyDE retrieval."""

    # Standard: embed the query directly
    standard_results = await vector_store.search(query, top_k=5)

    # HyDE: embed hypothetical answers
    hyde_results = await hyde_retriever.search(query, top_k=5)

    print(f"Query: {query}")
    print(f"\nStandard retrieval:")
    for doc in standard_results:
        print(f"  [{doc.score:.3f}] {doc.text[:100]}...")

    print(f"\nHyDE retrieval:")
    for doc in hyde_results:
        print(f"  [{doc.score:.3f}] {doc.text[:100]}...")
```

**When HyDE helps:**
- Queries phrased as questions (very different embedding from documents that contain answers)
- Short queries with ambiguous terms
- Domain-specific jargon where query terms differ from document terms

**When HyDE hurts:**
- Simple keyword queries where direct embedding works fine
- Adds latency (+200-500ms for hypothetical generation)
- Hypothetical documents may be wrong, leading to retrieval of wrong documents

> **Deep dive**: See [RAG Part 4](../RAG/rag-deep-dive-part-4.md) for detailed HyDE analysis.

**Why interviewer asks this:** Tests understanding of the query-document embedding gap and creative solutions to it.

**Follow-up:** How would you decide whether HyDE improves retrieval for your specific dataset without expensive manual evaluation?

---

## Debugging Scenarios

### Q8. 🟡 Debug: RAG system answers questions correctly for short documents but hallucinates for long ones.

```python
# Setup: 100-page technical manual indexed in RAG system
# Short queries about page 1-5: Accurate answers
# Queries about content on page 50+: Hallucinated answers that sound plausible

# Current configuration:
chunk_size = 2000      # Characters per chunk
chunk_overlap = 0      # No overlap
top_k = 3              # Retrieve 3 chunks
```

**Answer:**

Multiple issues:

1. **Chunk size too large (2000 chars)**: Large chunks dilute the relevant information with surrounding noise. The embedding represents the whole chunk, so a 2000-char chunk about multiple topics gets a "blended" embedding that doesn't match specific queries well.

2. **No overlap**: Context at chunk boundaries is lost. If a concept spans two chunks, neither chunk fully captures it.

3. **Only 3 chunks retrieved**: For a 100-page document, 3 chunks cover ~2% of the content. Questions about specific sections may not hit the right chunks.

4. **No metadata filtering**: No way to target specific sections/pages.

**Fix:**

```python
# Improved configuration
chunk_size = 500        # Smaller, more focused chunks
chunk_overlap = 100     # Overlap to preserve boundary context
top_k = 8              # Retrieve more candidates

# Add re-ranking to keep quality high despite retrieving more
reranked_top_k = 5     # Re-rank 8 candidates down to 5

# Add section metadata during indexing
for chunk in chunks:
    chunk.metadata = {
        "page_number": extract_page(chunk),
        "section_title": extract_section_header(chunk),
        "document_name": doc.name,
    }

# Add parent-document retrieval: store small chunks for search,
# but return the larger parent chunk for context
small_chunks = split(document, chunk_size=200)   # Search on these
large_chunks = split(document, chunk_size=1000)   # Return these as context
```

**Why interviewer asks this:** Chunking configuration is the #1 source of RAG quality issues. Tests practical debugging.

---

### Q9. 🔴 Debug: RAG works perfectly in development but fails in production with real user queries.

```python
# Development test queries (hand-crafted):
# "What is the refund policy for enterprise customers?" → Perfect answer

# Production user queries (real users):
# "yo can i get my money back lol" → Irrelevant retrieval
# "REFUND!!!!" → No results
# "What is your policy on returning purchased items for monetary reimbursement?" → Mediocre results
```

**Answer:**

**Root cause:** Development queries are clean, well-formed, and semantically close to the indexed documents. Real user queries are messy, colloquial, or over-formal.

**The query-document semantic gap:**

```
Document indexed:  "Enterprise customers may request a full refund within 30 days..."
Dev query:         "What is the refund policy for enterprise customers?" → 0.92 similarity ✅
User query:        "yo can i get my money back lol"                      → 0.51 similarity ❌
User query:        "REFUND!!!!"                                          → 0.38 similarity ❌
```

**Fixes:**

```python
class QueryPreprocessor:
    """Normalize and enhance real user queries before retrieval."""

    def __init__(self, client):
        self.client = client

    async def preprocess(self, raw_query: str) -> str:
        """Transform messy user query into clean retrieval query."""

        # Step 1: Basic normalization
        query = raw_query.strip()
        query = re.sub(r'[!?]{2,}', '?', query)  # "REFUND!!!!" → "REFUND?"
        query = query.lower()

        # Step 2: If query is too short or unclear, expand it
        if len(query.split()) <= 3:
            query = await self._expand_query(query)

        return query

    async def _expand_query(self, short_query: str) -> str:
        """Use LLM to expand terse queries into searchable form."""
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": "Rewrite this short/informal query as a clear, "
                "specific search query. Keep it concise (1-2 sentences). "
                "Just output the rewritten query, nothing else."
            }, {
                "role": "user",
                "content": short_query
            }],
            temperature=0,
            max_tokens=100,
        )
        return response.choices[0].message.content.strip()

# "yo can i get my money back lol" → "What is the refund or money back policy?"
# "REFUND!!!!" → "What is the refund policy?"
```

**Additional production hardening:**
1. **Hybrid search**: BM25 catches "REFUND" keyword even when embedding fails
2. **Query logging and analysis**: Track queries with low retrieval scores → identify failure patterns
3. **Synonym expansion**: Map colloquial terms to formal terms in metadata
4. **Eval on real queries**: Always test with actual user queries, not synthetic ones

**Why interviewer asks this:** The dev-to-production gap is the #1 reason RAG systems fail in the real world.

---

## Output-Based Questions

### Q10. 🟡 What happens when retrieved context contradicts itself?

```python
# Retrieved documents:
context = """
[Source 1]: The company was founded in 2015 by John Smith.
[Source 2]: Founded in 2016, the company was started by John Smith and Jane Doe.
[Source 3]: The company has been operating since its 2015 founding.
"""

prompt = f"""Based on the context, when was the company founded and by whom?
Context: {context}
"""
```

**Expected behavior:**

A well-prompted LLM should acknowledge the contradiction:

```
"Based on the provided sources, there is a discrepancy regarding the founding date.
Sources 1 and 3 indicate the company was founded in 2015, while Source 2 states 2016.
The majority of sources (2 out of 3) support 2015. Regarding the founders, Source 1
mentions only John Smith, while Source 2 adds Jane Doe as a co-founder. The most
complete answer based on available information: the company was founded in 2015 by
John Smith, with Jane Doe potentially as a co-founder [Source 2]."
```

**Without explicit instructions to handle contradictions**, the model will typically pick whichever source it processes first or last (recency/primacy bias), and present it as fact — which is dangerous.

**Production fix**: Always include contradiction handling in your system prompt:
```
"If sources contradict each other, acknowledge the discrepancy and indicate which
sources support each claim. Do not silently pick one version."
```

---

## Real-World Case Studies

### Q11. 🔴 Case Study: Building a RAG system for a legal document platform.

**Scenario:** A law firm needs an AI assistant that can answer questions about 500,000+ legal documents (contracts, case law, regulations). Accuracy is paramount — wrong answers have legal liability.

**Unique challenges:**
1. **Zero tolerance for hallucination**: Wrong legal advice = malpractice risk
2. **Precise citations required**: Must cite exact clause/section numbers
3. **Temporal reasoning**: Laws change; need to know which version was active when
4. **Cross-document reasoning**: "Does contract A conflict with regulation B?"

**Architecture decisions:**

```python
class LegalRAGSystem:
    """RAG system with legal-domain-specific enhancements."""

    def __init__(self):
        # Document-aware chunking: respect legal document structure
        self.chunker = LegalDocumentChunker(
            respect_sections=True,      # Never split within a legal section
            include_hierarchy=True,      # "Article 3, Section 2, Paragraph (a)"
            preserve_cross_references=True,  # Keep "See Section 5.2" intact
        )

        # Multi-index architecture
        self.clause_index = VectorIndex("clauses")     # Individual clauses
        self.section_index = VectorIndex("sections")    # Full sections
        self.document_index = VectorIndex("documents")  # Document summaries

        # Hybrid retrieval with heavy keyword weight (legal = precise terminology)
        self.retriever = HybridRetriever(alpha=0.4)  # 40% semantic, 60% keyword

    async def query(self, question: str, temporal_context: str = "current") -> dict:
        # Step 1: Multi-level retrieval
        clause_results = await self.clause_index.search(question, top_k=10)
        section_results = await self.section_index.search(question, top_k=5)

        # Step 2: Temporal filtering
        if temporal_context != "current":
            clause_results = [c for c in clause_results
                            if c.metadata["effective_date"] <= temporal_context]

        # Step 3: Cross-encoder re-ranking (legal-specific model)
        reranked = self.legal_reranker.rerank(question, clause_results + section_results)

        # Step 4: Generate with strict grounding
        answer = await self._generate_with_citations(question, reranked[:5])

        # Step 5: Hallucination check — verify every claim against sources
        verification = await self._verify_claims(answer, reranked[:5])

        return {
            "answer": answer,
            "citations": self._extract_citations(answer),
            "verification": verification,
            "confidence": verification.confidence_score,
            "disclaimer": "This is AI-generated analysis and does not constitute legal advice."
        }

    async def _verify_claims(self, answer: str, sources: list) -> dict:
        """Post-generation verification: check every factual claim against sources."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": """You are a legal fact-checker. For each factual claim in the answer,
verify whether it is directly supported by the provided sources.
Return a JSON list of claims with "supported": true/false and "source": source_id."""
            }, {
                "role": "user",
                "content": f"Answer: {answer}\n\nSources: {format_sources(sources)}"
            }],
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
```

**Key design decisions:**
- **60% keyword, 40% semantic**: Legal language is precise; "force majeure" must match exactly
- **Multi-level indexing**: Questions range from "What does clause 3.2(a) say?" to "What are the termination rights?"
- **Post-generation verification**: Every claim is verified against sources before returning
- **Mandatory disclaimer**: AI-generated legal analysis always needs a disclaimer

> **Deep dive**: See [RAG Part 8](../RAG/rag-deep-dive-part-8.md) for production RAG architecture patterns.

**Why interviewer asks this:** Tests ability to adapt RAG for high-stakes domains with domain-specific constraints.

**Follow-up:** How would you handle a user asking about the interaction between two different contracts that were indexed separately?
