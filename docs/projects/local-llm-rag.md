---
sidebar_position: 2
title: Local LLM With RAG
---

# A Private Knowledge Assistant Powered by Your Own Documents

Fine-tuning or training a model on custom data requires significant compute resources and is overkill for most practical use cases. Retrieval-Augmented Generation (RAG) solves this differently — instead of baking your data into the model's weights, it retrieves relevant context from your documents at query time and passes it to the model alongside your question.

**local-llm-with-rag-template** is a Python template that wires this together locally: your documents get indexed into a vector database (ChromaDB), a FastAPI backend handles queries, and a Streamlit web UI provides an interactive chat interface — all running on your own hardware via Ollama.

## How RAG Works Here

When you submit a query, the system searches the vector database for the most semantically relevant chunks from your indexed documents, injects them into the prompt as context, and then passes that to the LLM. The model uses both the retrieved context and its own training to formulate a response. The quality of your documents directly affects the quality of the output — well-structured, clearly labeled documents index and retrieve better.

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/Spectral-Knight-Ops/local-llm-with-rag-template
cd local-llm-with-rag-template

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate.bat    # Windows

# 3. Install dependencies
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
```

Once dependencies are installed:

1. Drop your `.txt` documents into the `/docs/` directory
2. Edit `rag.py` to set your model and adjust the system prompt for your use case
3. Build the vector index:

```bash
cd local_llm
python -c "from rag import initialize_index; initialize_index('../docs', reindex=True)"
```

4. Start the API server from the project root:

```bash
uvicorn local_llm.api:app --reload
```

5. Launch the web UI in a separate terminal:

```bash
cd local_llm
streamlit run chat_ui.py
```

The UI opens automatically in your browser. Streamlit also provides a network URL — useful if you want to run the model on a dedicated machine and access it from elsewhere on your network.

:::tip
The index needs to be rebuilt any time you add or remove documents from `/docs/`. Re-run the `initialize_index` command after making changes.
:::

:::warning
Currently only `.txt` files are supported for document ingestion. Additional file type support is planned.
:::

## Use Cases

The template is intentionally generic so it can be adapted to whatever knowledge base you're working with — personal notes, cheat sheets, internal documentation, research datasets, or domain-specific reference material. Because everything runs locally, none of your documents or queries leave your machine.

If you're unsure which model to use, the [local-llm-evaluator](https://github.com/Spectral-Knight-Ops/local-llm-evaluator) project can help you benchmark candidates against your specific prompts before committing to one.

## What's Next

Planned improvements include support for additional file types, a Docker container for portable deployment, internet RAG support, a toggle to bypass RAG when not needed, and document tagging examples to improve retrieval accuracy.

---

**GitHub:** [Spectral-Knight-Ops/local-llm-with-rag-template](https://github.com/Spectral-Knight-Ops/local-llm-with-rag-template)
