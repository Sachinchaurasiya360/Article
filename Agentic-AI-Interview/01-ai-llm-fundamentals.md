# Section 1: AI & LLM Fundamentals

> Core knowledge about large language models — architecture, training, inference, and the mechanics that power modern AI systems.

---

## Table of Contents

- [Conceptual Questions](#conceptual-questions)
- [Coding Questions](#coding-questions)
- [Debugging Scenarios](#debugging-scenarios)
- [Output-Based Questions](#output-based-questions)
- [Real-World Case Studies](#real-world-case-studies)

---

## Conceptual Questions

### Q1. 🟢 What is a Large Language Model, and how does it differ from traditional NLP models?

**Answer:**

A Large Language Model (LLM) is a neural network trained on massive text corpora using self-supervised learning (next-token prediction or masked language modeling) that develops emergent capabilities — reasoning, in-context learning, instruction following — as a function of scale.

**Key differences from traditional NLP:**

| Aspect | Traditional NLP | LLMs |
|--------|----------------|------|
| Architecture | Task-specific (LSTM, CRF, SVM) | General-purpose Transformer |
| Training | Supervised on labeled data per task | Self-supervised on raw text, then fine-tuned |
| Task handling | One model per task | One model, many tasks (via prompting) |
| Data requirement | 1K–100K labeled examples | Trillions of tokens (pre-training) |
| Emergent abilities | None | In-context learning, chain-of-thought, code generation |
| Knowledge | Only what's in training labels | Broad world knowledge encoded in parameters |

Traditional NLP required separate pipelines — tokenization → POS tagging → NER → parsing → task-specific classifier. LLMs collapse this into a single model that can be steered with natural language instructions.

The critical insight: scale (parameters × data × compute) produces **qualitative** shifts in capability. A 100M parameter model can do sentiment analysis. A 100B parameter model can write code, solve math, and follow complex multi-step instructions.

**Why interviewer asks this:** Tests whether you understand the paradigm shift from feature-engineered NLP to learned representations, and whether you recognize LLMs as more than "bigger models."

**Follow-up:** At what scale do emergent abilities like in-context learning appear, and why is this controversial?

---

### Q2. 🟢 Explain the Transformer architecture. Why did it replace RNNs/LSTMs?

**Answer:**

The Transformer (Vaswani et al., 2017 — "Attention Is All You Need") processes sequences using **self-attention** instead of recurrence, enabling parallel computation and capturing long-range dependencies without vanishing gradients.

**Core components:**

```
Input → Token Embedding + Positional Encoding
      → [Multi-Head Self-Attention → Add & Norm → FFN → Add & Norm] × N layers
      → Output Projection → Softmax → Next Token Probabilities
```

**Self-Attention mechanism:**

For each token, compute:
1. **Query (Q)**: "What am I looking for?"
2. **Key (K)**: "What do I contain?"
3. **Value (V)**: "What information do I provide?"

```
Attention(Q, K, V) = softmax(QK^T / √d_k) · V
```

The `√d_k` scaling prevents the dot products from growing too large, which would push softmax into regions with extremely small gradients.

**Multi-Head Attention** runs multiple attention operations in parallel, each learning different relationship types (syntactic, semantic, positional).

**Why Transformers replaced RNNs:**

| Problem with RNNs | Transformer Solution |
|-------------------|---------------------|
| Sequential processing (can't parallelize) | All positions processed simultaneously |
| Vanishing/exploding gradients over long sequences | Direct attention between any two positions |
| Fixed hidden state bottleneck | Attention scales with sequence length |
| O(n) path length for distant dependencies | O(1) path length via direct attention |
| Slow training (can't use modern GPU parallelism) | Highly parallelizable on GPUs/TPUs |

**Why interviewer asks this:** Transformer knowledge is foundational for every LLM discussion. Interviewers test depth — do you understand *why* self-attention works, not just *that* it works.

**Follow-up:** What is the computational complexity of self-attention, and what approaches exist to reduce it?

---

### Q3. 🟡 What are the three main Transformer variants, and when would you use each?

**Answer:**

| Variant | Architecture | Training Objective | Example Models | Best For |
|---------|-------------|-------------------|----------------|----------|
| **Encoder-only** | Bidirectional self-attention | Masked Language Modeling (MLM) | BERT, RoBERTa, DeBERTa | Classification, NER, semantic similarity |
| **Decoder-only** | Causal (left-to-right) self-attention | Next Token Prediction (NTP) | GPT-4, Claude, LLaMA, Mistral | Text generation, reasoning, chat, code |
| **Encoder-Decoder** | Encoder (bidirectional) + Decoder (causal) with cross-attention | Sequence-to-sequence (e.g., span corruption) | T5, BART, mBART | Translation, summarization, structured extraction |

**Why decoder-only dominates today:**

1. **Scaling efficiency**: Simpler architecture scales better with compute
2. **Unified interface**: Everything is text-in, text-out — no task-specific heads needed
3. **In-context learning**: Emergent with scale, makes fine-tuning optional
4. **Autoregressive generation**: Naturally produces fluent, coherent long-form text

**When to still use encoder-only:**
- Classification tasks with latency constraints (BERT is much faster than GPT for classification)
- Embedding generation where bidirectional context matters
- Edge deployment where model size is limited

**Why interviewer asks this:** Tests architectural understanding and practical judgment about which model type fits which use case.

**Follow-up:** Why can't you use a decoder-only model to generate high-quality sentence embeddings without modification?

---

### Q4. 🟡 Explain the training pipeline of a modern LLM: pre-training → SFT → RLHF.

**Answer:**

Modern LLMs go through three training stages, each with distinct objectives:

**Stage 1: Pre-training (Self-Supervised)**
```
Objective: Next-token prediction on massive text corpora
Data: Trillions of tokens from web, books, code, papers
Compute: Thousands of GPUs for weeks/months
Result: Base model with broad knowledge but no instruction-following
```

The model learns language structure, facts, reasoning patterns, and code — all from predicting the next token. This is where >99% of compute is spent.

**Stage 2: Supervised Fine-Tuning (SFT)**
```
Objective: Learn to follow instructions and produce helpful responses
Data: 10K–100K high-quality (instruction, response) pairs
Compute: Hours to days on modest GPU clusters
Result: Model that can follow instructions but may still be harmful/unhelpful
```

SFT teaches the *format* — how to be a helpful assistant rather than a text completion engine. Quality of data matters far more than quantity (LIMA paper: 1,000 carefully curated examples can match models trained on 50K).

**Stage 3: RLHF / Preference Optimization**
```
Objective: Align model outputs with human preferences
Process:
  1. Generate multiple responses for each prompt
  2. Human rankers order responses by quality
  3. Train a reward model on these preferences
  4. Optimize the LLM using PPO/DPO against the reward model
Result: Model that is helpful, harmless, and honest
```

**Modern alternatives to PPO-based RLHF:**

| Method | Key Idea | Advantage |
|--------|----------|-----------|
| **DPO (Direct Preference Optimization)** | Directly optimize policy from preference pairs, no separate reward model | Simpler, more stable training |
| **RLAIF** | Use an AI model to generate preference labels instead of humans | Cheaper, scales better |
| **Constitutional AI (CAI)** | Model critiques its own outputs against principles | Self-improving alignment |
| **KTO (Kahneman-Tversky Optimization)** | Works with binary feedback (good/bad) instead of pairwise comparisons | Easier data collection |

```python
# Conceptual: DPO loss function
def dpo_loss(policy_model, reference_model, preferred, rejected, beta=0.1):
    """
    DPO eliminates the reward model entirely.
    Instead of: Train reward → Use PPO to optimize against reward
    DPO does:   Directly optimize policy from preference pairs
    """
    # Log probabilities under current policy
    log_prob_preferred = policy_model.log_prob(preferred)
    log_prob_rejected = policy_model.log_prob(rejected)

    # Log probabilities under reference (frozen) policy
    ref_log_prob_preferred = reference_model.log_prob(preferred)
    ref_log_prob_rejected = reference_model.log_prob(rejected)

    # DPO objective: increase relative probability of preferred over rejected
    log_ratio_preferred = log_prob_preferred - ref_log_prob_preferred
    log_ratio_rejected = log_prob_rejected - ref_log_prob_rejected

    loss = -torch.log(torch.sigmoid(beta * (log_ratio_preferred - log_ratio_rejected)))
    return loss.mean()
```

**Why interviewer asks this:** Tests understanding of the full training pipeline and modern alignment techniques. Senior candidates should know DPO/RLAIF, not just basic RLHF.

**Follow-up:** What is the "alignment tax" and how do you measure whether alignment training has degraded the model's core capabilities?

---

### Q5. 🟡 What is tokenization? Compare BPE, WordPiece, and SentencePiece.

**Answer:**

Tokenization converts raw text into discrete integer IDs that the model processes. The choice of tokenizer affects model performance, vocabulary efficiency, and multilingual capability.

**Byte Pair Encoding (BPE):**
```
Algorithm:
1. Start with character-level vocabulary
2. Count all adjacent character pairs in corpus
3. Merge the most frequent pair into a new token
4. Repeat until desired vocabulary size

Example: "low lower lowest"
→ Characters: l, o, w, e, r, s, t, ...
→ After merges: lo, low, low_er, low_est
```
Used by: GPT-2, GPT-3, GPT-4, LLaMA, Claude

**WordPiece:**
```
Similar to BPE but uses likelihood-based merging:
- Merge pairs that maximize the likelihood of the training data
- Uses "##" prefix for sub-word continuations: "playing" → "play" + "##ing"
```
Used by: BERT, DistilBERT

**SentencePiece:**
```
Key difference: Treats input as raw byte stream (no pre-tokenization)
- Language-agnostic: no need for language-specific word splitters
- Uses Unigram LM or BPE as the algorithm underneath
- Handles whitespace as part of the token (▁ prefix)
```
Used by: T5, LLaMA, Mistral

**Practical implications:**

```python
import tiktoken

# GPT-4 tokenizer (cl100k_base)
enc = tiktoken.get_encoding("cl100k_base")

# English is token-efficient
english = "The quick brown fox jumps over the lazy dog"
print(f"English: {len(english)} chars → {len(enc.encode(english))} tokens")
# English: 43 chars → 9 tokens

# Code is moderately efficient
code = "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)"
print(f"Code: {len(code)} chars → {len(enc.encode(code))} tokens")
# Code: 73 chars → 22 tokens

# Non-Latin scripts are token-expensive
hindi = "नमस्ते दुनिया"
print(f"Hindi: {len(hindi)} chars → {len(enc.encode(hindi))} tokens")
# Hindi: 14 chars → 16 tokens (more tokens than characters!)
```

**Why this matters in production:**
- Token count directly affects **cost** (APIs charge per token)
- Token count affects **latency** (more tokens = longer generation)
- Token count determines if content fits in **context window**
- Multilingual bias: non-English languages use 2–5× more tokens for equivalent content

**Why interviewer asks this:** Tokenization bugs are common in production LLM systems. Understanding tokenization helps debug issues like hallucinated numbers, broken multilingual support, and unexpected context window exhaustion.

**Follow-up:** Why do LLMs struggle with character-level tasks like counting letters in a word or reversing strings?

---

### Q6. 🟡 What is the KV cache? Why is it critical for inference performance?

**Answer:**

The KV (Key-Value) cache stores previously computed key and value tensors during autoregressive generation so they don't need to be recomputed at each step.

**Without KV cache:**
```
Generating "The cat sat on the mat"
Step 1: Process [The]           → compute K,V for position 0      → predict "cat"
Step 2: Process [The, cat]      → RECOMPUTE K,V for positions 0,1 → predict "sat"
Step 3: Process [The, cat, sat] → RECOMPUTE K,V for positions 0,1,2 → predict "on"
...
Complexity per step: O(n²) where n = sequence length so far
Total: O(n³) for full generation
```

**With KV cache:**
```
Step 1: Process [The]    → compute K₀,V₀ → CACHE → predict "cat"
Step 2: Process [cat]    → compute K₁,V₁ → CACHE → attend to {K₀,V₀,K₁,V₁} → predict "sat"
Step 3: Process [sat]    → compute K₂,V₂ → CACHE → attend to {K₀,V₀,K₁,V₁,K₂,V₂} → predict "on"
...
Complexity per step: O(n)
Total: O(n²) for full generation
```

**Memory cost of KV cache:**

```
KV cache size = 2 × num_layers × num_heads × head_dim × sequence_length × batch_size × bytes_per_element

For LLaMA-70B at 4K context:
= 2 × 80 layers × 64 heads × 128 dim × 4096 seq × 1 batch × 2 bytes (FP16)
≈ 10.7 GB per request
```

This is why **long-context models are memory-bound, not compute-bound** during inference.

**KV cache optimization techniques:**

| Technique | How It Works | Memory Savings |
|-----------|-------------|---------------|
| **Multi-Query Attention (MQA)** | Share K,V across all attention heads | ~8× reduction |
| **Grouped-Query Attention (GQA)** | Share K,V across groups of heads | ~4-8× reduction |
| **KV cache quantization** | Store K,V in INT8/INT4 instead of FP16 | 2-4× reduction |
| **PagedAttention (vLLM)** | Allocate KV cache in non-contiguous pages like OS virtual memory | Near-zero waste |
| **Sliding window attention** | Only cache last W tokens | Fixed memory regardless of sequence length |

**Why interviewer asks this:** KV cache management is the #1 bottleneck in production LLM serving. Understanding it separates application developers from system engineers.

**Follow-up:** Explain how PagedAttention in vLLM works and why it dramatically improves throughput for concurrent requests.

---

### Q7. 🔴 What is speculative decoding and how does it speed up inference?

**Answer:**

Speculative decoding uses a small, fast "draft" model to generate candidate tokens that a large "target" model verifies in parallel — converting sequential generation into partially parallel verification.

**The core insight:** Verifying N tokens is much cheaper than generating N tokens because verification can be done in a single forward pass (all tokens processed simultaneously), while generation requires N sequential forward passes.

**Algorithm:**

```python
def speculative_decoding(target_model, draft_model, prompt, gamma=5):
    """
    gamma: number of tokens the draft model generates per speculation step
    """
    output_tokens = []

    while not done:
        # Step 1: Draft model generates gamma candidate tokens (fast, sequential)
        draft_tokens = []
        draft_probs = []
        for _ in range(gamma):
            token, prob = draft_model.generate_next(prompt + output_tokens + draft_tokens)
            draft_tokens.append(token)
            draft_probs.append(prob)

        # Step 2: Target model verifies ALL gamma tokens in ONE forward pass (parallel)
        target_probs = target_model.forward(prompt + output_tokens + draft_tokens)

        # Step 3: Accept/reject each draft token
        accepted = 0
        for i in range(gamma):
            # Accept with probability min(1, target_prob / draft_prob)
            r = random.random()
            if r < min(1.0, target_probs[i][draft_tokens[i]] / draft_probs[i]):
                output_tokens.append(draft_tokens[i])
                accepted += 1
            else:
                # Reject: sample from adjusted distribution and stop
                adjusted_dist = max(0, target_probs[i] - draft_probs[i])
                adjusted_dist = adjusted_dist / adjusted_dist.sum()
                output_tokens.append(sample(adjusted_dist))
                break

        # If all gamma tokens accepted, sample one more from target
        if accepted == gamma:
            output_tokens.append(sample(target_probs[gamma]))

    return output_tokens
```

**Key property:** The output distribution is **mathematically identical** to the target model alone. Speculative decoding is lossless — it's a pure speed optimization.

**Speedup depends on:**
- **Acceptance rate**: How well the draft model approximates the target (typically 70-90% for good draft models)
- **Draft model speed**: Smaller draft = faster speculation
- **γ (speculation length)**: Optimal γ balances acceptance rate vs overhead

**Production implementations:**
- **Medusa**: Adds multiple prediction heads to the target model itself (no separate draft model)
- **EAGLE**: Uses the target model's hidden states to predict future tokens
- **Lookahead decoding**: Uses Jacobi iteration instead of a draft model

**Why interviewer asks this:** Tests deep understanding of inference optimization. This is cutting-edge production knowledge — most teams deploying LLMs at scale use some form of speculative decoding.

**Follow-up:** When would speculative decoding provide minimal benefit, and what are the memory overhead implications?

---

### Q8. 🔴 Explain model parallelism strategies: tensor, pipeline, and data parallelism.

**Answer:**

Training and serving large models requires distributing computation across multiple GPUs. The three main strategies address different bottlenecks:

**Data Parallelism (DP):**
```
GPU 0: Full model copy → processes batch 0 → compute gradients → all-reduce
GPU 1: Full model copy → processes batch 1 → compute gradients → all-reduce
GPU 2: Full model copy → processes batch 2 → compute gradients → all-reduce
GPU 3: Full model copy → processes batch 3 → compute gradients → all-reduce
                                                                    ↓
                                                     Average gradients → update all copies
```
- **When**: Model fits on one GPU, want faster training via larger effective batch size
- **Limitation**: Every GPU must hold the entire model
- **Variant**: ZeRO (Zero Redundancy Optimizer) — partitions optimizer states, gradients, and parameters across GPUs

**Tensor Parallelism (TP):**
```
Single layer split across GPUs:
┌─────────────────────────────────────────────────┐
│              Linear Layer (d_model × 4*d_model)  │
│                                                   │
│  GPU 0: W[:, 0:d]     GPU 1: W[:, d:2d]          │
│  GPU 2: W[:, 2d:3d]   GPU 3: W[:, 3d:4d]         │
│                                                   │
│  Each GPU computes partial output → AllReduce     │
└─────────────────────────────────────────────────┘
```
- **When**: Individual layers are too large for one GPU
- **Requires**: High-bandwidth interconnect (NVLink, InfiniBand) because communication happens within each layer
- **Used in**: Megatron-LM

**Pipeline Parallelism (PP):**
```
GPU 0: Layers 0-19   → GPU 1: Layers 20-39  → GPU 2: Layers 40-59  → GPU 3: Layers 60-79
     ↓ activations          ↓ activations          ↓ activations          ↓ output

Micro-batching to reduce "pipeline bubble":
Time →
GPU 0: [μ0][μ1][μ2][μ3][  ][  ][  ][  ]
GPU 1: [  ][μ0][μ1][μ2][μ3][  ][  ][  ]
GPU 2: [  ][  ][μ0][μ1][μ2][μ3][  ][  ]
GPU 3: [  ][  ][  ][μ0][μ1][μ2][μ3][  ]
```
- **When**: Model is too large for one GPU but you want minimal inter-GPU communication
- **Issue**: Pipeline "bubble" — GPUs idle while waiting for data
- **Optimization**: Micro-batching reduces bubble time

**Combined strategy (what large models actually use):**

```
GPT-3 175B training:
- 8-way Tensor Parallelism (within a node, using NVLink)
- 64-way Data Parallelism (across nodes)
- Pipeline Parallelism where needed

LLaMA-70B serving:
- 8-way Tensor Parallelism across 8× A100 GPUs
- OR 4-way TP + 2-way PP
```

**Why interviewer asks this:** Essential for anyone working on LLM infrastructure. Shows you understand the hardware constraints that shape production AI systems.

**Follow-up:** What is the "pipeline bubble" problem and how does interleaved scheduling (1F1B) mitigate it?

---

### Q9. 🟡 What is quantization, and what are the trade-offs of INT8 vs INT4 vs FP16?

**Answer:**

Quantization reduces the numerical precision of model weights (and optionally activations) to decrease memory usage and improve inference speed.

```
FP32: ████████████████████████████████  (32 bits) — Full precision
FP16: ████████████████                  (16 bits) — Half precision
INT8: ████████                          (8 bits)  — 4× compression vs FP32
INT4: ████                              (4 bits)  — 8× compression vs FP32
```

**Quantization methods:**

| Method | Approach | Quality Impact |
|--------|----------|---------------|
| **Post-Training Quantization (PTQ)** | Quantize after training, no retraining | Slight quality loss, fast to apply |
| **GPTQ** | One-shot weight quantization using calibration data | Good quality at INT4 |
| **AWQ (Activation-Aware)** | Protect "salient" weights (high activation channels) | Better quality than GPTQ at same bit width |
| **QLoRA** | Quantized base model + LoRA adapters for fine-tuning | Train in 4-bit, near FP16 quality |
| **GGUF (llama.cpp)** | Optimized quantization format for CPU inference | Enables LLMs on consumer hardware |

**Practical comparison (LLaMA-70B):**

| Format | Memory | Speed (tokens/s) | Quality (MMLU) |
|--------|--------|-------------------|-----------------|
| FP16 | 140 GB | Baseline | 79.3% |
| INT8 | 70 GB | 1.5-2× faster | 79.1% (−0.2%) |
| INT4 (GPTQ) | 35 GB | 2-3× faster | 77.8% (−1.5%) |
| INT4 (AWQ) | 35 GB | 2-3× faster | 78.5% (−0.8%) |
| 2-bit | 17.5 GB | 3-4× faster | 71.2% (−8.1%) — significant degradation |

```python
# Loading a quantized model with transformers
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

# INT4 quantization with bitsandbytes
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # Normalized Float 4-bit
    bnb_4bit_compute_dtype=torch.float16,  # Compute in FP16
    bnb_4bit_use_double_quant=True,        # Quantize the quantization constants
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B-Instruct",
    quantization_config=quantization_config,
    device_map="auto",  # Automatically distribute across available GPUs
)
# 70B model now fits on 2× A100 40GB instead of 4× A100 80GB
```

**Why interviewer asks this:** Quantization is the primary tool for making LLMs deployable in resource-constrained environments. Every production team must make quantization decisions.

**Follow-up:** What is the "outlier feature" problem in LLM quantization and how does LLM.int8() handle it?

---

### Q10. 🔴 Explain LoRA and QLoRA. How do they enable efficient fine-tuning?

**Answer:**

**LoRA (Low-Rank Adaptation)** freezes the pre-trained model and injects trainable low-rank decomposition matrices into each transformer layer.

**Core idea:** Weight updates during fine-tuning have low "intrinsic rank" — you don't need to update all parameters.

```
Original: Y = Wx         (W is d×d, e.g., 4096×4096 = 16.7M params)
LoRA:     Y = Wx + BAx   (B is d×r, A is r×d, where r << d)

If r = 16: B is 4096×16, A is 16×4096 = 131K params (0.8% of original)
```

```python
# LoRA implementation concept
class LoRALinear(nn.Module):
    def __init__(self, original_linear, rank=16, alpha=32):
        super().__init__()
        self.original = original_linear  # Frozen
        self.original.weight.requires_grad = False

        d_in = original_linear.in_features
        d_out = original_linear.out_features

        # Low-rank matrices (trainable)
        self.lora_A = nn.Parameter(torch.randn(rank, d_in) * 0.01)
        self.lora_B = nn.Parameter(torch.zeros(d_out, rank))
        self.scaling = alpha / rank

    def forward(self, x):
        # Original path (frozen) + LoRA path (trainable)
        original_output = self.original(x)
        lora_output = (x @ self.lora_A.T @ self.lora_B.T) * self.scaling
        return original_output + lora_output
```

**QLoRA** combines LoRA with 4-bit quantization:
1. Quantize the base model to 4-bit (NF4 — NormalFloat 4-bit)
2. Keep LoRA adapters in FP16 (full precision for training stability)
3. Use double quantization (quantize the quantization constants)
4. Use paged optimizers to handle memory spikes

```
Memory comparison for fine-tuning LLaMA-70B:
Full fine-tuning:  ~1120 GB (16× A100 80GB)
LoRA (FP16):       ~160 GB  (2× A100 80GB)
QLoRA (4-bit):     ~48 GB   (1× A100 80GB)  ← Fine-tune a 70B model on ONE GPU
```

**Practical fine-tuning with QLoRA:**

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, BitsAndBytesConfig, TrainingArguments
from trl import SFTTrainer

# Load 4-bit quantized model
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    ),
    device_map="auto",
)

model = prepare_model_for_kbit_training(model)

# Configure LoRA
lora_config = LoraConfig(
    r=64,                          # Rank — higher = more capacity, more memory
    lora_alpha=128,                # Scaling factor (typically 2×r)
    target_modules=[               # Which layers to add LoRA to
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj",       # FFN
    ],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 83,886,080 || all params: 8,113,311,744 || trainable%: 1.034%

# Train
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    args=TrainingArguments(
        output_dir="./qlora-output",
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        num_train_epochs=3,
        bf16=True,
        logging_steps=10,
    ),
    max_seq_length=2048,
)
trainer.train()
```

**Why interviewer asks this:** LoRA/QLoRA is the standard approach for customizing LLMs. Tests whether you can fine-tune models efficiently in practice.

**Follow-up:** How do you choose the rank `r` and which modules to apply LoRA to? What happens if the rank is too low?

---

## Coding Questions

### Q11. 🟢 Write a token counter that estimates cost for different LLM providers.

```python
import tiktoken
from dataclasses import dataclass


@dataclass
class ModelPricing:
    name: str
    input_cost_per_1k: float   # $ per 1K input tokens
    output_cost_per_1k: float  # $ per 1K output tokens
    context_window: int


# Pricing as of 2025 (check provider docs for current rates)
MODELS = {
    "gpt-4o": ModelPricing("gpt-4o", 0.0025, 0.01, 128_000),
    "gpt-4o-mini": ModelPricing("gpt-4o-mini", 0.00015, 0.0006, 128_000),
    "claude-sonnet-4": ModelPricing("claude-sonnet-4", 0.003, 0.015, 200_000),
    "claude-haiku-3.5": ModelPricing("claude-haiku-3.5", 0.0008, 0.004, 200_000),
}


def count_tokens(text: str, encoding_name: str = "cl100k_base") -> int:
    """Count tokens using tiktoken (GPT-compatible tokenizer)."""
    enc = tiktoken.get_encoding(encoding_name)
    return len(enc.encode(text))


def estimate_cost(
    input_text: str,
    estimated_output_tokens: int = 500,
    model_key: str = "gpt-4o",
) -> dict:
    """Estimate the cost of an LLM API call."""
    model = MODELS[model_key]
    input_tokens = count_tokens(input_text)

    if input_tokens > model.context_window:
        raise ValueError(
            f"Input ({input_tokens} tokens) exceeds {model.name} "
            f"context window ({model.context_window} tokens)"
        )

    input_cost = (input_tokens / 1000) * model.input_cost_per_1k
    output_cost = (estimated_output_tokens / 1000) * model.output_cost_per_1k

    return {
        "model": model.name,
        "input_tokens": input_tokens,
        "estimated_output_tokens": estimated_output_tokens,
        "input_cost": f"${input_cost:.6f}",
        "output_cost": f"${output_cost:.6f}",
        "total_cost": f"${input_cost + output_cost:.6f}",
        "context_utilization": f"{input_tokens / model.context_window * 100:.1f}%",
    }


def compare_costs(input_text: str, output_tokens: int = 500) -> None:
    """Compare costs across all models."""
    print(f"Input: {count_tokens(input_text)} tokens | Output: {output_tokens} tokens\n")
    print(f"{'Model':<20} {'Input Cost':>12} {'Output Cost':>12} {'Total':>12}")
    print("-" * 58)

    for key in MODELS:
        result = estimate_cost(input_text, output_tokens, key)
        print(f"{result['model']:<20} {result['input_cost']:>12} "
              f"{result['output_cost']:>12} {result['total_cost']:>12}")


# Usage
document = open("large_document.txt").read()  # Imagine a 50-page document
compare_costs(document, output_tokens=2000)
```

**Why interviewer asks this:** Cost estimation is a daily concern in production AI. Shows you think about operational costs, not just model capability.

**Follow-up:** How would you modify this to handle streaming responses where you don't know output length in advance?

---

### Q12. 🟡 Implement a simple temperature and top-p sampling function.

```python
import numpy as np
from typing import Optional


def sample_next_token(
    logits: np.ndarray,
    temperature: float = 1.0,
    top_p: float = 1.0,
    top_k: Optional[int] = None,
) -> int:
    """
    Sample next token from logits using temperature, top-k, and top-p (nucleus) sampling.

    Args:
        logits: Raw model output scores (before softmax), shape (vocab_size,)
        temperature: Controls randomness. 0 = greedy, 1 = neutral, >1 = more random
        top_p: Nucleus sampling threshold. Keep smallest set of tokens with cumulative prob >= top_p
        top_k: Keep only top-k highest probability tokens
    """
    # Temperature scaling
    if temperature == 0:
        return int(np.argmax(logits))  # Greedy decoding

    logits = logits / temperature

    # Convert to probabilities
    exp_logits = np.exp(logits - np.max(logits))  # Subtract max for numerical stability
    probs = exp_logits / exp_logits.sum()

    # Top-K filtering
    if top_k is not None and top_k > 0:
        top_k_indices = np.argsort(probs)[-top_k:]
        mask = np.zeros_like(probs, dtype=bool)
        mask[top_k_indices] = True
        probs[~mask] = 0
        probs = probs / probs.sum()  # Renormalize

    # Top-P (nucleus) filtering
    if top_p < 1.0:
        sorted_indices = np.argsort(probs)[::-1]  # Descending
        sorted_probs = probs[sorted_indices]
        cumulative_probs = np.cumsum(sorted_probs)

        # Find cutoff index: smallest set where cumsum >= top_p
        cutoff_idx = np.searchsorted(cumulative_probs, top_p) + 1

        # Zero out tokens below the cutoff
        allowed_indices = set(sorted_indices[:cutoff_idx])
        for i in range(len(probs)):
            if i not in allowed_indices:
                probs[i] = 0
        probs = probs / probs.sum()  # Renormalize

    return int(np.random.choice(len(probs), p=probs))


# Demonstrate different sampling strategies
vocab = ["the", "a", "cat", "dog", "sat", "ran", "on", "mat", "floor", "quickly"]
logits = np.array([2.5, 1.8, 3.1, 2.9, 0.5, 0.3, 1.2, 0.8, 0.6, 0.1])

print("Greedy (temperature=0):")
for _ in range(5):
    idx = sample_next_token(logits, temperature=0)
    print(f"  → {vocab[idx]}")  # Always "cat" (highest logit)

print("\nLow temperature (0.3) — more focused:")
for _ in range(5):
    idx = sample_next_token(logits, temperature=0.3)
    print(f"  → {vocab[idx]}")  # Usually "cat" or "dog"

print("\nHigh temperature (1.5) — more creative:")
for _ in range(5):
    idx = sample_next_token(logits, temperature=1.5)
    print(f"  → {vocab[idx]}")  # More varied outputs

print("\nNucleus sampling (top_p=0.9):")
for _ in range(5):
    idx = sample_next_token(logits, temperature=1.0, top_p=0.9)
    print(f"  → {vocab[idx]}")  # Dynamic vocabulary based on probability mass
```

**Why interviewer asks this:** Tests understanding of how models generate text. Critical for tuning generation quality in production.

**Follow-up:** Why is `temperature=0` not truly "deterministic" in practice, and what does that mean for reproducibility?

---

### Q13. 🔴 Build a simple LLM inference server with batching and streaming.

```python
import asyncio
import time
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import AsyncGenerator
from collections import deque
import uuid

app = FastAPI()


class GenerationRequest(BaseModel):
    prompt: str
    max_tokens: int = 256
    temperature: float = 0.7
    stream: bool = False


class RequestItem:
    def __init__(self, request: GenerationRequest):
        self.id = str(uuid.uuid4())
        self.request = request
        self.output_queue: asyncio.Queue = asyncio.Queue()
        self.created_at = time.time()


class BatchingInferenceEngine:
    """
    Continuous batching engine that groups incoming requests
    and processes them together for GPU efficiency.
    """

    def __init__(self, max_batch_size: int = 8, max_wait_ms: float = 50):
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.pending_queue: deque[RequestItem] = deque()
        self.active_requests: dict[str, RequestItem] = {}
        self._running = False

    async def start(self):
        """Start the continuous batching loop."""
        self._running = True
        asyncio.create_task(self._batching_loop())

    async def submit(self, request: GenerationRequest) -> RequestItem:
        """Submit a request to the batching queue."""
        item = RequestItem(request)
        self.pending_queue.append(item)
        return item

    async def _batching_loop(self):
        """Main loop: collect requests into batches, process them."""
        while self._running:
            # Wait for at least one request
            while not self.pending_queue:
                await asyncio.sleep(0.001)

            # Collect batch (wait up to max_wait_ms for more requests)
            batch: list[RequestItem] = []
            deadline = time.time() + self.max_wait_ms / 1000

            while len(batch) < self.max_batch_size and time.time() < deadline:
                if self.pending_queue:
                    batch.append(self.pending_queue.popleft())
                else:
                    await asyncio.sleep(0.001)

            if batch:
                await self._process_batch(batch)

    async def _process_batch(self, batch: list[RequestItem]):
        """
        Process a batch of requests together.
        In production, this would call the actual model with batched inputs.
        Here we simulate token-by-token generation.
        """
        prompts = [item.request.prompt for item in batch]
        max_tokens = max(item.request.max_tokens for item in batch)

        print(f"Processing batch of {len(batch)} requests")

        # Simulate batched generation (in production: model.generate(batched_inputs))
        for step in range(max_tokens):
            for item in batch:
                if step < item.request.max_tokens:
                    # Simulate token generation (replace with actual model inference)
                    token = f"token_{step} "
                    await item.output_queue.put(token)

            # Simulate model inference time per step
            await asyncio.sleep(0.02)

        # Signal completion
        for item in batch:
            await item.output_queue.put(None)


engine = BatchingInferenceEngine(max_batch_size=8, max_wait_ms=50)


@app.on_event("startup")
async def startup():
    await engine.start()


@app.post("/generate")
async def generate(request: GenerationRequest):
    item = await engine.submit(request)

    if request.stream:
        return StreamingResponse(
            _stream_response(item),
            media_type="text/event-stream",
        )
    else:
        # Collect all tokens
        tokens = []
        while True:
            token = await item.output_queue.get()
            if token is None:
                break
            tokens.append(token)

        return {
            "id": item.id,
            "text": "".join(tokens),
            "usage": {"prompt_tokens": len(request.prompt.split()), "completion_tokens": len(tokens)},
        }


async def _stream_response(item: RequestItem) -> AsyncGenerator[str, None]:
    """Stream tokens as Server-Sent Events."""
    while True:
        token = await item.output_queue.get()
        if token is None:
            yield f"data: [DONE]\n\n"
            break
        yield f"data: {token}\n\n"


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "pending_requests": len(engine.pending_queue),
        "engine_running": engine._running,
    }
```

**Why interviewer asks this:** Tests system design for LLM serving. Continuous batching is how vLLM, TGI, and TensorRT-LLM achieve high throughput.

**Follow-up:** How would you implement continuous batching (adding/removing requests mid-batch) vs. static batching?

---

## Debugging Scenarios

### Q14. 🟡 Debug: Why is this model generating repetitive text?

```python
# Bug: The model keeps generating "The cat sat on the mat. The cat sat on the mat. The cat..."
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("gpt2")
tokenizer = AutoTokenizer.from_pretrained("gpt2")

input_text = "Once upon a time"
input_ids = tokenizer.encode(input_text, return_tensors="pt")

# THIS CODE HAS BUGS — find them
output = model.generate(
    input_ids,
    max_length=200,
    temperature=1.0,
    do_sample=False,  # Bug 1: Greedy decoding causes repetition loops
    # Bug 2: No repetition penalty
    # Bug 3: No no_repeat_ngram_size
)

print(tokenizer.decode(output[0]))
```

**Answer:**

Three issues cause repetitive generation:

1. **`do_sample=False`** — Greedy decoding always picks the highest probability token. If the model enters a loop ("The cat sat on the mat"), it will never escape because the same tokens always have the highest probability given the same context.

2. **No repetition penalty** — Without `repetition_penalty`, previously generated tokens maintain their original probability.

3. **No n-gram blocking** — Without `no_repeat_ngram_size`, the model can repeat any n-gram.

**Fix:**

```python
output = model.generate(
    input_ids,
    max_length=200,
    do_sample=True,                # Enable sampling
    temperature=0.8,               # Slight randomness
    top_p=0.95,                    # Nucleus sampling
    repetition_penalty=1.2,        # Penalize repeated tokens
    no_repeat_ngram_size=3,        # Never repeat 3-grams
)
```

**Deeper explanation:** Repetition is a fundamental failure mode of autoregressive models. The model's next-token distribution is conditioned on all previous tokens. If context drifts into a repetitive pattern, the conditional distribution *reinforces* that pattern — creating a feedback loop. Sampling and repetition penalties break this cycle.

**Why interviewer asks this:** Repetitive generation is the #1 complaint in production LLM deployments. Tests practical debugging skills.

**Follow-up:** What's the difference between `repetition_penalty` and `frequency_penalty`? When would you use each?

---

### Q15. 🔴 Debug: Why does this model use 2× expected memory?

```python
import torch
from transformers import AutoModelForCausalLM

# Expected: 7B params × 2 bytes (FP16) = 14 GB
# Actual: Using ~28 GB — why?

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    # No dtype specified — BUG
    device_map="auto",
)
```

**Answer:**

The model is loading in **FP32 (4 bytes per parameter)** instead of FP16, because `torch_dtype` was not specified. By default, `from_pretrained` uses the dtype from the model config, which for many models defaults to FP32.

```
8B params × 4 bytes (FP32) = 32 GB
8B params × 2 bytes (FP16) = 16 GB
```

**Fix:**

```python
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    torch_dtype=torch.float16,  # or torch.bfloat16 for better training stability
    device_map="auto",
)
```

**Additional memory considerations:**
- **KV cache** adds memory during inference (proportional to batch size × sequence length)
- **Optimizer states** during training add 2-3× parameter memory (Adam stores mean + variance)
- **Gradient checkpointing** trades compute for memory (recompute activations during backward pass)

**Why interviewer asks this:** Memory management is critical for GPU utilization. A common production mistake that wastes expensive GPU resources.

**Follow-up:** When should you use BF16 vs FP16, and why is BF16 preferred for training?

---

## Output-Based Questions

### Q16. 🟢 What is the output of this tokenization code?

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

texts = [
    "Hello",
    "hello",
    " Hello",     # Note: leading space
    "Hello!",
    "HelloWorld",
]

for text in texts:
    tokens = enc.encode(text)
    decoded = [enc.decode([t]) for t in tokens]
    print(f"{text!r:15} → {len(tokens)} tokens → {decoded}")
```

**Expected Output:**
```
'Hello'         → 1 tokens → ['Hello']
'hello'         → 1 tokens → ['hello']
' Hello'        → 1 tokens → [' Hello']        # Leading space is part of the token!
'Hello!'        → 2 tokens → ['Hello', '!']
'HelloWorld'    → 2 tokens → ['Hello', 'World']  # CamelCase splits
```

**Key insight:** Tokenizers treat leading spaces as part of the token. `"Hello"` and `" Hello"` are different tokens. This matters when constructing prompts programmatically — extra spaces can change tokenization and model behavior.

---

### Q17. 🟡 What happens when you exceed the context window?

```python
from openai import OpenAI
client = OpenAI()

# GPT-4o-mini has a 128K token context window
# What happens with this call?
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "x " * 200_000},  # ~200K tokens
    ],
    max_tokens=100,
)
```

**Answer:** The API returns a **400 error** with a message like:
```
openai.BadRequestError: This model's maximum context length is 128000 tokens.
However, your messages resulted in 200005 tokens.
Please reduce the length of the messages.
```

The API will **not** silently truncate your input. It fails explicitly. This is why production systems need token counting *before* making API calls.

**Production fix:**

```python
def safe_api_call(messages, model="gpt-4o-mini", max_context=128_000, max_tokens=100):
    """Truncate messages to fit within context window."""
    total_tokens = count_message_tokens(messages)

    if total_tokens + max_tokens > max_context:
        # Strategy: truncate oldest user messages, keep system prompt
        messages = truncate_messages(messages, max_context - max_tokens)

    return client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )
```

---

## Real-World Case Studies

### Q18. 🔴 Case Study: Choosing between fine-tuning and RAG for a customer support bot.

**Scenario:** Your company has 50,000 customer support tickets with resolutions. You need to build an AI assistant that helps support agents respond to tickets. The knowledge base changes weekly with new product updates.

**Analysis:**

| Factor | Fine-Tuning | RAG | Verdict |
|--------|------------|-----|---------|
| **Frequently changing knowledge** | Requires retraining (expensive, slow) | Update vector store, instant effect | RAG ✅ |
| **Response style/tone** | Excellent at learning company voice | Depends on prompt engineering | Fine-tuning ✅ |
| **Hallucination risk** | Can hallucinate outdated info | Grounded in retrieved documents | RAG ✅ |
| **Source attribution** | Cannot cite sources | Can return source documents | RAG ✅ |
| **Latency** | Single model call (~200ms) | Retrieval + generation (~500-800ms) | Fine-tuning ✅ |
| **Cost at scale** | Fixed (per token generation only) | Retrieval infra + generation | Fine-tuning ✅ |

**Recommended approach: RAG + Light Fine-Tuning**

1. **RAG** for knowledge retrieval — weekly-updated knowledge base of product docs and past resolutions
2. **Fine-tune** (LoRA) for tone/style — train on 5,000 best-rated support responses to match company voice
3. **Evaluation pipeline** — automated checks for accuracy, tone, and hallucination

```python
# Architecture sketch
class SupportAssistant:
    def __init__(self):
        self.retriever = VectorStore("support-knowledge-base")
        self.llm = FineTunedLLM("company-support-lora-adapter")

    async def respond(self, ticket: str) -> SupportResponse:
        # Retrieve relevant past tickets and product docs
        context = await self.retriever.search(ticket, top_k=5)

        # Generate response using fine-tuned model with retrieved context
        response = await self.llm.generate(
            system="You are a customer support agent for Acme Corp...",
            context=format_context(context),
            query=ticket,
        )

        return SupportResponse(
            answer=response.text,
            sources=[doc.metadata for doc in context],
            confidence=response.confidence,
        )
```

**Why interviewer asks this:** Tests ability to make architectural decisions with real-world trade-offs. No single answer is correct — the reasoning matters.

**Follow-up:** How would you handle the case where the knowledge base has contradictory information from different time periods?

---

### Q19. 🔴 Case Study: Why did our LLM costs spike 10× this month?

**Scenario:** Your production AI system's monthly OpenAI bill went from $5K to $50K. The number of users didn't change significantly. Find the root cause.

**Investigation checklist:**

```python
# 1. Check token usage patterns
def analyze_usage(logs: list[APICallLog]) -> dict:
    daily_tokens = defaultdict(lambda: {"input": 0, "output": 0, "calls": 0})

    for log in logs:
        day = log.timestamp.date()
        daily_tokens[day]["input"] += log.input_tokens
        daily_tokens[day]["output"] += log.output_tokens
        daily_tokens[day]["calls"] += 1

    return daily_tokens

# 2. Find outlier requests
def find_outliers(logs: list[APICallLog], threshold_tokens: int = 50_000):
    """Find requests that are consuming abnormally high tokens."""
    outliers = [
        log for log in logs
        if log.input_tokens + log.output_tokens > threshold_tokens
    ]
    return sorted(outliers, key=lambda x: x.total_tokens, reverse=True)
```

**Common root causes:**

1. **Retry storms**: Failed requests being retried without backoff, paying for input tokens each retry
2. **Missing context truncation**: New feature sends entire conversation history (growing unbounded) instead of recent messages
3. **RAG over-retrieval**: Retrieving 20 chunks instead of 5, stuffing context with 15K tokens per query
4. **Model upgrade**: Someone changed `gpt-4o-mini` to `gpt-4o` (6× price difference) in a config file
5. **Runaway agents**: Agentic loop without max iteration limits, making 50+ LLM calls per user request
6. **Prompt bloat**: A "helpful" prompt template that grew from 200 to 2,000 tokens over time

**Prevention:**

```python
# Cost guardrails
class CostGuard:
    def __init__(self, daily_limit_usd: float = 500, per_request_limit_tokens: int = 100_000):
        self.daily_limit = daily_limit_usd
        self.per_request_limit = per_request_limit_tokens
        self.daily_spend = 0.0

    def check(self, estimated_tokens: int, model: str) -> bool:
        estimated_cost = self._estimate_cost(estimated_tokens, model)

        if estimated_tokens > self.per_request_limit:
            raise TokenLimitExceeded(f"Request would use {estimated_tokens} tokens")

        if self.daily_spend + estimated_cost > self.daily_limit:
            raise DailyBudgetExceeded(f"Daily limit ${self.daily_limit} would be exceeded")

        return True
```

**Why interviewer asks this:** Tests operational awareness. Building AI systems isn't just about models — it's about running them reliably at acceptable cost.

**Follow-up:** Design a cost monitoring and alerting system for a production LLM application.
