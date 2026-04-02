# Transformers Deep Dive Series

---

**Series:** Transformers — From "Attention Is All You Need" to the Age of Large Language Models
**Parts:** 3 (Part 0 through Part 2)
**Audience:** Developers, ML engineers, AI researchers, and students who know basic neural networks but want to deeply understand the Transformer architecture and everything it spawned
**Based on:** "Attention Is All You Need" (Vaswani et al., 2017)

---

## Series Overview

In June 2017, eight researchers at Google published a paper that would become the most cited work in the history of artificial intelligence. "Attention Is All You Need" introduced the Transformer architecture, a model that replaced recurrence with pure attention and rewrote every rule about how machines process language, images, code, audio, and protein sequences.

This series breaks down that paper from first principles, walks through the full architecture with working PyTorch code, and then traces every major innovation that followed: BERT, GPT, T5, Vision Transformers, ChatGPT, RLHF, multimodal models, Mixture of Experts, and the modern LLM landscape.

---

## Parts

| Part | Title | Focus |
|------|-------|-------|
| [Part 0](transformer-deep-dive-part-0.md) | **The Paper: From Recurrence to Revolution** | Why RNNs failed, the core idea, self-attention from scratch, Query-Key-Value mechanics, scaled dot-product attention, multi-head attention, positional encoding |
| [Part 1](transformer-deep-dive-part-1.md) | **The Architecture: Inside the Transformer** | Encoder and decoder stacks, masked attention, residual connections, layer normalization, full architecture walkthrough, training process, complexity analysis, limitations, PyTorch implementation, related concepts |
| [Part 2](transformer-deep-dive-part-2.md) | **The Revolution: How One Paper Rewrote All of AI** | BERT, GPT family, T5, Vision Transformers, modern LLMs (LLaMA, Mistral, Claude, Gemini), ChatGPT, RLHF, multimodal models, Mixture of Experts, sparse attention, code generation, AlphaFold, and what comes next |

---

## Prerequisites

- Basic understanding of neural networks (what a layer is, what weights are, what backpropagation does)
- Familiarity with Python and NumPy
- Basic linear algebra (matrix multiplication, dot products, transpose)
- No prior Transformer knowledge required — we build everything from scratch

---

## How to Read This Series

Start with Part 0. It builds the intuition you need for everything that follows. Part 1 is where the engineering lives: architecture details and working code. Part 2 is where you see why any of this matters: every major AI system built in the last seven years traces directly back to this one paper.
