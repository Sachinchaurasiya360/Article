# Transformer Deep Dive — Part 1: The Architecture — Inside the Transformer

---

**Series:** Transformers — From "Attention Is All You Need" to the Age of Large Language Models
**Part:** 1 of 2
**Audience:** Developers, ML engineers, AI researchers, and students who know basic neural networks but want to deeply understand the internal mechanics of the Transformer architecture
**Prerequisites:** Part 0 of this series (self-attention, multi-head attention, positional encoding)
**Reading time:** ~65 minutes

---

## Table of Contents

1. [The Encoder Stack](#1-the-encoder-stack)
2. [The Decoder Stack](#2-the-decoder-stack)
3. [Full Architecture Walkthrough: From Input Text to Output Text](#3-full-architecture-walkthrough-from-input-text-to-output-text)
4. [The Training Process](#4-the-training-process)
5. [Complexity Analysis: Transformer vs RNN vs LSTM](#5-complexity-analysis-transformer-vs-rnn-vs-lstm)
6. [Limitations of the Original Transformer](#6-limitations-of-the-original-transformer)
7. [Practical Section: Building a Transformer in PyTorch](#7-practical-section-building-a-transformer-in-pytorch)
8. [Related Concepts Glossary](#8-related-concepts-glossary)
9. [Visual Explanations: Understanding Matrix Dimensions](#9-visual-explanations-understanding-matrix-dimensions)
10. [Conclusion: Why This Paper Mattered](#10-conclusion-why-this-paper-mattered)

---

## 1. The Encoder Stack

The Transformer's encoder converts an input sequence into a rich, contextualized representation. In the original paper, the encoder consists of N = 6 identical layers stacked on top of each other. Each layer has two sub-layers:

1. **Multi-head self-attention**
2. **Position-wise feed-forward network**

Both sub-layers are wrapped with a **residual connection** and followed by **layer normalization**.

Let's break down each component.

### 1.1 The Encoder Block

A single encoder block looks like this:

```
Input (n × d_model)
    ↓
[Multi-Head Self-Attention]
    ↓
[Add & Norm]  ← residual connection + layer normalization
    ↓
[Feed-Forward Network]
    ↓
[Add & Norm]  ← residual connection + layer normalization
    ↓
Output (n × d_model)
```

The input and output have exactly the same shape: (n × d_model). This is critical — it means you can stack as many encoder blocks as you want, because the output of one block is a valid input to the next block.

### 1.2 Multi-Head Self-Attention (Recap)

We covered this in detail in Part 0. In the encoder, every token attends to every other token in the input sequence. There is no masking — every position can see every other position. This is **bidirectional attention**: token 0 can see token 99, and token 99 can see token 0.

For a sequence of length n with h = 8 heads and d_model = 512:
- Input: (n × 512)
- Q, K, V per head: (n × 64)
- Attention per head: (n × 64)
- Concatenated: (n × 512)
- After output projection: (n × 512)

### 1.3 Feed-Forward Network (FFN)

After the attention sub-layer, each token's representation passes through a position-wise feed-forward network. "Position-wise" means the same FFN is applied independently to each token. There is no interaction between tokens in this sub-layer — all inter-token communication happens in the attention layer.

The FFN consists of two linear transformations with a ReLU activation in between:

```
FFN(x) = max(0, x · W_1 + b_1) · W_2 + b_2
```

Where:
- W_1 has shape (d_model × d_ff) = (512 × 2048) — expands the dimension by 4x
- W_2 has shape (d_ff × d_model) = (2048 × 512) — projects back to the original dimension
- d_ff = 2048 in the original paper (4 times d_model)

**Why expand and contract?** The FFN is where the model does its "thinking" about individual tokens. The expansion to 4x the dimension creates a larger representation space where the model can perform complex non-linear transformations. The contraction back to d_model ensures the output shape matches the input shape for residual connections and further stacking.

**An analogy:** Self-attention is like a team meeting — all the tokens exchange information with each other. The FFN is like individual work time — each token goes back to its desk and processes what it learned in the meeting, in its own private workspace (the expanded 2048-dimensional space), then writes a summary (projecting back to 512 dimensions) to bring to the next meeting.

**Parameter count for one FFN:**
```
W_1: 512 × 2048 = 1,048,576
b_1: 2048
W_2: 2048 × 512 = 1,048,576
b_2: 512
Total: ~2.1M parameters
```

This is actually more parameters than the multi-head attention layer (~1M). The FFN is the larger component in each encoder block.

### 1.4 Residual Connections

Every sub-layer (attention and FFN) is wrapped with a residual connection:

```
output = LayerNorm(x + SubLayer(x))
```

Where x is the input to the sub-layer and SubLayer(x) is the sub-layer's output.

**Why residual connections?** They solve the degradation problem that plagues deep networks. As you stack more layers, the network should theoretically get more powerful. But in practice, very deep networks without residual connections often perform worse than shallower ones because gradients vanish or the optimization landscape becomes too complex.

Residual connections provide a "skip path" that allows gradients to flow directly through the network without being transformed by every layer. Even if a sub-layer learns nothing useful, the residual connection ensures the output is at least as good as the input (it just passes through unchanged).

Mathematically, during backpropagation:

```
∂L/∂x = ∂L/∂output * (1 + ∂SubLayer(x)/∂x)
```

The "1" term means the gradient is always at least 1 in magnitude — it never vanishes through this connection. This makes it possible to train networks with dozens or hundreds of layers.

### 1.5 Layer Normalization

After each residual connection, layer normalization is applied. Layer norm normalizes the activations across the feature dimension (not the batch dimension like batch norm):

```
LayerNorm(x) = γ * (x - μ) / (σ + ε) + β
```

Where:
- μ is the mean across the d_model dimensions for each token
- σ is the standard deviation across the d_model dimensions for each token
- γ and β are learned scale and shift parameters (each of size d_model)
- ε is a small constant (e.g., 1e-6) for numerical stability

**Why layer norm instead of batch norm?**

Batch normalization normalizes across the batch dimension — it computes statistics across all examples in a mini-batch for each feature. This works well for images (where features are spatial positions), but is problematic for sequences because:

1. Sequences have variable length. Batch statistics would be computed across different positions in different sequences, which is meaningless.
2. At inference time with batch size 1, batch norm has no batch to compute statistics over (it falls back on running averages from training, which may not match).

Layer normalization normalizes across the feature dimension for each token independently. It does not depend on the batch size or other examples. Each token is normalized using only its own features.

**What layer norm does intuitively:** It prevents the internal representations from drifting to extreme values as they pass through multiple layers. Without normalization, the activations could grow or shrink after each layer, eventually becoming too large (causing numerical overflow) or too small (losing information). Layer norm keeps each token's representation centered at zero with unit variance, then applies a learnable shift and scale.

### 1.6 Why Stacking Multiple Encoder Layers Helps

The original Transformer uses N = 6 encoder layers. Why not 1? Why not 100?

Each encoder layer refines the representation. Think of it as iterative refinement:

**Layer 1:** Captures local patterns. Tokens learn about their immediate neighbors. "New" learns it is adjacent to "York." Simple syntactic patterns emerge.

**Layer 2:** Builds on Layer 1's output. Now tokens have some context, so attention patterns become more sophisticated. "New York" is now represented as a phrase, and other tokens can attend to this phrase-level meaning.

**Layer 3:** Higher-level semantic relationships. The model starts to understand clause structure, subject-verb agreement, and prepositional phrase attachment.

**Layers 4–6:** Increasingly abstract representations. Long-range dependencies, discourse structure, sentiment, intent, and other high-level features.

This is analogous to how convolutional neural networks work: early layers detect edges, middle layers detect shapes, and later layers detect objects. In Transformers, early layers capture local syntax, and later layers capture global semantics.

**Why not 100 layers?** Diminishing returns. Each additional layer adds parameters and computation, but the marginal improvement decreases. The original paper found that 6 layers provided a good trade-off for machine translation. Modern LLMs use more layers (GPT-3 has 96, GPT-4 reportedly has over 100) because they tackle more complex tasks and have proportionally more data and compute.

---

## 2. The Decoder Stack

The decoder generates the output sequence one token at a time, using both the encoder's output and the tokens it has already generated. Like the encoder, it consists of N = 6 identical layers, but each decoder layer has **three** sub-layers instead of two:

1. **Masked multi-head self-attention**
2. **Multi-head cross-attention** (attends to the encoder output)
3. **Position-wise feed-forward network**

Each sub-layer is again wrapped with a residual connection and layer normalization.

### 2.1 The Decoder Block

```
Input: previously generated tokens (m × d_model)
    ↓
[Masked Multi-Head Self-Attention]
    ↓
[Add & Norm]
    ↓
[Multi-Head Cross-Attention]  ← Q from decoder, K and V from encoder output
    ↓
[Add & Norm]
    ↓
[Feed-Forward Network]
    ↓
[Add & Norm]
    ↓
Output (m × d_model)
```

### 2.2 Masked Self-Attention: Why the Decoder Cannot See the Future

During training, the decoder receives the entire target sequence at once (for efficiency). But during inference (generation), the decoder produces tokens one at a time: it generates token 1, then uses token 1 to generate token 2, then uses tokens 1 and 2 to generate token 3, and so on.

**The problem:** During training, if the decoder can see the entire target sequence, it could trivially "cheat" by looking at the next token instead of predicting it. This would not teach the model anything useful.

**The solution: masking.** In the decoder's self-attention, we mask out all positions that correspond to future tokens. When computing the attention for position t, the model can only attend to positions 0, 1, ..., t — it cannot attend to positions t+1, t+2, and beyond.

This is implemented by adding a mask to the attention scores before softmax:

```
scores = Q · K^T / sqrt(d_k)
scores = scores + mask    # mask is 0 for allowed positions, -infinity for forbidden positions
weights = softmax(scores)
```

The mask is an upper-triangular matrix of negative infinity values:

```
mask = [[  0, -inf, -inf, -inf, -inf],
        [  0,    0, -inf, -inf, -inf],
        [  0,    0,    0, -inf, -inf],
        [  0,    0,    0,    0, -inf],
        [  0,    0,    0,    0,    0]]
```

When -infinity is added to a score and then passed through softmax, the result is effectively 0 (because exp(-infinity) = 0). This means the model assigns zero attention weight to future positions.

**Why -infinity and not just 0?** If we set the mask to 0 in the score matrix, the model could still attend to those positions (with whatever score the dot product produces). We need the attention weight to be exactly zero, which requires the score to be negative infinity before softmax.

**A concrete example:**

For a 4-token sequence, the attention weight matrix after masking looks like:

```
         token_0  token_1  token_2  token_3
token_0: [1.00,   0.00,    0.00,    0.00  ]   # can only see itself
token_1: [0.40,   0.60,    0.00,    0.00  ]   # can see tokens 0-1
token_2: [0.15,   0.35,    0.50,    0.00  ]   # can see tokens 0-2
token_3: [0.10,   0.20,    0.30,    0.40  ]   # can see tokens 0-3
```

This is called **causal attention** or **autoregressive attention**. It ensures that the prediction for position t depends only on the known outputs at positions less than t. This matches the generation process at inference time, where tokens are produced left to right.

### 2.3 Cross-Attention: Connecting Encoder and Decoder

The second sub-layer in the decoder is **cross-attention** (also called encoder-decoder attention). This is how the decoder accesses information from the input sequence.

In cross-attention:
- **Queries (Q)** come from the decoder's previous sub-layer (the masked self-attention output)
- **Keys (K) and Values (V)** come from the encoder's final output

```
Q = decoder_output · W_Q     # shape: (m × d_k), from the decoder
K = encoder_output · W_K     # shape: (n × d_k), from the encoder
V = encoder_output · W_V     # shape: (n × d_v), from the encoder
```

Where m is the decoder sequence length and n is the encoder sequence length.

The attention matrix has shape (m × n): each decoder position computes attention weights over all encoder positions. This lets the decoder decide which parts of the input are most relevant at each step of output generation.

**Translation example:** When generating the German word "Katze" (cat), the cross-attention weights would be high for the English word "cat" in the encoder output. When generating "saß" (sat), the weights would be high for "sat."

This is the same mechanism as Bahdanau attention from 2014, but implemented within the Transformer's multi-head attention framework.

### 2.4 The FFN and Residual/Norm Layers

The decoder's feed-forward network and residual/layer norm layers are identical to those in the encoder. The FFN operates position-wise (no cross-token interaction), the residual connection adds the input to the sub-layer output, and layer norm normalizes across the feature dimension.

---

## 3. Full Architecture Walkthrough: From Input Text to Output Text

Let's trace the complete flow of the Transformer for a machine translation task: English to German.

**Input:** "The cat sat on the mat"
**Expected output:** "Die Katze saß auf der Matte"

### Step 1: Tokenization

The input text is split into tokens. The original paper used byte-pair encoding (BPE), which splits rare words into subword units while keeping common words intact.

```
"The cat sat on the mat" → ["The", "cat", "sat", "on", "the", "mat"]
```

Each token is mapped to an integer ID from a vocabulary:

```
["The", "cat", "sat", "on", "the", "mat"] → [67, 2891, 1420, 15, 5, 3842]
```

The result is a sequence of integer IDs: `[67, 2891, 1420, 15, 5, 3842]` with n = 6 tokens.

### Step 2: Token Embedding

Each token ID is looked up in an embedding matrix of shape (vocab_size × d_model). This converts each integer into a dense vector of d_model = 512 dimensions.

```
token_ids [67, 2891, 1420, 15, 5, 3842]
    ↓ embedding lookup
embeddings: shape (6 × 512)
```

These embeddings are learned during training. Initially random, they gradually encode semantic information: similar words get similar vectors.

### Step 3: Positional Encoding

Positional encodings are added to the token embeddings:

```
encoder_input = token_embeddings + positional_encodings    # shape: (6 × 512)
```

Now each vector contains both what the token is and where it is in the sequence.

### Step 4: Encoder Processing (6 layers)

The input passes through 6 encoder layers. Each layer applies multi-head self-attention (letting all 6 tokens attend to each other), followed by a feed-forward network, with residual connections and layer norm throughout.

```
encoder_input: (6 × 512)
    ↓ Encoder Layer 1
    ↓ Encoder Layer 2
    ↓ Encoder Layer 3
    ↓ Encoder Layer 4
    ↓ Encoder Layer 5
    ↓ Encoder Layer 6
encoder_output: (6 × 512)
```

The output shape is the same as the input shape. But the vectors are now deeply contextualized — each token's 512-dimensional vector now encodes not just what that token is, but how it relates to every other token in the sentence, through 6 layers of attention and transformation.

### Step 5: Decoder Input (During Training)

During training, the decoder receives the target sequence shifted right by one position, with a special `<SOS>` (start of sequence) token prepended:

```
Target:        ["Die", "Katze", "saß", "auf", "der", "Matte"]
Decoder input: ["<SOS>", "Die", "Katze", "saß", "auf", "der", "Matte"]
```

This shift ensures that the prediction for position t uses the target tokens from positions 0 to t-1 (not the token at position t itself).

The decoder input tokens are embedded and positionally encoded just like the encoder input:

```
decoder_input: (7 × 512)   # 7 tokens including <SOS>
```

### Step 6: Decoder Processing (6 layers)

Each decoder layer applies:

1. **Masked self-attention** over the decoder input (so position t can only see positions 0 to t)
2. **Cross-attention** over the encoder output (so the decoder can access the input)
3. **Feed-forward network**

```
decoder_input: (7 × 512)
    ↓ Decoder Layer 1 (masked self-attn → cross-attn → FFN)
    ↓ Decoder Layer 2
    ↓ Decoder Layer 3
    ↓ Decoder Layer 4
    ↓ Decoder Layer 5
    ↓ Decoder Layer 6
decoder_output: (7 × 512)
```

### Step 7: Linear Layer and Softmax

The decoder output is projected to the vocabulary size and softmax is applied to produce a probability distribution over the entire vocabulary for each position:

```
logits = decoder_output · W_vocab + b_vocab    # shape: (7 × vocab_size)
probabilities = softmax(logits, dim=-1)        # shape: (7 × vocab_size)
```

For each of the 7 positions, we get a probability distribution over all possible next tokens. The model is trained so that:
- Position 0 (after `<SOS>`) has highest probability for "Die"
- Position 1 (after "Die") has highest probability for "Katze"
- Position 2 (after "Katze") has highest probability for "saß"
- ... and so on
- Position 6 (after "Matte") has highest probability for `<EOS>` (end of sequence)

### Step 8: Inference (Generation)

During inference, we do not have the target sequence. The decoder generates tokens one at a time:

```
Step 0: Input <SOS>           → Predict "Die"
Step 1: Input <SOS>, Die      → Predict "Katze"
Step 2: Input <SOS>, Die, Katze → Predict "saß"
...
Step 6: Input <SOS>, Die, Katze, saß, auf, der, Matte → Predict <EOS> → Stop
```

At each step, the model uses all previously generated tokens (through masked self-attention) and the full encoder output (through cross-attention) to predict the next token. The highest-probability token (greedy decoding) or a sampled token (for diversity) is appended to the sequence, and the process repeats.

### Dimension Summary

Here is every tensor shape through the entire forward pass for our example (n=6 encoder tokens, m=7 decoder tokens, d_model=512, d_ff=2048, h=8, d_k=d_v=64, vocab_size=37000):

```
ENCODER:
  Token IDs:                (6,)
  Token embeddings:         (6, 512)
  + Positional encoding:    (6, 512)
  Per encoder layer:
    Q, K, V per head:       (6, 64)      × 8 heads
    Attention scores:       (6, 6)       × 8 heads
    Attention output:       (6, 64)      × 8 heads
    Concatenated:           (6, 512)
    After W_O projection:   (6, 512)
    After residual + norm:  (6, 512)
    FFN hidden:             (6, 2048)
    FFN output:             (6, 512)
    After residual + norm:  (6, 512)
  Encoder output:           (6, 512)

DECODER:
  Token IDs:                (7,)
  Token embeddings:         (7, 512)
  + Positional encoding:    (7, 512)
  Per decoder layer:
    Masked self-attention:
      Q, K, V per head:     (7, 64)      × 8 heads
      Attention scores:     (7, 7)       × 8 heads (masked upper triangle)
      Output:               (7, 512)
    Cross-attention:
      Q from decoder:       (7, 64)      × 8 heads
      K, V from encoder:    (6, 64)      × 8 heads
      Attention scores:     (7, 6)       × 8 heads
      Output:               (7, 512)
    FFN hidden:             (7, 2048)
    FFN output:             (7, 512)
  Decoder output:           (7, 512)

OUTPUT:
  Logits:                   (7, 37000)
  Probabilities:            (7, 37000)
```

---

## 4. The Training Process

Training a Transformer requires several techniques that work together to make optimization stable and efficient.

### 4.1 Teacher Forcing

During training, we do not use the model's own predictions as input to the decoder. Instead, we feed the **ground truth** target sequence (shifted right by one position) regardless of what the model would have predicted.

**Why?** If we used the model's own predictions during training (especially early in training when the model is terrible), errors would compound. A wrong prediction at position 2 would corrupt the input for position 3, leading to another wrong prediction, which would corrupt position 4, and so on. The model would rarely see the correct context, making it nearly impossible to learn.

**Teacher forcing** solves this by always giving the model the correct previous tokens. This ensures each position is predicted from a clean context, producing much stronger learning signals.

**The downside:** Exposure bias. During training, the model always sees ground truth context. During inference, it sees its own (potentially imperfect) predictions. This mismatch can cause cascading errors during generation. Various techniques address this (scheduled sampling, reinforcement learning fine-tuning), but teacher forcing remains the standard training approach.

### 4.2 Cross-Entropy Loss

The loss function for each position is the cross-entropy between the predicted probability distribution and the true next token:

```
loss_t = -log(P(correct_token_t))
```

Where P(correct_token_t) is the model's predicted probability for the correct token at position t. If the model assigns probability 0.95 to the correct token, the loss is -log(0.95) = 0.05 (low). If it assigns probability 0.01, the loss is -log(0.01) = 4.61 (high).

The total loss is the average cross-entropy across all positions and all examples in the mini-batch:

```
total_loss = (1 / (B × T)) * Σ_{b,t} -log(P_b(correct_token_{b,t}))
```

Where B is batch size and T is sequence length.

### 4.3 Masking in Training

Two types of masking are used during training:

**1. Causal mask (decoder self-attention):** Prevents the decoder from attending to future positions. This is the upper-triangular mask discussed in Section 2.2.

**2. Padding mask:** Sequences in a batch are padded to the same length. We need to ensure the model does not attend to padding tokens (which carry no information). Padding positions are masked out by setting their attention scores to -infinity before softmax.

```
Sequence: ["The", "cat", "<PAD>", "<PAD>"]
Mask:     [ 0,     0,     -inf,    -inf  ]
```

### 4.4 Label Smoothing

The original Transformer paper uses label smoothing with ε = 0.1. Instead of training the model to predict probability 1.0 for the correct token and 0.0 for everything else (a "hard" target), the target distribution is softened:

```
Without smoothing: target = [0, 0, ..., 1, ..., 0, 0]    (one-hot)
With smoothing:    target = [ε/V, ε/V, ..., 1-ε, ..., ε/V, ε/V]
```

Where V is the vocabulary size. The correct token gets probability 1 - ε = 0.9, and the remaining probability ε = 0.1 is distributed uniformly across all other tokens.

**Why?** Label smoothing prevents the model from becoming overconfident. Without it, the model tries to drive the correct token's probability to exactly 1.0, which requires logits to approach infinity. This leads to large weight magnitudes, numerical instability, and poor generalization. Label smoothing encourages the model to produce calibrated probabilities and improves translation quality (measured by BLEU score).

### 4.5 Optimizer: Adam with Warmup

The paper uses the Adam optimizer with a custom learning rate schedule that first increases linearly (warmup) and then decreases proportionally to the inverse square root of the step number:

```
lr = d_model^(-0.5) * min(step^(-0.5), step * warmup_steps^(-1.5))
```

With warmup_steps = 4000:

- **Steps 1–4000 (warmup):** Learning rate increases linearly from 0 to peak.
- **Steps 4000+ (decay):** Learning rate decreases as 1/sqrt(step).

**Why warmup?** In the early stages of training, the model parameters are random. The attention patterns are random. The gradients are noisy and potentially large. Using a high learning rate from the start would cause wild, unstable updates. Warmup starts with a tiny learning rate and gradually increases it, giving the model time to stabilize before aggressive optimization begins.

**Why decay?** As training progresses and the model approaches convergence, you want smaller updates to fine-tune the parameters. Decaying the learning rate allows the model to make larger adjustments early and smaller adjustments later.

### 4.6 Training Cost

The original Transformer paper reports training on 8 NVIDIA P100 GPUs:

- **Base model:** 12 hours training, 65M parameters
- **Big model:** 3.5 days training, 213M parameters

By modern standards, these are tiny. GPT-3 (175B parameters) required approximately 3,640 petaflop-days of compute. GPT-4's training cost is estimated at $100M+. But the key insight is that the Transformer architecture made this scaling possible. RNNs could not have been scaled to these sizes because their sequential nature would have made training take years instead of weeks.

### 4.7 Why Large Datasets Are Required

Transformers are data-hungry models. The self-attention mechanism has n² possible attention patterns per layer per head. With 6 layers and 8 heads, there are 48 attention weight matrices to learn per forward pass. The model needs massive amounts of data to learn meaningful attention patterns rather than memorizing the training set.

The original paper trained on the WMT 2014 English-German dataset (4.5 million sentence pairs) and the WMT 2014 English-French dataset (36 million sentence pairs). Modern LLMs train on trillions of tokens scraped from the internet.

Without sufficient data, Transformers overfit catastrophically. This is why pre-training on large corpora followed by fine-tuning on small task-specific datasets became the dominant paradigm — the model learns general language patterns from the large dataset and adapts to specific tasks with the small one.

---

## 5. Complexity Analysis: Transformer vs RNN vs LSTM

Understanding the computational trade-offs is essential for understanding why the Transformer won.

### 5.1 Comparison Table

| Property | RNN | LSTM | Transformer |
|----------|-----|------|-------------|
| **Time complexity per layer** | O(n · d²) | O(n · d²) | O(n² · d) |
| **Sequential operations** | O(n) | O(n) | O(1) |
| **Maximum path length** | O(n) | O(n) | O(1) |
| **Parallelizable** | No | No | Yes |
| **Memory per layer** | O(d) | O(d) | O(n²) |

Where n is sequence length and d is model dimension.

### 5.2 Time Complexity

**RNN/LSTM: O(n · d²) per layer.** At each of the n time steps, the model performs a matrix multiplication of the hidden state (size d) with a weight matrix (size d × d), costing O(d²). Over n steps: O(n · d²). But these n steps are **sequential** — you cannot parallelize them.

**Transformer: O(n² · d) per layer.** The self-attention computation QK^T costs O(n² · d) because you compute dot products between all pairs of tokens (n²), and each dot product involves vectors of dimension d. The FFN costs O(n · d · d_ff) = O(n · d²). So the total is O(n² · d + n · d²).

**Which is faster in practice?**

For typical NLP sequence lengths (n = 512 or 1024) with d = 512 or 1024: n and d are comparable, so n² · d ≈ n · d². The raw computation is similar. But the Transformer does it all in one parallel operation, while the RNN requires n sequential operations. On GPUs with thousands of cores, the Transformer's wall-clock time is dramatically less.

The Transformer only loses when n >> d (very long sequences with small model dimensions). For n = 100,000 and d = 512, n² · d = 5.12 × 10¹² while n · d² = 2.62 × 10¹⁰ — the Transformer's attention computation is ~200x more expensive. This is the quadratic attention bottleneck.

### 5.3 Sequential Operations (Parallelism)

This is where the Transformer decisively wins.

**RNN/LSTM:** O(n) sequential operations. Processing token t requires the hidden state from token t-1. If n = 1000, you need 1000 sequential steps. Each step takes some time τ. Total wall-clock time: 1000τ, regardless of how many GPU cores you have.

**Transformer:** O(1) sequential operations within a layer. All n tokens are processed simultaneously in the matrix multiplications. The wall-clock time for one layer is independent of n (up to memory constraints). With 6 layers, you need 6 sequential operations regardless of sequence length.

This means a Transformer can process a 1000-token sequence in roughly the same wall-clock time as a 10-token sequence (assuming the GPU has enough parallelism). An RNN takes 100x longer for the 1000-token sequence.

### 5.4 Maximum Path Length (Long-Range Dependencies)

**RNN/LSTM:** O(n). Information from token 0 must pass through n-1 intermediate states to reach token n-1. Each intermediate step transforms the information, potentially losing or corrupting it. Long-range dependencies require information to survive a long chain of transformations.

**Transformer:** O(1). Token 0 can directly attend to token n-1 in a single attention step. No intermediate processing. The information path is one hop, regardless of distance. This makes long-range dependencies trivially easy to capture.

### 5.5 Memory Trade-offs

**RNN/LSTM:** O(d) memory per time step for the hidden state. Total memory: O(n · d) for the full sequence (you need to store all hidden states for backpropagation). This is linear in sequence length.

**Transformer:** O(n²) memory for the attention matrix, per layer, per head. For 6 layers and 8 heads: O(48 · n²). For n = 2048, that is 48 × 4M = 192M attention entries per example. At float32, that is ~768MB per example just for attention weights. This quadratic memory cost is one of the main bottlenecks for long-context processing.

### 5.6 Why the Transformer Won Despite Quadratic Cost

The quadratic cost sounds terrible. But the Transformer won because:

1. **Typical sequence lengths are moderate.** Most NLP tasks work with sequences under 2048 tokens. At this length, the quadratic cost is manageable and the parallelism benefits are enormous.

2. **GPUs are designed for parallelism.** A sequential O(n · d²) computation on a GPU wastes most of its compute capacity. A parallel O(n² · d) computation fully utilizes the GPU's thousands of cores. The Transformer achieves higher throughput (tokens processed per second) despite doing more total computation.

3. **Scaling laws favor the Transformer.** Larger Transformers trained on more data consistently improve performance. This scaling property enabled the breakthroughs from GPT-2 to GPT-3 to GPT-4. RNNs and LSTMs do not scale as effectively.

4. **Efficient attention variants exist.** Flash Attention, sparse attention, linear attention, and other techniques reduce the quadratic cost for long sequences while preserving most of the benefits.

---

## 6. Limitations of the Original Transformer

The 2017 Transformer was brilliant but not perfect. Understanding its limitations explains why so much research has followed.

### 6.1 Quadratic Attention Complexity

As discussed, self-attention scales as O(n²) in time and memory. For a sequence of 1024 tokens, the attention matrix has ~1 million entries per head per layer. For 100K tokens, it has 10 billion entries. This makes the original Transformer impractical for long documents, books, or conversations that span thousands of turns.

**Impact:** The original Transformer was limited to sequences of about 512 tokens. Longer documents had to be truncated or split. This limitation drove research into efficient attention mechanisms.

### 6.2 Fixed Context Window

The Transformer cannot naturally handle inputs longer than its maximum sequence length (set during training). Unlike an RNN, which can theoretically process an infinite stream by updating its hidden state, the Transformer must see the entire sequence at once.

**Impact:** This creates hard limits on how much context the model can consider. A model trained with a 2048-token window cannot look at a 3000-token document without modification. Techniques like sliding windows, hierarchical attention, and Rotary Positional Embeddings (which allow some extrapolation) address this.

### 6.3 Expensive Training

Even the "base" Transformer required 12 hours on 8 GPUs. Larger models require thousands of GPUs for weeks or months. The energy consumption and cost are substantial.

**Impact:** Only well-funded organizations can train large Transformers from scratch. This has concentrated AI capabilities in a few companies (OpenAI, Google, Meta, Anthropic) and driven the open-source community to focus on fine-tuning pre-trained models rather than training new ones.

### 6.4 Large Memory Usage

Beyond the attention matrix, Transformers require significant memory for:
- Model parameters (the big model has 213M parameters × 4 bytes = ~852MB)
- Activations stored for backpropagation (much larger than the parameters)
- Optimizer states (Adam stores two momentum terms per parameter, tripling memory)
- Gradient accumulation

**Impact:** Training large Transformers requires specialized hardware (multiple high-memory GPUs) and techniques like gradient checkpointing, mixed-precision training, and model parallelism.

### 6.5 Need for Huge Datasets

Transformers have high capacity but few inductive biases. An RNN has a built-in bias toward sequential processing. A CNN has a built-in bias toward local spatial patterns. A Transformer has almost no built-in bias — it can learn any pattern, but it needs data to learn it.

**Impact:** Without sufficient data, Transformers overfit. This is why the pre-training/fine-tuning paradigm became standard: pre-train on billions of tokens of general text, then fine-tune on small task-specific datasets.

### 6.6 No Inherent Understanding of Structure

The original Transformer treats input as a flat sequence of tokens. It has no built-in understanding of hierarchical structure (syntax trees), document structure (paragraphs, sections), or other forms of structured information.

**Impact:** The model must learn all structural understanding from data and positional encodings alone. While it does this surprisingly well, it can struggle with tasks that require explicit structural reasoning.

---

## 7. Practical Section: Building a Transformer in PyTorch

Let's build the key components from scratch. Every line is annotated with tensor shapes so you can follow the data flow exactly.

### 7.1 Self-Attention from Scratch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class SelfAttention(nn.Module):
    """
    Single-head self-attention from scratch.
    
    Input:  (batch_size, seq_len, d_model)
    Output: (batch_size, seq_len, d_model)
    """
    
    def __init__(self, d_model: int):
        super().__init__()
        self.d_model = d_model
        
        # Learned projection matrices
        self.W_Q = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, seq_len, d_model)
        
        Q = self.W_Q(x)  # (batch_size, seq_len, d_model)
        K = self.W_K(x)  # (batch_size, seq_len, d_model)
        V = self.W_V(x)  # (batch_size, seq_len, d_model)
        
        # Compute attention scores: Q @ K^T
        # (batch_size, seq_len, d_model) @ (batch_size, d_model, seq_len)
        # = (batch_size, seq_len, seq_len)
        scores = torch.matmul(Q, K.transpose(-2, -1))
        
        # Scale by sqrt(d_model) to prevent softmax saturation
        scores = scores / math.sqrt(self.d_model)
        
        # Softmax over the last dimension (key dimension)
        # Each row sums to 1: attention weights for each query over all keys
        weights = F.softmax(scores, dim=-1)  # (batch_size, seq_len, seq_len)
        
        # Weighted sum of values
        # (batch_size, seq_len, seq_len) @ (batch_size, seq_len, d_model)
        # = (batch_size, seq_len, d_model)
        output = torch.matmul(weights, V)
        
        return output


# Quick test
batch_size, seq_len, d_model = 2, 10, 64
x = torch.randn(batch_size, seq_len, d_model)
attn = SelfAttention(d_model)
out = attn(x)
print(f"Input shape:  {x.shape}")    # torch.Size([2, 10, 64])
print(f"Output shape: {out.shape}")  # torch.Size([2, 10, 64])
```

### 7.2 Multi-Head Attention

```python
class MultiHeadAttention(nn.Module):
    """
    Multi-head attention as described in the paper.
    
    Splits d_model into h heads, runs attention in parallel,
    concatenates, and projects back.
    
    Input:  (batch_size, seq_len, d_model)
    Output: (batch_size, seq_len, d_model)
    """
    
    def __init__(self, d_model: int, num_heads: int):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads  # per-head dimension
        
        # All heads' projections packed into single matrices for efficiency
        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.W_O = nn.Linear(d_model, d_model, bias=False)
    
    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor = None
    ) -> torch.Tensor:
        batch_size = query.size(0)
        
        # Step 1: Linear projections
        # (batch_size, seq_len, d_model)
        Q = self.W_Q(query)
        K = self.W_K(key)
        V = self.W_V(value)
        
        # Step 2: Reshape to (batch_size, num_heads, seq_len, d_k)
        # This splits d_model into num_heads chunks of d_k dimensions
        Q = Q.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = K.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = V.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        # Q, K, V shape: (batch_size, num_heads, seq_len, d_k)
        
        # Step 3: Scaled dot-product attention for all heads in parallel
        # scores: (batch_size, num_heads, seq_len_q, seq_len_k)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        
        # Apply mask if provided (e.g., causal mask for decoder)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        
        weights = F.softmax(scores, dim=-1)
        
        # (batch_size, num_heads, seq_len_q, d_k)
        attn_output = torch.matmul(weights, V)
        
        # Step 4: Concatenate heads
        # Transpose back: (batch_size, seq_len_q, num_heads, d_k)
        attn_output = attn_output.transpose(1, 2).contiguous()
        # Reshape to concatenate: (batch_size, seq_len_q, d_model)
        attn_output = attn_output.view(batch_size, -1, self.d_model)
        
        # Step 5: Final linear projection
        output = self.W_O(attn_output)  # (batch_size, seq_len_q, d_model)
        
        return output


# Test
mha = MultiHeadAttention(d_model=512, num_heads=8)
x = torch.randn(2, 10, 512)
out = mha(x, x, x)  # self-attention: Q=K=V=x
print(f"Multi-head attention output shape: {out.shape}")  # torch.Size([2, 10, 512])
```

### 7.3 Positional Encoding

```python
class PositionalEncoding(nn.Module):
    """
    Sinusoidal positional encoding from the paper.
    
    Adds position-dependent vectors to token embeddings so
    the model knows word order.
    """
    
    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        
        # Create positional encoding matrix: (max_len, d_model)
        pe = torch.zeros(max_len, d_model)
        
        # Position indices: (max_len, 1)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        
        # Division term: 10000^(2i/d_model) for each dimension pair
        # Using log-space for numerical stability:
        # 10000^(2i/d_model) = exp(2i * log(10000) / d_model)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        # div_term shape: (d_model/2,)
        
        # Apply sin to even indices, cos to odd indices
        pe[:, 0::2] = torch.sin(position * div_term)  # even dimensions
        pe[:, 1::2] = torch.cos(position * div_term)  # odd dimensions
        
        # Add batch dimension: (1, max_len, d_model)
        pe = pe.unsqueeze(0)
        
        # Register as buffer (not a parameter — no gradient needed)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, seq_len, d_model)
        # Add positional encoding (broadcast over batch)
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)


# Test
pe = PositionalEncoding(d_model=512)
x = torch.randn(2, 10, 512)
out = pe(x)
print(f"After positional encoding: {out.shape}")  # torch.Size([2, 10, 512])
```

### 7.4 Feed-Forward Network

```python
class FeedForward(nn.Module):
    """
    Position-wise feed-forward network.
    Two linear layers with ReLU activation.
    Expands to d_ff (4x d_model) then contracts back.
    """
    
    def __init__(self, d_model: int, d_ff: int = 2048, dropout: float = 0.1):
        super().__init__()
        self.linear1 = nn.Linear(d_model, d_ff)      # (d_model, d_ff)
        self.linear2 = nn.Linear(d_ff, d_model)      # (d_ff, d_model)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch_size, seq_len, d_model)
        x = self.linear1(x)       # (batch_size, seq_len, d_ff)
        x = F.relu(x)             # (batch_size, seq_len, d_ff)
        x = self.dropout(x)
        x = self.linear2(x)       # (batch_size, seq_len, d_model)
        return x
```

### 7.5 Encoder Block

```python
class EncoderBlock(nn.Module):
    """
    Single encoder block: multi-head self-attention + FFN,
    each with residual connection and layer norm.
    """
    
    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.self_attn = MultiHeadAttention(d_model, num_heads)
        self.ffn = FeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
    
    def forward(self, x: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        # Sub-layer 1: Multi-head self-attention with residual + norm
        attn_output = self.self_attn(x, x, x, mask)  # Q=K=V=x for self-attention
        x = self.norm1(x + self.dropout1(attn_output))
        
        # Sub-layer 2: FFN with residual + norm
        ffn_output = self.ffn(x)
        x = self.norm2(x + self.dropout2(ffn_output))
        
        return x  # (batch_size, seq_len, d_model)
```

### 7.6 Decoder Block

```python
class DecoderBlock(nn.Module):
    """
    Single decoder block: masked self-attention + cross-attention + FFN,
    each with residual connection and layer norm.
    """
    
    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.masked_self_attn = MultiHeadAttention(d_model, num_heads)
        self.cross_attn = MultiHeadAttention(d_model, num_heads)
        self.ffn = FeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
        self.dropout3 = nn.Dropout(dropout)
    
    def forward(
        self,
        x: torch.Tensor,
        encoder_output: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        # Sub-layer 1: Masked self-attention (decoder attends to itself, causally)
        attn_output = self.masked_self_attn(x, x, x, tgt_mask)
        x = self.norm1(x + self.dropout1(attn_output))
        
        # Sub-layer 2: Cross-attention (decoder attends to encoder output)
        # Q from decoder, K and V from encoder
        cross_output = self.cross_attn(x, encoder_output, encoder_output, src_mask)
        x = self.norm2(x + self.dropout2(cross_output))
        
        # Sub-layer 3: FFN
        ffn_output = self.ffn(x)
        x = self.norm3(x + self.dropout3(ffn_output))
        
        return x  # (batch_size, tgt_seq_len, d_model)
```

### 7.7 Full Transformer

```python
class Transformer(nn.Module):
    """
    Full encoder-decoder Transformer as described in 'Attention Is All You Need'.
    """
    
    def __init__(
        self,
        src_vocab_size: int,
        tgt_vocab_size: int,
        d_model: int = 512,
        num_heads: int = 8,
        num_layers: int = 6,
        d_ff: int = 2048,
        max_len: int = 5000,
        dropout: float = 0.1
    ):
        super().__init__()
        
        # Embeddings
        self.src_embedding = nn.Embedding(src_vocab_size, d_model)
        self.tgt_embedding = nn.Embedding(tgt_vocab_size, d_model)
        self.positional_encoding = PositionalEncoding(d_model, max_len, dropout)
        
        # Scale embeddings by sqrt(d_model) as specified in the paper
        self.d_model = d_model
        
        # Encoder: stack of N encoder blocks
        self.encoder_layers = nn.ModuleList([
            EncoderBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        
        # Decoder: stack of N decoder blocks
        self.decoder_layers = nn.ModuleList([
            DecoderBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        
        # Final linear layer: project to target vocabulary
        self.output_projection = nn.Linear(d_model, tgt_vocab_size)
    
    def encode(self, src: torch.Tensor, src_mask: torch.Tensor = None) -> torch.Tensor:
        # src: (batch_size, src_seq_len) — token IDs
        x = self.src_embedding(src) * math.sqrt(self.d_model)  # scale embeddings
        x = self.positional_encoding(x)
        
        for layer in self.encoder_layers:
            x = layer(x, src_mask)
        
        return x  # (batch_size, src_seq_len, d_model)
    
    def decode(
        self,
        tgt: torch.Tensor,
        encoder_output: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        # tgt: (batch_size, tgt_seq_len) — token IDs
        x = self.tgt_embedding(tgt) * math.sqrt(self.d_model)
        x = self.positional_encoding(x)
        
        for layer in self.decoder_layers:
            x = layer(x, encoder_output, src_mask, tgt_mask)
        
        return x  # (batch_size, tgt_seq_len, d_model)
    
    def forward(
        self,
        src: torch.Tensor,
        tgt: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        encoder_output = self.encode(src, src_mask)
        decoder_output = self.decode(tgt, encoder_output, src_mask, tgt_mask)
        logits = self.output_projection(decoder_output)  # (batch, tgt_len, tgt_vocab)
        return logits
    
    @staticmethod
    def generate_causal_mask(size: int) -> torch.Tensor:
        """Generate causal (look-ahead) mask for decoder self-attention."""
        # Upper triangle is False (masked), lower triangle + diagonal is True (visible)
        mask = torch.tril(torch.ones(size, size)).unsqueeze(0).unsqueeze(0)
        return mask  # (1, 1, size, size) — broadcastable over batch and heads


# Test the full model
model = Transformer(
    src_vocab_size=10000,
    tgt_vocab_size=10000,
    d_model=512,
    num_heads=8,
    num_layers=6,
    d_ff=2048,
    dropout=0.1
)

# Count parameters
total_params = sum(p.numel() for p in model.parameters())
print(f"Total parameters: {total_params:,}")  # ~63M for the base model

# Forward pass
src = torch.randint(0, 10000, (2, 20))     # batch of 2, source length 20
tgt = torch.randint(0, 10000, (2, 15))     # batch of 2, target length 15
tgt_mask = Transformer.generate_causal_mask(15)

logits = model(src, tgt, tgt_mask=tgt_mask)
print(f"Output logits shape: {logits.shape}")  # torch.Size([2, 15, 10000])
```

### 7.8 Common Mistakes Beginners Make

**Mistake 1: Forgetting to scale the dot products.**

```python
# WRONG — softmax will saturate for large d_k
scores = torch.matmul(Q, K.transpose(-2, -1))
weights = F.softmax(scores, dim=-1)

# CORRECT — scale by sqrt(d_k)
scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
weights = F.softmax(scores, dim=-1)
```

Without scaling, training will appear to work initially but attention patterns will be near-one-hot (attending to a single token), limiting the model's ability to aggregate information.

**Mistake 2: Applying softmax on the wrong dimension.**

```python
# WRONG — normalizes across queries instead of keys
weights = F.softmax(scores, dim=-2)

# CORRECT — normalizes across keys (each query's weights sum to 1)
weights = F.softmax(scores, dim=-1)
```

The attention matrix has shape (seq_len_q, seq_len_k). Softmax must be applied across the key dimension (last dimension) so that each query's attention weights sum to 1.

**Mistake 3: Not masking padding tokens.**

If your batch has sequences of different lengths padded to the same length, you must mask padding tokens. Otherwise, the model will attend to meaningless padding values, corrupting the representations.

```python
# Create padding mask: True where tokens are real, False where padding
# src shape: (batch_size, seq_len), pad_token_id is usually 0
padding_mask = (src != pad_token_id).unsqueeze(1).unsqueeze(2)
# padding_mask shape: (batch_size, 1, 1, seq_len) — broadcastable
```

**Mistake 4: Applying the causal mask with the wrong values.**

```python
# WRONG — using 0 to mask (0 is a valid score)
scores = scores.masked_fill(mask == 0, 0)

# CORRECT — using -infinity to mask (exp(-inf) = 0 after softmax)
scores = scores.masked_fill(mask == 0, float('-inf'))
```

**Mistake 5: Forgetting the embedding scaling factor.**

The paper multiplies embeddings by sqrt(d_model):

```python
x = self.embedding(tokens) * math.sqrt(d_model)
```

**Why?** Embedding vectors are initialized with small values (variance ~1). Positional encodings have values between -1 and 1. Without scaling, the embeddings would be dominated by the positional encodings. Multiplying by sqrt(d_model) ≈ 22.6 (for d_model=512) brings the embedding magnitudes up to a comparable range.

**Mistake 6: Confusing self-attention and cross-attention arguments.**

```python
# Self-attention: Q, K, V all come from the same input
self_attn_output = self.self_attn(x, x, x)

# Cross-attention: Q from decoder, K and V from encoder
cross_attn_output = self.cross_attn(decoder_x, encoder_output, encoder_output)
```

In cross-attention, the first argument (query) comes from the decoder, while the second and third arguments (key, value) come from the encoder. Getting these backwards produces a valid computation with completely wrong semantics.

---

## 8. Related Concepts Glossary

Here is a reference glossary of important terms related to Transformers that you will encounter frequently.

### Embeddings

Dense vector representations of discrete tokens. Each token in the vocabulary is mapped to a d_model-dimensional vector. These vectors are learned during training and encode semantic information: tokens with similar meanings end up with similar vectors.

The embedding matrix has shape (vocab_size × d_model). For a vocabulary of 50,000 tokens and d_model = 512, this is a 25.6M parameter matrix — often one of the largest components in the model.

### Cross-Attention

Attention where queries come from one sequence and keys/values come from another. In the encoder-decoder Transformer, the decoder queries attend to the encoder's key-value representations. This is how information flows from the input sequence to the output generation process.

Cross-attention can also be used in multimodal models: text queries attending to image features, or video queries attending to audio features.

### Masked Self-Attention

Self-attention where certain positions are masked (prevented from being attended to). In the decoder, future positions are masked to enforce the autoregressive property: position t can only attend to positions 0 through t.

The mask is implemented by adding -infinity to the attention scores at masked positions before applying softmax.

### Causal Attention

Another name for masked self-attention in the decoder. "Causal" because the output at position t depends only on inputs at positions ≤ t — it cannot be "caused" by future tokens. This is the standard attention pattern in decoder-only models like GPT.

### Encoder-Only Models

Models that use only the encoder portion of the Transformer (no decoder). They process the entire input with bidirectional self-attention and produce a contextualized representation of each token.

**Use cases:** Classification, named entity recognition, sentence similarity, extractive question answering.
**Examples:** BERT, RoBERTa, ALBERT, DistilBERT.

### Decoder-Only Models

Models that use only the decoder portion (no encoder, no cross-attention). They use causal (masked) self-attention and generate output autoregressively — one token at a time, left to right.

**Use cases:** Text generation, language modeling, chat, code generation.
**Examples:** GPT-2, GPT-3, GPT-4, LLaMA, Claude, Mistral, Gemini.

These models are the dominant architecture for modern LLMs. They treat every task as text generation: given a prompt, generate a continuation.

### Encoder-Decoder Models

The original Transformer architecture. Uses both an encoder (bidirectional attention over input) and a decoder (causal attention over output + cross-attention to encoder).

**Use cases:** Machine translation, summarization, question answering with generation.
**Examples:** The original Transformer, T5, BART, mBART.

### Fine-Tuning

Taking a pre-trained model and continuing training on a smaller, task-specific dataset. The pre-trained model has learned general language patterns from a large corpus. Fine-tuning adapts these patterns to a specific task (sentiment analysis, code generation, medical question answering) with much less data and compute than training from scratch.

### Transfer Learning

The broader concept behind fine-tuning. Knowledge learned from one task (pre-training on general text) transfers to another task (specific downstream application). The Transformer's architecture is particularly amenable to transfer learning because the self-attention mechanism learns general-purpose representations that are useful across many tasks.

---

## 9. Visual Explanations: Understanding Matrix Dimensions

### 9.1 The Data Flow Diagram

Here is the complete data flow through a Transformer, with tensor shapes at every stage:

```
INPUT TEXT: "The cat sat on the mat"
    │
    ▼
┌─────────────────────────────────────────────┐
│ TOKENIZATION                                │
│ "The cat sat on the mat" → [67, 2891, ...]  │
│ Shape: (6,) — six token IDs                 │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ EMBEDDING + POSITIONAL ENCODING             │
│ Embedding lookup: (6,) → (6, 512)           │
│ Scale by √512 ≈ 22.6                        │
│ Add positional encoding: (6, 512)           │
│ Output: (6, 512)                            │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ ENCODER (×6 layers)                         │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Multi-Head Self-Attention               │ │
│ │ Q = X·W_Q: (6, 512) → (6, 8, 64)      │ │
│ │ K = X·W_K: (6, 512) → (6, 8, 64)      │ │
│ │ V = X·W_V: (6, 512) → (6, 8, 64)      │ │
│ │ Scores: (8, 6, 6) per head             │ │
│ │ Output: (6, 512) after concat + W_O    │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Add & Norm → (6, 512)                  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Feed-Forward: 512 → 2048 → 512         │ │
│ │ Output: (6, 512)                       │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Add & Norm → (6, 512)                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Encoder output: (6, 512)                    │
└─────────────────────────────────────────────┘
    │
    │ encoder_output used as K, V in cross-attention
    │
    ▼
┌─────────────────────────────────────────────┐
│ DECODER (×6 layers)                         │
│ Input: target tokens (7, 512) with <SOS>    │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Masked Self-Attention                   │ │
│ │ Causal mask: upper triangle = -inf      │ │
│ │ Scores: (8, 7, 7) per head (masked)    │ │
│ │ Output: (7, 512)                       │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Add & Norm → (7, 512)                  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Cross-Attention                         │ │
│ │ Q from decoder: (7, 64) per head       │ │
│ │ K, V from encoder: (6, 64) per head    │ │
│ │ Scores: (8, 7, 6) per head             │ │
│ │ Output: (7, 512)                       │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Add & Norm → (7, 512)                  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Feed-Forward: 512 → 2048 → 512         │ │
│ │ Output: (7, 512)                       │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Add & Norm → (7, 512)                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Decoder output: (7, 512)                    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│ OUTPUT PROJECTION                           │
│ Linear: (7, 512) → (7, vocab_size)         │
│ Softmax → probability distribution          │
│ Pick highest probability token at each pos  │
└─────────────────────────────────────────────┘
    │
    ▼
OUTPUT: "Die Katze saß auf der Matte <EOS>"
```

### 9.2 Attention Map Visualization

An attention map is a heat map of the attention weight matrix. For a single head attending over a sequence of 6 tokens:

```
         The   cat   sat    on   the   mat
The     [0.8   0.05  0.05  0.03  0.02  0.05]
cat     [0.15  0.6   0.1   0.02  0.03  0.1 ]
sat     [0.1   0.3   0.4   0.05  0.05  0.1 ]
on      [0.05  0.05  0.2   0.5   0.1   0.1 ]
the     [0.05  0.1   0.05  0.2   0.3   0.3 ]
mat     [0.03  0.07  0.1   0.2   0.3   0.3 ]
```

Each row sums to 1.0. The entry at (i, j) tells you how much token i attends to token j. In this example:
- "The" mostly attends to itself (0.8) — at this layer, it has not yet found strong connections
- "cat" attends to itself (0.6) and somewhat to "The" (0.15) — building the phrase "The cat"
- "sat" attends to "cat" (0.3) — connecting subject to verb
- "mat" attends to "the" (0.3) and itself (0.3) — building "the mat"

Different heads produce different attention maps. One head might focus on syntactic relationships, another on semantic similarity, another on positional proximity.

---

## 10. Conclusion: Why This Paper Mattered

The "Attention Is All You Need" paper did not just propose a new model for machine translation. It introduced an architecture that turned out to be the universal computation engine for AI.

**What the paper demonstrated:**
1. Recurrence is not necessary for processing sequences. Self-attention can replace it entirely.
2. A model built purely from attention layers can achieve state-of-the-art results on machine translation while training significantly faster than RNN-based models.
3. The architecture is simple, modular, and scalable.

**What nobody predicted:**
1. The same architecture, with minor modifications, would dominate virtually every domain in AI — language, vision, audio, biology, code, robotics.
2. Scaling this architecture to billions and then trillions of parameters would produce emergent capabilities that no one designed: reasoning, instruction following, code generation, and more.
3. This paper would become the foundation of an entire industry worth hundreds of billions of dollars.

**Key takeaways:**

- **Self-attention** is the core innovation: every token can attend to every other token in parallel, replacing sequential recurrence with a single parallel operation.
- **Multi-head attention** allows the model to capture multiple types of relationships simultaneously.
- **Positional encoding** gives the model awareness of token order despite the permutation-invariant nature of attention.
- **The encoder-decoder architecture** with residual connections and layer normalization creates a deep, trainable model that can map one sequence to another.
- **The quadratic cost** of attention is the main limitation, driving research into efficient variants.
- **Parallelism** is the practical reason the Transformer won: it fully utilizes modern GPU hardware, enabling the scaling that made modern AI possible.

The Transformer is not just a model. It is the foundation upon which the entire modern AI ecosystem is built. Every system you interact with — every chatbot, every code assistant, every image generator, every translation service — runs on the ideas in this paper.

---

**Previous:** [Part 0 — The Paper: From Recurrence to Revolution](transformer-deep-dive-part-0.md)
**Next:** [Part 2 — The Revolution: How One Paper Rewrote All of AI](transformer-deep-dive-part-2.md)
