# Section 11: AI Training Types — Full Fine-Tuning, LoRA, QLoRA & Quantization

> Why we train models at all, the full spectrum of training strategies (pretraining → SFT → PEFT → RLHF/DPO), the mechanics of LoRA and QLoRA, bit-level quantization, and the classic "what happens when weights collapse to zero" family of interview questions.

---

## 📚 Pre-requisite Reading

> **Quantization and a first pass at LoRA/QLoRA are introduced in Section 1. This section goes deeper and is training-strategy-focused rather than architecture-focused:**
>
> - [Section 1: AI & LLM Fundamentals](./01-ai-llm-fundamentals.md) - Q9 (quantization basics) and Q10 (LoRA/QLoRA intro) cover the foundations this section builds on
> - [Section 9: Evaluation, Guardrails & Safety](./09-evaluation-guardrails-safety.md) - evaluating a fine-tuned model before promoting it to production

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 Why do we train/fine-tune a model at all when prompting and RAG already exist?

**Answer:**

Prompting and RAG change *what the model sees at inference time*. Training changes *what's baked into the weights*. They solve different problems, and the "why train" question is really "what can't be fixed by a better prompt or better retrieval?"

**What prompting/RAG can fix:**
- Missing or stale knowledge → RAG retrieves it
- Ambiguous instructions → better system prompt
- Occasional formatting slips → few-shot examples

**What only training can fix:**

| Problem | Why prompting/RAG fails | Why training fixes it |
|---------|-------------------------|------------------------|
| Model doesn't reliably follow a rigid output schema at scale | Few-shot examples help but degrade under distribution shift | SFT bakes the format into weights - no examples needed at inference |
| Model needs domain-specific *reasoning style*, not just domain facts (e.g., legal argumentation, medical triage logic) | RAG supplies facts, not reasoning patterns | Fine-tuning shapes how the model reasons, not just what it knows |
| Every request pays for a huge system prompt / few-shot block | Fixed per-request token/latency/cost tax, forever | Behavior is learned once, inference prompt shrinks back down |
| Model needs a new "skill" not present at any competence level (e.g., a proprietary DSL, a new language, tool-call conventions) | No amount of in-context demonstration reaches production reliability | Training directly optimizes the exact failure mode |
| Latency-critical path where you can't afford large context | RAG context adds tokens = adds latency | A fine-tuned smaller model can match a larger prompted model without the context |

**The real answer interviewers want:** training is for *changing behavior durably and cheaply at inference time*; RAG/prompting is for *injecting knowledge cheaply at training time (i.e., never)*. Mature systems use both - RAG for facts that change, fine-tuning for behavior that should stay fixed.

**Why interviewer asks this:** Filters candidates who reach for fine-tuning as a first resort (expensive, slow, hard to iterate) instead of exhausting prompting/RAG first - a very common and costly real-world mistake.

**Follow-up:** Your fine-tuned model's knowledge is 6 months stale but its behavior/format is exactly right. What do you do - retrain or add RAG on top?

---

### Q2. 🟢 What are the different types of training an LLM goes through, end to end?

**Answer:**

Training is not one thing - it's a pipeline of increasingly narrow, increasingly cheap stages:

```
1. Pre-training           (self-supervised, next-token prediction)
        ↓  trillions of tokens, months, thousands of GPUs
2. Continued Pre-training  (CPT) - optional, domain adaptation
        ↓  billions of tokens, days, dozens of GPUs
3. Supervised Fine-Tuning  (SFT) - "normal" / full fine-tuning OR PEFT (LoRA/QLoRA)
        ↓  thousands-millions of examples, hours-days
4. Preference Optimization (RLHF / DPO / PPO / GRPO)
        ↓  tens of thousands of preference pairs, hours-days
5. Task-specific PEFT adapters (LoRA/QLoRA on top of the aligned model)
        ↓  hundreds-thousands of examples, minutes-hours, single GPU
```

| Stage | Objective | Data | Who does this |
|-------|-----------|------|----------------|
| **Pre-training** | Next-token prediction on raw text | Trillions of tokens (web, books, code) | Only foundation model labs (OpenAI, Anthropic, Meta, Google) |
| **Continued pre-training** | Adapt base knowledge to a domain (e.g., legal, medical, code) without losing generality | Billions of domain tokens | Large enterprises with domain corpora |
| **Full fine-tuning (SFT)** | Update *all* weights on (instruction, response) pairs | 10K-1M examples | Teams with GPU clusters and a specific, high-value use case |
| **PEFT (LoRA/QLoRA)** | Update a *small* set of extra parameters, base frozen | 100-100K examples | Most applied AI teams - this is the default today |
| **RLHF/DPO/PPO** | Align outputs to human/AI preference rankings | Tens of thousands of preference pairs | Foundation labs + teams doing deep behavioral alignment |

**"Normal" training vs PEFT, in one sentence:** normal (full) fine-tuning updates every parameter and needs the memory and compute to store gradients + optimizer states for the *entire* model; PEFT freezes the base model and trains a tiny add-on (LoRA is the dominant form), cutting trainable parameters by 100-1000×.

**Why interviewer asks this:** Tests whether you understand training as a *pipeline* with different cost/data/skill requirements at each stage, not a monolithic "we trained the model" step.

**Follow-up:** Which of these five stages would you realistically ever run at a startup with 2 GPUs?

---

### Q3. 🟢 How does training actually work, mechanically? Walk through one training step.

**Answer:**

Every training step - whether pre-training, full fine-tuning, or LoRA - is the same four-part loop:

```
1. Forward pass   → model produces predictions, compute loss vs. target
2. Backward pass  → autograd computes ∂loss/∂weight for every trainable weight
3. Optimizer step → weights are nudged in the direction that reduces loss
4. Zero gradients → clear accumulated gradients before the next batch
```

```python
import torch
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

model = ...              # e.g., AutoModelForCausalLM
optimizer = AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)
scheduler = CosineAnnealingLR(optimizer, T_max=num_steps)

for epoch in range(num_epochs):
    for batch in dataloader:
        outputs = model(input_ids=batch["input_ids"], labels=batch["labels"])
        loss = outputs.loss                      # cross-entropy over vocab, next-token prediction

        loss.backward()                          # backward pass: fills .grad on every trainable param

        torch.nn.utils.clip_grad_norm_(           # gradient clipping - prevents exploding gradients
            model.parameters(), max_norm=1.0
        )

        optimizer.step()                          # weight update: w = w - lr * update(grad, momentum, ...)
        scheduler.step()                          # anneal learning rate
        optimizer.zero_grad()                     # clear grads for next batch
```

**What each piece actually does:**

| Component | Role | What breaks if misconfigured |
|-----------|------|-------------------------------|
| **Loss (cross-entropy)** | Measures how far predicted next-token distribution is from the actual next token | Wrong label masking → model learns to predict prompt tokens, not just response tokens |
| **Backward pass (autograd)** | Chain rule computes how much each weight contributed to the error | Frozen params need `requires_grad=False` or gradients (and memory) are wasted computing them |
| **Optimizer (AdamW)** | Adaptive per-parameter learning rate + momentum + decoupled weight decay | Wrong LR → divergence (too high) or no learning (too low) |
| **LR scheduler** | Warms up then decays learning rate over training | No warmup → early large gradients from random init destabilize a pretrained model |
| **Gradient clipping** | Caps gradient norm so one bad batch can't blow up the weights | Missing clipping is the #1 cause of NaN loss mid-training |

**Why interviewer asks this:** Many candidates can name LoRA/QLoRA as buzzwords but can't explain what "training" actually does to a tensor. This question filters for real understanding vs. memorized terminology.

**Follow-up:** Why is the loss computed only on the *response* tokens and not the *prompt* tokens in instruction fine-tuning?

---

### Q4. 🟡 When should you fine-tune a model, and when should you not?

**Answer:**

A practical decision ladder - **climb it in order, only move to the next rung when the current one fails**:

```
1. Better prompt / system instructions        (minutes, $0)
2. Few-shot examples in the prompt            (minutes, $0)
3. RAG - inject retrieved knowledge           (hours, low $)
4. PEFT fine-tuning (LoRA/QLoRA)              (hours-days, low-medium $, needs labeled data)
5. Full fine-tuning                           (days, high $, needs a lot of labeled data + GPUs)
6. Continued pre-training / pretrain from scratch   (weeks-months, very high $, rare)
```

**Fine-tune when:**
- The failure is about **behavior/format/style**, not missing facts (RAG can't fix a model that "knows" the answer but won't format it correctly)
- You have **enough quality data** (hundreds for style/format via LoRA, thousands-millions for full retraining)
- The task is **stable** - it won't change weekly (if it does, you're stuck retraining constantly)
- **Latency or cost** matters more than flexibility - a fine-tuned 8B model beating a prompted 70B model is a real, common outcome
- You need the behavior to be **reliable at scale** without a fragile mega-prompt

**Don't fine-tune when:**
- The problem is **stale/missing knowledge** → use RAG instead (fine-tuning knowledge in is expensive and it still goes stale)
- You have **< 50-100 examples** → not enough signal, prompting will outperform an undertrained adapter
- The task changes **frequently** → you'll be retraining every sprint; keep it in the prompt/RAG layer
- You haven't **tried prompting first** → most "we need fine-tuning" requests are solved by a better prompt in practice

**Why interviewer asks this:** This is one of the highest-frequency real interview questions because it's also the highest-frequency real *mistake* - teams fine-tune when they should have written a better prompt, or prompt-engineer forever when they should have fine-tuned three months ago.

**Follow-up:** Your eval shows the model gets the right answer 95% of the time with a 3,000-token few-shot prompt, but only 60% zero-shot. Is that a fine-tuning candidate?

---

### Q5. 🟡 Full fine-tuning vs LoRA vs QLoRA — compare memory, quality, and when each is the "best way."

**Answer:**

All three update the model to fit new data; they differ in **how many parameters change** and **at what precision the frozen part is stored**.

| Aspect | Full Fine-Tuning | LoRA | QLoRA |
|--------|-------------------|------|-------|
| **What's trainable** | Every weight | Small injected low-rank matrices (A, B) per layer | Same as LoRA |
| **Base model precision** | FP16/BF16 (or FP32) | FP16/BF16 | 4-bit (NF4), frozen |
| **Trainable % of params** | 100% | 0.1% - 3% | 0.1% - 3% |
| **Memory (LLaMA-70B, AdamW)** | ~1,120 GB (weights + grads + 2 optimizer states, all FP32-equivalent) | ~160 GB | ~48 GB |
| **Catastrophic forgetting risk** | High - can silently damage general capability | Low - base frozen, damage is confined to the added path | Low - same reason |
| **Quality ceiling** | Highest possible (given enough data) | Very close to full FT for most tasks (~95-99%) | Slightly below LoRA (~1-3% MMLU drop typical) due to quantization noise |
| **Storage per task** | Full model copy (10s-100s of GB) per task | Tiny adapter (10-200 MB) per task | Tiny adapter (10-200 MB) per task |
| **Multi-tenant serving** | Must swap entire model per customer/task | Swap adapters on a shared frozen base | Same, plus base is 4× smaller in memory |
| **Best for** | Foundation-model labs, or when you have massive data and GPU budget and need max quality | The default choice for 90% of applied fine-tuning today | Same tasks as LoRA, but when you don't have multi-GPU hardware |

**The "best way" heuristic interviewers want to hear:**

> Start with QLoRA if hardware is the constraint (single GPU, ≤ 24-48GB). Use plain LoRA if you already have enough VRAM to hold the base model in FP16/BF16 comfortably and want to skip the small quality cost of quantization. Reserve full fine-tuning for cases where you have both a large, high-quality dataset *and* the compute budget, and the task is important enough to justify managing a full model copy per variant.

**Why interviewer asks this:** This is the single most common practical fine-tuning question in 2024-2026 interviews - it tests whether you can reason about cost/quality trade-offs, not just recite that "LoRA is efficient."

**Follow-up:** If LoRA gets you 98% of full fine-tuning quality at 1% of the parameters, why does anyone still do full fine-tuning?

---

### Q6. 🟡 Explain LoRA in depth — the math, the rank, and why the two matrices are initialized differently.

**Answer:**

**Core idea:** the *update* to a weight matrix during fine-tuning tends to have low "intrinsic rank" - you don't need a full-rank update to adapt a model to a new task, so approximate it with the product of two small matrices.

```
Frozen:    W0 ∈ R^(d_out × d_in)          -- pretrained weight, never updated
Trainable: B  ∈ R^(d_out × r)             -- initialized to ZERO
           A  ∈ R^(r × d_in)              -- initialized to random Gaussian (small std)

Forward:   h = W0·x + (α/r)·B·A·x
```

With `d_in = d_out = 4096` and `r = 16`: `W0` has 16.7M parameters, but `B` and `A` together have only `2 × 4096 × 16 ≈ 131K` parameters - **0.8% of the original**.

**Why B is zero and A is random (not the other way, and definitely not both zero):**

At initialization we need `ΔW = B·A = 0` so the fine-tuned model starts out *identical* to the pretrained model (no random perturbation to a converged network). There are three ways to achieve `BA = 0`:

| Init scheme | `BA` at step 0 | Gradient flow at step 0 | Outcome |
|-------------|----------------|--------------------------|---------|
| `A` = zero, `B` = random | 0 ✅ | `∂L/∂A = Bᵗ·∂L/∂h·xᵗ` is **nonzero** (B is random) → A starts learning immediately. `∂L/∂B = ∂L/∂h·(Ax)ᵗ = 0` (A is zero) → B is stuck for one step, then unstuck once A moves. | Works |
| `B` = zero, `A` = random (**the standard choice**) | 0 ✅ | `∂L/∂B` is nonzero (A is random) → B learns immediately. `∂L/∂A = 0` for one step, then unstuck. | Works, and is the convention from the original LoRA paper |
| **Both `A` and `B` = zero** | 0 ✅ | `∂L/∂A = Bᵗ(...)  = 0` **and** `∂L/∂B = (...)(Ax)ᵗ = 0` - **both gradients are identically zero, forever** | ❌ Training completely stalls - the adapter never learns anything, no matter how many steps you run |

That last row is a genuine interview trap: zero-initializing *both* matrices looks "safer" but is actually a dead adapter - a textbook case of "what happens when weights are stuck at zero" (see Q9).

**Rank `r` and scaling `α`:**
- **Higher `r`** → more capacity to represent the task-specific update, but more parameters, more memory, more overfitting risk on small datasets
- **`α` (alpha)** rescales the LoRA output (`α/r` factor) - by convention `α = 2r`, so doubling `r` doesn't silently double the effective update magnitude
- Typical values: `r = 8-64` for most tasks, `r = 128-256` for tasks requiring larger behavioral shifts (e.g., new language, new domain reasoning style)

**Why interviewer asks this:** LoRA is the single most deployed fine-tuning technique in production today. Interviewers use the zero-init question specifically to separate people who've *used* `peft.LoraConfig()` from people who understand *why* it works.

**Follow-up:** What happens to model quality if you set `r` far too high, e.g., `r = d_in`?

---

### Q7. 🔴 Explain QLoRA — NF4 quantization, double quantization, and paged optimizers.

**Answer:**

QLoRA = **LoRA fine-tuning on top of a 4-bit quantized frozen base model.** It doesn't change the LoRA math from Q6 - it changes how `W0` is *stored*.

**Three techniques combined:**

**1. NF4 (NormalFloat 4-bit) quantization**

Neural network weights, after training with weight decay, are approximately zero-centered and Gaussian-distributed - most weight mass sits close to zero, with a long thin tail. A *uniform* 4-bit grid wastes most of its 16 representable levels on the rarely-used tails and has too few levels near zero, where most of the actual information is. NF4 instead precomputes 16 quantization levels as the quantiles of a standard normal distribution - **denser levels near zero, sparser levels at the extremes** - matching the true weight distribution and minimizing quantization error where it matters most.

**2. Double quantization**

Standard blockwise quantization stores one FP32 scale constant per block of weights (e.g., per 64 weights) to map the 4-bit codes back to real values. Across billions of parameters, these scale constants themselves add up to real memory (~0.5 bits/parameter overhead). Double quantization quantizes *the scale constants themselves* to 8-bit (with one shared FP32 constant per larger super-block), cutting that overhead to ~0.127 bits/parameter - small, but meaningful at 70B+ scale.

**3. Paged optimizers**

Gradient checkpointing and long sequences cause momentary GPU memory *spikes* that can OOM even when average usage fits. Paged optimizers use NVIDIA unified memory to automatically page optimizer state out to CPU RAM during a spike and page it back in afterward - trading a small, rare slowdown for not crashing.

**Storage dtype vs. compute dtype - the part people get wrong:**

```
Base weights on disk/GPU:  4-bit NF4      (storage - this is what makes it small)
Base weights during matmul: dequantized on the fly to BF16/FP16  (compute - this is what makes it accurate)
LoRA adapter weights (A, B): BF16/FP16, full precision, always    (these are what actually train)
```

The base model is *never* trained - it's dequantized just-in-time for each forward pass, used at higher precision for the actual arithmetic, then discarded again. Only the small LoRA matrices accumulate gradients and get updated.

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",              # NormalFloat4, not uniform int4
    bnb_4bit_compute_dtype=torch.bfloat16,   # dequantize to bf16 for the actual matmul
    bnb_4bit_use_double_quant=True,          # quantize the quantization constants too
)

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B", quantization_config=bnb_config)
model = prepare_model_for_kbit_training(model)   # casts norms to fp32, enables grad checkpointing
model = get_peft_model(model, LoraConfig(r=64, lora_alpha=128, target_modules=["q_proj","v_proj"]))
```

**Why interviewer asks this:** QLoRA is what makes fine-tuning a 70B model on a single GPU possible. Senior candidates are expected to know *why* NF4 beats uniform INT4 (distribution-matched quantization), not just that "QLoRA uses 4-bit."

**Follow-up:** Why is the LoRA adapter kept in BF16 instead of also quantizing it to 4-bit?

---

### Q8. 🟡 What is bit-level quantization, actually? Explain scale, zero-point, and why NF4 differs from plain INT4.

**Answer:**

Quantization maps a continuous (or high-precision) range of real numbers onto a small, fixed set of integer codes.

**Symmetric quantization** (used for weights, which are roughly zero-centered):
```
scale = max(|x|) / (2^(b-1) - 1)
q     = round(x / scale)                  # q is an integer in [-(2^(b-1)-1), 2^(b-1)-1]
x̂     = q * scale                         # dequantized approximation of x
```
Zero maps to exactly zero - no offset needed, since the distribution is centered at 0.

**Asymmetric / affine quantization** (used for activations, e.g., post-ReLU values that are all ≥ 0):
```
scale      = (max(x) - min(x)) / (2^b - 1)
zero_point = round(-min(x) / scale)
q          = round(x / scale) + zero_point
x̂          = (q - zero_point) * scale
```
This uses the full integer range even when the real values aren't centered at zero.

**Granularity - per-tensor vs. per-channel vs. per-block:**

| Granularity | One scale per... | Accuracy | Overhead |
|-------------|-------------------|----------|----------|
| Per-tensor | Entire weight matrix | Lowest - one outlier ruins the whole tensor's resolution | Minimal |
| Per-channel | Each output channel/row | Better - outliers isolated to their own channel | Small |
| Per-block (e.g., every 64 values) | Small groups of weights | Best - what QLoRA/GPTQ/AWQ actually use | Moderate (many scale constants - hence *double* quantization) |

**Why NF4 isn't "just INT4":** plain INT4 places 16 codes on a *uniform* grid across `[-max, max]`. NF4 places 16 codes at the *quantiles of a standard normal distribution* - non-uniform, denser near zero. Since trained weights cluster near zero (see Q9), NF4's grid spends more of its 16 codes exactly where most of the weight mass is, instead of wasting resolution on rare large-magnitude outliers.

**Why interviewer asks this:** Distinguishes candidates who can use `bnb_4bit_quant_type="nf4"` as a config flag from candidates who understand what the flag changes mathematically - a common senior-level bar-raiser question.

**Follow-up:** What is the "outlier feature" problem in transformer activations, and why does `LLM.int8()` handle weights and activations differently?

---

### Q9. 🔴 What actually happens when weights "tend toward zero"? Cover every mechanism an interviewer might mean.

**Answer:**

This phrase can mean five *different* things depending on context - a strong answer disambiguates before diving in.

**1. Weight decay (L2 regularization) — intentional, gradual shrinkage**

AdamW's decoupled weight decay updates every weight as:
```
w_(t+1) = w_t · (1 − η·λ) − η·∇L
```
Even if the loss gradient `∇L` is exactly zero for some weight (it isn't being used by the current batch), the `(1 − η·λ)` term still shrinks it every step - a pure geometric decay toward zero. This is *by design*: it discourages the model from relying on any single weight too heavily, improving generalization. Too much decay (`λ` too high) actively deletes learned features - weights that mattered get shrunk into irrelevance and the model underfits.

**2. Vanishing gradients — an accident of depth**

Backprop multiplies local derivatives layer by layer (chain rule). If those local factors are consistently `< 1` (e.g., saturating activations, poorly scaled initialization), the gradient magnitude shrinks exponentially with depth. Early layers then receive a near-zero gradient signal and their weights barely move from initialization - they "tend toward zero" not because anything is pushing them there, but because they never get a big enough update to move away from a small-magnitude init. This is why residual connections, LayerNorm/RMSNorm, and careful initialization exist in every modern transformer.

**3. Dead units — activation-induced, not weight-induced**

With ReLU-family activations, if a neuron's pre-activation is always negative for every input it sees, its gradient is exactly zero (the ReLU derivative is 0 in that region) - the incoming weights for that neuron freeze, permanently, regardless of weight decay. The neuron is "dead": it contributes nothing and never recovers on its own.

**4. LoRA rank collapse — the adapter learns to use less than its allotted rank**

If, during training, the singular values of the learned update `ΔW = BA` shrink toward zero along certain directions, the adapter is effectively using a rank lower than the configured `r` - wasted parameter budget. This is a signal that `r` was set too high for the task's actual complexity, or that the learning rate/data isn't rich enough to fill the allotted capacity. (Recall from Q6: if *both* `A` and `B` fully collapse to zero, gradients vanish identically and the adapter is dead - the extreme end of this failure mode.)

**5. Quantization underflow — representational, not learned**

In a *uniform* low-bit grid (INT4/INT8), the scale is often set by the tensor's max absolute value. Small-magnitude weights - even ones that matter - can fall below the smallest representable step and round to exactly zero, silently deleting information. This is precisely why NF4 (Q7/Q8) allocates more quantization levels near zero: to avoid this specific failure.

**6. Intentional zero — pruning and LoRA init (the "good" kind)**

Magnitude pruning deliberately zeroes small-magnitude weights to create sparsity for compression/speedup. LoRA's `B = 0` initialization (Q6) is also a deliberate, beneficial zero - it's what makes the adapter start out as a no-op. The failure mode isn't "weights near zero" in general - it's *unintended or total* collapse to zero that kills learning capacity.

**The one-line summary an interviewer wants:** weights trend toward zero for at least three unrelated reasons (regularization, gradient starvation, quantization resolution), only one of which (weight decay) is intentional, and distinguishing them is what separates "the model isn't learning" from "the model is learning fine, but this specific weight was never meant to move."

**Why interviewer asks this:** It's a single question that tests regularization, optimization, activation functions, PEFT internals, and quantization all at once - a favorite for gauging true depth in one shot.

**Follow-up:** You add weight decay to a LoRA fine-tune and the adapter's effective rank drops sharply. Is that a bug?

---

### Q10. 🟡 What's the practical "best way" to choose between prompting, RAG, LoRA, QLoRA, and full fine-tuning?

**Answer:**

A single table, ordered by the question that actually decides it:

| Constraint | Best choice | Why |
|------------|-------------|-----|
| Knowledge changes weekly/daily | RAG | Retraining can't keep pace with knowledge churn |
| < 100 labeled examples | Prompting / few-shot | Not enough signal to fine-tune anything reliably |
| 100s-10Ks examples, single consumer GPU (≤ 24GB) | **QLoRA** | Only option that fits a 7-13B model's training footprint in that memory budget |
| 100s-10Ks examples, multi-GPU or ≥ 40-80GB available | **LoRA** | Skip the quantization quality cost since you don't need to |
| Millions of examples, dedicated GPU cluster, task is mission-critical | **Full fine-tuning** | Only approach that reaches the absolute quality ceiling |
| Need many task-specific variants served cheaply | LoRA/QLoRA adapters | Swap tiny adapters on one shared frozen base instead of hosting N full model copies |
| Need to preserve general capability while specializing | LoRA/QLoRA | Frozen base means low catastrophic forgetting risk (see Q11) |
| Building a new foundational capability nobody has (new language, wholly new domain corpus) | Continued pre-training | PEFT can't inject knowledge at that scale; this is the rare, expensive exception |

**A decision framework beats a single "best" answer** in interviews - state the constraint you'd ask about first (usually: *how much labeled data do you have, and what hardware?*), then map to a row.

**Why interviewer asks this:** Confirms you can turn the conceptual comparisons from Q4/Q5 into an actual go/no-go decision under real constraints, not just recite trade-off tables.

**Follow-up:** You have unlimited GPU budget but only 300 labeled examples. Does more compute let you skip to full fine-tuning?

---

### Q11. 🔴 Why are LoRA/QLoRA naturally resistant to catastrophic forgetting, while full fine-tuning is not?

**Answer:**

**Catastrophic forgetting**: fine-tuning on a narrow new task overwrites weights that encoded broad general capability, causing regressions on tasks the model used to handle fine.

**Full fine-tuning** updates every weight, including the ones encoding language fluency, general reasoning, and safety behavior learned during pre-training/RLHF. If your fine-tuning set is narrow (e.g., 5,000 customer support replies), gradient descent has no incentive to *preserve* unrelated capabilities - it only minimizes loss on what it sees. The result: a model great at support tickets that has measurably degraded at, say, general coding ability, because those weights moved too.

**LoRA/QLoRA freeze the entire base model** - by construction, `W0` never receives a gradient update. All the learning happens in the small additive path `BA`. This structurally limits *how much* the model's behavior can shift:

```
Full FT:  W_new = W_updated                       (every parameter can move, unbounded)
LoRA:     W_new = W0 + (α/r)·B·A                   (W0 fixed; only a low-rank slice can move)
```

Because `BA` is low-rank and small in magnitude relative to `W0`, the adapter can only nudge the model's output distribution within a constrained subspace - enough to teach a new format, tone, or narrow skill, but structurally unable to overwrite the broad representations stored in `W0`.

**This isn't free, though:**
- If the *target task itself* requires a large behavioral shift (e.g., a new language from near-zero base competence), LoRA's constrained subspace may be insufficient - you'd need a higher rank or full fine-tuning
- Forgetting can still happen *within* the adapter's own scope if you keep re-training the same adapter on new, unrelated batches without replaying earlier data (see Q21)

**Why interviewer asks this:** Tests understanding of *why* PEFT works, not just *that* it works - a distinguishing question for senior ML roles.

**Follow-up:** If you needed a full fine-tune's flexibility but also wanted forgetting resistance, what would you do? (Hint: think about what data you'd mix into the fine-tuning set.)

---

### Q12. 🟡 How do you actually choose LoRA hyperparameters — rank, alpha, target modules, dropout — in practice?

**Answer:**

| Hyperparameter | What it controls | Practical guidance |
|-----------------|-------------------|----------------------|
| **`r` (rank)** | Capacity of the adapter | Start at `r=16`. Increase to 32-64 if the task needs a bigger behavioral shift (new domain, new output structure) and you're underfitting. Rarely need > 128. |
| **`alpha`** | Scale of the adapter's contribution (`α/r` multiplier) | Convention: `alpha = 2 × r`. Raising alpha without raising `r` is like raising the learning rate for just the adapter. |
| **`target_modules`** | Which weight matrices get a LoRA adapter | Attention projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`) are the minimum. Adding MLP projections (`gate_proj`, `up_proj`, `down_proj`) increases capacity and quality for most causal LMs at modest extra cost. |
| **`lora_dropout`** | Regularization on the adapter path | `0.05-0.1` for small datasets (< 10K examples) to fight overfitting; `0` is fine for larger datasets. |
| **Learning rate** | Step size for the adapter's parameters | LoRA needs a *higher* LR than full fine-tuning - typically `1e-4` to `3e-4`, vs. `1e-5` to `5e-5` for full FT, because there are far fewer trainable parameters absorbing the same loss signal. |

**A concrete tuning loop:**
1. Baseline: `r=16, alpha=32`, attention-only modules, `lr=2e-4`
2. Underfitting (training loss plateaus high, eval doesn't improve)? → add MLP modules, or raise `r` to 32-64
3. Overfitting (train loss ↓, eval loss ↑)? → raise `lora_dropout`, reduce `r`, or add more data
4. Loss not moving at all? → check `target_modules` actually match the model's real layer names (see Q15) before touching anything else

**Why interviewer asks this:** Tests hands-on fine-tuning experience versus theoretical knowledge - hyperparameter intuition can't be faked without having actually run training jobs and watched loss curves.

**Follow-up:** You double `r` from 16 to 32 and eval quality barely changes. What does that tell you about the task?

---

## Coding Questions

### Q13. 🟢 Write code to compute and compare trainable parameter counts for full fine-tuning vs. LoRA.

```python
from dataclasses import dataclass

@dataclass
class ModelDims:
    hidden_size: int
    num_layers: int
    num_attn_projs: int = 4     # q, k, v, o
    num_mlp_projs: int = 3      # gate, up, down
    mlp_expansion: int = 4      # mlp hidden = mlp_expansion * hidden_size (approx for gate/up/down)

def full_finetune_params(dims: ModelDims) -> int:
    attn = dims.num_attn_projs * dims.hidden_size * dims.hidden_size
    mlp = dims.num_mlp_projs * dims.hidden_size * (dims.hidden_size * dims.mlp_expansion)
    return dims.num_layers * (attn + mlp)

def lora_params(dims: ModelDims, r: int, target_attn: bool = True, target_mlp: bool = False) -> int:
    per_matrix = r * dims.hidden_size * 2   # A: r x d_in, B: d_out x r  ->  2 * r * d  (d_in=d_out=hidden)
    count = 0
    if target_attn:
        count += dims.num_attn_projs * per_matrix
    if target_mlp:
        count += dims.num_mlp_projs * per_matrix
    return dims.num_layers * count

llama_8b = ModelDims(hidden_size=4096, num_layers=32)

full = full_finetune_params(llama_8b)
lora_attn_only = lora_params(llama_8b, r=16, target_attn=True, target_mlp=False)
lora_full = lora_params(llama_8b, r=16, target_attn=True, target_mlp=True)

print(f"Full fine-tune trainable params:     {full:,}")
print(f"LoRA (attn only, r=16) trainable:     {lora_attn_only:,}  ({100*lora_attn_only/full:.3f}% of full FT)")
print(f"LoRA (attn+mlp, r=16) trainable:      {lora_full:,}  ({100*lora_full/full:.3f}% of full FT)")

# Full fine-tune trainable params:     6,442,450,944
# LoRA (attn only, r=16) trainable:     16,777,216  (0.260% of full FT)
# LoRA (attn+mlp, r=16) trainable:      29,360,128  (0.456% of full FT)
```

This is a simplified attention/MLP-only parameter count (excludes embeddings and norms, which dominate a much smaller share), but it's exactly the arithmetic behind `model.print_trainable_parameters()` in the `peft` library.

---

### Q14. 🟡 Implement a LoRA linear layer from scratch, including weight merging for deployment.

```python
import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 16, alpha: int = 32, dropout: float = 0.0):
        super().__init__()
        self.base = base
        self.base.weight.requires_grad_(False)
        if self.base.bias is not None:
            self.base.bias.requires_grad_(False)

        d_out, d_in = base.weight.shape
        self.r, self.scaling = r, alpha / r

        self.lora_A = nn.Parameter(torch.randn(r, d_in) * (1 / r ** 0.5))  # random - learns from step 0
        self.lora_B = nn.Parameter(torch.zeros(d_out, r))                   # zero - ensures ΔW = 0 at init
        self.dropout = nn.Dropout(dropout)
        self.merged = False

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.merged:
            return self.base(x)
        base_out = self.base(x)
        lora_out = self.dropout(x) @ self.lora_A.T @ self.lora_B.T
        return base_out + self.scaling * lora_out

    @torch.no_grad()
    def merge(self):
        """Fold the adapter into the frozen weight for zero-overhead inference."""
        if self.merged:
            return
        delta_w = self.scaling * (self.lora_B @ self.lora_A)   # (d_out, d_in), same shape as base.weight
        self.base.weight += delta_w
        self.merged = True

    @torch.no_grad()
    def unmerge(self):
        """Undo merge() - needed if you want to swap in a different adapter afterward."""
        if not self.merged:
            return
        delta_w = self.scaling * (self.lora_B @ self.lora_A)
        self.base.weight -= delta_w
        self.merged = False


# Usage: wrap an existing attention projection
layer = nn.Linear(4096, 4096, bias=False)
lora_layer = LoRALinear(layer, r=16, alpha=32)

x = torch.randn(2, 10, 4096)
out_before_merge = lora_layer(x)

lora_layer.merge()                      # fold adapter into base.weight for deployment
out_after_merge = lora_layer(x)         # now a plain forward - same math, zero adapter overhead

assert torch.allclose(out_before_merge, out_after_merge, atol=1e-5)
```

`merge()` is exactly what `peft`'s `model.merge_and_unload()` does under the hood - it's what lets you ship a fine-tuned model with **no LoRA-related inference overhead at all**.

---

### Q15. 🔴 Write an end-to-end QLoRA SFT + DPO training pipeline.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, DPOTrainer, DPOConfig

MODEL_ID = "meta-llama/Llama-3.1-8B-Instruct"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config, device_map="auto")
model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=64, lora_alpha=128, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# --- Stage 1: SFT - teach the target format/behavior ---
sft_trainer = SFTTrainer(
    model=model,
    train_dataset=sft_dataset,   # {"text": "<prompt+response formatted>"}
    args=TrainingArguments(
        output_dir="./sft-out", per_device_train_batch_size=4, gradient_accumulation_steps=4,
        learning_rate=2e-4, num_train_epochs=3, bf16=True, gradient_checkpointing=True,
        optim="paged_adamw_8bit", max_grad_norm=0.3, warmup_ratio=0.03, lr_scheduler_type="cosine",
    ),
    max_seq_length=2048,
)
sft_trainer.train()
sft_trainer.save_model("./sft-adapter")

# --- Stage 2: DPO - sharpen preference between good and bad completions ---
# dpo_dataset rows: {"prompt": ..., "chosen": <preferred completion>, "rejected": <worse completion>}
dpo_trainer = DPOTrainer(
    model=model,
    args=DPOConfig(
        output_dir="./dpo-out", per_device_train_batch_size=2, gradient_accumulation_steps=8,
        learning_rate=5e-5, num_train_epochs=1, bf16=True, beta=0.1,   # beta: KL penalty strength vs. reference
    ),
    train_dataset=dpo_dataset,
    tokenizer=tokenizer,
)
dpo_trainer.train()

# --- Deploy: merge adapter into a full-precision copy for serving ---
merged = model.merge_and_unload()      # requires reloading base model in fp16/bf16, NOT the 4-bit version
merged.save_pretrained("./final-merged-model")
```

**Why two stages:** SFT teaches the model *what format/behavior to produce at all*; DPO then teaches it to *prefer the better of two behaviors it's already capable of producing* - this ordering (SFT before preference optimization) is why the pipeline is "pre-train → SFT → RLHF/DPO" and not the reverse.

---

### Q16. 🟡 Implement quantize/dequantize from scratch to show the actual bit-level math.

```python
import torch

def quantize_symmetric(x: torch.Tensor, bits: int = 8):
    """Symmetric quantization - what INT8/INT4 weight quantization does under the hood."""
    qmax = 2 ** (bits - 1) - 1                       # e.g., 127 for INT8, 7 for INT4
    scale = x.abs().max() / qmax
    q = torch.clamp(torch.round(x / scale), -qmax - 1, qmax).to(torch.int8)
    return q, scale

def dequantize_symmetric(q: torch.Tensor, scale: torch.Tensor):
    return q.float() * scale

def nf4_quantize_sketch(x: torch.Tensor):
    """Simplified NF4-style quantization: non-uniform, quantile-based codebook (16 levels)."""
    quantiles = torch.linspace(0.03, 0.97, steps=16)                 # 16 codes -> 4-bit
    codebook = torch.distributions.Normal(0, 1).icdf(quantiles)      # denser near 0 than the tails
    codebook = codebook / codebook.abs().max() * x.abs().max()       # rescale to this tensor's range
    idx = torch.cdist(x.flatten().unsqueeze(1), codebook.unsqueeze(1)).argmin(dim=1)
    return idx, codebook

weights = torch.tensor([-1.3, 0.6, 0.01, -0.02, 0.001, 0.9])

q8, scale8 = quantize_symmetric(weights, bits=8)
q4, scale4 = quantize_symmetric(weights, bits=4)
dq8 = dequantize_symmetric(q8, scale8)
dq4 = dequantize_symmetric(q4, scale4)

print("original :", weights.tolist())
print("INT8 dq  :", [round(v, 4) for v in dq8.tolist()])
print("INT4 dq  :", [round(v, 4) for v in dq4.tolist()])
# INT4 dq collapses -0.02, 0.01, 0.001 all to 0.0 - see Q18 for why this matters
```

At INT4 with a scale set by the tensor's max absolute value (`1.3`), the step size is `1.3/7 ≈ 0.186` - any weight smaller than half that (`~0.093`) rounds to exactly `0`. Three of the six values above get silently zeroed. This is the underflow failure mode from Q9/Q8 made concrete.

---

## Debugging Scenarios

### Q17. 🔴 QLoRA training loss becomes `NaN` after ~40 steps. Find the bug.

```python
training_args = TrainingArguments(
    output_dir="./out",
    per_device_train_batch_size=8,
    learning_rate=5e-4,
    fp16=True,                       # <-- suspect #1
    num_train_epochs=3,
)
# BitsAndBytesConfig uses bnb_4bit_compute_dtype=torch.float16 to match
```

**Diagnosis:**

1. **`fp16=True` with no loss scaling issue and a high LR (`5e-4`)**: FP16 has a much smaller dynamic range than BF16. Combined with a learning rate that's already aggressive for a QLoRA adapter, gradients can overflow FP16's representable range, producing `inf`/`NaN` that then poisons every subsequent step.
2. **No gradient clipping configured** (`max_grad_norm` defaults exist in `TrainingArguments`, but if explicitly disabled or left at a too-high value, one large-gradient batch can spike weights into a numerically unstable region).

**Fix:**

```python
training_args = TrainingArguments(
    output_dir="./out",
    per_device_train_batch_size=8,
    learning_rate=2e-4,               # more typical for QLoRA
    bf16=True,                        # bf16 has FP32's exponent range - far less prone to overflow
    max_grad_norm=0.3,                # clip gradient norm - the standard QLoRA-paper value
    num_train_epochs=3,
)
```

Also verify `bnb_4bit_compute_dtype=torch.bfloat16` matches the training precision - a mismatch between the quantization compute dtype and the training dtype is a very common silent source of instability.

**Why interviewer asks this:** NaN loss is one of the most common real-world training bugs, and diagnosing it requires understanding precision, gradient clipping, and learning rate all at once - exactly the debugging skill applied ML roles need daily.

---

### Q18. 🟡 LoRA fine-tuning runs cleanly but the loss barely moves after 500 steps. Find the bug.

```python
lora_config = LoraConfig(
    r=16, lora_alpha=32, task_type="CAUSAL_LM",
    target_modules=["query", "value"],     # <-- copied from a BERT tutorial
)
model = get_peft_model(base_model, lora_config)   # base_model is a LLaMA-family model
model.print_trainable_parameters()
# trainable params: 0 || all params: 8,113,311,744 || trainable%: 0.0000%
```

**Diagnosis:** `target_modules=["query", "value"]` matches BERT's naming convention, not LLaMA's (`q_proj`, `v_proj`, etc.). `get_peft_model` silently finds **zero** matching modules, injects **zero** adapters, and training proceeds on an empty parameter set - the loss "moves" only from floating-point noise, not learning. The `print_trainable_parameters()` output (`0.0000%`) is the tell - **always check this line before trusting a training run.**

**Fix:**

```python
# Confirm actual layer names first:
for name, _ in base_model.named_modules():
    if "proj" in name:
        print(name)   # -> model.layers.0.self_attn.q_proj, ...k_proj, ...v_proj, ...o_proj, ...

lora_config = LoraConfig(r=16, lora_alpha=32, task_type="CAUSAL_LM",
                          target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])
model = get_peft_model(base_model, lora_config)
model.print_trainable_parameters()
# trainable params: 16,777,216 || all params: 8,130,088,960 || trainable%: 0.2064%
```

A second, unrelated cause of "loss barely moves" even with correct `target_modules`: reusing a **full-fine-tuning learning rate** (e.g., `2e-5`) for LoRA. With 100-1000× fewer trainable parameters, that LR is often too small to produce a visible signal within a normal training budget - LoRA typically needs `1e-4` to `3e-4`.

**Why interviewer asks this:** This exact bug (wrong `target_modules` for the architecture) is one of the most commonly hit real-world PEFT mistakes, especially when copying configs between model families.

---

### Q19. 🟡 A merged LoRA model produces garbage/gibberish output in production. Find the bug.

```python
# Training used QLoRA (4-bit base)
base = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config)
model = get_peft_model(base, lora_config)
# ... training happens, adapter saved to ./adapter ...

# Deployment script:
from peft import PeftModel
base_for_merge = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config)  # <-- bug
merged = PeftModel.from_pretrained(base_for_merge, "./adapter")
merged = merged.merge_and_unload()
merged.save_pretrained("./prod-model")
```

**Diagnosis:** `merge_and_unload()` computes `W_new = W0 + scaling·BA` and writes the result into the base weight tensor. But `base_for_merge` is still **loaded in 4-bit NF4**. You cannot arithmetically add a full-precision `BA` update into a 4-bit quantized tensor and get a meaningful result - the merge either errors or silently produces numerically corrupted weights, which is exactly what "garbage output" looks like.

**Fix:** Reload the base model at full precision (FP16/BF16, no `quantization_config`) specifically for the merge step - the 4-bit version was only ever needed *during training* to save memory, not for the final merge:

```python
base_fp16 = AutoModelForCausalLM.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)  # no quantization
merged = PeftModel.from_pretrained(base_fp16, "./adapter")
merged = merged.merge_and_unload()
merged.save_pretrained("./prod-model")   # now safe to quantize again for serving, if desired, AFTER merging
```

If you need a quantized model for serving too, quantize *after* merging (e.g., GPTQ/AWQ/GGUF on the merged FP16 model), not by reusing the training-time 4-bit weights.

**Why interviewer asks this:** This is a real, frequently-hit production incident - it tests whether a candidate understands that QLoRA's 4-bit base is a *training-time* memory optimization, not something that carries through to merging/deployment unchanged.

---

## Output-Based Questions

### Q20. 🟢 Predict the trainable parameter count for this LoRA config.

```python
from peft import LoraConfig

config = LoraConfig(
    r=8, lora_alpha=16,
    target_modules=["q_proj", "v_proj"],
)
# Model: 32 transformer layers, hidden_size = 4096, q_proj and v_proj are both 4096x4096
```

**Answer:**

Each targeted matrix gets `A ∈ R^(8×4096)` and `B ∈ R^(4096×8)`: `8×4096 + 4096×8 = 65,536` params per matrix.

```
2 target modules × 32 layers × 65,536 = 4,194,304 trainable parameters
```

On a 7B-parameter model, that's `4,194,304 / 7,000,000,000 ≈ 0.06%` trainable - illustrating just how little of the model actually needs to move to adapt its behavior.

---

### Q21. 🟡 Predict what happens to an unused weight under pure weight decay (zero gradient) over 100 steps.

```python
w = 1.0
lr = 0.01
weight_decay = 0.1
grad = 0.0   # this weight isn't receiving any loss signal this run

for step in range(100):
    w = w * (1 - lr * weight_decay) - lr * grad
```

**Answer:** With `grad = 0`, the update reduces to pure geometric decay: `w_(t+1) = w_t · (1 − lr·weight_decay) = w_t · 0.999`.

```
w_100 = 1.0 × 0.999^100 ≈ 1.0 × 0.9048 ≈ 0.905
```

After 100 steps the weight has shrunk to ~90.5% of its original value **purely from decay, with zero actual learning signal**. Extrapolate this to 10,000 steps: `0.999^10000 ≈ 0.0000454` - the weight is effectively zero. This is exactly the "weight decay quietly zeroes out unused capacity" mechanism from Q9 #1, made numeric - and it's why a weight that looks "dead" in a trained checkpoint isn't necessarily a bug; it may simply have never received gradient signal while decay ran the whole time.

---

## Real-World Case Studies

### Q22. 🔴 Case Study: Fine-tune a 7B model on a single 24GB consumer GPU (RTX 4090).

**Scenario:** You need to fine-tune a 7B instruction model on 8,000 domain-specific examples. Your only hardware is one RTX 4090 (24GB VRAM). Decide the approach and give concrete hyperparameters.

**Memory reality check:**

```
Full fine-tuning (AdamW, fp32-equivalent states):
  weights (2B) + grads (2B) + 2× optimizer state (4B×2) ≈ 4 bytes/param × 4 ≈ 16 bytes/param
  7B params × 16 bytes ≈ 112 GB   →  impossible on 24GB, not even close

LoRA (bf16 base, base frozen so no optimizer state for it):
  base weights: 7B × 2 bytes ≈ 14 GB
  + LoRA params (r=64, attn+mlp, ~1% of 7B ≈ 70M) × (2 bytes weight + 2 bytes grad + 8 bytes AdamW state) ≈ ~0.8 GB
  + activations (batch=1-2, seq=2048, with grad checkpointing) ≈ 4-8 GB
  Total: ~19-23 GB   →  tight, might not leave room for a useful batch size

QLoRA (4-bit NF4 base):
  base weights: 7B × 0.5 bytes ≈ 3.5 GB
  + LoRA params: same ~0.8 GB as above
  + activations (grad checkpointing): 4-8 GB
  Total: ~8-12 GB   →  comfortable, room for larger batch/sequence length
```

**Decision: QLoRA.** It's the only approach with real headroom on 24GB, leaving room to increase batch size or sequence length rather than running at the absolute edge of OOM.

**Concrete config:**

```python
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                  bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)

lora_config = LoraConfig(r=32, lora_alpha=64, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
                          target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"])

training_args = TrainingArguments(
    per_device_train_batch_size=4, gradient_accumulation_steps=4,   # effective batch = 16
    learning_rate=2e-4, num_train_epochs=3, bf16=True,
    gradient_checkpointing=True, optim="paged_adamw_8bit",           # paged optimizer for VRAM spikes
    max_grad_norm=0.3, warmup_ratio=0.03, lr_scheduler_type="cosine",
)
```

`r=32` (not 8-16) because 8,000 examples is enough data to fill more adapter capacity without overfitting; `paged_adamw_8bit` specifically to absorb the memory spikes from gradient checkpointing on a card with no memory to spare.

**Why interviewer asks this:** Tests whether hardware-constrained fine-tuning decisions are backed by actual memory arithmetic, not just "use QLoRA because it's efficient."

---

### Q23. 🔴 Case Study: Fine-tune a small model for reliable tool-calling in an agentic pipeline.

**Scenario:** Your agent uses an 8B open model to decide which tool to call and with what arguments. It's unreliable - malformed JSON, wrong tool selection, hallucinated parameters. You need this fixed without going to a larger, slower model. (This is where training connects directly back to the rest of this guide - [Section 7: Tool Use & Function Calling](./07-tool-use-function-calling.md).)

**Approach - two-stage training, matching the pipeline from Q2/Q15:**

**Stage 1: SFT on collected trajectories**
- Run your *current* agent (or a stronger teacher model) against real/synthetic tasks, logging full ReAct-style traces: `thought → tool_call(JSON) → observation → ...`
- Filter to only trajectories that ended in task success and had syntactically valid tool calls
- Fine-tune with QLoRA (r=32-64, targeting attention + MLP) on `(context, correct_tool_call)` pairs - this directly teaches the JSON schema and tool-selection patterns the base model wasn't reliably producing

**Stage 2: DPO on tool-call preference pairs**
- For each prompt, generate multiple candidate tool calls from the SFT model
- Label pairs: `chosen` = valid schema + correct tool + correct args, `rejected` = malformed JSON, wrong tool, or hallucinated parameter
- Run DPO to sharpen the model's preference for the well-formed call over the plausible-but-wrong one - this specifically targets the *failure mode* (malformed JSON, wrong tool) rather than just "produce more of the good examples"

**Evaluation before promoting to production:**
- Schema validity rate (does output parse as valid JSON matching the tool's signature) - should approach ~100%
- Tool-selection accuracy against a held-out labeled set
- End-to-end task success rate in a sandboxed agent loop (not just single-turn tool-call accuracy - a model can nail isolated tool calls and still fail multi-step tasks)

**Why LoRA/QLoRA specifically fits this case:** the goal is a narrow behavioral correction (schema adherence, tool selection) on top of a model that's otherwise fine at everything else it does - exactly the low-forgetting-risk profile from Q11. Full fine-tuning here risks degrading the model's general reasoning to fix a narrow formatting problem.

**Why interviewer asks this:** Connects fine-tuning strategy directly to agentic system reliability - a increasingly common real interview scenario as more teams fine-tune small models specifically for tool-use reliability rather than prompting a large model harder.

**Follow-up:** How would you keep collecting training data for this *after* deployment without a human labeling every trace?

---

### Q24. 🔴 Case Study: A LoRA-fine-tuned model performed great in eval but is degrading in production over time. Find the root cause.

**Scenario:** Three months post-launch, support tickets show the fine-tuned model increasingly gives outdated or subtly wrong answers, despite no code changes to the adapter or serving stack.

**Investigation checklist, ranked by likelihood:**

1. **Input distribution drift** - the product/domain has evolved (new features, new terminology) since the training data was collected. The adapter was never wrong; the *world* moved. This isn't a training bug - it needs a data refresh and periodic re-training, or a RAG layer added on top for the fast-changing facts (tying back to Q1 - training and RAG solve different problems, and a "training-only" system will always drift).
2. **Uncontrolled adapter iteration** - if the team has been incrementally re-training the *same* adapter on new batches of data without mixing in a replay buffer of the original training set, each round risks overwriting earlier learned behavior with newer, narrower patterns - a scoped-down version of catastrophic forgetting (Q11) happening *within* the adapter itself over successive training rounds.
3. **Unpinned/unvalidated deployments** - check whether CI/CD promotes "latest checkpoint" rather than "best-eval checkpoint." A checkpoint from a later, overfit epoch can get deployed automatically without a human-in-the-loop or regression-gate catching the regression.
4. **Adapter/base version mismatch** - confirm the serving stack is loading the adapter against the *exact* base model it was trained against. A base model upgrade (even a "minor" one) can silently invalidate a previously-trained LoRA adapter's assumptions about the frozen weights it's built on top of.
5. **Compounded merge/quantize cycles** - if the deployment pipeline repeatedly merges an adapter into a model and then re-quantizes for serving, re-quantizing an already-merged-and-quantized lineage (rather than always merging into a clean full-precision base, per Q19) compounds quantization error across releases.

**Fix, in order of leverage:** add an automated regression eval suite gating every deployment (catches #3 immediately), version and pin base-model + adapter pairs together (catches #4), and set up a recurring re-training cadence with a replay buffer mixing original + fresh data (catches #1 and #2 simultaneously).

**Why interviewer asks this:** Production model degradation almost never has one root cause - the ability to systematically rule causes in/out (rather than guessing "just retrain it") is exactly what separates a strong applied ML engineer from a script-runner.

**Follow-up:** How would you distinguish "the adapter regressed" from "the underlying task genuinely got harder" using only production logs?
