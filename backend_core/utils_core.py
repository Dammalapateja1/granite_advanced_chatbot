# backend_core/utils_core.py

"""
Utility helpers for prompt building, formatting, and RAG context merging.
"""

from typing import List, Dict, Optional
import html


def build_prompt(
    history_prompt: str,
    user_message: str,
    rag_context: Optional[List[Dict[str, str]]] = None,
    mode: str = "general",
) -> str:
    """
    Creates the final prompt string given:
    - conversation history
    - user message
    - optional RAG-retrieved chunks
    - mode: "general" | "coding" | "teacher" | "summarizer"
    """

    base_inst = (
        "You are Granite, a helpful, honest AI assistant running locally for the user. "
        "Answer clearly and directly. "
        "If you don't know, say so instead of guessing. "
        "Do NOT include prefixes like 'User:' or 'Assistant:' in your reply. "
    )

    if mode == "coding":
        mode_inst = (
            "You are acting as a senior software engineer. "
            "Prefer clear, commented code. "
            "Explain briefly what the code does, then show the code. "
        )
    elif mode == "teacher":
        mode_inst = (
            "You are acting as a patient teacher. "
            "Explain concepts step by step, using simple language and small examples. "
        )
    elif mode == "summarizer":
        mode_inst = (
            "You are acting as a summarization assistant. "
            "Produce concise summaries highlighting key points and avoiding repetition. "
        )
    else:
        mode_inst = "You are in general chat mode. "

    system_inst = base_inst + mode_inst

    prompt = system_inst + "\n\n"

    if history_prompt.strip():
        prompt += "Conversation so far:\n"
        prompt += history_prompt.strip() + "\n\n"

    if rag_context:
        prompt += "Useful context from the user's documents:\n"
        for idx, item in enumerate(rag_context, start=1):
            txt = item["text"].replace("\n", " ").strip()
            src = item.get("source", "document")
            prompt += f"[Context {idx} from {src}]: {txt}\n"
        prompt += "\n"

    prompt += f"User message: {user_message}\n\nAssistant reply:"
    return prompt


def sanitize_stream_text(text: str) -> str:
    """
    Streaming-safe cleaning so the browser doesn't break.
    """
    text = text.replace("\r", "").replace("\t", " ")
    text = html.escape(text)
    return text


def summarize_rag_hits(hits: List[Dict[str, str]]) -> str:
    """
    Debug helper (not used by LLM directly).
    """
    lines = []
    for h in hits:
        lines.append(f"({h['source']}) {h['text'][:50]}...")
    return "\n".join(lines)
