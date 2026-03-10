---
sidebar_position: 1
title: Local LLM Evaluator
---

# Benchmarking Local LLMs With Custom Datasets

Running LLMs locally via [Ollama](https://ollama.com) has become increasingly practical, but selecting the right model for a specific use case usually means testing models manually — swapping them out, re-running the same prompts, and trying to compare outputs across sessions. That process is tedious and inconsistent.

**local-llm-evaluator** is a Python tool I built to automate that workflow. It runs a defined set of prompts against one or more local models simultaneously, then generates a timestamped HTML report with each model's output and response metrics side by side.

## Why Local?

Cloud-based LLMs are useful, but they come with a hard constraint: your prompts leave your machine. For security research, internal tooling, or anything involving sensitive context, that's often a non-starter. Local models eliminate that concern entirely — no data leaves your environment, no API keys, no usage telemetry.

The tradeoff is that local model performance varies significantly depending on hardware and the task being evaluated. This tool makes that comparison objective and reproducible.

## How It Works

The evaluator is driven by a `eval_prompts.json` file that you define. Each entry has a `task` label (metadata for your own reference) and a `prompt` field (what gets sent to the model). You can test anything: code generation, summarization, reasoning tasks, domain-specific queries — whatever you're trying to optimize for.

When you run the evaluator, it iterates through each model and prompt combination, captures the output, and writes everything to a structured HTML report in the `/results/` directory.

## Prerequisites

- [Ollama](https://ollama.com/download) installed and running
- At least one model pulled locally (e.g., `ollama pull codellama`)

:::tip
If you're new to running local LLMs, research hardware requirements before pulling large models. VRAM is the primary bottleneck — a model that won't fit in VRAM will fall back to CPU and run significantly slower.
:::

## Use Cases

This tool is useful any time you need to make a deliberate model selection rather than defaulting to whatever's available:

- Comparing a coding-focused model (e.g., `codellama`) against a general-purpose model for a scripting task
- Evaluating whether a smaller, faster model is sufficient for your workflow before committing to a larger one
- Running consistent regression tests when a new model version is released

```bash
# Clone and set up
git clone https://github.com/Spectral-Knight-Ops/local-llm-evaluator.git
cd local-llm-evaluator

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate.bat  # Windows

# Install dependencies
pip install -r requirements.txt

# Run the evaluator
python3 -m llm_eval.evaluator
```

Results are saved as `eval_results_<date>_<time>.html` — open it in any browser.

## What's Next

Planned improvements include a prebuilt Docker container for consistent, portable environments without manual setup.

---

**GitHub:** [Spectral-Knight-Ops/local-llm-evaluator](https://github.com/Spectral-Knight-Ops/local-llm-evaluator)
