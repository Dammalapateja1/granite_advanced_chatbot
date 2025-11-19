# backend_core/memory_handler.py

from typing import Dict, List

# In-memory store: session_id -> list of {role, content}
_conversations: Dict[str, List[Dict[str, str]]] = {}


def add_message(session_id: str, role: str, content: str) -> None:
    """
    Append a message to a session conversation.
    role: "user" or "assistant"
    """
    if not session_id:
        session_id = "default"
    conv = _conversations.setdefault(session_id, [])
    conv.append({"role": role, "content": content})


def get_history(session_id: str) -> List[Dict[str, str]]:
    """
    Return the list of messages for this session.
    """
    return list(_conversations.get(session_id, []))


def format_history_for_prompt(session_id: str) -> str:
    """
    Format the conversation as plain text for the LLM prompt.
    """
    conv = _conversations.get(session_id, [])
    lines = []
    for msg in conv:
        role = msg.get("role", "user")
        prefix = "User" if role == "user" else "Assistant"
        lines.append(f"{prefix}: {msg.get('content', '')}")
    return "\n".join(lines)


def clear_history(session_id: str) -> None:
    """
    Remove all messages for this session.
    """
    _conversations.pop(session_id, None)
