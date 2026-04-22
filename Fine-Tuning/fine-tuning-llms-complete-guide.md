# Fine-Tuning LLMs: The Complete Engineering Guide

*From pre-trained models to production-ready AI - when to fine-tune, how to do it right, and the mistakes that will cost you thousands in GPU hours.*

---

## Why Fine-Tuning Matters

Pre-trained LLMs like GPT-4, LLaMA, and Mistral are generalists. They know a lot about everything, but not enough about *your* specific domain. Fine-tuning bridges that gap.

```
Pre-trained LLM:
"What's the treatment for hypertension?"
→ Generic textbook answer

Fine-tuned LLM (on hospital records + medical guidelines):
"What's the treatment for hypertension?"
→ Follows your hospital's protocol, references formulary drugs,
  accounts for patient demographics
```

Think of it this way: a pre-trained model is a fresh medical school graduate. Fine-tuning is the residency - specialized, hands-on training that turns general knowledge into domain expertise.

---

## The Fine-Tuning Decision Tree

Not every problem needs fine-tuning. Before you spin up GPUs, ask yourself:

```
Does prompt engineering solve it?
├── Yes → Stop here. Use few-shot prompting.
├── Maybe → Try RAG (Retrieval-Augmented Generation) first.
└── No  → Does your task need:
          ├── Specific output format/style?     → Fine-tune
          ├── Domain-specific knowledge?         → Fine-tune (or RAG)
          ├── Consistent behavior at scale?      → Fine-tune
          ├── Reduced latency/token usage?       → Fine-tune
          └── One-off analysis?                  → Don't fine-tune
```

### When Fine-Tuning Wins Over Prompting

| Scenario | Prompting | RAG | Fine-Tuning |
|----------|-----------|-----|-------------|
| Customer support bot for your product | Okay with long prompts | Good | Best - learns tone, policies, edge cases |
| Legal document summarization | Poor - misses domain nuance | Good | Best - learns legal language and structure |
| Code generation for internal framework | Poor | Good with docs | Best - learns your patterns and conventions |
| General Q&A chatbot | Great | Great | Overkill |
| Real-time data queries | Poor | Best | Wrong tool - data changes too fast |

---

## The Fine-Tuning Landscape in 2025–2026

### Base Models Worth Fine-Tuning

```
Open Source (you control everything):
├── LLaMA 3.x (Meta)          → Best all-around open model
├── Mistral / Mixtral          → Strong efficiency-to-quality ratio
├── Qwen 2.5 (Alibaba)        → Excellent multilingual support
├── Gemma 2 (Google)           → Lightweight, good for edge deployment
└── Phi-3 (Microsoft)          → Small but surprisingly capable

API-based Fine-Tuning (managed):
├── OpenAI GPT-4o / GPT-4o-mini  → Easiest to start, per-token pricing
├── Claude (Anthropic)            → Available for enterprise partners
├── Google Vertex AI              → Gemini model fine-tuning
└── Cohere                        → Enterprise-focused fine-tuning
```

### The Methods: Full Fine-Tuning vs. Parameter-Efficient Methods

```
                    Full Fine-Tuning          LoRA/QLoRA            Prompt Tuning
─────────────────────────────────────────────────────────────────────────────────
Parameters updated  All (billions)            0.1–1% of params      Virtual tokens only
GPU memory          Very high (80GB+)         Low (16–24GB)         Very low (8GB)
Training time       Hours to days             Minutes to hours      Minutes
Quality             Best possible             ~95% of full FT       ~80% of full FT
Risk of forgetting  High                      Low                   Very low
Cost                $$$$$                     $$                    $
Best for            Unlimited budget,         Most use cases        Quick experiments,
                    maximum quality                                 lightweight tasks
```

**For 90% of teams, LoRA or QLoRA is the right answer.** Full fine-tuning is only justified when you have massive datasets, unlimited compute, and need every last bit of quality.

---

## Deep Dive: Every Fine-Tuning Method Explained

There are far more than three ways to fine-tune an LLM. Each method exists because it solves a specific problem the others don't. Here's every method you should know, when each one shines, and when it'll burn your budget for nothing.

---

### Method 1: Full Fine-Tuning (FFT)

Update every single parameter in the model. The original approach - brute force but effective.

```
How it works:

┌────────────────────────────────────┐
│         Pre-trained Model          │
│  ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Layer │ │Layer │ │Layer │ ...   │
│  │  1   │ │  2   │ │  N   │      │
│  └──┬───┘ └──┬───┘ └──┬───┘      │
│     │        │        │           │
│  ALL parameters updated via       │
│  backpropagation on your data     │
└────────────────────────────────────┘

Total trainable params: 100% (billions)
```

**Pros:**
- Maximum quality ceiling - the model fully adapts to your domain
- No architectural constraints - every layer learns your task
- Best for creating entirely new model behaviors (e.g., new language, new modality)
- No inference overhead - no adapters to load or merge

**Cons:**
- Astronomical GPU cost - 70B model needs 8x A100 80GB ($260+/hour on AWS)
- High risk of catastrophic forgetting - model may "unlearn" general knowledge
- Slow iteration - each training run takes hours to days
- Requires massive, high-quality datasets to justify the compute
- Model versioning is painful - each fine-tune produces a full copy of all weights

**When to use:**
- You're building a foundation model or a heavily specialized model (medical, legal, code)
- You have >100K high-quality training examples
- Budget is not a constraint and you need absolute peak performance
- The task requires fundamentally different behavior from the base model

**When NOT to use:**
- Your dataset is under 10K examples (you'll overfit)
- You need fast iteration cycles
- You're a startup or small team with limited GPU budget
- The task is "adjust tone and format" - that's a sledgehammer for a nail

**Production readiness: HIGH** - no adapter overhead, standard model serving. But expensive to maintain and version.

```python
# Full fine-tuning setup - note the massive memory requirements
from transformers import AutoModelForCausalLM, TrainingArguments, Trainer

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3.1-8B-Instruct",
    torch_dtype=torch.bfloat16,
    # NO quantization - full precision for full fine-tuning
)

# All parameters are trainable by default
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Trainable parameters: {trainable:,}")
# Output: Trainable parameters: 8,030,261,248 (ALL 8B)

training_args = TrainingArguments(
    output_dir="./full-ft-output",
    num_train_epochs=2,
    per_device_train_batch_size=1,          # Limited by memory
    gradient_accumulation_steps=16,          # Simulate larger batch
    learning_rate=2e-5,                      # MUCH lower than LoRA
    warmup_ratio=0.05,
    bf16=True,
    gradient_checkpointing=True,             # Essential for memory
    deepspeed="ds_config_zero3.json",        # Multi-GPU distribution
    save_strategy="steps",
    save_steps=500,
)
```

---

### Method 2: LoRA (Low-Rank Adaptation)

Freeze the base model. Inject small trainable matrices into attention layers. Train only those.

```
How it works:

  Input x
    │
    ▼
┌────────┐     ┌───┐   ┌───┐
│Frozen W│  +  │ A │ × │ B │  = Output
│(4096×  │     │4096│   │r× │
│ 4096)  │     │×r  │   │4096│
└────────┘     └───┘   └───┘
  Original     LoRA adapter
  (frozen)     (trainable, r=16)

Parameters: 4096×16 + 16×4096 = 131,072
vs original: 4096×4096 = 16,777,216
Savings: ~99.2% fewer trainable parameters
```

**Pros:**
- 10-100x less memory than full fine-tuning
- Fast training - minutes to hours instead of days
- Low catastrophic forgetting - base model weights are frozen
- Multiple adapters can share one base model (huge cost savings in production)
- Easy to version, rollback, and A/B test - adapters are tiny files (10-100MB)

**Cons:**
- Slightly lower quality ceiling than full fine-tuning (~95% quality)
- Rank selection requires experimentation (r=8 vs r=16 vs r=32)
- Not all layers are equally important - choosing `target_modules` matters
- Inference has slight overhead if adapter isn't merged

**When to use:**
- Most fine-tuning tasks - this is the default choice
- You have 500 to 50,000 training examples
- You need fast iteration and experimentation
- You want to serve multiple specialized models from one base

**When NOT to use:**
- You need absolute maximum quality and have unlimited budget → use Full FT
- You're extremely memory-constrained (even LoRA on 70B needs ~40GB) → use QLoRA
- Your task only needs formatting/style adjustment → consider Prompt Tuning first

**Production readiness: EXCELLENT** - merge adapter into base model for zero-overhead inference, or use multi-adapter serving with vLLM/LoRAX.

```python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=16,                    # Rank: capacity vs. efficiency tradeoff
    lora_alpha=32,           # Scaling factor: usually 2× rank
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
)

model = get_peft_model(model, lora_config)
# Trainable: ~40M / 8B (0.5%)
```

---

### Method 3: QLoRA (Quantized LoRA)

Same as LoRA, but the base model is loaded in 4-bit precision. You train LoRA adapters on top of the quantized model.

```
How it works:

┌──────────────────────────────────────────────┐
│  Base Model (4-bit NormalFloat quantized)     │
│  Memory: ~4GB for 7B model (vs ~14GB fp16)   │
│                                               │
│  ┌──────────────────────────────────┐        │
│  │  LoRA Adapters (bfloat16)        │        │
│  │  Trained in higher precision     │        │
│  │  on top of quantized base        │        │
│  └──────────────────────────────────┘        │
│                                               │
│  Key trick: 4-bit storage, bf16 compute       │
│  "Double quantization" saves even more RAM    │
└──────────────────────────────────────────────┘
```

**Pros:**
- Fine-tune 70B models on a single GPU (A100 80GB or even 48GB A6000)
- Fine-tune 7-13B models on consumer GPUs (RTX 3090/4090 with 24GB)
- Nearly identical quality to standard LoRA (~98% of LoRA quality)
- Democratizes fine-tuning - no multi-GPU clusters needed
- Cost-effective for experimentation and prototyping

**Cons:**
- Slightly lower quality than full-precision LoRA (quantization noise)
- Training is ~15-20% slower due to quantization/dequantization overhead
- Requires `bitsandbytes` library - limited to NVIDIA GPUs (no AMD/Intel support yet)
- Merged model needs careful handling - merge in fp16, then re-quantize for serving
- Debugging quantization issues can be tricky

**When to use:**
- You're GPU-memory constrained (single GPU, consumer hardware)
- You're fine-tuning models >13B parameters
- Budget is tight and you need maximum model size per dollar
- Rapid prototyping before committing to full LoRA or Full FT

**When NOT to use:**
- You have ample GPU memory - standard LoRA is faster and slightly higher quality
- You need to deploy on non-NVIDIA hardware
- You're fine-tuning small models (<3B) - memory savings are minimal

**Production readiness: GOOD** - merge adapter in fp16/bf16 for production. Don't serve the quantized training model directly.

```python
from transformers import BitsAndBytesConfig

# The "Q" in QLoRA - 4-bit quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # NormalFloat4: best for LLM weights
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,       # Quantize the quantization constants too
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3.1-70B-Instruct",
    quantization_config=bnb_config,       # 70B model fits in ~40GB VRAM
    device_map="auto",
)

# Then apply LoRA on top (same as Method 2)
model = get_peft_model(prepare_model_for_kbit_training(model), lora_config)
```

---

### Method 4: Prompt Tuning / Prefix Tuning

Don't touch the model at all. Instead, learn a set of "virtual tokens" (soft prompts) that are prepended to the input.

```
How it works:

Standard prompting:
  [User tokens] → [Frozen Model] → [Output]

Prompt Tuning:
  [Learned virtual tokens | User tokens] → [Frozen Model] → [Output]
     (20-100 trainable                       (completely
      embeddings)                             frozen)

Prefix Tuning (variant):
  Adds learned vectors to EVERY layer's attention, not just the input.

  Layer 1: [Learned prefix | actual KV]
  Layer 2: [Learned prefix | actual KV]
  ...
  Layer N: [Learned prefix | actual KV]
```

**Pros:**
- Extremely lightweight - only trains a few thousand parameters
- Zero risk of catastrophic forgetting - model is completely untouched
- Multiple tasks = multiple soft prompts, same frozen model
- Training is very fast (minutes, not hours)
- Incredibly cheap - can train on a T4 or even CPU for small models

**Cons:**
- Lower quality ceiling than LoRA (~80% of full fine-tuning quality)
- Doesn't work well for complex tasks requiring deep behavior changes
- Performance degrades on tasks very different from pre-training
- Harder to interpret - what do "virtual tokens" mean?
- Limited community tooling compared to LoRA

**When to use:**
- Simple task adaptation (classification, sentiment, format conversion)
- You need many task-specific models and can't afford LoRA for each
- Quick experiments to test whether fine-tuning is even worth pursuing
- Edge deployment where adapter size must be minimal

**When NOT to use:**
- Complex generation tasks (creative writing, code generation, reasoning)
- You need significant behavior changes from the base model
- Quality is critical - LoRA is almost as cheap and much better

**Production readiness: MODERATE** - simple to serve, but limited capability. Best as a screening method before investing in LoRA.

```python
from peft import PromptTuningConfig, TaskType, get_peft_model

prompt_config = PromptTuningConfig(
    task_type=TaskType.CAUSAL_LM,
    num_virtual_tokens=20,               # How many soft tokens to learn
    prompt_tuning_init="TEXT",            # Initialize from real text
    prompt_tuning_init_text="Classify the following text as positive or negative:",
    tokenizer_name_or_path=MODEL_NAME,
)

model = get_peft_model(model, prompt_config)
# Trainable parameters: ~40,000 (vs millions for LoRA)
```

---

### Method 5: Adapters (Bottleneck Adapters)

Insert small trainable bottleneck layers between the frozen transformer layers. Predates LoRA.

```
How it works:

Standard transformer layer:
  Input → [Attention] → [FFN] → Output

With adapter:
  Input → [Attention] → [ADAPTER ↓↑] → [FFN] → [ADAPTER ↓↑] → Output

Each adapter:
  ┌────────────┐
  │ Down-project│  (4096 → 64)     ← Compress
  │ Non-linear  │  (ReLU/GELU)
  │ Up-project  │  (64 → 4096)     ← Expand back
  │ + Residual  │  (skip connection)
  └────────────┘

Bottleneck size controls capacity vs. efficiency.
```

**Pros:**
- Well-studied in research with strong theoretical grounding
- Modular - adapters can be composed, stacked, and mixed
- AdapterHub ecosystem provides pre-trained adapters for many tasks
- Supports adapter fusion - combine knowledge from multiple fine-tuned adapters

**Cons:**
- Adds inference latency (sequential bottleneck computation at every layer)
- Less parameter-efficient than LoRA for the same quality
- LoRA has largely superseded adapters in practice
- Fewer production-grade tooling options compared to LoRA/PEFT

**When to use:**
- Multi-task learning where you want to compose specialized modules
- Research projects leveraging AdapterHub's pre-trained adapters
- When you need adapter fusion (mixing domain knowledge from separate fine-tunes)

**When NOT to use:**
- General fine-tuning → LoRA is simpler and more efficient
- Latency-sensitive production → adapters add per-layer overhead that can't be merged away

**Production readiness: MODERATE** - works, but adapters can't be "merged" into the base model like LoRA. Always adds some inference latency.

```python
from transformers import AutoModelForSeq2SeqLM
from transformers.adapters import AdapterConfig

# Add a bottleneck adapter
adapter_config = AdapterConfig(
    mh_adapter=True,
    output_adapter=True,
    reduction_factor=16,       # Bottleneck: 4096 → 256 → 4096
    non_linearity="relu",
)

model.add_adapter("domain-adapter", config=adapter_config)
model.train_adapter("domain-adapter")  # Freeze everything else
```

---

### Method 6: DPO (Direct Preference Optimization)

Not a parameter-efficient method - it's a *training objective*. Instead of supervised learning on "good" examples, DPO learns from pairs of preferred vs rejected responses.

```
How it works:

SFT (supervised fine-tuning):
  "Here's a good response → learn to produce this"

RLHF (the old way):
  1. Train a reward model on human preferences
  2. Use PPO to optimize the LLM against the reward model
  3. Complex, unstable, expensive

DPO (the modern way):
  "Here's a GOOD response and a BAD response → learn to prefer the good one"
  No reward model needed. No reinforcement learning. Just a clever loss function.

┌──────────────────────────────────────────────┐
│ Prompt: "Explain quantum computing"          │
│                                              │
│ Chosen:  "Quantum computing uses qubits..."  │  ← Clear, helpful
│ Rejected: "QC leverages superposition of..." │  ← Jargon-heavy, unhelpful
│                                              │
│ DPO Loss: log σ(β · (log π(chosen) -        │
│           log π(rejected) - log ref_diff))   │
└──────────────────────────────────────────────┘
```

**Pros:**
- Directly aligns model with human preferences - not just imitation
- Much simpler and more stable than RLHF (no reward model, no PPO)
- Produces higher quality outputs than SFT alone for subjective tasks
- Works with LoRA - combine DPO + LoRA for efficient preference tuning
- Great for reducing harmful/unhelpful outputs

**Cons:**
- Requires preference data (chosen/rejected pairs) - harder to collect than SFT data
- Sensitive to data quality - bad preference labels lead to misalignment
- The `beta` hyperparameter needs careful tuning
- Less effective for purely factual tasks (better for style, safety, helpfulness)
- Typically a second stage after SFT (adds pipeline complexity)

**When to use:**
- You've done SFT and want to improve output quality/safety/helpfulness
- You have human preference data (or can generate it with a stronger model)
- The task is subjective - tone, style, helpfulness, safety
- You're building a chatbot or assistant and want it to "feel" better

**When NOT to use:**
- You don't have preference data (do SFT first)
- The task is purely factual or extractive (classification, NER, extraction)
- You haven't done SFT yet - DPO works best as a refinement on top of SFT

**Production readiness: HIGH** - same serving as any fine-tuned model. The DPO stage only affects training, not inference.

```python
from trl import DPOTrainer, DPOConfig

# DPO is typically applied AFTER initial SFT
# Step 1: SFT fine-tune → Step 2: DPO alignment

dpo_config = DPOConfig(
    output_dir="./dpo-output",
    num_train_epochs=1,              # 1 epoch is usually enough for DPO
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=5e-5,              # Lower than SFT
    beta=0.1,                        # KL penalty: 0.1–0.5 typical
    loss_type="sigmoid",             # Default DPO loss
    bf16=True,
)

# Dataset format: {"prompt": ..., "chosen": ..., "rejected": ...}
trainer = DPOTrainer(
    model=sft_model,                  # Start from your SFT-tuned model
    ref_model=None,                   # None = use implicit reference with LoRA
    args=dpo_config,
    train_dataset=preference_dataset,
    tokenizer=tokenizer,
    peft_config=lora_config,          # Can combine with LoRA
)

trainer.train()
```

---

### Method 7: RLHF (Reinforcement Learning from Human Feedback)

The original alignment technique used by ChatGPT. Train a reward model, then use PPO to optimize the LLM.

```
How it works - 3-stage pipeline:

Stage 1: Supervised Fine-Tuning (SFT)
  Pre-trained model → Train on demonstrations → SFT model

Stage 2: Reward Model Training
  Collect human comparisons (A is better than B)
  Train a reward model to predict human preferences
  Input: (prompt, response) → Output: scalar score

Stage 3: PPO Optimization
  ┌──────────┐    generate     ┌──────────┐
  │ SFT Model│ ──────────────→ │ Response  │
  │ (policy) │                 └────┬─────┘
  └──────────┘                      │
                                    ▼
                              ┌──────────┐
                              │  Reward  │ → Score
                              │  Model   │
                              └──────────┘
                                    │
                              PPO updates policy
                              to maximize reward
                              while staying close
                              to SFT model (KL penalty)
```

**Pros:**
- Most expressive alignment method - can optimize any reward signal
- Battle-tested at scale (ChatGPT, Claude, etc.)
- Can capture complex preferences that DPO's simple loss can't
- Supports online learning from real user interactions

**Cons:**
- Complex 3-stage pipeline - many moving parts that can fail
- PPO is notoriously unstable - reward hacking, mode collapse, training divergence
- Requires training a separate reward model (doubles compute/data requirements)
- Needs 4 models in memory during PPO: policy, reference, reward, value
- Requires significant ML engineering expertise to get right
- DPO achieves comparable results with 10% of the complexity

**When to use:**
- You're a large team (OpenAI/Anthropic/Google-scale) with RLHF infrastructure
- You need online/iterative alignment from real user feedback
- Your reward function is non-trivial (multi-objective, constraint-based)
- DPO doesn't capture the nuance of your preferences

**When NOT to use:**
- Almost always - use DPO instead unless you have a specific reason
- You're a small/medium team without dedicated ML infra engineers
- Your preference data is static (DPO is strictly simpler)

**Production readiness: HIGH** (for the final model) - but the training pipeline is extremely complex and fragile.

---

### Method 8: ORPO (Odds Ratio Preference Optimization)

A newer method that combines SFT and preference alignment into a *single training stage*. No need for separate SFT → DPO pipeline.

```
How it works:

Traditional pipeline:
  Pre-trained → [SFT stage] → [DPO/RLHF stage] → Aligned model
  (2 separate training runs, 2x compute)

ORPO:
  Pre-trained → [Single ORPO stage] → Aligned model
  (1 training run, learns task + preferences simultaneously)

ORPO Loss = SFT Loss + λ × Odds Ratio Loss
  │                        │
  │                        └── Penalizes generating rejected responses
  └── Teaches the task         relative to chosen ones

The "odds ratio" compares:
  P(chosen) / (1 - P(chosen))
  ─────────────────────────────
  P(rejected) / (1 - P(rejected))
```

**Pros:**
- Single-stage training - simpler pipeline than SFT + DPO
- No reference model needed - lower memory footprint during training
- Competitive quality with DPO on most benchmarks
- Faster end-to-end (one training run instead of two)
- Easier to implement and debug

**Cons:**
- Newer method - less community experience and fewer production case studies
- May underperform DPO when preferences are very nuanced
- Still requires preference pair data (chosen/rejected)
- The `lambda` balancing weight between SFT and OR loss needs tuning

**When to use:**
- You have preference data and want alignment but want to skip the two-stage pipeline
- Quick iteration cycles matter (one training run instead of two)
- You're starting from a pre-trained model (not an already-SFT'd model)

**When NOT to use:**
- You already have a good SFT model → just do DPO on top
- You don't have preference data → do SFT only
- You need maximum alignment quality → SFT + DPO is more proven

**Production readiness: GOOD** - same serving as any model. Less proven at scale than DPO/RLHF.

```python
from trl import ORPOTrainer, ORPOConfig

orpo_config = ORPOConfig(
    output_dir="./orpo-output",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    learning_rate=5e-5,
    beta=0.1,                          # Odds ratio weight
    bf16=True,
)

# Same data format as DPO: {"prompt", "chosen", "rejected"}
trainer = ORPOTrainer(
    model=base_model,                   # Start from PRE-TRAINED (not SFT)
    args=orpo_config,
    train_dataset=preference_dataset,
    tokenizer=tokenizer,
    peft_config=lora_config,
)

trainer.train()
```

---

### Method 9: Knowledge Distillation

Train a smaller "student" model to mimic a larger "teacher" model. Not traditional fine-tuning, but a critical technique for production.

```
How it works:

┌───────────────┐
│ Teacher Model  │  (70B parameters, slow, expensive)
│ (GPT-4, etc.) │
└──────┬────────┘
       │ Generate outputs for your dataset
       │ (soft labels / logits / text)
       ▼
┌───────────────┐
│ Student Model  │  (7B parameters, fast, cheap)
│ (LLaMA 8B)    │
└───────────────┘
       │
       │ Train to match teacher's outputs
       │ Loss = KL(student_logits || teacher_logits)
       │       + α × CrossEntropy(student, hard_labels)
       ▼
┌───────────────┐
│ Distilled      │  (7B params, but 70B-like quality
│ Student Model  │   on YOUR specific task)
└───────────────┘
```

**Pros:**
- Get large-model quality at small-model cost and latency
- 5-10x cheaper inference than the teacher model
- Can distill proprietary API models (GPT-4, Claude) into your own open model
- Combine with LoRA for even more efficiency
- The student model is fully under your control (privacy, deployment, cost)

**Cons:**
- Quality ceiling is limited by the teacher - student can't exceed teacher
- Generating teacher outputs for large datasets is expensive (API costs)
- Logit-level distillation requires access to teacher logits (not available for API models)
- May violate terms of service for some API providers (check before distilling)
- Requires careful task definition - distilled models are narrow specialists

**When to use:**
- You need production inference to be fast and cheap, but quality must be high
- You're paying too much for API calls and want to self-host
- You have a well-defined, narrow task where a small model can specialize
- Edge deployment where large models won't fit

**When NOT to use:**
- You need general-purpose capabilities (distilled models are narrow)
- The task changes frequently (re-distillation is expensive)
- Teacher model quality is insufficient for your task

**Production readiness: EXCELLENT** - the whole point is production deployment. Small, fast, cheap.

```python
# Step 1: Generate teacher outputs
import openai

client = openai.OpenAI()  # Using GPT-4 as teacher

def generate_teacher_data(prompts, output_file):
    """Use a large model to generate training data for distillation."""
    with open(output_file, 'w') as f:
        for prompt in prompts:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Your system prompt here"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
            )
            example = {
                "messages": [
                    {"role": "system", "content": "Your system prompt here"},
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": response.choices[0].message.content}
                ]
            }
            f.write(json.dumps(example) + '\n')

# Step 2: Fine-tune student model on teacher outputs (standard SFT with LoRA)
# Use the same LoRA training script from Method 2
```

---

### Method 10: Continued Pre-training (Domain-Adaptive Pre-training)

Before fine-tuning on task-specific data, continue pre-training the base model on your domain's raw text. This teaches the model domain *knowledge* before teaching it domain *tasks*.

```
How it works:

Standard approach:
  General pre-trained model → [Task fine-tuning] → Domain model
  Problem: Model doesn't "know" your domain deeply enough

With continued pre-training:
  General pre-trained model
         │
         ▼
  [Continued pre-training on domain text]    ← Learns domain vocabulary,
  (medical papers, legal docs, code repos)      patterns, and knowledge
         │
         ▼
  Domain-adapted base model
         │
         ▼
  [Task fine-tuning with LoRA/SFT]           ← Now learns to USE that
  (Q&A pairs, instructions, etc.)               knowledge for your task
         │
         ▼
  Production model
```

**Pros:**
- Model deeply understands domain terminology, patterns, and conventions
- Dramatically improves performance on highly specialized domains
- Can use cheap, abundant raw text (no need for instruction pairs)
- The adapted base model can be fine-tuned for multiple downstream tasks
- Particularly effective for non-English languages with limited pre-training data

**Cons:**
- Requires large domain corpora (millions of tokens of raw text)
- Computationally expensive - essentially a second pre-training phase
- Risk of catastrophic forgetting if not done carefully
- Two-stage pipeline adds complexity
- May not help if the base model already has good domain coverage

**When to use:**
- Highly specialized domain (biomedical, legal, financial, scientific)
- Domain has unique vocabulary/patterns not well-represented in pre-training
- You have abundant raw domain text but limited instruction data
- Working with non-English languages

**When NOT to use:**
- General-purpose tasks where the base model already has good coverage
- You only need style/format changes (LoRA is enough)
- You don't have substantial domain text (at least 100M tokens)

**Production readiness: HIGH** - produces a standard model that can be served normally.

```python
# Continued pre-training uses causal language modeling (next-token prediction)
# on raw domain text - no instruction formatting needed

from transformers import AutoModelForCausalLM, TrainingArguments, Trainer
from transformers import DataCollatorForLanguageModeling

model = AutoModelForCausalLM.from_pretrained("meta-llama/Meta-Llama-3.1-8B")

# Raw domain text, chunked into max_length segments
# No instruction formatting - just raw text
# Example: medical papers, legal documents, codebases

training_args = TrainingArguments(
    output_dir="./domain-adapted",
    num_train_epochs=1,                  # Usually 1-2 epochs on domain data
    per_device_train_batch_size=4,
    learning_rate=1e-5,                  # Lower LR than task fine-tuning
    warmup_ratio=0.05,
    bf16=True,
    gradient_checkpointing=True,
)

data_collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=domain_dataset,        # Raw text, tokenized into chunks
    data_collator=data_collator,
)

trainer.train()
# Now fine-tune THIS model with LoRA for your specific task
```

---

## The Ultimate Method Comparison

### Side-by-Side: All 10 Methods

```
Method               Params Trained    GPU Memory    Quality    Speed      Cost
─────────────────────────────────────────────────────────────────────────────────
Full Fine-Tuning     100%              Very High     ★★★★★     Slow       $$$$$
LoRA                 0.1–1%            Medium        ★★★★☆     Fast       $$
QLoRA                0.1–1%            Low           ★★★★☆     Medium     $
Prompt Tuning        <0.01%            Very Low      ★★★☆☆     Very Fast  $
Bottleneck Adapters  0.5–2%            Medium        ★★★★☆     Fast       $$
DPO                  Varies            Varies        ★★★★★*    Medium     $$
RLHF                 Varies            Very High     ★★★★★*    Slow       $$$$$
ORPO                 Varies            Varies        ★★★★☆*    Fast       $$
Distillation         100% (student)    Low–Medium    ★★★★☆     Medium     $$
Continued Pre-train  100%              Very High     ★★★★★**   Slow       $$$$

* Alignment quality (helpfulness, safety, tone)
** Combined with downstream fine-tuning
```

### Decision Matrix: Which Method for Your Situation?

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PICK YOUR METHOD                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  "I have a single GPU and want to fine-tune"                        │
│   → QLoRA                                                            │
│                                                                      │
│  "I have a GPU cluster and want maximum quality"                    │
│   → Full Fine-Tuning (+ DPO for alignment)                          │
│                                                                      │
│  "I want the best quality/cost ratio"                               │
│   → LoRA (the default answer for 90% of teams)                      │
│                                                                      │
│  "I just need simple classification or formatting"                  │
│   → Prompt Tuning (or even just few-shot prompting)                 │
│                                                                      │
│  "My model's outputs are correct but unhelpful/unsafe/poorly-toned" │
│   → DPO on top of your SFT model                                    │
│                                                                      │
│  "I want alignment without a two-stage pipeline"                    │
│   → ORPO                                                             │
│                                                                      │
│  "I'm paying too much for API calls on a narrow task"               │
│   → Knowledge Distillation (API → small open model)                  │
│                                                                      │
│  "My domain is very specialized (medical, legal, scientific)"       │
│   → Continued Pre-training → LoRA fine-tuning                        │
│                                                                      │
│  "I need multiple specialized models but only have one GPU"         │
│   → LoRA multi-adapter serving (one base model, many adapters)       │
│                                                                      │
│  "I want to compose knowledge from multiple fine-tunes"             │
│   → Bottleneck Adapters with adapter fusion                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### The Production-Ready Pipeline (Recommended)

For most teams going from zero to production, follow this path:

```
Stage 1: Validate the approach
├── Try prompting + few-shot examples
├── Try RAG (retrieval-augmented generation)
└── If neither works → proceed to fine-tuning

Stage 2: Data collection
├── Collect 500–5,000 high-quality examples
├── Format consistently (chat format)
├── Create train/eval split (95/5)
└── Audit for duplicates, leakage, quality

Stage 3: Initial fine-tuning
├── Start with QLoRA on a 7-8B model (cheap, fast)
├── Train for 3 epochs, monitor eval loss
├── Evaluate: automated metrics + LLM-as-judge
└── Iterate on data quality (this matters most)

Stage 4: Scale up (if needed)
├── Switch to LoRA (if you have more GPU memory)
├── Try a larger base model (13B, 34B, 70B)
├── Add DPO stage if alignment quality matters
└── Consider continued pre-training for niche domains

Stage 5: Production deployment
├── Merge LoRA adapter into base model
├── Quantize for serving (GPTQ / AWQ / INT8)
├── Deploy with vLLM or TGI
├── Monitor quality with ongoing LLM-as-judge evals
├── Set up A/B testing against current solution
└── Build feedback loop for continuous improvement

┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Prompting → RAG → QLoRA (7B) → LoRA → DPO → Production      │
│     $0        $        $$        $$      $$      $$$/month     │
│                                                                │
│  Each arrow = "Only proceed if the previous step               │
│                doesn't meet your quality bar"                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Real-World Method Combinations That Work

```
Combo 1: "The Startup Special" (fastest to production)
  QLoRA + SFT on 7B model → Merge → vLLM
  Cost: ~$5 training, ~$0.50/hr serving
  Timeline: 1 day data prep, 2 hours training, 1 day eval

Combo 2: "The Quality Stack" (best quality per dollar)
  LoRA + SFT → LoRA + DPO → Merge → vLLM
  Cost: ~$15 training, ~$0.50/hr serving
  Timeline: 3 days data prep, 4 hours training, 2 days eval

Combo 3: "The Domain Expert" (specialized domains)
  Continued Pre-training → LoRA + SFT → DPO → Merge → vLLM
  Cost: ~$200 training, ~$0.50/hr serving
  Timeline: 1 week data prep, 24 hours training, 3 days eval

Combo 4: "The Cost Crusher" (replacing expensive API calls)
  Distillation (GPT-4 → 7B) → QLoRA SFT → Merge → vLLM
  Cost: ~$50 distillation + $5 training, ~$0.10/hr serving
  Timeline: 2 days distillation, 2 hours fine-tuning, 1 day eval

Combo 5: "The Multi-Tenant" (many use cases, one GPU)
  Single base model + multiple LoRA adapters → Multi-adapter serving
  Cost: ~$5 per adapter, ~$0.50/hr serving (for ALL adapters)
  Timeline: 1 day per adapter
```

---

## Part 1: Data - The Most Important Step

Fine-tuning is only as good as your data. Period. A 7B model fine-tuned on excellent data will outperform a 70B model fine-tuned on garbage.

### Data Format

Most fine-tuning frameworks expect conversational format (chat-style) or instruction format:

**Chat format (preferred for most models):**

```json
{
  "messages": [
    {"role": "system", "content": "You are a senior Python code reviewer."},
    {"role": "user", "content": "Review this function:\ndef calc(x,y):\n  return x+y"},
    {"role": "assistant", "content": "Issues found:\n1. **Naming**: `calc` is too vague. Use `add_numbers` or describe the operation.\n2. **Type hints**: Add type annotations: `def add_numbers(x: float, y: float) -> float`\n3. **Docstring**: Missing function documentation.\n4. **No validation**: Consider whether inputs need validation for your use case."}
  ]
}
```

**Instruction format (Alpaca-style):**

```json
{
  "instruction": "Summarize the following legal clause in plain English",
  "input": "The Licensee shall indemnify and hold harmless the Licensor from any claims, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising out of or related to...",
  "output": "If someone sues the licensor because of something you (the licensee) did, you have to pay for all the legal costs and any damages."
}
```

### Data Quality Checklist

Before you start training, audit your data:

```python
# data_audit.py - Quick quality checks for fine-tuning datasets

import json
from collections import Counter

def audit_dataset(filepath: str):
    with open(filepath, 'r') as f:
        data = [json.loads(line) for line in f]

    print(f"Total examples: {len(data)}")

    # 1. Check for duplicates
    texts = [json.dumps(d, sort_keys=True) for d in data]
    duplicates = len(texts) - len(set(texts))
    print(f"Exact duplicates: {duplicates}")

    # 2. Check response lengths
    lengths = []
    for item in data:
        if "messages" in item:
            assistant_msgs = [m for m in item["messages"] if m["role"] == "assistant"]
            for msg in assistant_msgs:
                lengths.append(len(msg["content"]))
        elif "output" in item:
            lengths.append(len(item["output"]))

    print(f"Response length - min: {min(lengths)}, max: {max(lengths)}, "
          f"avg: {sum(lengths)//len(lengths)}")

    # 3. Flag suspiciously short responses
    short = sum(1 for l in lengths if l < 20)
    print(f"Responses under 20 chars (likely low quality): {short}")

    # 4. Check for empty fields
    empty = sum(1 for item in data
                if any(v == "" for v in item.values() if isinstance(v, str)))
    print(f"Examples with empty fields: {empty}")

    # 5. Check system prompt consistency
    if "messages" in data[0]:
        system_prompts = [
            item["messages"][0]["content"]
            for item in data
            if item["messages"][0]["role"] == "system"
        ]
        unique_systems = len(set(system_prompts))
        print(f"Unique system prompts: {unique_systems}")

audit_dataset("training_data.jsonl")
```

### How Much Data Do You Need?

```
Task Type                    Minimum Examples    Sweet Spot       Diminishing Returns
──────────────────────────────────────────────────────────────────────────────────────
Style/tone transfer          50–100              500–1,000        5,000+
Classification               200–500             1,000–5,000      50,000+
Domain Q&A                   500–1,000           5,000–10,000     100,000+
Code generation              1,000–2,000         10,000–50,000    500,000+
Complex reasoning            2,000–5,000         20,000–100,000   1,000,000+
```

**The golden rule**: 500 high-quality examples beat 50,000 mediocre ones. Invest in data quality over quantity.

---

## Part 2: Fine-Tuning with LoRA/QLoRA (Practical Guide)

### Setting Up the Environment

```bash
# Create a clean environment
conda create -n finetune python=3.11 -y
conda activate finetune

# Install core dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers datasets accelerate peft bitsandbytes
pip install trl wandb scipy
```

### LoRA Fine-Tuning - Step by Step

**LoRA (Low-Rank Adaptation)** works by injecting small trainable matrices into the frozen model's attention layers. Instead of updating billions of parameters, you update millions - 100x fewer.

```
Original weight matrix W (4096 x 4096 = 16M params):
┌─────────────────────┐
│                     │
│    Frozen W         │  ← Not updated during training
│                     │
└─────────────────────┘

LoRA decomposition (rank=16):
┌──────┐   ┌─────────────────────┐
│  A   │ × │         B           │  = ΔW (low-rank update)
│4096×16│  │      16×4096        │
└──────┘   └─────────────────────┘
  65K    ×      65K params        =  ~130K trainable params
                                     (vs 16M in full matrix)

Final output: W_new = W_frozen + α × (A × B)
```

### Full Training Script

```python
# finetune_lora.py - Production-ready LoRA fine-tuning script

import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

# ============================================================
# 1. Configuration
# ============================================================

MODEL_NAME = "meta-llama/Meta-Llama-3.1-8B-Instruct"
DATASET_PATH = "training_data.jsonl"
OUTPUT_DIR = "./llama3-finetuned"
MAX_SEQ_LENGTH = 2048

# QLoRA: 4-bit quantization config
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",              # NormalFloat4 - best for LLMs
    bnb_4bit_compute_dtype=torch.bfloat16,   # Compute in bf16 for stability
    bnb_4bit_use_double_quant=True,          # Nested quantization saves more memory
)

# ============================================================
# 2. Load Model and Tokenizer
# ============================================================

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    attn_implementation="flash_attention_2",  # Faster attention
)

model = prepare_model_for_kbit_training(model)

# ============================================================
# 3. LoRA Configuration
# ============================================================

lora_config = LoraConfig(
    r=16,                          # Rank - higher = more capacity, more memory
    lora_alpha=32,                 # Scaling factor (usually 2x rank)
    lora_dropout=0.05,             # Regularization
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=[               # Which layers to apply LoRA to
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj",       # MLP (FFN)
    ],
)

model = get_peft_model(model, lora_config)

# Print trainable parameters
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
total_params = sum(p.numel() for p in model.parameters())
print(f"Trainable: {trainable_params:,} / {total_params:,} "
      f"({100 * trainable_params / total_params:.2f}%)")

# ============================================================
# 4. Load and Format Dataset
# ============================================================

dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

# Split into train/eval
dataset = dataset.train_test_split(test_size=0.05, seed=42)

def format_chat(example):
    """Convert messages list to the model's chat template."""
    return {
        "text": tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False
        )
    }

train_dataset = dataset["train"].map(format_chat)
eval_dataset = dataset["test"].map(format_chat)

# ============================================================
# 5. Training Arguments
# ============================================================

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    gradient_accumulation_steps=4,       # Effective batch size = 4 * 4 = 16
    learning_rate=2e-4,
    weight_decay=0.01,
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",

    # Logging
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=100,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,

    # Performance
    bf16=True,                           # Use bfloat16 mixed precision
    gradient_checkpointing=True,         # Trade compute for memory
    optim="paged_adamw_8bit",            # Memory-efficient optimizer

    # Tracking
    report_to="wandb",
    run_name="llama3-lora-finetune",

    # Best model selection
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
)

# ============================================================
# 6. Train
# ============================================================

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_text_field="text",
    packing=True,                        # Pack short examples together
)

trainer.train()

# ============================================================
# 7. Save the LoRA Adapter
# ============================================================

trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print(f"Model saved to {OUTPUT_DIR}")
print("To merge with base model later, use:")
print("  from peft import PeftModel")
print("  merged = PeftModel.from_pretrained(base_model, OUTPUT_DIR)")
print("  merged = merged.merge_and_unload()")
```

### Understanding the Key Hyperparameters

```
┌─────────────────────────────────────────────────────────────┐
│                 HYPERPARAMETER GUIDE                        │
├──────────────────┬──────────────────────────────────────────┤
│ LoRA rank (r)    │ 8  = lightweight, quick experiments      │
│                  │ 16 = good default for most tasks         │
│                  │ 32 = complex tasks, large datasets       │
│                  │ 64 = approaching full fine-tune quality   │
├──────────────────┼──────────────────────────────────────────┤
│ Learning rate    │ 1e-4 to 3e-4 for LoRA                   │
│                  │ 1e-5 to 5e-5 for full fine-tuning        │
│                  │ Too high → unstable, catastrophic forget  │
│                  │ Too low  → slow convergence, underfitting │
├──────────────────┼──────────────────────────────────────────┤
│ Epochs           │ 1–3 for large datasets (>10K examples)   │
│                  │ 3–5 for medium datasets (1K–10K)         │
│                  │ 5–10 for small datasets (<1K)            │
│                  │ Watch eval loss - stop if it goes up      │
├──────────────────┼──────────────────────────────────────────┤
│ Batch size       │ Larger = more stable gradients            │
│                  │ Use gradient_accumulation to simulate      │
│                  │ large batches on limited GPU memory        │
├──────────────────┼──────────────────────────────────────────┤
│ Warmup           │ 3–5% of total steps                      │
│                  │ Prevents early training instability        │
└──────────────────┴──────────────────────────────────────────┘
```

---

## Part 3: Evaluation - How to Know If It Worked

Training loss going down is necessary but not sufficient. You need proper evaluation.

### Automated Metrics

```python
# evaluate_model.py - Evaluate fine-tuned model quality

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import json

def load_finetuned_model(base_model_name, adapter_path):
    """Load base model with LoRA adapter merged."""
    tokenizer = AutoTokenizer.from_pretrained(base_model_name)
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name, torch_dtype=torch.bfloat16, device_map="auto"
    )
    model = PeftModel.from_pretrained(model, adapter_path)
    model = model.merge_and_unload()
    return model, tokenizer

def generate_response(model, tokenizer, messages, max_new_tokens=512):
    """Generate a response from the model."""
    input_text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.1,           # Low temp for evaluation consistency
            do_sample=True,
            top_p=0.9,
        )

    response = tokenizer.decode(
        outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )
    return response

def run_evaluation(model, tokenizer, eval_file):
    """Run evaluation on a held-out test set."""
    with open(eval_file) as f:
        eval_data = [json.loads(line) for line in f]

    results = []
    for item in eval_data:
        messages = item["messages"][:-1]  # Everything except the expected answer
        expected = item["messages"][-1]["content"]

        generated = generate_response(model, tokenizer, messages)

        results.append({
            "input": messages[-1]["content"][:100],
            "expected": expected[:200],
            "generated": generated[:200],
            "length_ratio": len(generated) / max(len(expected), 1),
        })

    # Summary statistics
    avg_length_ratio = sum(r["length_ratio"] for r in results) / len(results)
    print(f"Evaluated {len(results)} examples")
    print(f"Avg length ratio (generated/expected): {avg_length_ratio:.2f}")

    return results
```

### The Evaluation Framework You Should Actually Use

```
┌──────────────────────────────────────────────────────────────┐
│              EVALUATION PYRAMID                              │
│                                                              │
│                    ┌─────────┐                               │
│                    │ Human   │  ← Gold standard              │
│                    │  Eval   │    (expensive, slow)           │
│                   ─┴─────────┴─                              │
│                 ┌───────────────┐                             │
│                 │  LLM-as-Judge │  ← Use GPT-4 / Claude      │
│                 │  Evaluation   │    to score outputs         │
│                ─┴───────────────┴─                           │
│              ┌───────────────────┐                            │
│              │ Task-Specific     │  ← Accuracy, F1,          │
│              │ Metrics           │    ROUGE, exact match      │
│             ─┴───────────────────┴─                          │
│           ┌───────────────────────┐                           │
│           │ Training Metrics      │  ← Loss curves,          │
│           │ (Necessary but not    │    perplexity             │
│           │  sufficient)          │                           │
│          ─┴───────────────────────┴─                         │
└──────────────────────────────────────────────────────────────┘
```

### LLM-as-Judge Evaluation

```python
# llm_judge.py - Use a strong model to evaluate your fine-tuned model

JUDGE_PROMPT = """You are evaluating an AI assistant's response.

Task: {task_description}
User Input: {user_input}
Expected Response: {expected}
Model Response: {generated}

Rate the model's response on these criteria (1-5 each):
1. **Accuracy**: Is the information correct?
2. **Completeness**: Does it cover all important points?
3. **Format**: Does it follow the expected format/style?
4. **Helpfulness**: Would a user find this useful?

Provide scores and a brief explanation for each.
Output as JSON: {{"accuracy": N, "completeness": N, "format": N, "helpfulness": N, "explanation": "..."}}
"""

# Use this with any strong API model (GPT-4, Claude) to batch-evaluate
# your fine-tuned model's outputs against expected responses.
```

---

## Part 4: Common Pitfalls and How to Avoid Them

### 1. Catastrophic Forgetting

The model learns your task but forgets everything else.

```
Before fine-tuning:
  "What is Python?"  → Excellent explanation
  "Your domain task" → Poor performance

After bad fine-tuning:
  "What is Python?"  → Gibberish or domain-specific nonsense
  "Your domain task" → Good performance

After good fine-tuning:
  "What is Python?"  → Still excellent explanation
  "Your domain task" → Good performance
```

**Prevention:**
- Use LoRA instead of full fine-tuning (inherently limits forgetting)
- Keep learning rate low (2e-4 for LoRA, 2e-5 for full FT)
- Mix 5–10% general-purpose data into your training set
- Use fewer epochs - stop when eval loss plateaus

### 2. Overfitting on Small Datasets

```python
# Signs of overfitting - watch your training curves:

# HEALTHY:
# Train loss: 1.2 → 0.8 → 0.6 → 0.5
# Eval loss:  1.3 → 0.9 → 0.7 → 0.65  ← Eval tracks training

# OVERFITTING:
# Train loss: 1.2 → 0.8 → 0.3 → 0.1   ← Keeps dropping
# Eval loss:  1.3 → 0.9 → 0.95 → 1.1   ← Starts going UP

# SOLUTIONS:
# 1. Early stopping - stop when eval loss increases for N steps
# 2. Increase dropout (lora_dropout=0.1)
# 3. Reduce rank (r=8 instead of r=16)
# 4. Reduce epochs
# 5. Get more data (always the best answer)
```

### 3. Data Contamination

Your eval set leaked into your training set. Your metrics look amazing. Your model is actually terrible.

```python
# ALWAYS check for data leakage
def check_leakage(train_file, eval_file):
    with open(train_file) as f:
        train = set(json.dumps(json.loads(l), sort_keys=True) for l in f)
    with open(eval_file) as f:
        eval_data = set(json.dumps(json.loads(l), sort_keys=True) for l in f)

    overlap = train & eval_data
    if overlap:
        print(f"DATA LEAKAGE: {len(overlap)} examples appear in both sets!")
        return False
    print("No leakage detected.")
    return True
```

### 4. The Formatting Trap

Your model outputs great content but in the wrong format - because your training data had inconsistent formatting.

```
BAD training data (inconsistent):
  Example 1: "The answer is: Yes"
  Example 2: "**Yes** - the answer is affirmative"
  Example 3: "yes"
  Example 4: "Answer: Yes. Explanation: ..."

GOOD training data (consistent):
  Example 1: "**Answer:** Yes\n**Explanation:** The condition is met because..."
  Example 2: "**Answer:** No\n**Explanation:** The input falls outside the valid range..."
  Example 3: "**Answer:** Yes\n**Explanation:** Both criteria are satisfied..."
```

---

## Part 5: Deployment and Serving

### Merging LoRA Adapters for Production

```python
# merge_and_export.py - Merge LoRA weights into base model for deployment

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"
ADAPTER_PATH = "./llama3-finetuned"
MERGED_OUTPUT = "./llama3-merged"

# Load base model at full precision for merging
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
)

# Load and merge LoRA adapter
model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)
model = model.merge_and_unload()  # Merge LoRA weights into base weights

# Save the merged model
model.save_pretrained(MERGED_OUTPUT)
AutoTokenizer.from_pretrained(BASE_MODEL).save_pretrained(MERGED_OUTPUT)

print(f"Merged model saved to {MERGED_OUTPUT}")
print("You can now serve this with vLLM, TGI, or llama.cpp")
```

### Serving with vLLM (Production-Grade)

```bash
# Install vLLM
pip install vllm

# Serve the merged model with OpenAI-compatible API
python -m vllm.entrypoints.openai.api_server \
    --model ./llama3-merged \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 4096 \
    --tensor-parallel-size 1 \
    --gpu-memory-utilization 0.9
```

```python
# Client code - use it like any OpenAI-compatible API
import openai

client = openai.OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")

response = client.chat.completions.create(
    model="./llama3-merged",
    messages=[
        {"role": "system", "content": "You are a senior Python code reviewer."},
        {"role": "user", "content": "Review this function:\ndef f(x): return x*2"},
    ],
    temperature=0.3,
    max_tokens=500,
)

print(response.choices[0].message.content)
```

### Deployment Architecture

```
Production Fine-Tuned LLM Serving:

                    ┌─────────────────┐
                    │  Load Balancer   │
                    │  (nginx/ALB)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  vLLM    │  │  vLLM    │  │  vLLM    │
        │ Instance │  │ Instance │  │ Instance │
        │ (GPU 1)  │  │ (GPU 2)  │  │ (GPU 3)  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                     ┌──────┴──────┐
                     │   Shared    │
                     │   Storage   │
                     │ (Model      │
                     │  Weights)   │
                     └─────────────┘

Scaling strategy:
- Horizontal: Add more GPU instances behind load balancer
- Batching: vLLM's continuous batching handles concurrent requests
- Caching: KV-cache reuse for repeated prefixes (system prompts)
- Quantization: Serve in INT8/INT4 for 2-4x throughput boost
```

---

## Part 6: Cost and GPU Planning

### GPU Memory Requirements

```
Model Size    Full FT Memory    QLoRA Memory    Inference Memory
──────────────────────────────────────────────────────────────
1B            ~8 GB             ~6 GB           ~2 GB
3B            ~24 GB            ~10 GB          ~6 GB
7–8B          ~60 GB            ~16 GB          ~14 GB
13B           ~104 GB           ~24 GB          ~26 GB
34B           ~272 GB           ~48 GB          ~68 GB
70B           ~560 GB           ~80 GB          ~140 GB
```

### Cloud GPU Cost Comparison (approximate, 2025–2026)

```
Provider          GPU              VRAM     $/hour    Best For
─────────────────────────────────────────────────────────────────
Lambda Labs       A100 80GB        80 GB    $1.10     QLoRA 70B
RunPod            A100 80GB        80 GB    $1.64     Quick experiments
AWS (p4d)         A100 40GB x8     320 GB   $32.77    Full FT large models
Google Cloud      A100 80GB        80 GB    $3.67     Vertex AI integration
Together AI       Various          -        $0.50+    Managed fine-tuning
Modal             A100 / H100      80 GB    $1.10+    Serverless GPU

Budget-friendly options:
- Vast.ai         Community GPUs   Various  $0.30+    Cheapest, less reliable
- Google Colab    T4 / A100        15-40GB  Free–$10  Learning and prototyping
```

### Example Cost Calculation

```
Scenario: Fine-tune LLaMA 3.1 8B with QLoRA on 10,000 examples

Hardware: 1x A100 80GB ($1.10/hr on Lambda)
Training: ~2 hours (3 epochs, batch size 16)
Cost: ~$2.20

Scenario: Fine-tune LLaMA 3.1 70B with QLoRA on 50,000 examples

Hardware: 1x A100 80GB ($1.10/hr on Lambda)
Training: ~12 hours (2 epochs, batch size 4)
Cost: ~$13.20

Compare to API fine-tuning:
OpenAI GPT-4o-mini fine-tuning on 10,000 examples
Training: ~$7.50 (at $0.0003/token, ~2500 tokens/example)
Inference: $0.60/M output tokens (3x base price)
```

---

## Part 7: Advanced Techniques

### Choosing Between Alignment Methods: DPO vs RLHF vs ORPO

We covered all three in the methods deep dive. Here's the quick decision:

```
Do you have preference data (chosen/rejected pairs)?
├── No  → Do SFT only. Come back when you have preference data.
└── Yes →
        Do you already have an SFT model?
        ├── No  → Use ORPO (single-stage: SFT + alignment together)
        └── Yes →
                Is your preference signal complex/multi-objective?
                ├── Yes → Consider RLHF (if you have the infrastructure)
                └── No  → Use DPO (simpler, comparable quality)
```

### Multi-Adapter Serving

Serve one base model with multiple LoRA adapters for different tasks - massive cost savings.

```python
# Serve multiple fine-tuned "models" from a single base model
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL)

# Load adapters on demand
adapters = {
    "code-review": "./adapters/code-review",
    "legal-summary": "./adapters/legal-summary",
    "customer-support": "./adapters/customer-support",
}

def get_response(task_name, user_input):
    # Hot-swap LoRA adapters - same base model, different specializations
    model = PeftModel.from_pretrained(base_model, adapters[task_name])
    # Generate response...
```

---

## The Fine-Tuning Checklist

Before you start, go through this:

```
PRE-TRAINING:
□ Confirmed that prompting and RAG aren't sufficient
□ Collected and cleaned training data (500+ quality examples minimum)
□ Data is in correct format (chat or instruction)
□ Checked for duplicates and data leakage
□ Formatting is consistent across all examples
□ Train/eval split created (95/5 or 90/10)
□ Chosen base model appropriate for task and budget
□ GPU provisioned with sufficient VRAM

DURING TRAINING:
□ Monitoring training and eval loss (Wandb/TensorBoard)
□ Eval loss is decreasing (not increasing)
□ Learning rate and epochs are reasonable
□ Gradient checkpointing enabled if memory-constrained
□ Saving checkpoints regularly

POST-TRAINING:
□ Evaluated on held-out test set (not just eval split)
□ Compared against base model (quantified improvement)
□ Tested for catastrophic forgetting (general knowledge)
□ Checked output formatting consistency
□ Run LLM-as-judge evaluation for subjective quality
□ A/B tested against current solution
□ Merged and exported model for serving
□ Deployment tested with production-like traffic
```

---

## Closing Thoughts

Fine-tuning is not magic. It's engineering - messy, iterative, and dependent on good data more than anything else. The teams that succeed at fine-tuning aren't the ones with the biggest GPUs or the most parameters. They're the ones with the cleanest data, the clearest evaluation criteria, and the discipline to try prompting first.

Start small. Fine-tune a 7B model on 500 examples with QLoRA. Evaluate rigorously. Then scale up *only if the results justify it*. That approach will get you to production faster - and cheaper - than chasing the biggest model with the most data.

The best fine-tuned model is the smallest one that solves your problem.

---

*If this guide helped you, share it with someone about to burn $500 on a poorly planned fine-tuning run. They'll thank you later.*
