# backend_core/utils_core.py

"""
Core utilities for prompt building and text streaming.

This file defines:
- get_mode_instructions(mode)
- build_prompt(history_prompt, user_message, rag_context, mode)
- sanitize_stream_text(text)

The goal is to make each mode (general / coding / teacher / summarizer)
behave differently while still using the same Granite model.
"""

from __future__ import annotations

from typing import List, Dict, Any


def _format_rag_context(rag_hits: List[Dict[str, Any]], max_chars: int = 2000) -> str:
    """
    Turn retrieved RAG chunks into a compact text block.
    Each hit is expected to be a dict with at least 'text' and optionally 'source'.
    If the structure is different, we fall back to str(hit).
    """
    if not rag_hits:
        return ""

    lines: List[str] = []
    total_len = 0

    for i, hit in enumerate(rag_hits, start=1):
        if isinstance(hit, dict):
            text = hit.get("text") or hit.get("chunk") or ""
            source = hit.get("source_name") or hit.get("source") or ""
        else:
            text = str(hit)
            source = ""

        if not text:
            continue

        header = f"[{i}]"
        if source:
            header += f" (source: {source})"

        block = f"{header}\n{text.strip()}\n"
        if total_len + len(block) > max_chars:
            break

        lines.append(block)
        total_len += len(block)

    return "\n".join(lines).strip()


def get_mode_instructions(mode: str) -> str:
    """
    Return natural-language instructions for the selected mode.
    This is where we make 'general', 'coding', 'teacher' and
    'summarizer' feel like different "agents".
    """
    mode = (mode or "general").lower()

    if mode == "coding":
        return (
            "You are GRANITE-CODE, a senior software engineer.\n"
            "- Focus on code, debugging, architecture and best practices.\n"
            "- Prefer concrete examples over theory.\n"
            "- When you show code, use clear fenced code blocks with the right language.\n"
            "- Explain in short bullet points after the code what it does.\n"
            "- If the user does not specify a language, pick a reasonable default (often Python or JavaScript).\n"
        )

    if mode == "teacher":
        return (
            "You are GRANITE-TEACHER, a patient teacher and mentor.\n"
            "- Explain concepts step by step, starting from basics.\n"
            "- Use simple language, short sentences and concrete examples.\n"
            "- When helpful, use numbered lists and analogies.\n"
            "- Regularly check understanding and invite questions.\n"
        )

    if mode == "summarizer":
        return (
            "You are GRANITE-SUMMARIZER, an expert summarization assistant.\n"
            "- Your main job is to produce concise, accurate summaries.\n"
            "- Prefer bullet lists and short paragraphs.\n"
            "- Highlight key points, decisions, and action items.\n"
            "- If the user asks for a specific summary style (e.g., 3 bullets, TL;DR), follow it.\n"
        )

    # default: general assistant
    return (
        "You are GRANITE-ASSISTANT, a helpful, concise AI assistant.\n"
        "- Answer clearly and directly.\n"
        "- Use friendly, professional tone.\n"
        "- When the user asks for code, provide code with minimal explanation.\n"
        "- When the user asks for reasoning or learning, explain your steps.\n"
    )


def build_prompt(
    *,
    history_prompt: str,
    user_message: str,
    rag_context: List[Dict[str, Any]] | None,
    mode: str = "general",
) -> str:
    """
    Build the final text prompt sent to the Granite model.

    Parameters
    ----------
    history_prompt : str
        Text version of the previous conversation (from memory_handler).
    user_message : str
        The new user message.
    rag_context : list[dict] | None
        Retrieved chunks from the vector store.
    mode : str
        One of: "general", "coding", "teacher", "summarizer".

    Returns
    -------
    str
        The full prompt string to give to the LLM.
    """
    mode_instructions = get_mode_instructions(mode)
    rag_block = _format_rag_context(rag_context or [])

    # We treat this as a "system + history + context + user" style prompt.
    # Granite is instruction-tuned, so a clear structure works well.
    prompt_parts: List[str] = []

    # System / role
    prompt_parts.append(
        "You are Granite, an advanced large language model developed to run locally.\n"
        "Always stay within your mode instructions and be safe and honest.\n"
    )

    # Mode-specific instructions
    prompt_parts.append("### Mode instructions\n")
    prompt_parts.append(mode_instructions.strip() + "\n")

    # RAG context (if any)
    if rag_block:
        prompt_parts.append("### Retrieved context from user documents\n")
        prompt_parts.append(
            "The following snippets come from documents the user uploaded. "
            "Use them as authoritative reference when answering, but do NOT "
            "quote them blindly if they contradict obvious facts.\n"
        )
        prompt_parts.append(rag_block + "\n")

    # Conversation history
    if history_prompt.strip():
        prompt_parts.append("### Conversation so far\n")
        prompt_parts.append(history_prompt.strip() + "\n")

    # Current user message
    prompt_parts.append("### Current user message\n")
    prompt_parts.append(f"User: {user_message.strip()}\n")
    prompt_parts.append("Assistant:")

    return "\n".join(prompt_parts)


def sanitize_stream_text(text: str) -> str:
    """
    Light cleanup for streamed text pieces from the model.
    Removes stray control characters and normalizes newlines.
    """
    if not text:
        return ""
    # Basic normalization – you can extend this if needed.
    cleaned = text.replace("\r", "")
    return cleaned
