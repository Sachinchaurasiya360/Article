# Section 6: Multi-Agent Systems & Orchestration

> Coordination patterns, communication protocols, task delegation, consensus mechanisms, and frameworks for building systems of cooperating AI agents.

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What is a multi-agent system and when do you need one instead of a single agent?

**Answer:**

A multi-agent system (MAS) uses multiple specialized AI agents that collaborate, delegate, and coordinate to accomplish tasks that are too complex, too broad, or too risky for a single agent.

**Single agent vs multi-agent decision:**

| Factor | Single Agent | Multi-Agent |
|--------|-------------|-------------|
| Task scope | Narrow, well-defined | Broad, requires diverse expertise |
| Context requirements | Fits in one context window | Requires more context than one model can hold |
| Specialization | General-purpose | Each agent is a domain expert |
| Reliability | Single point of failure | Redundancy, cross-checking |
| Latency | Lower (no coordination overhead) | Higher (inter-agent communication) |
| Complexity | Simpler to build and debug | Harder to orchestrate and debug |

**When you NEED multi-agent:**
1. **Different expertise required**: A code review system needs a security agent, a performance agent, and a style agent
2. **Parallel execution**: Research task where different agents investigate different aspects simultaneously
3. **Adversarial validation**: One agent generates, another critiques (red team/blue team)
4. **Complex workflows**: Data pipeline where extraction → transformation → validation → loading are distinct skills
5. **Context isolation**: Each agent needs different system prompts and tool access

**When single agent is better:**
- Task can be completed in <10 steps
- All required knowledge fits in one context window
- Adding agents would just add coordination overhead
- Simple tool use with clear sequential steps

**Why interviewer asks this:** Tests judgment about when complexity is warranted. Over-engineering with multi-agent when a single agent suffices is a common mistake.

**Follow-up:** What is the "coordination tax" of multi-agent systems and how do you minimize it?

---

### Q2. 🟡 What are the main multi-agent coordination patterns?

**Answer:**

**Pattern 1: Hierarchical (Manager-Worker)**
```
                  ┌──────────────┐
                  │   Manager    │  (Decomposes tasks, delegates, synthesizes)
                  └──────┬───────┘
           ┌─────────────┼─────────────┐
      ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
      │Worker A │   │Worker B │   │Worker C │
      │(Search) │   │(Analyze)│   │(Write)  │
      └─────────┘   └─────────┘   └─────────┘
```
- Manager agent assigns sub-tasks to specialist workers
- Workers report back to manager who synthesizes final output
- Best for: Clear task decomposition, different skills needed

**Pattern 2: Sequential Pipeline**
```
  Input → [Agent 1: Extract] → [Agent 2: Transform] → [Agent 3: Validate] → Output
```
- Each agent processes and passes to the next
- Best for: Workflows with clear stages (like a manufacturing assembly line)

**Pattern 3: Debate / Adversarial**
```
  [Agent A: Propose] ←→ [Agent B: Critique] → [Agent C: Judge] → Final Decision
```
- Agents argue different positions, a judge resolves
- Best for: High-stakes decisions, reducing bias, exploring alternatives

**Pattern 4: Collaborative / Peer-to-Peer**
```
  [Agent A] ←→ [Agent B] ←→ [Agent C]
       ↕              ↕
  [Shared Memory / Message Bus]
```
- Agents communicate as peers, no hierarchy
- Best for: Creative tasks, brainstorming, emergent solutions

**Pattern 5: Supervisor with Routing**
```
                ┌──────────────┐
                │  Supervisor   │
                │  (Router)     │
                └──────┬───────┘
                       │ Routes based on query type
        ┌──────────────┼──────────────┐
   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
   │Billing  │    │Technical│    │Account  │
   │ Agent   │    │ Agent   │    │ Agent   │
   └─────────┘    └─────────┘    └─────────┘
```
- Supervisor classifies incoming tasks and routes to the right specialist
- Best for: Customer support, help desk, multi-domain systems

**Why interviewer asks this:** Multi-agent patterns are the architecture of modern AI systems. Tests breadth of knowledge about coordination approaches.

**Follow-up:** How do you choose between hierarchical and peer-to-peer patterns? What are the failure modes of each?

---

### Q3. 🟡 How do agents communicate? Compare message passing, shared memory, and blackboard systems.

**Answer:**

| Mechanism | How It Works | Pros | Cons |
|-----------|-------------|------|------|
| **Direct message passing** | Agents send messages directly to each other | Simple, clear sender/receiver | Tight coupling, doesn't scale |
| **Shared memory / state** | Agents read/write a shared data structure | Decoupled, any agent can access | Conflicts, race conditions, consistency |
| **Blackboard** | Central store where agents post findings; a controller decides who acts next | Flexible, extensible | Complex controller logic |
| **Event bus / pub-sub** | Agents publish events, others subscribe to relevant topics | Loosely coupled, scalable | Message ordering, debugging difficulty |

```python
# Pattern 1: Direct message passing
from dataclasses import dataclass, field
from typing import Any
from asyncio import Queue


@dataclass
class AgentMessage:
    sender: str
    receiver: str
    content: Any
    message_type: str  # "task", "result", "question", "error"


class MessagePassingAgent:
    def __init__(self, name: str):
        self.name = name
        self.inbox: Queue[AgentMessage] = Queue()
        self.peers: dict[str, "MessagePassingAgent"] = {}

    async def send(self, receiver: str, content: Any, msg_type: str = "task"):
        msg = AgentMessage(self.name, receiver, content, msg_type)
        await self.peers[receiver].inbox.put(msg)

    async def receive(self) -> AgentMessage:
        return await self.inbox.get()


# Pattern 2: Shared State
class SharedState:
    """Thread-safe shared state for multi-agent coordination."""

    def __init__(self):
        self._state: dict[str, Any] = {}
        self._lock = asyncio.Lock()
        self._history: list[dict] = []

    async def write(self, key: str, value: Any, agent_name: str):
        async with self._lock:
            self._state[key] = value
            self._history.append({
                "agent": agent_name,
                "action": "write",
                "key": key,
                "value": str(value)[:100],
                "timestamp": datetime.now().isoformat(),
            })

    async def read(self, key: str) -> Any:
        async with self._lock:
            return self._state.get(key)

    async def get_state(self) -> dict:
        async with self._lock:
            return dict(self._state)
```

**Why interviewer asks this:** Communication design determines whether a multi-agent system succeeds or becomes an unmaintainable mess.

**Follow-up:** How do you handle message ordering and consistency in a distributed multi-agent system?

---

### Q4. 🔴 What is the "agent swarm" problem and how do you manage it?

**Answer:**

The "agent swarm" problem occurs when:
1. Agents spawn more agents without limits → exponential growth
2. Multiple agents duplicate the same work unknowingly
3. Agent communication creates a cascade of messages → system thrashing
4. No single point of control can stop the swarm

**Manifestations:**

```
Manager agent: "Research topic X"
→ Spawns 5 research agents
→ Each research agent spawns 3 sub-agents for sub-topics
→ Each sub-agent makes 10 API calls
→ Total: 150+ API calls, $50+ cost, 5 minutes, mostly redundant work
```

**Solutions:**

```python
class AgentOrchestrator:
    """Central orchestrator that prevents agent swarm problems."""

    def __init__(self, max_total_agents: int = 10, max_depth: int = 2, budget_usd: float = 5.0):
        self.max_agents = max_total_agents
        self.max_depth = max_depth
        self.budget = budget_usd
        self.active_agents: dict[str, dict] = {}
        self.total_cost = 0.0
        self._lock = asyncio.Lock()

    async def spawn_agent(self, parent_id: str | None, agent_config: dict) -> str | None:
        """Request to spawn a new agent. Returns agent_id or None if denied."""
        async with self._lock:
            # Check 1: Total agent limit
            if len(self.active_agents) >= self.max_agents:
                return None  # Deny — too many agents

            # Check 2: Depth limit (prevent recursive spawning)
            depth = 0
            current = parent_id
            while current:
                depth += 1
                current = self.active_agents.get(current, {}).get("parent")
            if depth >= self.max_depth:
                return None  # Deny — too deep

            # Check 3: Budget
            if self.total_cost >= self.budget:
                return None  # Deny — budget exhausted

            # Check 4: Deduplication — is another agent already working on this?
            for agent in self.active_agents.values():
                if self._tasks_overlap(agent["task"], agent_config["task"]):
                    return agent["id"]  # Return existing agent instead of spawning new one

            agent_id = str(uuid.uuid4())[:8]
            self.active_agents[agent_id] = {
                "id": agent_id,
                "parent": parent_id,
                "task": agent_config["task"],
                "status": "running",
                "spawned_at": datetime.now(),
            }
            return agent_id

    def _tasks_overlap(self, task_a: str, task_b: str) -> bool:
        """Simple overlap detection (in production, use embeddings)."""
        words_a = set(task_a.lower().split())
        words_b = set(task_b.lower().split())
        overlap = len(words_a & words_b) / max(len(words_a | words_b), 1)
        return overlap > 0.7

    async def report_cost(self, agent_id: str, cost: float):
        async with self._lock:
            self.total_cost += cost
            if self.total_cost >= self.budget:
                await self._stop_all_agents()

    async def _stop_all_agents(self):
        """Emergency stop — halt all agents."""
        for agent_id in list(self.active_agents.keys()):
            self.active_agents[agent_id]["status"] = "stopped"
```

**Key controls:**
1. **Max agents**: Hard limit on total active agents
2. **Max depth**: Prevent recursive agent spawning
3. **Budget cap**: Stop all agents when cost threshold is reached
4. **Deduplication**: Don't spawn a new agent for work already being done
5. **Timeout**: Kill agents that run too long

**Why interviewer asks this:** The swarm problem is the multi-agent equivalent of a fork bomb. Tests operational safety awareness.

**Follow-up:** How would you implement graceful degradation when the agent budget runs out mid-task?

---

## Coding Questions

### Q5. 🟡 Build a hierarchical multi-agent system with a manager and specialist workers.

```python
import asyncio
import json
from openai import AsyncOpenAI
from dataclasses import dataclass


@dataclass
class TaskResult:
    agent_name: str
    task: str
    result: str
    success: bool
    tokens_used: int = 0


class SpecialistAgent:
    """A specialist agent that handles a specific domain."""

    def __init__(self, name: str, client: AsyncOpenAI, system_prompt: str, tools: list | None = None):
        self.name = name
        self.client = client
        self.system_prompt = system_prompt
        self.tools = tools or []

    async def execute(self, task: str) -> TaskResult:
        """Execute a task and return the result."""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",  # Cheaper model for specialist work
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": task},
                ],
                temperature=0.2,
            )
            return TaskResult(
                agent_name=self.name,
                task=task,
                result=response.choices[0].message.content,
                success=True,
                tokens_used=response.usage.total_tokens,
            )
        except Exception as e:
            return TaskResult(
                agent_name=self.name,
                task=task,
                result=f"Error: {str(e)}",
                success=False,
            )


class ManagerAgent:
    """
    Manager that decomposes tasks, delegates to specialists, and synthesizes results.
    """

    def __init__(self, client: AsyncOpenAI, specialists: dict[str, SpecialistAgent]):
        self.client = client
        self.specialists = specialists

    async def run(self, task: str) -> dict:
        # Step 1: Decompose and plan delegation
        plan = await self._plan(task)
        print(f"Manager plan: {json.dumps(plan, indent=2)}")

        # Step 2: Execute delegated tasks in parallel where possible
        results = await self._execute_plan(plan)

        # Step 3: Synthesize results
        synthesis = await self._synthesize(task, results)

        return {
            "final_answer": synthesis,
            "plan": plan,
            "agent_results": [
                {"agent": r.agent_name, "task": r.task, "success": r.success}
                for r in results
            ],
            "total_tokens": sum(r.tokens_used for r in results),
        }

    async def _plan(self, task: str) -> list[dict]:
        """Decompose task and assign to specialists."""
        specialist_descriptions = "\n".join(
            f"- {name}: {agent.system_prompt[:100]}..."
            for name, agent in self.specialists.items()
        )

        response = await self.client.chat.completions.create(
            model="gpt-4o",  # Stronger model for planning
            messages=[{
                "role": "system",
                "content": f"""You are a project manager. Break down the task and assign
sub-tasks to available specialists.

Available specialists:
{specialist_descriptions}

Return a JSON array of assignments:
[{{"specialist": "name", "task": "specific sub-task description", "depends_on": []}}]

Use "depends_on" to indicate sequential dependencies (indices of prior tasks).
Tasks without dependencies can run in parallel."""
            }, {
                "role": "user",
                "content": task
            }],
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        return result.get("assignments", result.get("tasks", []))

    async def _execute_plan(self, plan: list[dict]) -> list[TaskResult]:
        """Execute plan respecting dependencies."""
        completed: dict[int, TaskResult] = {}
        all_results = []

        # Group tasks by dependency level
        remaining = list(enumerate(plan))

        while remaining:
            # Find tasks whose dependencies are all completed
            ready = []
            still_waiting = []

            for idx, task_def in remaining:
                deps = task_def.get("depends_on", [])
                if all(d in completed for d in deps):
                    ready.append((idx, task_def))
                else:
                    still_waiting.append((idx, task_def))

            if not ready:
                # Deadlock — force execute remaining tasks
                ready = still_waiting
                still_waiting = []

            # Execute ready tasks in parallel
            async def execute_one(idx: int, task_def: dict) -> tuple[int, TaskResult]:
                specialist_name = task_def["specialist"]
                if specialist_name not in self.specialists:
                    return idx, TaskResult(specialist_name, task_def["task"],
                                          f"Unknown specialist: {specialist_name}", False)

                # Include results from dependencies in the task context
                dep_context = ""
                for dep_idx in task_def.get("depends_on", []):
                    if dep_idx in completed:
                        dep_context += f"\nPrevious result: {completed[dep_idx].result[:500]}\n"

                full_task = task_def["task"]
                if dep_context:
                    full_task += f"\n\nContext from previous steps:{dep_context}"

                result = await self.specialists[specialist_name].execute(full_task)
                return idx, result

            tasks = [execute_one(idx, td) for idx, td in ready]
            results = await asyncio.gather(*tasks)

            for idx, result in results:
                completed[idx] = result
                all_results.append(result)

            remaining = still_waiting

        return all_results

    async def _synthesize(self, original_task: str, results: list[TaskResult]) -> str:
        """Combine all specialist results into a final answer."""
        results_text = "\n\n".join(
            f"[{r.agent_name}] Task: {r.task}\nResult: {r.result}"
            for r in results if r.success
        )
        failures = [r for r in results if not r.success]

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": "Synthesize the specialist results into a comprehensive final answer."
            }, {
                "role": "user",
                "content": f"Original task: {original_task}\n\nSpecialist results:\n{results_text}"
                + (f"\n\nFailed tasks: {[r.task for r in failures]}" if failures else "")
            }],
        )
        return response.choices[0].message.content


# Usage
client = AsyncOpenAI()

specialists = {
    "researcher": SpecialistAgent(
        "researcher", client,
        "You are a research analyst. Gather facts, statistics, and evidence on given topics."
    ),
    "writer": SpecialistAgent(
        "writer", client,
        "You are a technical writer. Create clear, well-structured content from research findings."
    ),
    "reviewer": SpecialistAgent(
        "reviewer", client,
        "You are a critical reviewer. Check content for accuracy, clarity, and completeness."
    ),
    "coder": SpecialistAgent(
        "coder", client,
        "You are a Python developer. Write clean, tested code for given requirements."
    ),
}

manager = ManagerAgent(client, specialists)

result = await manager.run(
    "Create a Python script that analyzes CSV files for data quality issues. "
    "Include research on common data quality problems, clean implementation, "
    "and a review of the code."
)
```

**Why interviewer asks this:** Tests ability to design and implement multi-agent coordination. Shows understanding of parallel execution, dependencies, and synthesis.

**Follow-up:** How would you handle the case where the reviewer finds issues with the writer's output? (Feedback loop)

---

### Q6. 🔴 Implement a debate-based multi-agent system for better decision making.

```python
class DebateSystem:
    """
    Multi-agent debate: agents argue different positions,
    a judge evaluates arguments and makes a final decision.

    Used for: complex decisions, reducing bias, exploring alternatives.
    """

    def __init__(self, client: AsyncOpenAI, num_rounds: int = 3):
        self.client = client
        self.num_rounds = num_rounds

    async def debate(self, topic: str, positions: list[str] | None = None) -> dict:
        """
        Run a structured debate on a topic.

        Args:
            topic: The question or decision to debate
            positions: Optional pre-defined positions. If None, agents propose their own.
        """
        # Phase 1: Opening statements
        if not positions:
            positions = await self._generate_positions(topic)

        debaters = [
            {"position": pos, "arguments": []} for pos in positions
        ]

        # Phase 2: Debate rounds
        for round_num in range(self.num_rounds):
            print(f"\n--- Round {round_num + 1} ---")

            for i, debater in enumerate(debaters):
                # Each debater argues their position, considering opponent's arguments
                opponent_args = [
                    d["arguments"][-1] if d["arguments"] else "No arguments yet"
                    for j, d in enumerate(debaters) if j != i
                ]

                argument = await self._generate_argument(
                    topic=topic,
                    position=debater["position"],
                    round_num=round_num,
                    previous_own_args=debater["arguments"],
                    opponent_args=opponent_args,
                )
                debater["arguments"].append(argument)
                print(f"[{debater['position'][:30]}]: {argument[:100]}...")

        # Phase 3: Judgment
        verdict = await self._judge(topic, debaters)

        return {
            "topic": topic,
            "positions": positions,
            "debate_transcript": [
                {"position": d["position"], "arguments": d["arguments"]}
                for d in debaters
            ],
            "verdict": verdict,
        }

    async def _generate_positions(self, topic: str) -> list[str]:
        """Generate 2-3 distinct positions on the topic."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""For this decision/question, propose 2-3 distinct positions
that a reasonable person could hold. Each position should be clearly different.

Topic: {topic}

Return one position per line."""
            }],
        )
        return [p.strip() for p in response.choices[0].message.content.strip().split("\n") if p.strip()]

    async def _generate_argument(
        self, topic: str, position: str, round_num: int,
        previous_own_args: list[str], opponent_args: list[str]
    ) -> str:
        """Generate a debate argument."""
        round_instruction = {
            0: "Present your strongest opening argument with evidence.",
            1: "Address your opponent's arguments and strengthen your position with counter-evidence.",
            2: "Make your closing argument. Address the strongest opposition point directly.",
        }.get(round_num, "Continue arguing your position.")

        context = ""
        if previous_own_args:
            context += f"\nYour previous arguments:\n" + "\n".join(f"- {a[:200]}" for a in previous_own_args)
        if any(a != "No arguments yet" for a in opponent_args):
            context += f"\nOpponent arguments to address:\n" + "\n".join(f"- {a[:200]}" for a in opponent_args)

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": f"""You are debating the following position: {position}

{round_instruction}

Be specific, cite evidence, and address counter-arguments.
Keep your argument to 2-3 paragraphs."""
            }, {
                "role": "user",
                "content": f"Topic: {topic}{context}"
            }],
            temperature=0.7,
        )
        return response.choices[0].message.content

    async def _judge(self, topic: str, debaters: list[dict]) -> dict:
        """Impartial judge evaluates all arguments and makes a final decision."""
        transcript = ""
        for d in debaters:
            transcript += f"\n## Position: {d['position']}\n"
            for i, arg in enumerate(d["arguments"]):
                transcript += f"\nRound {i+1}: {arg}\n"

        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": """You are an impartial judge evaluating a structured debate.
Analyze all arguments on their merits: evidence quality, logical coherence,
and practical implications. You MUST reach a verdict."""
            }, {
                "role": "user",
                "content": f"""Topic: {topic}

Debate transcript:
{transcript}

Provide your judgment:
1. Summary of each position's strongest and weakest arguments
2. Your verdict (which position wins and why)
3. Confidence level (high/medium/low)
4. Key factors that influenced your decision"""
            }],
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)


# Usage
debate_system = DebateSystem(client, num_rounds=3)

result = await debate_system.debate(
    "Should we use a microservices architecture or a monolith for our new e-commerce platform?",
    positions=[
        "Microservices: independent scaling, team autonomy, technology flexibility",
        "Modular monolith: simpler operations, lower latency, faster initial development",
    ],
)

print(f"Verdict: {result['verdict']}")
```

**Why interviewer asks this:** Debate systems are used for high-quality content generation, decision support, and bias reduction. Tests creative multi-agent design.

**Follow-up:** How would you prevent both debaters from converging on the same position (which defeats the purpose)?

---

### Q7. 🔴 Build a supervisor agent that routes tasks to specialized agents using LangGraph-style state machines.

```python
from enum import Enum
from dataclasses import dataclass, field
from typing import Any


class AgentState(Enum):
    ROUTING = "routing"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class WorkflowState:
    """Immutable state that flows through the agent graph."""
    query: str
    current_agent: str = "supervisor"
    agent_state: AgentState = AgentState.ROUTING
    messages: list[dict] = field(default_factory=list)
    results: dict[str, str] = field(default_factory=dict)
    attempts: int = 0
    max_attempts: int = 3


class SupervisorRouter:
    """
    Supervisor that routes incoming queries to the right specialist agent,
    manages state transitions, and handles failures.
    """

    def __init__(self, client: AsyncOpenAI, agents: dict[str, SpecialistAgent]):
        self.client = client
        self.agents = agents

    async def run(self, query: str) -> dict:
        state = WorkflowState(query=query)

        while state.agent_state != AgentState.COMPLETE:
            if state.attempts >= state.max_attempts:
                state.agent_state = AgentState.FAILED
                break

            if state.agent_state == AgentState.ROUTING:
                state = await self._route(state)

            elif state.agent_state == AgentState.EXECUTING:
                state = await self._execute(state)

            elif state.agent_state == AgentState.REVIEWING:
                state = await self._review(state)

            elif state.agent_state == AgentState.FAILED:
                break

        return {
            "query": state.query,
            "status": state.agent_state.value,
            "results": state.results,
            "messages": state.messages,
        }

    async def _route(self, state: WorkflowState) -> WorkflowState:
        """Classify the query and route to the appropriate agent."""
        agent_descriptions = {
            name: agent.system_prompt[:100]
            for name, agent in self.agents.items()
        }

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": f"""Route the user query to the most appropriate agent.

Available agents:
{json.dumps(agent_descriptions, indent=2)}

Respond with ONLY the agent name."""
            }, {
                "role": "user",
                "content": state.query
            }],
            temperature=0,
        )

        chosen_agent = response.choices[0].message.content.strip().lower()

        if chosen_agent not in self.agents:
            # Fallback: find closest match
            for agent_name in self.agents:
                if agent_name in chosen_agent:
                    chosen_agent = agent_name
                    break
            else:
                chosen_agent = list(self.agents.keys())[0]  # Default to first agent

        state.current_agent = chosen_agent
        state.agent_state = AgentState.EXECUTING
        state.messages.append({"event": "routed", "agent": chosen_agent})
        return state

    async def _execute(self, state: WorkflowState) -> WorkflowState:
        """Execute the task using the selected agent."""
        agent = self.agents[state.current_agent]
        result = await agent.execute(state.query)

        state.results[state.current_agent] = result.result
        state.messages.append({
            "event": "executed",
            "agent": state.current_agent,
            "success": result.success,
        })

        if result.success:
            state.agent_state = AgentState.REVIEWING
        else:
            state.attempts += 1
            state.agent_state = AgentState.ROUTING  # Try a different agent

        return state

    async def _review(self, state: WorkflowState) -> WorkflowState:
        """Review the agent's output for quality."""
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"""Review this response for quality.

Original query: {state.query}
Agent response: {state.results[state.current_agent][:1000]}

Is this response: (a) GOOD — accurate and complete, or (b) NEEDS_IMPROVEMENT?
Answer with ONLY "GOOD" or "NEEDS_IMPROVEMENT"."""
            }],
            temperature=0,
        )

        verdict = response.choices[0].message.content.strip().upper()

        if "GOOD" in verdict:
            state.agent_state = AgentState.COMPLETE
        else:
            state.attempts += 1
            state.agent_state = AgentState.ROUTING  # Re-route or retry

        return state
```

**Why interviewer asks this:** State machine-based orchestration (the LangGraph pattern) is the industry standard for complex agent workflows.

**Follow-up:** How would you add conditional branching (if/else logic) based on the query content?

---

## Debugging Scenarios

### Q8. 🟡 Debug: Multi-agent system produces inconsistent results across runs.

**Root cause:** Non-deterministic routing. The supervisor routes the same query to different agents depending on temperature, and each agent produces a different style of response.

**Fix:**

```python
# Fix 1: Use temperature=0 for routing decisions
routing_response = await client.chat.completions.create(
    model="gpt-4o-mini",
    messages=routing_messages,
    temperature=0,  # Deterministic routing
)

# Fix 2: Add a deterministic fallback router
def deterministic_route(query: str, agents: dict) -> str:
    """Rule-based routing as fallback."""
    query_lower = query.lower()
    if any(kw in query_lower for kw in ["code", "python", "debug", "function"]):
        return "coder"
    if any(kw in query_lower for kw in ["write", "draft", "email", "document"]):
        return "writer"
    if any(kw in query_lower for kw in ["research", "find", "search", "data"]):
        return "researcher"
    return "general"  # Default

# Fix 3: Use the deterministic router as primary, LLM as fallback
def hybrid_route(query: str, agents: dict) -> str:
    rule_based = deterministic_route(query, agents)
    if rule_based != "general":
        return rule_based
    return await llm_route(query, agents)  # Only use LLM when rules don't match
```

---

### Q9. 🔴 Debug: Agents deadlock when they depend on each other's output.

```python
# Agent A: "I need Agent B's analysis before I can write the report."
# Agent B: "I need Agent A's outline before I can do the analysis."
# Both wait forever → deadlock
```

**Answer:**

Classic circular dependency. The plan has a cycle: A depends on B, B depends on A.

**Fix:**

```python
def detect_cycles(plan: list[dict]) -> list[list[int]]:
    """Detect circular dependencies in a task plan using DFS."""
    n = len(plan)
    visited = [0] * n  # 0=unvisited, 1=in-progress, 2=done
    cycles = []

    def dfs(node: int, path: list[int]):
        visited[node] = 1
        path.append(node)
        for dep in plan[node].get("depends_on", []):
            if visited[dep] == 1:  # Cycle detected!
                cycle_start = path.index(dep)
                cycles.append(path[cycle_start:])
            elif visited[dep] == 0:
                dfs(dep, path)
        path.pop()
        visited[node] = 2

    for i in range(n):
        if visited[i] == 0:
            dfs(i, [])

    return cycles

# In the manager's planning phase:
plan = await self._create_plan(task)
cycles = detect_cycles(plan)
if cycles:
    # Re-plan with explicit instruction to avoid circular deps
    plan = await self._create_plan(
        task + "\n\nIMPORTANT: Tasks must not have circular dependencies. "
        "Break cycles by having one task produce a partial result first."
    )
```

**Why interviewer asks this:** Deadlocks in multi-agent systems are the distributed equivalent of thread deadlocks. Tests systems thinking.

---

## Output-Based Questions

### Q10. 🟡 Trace through this supervisor routing decision.

```python
agents = {
    "billing": "Handles payment and invoice questions",
    "technical": "Handles product bugs and technical issues",
    "general": "Handles all other inquiries",
}

queries = [
    "My payment failed and the app crashed during checkout",
    "What are your business hours?",
    "I was double charged and want a refund",
]
```

**Expected routing:**

```
"My payment failed and the app crashed during checkout"
  → Ambiguous! Could be billing (payment failed) or technical (app crashed)
  → Good supervisor routes to: "technical" (the crash is likely the ROOT CAUSE of the payment failure)
  → Alternative: "billing" (if the user primarily wants their money back)
  → Key insight: This requires understanding user INTENT, not just keyword matching

"What are your business hours?"
  → "general" (straightforward FAQ, no specialized agent needed)

"I was double charged and want a refund"
  → "billing" (clear payment/billing issue)
```

**The ambiguous first query is what makes routing hard.** Simple keyword matching would split between billing and technical. A good supervisor reasons about the underlying problem.

---

## Real-World Case Studies

### Q11. 🔴 Case Study: Building a code review multi-agent system.

**Scenario:** Design a multi-agent system that reviews pull requests with the depth of a senior engineering team.

```python
class CodeReviewSystem:
    """Multi-agent code review mimicking a senior engineering team."""

    def __init__(self, client: AsyncOpenAI):
        self.client = client
        self.agents = {
            "security": SpecialistAgent("security", client,
                "You are a security engineer. Review code for: SQL injection, XSS, "
                "authentication bypasses, secrets in code, unsafe deserialization, "
                "SSRF, and other OWASP Top 10 vulnerabilities."),
            "performance": SpecialistAgent("performance", client,
                "You are a performance engineer. Review code for: N+1 queries, "
                "missing indexes, unnecessary allocations, blocking I/O, "
                "missing caching opportunities, and algorithmic complexity issues."),
            "maintainability": SpecialistAgent("maintainability", client,
                "You are a senior engineer focused on code quality. Review for: "
                "naming clarity, function length, single responsibility, DRY violations, "
                "error handling, test coverage, and documentation."),
            "architecture": SpecialistAgent("architecture", client,
                "You are a software architect. Review for: design pattern misuse, "
                "separation of concerns, API contract changes, backward compatibility, "
                "and scalability implications."),
        }

    async def review(self, diff: str, pr_description: str) -> dict:
        # Phase 1: All agents review in parallel
        review_tasks = {
            name: agent.execute(
                f"Review this code diff:\n\nPR Description: {pr_description}\n\nDiff:\n{diff}"
            )
            for name, agent in self.agents.items()
        }
        results = {}
        for name, task in review_tasks.items():
            results[name] = await task

        # Phase 2: Synthesize into a unified review
        synthesis = await self._synthesize_review(diff, results)

        # Phase 3: Assign severity to each finding
        findings = await self._classify_findings(synthesis)

        return {
            "summary": synthesis,
            "findings": findings,
            "individual_reviews": {
                name: result.result for name, result in results.items()
            },
            "verdict": "approve" if not any(f["severity"] == "critical" for f in findings) else "request_changes",
        }

    async def _synthesize_review(self, diff: str, results: dict) -> str:
        reviews = "\n\n".join(
            f"## {name.title()} Review\n{result.result}"
            for name, result in results.items()
        )
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": "Synthesize these specialist code reviews into a unified, "
                "non-redundant review. Group findings by file/line. Remove duplicates."
            }, {
                "role": "user",
                "content": f"Diff:\n{diff}\n\nReviews:\n{reviews}"
            }],
        )
        return response.choices[0].message.content

    async def _classify_findings(self, synthesis: str) -> list[dict]:
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Extract findings from this review and classify severity.

Review:
{synthesis}

Return JSON array of findings:
[{{"finding": "description", "severity": "critical|major|minor|suggestion", "file": "path", "line": N}}]"""
            }],
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content).get("findings", [])
```

**Why it's multi-agent (not single agent):**
- Each reviewer has a completely different system prompt and expertise
- Parallel execution — 4 reviews in the time of 1
- Specialized attention — security agent focuses only on security, doesn't get distracted by style issues
- Cross-validation — if two agents flag the same issue, it's likely real

**Why interviewer asks this:** Code review is a concrete, valuable multi-agent use case. Tests ability to design domain-specific multi-agent systems.

**Follow-up:** How would you add a "learning" mechanism so the review system improves based on which findings developers accept vs dismiss?
