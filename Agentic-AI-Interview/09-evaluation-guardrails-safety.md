# Section 9: Evaluation, Guardrails & Safety

> LLM evaluation methodologies, prompt injection defense, content filtering, alignment, output validation, and building safe, reliable AI systems.

---

## 📚 Pre-requisite Reading

> **Evaluation in the context of RAG is covered in:**
> - [RAG Part 7: Evaluation & Debugging](../RAG/rag-deep-dive-part-7.md) - Precision@K, Recall@K, NDCG, MRR, hallucination detection
> - [LangChain Part 2: Production Deployment](../LangChain/langchain-deep-dive-part-2.md) - LangSmith evaluation, testing patterns

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 How do you evaluate LLM outputs? What metrics are used for different tasks?

**Answer:**

LLM evaluation is fundamentally harder than traditional ML evaluation because outputs are free-form text. There's no single "accuracy" metric.

**Evaluation taxonomy:**

| Task Type | Automated Metrics | Human Evaluation | LLM-as-Judge |
|-----------|------------------|-----------------|--------------|
| **Classification** | Accuracy, F1, Precision, Recall | Agreement rate | Judge classifies same examples |
| **Generation (open-ended)** | BLEU, ROUGE, BERTScore (limited value) | Helpfulness, coherence, fluency | Pairwise comparison, scoring rubric |
| **RAG** | Precision@K, Recall@K, MRR, NDCG | Answer correctness, groundedness | Faithfulness, relevance scoring |
| **Code generation** | pass@k (execution tests), HumanEval | Code review, readability | Security review, style check |
| **Summarization** | ROUGE-L, factual consistency | Completeness, conciseness | Factual accuracy scoring |
| **Agent tasks** | Task completion rate, steps taken | Quality of plan, tool usage | Trace evaluation |

**The evaluation pyramid:**

```
                   Human Evaluation
                  (gold standard, expensive)
                 ┌─────────────────────┐
                /   LLM-as-Judge        \
               / (cheaper, scalable,     \
              /   good for ranking)       \
             ┌───────────────────────────┐
            /    Automated Metrics         \
           / (fastest, cheapest, but       \
          /   limited for generation)       \
         └───────────────────────────────────┘
```

```python
# LLM-as-Judge: Most practical for production evaluation
async def evaluate_with_llm_judge(
    question: str,
    response: str,
    reference_answer: str | None = None,
    criteria: list[str] = None,
) -> dict:
    """Use GPT-4o as a judge to evaluate response quality."""

    if criteria is None:
        criteria = ["helpfulness", "accuracy", "relevance", "coherence"]

    criteria_text = "\n".join(f"- {c}: Score 1-5" for c in criteria)

    prompt = f"""Evaluate this AI response on the following criteria:
{criteria_text}

Question: {question}
Response: {response}
{"Reference answer: " + reference_answer if reference_answer else ""}

For each criterion, provide:
1. A score from 1-5
2. A brief justification

Return JSON: {{"scores": {{"criterion": {{"score": N, "justification": "..."}}}}, "overall": N}}"""

    result = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
    )

    return json.loads(result.choices[0].message.content)
```

> **Deep dive**: See [RAG Part 7](../RAG/rag-deep-dive-part-7.md) for retrieval-specific evaluation metrics.

**Why interviewer asks this:** Evaluation is the foundation of improving any AI system. Without measurement, you're flying blind.

**Follow-up:** What is the "self-enhancement bias" problem with LLM-as-Judge, and how do you mitigate it?

---

### Q2. 🟡 What is the RAGAS framework? How do you evaluate a RAG pipeline end-to-end?

**Answer:**

RAGAS (Retrieval-Augmented Generation Assessment) evaluates RAG systems on four dimensions:

| Metric | What It Measures | Range | Computed From |
|--------|-----------------|-------|---------------|
| **Faithfulness** | Is the answer grounded in the retrieved context? (No hallucination) | 0-1 | Answer + Context |
| **Answer Relevancy** | Does the answer address the question? | 0-1 | Answer + Question |
| **Context Precision** | Are the retrieved documents relevant? | 0-1 | Question + Context |
| **Context Recall** | Did we retrieve all the relevant documents? | 0-1 | Context + Ground Truth |

```python
# RAGAS evaluation implementation
class RAGEvaluator:
    def __init__(self, llm_client):
        self.client = llm_client

    async def evaluate(self, dataset: list[dict]) -> dict:
        """
        Evaluate RAG pipeline on a labeled dataset.
        Each entry: {"question", "context", "answer", "ground_truth"}
        """
        scores = {
            "faithfulness": [],
            "answer_relevancy": [],
            "context_precision": [],
            "context_recall": [],
        }

        for entry in dataset:
            scores["faithfulness"].append(
                await self._score_faithfulness(entry["answer"], entry["context"])
            )
            scores["answer_relevancy"].append(
                await self._score_answer_relevancy(entry["answer"], entry["question"])
            )
            scores["context_precision"].append(
                await self._score_context_precision(entry["question"], entry["context"])
            )
            scores["context_recall"].append(
                await self._score_context_recall(entry["context"], entry["ground_truth"])
            )

        return {k: sum(v) / len(v) for k, v in scores.items()}

    async def _score_faithfulness(self, answer: str, context: str) -> float:
        """Is every claim in the answer supported by the context?"""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Given this context and answer, identify each factual claim
in the answer and check if it's supported by the context.

Context: {context}
Answer: {answer}

Return JSON:
{{"claims": [{{"claim": "...", "supported": true/false}}], "faithfulness_score": <0-1>}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("faithfulness_score", 0.0)

    async def _score_answer_relevancy(self, answer: str, question: str) -> float:
        """Does the answer actually address the question?"""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Rate how relevant this answer is to the question (0.0-1.0).

Question: {question}
Answer: {answer}

1.0 = directly and completely answers the question
0.5 = partially relevant
0.0 = completely off-topic

Reply with ONLY a number."""
            }],
            temperature=0,
        )
        try:
            return float(response.choices[0].message.content.strip())
        except ValueError:
            return 0.5

    async def _score_context_precision(self, question: str, context: str) -> float:
        """Are the retrieved documents relevant to the question?"""
        # In practice, score each retrieved chunk individually
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Rate how relevant this retrieved context is for answering the question (0.0-1.0).

Question: {question}
Retrieved context: {context[:2000]}

1.0 = all retrieved content is directly relevant
0.0 = none of the content is relevant

Reply with ONLY a number."""
            }],
            temperature=0,
        )
        try:
            return float(response.choices[0].message.content.strip())
        except ValueError:
            return 0.5

    async def _score_context_recall(self, context: str, ground_truth: str) -> float:
        """Did we retrieve documents that contain the ground truth information?"""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Does the retrieved context contain the information needed to produce the correct answer?

Retrieved context: {context[:2000]}
Ground truth answer: {ground_truth}

Rate 0.0 to 1.0 how much of the ground truth information is present in the context.
Reply with ONLY a number."""
            }],
            temperature=0,
        )
        try:
            return float(response.choices[0].message.content.strip())
        except ValueError:
            return 0.5
```

**Why interviewer asks this:** RAG evaluation is essential for improving retrieval systems. Tests understanding of multi-dimensional quality assessment.

**Follow-up:** How do you create a labeled evaluation dataset when you don't have ground truth answers?

---

### Q3. 🟡 What are guardrails in LLM systems? What types exist?

**Answer:**

Guardrails are validation and control mechanisms that ensure LLM outputs are safe, accurate, and within policy bounds.

**Types of guardrails:**

| Type | What It Checks | When It Runs |
|------|---------------|-------------|
| **Input guardrails** | Prompt injection, toxic input, PII in input | Before LLM call |
| **Output guardrails** | Harmful content, PII leakage, hallucination | After LLM response |
| **Structural guardrails** | JSON validity, schema conformance, length limits | After LLM response |
| **Policy guardrails** | Business rules, compliance, brand voice | After LLM response |
| **Topical guardrails** | Off-topic detection, scope enforcement | Before and after |

```python
from dataclasses import dataclass
from enum import Enum


class GuardrailVerdict(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"


@dataclass
class GuardrailResult:
    name: str
    verdict: GuardrailVerdict
    reason: str = ""
    modified_content: str | None = None  # If guardrail modifies output


class GuardrailPipeline:
    """Chain of guardrails that process input/output sequentially."""

    def __init__(self):
        self.input_guardrails: list[Callable] = []
        self.output_guardrails: list[Callable] = []

    def add_input_guardrail(self, guardrail: Callable):
        self.input_guardrails.append(guardrail)

    def add_output_guardrail(self, guardrail: Callable):
        self.output_guardrails.append(guardrail)

    async def check_input(self, user_input: str) -> tuple[bool, list[GuardrailResult]]:
        """Run all input guardrails. Returns (allowed, results)."""
        results = []
        for guardrail in self.input_guardrails:
            result = await guardrail(user_input)
            results.append(result)
            if result.verdict == GuardrailVerdict.FAIL:
                return False, results
        return True, results

    async def check_output(self, output: str) -> tuple[str, list[GuardrailResult]]:
        """Run all output guardrails. May modify output. Returns (final_output, results)."""
        results = []
        current_output = output

        for guardrail in self.output_guardrails:
            result = await guardrail(current_output)
            results.append(result)

            if result.verdict == GuardrailVerdict.FAIL:
                return "I'm sorry, I can't provide that response.", results
            elif result.modified_content:
                current_output = result.modified_content

        return current_output, results


# Specific guardrail implementations

async def pii_detection_guardrail(text: str) -> GuardrailResult:
    """Detect and redact PII from LLM output."""
    import re

    patterns = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
        "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
    }

    found_pii = []
    redacted = text
    for pii_type, pattern in patterns.items():
        matches = re.findall(pattern, text)
        if matches:
            found_pii.append(f"{pii_type}: {len(matches)} found")
            redacted = re.sub(pattern, f"[REDACTED_{pii_type.upper()}]", redacted)

    if found_pii:
        return GuardrailResult(
            name="pii_detection",
            verdict=GuardrailVerdict.WARN,
            reason=f"PII detected: {', '.join(found_pii)}",
            modified_content=redacted,
        )
    return GuardrailResult(name="pii_detection", verdict=GuardrailVerdict.PASS)


async def toxicity_guardrail(text: str) -> GuardrailResult:
    """Check for toxic or harmful content."""
    # In production, use a dedicated moderation model (OpenAI Moderation API, Perspective API)
    response = await client.moderations.create(input=text)
    result = response.results[0]

    if result.flagged:
        categories = [cat for cat, flagged in result.categories.model_dump().items() if flagged]
        return GuardrailResult(
            name="toxicity",
            verdict=GuardrailVerdict.FAIL,
            reason=f"Content flagged for: {', '.join(categories)}",
        )
    return GuardrailResult(name="toxicity", verdict=GuardrailVerdict.PASS)


async def hallucination_guardrail(output: str, context: str) -> GuardrailResult:
    """Check if the output is grounded in the provided context."""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Check if this response contains claims not supported by the context.

Context: {context[:2000]}
Response: {output}

Are there any hallucinated claims (claims not supported by the context)?
Reply with JSON: {{"has_hallucination": true/false, "unsupported_claims": ["..."]}}"""
        }],
        response_format={"type": "json_object"},
        temperature=0,
    )
    result = json.loads(response.choices[0].message.content)

    if result.get("has_hallucination"):
        return GuardrailResult(
            name="hallucination_check",
            verdict=GuardrailVerdict.WARN,
            reason=f"Unsupported claims: {result.get('unsupported_claims', [])}",
        )
    return GuardrailResult(name="hallucination_check", verdict=GuardrailVerdict.PASS)


# Assembly
pipeline = GuardrailPipeline()
pipeline.add_input_guardrail(toxicity_guardrail)
pipeline.add_output_guardrail(pii_detection_guardrail)
pipeline.add_output_guardrail(toxicity_guardrail)
```

**Why interviewer asks this:** Guardrails are mandatory for production AI. Tests understanding of defense-in-depth.

**Follow-up:** What's the performance overhead of guardrails, and how do you minimize it without compromising safety?

---

### Q4. 🔴 What is Constitutional AI (CAI), and how does it differ from RLHF?

**Answer:**

Constitutional AI is an alignment approach where the model learns to self-correct by evaluating its outputs against a set of principles ("constitution"), reducing reliance on human feedback.

**RLHF vs Constitutional AI:**

| Aspect | RLHF | Constitutional AI |
|--------|------|-------------------|
| Feedback source | Human labelers rank outputs | AI evaluates against principles |
| Scale | Limited by human labeling speed | Scales with compute |
| Consistency | Varies across labelers | Consistent principle application |
| Cost | Expensive (human labor) | Cheaper (AI inference) |
| Bias | Human labeler biases | Principle-encoding biases |
| Transparency | Opaque (why did the human prefer this?) | Explicit (which principle was violated?) |

**CAI process:**

```
Step 1: Generate multiple responses to a prompt
Step 2: For each response, ask the model to critique it against principles:
   - "Does this response encourage violence?" (Principle: Avoid harm)
   - "Does this response respect privacy?" (Principle: Privacy)
   - "Is this response helpful to the user?" (Principle: Helpfulness)
Step 3: Model revises its response based on its own critique
Step 4: Use the revised responses for preference training (RLAIF)
```

```python
# Simplified CAI implementation
class ConstitutionalAI:
    CONSTITUTION = [
        "Responses should be helpful and informative.",
        "Responses should not encourage harmful, illegal, or unethical behavior.",
        "Responses should respect user privacy and not request unnecessary personal information.",
        "Responses should acknowledge uncertainty rather than fabricating information.",
        "Responses should be inclusive and avoid stereotypes or discrimination.",
    ]

    def __init__(self, llm):
        self.llm = llm

    async def generate_with_constitution(self, query: str) -> str:
        """Generate a response that adheres to constitutional principles."""

        # Step 1: Initial generation
        initial = await self.llm.generate(query)

        # Step 2: Critique against each principle
        critiques = []
        for principle in self.CONSTITUTION:
            critique = await self.llm.chat([{
                "role": "user",
                "content": f"""Does this response violate the following principle?

Principle: {principle}
Response: {initial}

If it violates the principle, explain how. If it doesn't, say "No violation."
"""
            }])
            if "no violation" not in critique.content.lower():
                critiques.append({"principle": principle, "critique": critique.content})

        # Step 3: Revise if needed
        if critiques:
            critique_text = "\n".join(
                f"Violated: {c['principle']}\nIssue: {c['critique']}" for c in critiques
            )
            revised = await self.llm.chat([{
                "role": "user",
                "content": f"""Revise this response to address all identified issues.

Original response: {initial}

Issues found:
{critique_text}

Provide a revised response that adheres to all principles while remaining helpful."""
            }])
            return revised.content

        return initial
```

**Why interviewer asks this:** Tests understanding of alignment research and practical safety mechanisms.

**Follow-up:** How do you define a "constitution" for a specific business domain (e.g., healthcare AI, financial AI)?

---

### Q5. 🔴 How do you detect and mitigate hallucination in production?

**Answer:**

Hallucination is when the model generates plausible-sounding but factually incorrect information. There are two types:

1. **Intrinsic hallucination**: Contradicts the provided source (e.g., RAG context says "founded in 2015" but model says "2018")
2. **Extrinsic hallucination**: Claims not supported by any provided source (model invents a statistic)

**Detection strategies:**

```python
class HallucinationDetector:
    """Multi-strategy hallucination detection."""

    def __init__(self, client):
        self.client = client

    async def detect(self, response: str, context: str, method: str = "all") -> dict:
        results = {}

        if method in ("all", "claim_verification"):
            results["claim_verification"] = await self._verify_claims(response, context)

        if method in ("all", "self_consistency"):
            results["self_consistency"] = await self._self_consistency_check(response, context)

        if method in ("all", "nli"):
            results["nli"] = await self._nli_check(response, context)

        return results

    async def _verify_claims(self, response: str, context: str) -> dict:
        """Extract claims and verify each against context."""
        result = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Extract every factual claim from this response and check
if each is supported by the provided context.

Response: {response}
Context: {context}

Return JSON:
{{
  "claims": [
    {{"claim": "...", "verdict": "supported|contradicted|not_mentioned", "evidence": "..."}}
  ],
  "hallucination_score": <0-1, where 0 = no hallucination>
}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )
        return json.loads(result.choices[0].message.content)

    async def _self_consistency_check(self, response: str, context: str) -> dict:
        """Generate multiple answers and check for consistency."""
        answers = []
        for _ in range(3):
            alt = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": f"Based only on this context, answer the same question:\n\n"
                    f"Context: {context}\n\nOriginal answer: [hidden]\n\n"
                    f"Provide your answer."
                }],
                temperature=0.7,
            )
            answers.append(alt.choices[0].message.content)

        # Check if all answers agree
        consistency_check = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Do these answers agree with each other?

Answer 1: {response}
Answer 2: {answers[0]}
Answer 3: {answers[1]}
Answer 4: {answers[2]}

Return JSON: {{"consistent": true/false, "disagreements": ["..."]}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )
        return json.loads(consistency_check.choices[0].message.content)

    async def _nli_check(self, response: str, context: str) -> dict:
        """Natural Language Inference: does context entail the response?"""
        result = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Classify the relationship between the context (premise)
and the response (hypothesis):

Premise (context): {context[:2000]}
Hypothesis (response): {response}

Classification:
- ENTAILMENT: The context fully supports the response
- NEUTRAL: The context neither supports nor contradicts
- CONTRADICTION: The context contradicts the response

Reply with JSON: {{"label": "...", "confidence": <0-1>, "explanation": "..."}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )
        return json.loads(result.choices[0].message.content)
```

**Mitigation strategies (prevention > detection):**
1. **Grounding**: Always provide context; instruct model to only use provided information
2. **Source attribution**: Require model to cite [Source N] for every claim
3. **Confidence calibration**: Ask model to rate its confidence; filter low-confidence claims
4. **Constrained generation**: Limit output vocabulary to terms present in context
5. **Post-generation verification**: Run detection pipeline before returning to user

**Why interviewer asks this:** Hallucination is the #1 trust issue with LLMs. Production systems must address it.

**Follow-up:** What's the difference between a model saying "I don't know" (correctly calibrated) vs hallucinating an answer?

---

## Coding Questions

### Q6. 🟡 Build an end-to-end evaluation pipeline for an LLM application.

```python
from dataclasses import dataclass, field
from datetime import datetime
import statistics


@dataclass
class EvalCase:
    question: str
    expected_answer: str
    context: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class EvalResult:
    case: EvalCase
    actual_answer: str
    scores: dict[str, float]
    latency_ms: float
    tokens_used: int
    passed: bool


class EvaluationPipeline:
    """
    Automated evaluation pipeline for LLM applications.
    Run regularly (CI/CD, nightly, post-deployment) to track quality.
    """

    def __init__(self, client, app_fn, thresholds: dict = None):
        """
        Args:
            client: LLM client for judge evaluations
            app_fn: The function to evaluate (takes question, returns answer)
            thresholds: Minimum scores for pass/fail
        """
        self.client = client
        self.app_fn = app_fn
        self.thresholds = thresholds or {
            "relevancy": 0.7,
            "accuracy": 0.7,
            "coherence": 0.8,
        }

    async def run(self, eval_set: list[EvalCase]) -> dict:
        """Run full evaluation and return summary report."""
        results = []

        for case in eval_set:
            start = datetime.now()
            actual_answer = await self.app_fn(case.question)
            latency = (datetime.now() - start).total_seconds() * 1000

            scores = await self._judge(case, actual_answer)

            passed = all(
                scores.get(metric, 0) >= threshold
                for metric, threshold in self.thresholds.items()
            )

            results.append(EvalResult(
                case=case,
                actual_answer=actual_answer,
                scores=scores,
                latency_ms=latency,
                tokens_used=0,  # Track if available
                passed=passed,
            ))

        return self._generate_report(results)

    async def _judge(self, case: EvalCase, actual_answer: str) -> dict[str, float]:
        """Score the answer on multiple dimensions."""
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""Evaluate this AI response on a scale of 0.0 to 1.0 for each criterion:

Question: {case.question}
Expected answer: {case.expected_answer}
Actual answer: {actual_answer}
{"Context provided: " + case.context[:500] if case.context else ""}

Criteria:
- relevancy: Does the answer address the question?
- accuracy: Is the answer factually correct compared to the expected answer?
- coherence: Is the answer well-structured and clear?
- completeness: Does the answer cover all aspects of the question?

Return JSON: {{"relevancy": N, "accuracy": N, "coherence": N, "completeness": N}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )
        return json.loads(response.choices[0].message.content)

    def _generate_report(self, results: list[EvalResult]) -> dict:
        """Generate evaluation summary report."""
        all_scores = {}
        for metric in self.thresholds:
            values = [r.scores.get(metric, 0) for r in results]
            all_scores[metric] = {
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "min": min(values),
                "std": statistics.stdev(values) if len(values) > 1 else 0,
            }

        pass_rate = sum(1 for r in results if r.passed) / len(results)
        avg_latency = statistics.mean(r.latency_ms for r in results)

        failures = [
            {
                "question": r.case.question[:100],
                "expected": r.case.expected_answer[:100],
                "actual": r.actual_answer[:100],
                "scores": r.scores,
            }
            for r in results if not r.passed
        ]

        return {
            "summary": {
                "total_cases": len(results),
                "pass_rate": f"{pass_rate:.1%}",
                "avg_latency_ms": round(avg_latency),
            },
            "scores": all_scores,
            "failures": failures[:10],  # Top 10 failures
            "timestamp": datetime.now().isoformat(),
        }


# Usage: Define eval set
eval_set = [
    EvalCase(
        question="What is the return policy?",
        expected_answer="Items can be returned within 30 days for a full refund.",
        context="Our return policy allows returns within 30 days of purchase for a full refund.",
    ),
    EvalCase(
        question="How do I contact support?",
        expected_answer="Email support@company.com or call 1-800-HELP.",
        context="Contact us at support@company.com or 1-800-HELP (1-800-435-7).",
    ),
]

pipeline = EvaluationPipeline(client, app_fn=my_rag_app, thresholds={"accuracy": 0.8})
report = await pipeline.run(eval_set)
print(json.dumps(report, indent=2))
```

**Why interviewer asks this:** Evaluation pipelines are what make AI systems improvable. Tests engineering discipline.

**Follow-up:** How do you prevent the evaluation dataset from becoming stale as your application evolves?

---

## Debugging Scenarios

### Q7. 🟡 Debug: LLM-as-Judge gives suspiciously high scores for all responses.

```python
# Problem: Your evaluation pipeline shows 95%+ scores across the board,
# but users are complaining about quality. The judge is too lenient.
```

**Answer:**

Common causes of lenient LLM judges:

1. **Anchoring bias**: The judge sees the expected answer and is biased toward finding the actual answer correct
2. **Position bias**: The judge tends to prefer the first or last response it sees
3. **Self-enhancement bias**: If the same model generates and judges, it rates its own outputs higher
4. **Vague rubric**: "Rate helpfulness 1-5" without specific criteria for each score level

**Fixes:**

```python
# Fix 1: Use a different model for judging than for generation
# Generate with: gpt-4o-mini
# Judge with: gpt-4o (or Claude for cross-model judging)

# Fix 2: Detailed scoring rubric
rubric = """
Score 5: Answer is factually correct, complete, directly addresses the question,
         well-structured, and would fully satisfy the user.
Score 4: Answer is mostly correct with minor omissions. User would be satisfied.
Score 3: Answer is partially correct but missing important information or
         contains minor inaccuracies. User might need follow-up.
Score 2: Answer has significant inaccuracies or is mostly irrelevant.
Score 1: Answer is wrong, harmful, or completely off-topic.
"""

# Fix 3: Pairwise comparison instead of absolute scoring
# Instead of "rate this 1-5", use "which is better: A or B?"
# This is more calibrated and resistant to score inflation

# Fix 4: Include deliberately bad examples to test calibration
calibration_cases = [
    EvalCase("What is 2+2?", expected="4", actual="The answer is 5."),  # Should score low
    EvalCase("Capital of France?", expected="Paris", actual="I don't know."),  # Should score low
]
# If the judge gives these high scores, the judge is broken

# Fix 5: Use reference-free evaluation where possible
# Don't show the expected answer to the judge - just ask "is this a good response?"
```

**Why interviewer asks this:** Evaluation reliability is critical. A bad evaluator is worse than no evaluator.

---

### Q8. 🔴 Debug: Guardrails are blocking legitimate user requests (high false positive rate).

**Answer:**

Over-aggressive guardrails that block valid queries. Examples:
- "How to kill a Python process" → blocked by keyword "kill"
- "What's the best way to break down a complex task?" → blocked by "break"
- Medical queries about diseases → blocked by health content filters

**Fixes:**

```python
# Fix 1: Context-aware filtering instead of keyword matching
async def contextual_safety_check(text: str) -> bool:
    """Use LLM to understand intent, not just keywords."""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""Is this user message harmful, dangerous, or inappropriate?
Consider the intent, not just individual words.

Message: {text}

"How to kill a process" = NOT harmful (technical question)
"How to kill a person" = HARMFUL

Reply ONLY with "SAFE" or "UNSAFE"."""
        }],
        temperature=0,
    )
    return "safe" in response.choices[0].message.content.lower()

# Fix 2: Tiered guardrail responses
class TieredGuardrail:
    async def check(self, text: str) -> str:
        # Tier 1: Block absolutely harmful content (fast regex)
        if self._contains_extreme_content(text):
            return "blocked"

        # Tier 2: LLM-based contextual check (slower but more accurate)
        is_safe = await contextual_safety_check(text)
        if not is_safe:
            return "blocked"

        # Tier 3: Log borderline cases for human review
        if self._is_borderline(text):
            await self._log_for_review(text)
            return "allowed_with_monitoring"

        return "allowed"
```

---

## Real-World Case Studies

### Q9. 🔴 Case Study: Building a safety system for a healthcare AI assistant.

**Scenario:** Build guardrails for an AI assistant that helps patients understand medical information. Must comply with healthcare regulations.

```python
class HealthcareGuardrails:
    """
    Multi-layer safety for healthcare AI:
    1. Never provide diagnosis or treatment plans
    2. Always recommend consulting a healthcare professional
    3. Handle mental health crisis appropriately
    4. Maintain patient privacy (HIPAA compliance)
    5. Cite medical sources accurately
    """

    CRISIS_KEYWORDS = [
        "suicidal", "want to die", "end my life", "self-harm",
        "kill myself", "no reason to live", "overdose",
    ]

    DIAGNOSIS_PATTERNS = [
        r"you (have|likely have|probably have|might have)",
        r"this (is|sounds like|appears to be) (a case of|symptoms of)",
        r"I (diagnose|would diagnose)",
        r"take \d+\s*mg",  # Specific dosage recommendations
    ]

    async def process(self, user_input: str, ai_response: str) -> dict:
        """Run all healthcare-specific guardrails."""
        results = []

        # Check 1: Crisis detection (highest priority)
        crisis = self._detect_crisis(user_input)
        if crisis:
            return {
                "action": "crisis_response",
                "response": self._crisis_response(),
                "escalate": True,
            }

        # Check 2: Ensure no diagnosis in output
        diagnosis_check = self._check_for_diagnosis(ai_response)
        if diagnosis_check:
            ai_response = await self._remove_diagnosis(ai_response)
            results.append(("diagnosis_removed", diagnosis_check))

        # Check 3: Ensure disclaimer is present
        if not self._has_disclaimer(ai_response):
            ai_response += "\n\n⚕️ *This information is for educational purposes only. " \
                          "Please consult a healthcare professional for medical advice.*"
            results.append(("disclaimer_added", True))

        # Check 4: PII detection
        pii_result = self._detect_health_pii(user_input)
        if pii_result:
            results.append(("pii_warning", pii_result))

        return {
            "action": "allow",
            "response": ai_response,
            "guardrail_results": results,
        }

    def _detect_crisis(self, text: str) -> bool:
        text_lower = text.lower()
        return any(kw in text_lower for kw in self.CRISIS_KEYWORDS)

    def _crisis_response(self) -> str:
        return """I'm concerned about what you've shared. Your safety matters.

**If you're in immediate danger, please call 911 or go to your nearest emergency room.**

**National Crisis Resources:**
- 988 Suicide & Crisis Lifeline: Call or text **988** (24/7)
- Crisis Text Line: Text **HOME** to **741741**

You're not alone, and help is available right now. Would you like me to help you find local mental health resources?"""

    def _check_for_diagnosis(self, text: str) -> list[str]:
        import re
        found = []
        for pattern in self.DIAGNOSIS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                found.append(pattern)
        return found

    def _has_disclaimer(self, text: str) -> bool:
        disclaimer_phrases = [
            "consult a healthcare professional",
            "not medical advice",
            "educational purposes",
            "speak with your doctor",
        ]
        text_lower = text.lower()
        return any(phrase in text_lower for phrase in disclaimer_phrases)

    def _detect_health_pii(self, text: str) -> list[str]:
        """Detect health-related PII (protected under HIPAA)."""
        import re
        findings = []
        if re.search(r'\b\d{3}-\d{2}-\d{4}\b', text):
            findings.append("SSN detected")
        if re.search(r'patient\s*(id|number|#)\s*:?\s*\w+', text, re.IGNORECASE):
            findings.append("Patient ID detected")
        if re.search(r'(medical record|MRN)\s*:?\s*\w+', text, re.IGNORECASE):
            findings.append("Medical record number detected")
        return findings
```

**Key requirements:**
- **Crisis detection takes absolute priority** - overrides all other behavior
- **Never diagnose** - even if the model is confident, it must defer to professionals
- **Always disclaim** - every response must include a healthcare disclaimer
- **HIPAA compliance** - never log, store, or expose health PII
- **Source citation** - medical claims must be traceable to reputable sources

**Why interviewer asks this:** Healthcare AI is one of the highest-stakes applications. Tests ability to design safety-critical systems.

**Follow-up:** How would you handle the case where the user insists "just tell me the diagnosis" and tries to bypass guardrails?
