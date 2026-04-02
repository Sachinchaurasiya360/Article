---
title: "Attention Is All You Need - Complete Transformer Architecture Deep Dive"
meta_description: "A comprehensive, deeply technical walkthrough of every component in the original Transformer architecture from the 'Attention Is All You Need' paper. Covers input embeddings, positional encoding, multi-head self-attention, feed-forward networks, encoder-decoder stacks, training details, full PyTorch implementation, and the mathematical foundations behind modern LLMs."
slug: "transformer-attention-is-all-you-need"
keywords:
  - transformer architecture
  - attention is all you need
  - multi-head attention
  - self-attention mechanism
  - positional encoding
  - scaled dot-product attention
  - encoder decoder transformer
  - transformer from scratch
  - PyTorch transformer implementation
  - query key value attention
  - layer normalization transformer
  - feed-forward network transformer
  - causal masking decoder
  - transformer training details
  - BERT GPT T5 architecture
  - deep learning NLP
  - transformer math explained
  - attention mechanism deep dive
  - machine learning architecture
  - neural network transformer
series: "Security Deep Dive"
---

# Attention Is All You Need -- Complete Transformer Architecture Deep Dive

## Introduction

In June 2017, a team of eight researchers at Google published a paper that permanently altered the trajectory of artificial intelligence. "Attention Is All You Need" (Vaswani et al., 2017) introduced the Transformer, an architecture that replaced the recurrence and convolution mechanisms dominating sequence modeling with a single, elegant principle: attention. Every large language model you interact with today -- GPT-4, Claude, Gemini, LLaMA, Mistral -- descends directly from the ideas in that paper.

Understanding the Transformer is no longer optional for anyone working in software engineering, machine learning, or cybersecurity. Adversarial attacks on language models, prompt injection, model extraction, and membership inference all require an understanding of what happens inside the architecture. This article is a complete, ground-up dissection of every component in the original Transformer. We will walk through the architecture diagram box by box, derive the mathematics, implement every piece in PyTorch, and explain why each design decision was made.

### What the Transformer Replaced

Before 2017, sequence-to-sequence tasks (translation, summarization, question answering) were dominated by Recurrent Neural Networks (RNNs) and their variants: Long Short-Term Memory (LSTM) networks and Gated Recurrent Units (GRUs). These architectures suffered from three fundamental problems.

**Sequential processing.** An RNN processes tokens one at a time, left to right. The hidden state at position t depends on the hidden state at position t-1. This creates a strict sequential dependency that prevents parallelization. Training on modern GPU hardware, which thrives on parallel computation, was severely bottlenecked.

**Vanishing and exploding gradients.** During backpropagation through time (BPTT), gradients must flow backward through every time step. For long sequences, gradients either shrink exponentially (vanishing) or grow exponentially (exploding). LSTMs introduced gating mechanisms to mitigate this, but the problem was never fully solved. Sequences longer than a few hundred tokens remained problematic.

**Limited long-range dependencies.** Even with LSTMs, the information from early tokens must pass through a bottleneck: the fixed-size hidden state vector. By the time the network processes token 500, the information from token 1 has been compressed, overwritten, and diluted. The network struggles to maintain relationships across long distances.

### The Key Insight

The Transformer's central claim is radical in its simplicity: attention alone is sufficient. You do not need recurrence. You do not need convolution. If every token can directly attend to every other token in a single operation, you solve all three problems simultaneously. Processing becomes parallel (every attention computation is independent). Gradients flow directly between any two positions (no chain of time steps). Long-range dependencies are captured in a single matrix multiplication.

The rest of this article explains exactly how.

---

## The Full Architecture

The Transformer follows an encoder-decoder structure. The encoder reads an input sequence and produces a continuous representation. The decoder consumes that representation and generates an output sequence one token at a time. Both the encoder and decoder are composed of stacked identical layers.

Here is the high-level architecture in text form, mirroring the diagram from the paper:

```
                          OUTPUT
                            |
                        [Softmax]
                            |
                     [Linear Layer]
                            |
                   +------------------+
                   |    DECODER x6    |
                   |                  |
                   | [Add & Norm]     |
                   | [Feed Forward]   |
                   | [Add & Norm]     |
                   | [Cross-Attention]|  <--- K, V from Encoder
                   | [Add & Norm]     |
                   | [Masked Self-Attn]|
                   +------------------+
                            |
               [Output Embedding + Pos Enc]
                            |
                    OUTPUT TOKENS (shifted right)

                   +------------------+
                   |    ENCODER x6    |
                   |                  |
                   | [Add & Norm]     |
                   | [Feed Forward]   |
                   | [Add & Norm]     |
                   | [Self-Attention] |
                   +------------------+
                            |
               [Input Embedding + Pos Enc]
                            |
                      INPUT TOKENS
```

We will now walk through every box from bottom to top.

---

## Input Processing

### Input Embedding

A neural network cannot operate on raw text. The string "The cat sat" must be converted into numerical vectors. This happens in two stages: tokenization and embedding.

**Tokenization** converts the raw string into a sequence of integer indices. The original Transformer used byte-pair encoding (BPE) with a shared source-target vocabulary of approximately 37,000 tokens. Each token is an integer index into a fixed vocabulary.

**Embedding** converts each integer index into a dense vector of dimension d_model = 512. This is implemented as a lookup table: a weight matrix of shape (vocab_size, d_model). Given a token index i, the embedding is simply the i-th row of the matrix.

```python
import torch
import torch.nn as nn

class TokenEmbedding(nn.Module):
    def __init__(self, vocab_size: int, d_model: int):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.d_model = d_model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch_size, seq_len) of integer token indices
        # output: (batch_size, seq_len, d_model)
        # Scale by sqrt(d_model) as specified in the paper (Section 3.4)
        return self.embedding(x) * (self.d_model ** 0.5)
```

The scaling by sqrt(d_model) is easy to miss but important. The paper states: "In the embedding layers, we multiply those weights by sqrt(d_model)." The reason is that embedding vectors are initialized with small values (standard deviation around 1/sqrt(d_model)), but the positional encodings have values in [-1, 1]. Without scaling, the positional signal would dominate the token identity signal. Multiplying by sqrt(d_model) brings the embedding magnitudes into a comparable range.

### Positional Encoding

Without recurrence, the Transformer has no inherent notion of token order. The sequence "cat sat on mat" and "mat on sat cat" would produce identical attention patterns because self-attention is permutation-equivariant. The model needs position information injected explicitly.

The paper uses sinusoidal positional encodings defined by:

```
PE(pos, 2i)     = sin(pos / 10000^(2i / d_model))
PE(pos, 2i + 1) = cos(pos / 10000^(2i / d_model))
```

Where `pos` is the position in the sequence (0, 1, 2, ...) and `i` is the dimension index (0, 1, 2, ..., d_model/2 - 1). Each dimension of the positional encoding corresponds to a sinusoid with a different wavelength, ranging from 2*pi (for i=0) to 10000 * 2*pi (for i=d_model/2 - 1).

**Why sinusoidal?** Three reasons:

1. **Extrapolation to longer sequences.** Sinusoidal functions are defined for any position, so the model can handle sequences longer than any seen during training. Learned positional embeddings cannot extrapolate.

2. **Relative position encoding.** For any fixed offset k, PE(pos + k) can be represented as a linear function of PE(pos). This means the model can learn to attend to relative positions. Specifically, the dot product PE(pos_a) . PE(pos_b) depends only on (pos_a - pos_b), not on the absolute positions.

3. **Bounded values.** Sine and cosine are always in [-1, 1], which keeps the positional signal stable regardless of sequence length.

Here is the implementation and a visualization of the patterns:

```python
import numpy as np
import torch
import torch.nn as nn
import math

class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        # Create positional encoding matrix: (max_len, d_model)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)  # (max_len, 1)
        # Compute the division term: 10000^(2i/d_model) = exp(2i * -log(10000)/d_model)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )  # (d_model/2,)

        pe[:, 0::2] = torch.sin(position * div_term)  # Even indices
        pe[:, 1::2] = torch.cos(position * div_term)  # Odd indices

        pe = pe.unsqueeze(0)  # (1, max_len, d_model) for broadcasting over batch
        self.register_buffer('pe', pe)  # Not a parameter, but saved in state_dict

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch_size, seq_len, d_model)
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)
```

**Visualizing the patterns.** If you plot the positional encoding matrix as a heatmap with position on the y-axis and dimension on the x-axis, you see a distinctive pattern. The leftmost columns (low i) oscillate rapidly, completing many full cycles across the sequence. The rightmost columns (high i) oscillate slowly, barely changing across the entire sequence. This creates a "fingerprint" for each position: a unique combination of fast and slow oscillations, similar to binary encoding but continuous.

```
Position 0:  [sin(0), cos(0), sin(0), cos(0), ...]  = [0, 1, 0, 1, ...]
Position 1:  [sin(1), cos(1), sin(1/10000^(2/512)), cos(1/10000^(2/512)), ...]
Position 2:  [sin(2), cos(2), sin(2/10000^(2/512)), cos(2/10000^(2/512)), ...]
...
```

The low-frequency dimensions change slowly and encode coarse position (beginning vs middle vs end). The high-frequency dimensions change rapidly and encode fine position (distinguishing adjacent tokens).

**Comparison with learned positional embeddings.** The paper tested learned positional embeddings and found "nearly identical results" (Table 3, row E). However, sinusoidal encodings were chosen for the extrapolation benefit. In practice, most modern Transformers (BERT, GPT-2) use learned positional embeddings, trading extrapolation for slightly more expressive position representations. More recent models use Rotary Position Embeddings (RoPE), which we discuss later.

---

## The Encoder Stack

The encoder consists of N = 6 identical layers stacked on top of each other. Each layer has two sub-layers: multi-head self-attention and a position-wise feed-forward network. Each sub-layer is wrapped in a residual connection followed by layer normalization.

### Multi-Head Self-Attention

This is the core mechanism of the Transformer and the component that justifies the paper's title. We will build it from first principles.

#### Queries, Keys, and Values

The attention mechanism is inspired by information retrieval. You have a **query** (what you are looking for), a set of **keys** (what is available), and corresponding **values** (the content associated with each key). The output is a weighted sum of values, where the weight assigned to each value is determined by how well the query matches the corresponding key.

In self-attention, the queries, keys, and values all come from the same source: the output of the previous layer (or the input embeddings + positional encodings for the first layer).

Given an input matrix X of shape (seq_len, d_model), we compute:

```
Q = X @ W_Q    (seq_len, d_model) @ (d_model, d_k) = (seq_len, d_k)
K = X @ W_K    (seq_len, d_model) @ (d_model, d_k) = (seq_len, d_k)
V = X @ W_V    (seq_len, d_model) @ (d_model, d_v) = (seq_len, d_v)
```

W_Q, W_K, and W_V are learned parameter matrices. They project the input into three different representation spaces, allowing the model to compute "what am I looking for?", "what do I contain?", and "what information do I provide?" independently.

#### Scaled Dot-Product Attention

The attention function computes:

```
Attention(Q, K, V) = softmax(Q @ K^T / sqrt(d_k)) @ V
```

Let us break this down step by step:

1. **Q @ K^T**: Compute the dot product between every query and every key. Result shape: (seq_len, seq_len). Entry (i, j) is the raw compatibility score between token i's query and token j's key.

2. **/ sqrt(d_k)**: Scale by 1/sqrt(d_k) where d_k is the dimension of the key vectors. This scaling is critical.

3. **softmax(...)**: Apply softmax row-wise. Each row becomes a probability distribution over all positions. Entry (i, j) is the attention weight that token i assigns to token j.

4. **@ V**: Multiply the attention weights by the values. The output for token i is a weighted average of all value vectors, where the weights are the attention scores.

**Why scale by sqrt(d_k)?** Consider what happens without scaling. The dot product Q_i . K_j is the sum of d_k products of individual components. If Q and K have components with mean 0 and variance 1, the dot product has mean 0 and variance d_k. For d_k = 64, the dot products will typically range from about -16 to +16. When these large values are fed into softmax, the function saturates: it pushes almost all probability mass onto a single position, producing near-one-hot outputs. The gradients of saturated softmax are near zero, which kills training. Dividing by sqrt(d_k) brings the variance of the dot products back to 1, keeping softmax in a regime where gradients flow.

```python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(
    Q: torch.Tensor,
    K: torch.Tensor,
    V: torch.Tensor,
    mask: torch.Tensor = None,
    dropout: nn.Dropout = None
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Args:
        Q: (batch, heads, seq_len, d_k)
        K: (batch, heads, seq_len, d_k)
        V: (batch, heads, seq_len, d_v)
        mask: optional, broadcastable to (batch, heads, seq_len, seq_len)
    Returns:
        output: (batch, heads, seq_len, d_v)
        attention_weights: (batch, heads, seq_len, seq_len)
    """
    d_k = Q.size(-1)
    # (batch, heads, seq_len, seq_len)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

    if mask is not None:
        # Replace masked positions with -inf so softmax gives them zero weight
        scores = scores.masked_fill(mask == 0, float('-inf'))

    attention_weights = F.softmax(scores, dim=-1)

    if dropout is not None:
        attention_weights = dropout(attention_weights)

    output = torch.matmul(attention_weights, V)
    return output, attention_weights
```

#### Multi-Head Attention

Instead of performing a single attention function with d_model-dimensional keys, values, and queries, the paper found it beneficial to project Q, K, V into h separate subspaces and perform attention in parallel. This is multi-head attention.

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) @ W_O

where head_i = Attention(Q @ W_Q_i, K @ W_K_i, V @ W_V_i)
```

With h = 8 heads and d_model = 512:
- d_k = d_v = d_model / h = 512 / 8 = 64
- Each W_Q_i, W_K_i has shape (512, 64)
- Each W_V_i has shape (512, 64)
- W_O has shape (h * d_v, d_model) = (512, 512)

**Why multiple heads?** Different heads learn to attend to different types of relationships. In practice, researchers have observed that individual heads specialize. Some attend to the immediately preceding token (local syntax). Some attend to the corresponding position in a parallel clause (long-range structure). Some attend to specific syntactic roles (subject of the verb, object of the preposition). Multi-head attention gives the model the capacity to capture multiple relationship types simultaneously.

**Implementation.** In practice, we do not literally create h separate weight matrices. Instead, we use a single large weight matrix and reshape:

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"

        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads

        # Combined projections for all heads
        self.W_Q = nn.Linear(d_model, d_model)  # (d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model)
        self.W_O = nn.Linear(d_model, d_model)

        self.dropout = nn.Dropout(p=dropout)

    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor = None
    ) -> torch.Tensor:
        batch_size = query.size(0)

        # 1. Linear projections: (batch, seq_len, d_model) -> (batch, seq_len, d_model)
        Q = self.W_Q(query)
        K = self.W_K(key)
        V = self.W_V(value)

        # 2. Reshape to (batch, num_heads, seq_len, d_k)
        Q = Q.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = K.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = V.view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)

        # 3. Scaled dot-product attention
        attn_output, attn_weights = scaled_dot_product_attention(
            Q, K, V, mask=mask, dropout=self.dropout
        )

        # 4. Concatenate heads: (batch, num_heads, seq_len, d_k) -> (batch, seq_len, d_model)
        attn_output = attn_output.transpose(1, 2).contiguous().view(
            batch_size, -1, self.d_model
        )

        # 5. Final linear projection
        output = self.W_O(attn_output)
        return output
```

The `.view()` and `.transpose()` operations are the key trick. Instead of maintaining separate weight matrices per head, we project to the full d_model dimension and then reshape so that the head dimension becomes a separate axis. This is mathematically equivalent but far more efficient on GPU hardware because it uses a single large matrix multiplication instead of h smaller ones.

### Add & Norm (Residual Connection + Layer Normalization)

After each sub-layer (attention or feed-forward), the Transformer applies:

```
output = LayerNorm(x + Sublayer(x))
```

This is a residual connection followed by layer normalization. Both components are essential.

#### Residual Connections

Introduced by He et al. (2016) in ResNets, residual connections add the sub-layer's input directly to its output. This creates a "skip connection" that allows gradients to flow directly from later layers to earlier layers during backpropagation, bypassing the sub-layer entirely if needed.

Without residual connections, a 6-layer encoder would require gradients to pass through 12 sub-layers (6 attention + 6 feed-forward). With residual connections, gradients can take a shortcut directly from any layer to any earlier layer. This dramatically improves training stability, especially for deep networks.

Residual connections also make it easier for the network to learn the identity function. If a sub-layer is not useful, the network can simply drive its weights toward zero, and the residual connection ensures that the input passes through unchanged.

#### Layer Normalization

Layer normalization (Ba et al., 2016) normalizes the activations across the feature dimension (d_model) for each individual token and each individual training example.

Given a vector x of dimension d_model:

```
LayerNorm(x) = gamma * (x - mean(x)) / sqrt(var(x) + epsilon) + beta
```

Where gamma and beta are learned scale and shift parameters of dimension d_model, and epsilon is a small constant (typically 1e-5) for numerical stability.

**Why layer norm and not batch norm?** Batch normalization computes statistics across the batch dimension: for each feature, it computes the mean and variance across all examples in the batch. This has two problems for sequence models:

1. **Variable sequence lengths.** In a batch of sequences with different lengths, position 50 might exist in some sequences but not others. Batch statistics at position 50 would be computed over a varying subset of examples, introducing noise.

2. **Training-test discrepancy.** Batch norm maintains running averages during training but uses these fixed statistics at test time. For sequence models, the distribution of activations can vary significantly with sequence length, making these running averages unreliable.

Layer normalization computes statistics independently for each token in each example, avoiding both problems. It normalizes across the d_model dimension, which always has a fixed size.

```python
class AddAndNorm(nn.Module):
    def __init__(self, d_model: int, dropout: float = 0.1):
        super().__init__()
        self.layer_norm = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(p=dropout)

    def forward(self, x: torch.Tensor, sublayer_output: torch.Tensor) -> torch.Tensor:
        # Apply dropout to sublayer output, add residual, then normalize
        return self.layer_norm(x + self.dropout(sublayer_output))
```

**Note on Pre-Norm vs Post-Norm.** The original paper uses "Post-Norm": apply the sub-layer first, then add the residual, then normalize. Many modern implementations use "Pre-Norm" (normalize first, then apply the sub-layer, then add the residual), which has been shown to improve training stability for very deep models. The code above follows the original Post-Norm convention.

### Position-wise Feed-Forward Network

Each encoder layer contains a fully connected feed-forward network applied to each position independently and identically. "Position-wise" means the same linear transformation is applied to every token, but different tokens are processed independently (no interaction between positions in this sub-layer).

```
FFN(x) = max(0, x @ W1 + b1) @ W2 + b2
```

The inner dimension d_ff = 2048 is four times larger than d_model = 512. This creates an expansion-contraction pattern:

```
(seq_len, 512) @ (512, 2048) -> (seq_len, 2048)   [expand]
                   ReLU
(seq_len, 2048) @ (2048, 512) -> (seq_len, 512)    [contract]
```

**Why this expansion?** The feed-forward network serves as a "memory bank" for the model. Recent interpretability research (Geva et al., 2021) has shown that the first layer (W1) acts as a pattern detector, with each of the 2048 neurons activating for specific input patterns. The second layer (W2) maps those activated patterns to output representations. The expansion to 4x gives the model 2048 "slots" to store and retrieve learned patterns. This is analogous to a key-value memory where W1 provides the keys and W2 provides the values.

The ReLU activation introduces the only nonlinearity in this sub-layer. Without it, two consecutive linear transformations would collapse into a single linear transformation (matrix multiplication is associative), and the sub-layer would add no representational power.

```python
class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.linear1 = nn.Linear(d_model, d_ff)
        self.linear2 = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(p=dropout)
        self.relu = nn.ReLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, d_model)
        return self.linear2(self.dropout(self.relu(self.linear1(x))))
```

### Complete Encoder Layer

Combining all components, a single encoder layer looks like this:

```python
class EncoderLayer(nn.Module):
    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.self_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.feed_forward = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(p=dropout)
        self.dropout2 = nn.Dropout(p=dropout)

    def forward(self, x: torch.Tensor, src_mask: torch.Tensor = None) -> torch.Tensor:
        # Sub-layer 1: Multi-Head Self-Attention + Add & Norm
        attn_output = self.self_attention(x, x, x, mask=src_mask)
        x = self.norm1(x + self.dropout1(attn_output))

        # Sub-layer 2: Feed-Forward + Add & Norm
        ff_output = self.feed_forward(x)
        x = self.norm2(x + self.dropout2(ff_output))

        return x
```

The full encoder stacks 6 of these layers:

```python
class Encoder(nn.Module):
    def __init__(
        self, vocab_size: int, d_model: int, num_heads: int,
        d_ff: int, num_layers: int, max_len: int, dropout: float = 0.1
    ):
        super().__init__()
        self.embedding = TokenEmbedding(vocab_size, d_model)
        self.positional_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([
            EncoderLayer(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)  # Final layer norm

    def forward(self, src: torch.Tensor, src_mask: torch.Tensor = None) -> torch.Tensor:
        # src: (batch, src_len) of token indices
        x = self.embedding(src)
        x = self.positional_encoding(x)

        for layer in self.layers:
            x = layer(x, src_mask)

        return self.norm(x)
```

---

## The Decoder Stack

The decoder also consists of N = 6 identical layers, but each layer has three sub-layers instead of two. The additional sub-layer performs cross-attention over the encoder's output.

### Masked Multi-Head Self-Attention

The decoder generates output tokens one at a time, left to right. During training, we feed the entire target sequence into the decoder at once (for efficiency via "teacher forcing"), but we must prevent the decoder from "seeing" future tokens. If position i could attend to position j where j > i, the model would learn to cheat by looking at the answer instead of predicting it.

The solution is a **causal mask** (also called a "look-ahead mask"): a lower-triangular matrix that blocks attention to future positions.

```
For a sequence of length 4, the mask is:

     pos 0  pos 1  pos 2  pos 3
pos 0  [1      0      0      0  ]
pos 1  [1      1      0      0  ]
pos 2  [1      1      1      0  ]
pos 3  [1      1      1      1  ]
```

Positions with 0 are set to -infinity before softmax, so they receive zero attention weight. Position 0 can only attend to itself. Position 1 can attend to positions 0 and 1. Position 3 can attend to all positions.

```python
def create_causal_mask(seq_len: int) -> torch.Tensor:
    """
    Creates a lower-triangular causal mask.
    Returns: (1, 1, seq_len, seq_len) for broadcasting over batch and head dims.
    """
    mask = torch.tril(torch.ones(seq_len, seq_len)).unsqueeze(0).unsqueeze(0)
    return mask  # 1 = attend, 0 = block
```

The masked self-attention is identical to the encoder's self-attention in every other respect. The Q, K, V all come from the decoder's own representations, and multi-head splitting works the same way. The only difference is the mask.

### Encoder-Decoder Attention (Cross-Attention)

This is the bridge between the encoder and decoder. It allows each decoder position to attend to all positions in the encoder output.

The mechanism is the same as self-attention, but with a critical difference in the source of Q, K, and V:

- **Q** comes from the decoder (the output of the masked self-attention sub-layer)
- **K** and **V** come from the encoder output

This means the decoder forms queries from its own state ("what information do I need?") and searches through the encoder's representations ("what information is available from the input?"). The attention weights tell us how much each decoder position attends to each encoder position.

In machine translation, for example, when the decoder is generating the French word "chat", its query would attend strongly to the English word "cat" in the encoder output.

No additional code is needed. The same `MultiHeadAttention` class handles cross-attention. The difference is in how it is called:

```python
# Self-attention: Q, K, V all from the same source
self_attn_output = self.self_attention(query=x, key=x, value=x, mask=causal_mask)

# Cross-attention: Q from decoder, K and V from encoder
cross_attn_output = self.cross_attention(query=x, key=encoder_output, value=encoder_output, mask=src_mask)
```

### Complete Decoder Layer

```python
class DecoderLayer(nn.Module):
    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.masked_self_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.feed_forward = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(p=dropout)
        self.dropout2 = nn.Dropout(p=dropout)
        self.dropout3 = nn.Dropout(p=dropout)

    def forward(
        self,
        x: torch.Tensor,
        encoder_output: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        # Sub-layer 1: Masked Multi-Head Self-Attention + Add & Norm
        attn_output = self.masked_self_attention(x, x, x, mask=tgt_mask)
        x = self.norm1(x + self.dropout1(attn_output))

        # Sub-layer 2: Encoder-Decoder Cross-Attention + Add & Norm
        cross_output = self.cross_attention(x, encoder_output, encoder_output, mask=src_mask)
        x = self.norm2(x + self.dropout2(cross_output))

        # Sub-layer 3: Feed-Forward + Add & Norm
        ff_output = self.feed_forward(x)
        x = self.norm3(x + self.dropout3(ff_output))

        return x
```

The full decoder stacks 6 of these layers:

```python
class Decoder(nn.Module):
    def __init__(
        self, vocab_size: int, d_model: int, num_heads: int,
        d_ff: int, num_layers: int, max_len: int, dropout: float = 0.1
    ):
        super().__init__()
        self.embedding = TokenEmbedding(vocab_size, d_model)
        self.positional_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([
            DecoderLayer(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)

    def forward(
        self,
        tgt: torch.Tensor,
        encoder_output: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        # tgt: (batch, tgt_len) of token indices
        x = self.embedding(tgt)
        x = self.positional_encoding(x)

        for layer in self.layers:
            x = layer(x, encoder_output, src_mask, tgt_mask)

        return self.norm(x)
```

---

## Output Processing

### Linear Layer and Softmax

The decoder output has shape (batch, tgt_len, d_model). To generate a probability distribution over the vocabulary, we need two final transformations:

1. **Linear projection**: A weight matrix of shape (d_model, vocab_size) projects each decoder output vector from d_model dimensions to vocab_size dimensions. These raw scores are called **logits**.

2. **Softmax**: Converts the logits into a probability distribution. The token with the highest probability is the model's prediction.

```python
# In the Transformer class:
self.output_projection = nn.Linear(d_model, vocab_size)

# During forward pass:
logits = self.output_projection(decoder_output)  # (batch, tgt_len, vocab_size)
# Softmax is typically applied inside the loss function (CrossEntropyLoss)
# or during inference:
probs = F.softmax(logits, dim=-1)
```

### Weight Tying

The paper shares the weight matrix between the input embedding layer and the output projection layer. Both have shape (vocab_size, d_model) -- the output projection is the transpose of the embedding matrix.

**Why?** Three reasons:

1. **Parameter reduction.** With a vocabulary of 37,000 and d_model = 512, the embedding matrix has 37,000 * 512 = ~19 million parameters. Without weight tying, the output projection adds another 19 million. Sharing cuts this in half.

2. **Semantic consistency.** The embedding maps tokens to vectors in a semantic space. The output projection maps vectors back to tokens. It makes sense for these to be inverses of each other. If the embedding for "cat" is some vector v, the output projection should assign high probability to "cat" when the decoder output is close to v.

3. **Regularization.** Sharing weights constrains the model, acting as an implicit regularizer that prevents the embedding and output spaces from diverging.

```python
# Weight tying implementation:
self.output_projection.weight = self.encoder.embedding.embedding.weight
# (assumes shared vocabulary between source and target)
```

---

## The Complete Transformer

Assembling every component:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math


def scaled_dot_product_attention(Q, K, V, mask=None, dropout=None):
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    weights = F.softmax(scores, dim=-1)
    if dropout is not None:
        weights = dropout(weights)
    return torch.matmul(weights, V), weights


class TokenEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.d_model = d_model

    def forward(self, x):
        return self.embedding(x) * math.sqrt(self.d_model)


class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)

    def forward(self, x):
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)


class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads, dropout=0.1):
        super().__init__()
        assert d_model % num_heads == 0
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        self.W_Q = nn.Linear(d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model)
        self.W_O = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(p=dropout)

    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)
        Q = self.W_Q(query).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_K(key).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_V(value).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        attn_output, _ = scaled_dot_product_attention(Q, K, V, mask=mask, dropout=self.dropout)
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)
        return self.W_O(attn_output)


class PositionwiseFeedForward(nn.Module):
    def __init__(self, d_model, d_ff, dropout=0.1):
        super().__init__()
        self.linear1 = nn.Linear(d_model, d_ff)
        self.linear2 = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(p=dropout)

    def forward(self, x):
        return self.linear2(self.dropout(F.relu(self.linear1(x))))


class EncoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.self_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.feed_forward = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, x, src_mask=None):
        attn_output = self.self_attention(x, x, x, mask=src_mask)
        x = self.norm1(x + self.dropout1(attn_output))
        ff_output = self.feed_forward(x)
        x = self.norm2(x + self.dropout2(ff_output))
        return x


class DecoderLayer(nn.Module):
    def __init__(self, d_model, num_heads, d_ff, dropout=0.1):
        super().__init__()
        self.masked_self_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.cross_attention = MultiHeadAttention(d_model, num_heads, dropout)
        self.feed_forward = PositionwiseFeedForward(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
        self.dropout3 = nn.Dropout(dropout)

    def forward(self, x, encoder_output, src_mask=None, tgt_mask=None):
        attn_output = self.masked_self_attention(x, x, x, mask=tgt_mask)
        x = self.norm1(x + self.dropout1(attn_output))
        cross_output = self.cross_attention(x, encoder_output, encoder_output, mask=src_mask)
        x = self.norm2(x + self.dropout2(cross_output))
        ff_output = self.feed_forward(x)
        x = self.norm3(x + self.dropout3(ff_output))
        return x


class Encoder(nn.Module):
    def __init__(self, vocab_size, d_model, num_heads, d_ff, num_layers, max_len, dropout=0.1):
        super().__init__()
        self.embedding = TokenEmbedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([
            EncoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)

    def forward(self, src, src_mask=None):
        x = self.pos_encoding(self.embedding(src))
        for layer in self.layers:
            x = layer(x, src_mask)
        return self.norm(x)


class Decoder(nn.Module):
    def __init__(self, vocab_size, d_model, num_heads, d_ff, num_layers, max_len, dropout=0.1):
        super().__init__()
        self.embedding = TokenEmbedding(vocab_size, d_model)
        self.pos_encoding = PositionalEncoding(d_model, max_len, dropout)
        self.layers = nn.ModuleList([
            DecoderLayer(d_model, num_heads, d_ff, dropout) for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(d_model)

    def forward(self, tgt, encoder_output, src_mask=None, tgt_mask=None):
        x = self.pos_encoding(self.embedding(tgt))
        for layer in self.layers:
            x = layer(x, encoder_output, src_mask, tgt_mask)
        return self.norm(x)


class Transformer(nn.Module):
    def __init__(
        self,
        src_vocab_size: int,
        tgt_vocab_size: int,
        d_model: int = 512,
        num_heads: int = 8,
        d_ff: int = 2048,
        num_layers: int = 6,
        max_len: int = 5000,
        dropout: float = 0.1
    ):
        super().__init__()
        self.encoder = Encoder(src_vocab_size, d_model, num_heads, d_ff, num_layers, max_len, dropout)
        self.decoder = Decoder(tgt_vocab_size, d_model, num_heads, d_ff, num_layers, max_len, dropout)
        self.output_projection = nn.Linear(d_model, tgt_vocab_size)

        # Weight tying: share decoder embedding weights with output projection
        self.output_projection.weight = self.decoder.embedding.embedding.weight

        # Initialize parameters using Xavier uniform
        self._init_parameters()

    def _init_parameters(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(
        self,
        src: torch.Tensor,
        tgt: torch.Tensor,
        src_mask: torch.Tensor = None,
        tgt_mask: torch.Tensor = None
    ) -> torch.Tensor:
        encoder_output = self.encoder(src, src_mask)
        decoder_output = self.decoder(tgt, encoder_output, src_mask, tgt_mask)
        logits = self.output_projection(decoder_output)
        return logits

    @staticmethod
    def generate_causal_mask(sz: int) -> torch.Tensor:
        return torch.tril(torch.ones(sz, sz)).unsqueeze(0).unsqueeze(0)


# --- Usage Example ---
if __name__ == "__main__":
    # Hyperparameters matching the paper
    model = Transformer(
        src_vocab_size=37000,
        tgt_vocab_size=37000,
        d_model=512,
        num_heads=8,
        d_ff=2048,
        num_layers=6,
        max_len=5000,
        dropout=0.1
    )

    # Dummy input
    src = torch.randint(0, 37000, (2, 10))  # batch=2, src_len=10
    tgt = torch.randint(0, 37000, (2, 12))  # batch=2, tgt_len=12

    # Create causal mask for decoder
    tgt_mask = Transformer.generate_causal_mask(12)

    # Forward pass
    logits = model(src, tgt, tgt_mask=tgt_mask)
    print(f"Output shape: {logits.shape}")  # (2, 12, 37000)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")  # ~63 million for the base model
```

---

## The Math Deep Dive: A Worked Example

Let us trace through the complete attention computation with concrete numbers. We will use a tiny example: 3 tokens with d_model = 4 and a single attention head.

### Setup

Suppose our input after embedding and positional encoding is:

```
X = [[1.0, 0.0, 1.0, 0.0],    # Token 0: "the"
     [0.0, 1.0, 0.0, 1.0],    # Token 1: "cat"
     [1.0, 1.0, 0.0, 0.0]]    # Token 2: "sat"

Shape: (3, 4)
```

And our learned weight matrices (simplified for illustration) are:

```
W_Q = [[1, 0, 0, 0],       W_K = [[0, 1, 0, 0],       W_V = [[0, 0, 1, 0],
       [0, 1, 0, 0],              [1, 0, 0, 0],              [0, 0, 0, 1],
       [0, 0, 1, 0],              [0, 0, 0, 1],              [1, 0, 0, 0],
       [0, 0, 0, 1]]              [0, 0, 1, 0]]              [0, 1, 0, 0]]

Shape: (4, 4) each
```

### Step 1: Compute Q, K, V

```
Q = X @ W_Q
  = [[1*1+0*0+1*0+0*0, 1*0+0*1+1*0+0*0, 1*0+0*0+1*1+0*0, 1*0+0*0+1*0+0*1],
     [0*1+1*0+0*0+1*0, 0*0+1*1+0*0+1*0, 0*0+1*0+0*1+1*0, 0*0+1*0+0*0+1*1],
     [1*1+1*0+0*0+0*0, 1*0+1*1+0*0+0*0, 1*0+1*0+0*1+0*0, 1*0+1*0+0*0+0*1]]
  = [[1, 0, 1, 0],
     [0, 1, 0, 1],
     [1, 1, 0, 0]]

K = X @ W_K = [[0, 1, 0, 1],
               [1, 0, 1, 0],
               [1, 1, 0, 0]]

V = X @ W_V = [[0, 0, 1, 0],     (rearranged dimensions of original tokens)
               [0, 0, 0, 1],
               [1, 0, 1, 0]]     (different from the original -- that is the point)
```

### Step 2: Compute Q @ K^T

```
Q @ K^T = [[1*0+0*1+1*0+0*1,  1*1+0*0+1*1+0*0,  1*1+0*1+1*0+0*0],
           [0*0+1*1+0*0+1*1,  0*1+1*0+0*1+1*0,  0*1+1*1+0*0+1*0],
           [1*0+1*1+0*0+0*1,  1*1+1*0+0*1+0*0,  1*1+1*1+0*0+0*0]]
        = [[0, 2, 1],
           [2, 0, 1],
           [1, 1, 2]]

Shape: (3, 3)
```

Entry (i, j) tells us how much token i's query aligns with token j's key. Token 0 has the strongest alignment with Token 1 (score 2). Token 1 has the strongest alignment with Token 0 (score 2). Token 2 has the strongest alignment with itself (score 2).

### Step 3: Scale by sqrt(d_k)

```
d_k = 4, sqrt(d_k) = 2.0

Scaled scores = [[0/2, 2/2, 1/2],     = [[0.0, 1.0, 0.5],
                 [2/2, 0/2, 1/2],        [1.0, 0.0, 0.5],
                 [1/2, 1/2, 2/2]]        [0.5, 0.5, 1.0]]
```

### Step 4: Apply softmax (row-wise)

```
softmax([0.0, 1.0, 0.5]) = [e^0.0, e^1.0, e^0.5] / sum
                          = [1.000, 2.718, 1.649] / 5.367
                          = [0.186, 0.507, 0.307]

softmax([1.0, 0.0, 0.5]) = [2.718, 1.000, 1.649] / 5.367
                          = [0.507, 0.186, 0.307]

softmax([0.5, 0.5, 1.0]) = [1.649, 1.649, 2.718] / 6.016
                          = [0.274, 0.274, 0.452]

Attention weights:
A = [[0.186, 0.507, 0.307],
     [0.507, 0.186, 0.307],
     [0.274, 0.274, 0.452]]
```

Each row sums to 1. These are probability distributions telling us where each token looks.

### Step 5: Compute weighted sum of values

```
Output = A @ V

Row 0: 0.186*[0,0,1,0] + 0.507*[0,0,0,1] + 0.307*[1,0,1,0]
      = [0.000, 0.000, 0.186, 0.000] + [0.000, 0.000, 0.000, 0.507] + [0.307, 0.000, 0.307, 0.000]
      = [0.307, 0.000, 0.493, 0.507]

Row 1: 0.507*[0,0,1,0] + 0.186*[0,0,0,1] + 0.307*[1,0,1,0]
      = [0.307, 0.000, 0.814, 0.186]

Row 2: 0.274*[0,0,1,0] + 0.274*[0,0,0,1] + 0.452*[1,0,1,0]
      = [0.452, 0.000, 0.726, 0.274]

Final output:
[[0.307, 0.000, 0.493, 0.507],
 [0.307, 0.000, 0.814, 0.186],
 [0.452, 0.000, 0.726, 0.274]]

Shape: (3, 4)
```

Each output row is a blend of all value vectors, weighted by attention. Token 0's output is dominated by Token 1's value (weight 0.507) because Token 0's query aligned most strongly with Token 1's key. This is the fundamental mechanism by which context flows between tokens.

---

## Training Details

The paper specifies a precise training recipe. Every detail matters for reproducing the results.

### Label Smoothing

Standard cross-entropy training uses hard targets: the correct token gets probability 1, all others get 0. Label smoothing replaces this with soft targets: the correct token gets probability (1 - epsilon), and the remaining probability epsilon is distributed uniformly over all other tokens.

```
epsilon = 0.1 (as used in the paper)

Hard target:   [0, 0, 0, 1, 0, 0, ..., 0]  (one-hot)
Soft target:   [eps/V, eps/V, eps/V, 1-eps+eps/V, eps/V, eps/V, ..., eps/V]

where V = vocab_size
```

Label smoothing hurts perplexity (the model becomes less confident in its top prediction) but improves accuracy and BLEU score. It acts as a regularizer, preventing the model from becoming overconfident. It also encourages the model to maintain uncertainty over similar tokens, which helps with beam search during inference.

```python
class LabelSmoothingLoss(nn.Module):
    def __init__(self, vocab_size: int, padding_idx: int, smoothing: float = 0.1):
        super().__init__()
        self.vocab_size = vocab_size
        self.padding_idx = padding_idx
        self.smoothing = smoothing
        self.confidence = 1.0 - smoothing

    def forward(self, logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        # logits: (batch * seq_len, vocab_size)
        # target: (batch * seq_len,)
        log_probs = F.log_softmax(logits, dim=-1)

        # Create smooth distribution
        smooth_target = torch.full_like(log_probs, self.smoothing / (self.vocab_size - 2))
        smooth_target.scatter_(1, target.unsqueeze(1), self.confidence)
        smooth_target[:, self.padding_idx] = 0

        # Zero out padding positions
        mask = (target != self.padding_idx).unsqueeze(1)
        smooth_target = smooth_target * mask

        loss = -(smooth_target * log_probs).sum(dim=-1).mean()
        return loss
```

### Learning Rate Schedule

The paper uses a custom learning rate schedule with a linear warmup followed by inverse square root decay:

```
lr = d_model^(-0.5) * min(step^(-0.5), step * warmup_steps^(-1.5))
```

With warmup_steps = 4000:

- **Warmup phase (steps 1 to 4000):** The learning rate increases linearly from nearly 0 to the peak value. This prevents the model from making large, destructive updates early in training when the parameters are randomly initialized and the gradients are noisy.

- **Decay phase (steps 4001+):** The learning rate decays proportionally to 1/sqrt(step). This gradually reduces the step size as the model converges.

The peak learning rate occurs at step 4000 and equals:

```
lr_peak = d_model^(-0.5) * warmup_steps^(-0.5)
        = 512^(-0.5) * 4000^(-0.5)
        = 0.0442 * 0.0158
        = 0.000698
```

```python
class TransformerScheduler:
    def __init__(self, optimizer, d_model: int, warmup_steps: int = 4000):
        self.optimizer = optimizer
        self.d_model = d_model
        self.warmup_steps = warmup_steps
        self.step_num = 0

    def step(self):
        self.step_num += 1
        lr = self.d_model ** (-0.5) * min(
            self.step_num ** (-0.5),
            self.step_num * self.warmup_steps ** (-1.5)
        )
        for param_group in self.optimizer.param_groups:
            param_group['lr'] = lr
        return lr
```

### Optimizer

Adam optimizer with beta_1 = 0.9, beta_2 = 0.98, and epsilon = 1e-9. The beta_2 value is notably higher than the default (0.999), which reduces the influence of the second moment estimate and provides more stable training with the custom learning rate schedule.

```python
optimizer = torch.optim.Adam(
    model.parameters(),
    lr=0,  # Will be set by the scheduler
    betas=(0.9, 0.98),
    eps=1e-9
)
```

### Dropout

Dropout with P_drop = 0.1 is applied in three places:

1. **After positional encoding is added to embeddings** (both encoder and decoder).
2. **After the attention weights** (inside scaled dot-product attention, after softmax and before multiplication with V).
3. **After each sub-layer output** (before adding the residual and applying layer norm).

This is a relatively aggressive use of dropout, applied to nearly every intermediate computation. It is essential for preventing overfitting on the WMT training data.

### Batch Size and Training

The base model was trained with batches containing approximately 25,000 source tokens and 25,000 target tokens. Training ran for 100,000 steps on 8 NVIDIA P100 GPUs, taking about 12 hours. The big model (d_model=1024, d_ff=4096, h=16, N=6) trained for 300,000 steps over 3.5 days.

---

## Why Each Component Exists

| Component | Problem It Solves |
|---|---|
| Input Embedding | Converts discrete tokens into continuous vectors that neural networks can process |
| Positional Encoding | Injects sequence order information lost by removing recurrence |
| Multi-Head Self-Attention | Captures dependencies between all pairs of tokens in parallel |
| Scaling by sqrt(d_k) | Prevents softmax saturation and gradient vanishing for large d_k |
| Multiple Attention Heads | Allows the model to attend to different relationship types simultaneously |
| Residual Connections | Enables gradient flow through deep networks, stabilizes training |
| Layer Normalization | Stabilizes activations across the feature dimension, enabling deeper stacking |
| Feed-Forward Network | Provides nonlinearity and acts as a per-position "memory" for learned patterns |
| FFN Expansion (4x) | Gives the model enough capacity to store diverse pattern-value associations |
| Causal Mask | Prevents decoder from cheating by looking at future tokens during training |
| Cross-Attention | Allows decoder to query information from the encoder's input representation |
| Linear + Softmax | Maps d_model representations back to vocabulary probability distributions |
| Weight Tying | Reduces parameters and enforces consistency between embedding and output spaces |
| Label Smoothing | Regularizes training, prevents overconfidence, improves generation quality |
| Warmup Schedule | Prevents destructive early updates; gradual decay aids convergence |
| Dropout (everywhere) | Regularization against overfitting, applied to embeddings, attention, sub-layers |

---

## Comparison with Previous Architectures

### The Evolution: RNN to LSTM to Attention-Augmented to Transformer

**RNN (1986).** Process tokens sequentially. Hidden state h_t = f(h_{t-1}, x_t). Severe vanishing gradient problem. Cannot parallelize across time steps.

**LSTM (1997).** Added gating mechanisms (forget gate, input gate, output gate) to control information flow. Mitigated vanishing gradients but still sequential. The cell state acts as a "conveyor belt" for information, but it is still a fixed-size bottleneck.

**Attention-Augmented RNN (2014, Bahdanau et al.).** Added an attention mechanism on top of the RNN encoder-decoder. The decoder can attend to all encoder hidden states, not just the final one. This solved the bottleneck problem but kept the sequential RNN backbone.

**Transformer (2017).** Removed the RNN entirely. Attention is the only mechanism for capturing dependencies. Fully parallelizable. No bottleneck.

### Computational Complexity Comparison

| Layer Type | Complexity per Layer | Sequential Operations | Maximum Path Length |
|---|---|---|---|
| Self-Attention | O(n^2 * d) | O(1) | O(1) |
| Recurrent (RNN) | O(n * d^2) | O(n) | O(n) |
| Convolutional | O(k * n * d^2) | O(1) | O(log_k(n)) |
| Self-Attention (restricted) | O(r * n * d) | O(1) | O(n/r) |

Where n = sequence length, d = representation dimension, k = kernel size, r = neighborhood size for restricted attention.

**Key insight:** Self-attention has O(1) sequential operations (everything computes in parallel) and O(1) maximum path length (any token can attend directly to any other token). The cost is O(n^2) complexity in sequence length, which becomes problematic for very long sequences. This is the fundamental trade-off that motivated later work on efficient attention (Linformer, Performer, Flash Attention).

For typical NLP tasks where n < 1000 and d = 512, the O(n^2 * d) cost of self-attention is comparable to or less than the O(n * d^2) cost of recurrence. Self-attention becomes cheaper than recurrence when n < d, which holds for most practical sequence lengths.

---

## Impact and Variants

### BERT (Encoder-Only, 2018)

BERT (Bidirectional Encoder Representations from Transformers) uses only the Transformer encoder. It removes the decoder entirely and trains the encoder with two objectives: Masked Language Modeling (randomly mask 15% of tokens and predict them) and Next Sentence Prediction. Because there is no autoregressive generation, BERT can attend bidirectionally -- every token sees every other token.

BERT showed that pre-training a Transformer encoder on massive unlabeled text produces representations that transfer remarkably well to downstream tasks (question answering, sentiment analysis, named entity recognition) with minimal fine-tuning.

### GPT (Decoder-Only, 2018)

GPT (Generative Pre-trained Transformer) uses only the Transformer decoder, with the causal mask applied so each token can only attend to previous tokens. There is no encoder and no cross-attention. The model is trained with a simple language modeling objective: predict the next token.

The GPT family (GPT-2, GPT-3, GPT-4) scaled this approach to hundreds of billions of parameters and demonstrated that a single decoder-only Transformer, trained on enough data, can perform essentially any NLP task through in-context learning (providing task examples in the prompt).

### T5 (Encoder-Decoder, 2019)

T5 (Text-to-Text Transfer Transformer) uses the full encoder-decoder architecture from the original paper. It frames every NLP task as a text-to-text problem: the input is a text string (possibly with a task prefix like "translate English to French:") and the output is a text string. This unified framework showed that the encoder-decoder architecture remains competitive, especially for tasks where the input and output have different structures.

### Modern Innovations

**Flash Attention (2022).** Does not change the mathematical computation of attention. Instead, it restructures the memory access pattern to minimize reads and writes to GPU high-bandwidth memory (HBM). By computing attention in tiles and keeping intermediate results in fast SRAM, Flash Attention achieves 2-4x wall-clock speedup and enables much longer sequences without running out of memory.

**Rotary Position Embeddings (RoPE, 2021).** Encodes position information by rotating the query and key vectors in 2D subspaces. The rotation angle is a function of position. The key property is that the dot product between a rotated query and a rotated key depends only on the relative position difference, not the absolute positions. This gives the model natural relative position awareness and allows extrapolation to longer sequences than seen during training. Used by LLaMA, Mistral, and most modern open-source LLMs.

**KV Cache (inference optimization).** During autoregressive generation, the decoder generates one token at a time. At each step, it needs to compute attention over all previous tokens. Without caching, this means recomputing the K and V projections for all previous tokens at every step. The KV cache stores the previously computed K and V tensors and only computes K and V for the new token, reducing the per-step cost from O(n * d) to O(d). This is essential for practical deployment of large language models.

**Grouped Query Attention (GQA).** In standard multi-head attention, each head has its own K, V projections. GQA shares K, V projections across groups of heads (e.g., 8 heads share one K, V pair). This reduces the KV cache size proportionally, enabling longer contexts without proportionally increasing memory usage. Used in LLaMA 2 and later models.

**Mixture of Experts (MoE).** Replaces the single feed-forward network with multiple "expert" FFNs and a routing mechanism that selects a subset of experts for each token. This allows scaling the model's parameter count without proportionally increasing computation. Mixtral and GPT-4 are reported to use MoE architectures.

---

## Common Misconceptions

### "Attention replaces everything"

This is the most common misreading of the paper's title. Attention replaces recurrence, not everything. The feed-forward network is a critical component that provides the model's "memory" and nonlinear transformation capacity. Research has shown that removing or shrinking the FFN layers degrades performance substantially. The attention mechanism handles token-to-token interaction, but the FFN handles within-token computation. Both are essential.

### "Transformers don't understand position"

This misconception arises from the fact that self-attention is permutation-equivariant. But the Transformer explicitly addresses this with positional encodings added to the input. The positional information is baked into the representations from the very first layer. Experiments show that removing positional encodings catastrophically degrades performance on any task where order matters (which is virtually all language tasks).

### "All attention heads do the same thing"

Attention heads specialize dramatically. Visualization studies (Clark et al., 2019) have shown that in BERT, specific heads learn to attend to:
- The previous token (local context)
- The next token (forward context)
- The delimiter token (sentence structure)
- Tokens in the same syntactic constituent
- The subject of the main verb (long-range syntactic dependency)

Some heads even learn to approximate specific linguistic relations like coreference resolution. This specialization emerges naturally from training -- it is not programmed.

### "Bigger models are just memorizing"

While larger models do have more capacity for memorization, scaling research has shown that performance improvements from scale come primarily from better generalization, not more memorization. Larger models achieve lower loss on held-out test data, which is the definition of better generalization. The Transformer architecture's inductive biases (self-attention for relational reasoning, FFN for pattern storage) scale remarkably well.

### "The Transformer was invented from scratch"

The Transformer draws on several prior ideas: attention mechanisms (Bahdanau, 2014), self-attention for NLP (Parikh et al., 2016; Lin et al., 2017), residual connections (He et al., 2016), and layer normalization (Ba et al., 2016). The paper's contribution was showing that attention alone, without any recurrent or convolutional components, is sufficient for state-of-the-art sequence modeling, and that this approach is substantially more parallelizable and faster to train.

---

## Lab Setup Ideas

### Lab 1: Build a Character-Level Transformer

Build a tiny Transformer for character-level text generation. Use Shakespeare or another small text corpus.

```python
# Suggested hyperparameters for a character-level toy model:
# vocab_size = 65 (printable ASCII characters)
# d_model = 64
# num_heads = 4
# d_ff = 256
# num_layers = 3
# max_len = 128
# dropout = 0.1
# batch_size = 32
# learning_rate = 3e-4

# This trains in minutes on a single GPU and generates
# semi-coherent text after a few thousand steps.
# Use a decoder-only architecture (GPT-style) for simplicity.
```

Steps:
1. Implement character-level tokenization (each character is a token).
2. Build the decoder-only Transformer using the components from this article.
3. Train with cross-entropy loss on next-character prediction.
4. Generate text by sampling from the output distribution autoregressively.
5. Experiment: vary the number of heads (1, 2, 4, 8) and observe how generation quality changes.

### Lab 2: Visualize Attention Patterns

Extract and visualize the attention weights from a trained model.

```python
# After a forward pass, extract attention weights from each head:
# attn_weights shape: (batch, num_heads, seq_len, seq_len)
#
# Plot as a heatmap using matplotlib:
import matplotlib.pyplot as plt

def plot_attention(attn_weights, tokens, head_idx=0):
    """
    attn_weights: (seq_len, seq_len) for one head
    tokens: list of token strings
    """
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.imshow(attn_weights, cmap='viridis')
    ax.set_xticks(range(len(tokens)))
    ax.set_yticks(range(len(tokens)))
    ax.set_xticklabels(tokens, rotation=45, ha='right')
    ax.set_yticklabels(tokens)
    ax.set_xlabel('Key (attended to)')
    ax.set_ylabel('Query (attending)')
    ax.set_title(f'Attention Head {head_idx}')
    plt.tight_layout()
    plt.show()
```

Questions to investigate:
- Do different heads show different patterns?
- Can you identify heads that attend to adjacent tokens vs distant tokens?
- How do attention patterns change across layers (early layers vs late layers)?

### Lab 3: Experiment with Architecture Variations

Systematically ablate components to understand their importance:

1. **Remove positional encoding.** Train the same model without PE. Measure the performance drop. This demonstrates how critical position information is.
2. **Vary the number of heads.** Try 1, 2, 4, 8, 16 heads with the same d_model. Observe the trade-off between per-head capacity (d_k = d_model/h) and number of perspectives.
3. **Remove the FFN.** Replace the feed-forward network with an identity function. This isolates the contribution of attention alone.
4. **Change the FFN ratio.** Try d_ff = d_model, 2 * d_model, 4 * d_model, 8 * d_model. Observe how this affects model capacity and training speed.
5. **Pre-Norm vs Post-Norm.** Move the LayerNorm to before the sub-layer instead of after. Compare training stability and final performance.

### Lab 4: Implement Beam Search

Extend your Transformer with beam search decoding instead of greedy decoding.

```python
def beam_search(model, src, beam_width=5, max_len=50, sos_idx=1, eos_idx=2):
    """
    Basic beam search for encoder-decoder Transformer.
    """
    encoder_output = model.encoder(src)

    # Start with SOS token
    beams = [(torch.tensor([[sos_idx]]), 0.0)]  # (sequence, log_probability)

    for _ in range(max_len):
        all_candidates = []
        for seq, score in beams:
            if seq[0, -1].item() == eos_idx:
                all_candidates.append((seq, score))
                continue

            tgt_mask = Transformer.generate_causal_mask(seq.size(1))
            logits = model.output_projection(
                model.decoder(seq, encoder_output, tgt_mask=tgt_mask)
            )
            log_probs = F.log_softmax(logits[:, -1, :], dim=-1)
            top_log_probs, top_indices = log_probs.topk(beam_width)

            for i in range(beam_width):
                next_token = top_indices[0, i].unsqueeze(0).unsqueeze(0)
                new_seq = torch.cat([seq, next_token], dim=1)
                new_score = score + top_log_probs[0, i].item()
                all_candidates.append((new_seq, new_score))

        # Select top beam_width candidates
        all_candidates.sort(key=lambda x: x[1], reverse=True)
        beams = all_candidates[:beam_width]

        # Check if all beams have ended
        if all(seq[0, -1].item() == eos_idx for seq, _ in beams):
            break

    return beams[0][0]  # Return the highest-scoring sequence
```

---

## Conclusion

The Transformer architecture is deceptively simple. It consists of only a handful of distinct components: embeddings, positional encodings, multi-head attention, feed-forward networks, residual connections, and layer normalization. Yet the interaction of these components produces a system capable of learning language, code, reasoning, and more.

The key ideas to internalize are:

1. **Self-attention computes pairwise relationships between all tokens in parallel.** This replaces the sequential processing of RNNs and allows the model to capture long-range dependencies directly.

2. **Multi-head attention provides multiple "views" of the same data.** Each head can specialize in different types of relationships.

3. **The feed-forward network is not a minor detail.** It provides the model's per-token computation capacity and serves as a learned pattern memory.

4. **Residual connections and layer normalization are structural necessities, not optional enhancements.** Without them, training a 6-layer (or 96-layer) Transformer is not feasible.

5. **The training recipe matters as much as the architecture.** Label smoothing, warmup schedules, and aggressive dropout are all essential to the original results.

Every modern large language model is a direct descendant of the architecture described in this article. BERT, GPT, T5, LLaMA, Claude, Gemini -- they all share these foundational components. Understanding them gives you the ability to reason about model behavior, debug training failures, design new architectures, and evaluate the security properties of AI systems deployed in production.

The paper's title was bold. Seven years later, it has proven prophetic. Attention really is all you need -- at least as a starting point. The components we have dissected here remain the foundation upon which the entire field is built.

---

## References

1. Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., & Polosukhin, I. (2017). Attention Is All You Need. *Advances in Neural Information Processing Systems 30 (NeurIPS 2017)*.
2. Bahdanau, D., Cho, K., & Bengio, Y. (2014). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR 2015*.
3. He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep Residual Learning for Image Recognition. *CVPR 2016*.
4. Ba, J. L., Kiros, J. R., & Hinton, G. E. (2016). Layer Normalization. *arXiv:1607.06450*.
5. Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. *NAACL 2019*.
6. Radford, A., Narasimhan, K., Salimans, T., & Sutskever, I. (2018). Improving Language Understanding by Generative Pre-Training. *OpenAI*.
7. Raffel, C., Shazeer, N., Roberts, A., Lee, K., Narang, S., Matena, M., Zhou, Y., Li, W., & Liu, P. J. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer. *JMLR 2020*.
8. Dao, T., Fu, D. Y., Ermon, S., Rudra, A., & Re, C. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness. *NeurIPS 2022*.
9. Su, J., Lu, Y., Pan, S., Murtadha, A., Wen, B., & Liu, Y. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding. *arXiv:2104.09864*.
10. Geva, M., Schuster, R., Berant, J., & Levy, O. (2021). Transformer Feed-Forward Layers Are Key-Value Memories. *EMNLP 2021*.
11. Clark, K., Khandelwal, U., Levy, O., & Manning, C. D. (2019). What Does BERT Look At? An Analysis of BERT's Attention. *ACL 2019 Workshop BlackboxNLP*.
