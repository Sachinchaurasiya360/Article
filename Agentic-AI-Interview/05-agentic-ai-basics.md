# Section 5: Agentic AI Basics

> Agent architectures, reasoning loops, autonomy levels, and the foundational patterns that power AI systems that can take actions.

---

## 📚 Pre-requisite Reading

> **Agents with memory are covered in our AI Memory series. For the memory-focused perspective, refer to:**
>
> - [AI Memory Part 16: Autonomous Agents With Memory](../AI-Memory/ai-memory-deep-dive-part-16.md) — Agent architecture, working memory, episodic memory, ReAct framework, tool memory
> - [LangChain Part 1: Agents, Tools, Memory, Advanced RAG](../LangChain/langchain-deep-dive-part-1.md) — ReAct agents, LangGraph state machines, custom tools
> - [RAG Part 9: Multi-Modal & Agentic RAG](../RAG/rag-deep-dive-part-9.md) — Agents with retrieval capabilities

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What is an AI agent? How does it differ from a simple LLM API call?

**Answer:**

An AI agent is an LLM-powered system that can **perceive its environment, reason about goals, plan actions, execute those actions using tools, and iterate based on observations** — autonomously, over multiple steps.

**Simple LLM call vs Agent:**

```
Simple LLM call:
  Input → LLM → Output (one step, no actions)
  "What's the weather?" → "I don't have access to weather data."

Agent:
  Input → LLM (reason) → Action (use weather API) → Observe result →
  LLM (reason) → Action (format response) → Output
  "What's the weather?" → [calls weather API] → "It's 72°F and sunny in NYC."
```

**Key properties that make an agent:**

| Property | Simple LLM | Agent |
|----------|-----------|-------|
| **Tool use** | No external actions | Can call APIs, databases, file systems |
| **Multi-step reasoning** | Single turn | Iterative plan-execute-observe loop |
| **State management** | Stateless | Maintains conversation and task state |
| **Autonomy** | Responds to prompts | Makes decisions about what to do next |
| **Error recovery** | Fails on error | Retries, adjusts approach, asks for help |
| **Goal-directed** | Answers questions | Works toward completing objectives |

**The minimal agent loop:**

```python
def agent_loop(goal: str, tools: dict, llm, max_steps: int = 10) -> str:
    """The fundamental agent loop: Reason → Act → Observe → Repeat."""
    messages = [
        {"role": "system", "content": f"You have access to tools: {list(tools.keys())}"},
        {"role": "user", "content": goal},
    ]

    for step in range(max_steps):
        # Reason: What should I do next?
        response = llm.chat(messages)

        # Check if agent wants to use a tool
        if response.tool_calls:
            for tool_call in response.tool_calls:
                # Act: Execute the tool
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                result = tools[tool_name](**tool_args)

                # Observe: Add result to context
                messages.append({"role": "tool", "content": str(result)})
        else:
            # Agent decided it's done — return final answer
            return response.content

    return "Max steps reached without completing the task."
```

**Why interviewer asks this:** Foundational question. Tests whether you understand the conceptual leap from "chatbot" to "agent."

**Follow-up:** What is the difference between a "reactive" agent and a "proactive" agent?

---

### Q2. 🟡 Explain the ReAct pattern (Reasoning + Acting). Why is it effective?

**Answer:**

ReAct interleaves **reasoning traces** (thinking out loud) with **actions** (tool use), creating a verifiable chain of thought-action-observation that improves both accuracy and interpretability.

**ReAct pattern:**

```
Question: What is the GDP of the country where the Eiffel Tower is located?

Thought 1: I need to find which country the Eiffel Tower is in.
Action 1: search("Eiffel Tower location country")
Observation 1: The Eiffel Tower is located in Paris, France.

Thought 2: Now I need to find France's GDP.
Action 2: search("France GDP 2024")
Observation 2: France's GDP in 2024 was approximately $3.1 trillion.

Thought 3: I have all the information needed. The Eiffel Tower is in France,
            and France's GDP is approximately $3.1 trillion.
Action 3: finish("The Eiffel Tower is located in France. France's GDP is approximately $3.1 trillion.")
```

**Why ReAct is effective:**

1. **Reasoning improves action selection**: "I need to find X" → model picks the right tool
2. **Observations ground reasoning**: Real data prevents hallucination
3. **Interpretability**: Every step is visible and auditable
4. **Error recovery**: When an observation is unexpected, reasoning adjusts the plan
5. **Better than reasoning alone (CoT)**: CoT can hallucinate facts; ReAct verifies them
6. **Better than acting alone**: Blind tool use without reasoning leads to irrelevant actions

**Comparison:**

| Approach | Reasoning | Acting | Accuracy | Interpretability |
|----------|-----------|--------|----------|-----------------|
| Standard prompting | ❌ | ❌ | Low | Low |
| Chain-of-Thought (CoT) | ✅ | ❌ | Medium | Medium |
| Act-only (tool use without reasoning) | ❌ | ✅ | Medium | Low |
| **ReAct** | ✅ | ✅ | **High** | **High** |

```python
# ReAct implementation
class ReActAgent:
    REACT_PROMPT = """You are a helpful assistant with access to tools.

For each step, follow this exact format:
Thought: [your reasoning about what to do next]
Action: [tool_name(arg1, arg2)]
Observation: [result of the action — this will be filled in by the system]

When you have the final answer:
Thought: [your reasoning]
Answer: [your final answer]

Available tools:
{tool_descriptions}"""

    def __init__(self, llm, tools: dict):
        self.llm = llm
        self.tools = tools

    async def run(self, query: str, max_steps: int = 8) -> str:
        tool_desc = "\n".join(
            f"- {name}: {func.__doc__}" for name, func in self.tools.items()
        )
        prompt = self.REACT_PROMPT.format(tool_descriptions=tool_desc)

        trajectory = f"Question: {query}\n"

        for step in range(max_steps):
            # Get LLM's reasoning and action
            response = await self.llm.generate(prompt + "\n" + trajectory)

            trajectory += response

            # Check if we have a final answer
            if "Answer:" in response:
                return response.split("Answer:")[-1].strip()

            # Extract and execute action
            if "Action:" in response:
                action_line = response.split("Action:")[-1].split("\n")[0].strip()
                tool_name, args = self._parse_action(action_line)

                if tool_name in self.tools:
                    observation = await self.tools[tool_name](*args)
                else:
                    observation = f"Error: Tool '{tool_name}' not found."

                trajectory += f"\nObservation: {observation}\n"

        return "Max steps reached. Could not complete the task."

    def _parse_action(self, action_str: str) -> tuple:
        """Parse 'tool_name(arg1, arg2)' into (name, [args])."""
        name = action_str.split("(")[0].strip()
        args_str = action_str.split("(", 1)[1].rsplit(")", 1)[0]
        args = [a.strip().strip('"').strip("'") for a in args_str.split(",")] if args_str else []
        return name, args
```

> **Deep dive**: See [AI Memory Part 16](../AI-Memory/ai-memory-deep-dive-part-16.md) for ReAct with memory systems.

**Why interviewer asks this:** ReAct is the most widely used agent pattern. Tests both theoretical understanding and implementation ability.

**Follow-up:** How would you add error recovery to ReAct when a tool call fails?

---

### Q3. 🟡 What are the levels of agent autonomy, and what are the risks at each level?

**Answer:**

Agent autonomy exists on a spectrum from "human-in-the-loop" to "fully autonomous":

```
Level 0: Chat         — LLM responds to questions, no actions
Level 1: Suggested    — Agent suggests actions, human approves
Level 2: Supervised   — Agent acts, human can intervene
Level 3: Semi-auto    — Agent acts autonomously for routine tasks, escalates edge cases
Level 4: Autonomous   — Agent acts independently with predefined guardrails
Level 5: Self-directed — Agent sets its own goals and executes (research stage)
```

**Risk analysis:**

| Level | Example | Risk | Mitigation |
|-------|---------|------|------------|
| Level 1 | "Shall I send this email?" | Low — human approves everything | Slow for routine tasks |
| Level 2 | Auto-reply to simple support tickets | Medium — bad replies may go out | Confidence thresholds, sampling checks |
| Level 3 | Process refunds under $50 automatically | High — financial impact | Dollar limits, audit logs, anomaly detection |
| Level 4 | Manage cloud infrastructure scaling | Very high — outage risk | Blast radius limits, rollback capability, canary deployments |
| Level 5 | Research agent that designs experiments | Extreme — unknown unknowns | Not recommended for production |

**Implementation pattern:**

```python
from enum import IntEnum


class AutonomyLevel(IntEnum):
    SUGGEST = 1
    SUPERVISED = 2
    SEMI_AUTONOMOUS = 3
    AUTONOMOUS = 4


class AutonomyGatedAgent:
    """Agent with configurable autonomy per action type."""

    def __init__(self, autonomy_config: dict[str, AutonomyLevel]):
        """
        autonomy_config maps action types to autonomy levels:
        {
            "read_data": AutonomyLevel.AUTONOMOUS,
            "send_email": AutonomyLevel.SUGGEST,
            "delete_record": AutonomyLevel.SUPERVISED,
            "process_payment": AutonomyLevel.SEMI_AUTONOMOUS,
        }
        """
        self.config = autonomy_config

    async def execute_action(self, action_type: str, action_params: dict) -> dict:
        level = self.config.get(action_type, AutonomyLevel.SUGGEST)

        if level == AutonomyLevel.SUGGEST:
            return {
                "status": "pending_approval",
                "suggestion": f"I recommend: {action_type}({action_params})",
                "requires": "human_approval",
            }

        elif level == AutonomyLevel.SUPERVISED:
            result = await self._execute(action_type, action_params)
            await self._log_for_review(action_type, action_params, result)
            return {"status": "executed", "result": result, "review": "logged"}

        elif level == AutonomyLevel.SEMI_AUTONOMOUS:
            confidence = await self._assess_confidence(action_type, action_params)
            if confidence > 0.9:
                result = await self._execute(action_type, action_params)
                return {"status": "executed", "confidence": confidence}
            else:
                return {
                    "status": "escalated",
                    "reason": f"Confidence {confidence:.2f} below threshold",
                }

        elif level == AutonomyLevel.AUTONOMOUS:
            result = await self._execute(action_type, action_params)
            return {"status": "executed", "result": result}
```

**Why interviewer asks this:** Critical for production systems. Over-autonomous agents cause incidents; under-autonomous agents frustrate users. Tests judgment.

**Follow-up:** How would you gradually increase an agent's autonomy level as you build confidence in its behavior?

---

### Q4. 🔴 Compare the Plan-and-Execute vs ReAct agent architectures. When do you use each?

**Answer:**

| Aspect | ReAct | Plan-and-Execute |
|--------|-------|-----------------|
| **Approach** | Interleave thinking and acting step-by-step | Create a full plan first, then execute steps |
| **Planning horizon** | One step at a time (local decisions) | Full task decomposition upfront (global plan) |
| **Adaptability** | High — adjusts immediately based on observations | Lower — plan may need replanning if assumptions fail |
| **Token efficiency** | Lower — carries full trajectory in context | Higher — planner and executor can use separate contexts |
| **Best for** | Exploratory tasks, research, information gathering | Well-defined tasks with clear sub-steps |
| **Failure mode** | Can get stuck in loops | Plan may be wrong; sunk cost in bad plans |

**Plan-and-Execute implementation:**

```python
class PlanAndExecuteAgent:
    """
    Two-phase agent:
    1. Planner: Decomposes task into ordered sub-tasks
    2. Executor: Completes each sub-task using ReAct
    """

    def __init__(self, planner_llm, executor_llm, tools):
        self.planner = planner_llm
        self.executor = ReActAgent(executor_llm, tools)

    async def run(self, task: str) -> str:
        # Phase 1: Plan
        plan = await self._create_plan(task)
        print(f"Plan created with {len(plan)} steps")

        results = []
        for i, step in enumerate(plan):
            print(f"Executing step {i+1}/{len(plan)}: {step}")

            # Phase 2: Execute each step
            result = await self.executor.run(step)
            results.append({"step": step, "result": result})

            # Check if we need to replan based on unexpected results
            if await self._needs_replanning(task, plan, results):
                remaining_plan = await self._replan(task, results, plan[i+1:])
                plan = plan[:i+1] + remaining_plan
                print(f"Replanned: {len(remaining_plan)} remaining steps")

        # Synthesize final answer from all step results
        return await self._synthesize(task, results)

    async def _create_plan(self, task: str) -> list[str]:
        """Generate an ordered list of sub-tasks."""
        response = await self.planner.chat([
            {
                "role": "system",
                "content": """Break down the given task into a sequence of specific,
actionable sub-tasks. Each sub-task should be independently completable.
Return one sub-task per line, numbered. Be specific and concrete."""
            },
            {"role": "user", "content": task},
        ])

        lines = response.content.strip().split("\n")
        return [line.lstrip("0123456789.) ").strip() for line in lines if line.strip()]

    async def _needs_replanning(self, task: str, plan: list, results: list) -> bool:
        """Check if the plan needs adjustment based on execution results."""
        last_result = results[-1]["result"]

        # Simple heuristic: replan if the last step failed or returned unexpected results
        response = await self.planner.chat([{
            "role": "user",
            "content": f"""Original task: {task}
Current plan: {plan}
Last step result: {last_result}

Does the plan need to be adjusted? Answer YES or NO only."""
        }])
        return "yes" in response.content.lower()

    async def _synthesize(self, task: str, results: list) -> str:
        """Combine all step results into a final answer."""
        results_text = "\n".join(
            f"Step: {r['step']}\nResult: {r['result']}" for r in results
        )
        response = await self.planner.chat([{
            "role": "user",
            "content": f"Task: {task}\n\nCompleted steps:\n{results_text}\n\n"
            "Synthesize a final comprehensive answer."
        }])
        return response.content
```

**When to use each:**

| Use Case | Best Approach |
|----------|--------------|
| "Research topic X and summarize findings" | ReAct (exploratory, adapt as you go) |
| "Book a flight from NYC to London for next Tuesday" | Plan-and-Execute (clear steps: search → compare → book) |
| "Debug why the test suite is failing" | ReAct (need to explore, observations guide next steps) |
| "Generate a quarterly report from these 5 data sources" | Plan-and-Execute (known pipeline of data → analysis → report) |

**Why interviewer asks this:** Tests understanding of agent architecture tradeoffs. Senior engineers must choose the right pattern for the task.

**Follow-up:** How would you implement adaptive replanning that doesn't throw away all previous work?

---

### Q5. 🔴 What is the agent "infinite loop" problem and how do you prevent it?

**Answer:**

Agents can get stuck in infinite loops when:
1. A tool keeps returning the same unhelpful result and the agent keeps retrying
2. The agent oscillates between two actions ("search A" → "search B" → "search A"...)
3. Self-refinement loops where the critique always finds something to improve

**Prevention strategies:**

```python
from collections import Counter
from datetime import datetime, timedelta


class AgentSafetyGuard:
    """Prevent infinite loops and runaway agents."""

    def __init__(
        self,
        max_steps: int = 15,
        max_duration_seconds: int = 120,
        max_retries_per_tool: int = 3,
        max_cost_usd: float = 1.0,
    ):
        self.max_steps = max_steps
        self.max_duration = timedelta(seconds=max_duration_seconds)
        self.max_retries = max_retries_per_tool
        self.max_cost = max_cost_usd

        self.step_count = 0
        self.start_time = datetime.now()
        self.tool_call_history: list[tuple[str, str]] = []  # (tool_name, args_hash)
        self.accumulated_cost = 0.0

    def check(self, tool_name: str, tool_args: dict) -> tuple[bool, str]:
        """Check if the next action should be allowed."""
        self.step_count += 1

        # Check 1: Max steps
        if self.step_count > self.max_steps:
            return False, f"Max steps ({self.max_steps}) exceeded"

        # Check 2: Time limit
        if datetime.now() - self.start_time > self.max_duration:
            return False, f"Time limit ({self.max_duration.seconds}s) exceeded"

        # Check 3: Repeated tool calls (same tool + same args = loop)
        call_signature = (tool_name, str(sorted(tool_args.items())))
        repeat_count = self.tool_call_history.count(call_signature)
        if repeat_count >= self.max_retries:
            return False, f"Tool '{tool_name}' called with same args {repeat_count} times"

        self.tool_call_history.append(call_signature)

        # Check 4: Oscillation detection (A → B → A → B pattern)
        if len(self.tool_call_history) >= 4:
            last_4 = self.tool_call_history[-4:]
            if last_4[0] == last_4[2] and last_4[1] == last_4[3]:
                return False, "Oscillation detected between two actions"

        # Check 5: Cost limit
        if self.accumulated_cost > self.max_cost:
            return False, f"Cost limit (${self.max_cost}) exceeded"

        return True, "OK"

    def add_cost(self, cost: float):
        self.accumulated_cost += cost


# Integration with agent loop
class SafeAgent:
    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools

    async def run(self, task: str) -> str:
        guard = AgentSafetyGuard(max_steps=15, max_cost_usd=0.50)
        messages = [{"role": "user", "content": task}]

        while True:
            response = await self.llm.chat(messages)

            if not response.tool_calls:
                return response.content

            for tool_call in response.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                # Safety check
                allowed, reason = guard.check(tool_name, tool_args)
                if not allowed:
                    messages.append({
                        "role": "tool",
                        "content": f"STOPPED: {reason}. Please provide your best answer with available information."
                    })
                    break

                result = await self.tools[tool_name](**tool_args)
                messages.append({"role": "tool", "content": str(result)})
```

**Why interviewer asks this:** Runaway agents are the biggest operational risk. A single infinite loop can cost $100+ in API calls and take down downstream services.

**Follow-up:** How would you implement a "circuit breaker" pattern for agents that detects and stops degraded performance?

---

## Coding Questions

### Q6. 🟡 Build a complete agent with tool use from scratch (no frameworks).

```python
import json
import httpx
from openai import AsyncOpenAI
from typing import Callable, Any


class Tool:
    """Represents a tool the agent can use."""

    def __init__(self, name: str, description: str, parameters: dict, function: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.function = function

    def to_openai_schema(self) -> dict:
        """Convert to OpenAI function calling format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class Agent:
    """Production-ready agent with tools, memory, and safety."""

    def __init__(self, client: AsyncOpenAI, system_prompt: str, tools: list[Tool]):
        self.client = client
        self.system_prompt = system_prompt
        self.tools = {tool.name: tool for tool in tools}
        self.tool_schemas = [tool.to_openai_schema() for tool in tools]

    async def run(self, user_message: str, max_turns: int = 10) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_message},
        ]

        for turn in range(max_turns):
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=self.tool_schemas if self.tool_schemas else None,
            )

            choice = response.choices[0]
            message = choice.message

            # Add assistant message to history
            messages.append(message.model_dump())

            # If no tool calls, agent is done
            if not message.tool_calls:
                return message.content

            # Execute each tool call
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                if tool_name not in self.tools:
                    result = f"Error: Unknown tool '{tool_name}'"
                else:
                    try:
                        result = await self.tools[tool_name].function(**tool_args)
                    except Exception as e:
                        result = f"Error executing {tool_name}: {str(e)}"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result),
                })

        return "I've reached the maximum number of steps. Here's what I've found so far..."


# Define tools
async def get_weather(city: str) -> str:
    """Get current weather for a city."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://wttr.in/{city}?format=j1")
        data = resp.json()
        current = data["current_condition"][0]
        return f"{city}: {current['temp_C']}°C, {current['weatherDesc'][0]['value']}"


async def calculate(expression: str) -> str:
    """Evaluate a mathematical expression safely."""
    allowed_names = {"abs": abs, "round": round, "min": min, "max": max}
    try:
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return str(result)
    except Exception as e:
        return f"Calculation error: {e}"


async def search_web(query: str) -> str:
    """Search the web for information."""
    # In production, use a real search API (Tavily, Serper, etc.)
    return f"Search results for '{query}': [Simulated search results would appear here]"


# Create tools
tools = [
    Tool(
        name="get_weather",
        description="Get current weather for a city",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string", "description": "City name"}},
            "required": ["city"],
        },
        function=get_weather,
    ),
    Tool(
        name="calculate",
        description="Evaluate a mathematical expression",
        parameters={
            "type": "object",
            "properties": {"expression": {"type": "string", "description": "Math expression"}},
            "required": ["expression"],
        },
        function=calculate,
    ),
    Tool(
        name="search_web",
        description="Search the web for information",
        parameters={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Search query"}},
            "required": ["query"],
        },
        function=search_web,
    ),
]

# Create and run agent
client = AsyncOpenAI()
agent = Agent(
    client=client,
    system_prompt="You are a helpful assistant. Use tools to find information when needed.",
    tools=tools,
)

# Usage
result = await agent.run("What's the weather in Tokyo, and what is 42 * 37?")
```

**Why interviewer asks this:** Tests ability to build the core agent abstraction without depending on a framework. Shows deep understanding.

**Follow-up:** How would you add conversation memory to this agent so it remembers context across multiple calls?

---

### Q7. 🔴 Implement a research agent that can decompose complex questions.

```python
class ResearchAgent:
    """
    Agent that decomposes complex questions into sub-questions,
    researches each independently, and synthesizes a comprehensive answer.
    """

    def __init__(self, client: AsyncOpenAI, search_fn):
        self.client = client
        self.search = search_fn

    async def research(self, question: str) -> dict:
        # Step 1: Decompose into sub-questions
        sub_questions = await self._decompose(question)
        print(f"Decomposed into {len(sub_questions)} sub-questions")

        # Step 2: Research each sub-question independently
        findings = {}
        for sq in sub_questions:
            print(f"Researching: {sq}")
            findings[sq] = await self._investigate(sq)

        # Step 3: Identify gaps — are there follow-up questions?
        gaps = await self._identify_gaps(question, findings)
        for gap in gaps:
            print(f"Following up: {gap}")
            findings[gap] = await self._investigate(gap)

        # Step 4: Synthesize all findings into a comprehensive answer
        synthesis = await self._synthesize(question, findings)

        return {
            "answer": synthesis,
            "sub_questions": sub_questions,
            "gaps_identified": gaps,
            "findings": findings,
        }

    async def _decompose(self, question: str) -> list[str]:
        """Break a complex question into independent sub-questions."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Break this complex question into 3-5 independent sub-questions
that, when answered together, would provide a comprehensive answer.

Question: {question}

Return one sub-question per line. Make each sub-question specific and searchable."""
            }],
            temperature=0.3,
        )
        return [q.strip().lstrip("0123456789.) -")
                for q in response.choices[0].message.content.strip().split("\n")
                if q.strip()]

    async def _investigate(self, question: str) -> dict:
        """Research a specific sub-question using search + analysis."""
        # Search for relevant information
        search_results = await self.search(question)

        # Analyze and extract key findings
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Based on these search results, answer this question:
{question}

Search results:
{search_results}

Provide:
1. Key findings (bullet points)
2. Confidence level (high/medium/low)
3. Any notable caveats or uncertainties"""
            }],
        )

        return {
            "question": question,
            "analysis": response.choices[0].message.content,
            "sources": search_results,
        }

    async def _identify_gaps(self, original: str, findings: dict) -> list[str]:
        """Identify information gaps that need additional research."""
        findings_summary = "\n".join(
            f"Q: {q}\nA: {f['analysis'][:200]}..."
            for q, f in findings.items()
        )
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Original question: {original}

Research so far:
{findings_summary}

Are there important gaps in the research? List 0-2 follow-up questions
that would improve the answer. If research is sufficient, respond with "NONE".
"""
            }],
        )
        text = response.choices[0].message.content.strip()
        if "none" in text.lower():
            return []
        return [q.strip() for q in text.split("\n") if q.strip()]

    async def _synthesize(self, question: str, findings: dict) -> str:
        """Synthesize all findings into a comprehensive, well-structured answer."""
        all_findings = "\n\n".join(
            f"### {q}\n{f['analysis']}" for q, f in findings.items()
        )
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "system",
                "content": "Synthesize the research findings into a comprehensive, "
                "well-structured answer. Cite specific findings. Acknowledge "
                "uncertainties. Be thorough but concise."
            }, {
                "role": "user",
                "content": f"Question: {question}\n\nResearch findings:\n{all_findings}"
            }],
        )
        return response.choices[0].message.content
```

**Why interviewer asks this:** Research agents are one of the most practical agent types. Tests decomposition, parallel execution, and synthesis.

**Follow-up:** How would you add source credibility scoring to prioritize more reliable sources?

---

## Debugging Scenarios

### Q8. 🟡 Debug: Agent keeps calling the wrong tool.

```python
# Problem: User asks "What's the weather in London?"
# Agent calls search_web("weather in London") instead of get_weather("London")

tools = [
    {"name": "get_weather", "description": "Get weather"},
    {"name": "search_web", "description": "Search for anything on the web"},
]
```

**Answer:**

The tool descriptions are too vague. "Get weather" doesn't explain what it does specifically, while "Search for anything" is overly broad and becomes the default for any query.

**Fix: Improve tool descriptions:**

```python
tools = [
    {
        "name": "get_weather",
        "description": "Get the current weather conditions (temperature, humidity, "
        "wind, precipitation) for a specific city. Use this whenever the user "
        "asks about weather, temperature, or climate conditions for a location.",
    },
    {
        "name": "search_web",
        "description": "Search the internet for general information. Use this for "
        "questions about facts, news, people, events, or topics. Do NOT use "
        "this for weather — use get_weather instead.",
    },
]
```

**Rules for good tool descriptions:**
1. Explain **what the tool does** specifically
2. Explain **when to use it** (positive examples)
3. Explain **when NOT to use it** (negative examples, disambiguate from similar tools)
4. Use clear parameter descriptions

**Why interviewer asks this:** Tool selection failures are the most common agent bug. Tests practical debugging.

---

### Q9. 🔴 Debug: Agent performs well for simple tasks but fails on complex multi-step ones.

**Root cause analysis:**

1. **Context window overflow**: Complex tasks generate long trajectories. After 10+ steps, earlier context gets pushed out or attention degrades.

2. **Error propagation**: One bad tool call early in the chain poisons all subsequent reasoning.

3. **No intermediate checkpointing**: Agent can't "save progress" and resume.

**Fix: Implement scratchpad and summarization:**

```python
class LongTaskAgent:
    """Agent optimized for complex, multi-step tasks."""

    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.scratchpad = []  # Summarized progress

    async def run(self, task: str, max_steps: int = 20) -> str:
        messages = [{"role": "user", "content": task}]

        for step in range(max_steps):
            # Every 5 steps, summarize progress to prevent context overflow
            if step > 0 and step % 5 == 0:
                summary = await self._summarize_progress(task, messages)
                messages = [
                    {"role": "user", "content": task},
                    {"role": "assistant", "content": f"Progress so far:\n{summary}"},
                    {"role": "user", "content": "Continue from where you left off."},
                ]

            response = await self.llm.chat(messages)
            # ... standard agent loop

    async def _summarize_progress(self, task: str, messages: list) -> str:
        """Compress conversation history into a concise summary."""
        response = await self.llm.chat([{
            "role": "user",
            "content": f"Summarize the progress made on this task:\n"
            f"Task: {task}\n\nConversation:\n{format_messages(messages[-10:])}\n\n"
            f"Include: key findings, completed steps, remaining work."
        }])
        return response.content
```

**Why interviewer asks this:** Multi-step agent failures are common in production. Tests ability to identify and fix context management issues.

---

## Output-Based Questions

### Q10. 🟡 Trace through this agent execution and predict the output.

```python
tools = {
    "multiply": lambda a, b: a * b,
    "add": lambda a, b: a + b,
}

# Agent receives: "What is (3 + 4) * 5?"
# Predicted agent trajectory:
```

**Expected trajectory:**

```
Thought: I need to calculate (3 + 4) * 5. I should do the addition first.
Action: add(3, 4)
Observation: 7

Thought: Now I need to multiply the result by 5.
Action: multiply(7, 5)
Observation: 35

Thought: The answer is 35.
Answer: (3 + 4) × 5 = 35
```

**Key insight:** The agent correctly decomposes the expression, respects order of operations, and uses the right tools. If the agent skipped the decomposition and tried `multiply(add(3, 4), 5)`, it would fail because tools can't be nested.

---

## Real-World Case Studies

### Q11. 🔴 Case Study: Building a customer support agent that can take real actions.

**Scenario:** Build an agent for an e-commerce company that can:
- Answer questions about orders
- Process refunds (under $100)
- Update shipping addresses
- Escalate complex issues to human agents

```python
class CustomerSupportAgent:
    """Agent with real actions and appropriate guardrails."""

    def __init__(self, llm, order_db, payment_service, notification_service):
        self.llm = llm
        self.order_db = order_db
        self.payment = payment_service
        self.notify = notification_service

        self.tools = {
            "lookup_order": Tool(
                fn=self.order_db.get_order,
                autonomy=AutonomyLevel.AUTONOMOUS,
                description="Look up order details by order ID",
            ),
            "process_refund": Tool(
                fn=self._safe_refund,
                autonomy=AutonomyLevel.SEMI_AUTONOMOUS,
                description="Process a refund for an order",
                constraints={"max_amount": 100.00},
            ),
            "update_address": Tool(
                fn=self.order_db.update_shipping_address,
                autonomy=AutonomyLevel.SUPERVISED,
                description="Update the shipping address for a pending order",
            ),
            "escalate_to_human": Tool(
                fn=self._escalate,
                autonomy=AutonomyLevel.AUTONOMOUS,
                description="Transfer the conversation to a human support agent",
            ),
        }

    async def _safe_refund(self, order_id: str, amount: float, reason: str) -> str:
        """Process refund with safety checks."""
        order = await self.order_db.get_order(order_id)

        # Guardrail 1: Amount limit
        if amount > 100:
            return "Refund amount exceeds $100 limit. Escalating to human agent."

        # Guardrail 2: Order must exist and be refundable
        if not order:
            return f"Order {order_id} not found."
        if order.status not in ("delivered", "shipped"):
            return f"Order {order_id} is {order.status} and cannot be refunded."

        # Guardrail 3: One refund per order
        if order.refund_status == "refunded":
            return f"Order {order_id} has already been refunded."

        # Process refund
        result = await self.payment.refund(order_id, amount)
        await self.notify.send_email(
            order.customer_email,
            f"Refund of ${amount:.2f} processed for order {order_id}."
        )

        return f"Refund of ${amount:.2f} processed successfully. Reference: {result.reference_id}"

    async def _escalate(self, reason: str, priority: str = "normal") -> str:
        """Escalate to human with full context."""
        ticket = await self.notify.create_support_ticket(
            reason=reason,
            priority=priority,
            conversation_history=self.current_conversation,
        )
        return f"Escalated to human agent. Ticket #{ticket.id}. Expected response time: {ticket.eta}"
```

**Key design decisions:**
- **Lookup is fully autonomous** — reading data has no side effects
- **Refunds are semi-autonomous** — automated under $100, escalated over $100
- **Address updates are supervised** — logged for review (shipping is hard to undo)
- **Escalation is always available** — agent should know when to hand off

**Why interviewer asks this:** Tests ability to design agents with real-world consequences. Safety, autonomy levels, and guardrails are the hard parts.

**Follow-up:** How would you measure the agent's success rate and what metrics would you track?
