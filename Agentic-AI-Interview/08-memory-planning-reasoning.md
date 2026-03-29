# Section 8: Memory, Planning & Reasoning

> Working memory, long-term memory, episodic and semantic memory systems, planning algorithms, and reasoning chain architectures for AI agents.

---

## 📚 Pre-requisite Reading

> **We have an exceptional 20-part AI Memory deep-dive series. This section provides interview-focused questions. For complete coverage, refer to:**
>
> - [AI Memory Part 0: What Is Memory in AI?](../AI-Memory/ai-memory-deep-dive-part-0.md) - Five types of AI memory, memory architecture
> - [AI Memory Part 4: Transformers & Context Windows](../AI-Memory/ai-memory-deep-dive-part-4.md) - Context window limitations, position encoding
> - [AI Memory Part 5: The Memory Wall](../AI-Memory/ai-memory-deep-dive-part-5.md) - Context limits, KV cache, breaking through limitations
> - [AI Memory Part 6: External Memory](../AI-Memory/ai-memory-deep-dive-part-6.md) - External memory systems, persistent storage
> - [AI Memory Part 11: Short-Term vs Long-Term Memory](../AI-Memory/ai-memory-deep-dive-part-11.md) - Conversation memory, summarization, consolidation
> - [AI Memory Part 12: Memory Compression](../AI-Memory/ai-memory-deep-dive-part-12.md) - Summarization techniques, token efficiency
> - [AI Memory Part 13: Updating & Editing Memory](../AI-Memory/ai-memory-deep-dive-part-13.md) - Knowledge updates, contradiction handling
> - [AI Memory Part 14: Personalization](../AI-Memory/ai-memory-deep-dive-part-14.md) - User profiling, adaptive systems
> - [AI Memory Part 16: Autonomous Agents With Memory](../AI-Memory/ai-memory-deep-dive-part-16.md) - Agent architecture, working/episodic/semantic/procedural memory
> - [AI Memory Part 17: Scaling Memory Systems](../AI-Memory/ai-memory-deep-dive-part-17.md) - Distributed memory, production deployment
> - [AI Memory Part 19: Production Memory Platform](../AI-Memory/ai-memory-deep-dive-part-19.md) - Complete production system capstone

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What are the types of memory in AI agents and how do they map to human cognition?

**Answer:**

| Memory Type | Human Analogy | AI Implementation | Duration |
|-------------|---------------|-------------------|----------|
| **Working Memory** | Thinking about current task | Context window (current conversation) | One session |
| **Short-term Memory** | Remembering today's conversations | Conversation buffer, summarized history | Hours to days |
| **Long-term Episodic** | Personal experiences | Stored past interactions, indexed by time/context | Persistent |
| **Long-term Semantic** | General knowledge | Knowledge base, vector store, knowledge graph | Persistent |
| **Procedural** | How to ride a bike | Learned tool usage patterns, cached plans | Persistent |

**How they interact in an agent:**

```
User message arrives
    ↓
┌─ Working Memory (context window) ──────────────────────┐
│  System prompt + recent messages + current tool results │
│                        ↕                                │
│  Retrieve from Long-term Memory:                        │
│    • Episodic: "Last time user asked about X, they..."  │
│    • Semantic: "Company refund policy states..."         │
│    • Procedural: "Use tool A then tool B for this task"  │
└────────────────────────────────────────────────────────┘
    ↓
Generate response
    ↓
Store in memory:
  • Episodic: Save this interaction
  • Semantic: Extract and store any new facts
  • Update user preferences if applicable
```

> **Deep dive**: See [AI Memory Part 0](../AI-Memory/ai-memory-deep-dive-part-0.md) for comprehensive memory taxonomy and [Part 16](../AI-Memory/ai-memory-deep-dive-part-16.md) for agent-specific memory architectures.

**Why interviewer asks this:** Memory is what separates stateless chatbots from intelligent agents. Tests conceptual understanding.

**Follow-up:** Why can't you just use a very large context window (e.g., 1M tokens) instead of building explicit memory systems?

---

### Q2. 🟡 Why are large context windows (128K, 1M tokens) not a replacement for proper memory systems?

**Answer:**

| Limitation of Large Context | Why Memory Systems Are Still Needed |
|---------------------------|-------------------------------------|
| **Cost scales linearly** | 128K tokens × $0.003/1K = $0.38 per call. Memory systems serve only relevant info. |
| **Latency increases** | More tokens → slower inference. Memory retrieval is O(log n) vs O(n) full context. |
| **"Lost in the middle"** | LLMs attend poorly to information in the middle of long contexts. |
| **No persistence** | Context resets between sessions. Memory persists. |
| **No structure** | Raw text in context vs organized, indexed, queryable memory. |
| **No selective forgetting** | Can't prioritize what to remember vs forget in a flat context. |
| **No cross-session learning** | Each session starts fresh. Memory enables learning over time. |

```python
# Cost comparison for a customer support agent
# Scenario: User with 6-month conversation history (50 conversations, ~200K tokens total)

# Approach 1: Stuff everything in context
cost_per_call_full_context = 200_000 / 1000 * 0.003  # $0.60 per call
# Plus: slow, lost-in-the-middle, includes irrelevant conversations

# Approach 2: Memory system - retrieve only relevant context
relevant_tokens = 2000  # Top 5 relevant past interactions
cost_per_call_memory = 2000 / 1000 * 0.003  # $0.006 per call
# 100× cheaper, faster, more accurate

# Memory overhead: embedding + storage ≈ $0.001 per conversation (one-time cost)
```

**The memory hierarchy (production pattern):**

```
1. System prompt (always present)          ~500 tokens
2. User profile from long-term memory      ~200 tokens
3. Retrieved relevant past interactions    ~1000 tokens
4. Current conversation (last N messages)  ~2000 tokens
5. Tool results from current turn          ~500 tokens
                                    Total: ~4200 tokens (vs 200K for full history)
```

> **Deep dive**: See [AI Memory Part 5](../AI-Memory/ai-memory-deep-dive-part-5.md) for "The Memory Wall" - why context windows have fundamental limits.

**Why interviewer asks this:** Common misconception that "bigger context = solved memory." Tests understanding of scaling constraints.

**Follow-up:** When IS it appropriate to use the full context window instead of external memory?

---

### Q3. 🟡 Explain conversation memory strategies: buffer, window, summary, and hybrid.

**Answer:**

```python
# Strategy 1: Buffer Memory - keep everything
class BufferMemory:
    """Keep all messages. Simplest but doesn't scale."""
    def __init__(self):
        self.messages = []

    def add(self, message):
        self.messages.append(message)

    def get_context(self):
        return self.messages  # Returns ALL messages - context grows unbounded


# Strategy 2: Window Memory - keep last N messages
class WindowMemory:
    """Keep only the most recent N messages."""
    def __init__(self, window_size: int = 20):
        self.messages = []
        self.window_size = window_size

    def add(self, message):
        self.messages.append(message)

    def get_context(self):
        return self.messages[-self.window_size:]  # Loses early context


# Strategy 3: Summary Memory - summarize old conversations
class SummaryMemory:
    """Progressively summarize older messages to save tokens."""
    def __init__(self, llm, summary_threshold: int = 20):
        self.llm = llm
        self.summary = ""
        self.recent_messages = []
        self.threshold = summary_threshold

    def add(self, message):
        self.recent_messages.append(message)
        if len(self.recent_messages) > self.threshold:
            self._compress()

    async def _compress(self):
        """Summarize older messages and keep only recent ones."""
        old_messages = self.recent_messages[:self.threshold // 2]
        self.recent_messages = self.recent_messages[self.threshold // 2:]

        new_summary = await self.llm.summarize(
            f"Previous summary: {self.summary}\n\n"
            f"New messages: {format_messages(old_messages)}"
        )
        self.summary = new_summary

    def get_context(self):
        context = []
        if self.summary:
            context.append({"role": "system", "content": f"Conversation summary: {self.summary}"})
        context.extend(self.recent_messages)
        return context


# Strategy 4: Hybrid - summary + semantic retrieval + recent window
class HybridMemory:
    """
    Production-grade memory combining:
    - Summary of overall conversation
    - Semantic retrieval of relevant past exchanges
    - Recent message window
    """
    def __init__(self, llm, vector_store, window_size: int = 10):
        self.summary_memory = SummaryMemory(llm)
        self.vector_store = vector_store
        self.window_size = window_size
        self.all_messages = []

    def add(self, message):
        self.all_messages.append(message)
        self.summary_memory.add(message)
        # Index message for semantic retrieval
        self.vector_store.add(
            text=message["content"],
            metadata={"role": message["role"], "index": len(self.all_messages)},
        )

    async def get_context(self, current_query: str) -> list:
        """Build context: summary + relevant past + recent window."""
        context = []

        # 1. Conversation summary (compressed history)
        if self.summary_memory.summary:
            context.append({
                "role": "system",
                "content": f"Conversation history summary: {self.summary_memory.summary}"
            })

        # 2. Semantically relevant past messages
        relevant = await self.vector_store.search(current_query, top_k=5)
        if relevant:
            relevant_text = "\n".join(f"[{r.metadata['role']}]: {r.text}" for r in relevant)
            context.append({
                "role": "system",
                "content": f"Relevant past exchanges:\n{relevant_text}"
            })

        # 3. Recent messages (window)
        context.extend(self.all_messages[-self.window_size:])

        return context
```

**Comparison:**

| Strategy | Token Usage | Information Loss | Best For |
|----------|-----------|-----------------|----------|
| Buffer | O(n) - grows forever | None | Short conversations (<20 turns) |
| Window | O(1) - fixed | Loses early context | Simple chatbots, FAQ |
| Summary | O(log n) - compressed | Lossy compression | Long conversations |
| Hybrid | O(k) - selective | Minimal | Production agents |

> **Deep dive**: See [AI Memory Part 11](../AI-Memory/ai-memory-deep-dive-part-11.md) for detailed coverage of all memory strategies.

**Why interviewer asks this:** Memory management is a daily engineering challenge for production AI systems.

**Follow-up:** How do you handle the case where the summary loses a critical detail that becomes relevant later?

---

### Q4. 🔴 What is planning in AI agents? Compare task decomposition, goal-driven planning, and hierarchical planning.

**Answer:**

Planning is the process of decomposing a high-level goal into an ordered sequence of achievable sub-tasks.

**Task Decomposition:**
```
Goal: "Write a blog post about quantum computing"
Decomposition:
1. Research quantum computing basics
2. Identify 3 key concepts to explain
3. Write an outline
4. Draft each section
5. Review and edit
6. Add code examples
```
- Simple, linear decomposition
- No replanning, no adaptation
- Works for well-understood tasks

**Goal-Driven Planning (like STRIPS/classical planning):**
```
Current State: {has_research: false, has_outline: false, has_draft: false}
Goal State:    {has_published_post: true}

Plan search:
  research() → {has_research: true}
  outline(has_research) → {has_outline: true}
  draft(has_outline) → {has_draft: true}
  review(has_draft) → {has_reviewed_draft: true}
  publish(has_reviewed_draft) → {has_published_post: true}
```
- State-based: reasons about preconditions and effects
- Can handle complex dependencies
- More robust but harder to implement

**Hierarchical Task Network (HTN):**
```
write_blog_post
├── prepare_content
│   ├── research_topic
│   │   ├── search_web("quantum computing basics")
│   │   └── summarize_findings()
│   └── create_outline
│       ├── identify_key_points()
│       └── structure_sections()
├── write_content
│   ├── write_intro()
│   ├── write_body_sections()
│   └── write_conclusion()
└── finalize
    ├── proofread()
    └── format_for_publishing()
```
- Multi-level: abstract plans decompose into concrete actions
- Most natural for complex, multi-step tasks
- Used in production agentic systems

```python
class HierarchicalPlanner:
    """
    HTN-inspired planner that decomposes high-level tasks
    into executable sub-tasks recursively.
    """

    def __init__(self, llm):
        self.llm = llm

    async def plan(self, goal: str, max_depth: int = 3) -> dict:
        """Generate a hierarchical plan."""
        return await self._decompose(goal, depth=0, max_depth=max_depth)

    async def _decompose(self, task: str, depth: int, max_depth: int) -> dict:
        """Recursively decompose a task into sub-tasks."""
        if depth >= max_depth:
            return {"task": task, "type": "atomic", "subtasks": []}

        response = await self.llm.chat([{
            "role": "system",
            "content": """Decompose this task into 2-5 sub-tasks.
If a sub-task is simple enough to execute directly, mark it as "atomic".
If it needs further decomposition, mark it as "composite".

Return JSON: {"subtasks": [{"task": "...", "type": "atomic|composite"}]}"""
        }, {
            "role": "user",
            "content": f"Decompose: {task}"
        }])

        plan_data = json.loads(response.content)

        subtasks = []
        for subtask in plan_data["subtasks"]:
            if subtask["type"] == "composite":
                decomposed = await self._decompose(subtask["task"], depth + 1, max_depth)
                subtasks.append(decomposed)
            else:
                subtasks.append({"task": subtask["task"], "type": "atomic", "subtasks": []})

        return {"task": task, "type": "composite", "subtasks": subtasks}

    def get_execution_order(self, plan: dict) -> list[str]:
        """Flatten hierarchical plan into ordered list of atomic tasks."""
        if plan["type"] == "atomic":
            return [plan["task"]]

        ordered = []
        for subtask in plan["subtasks"]:
            ordered.extend(self.get_execution_order(subtask))
        return ordered
```

**Why interviewer asks this:** Planning determines how well agents handle complex tasks. Tests understanding of classical AI planning applied to LLM agents.

**Follow-up:** How do you handle replanning when a sub-task fails midway through execution?

---

### Q5. 🔴 Explain different reasoning paradigms: Chain-of-Thought, Tree of Thoughts, and Graph of Thoughts.

**Answer:**

These represent increasing sophistication in how LLMs explore reasoning paths:

**Chain-of-Thought (CoT):**
```
Single linear reasoning path:
Step 1 → Step 2 → Step 3 → Answer
```
- One path explored
- Simple, fast, effective for straightforward problems
- Can fail if the reasoning hits a dead end

**Tree of Thoughts (ToT):**
```
                   Step 1
                  /      \
            Step 2a      Step 2b
           /      \         |
     Step 3a  Step 3b    Step 3c
       |         |          |
   Answer A  Answer B   Answer C  ← Evaluate and select best
```
- Multiple reasoning paths explored in parallel
- BFS or DFS through the thought tree
- Each node is evaluated: "Is this a promising direction?"
- Backtrack from dead ends

**Graph of Thoughts (GoT):**
```
        Step 1 ──→ Step 2a ──→ Step 3
           |            ↕           ↑
           └──→ Step 2b ──→ Step 2c ┘
                             ↓
                       Merge(2a, 2c) → Step 4
```
- Thoughts can merge, split, and loop
- Operations: generate, aggregate, refine, score
- Most flexible but most complex

```python
class TreeOfThoughts:
    """
    Tree of Thoughts implementation for complex reasoning problems.
    """

    def __init__(self, llm, evaluator, breadth: int = 3, depth: int = 4):
        self.llm = llm
        self.evaluator = evaluator
        self.breadth = breadth  # Thoughts per node
        self.depth = depth      # Max reasoning depth

    async def solve(self, problem: str) -> dict:
        """Solve using Tree of Thoughts with BFS."""
        # Initialize with the problem
        current_level = [{"thought": problem, "path": [problem], "score": 1.0}]

        for level in range(self.depth):
            next_level = []

            for node in current_level:
                # Generate multiple next thoughts
                children = await self._generate_thoughts(node["thought"], node["path"])

                # Evaluate each thought
                for child in children:
                    score = await self._evaluate_thought(problem, node["path"] + [child])
                    next_level.append({
                        "thought": child,
                        "path": node["path"] + [child],
                        "score": score,
                    })

            # Prune: keep only the top-k most promising paths
            next_level.sort(key=lambda x: x["score"], reverse=True)
            current_level = next_level[:self.breadth]

            # Check if any path has reached a solution
            for node in current_level:
                if await self._is_solution(problem, node["path"]):
                    return {
                        "solution": node["path"][-1],
                        "reasoning_path": node["path"],
                        "confidence": node["score"],
                    }

        # Return best path found
        best = max(current_level, key=lambda x: x["score"])
        return {
            "solution": best["path"][-1],
            "reasoning_path": best["path"],
            "confidence": best["score"],
        }

    async def _generate_thoughts(self, current: str, path: list[str]) -> list[str]:
        """Generate multiple possible next reasoning steps."""
        response = await self.llm.chat([{
            "role": "user",
            "content": f"""Problem reasoning path so far:
{chr(10).join(f'Step {i}: {s}' for i, s in enumerate(path))}

Generate {self.breadth} different possible next reasoning steps.
Each should be a meaningfully different approach.
Return one thought per line."""
        }])
        return [t.strip() for t in response.content.strip().split("\n") if t.strip()][:self.breadth]

    async def _evaluate_thought(self, problem: str, path: list[str]) -> float:
        """Evaluate how promising a reasoning path is (0-1)."""
        response = await self.evaluator.chat([{
            "role": "user",
            "content": f"""Problem: {problem}
Reasoning path: {path}

Rate how promising this reasoning path is for solving the problem.
Score from 0.0 (dead end) to 1.0 (very promising).
Reply with ONLY a number."""
        }])
        try:
            return float(response.content.strip())
        except ValueError:
            return 0.5

    async def _is_solution(self, problem: str, path: list[str]) -> bool:
        """Check if the current path contains a complete solution."""
        response = await self.evaluator.chat([{
            "role": "user",
            "content": f"Problem: {problem}\nPath: {path[-1]}\n\n"
            "Does this contain a complete, correct solution? Answer YES or NO."
        }])
        return "yes" in response.content.lower()
```

**When to use each:**

| Problem Type | Best Approach | Why |
|-------------|--------------|-----|
| Simple math, factual Q&A | CoT | One clear reasoning path |
| Creative writing, open-ended | ToT | Multiple valid approaches |
| Multi-constraint optimization | GoT | Need to combine partial solutions |
| Coding challenges | ToT | Try multiple algorithms |
| Strategic planning | GoT | Complex interdependencies |

**Why interviewer asks this:** Tests knowledge of advanced reasoning techniques that are used in frontier AI research and production.

**Follow-up:** What is the computational cost of Tree of Thoughts vs Chain-of-Thought, and when is the cost justified?

---

## Coding Questions

### Q6. 🟡 Build a persistent memory system for an AI assistant.

```python
import json
import hashlib
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class MemoryEntry:
    content: str
    memory_type: str  # "episodic", "semantic", "preference"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    importance: float = 0.5
    access_count: int = 0
    last_accessed: str = ""
    metadata: dict = field(default_factory=dict)

    @property
    def id(self) -> str:
        return hashlib.md5(f"{self.content}{self.created_at}".encode()).hexdigest()[:12]


class PersistentMemory:
    """
    Production memory system with:
    - Episodic memory (past interactions)
    - Semantic memory (extracted facts)
    - User preferences
    - Importance-based retrieval and forgetting
    """

    def __init__(self, llm, vector_store, user_id: str):
        self.llm = llm
        self.vector_store = vector_store
        self.user_id = user_id

    async def remember(self, conversation: list[dict]):
        """Extract and store memories from a conversation."""
        # Extract different memory types in parallel
        episodic, semantic, preferences = await asyncio.gather(
            self._extract_episodic(conversation),
            self._extract_semantic(conversation),
            self._extract_preferences(conversation),
        )

        # Store all memories
        for memory in episodic + semantic + preferences:
            embedding = await self._embed(memory.content)
            await self.vector_store.upsert(
                id=memory.id,
                vector=embedding,
                metadata={
                    "user_id": self.user_id,
                    "type": memory.memory_type,
                    "importance": memory.importance,
                    "created_at": memory.created_at,
                    "content": memory.content,
                },
            )

    async def recall(self, query: str, memory_types: list[str] = None, top_k: int = 5) -> list[MemoryEntry]:
        """Retrieve relevant memories for a query."""
        embedding = await self._embed(query)

        filters = {"user_id": self.user_id}
        if memory_types:
            filters["type"] = {"$in": memory_types}

        results = await self.vector_store.search(
            vector=embedding,
            filter=filters,
            top_k=top_k,
        )

        memories = []
        for r in results:
            entry = MemoryEntry(
                content=r.metadata["content"],
                memory_type=r.metadata["type"],
                importance=r.metadata.get("importance", 0.5),
                created_at=r.metadata.get("created_at", ""),
            )
            memories.append(entry)

        return memories

    async def build_context(self, current_query: str) -> str:
        """Build a memory context block for the LLM."""
        # Retrieve relevant memories of each type
        episodic = await self.recall(current_query, ["episodic"], top_k=3)
        semantic = await self.recall(current_query, ["semantic"], top_k=3)
        preferences = await self.recall(current_query, ["preference"], top_k=2)

        context_parts = []

        if preferences:
            context_parts.append("User preferences:\n" + "\n".join(
                f"- {m.content}" for m in preferences
            ))

        if semantic:
            context_parts.append("Known facts:\n" + "\n".join(
                f"- {m.content}" for m in semantic
            ))

        if episodic:
            context_parts.append("Relevant past interactions:\n" + "\n".join(
                f"- {m.content}" for m in episodic
            ))

        return "\n\n".join(context_parts)

    async def _extract_episodic(self, conversation: list[dict]) -> list[MemoryEntry]:
        """Extract episodic memories (what happened in this conversation)."""
        response = await self.llm.chat([{
            "role": "system",
            "content": "Extract key events/interactions from this conversation. "
            "Focus on: what the user asked, what was decided, outcomes. "
            "Return one memory per line. Only include noteworthy events."
        }, {
            "role": "user",
            "content": json.dumps(conversation[-10:])
        }])

        memories = []
        for line in response.content.strip().split("\n"):
            if line.strip():
                memories.append(MemoryEntry(
                    content=line.strip(),
                    memory_type="episodic",
                    importance=0.6,
                ))
        return memories

    async def _extract_semantic(self, conversation: list[dict]) -> list[MemoryEntry]:
        """Extract semantic facts (knowledge to remember)."""
        response = await self.llm.chat([{
            "role": "system",
            "content": "Extract factual information mentioned in this conversation. "
            "Focus on: names, dates, project details, technical decisions, deadlines. "
            "Return one fact per line. Only include concrete, reusable facts."
        }, {
            "role": "user",
            "content": json.dumps(conversation[-10:])
        }])

        memories = []
        for line in response.content.strip().split("\n"):
            if line.strip():
                memories.append(MemoryEntry(
                    content=line.strip(),
                    memory_type="semantic",
                    importance=0.7,
                ))
        return memories

    async def _extract_preferences(self, conversation: list[dict]) -> list[MemoryEntry]:
        """Extract user preferences (how they like things done)."""
        response = await self.llm.chat([{
            "role": "system",
            "content": "Extract user preferences from this conversation. "
            "Look for: communication style preferences, formatting preferences, "
            "technical preferences, workflow preferences. "
            "Return one preference per line. Only include clear, stated preferences."
        }, {
            "role": "user",
            "content": json.dumps(conversation[-10:])
        }])

        memories = []
        for line in response.content.strip().split("\n"):
            if line.strip():
                memories.append(MemoryEntry(
                    content=line.strip(),
                    memory_type="preference",
                    importance=0.8,  # Preferences are high-importance
                ))
        return memories

    async def _embed(self, text: str):
        """Generate embedding for text."""
        return await self.vector_store.embed(text)
```

> **Deep dive**: See [AI Memory Part 19](../AI-Memory/ai-memory-deep-dive-part-19.md) for a complete production memory platform capstone.

**Why interviewer asks this:** Tests ability to build the memory infrastructure that makes agents truly useful over time.

**Follow-up:** How would you handle memory conflicts (e.g., user says "I prefer Python" in one session and "I prefer TypeScript" in another)?

---

## Debugging Scenarios

### Q7. 🟡 Debug: Agent "forgets" information from earlier in the conversation.

```python
# User: "My name is Alice and I'm working on Project Phoenix."
# Agent: "Nice to meet you, Alice! Tell me about Project Phoenix."
# ... 15 messages later ...
# User: "What project was I working on?"
# Agent: "I'm sorry, I don't have information about your current project."
```

**Answer:**

The conversation exceeded the context window, and early messages were dropped. With 15+ messages (especially with tool calls), the context can easily hit model limits.

**Root causes:**
1. No conversation memory management - just appending messages until they overflow
2. No summarization of older messages
3. Critical information (user name, project) only exists in early messages

**Fix:**

```python
class SmartConversationManager:
    def __init__(self, llm, max_tokens: int = 8000):
        self.llm = llm
        self.max_tokens = max_tokens
        self.summary = ""
        self.key_facts = {}  # Always preserved: {"user_name": "Alice", "project": "Phoenix"}
        self.messages = []

    def add_message(self, message: dict):
        self.messages.append(message)
        # Extract key facts from user messages
        self._extract_facts(message)

    def _extract_facts(self, message: dict):
        """Extract and store always-available key facts."""
        content = message.get("content", "").lower()
        # Simple pattern matching (in production, use LLM extraction)
        if "my name is" in content:
            name = content.split("my name is")[1].split(".")[0].strip()
            self.key_facts["user_name"] = name
        if "working on" in content:
            project = content.split("working on")[1].split(".")[0].strip()
            self.key_facts["current_project"] = project

    def get_context(self) -> list[dict]:
        """Build context that always includes key facts."""
        context = []

        # Always include key facts
        if self.key_facts:
            facts = "\n".join(f"- {k}: {v}" for k, v in self.key_facts.items())
            context.append({
                "role": "system",
                "content": f"Key information about this user:\n{facts}"
            })

        # Include summary of older conversation
        if self.summary:
            context.append({
                "role": "system",
                "content": f"Earlier conversation summary: {self.summary}"
            })

        # Include recent messages (within token budget)
        context.extend(self.messages[-10:])
        return context
```

**Why interviewer asks this:** Context management is the most common source of "forgetful" agents. Practical, high-frequency bug.

---

### Q8. 🔴 Debug: Memory system stores too many low-quality memories, degrading retrieval.

**Answer:**

Without quality filtering, the memory system stores everything - including greetings, filler, and irrelevant exchanges. When you search for relevant memories, noise drowns out signal.

**Fix: Add importance scoring and memory consolidation.**

```python
class MemoryQualityFilter:
    """Filter and consolidate memories to maintain high-quality retrieval."""

    async def score_importance(self, memory_text: str, conversation_context: str) -> float:
        """Score 0-1 how important this memory is to retain."""
        response = await self.llm.chat([{
            "role": "user",
            "content": f"""Rate the importance of retaining this memory (0.0 to 1.0):

Memory: "{memory_text}"
Context: "{conversation_context[:200]}"

Scoring guide:
- 0.0-0.3: Greeting, filler, generic responses
- 0.3-0.5: Moderately useful context
- 0.5-0.7: Useful fact or preference
- 0.7-0.9: Important decision, key fact, or user preference
- 0.9-1.0: Critical information (credentials, deadlines, constraints)

Reply with ONLY a number."""
        }])
        try:
            return max(0.0, min(1.0, float(response.content.strip())))
        except ValueError:
            return 0.5

    async def consolidate(self, memories: list[MemoryEntry]) -> list[MemoryEntry]:
        """Merge similar memories to reduce redundancy."""
        # Cluster similar memories
        # Keep the most comprehensive version of each cluster
        # This prevents: "User likes Python" + "User prefers Python" + "User's favorite language is Python"
        # From taking up 3 memory slots when 1 would suffice
        ...
```

---

## Output-Based Questions

### Q9. 🟡 Trace the memory operations in this agent interaction.

```python
# Session 1:
user: "I'm Sarah, a data scientist working on fraud detection at FinCorp."
agent: "Nice to meet you, Sarah! How can I help with fraud detection?"

# Memory operations after Session 1:
# Episodic: "User Sarah introduced herself as a data scientist at FinCorp working on fraud detection"
# Semantic: "Sarah is a data scientist at FinCorp", "Sarah works on fraud detection"
# Preferences: (none extracted)

# Session 2 (next day):
user: "Can you help me with the model I mentioned yesterday?"

# Memory retrieval:
# Query: "model mentioned yesterday"
# Retrieved: "Sarah works on fraud detection" (semantic)
# Retrieved: "User Sarah introduced herself... working on fraud detection" (episodic)

# Agent response (WITH memory):
agent: "Of course, Sarah! You mentioned working on a fraud detection model at FinCorp yesterday. What specific aspect would you like help with?"

# Agent response (WITHOUT memory):
agent: "I'm sorry, but I don't have information about previous conversations. Could you tell me more about the model you're referring to?"
```

**Key insight:** Memory transforms a "goldfish" assistant into a continuous relationship. The difference in user experience is dramatic.

---

## Real-World Case Studies

### Q10. 🔴 Case Study: Building a personal AI tutor with adaptive memory.

**Scenario:** Design an AI tutor that remembers what the student has learned, adapts difficulty, and tracks progress across sessions.

```python
class AdaptiveTutorMemory:
    """Memory system for a personalized AI tutor."""

    def __init__(self, llm, vector_store, student_id: str):
        self.llm = llm
        self.store = vector_store
        self.student_id = student_id

    async def build_student_context(self, topic: str) -> dict:
        """Build a complete picture of the student for this topic."""

        # What has the student learned about this topic?
        topic_history = await self.store.search(
            query=f"student learned {topic}",
            filter={"student_id": self.student_id, "type": "learning_event"},
            top_k=10,
        )

        # What are the student's strengths and weaknesses?
        assessments = await self.store.search(
            query=f"assessment {topic}",
            filter={"student_id": self.student_id, "type": "assessment"},
            top_k=5,
        )

        # Student's learning preferences
        preferences = await self.store.search(
            query="learning style preference",
            filter={"student_id": self.student_id, "type": "preference"},
            top_k=3,
        )

        # Determine appropriate difficulty level
        mastery_level = self._calculate_mastery(topic_history, assessments)

        return {
            "mastery_level": mastery_level,  # 0-1 scale
            "difficulty": self._difficulty_from_mastery(mastery_level),
            "topics_covered": [h.metadata["topic"] for h in topic_history],
            "weak_areas": self._identify_weak_areas(assessments),
            "preferred_style": preferences[0].metadata.get("style", "visual") if preferences else "balanced",
            "context_text": self._format_for_prompt(topic_history, assessments, preferences),
        }

    async def record_learning_event(self, topic: str, subtopic: str, understood: bool, difficulty: str):
        """Record that the student interacted with a concept."""
        await self.store.add(
            text=f"Student {'understood' if understood else 'struggled with'} {subtopic} in {topic} at {difficulty} difficulty",
            metadata={
                "student_id": self.student_id,
                "type": "learning_event",
                "topic": topic,
                "subtopic": subtopic,
                "understood": understood,
                "difficulty": difficulty,
                "timestamp": datetime.now().isoformat(),
            },
        )

    def _calculate_mastery(self, history, assessments) -> float:
        """Calculate mastery level based on learning history."""
        if not history and not assessments:
            return 0.0

        correct = sum(1 for h in history if h.metadata.get("understood", False))
        total = len(history) if history else 1
        return correct / total

    def _difficulty_from_mastery(self, mastery: float) -> str:
        if mastery < 0.3: return "beginner"
        if mastery < 0.6: return "intermediate"
        if mastery < 0.85: return "advanced"
        return "expert"

    def _identify_weak_areas(self, assessments) -> list[str]:
        weak = [a.metadata["subtopic"] for a in assessments
                if not a.metadata.get("understood", True)]
        return list(set(weak))

    def _format_for_prompt(self, history, assessments, preferences) -> str:
        parts = []
        if history:
            parts.append("Topics covered: " + ", ".join(set(h.metadata.get("topic", "") for h in history)))
        if assessments:
            weak = self._identify_weak_areas(assessments)
            if weak:
                parts.append(f"Areas needing review: {', '.join(weak)}")
        if preferences:
            parts.append(f"Learning style: {preferences[0].metadata.get('style', 'balanced')}")
        return "\n".join(parts)
```

**Key design decisions:**
- **Separate memory types**: Learning events, assessments, and preferences stored with different metadata
- **Mastery calculation**: Dynamic difficulty adjustment based on history
- **Weak area identification**: Targets review sessions at struggling topics
- **Learning style adaptation**: Adjusts teaching approach based on stored preferences

> **Deep dive**: See [AI Memory Part 14](../AI-Memory/ai-memory-deep-dive-part-14.md) for comprehensive personalization systems.

**Why interviewer asks this:** Personalized AI is one of the highest-value applications of memory systems. Tests end-to-end design.

**Follow-up:** How would you handle the case where a student's understanding improves and earlier "weak area" memories are no longer accurate?
