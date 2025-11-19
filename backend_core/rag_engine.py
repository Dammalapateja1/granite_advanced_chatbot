# backend_core/rag_engine.py

"""
Simple in-memory RAG engine.

- Add text from uploaded files (PDF, DOCX, TXT, images)
- Text is chunked into small pieces
- Each chunk is embedded with the Granite embedding model
- We use FAISS for vector search
"""

from typing import List, Dict, Any
import os

import faiss
import numpy as np
from pypdf import PdfReader
import docx
from PIL import Image
import pytesseract

from model_loader import embed_texts

# Try to locate Tesseract automatically on Windows
def _configure_tesseract():
    possible_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            print(f"[rag_engine] Using Tesseract at: {p}")
            return
    # If none found, rely on PATH. If not in PATH, OCR will raise an error.
    print("[rag_engine] Tesseract exe not set explicitly; relying on system PATH.")

_configure_tesseract()

# --------- Global in-memory store ---------

_index = None  # FAISS index
_chunks: List[str] = []  # list of chunk texts
_metadata: List[Dict[str, Any]] = []  # metadata per chunk (source, etc.)


# --------- Helpers ---------


def _ensure_index(dim: int):
    """
    Create FAISS index if it does not exist yet.
    """
    global _index
    if _index is None:
        _index = faiss.IndexFlatL2(dim)


def _chunk_text(text: str, max_chars: int = 800, overlap: int = 200) -> List[str]:
    """
    Simple character-based chunking with overlap.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    chunks: List[str] = []

    start = 0
    length = len(text)

    while start < length:
        end = min(start + max_chars, length)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == length:
            break
        start = max(0, end - overlap)

    return chunks


# --------- Document loaders ---------


def load_text_from_file(path: str) -> str:
    """
    Load text from a PDF, DOCX, TXT file or image (PNG/JPG/etc.).
    """
    ext = os.path.splitext(path)[1].lower()
    print(f"[rag_engine] Loading file {path} with ext {ext}")

    # PDF
    if ext == ".pdf":
        reader = PdfReader(path)
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        text = "\n\n".join(pages)
        print(f"[rag_engine] Extracted {len(text)} chars from PDF")
        return text

    # Word docs
    elif ext in (".docx", ".doc"):
        document = docx.Document(path)
        paras = [p.text for p in document.paragraphs]
        text = "\n".join(paras)
        print(f"[rag_engine] Extracted {len(text)} chars from DOCX")
        return text

    # Plain text / markdown
    elif ext in (".txt", ".md"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        print(f"[rag_engine] Loaded {len(text)} chars from text file")
        return text

    # Images (OCR)
    elif ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"):
        print(f"[rag_engine] Running OCR on image {path}")
        try:
            img = Image.open(path)
            text = pytesseract.image_to_string(img)
            print(f"[rag_engine] OCR extracted {len(text)} chars from image")
            return text
        except Exception as e:
            print(f"[rag_engine] OCR failed for {path}: {e}")
            # Return empty string so we don't index garbage
            return ""

    # Fallback: treat as plain text
    else:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        print(f"[rag_engine] Fallback loader, got {len(text)} chars")
        return text


# --------- Public API ---------


def add_document_from_text(text: str, source_name: str) -> int:
    """
    Add raw text into the RAG corpus.
    Returns the number of chunks added.
    """
    global _chunks, _metadata, _index

    text = text or ""
    if not text.strip():
        print("[rag_engine] No text to index (empty).")
        return 0

    chunks = _chunk_text(text)
    if not chunks:
        print("[rag_engine] No chunks created from text.")
        return 0

    # Embed chunks
    embeddings = embed_texts(chunks)  # (n_chunks, dim)
    n_chunks, dim = embeddings.shape

    # Ensure FAISS index
    _ensure_index(dim)

    # Add to FAISS
    _index.add(embeddings)

    # Save chunks + metadata
    for chunk in chunks:
        _chunks.append(chunk)
        _metadata.append({"source": source_name})

    print(f"[rag_engine] Added {n_chunks} chunks from source '{source_name}'")
    return n_chunks


def add_document_from_file(path: str, source_name: str = None) -> int:
    """
    Convenience wrapper: load text from file and index it.
    """
    if source_name is None:
        source_name = os.path.basename(path)

    try:
        text = load_text_from_file(path)
    except Exception as e:
        print(f"[rag_engine] Failed to read file {path}: {e}")
        return 0

    return add_document_from_text(text, source_name)


def corpus_size() -> int:
    """
    How many chunks are stored.
    """
    return len(_chunks)


def query_corpus(query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """
    Search the RAG corpus for the most relevant chunks.
    Returns a list of dicts: {text, score, source}
    """
    global _index, _chunks, _metadata

    if _index is None or corpus_size() == 0:
        return []

    query_vec = embed_texts([query])  # (1, dim)

    distances, indices = _index.search(query_vec, min(top_k, corpus_size()))
    distances = distances[0]
    indices = indices[0]

    results: List[Dict[str, Any]] = []
    for idx, dist in zip(indices, distances):
        if idx < 0 or idx >= len(_chunks):
            continue
        results.append(
            {
                "text": _chunks[idx],
                "score": float(dist),
                "source": _metadata[idx].get("source", "unknown"),
            }
        )

    return results
