# backend_core/model_loader.py

import threading
import sys
from typing import List

import numpy as np

# Try to import torch with helpful error message if it fails
try:
    import torch
except OSError as e:
    if "c10.dll" in str(e) or "could not be found" in str(e).lower():
        print("\n" + "="*70)
        print("ERROR: PyTorch cannot load required DLL files.")
        print("="*70)
        print("\nThis is typically caused by missing Visual C++ Redistributable.")
        print("\nTo fix this issue:")
        print("1. Download and install Visual C++ Redistributable from:")
        print("   https://aka.ms/vs/17/release/vc_redist.x64.exe")
        print("\n2. After installing, restart your terminal and try again.")
        print("\nAlternatively, reinstall PyTorch:")
        print("   pip uninstall torch")
        print("   pip install torch --index-url https://download.pytorch.org/whl/cpu")
        print("="*70 + "\n")
    raise
except ImportError as e:
    print("\n" + "="*70)
    print("ERROR: PyTorch is not installed.")
    print("="*70)
    print("\nTo install PyTorch on Windows:")
    print("   pip install torch --index-url https://download.pytorch.org/whl/cpu")
    print("="*70 + "\n")
    raise

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    AutoModel,
)

# ---- MODEL NAMES (change here if needed) ----
LLM_MODEL_NAME = "ibm-granite/granite-3.1-2b-instruct"
EMBED_MODEL_NAME = "ibm-granite/granite-embedding-125m-english"

# Global singletons
_llm = None
_llm_tokenizer = None
_embed_model = None
_embed_tokenizer = None
_load_lock = threading.Lock()


def _get_device() -> torch.device:
    """
    Decide where to run the models.
    We default to CPU to avoid GPU out-of-memory on small VRAM.
    You can change to CUDA manually later if you want.
    """
    # If you want to try GPU, change "cpu" to "cuda" (if available)
    return torch.device("cpu")


def load_models():
    """
    Lazy-load all models once. Called from app startup.
    """
    global _llm, _llm_tokenizer, _embed_model, _embed_tokenizer

    if _llm is not None and _embed_model is not None:
        return

    with _load_lock:
        if _llm is not None and _embed_model is not None:
            return

        device = _get_device()

        # ---- Load LLM ----
        print(f"[model_loader] Loading LLM on {device}...")
        _llm_tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL_NAME)
        _llm = AutoModelForCausalLM.from_pretrained(
            LLM_MODEL_NAME,
            torch_dtype=torch.float32,
        ).to(device)
        _llm.eval()
        print("[model_loader] LLM loaded.")

        # ---- Load embedding model ----
        print(f"[model_loader] Loading embedding model on {device}...")
        _embed_tokenizer = AutoTokenizer.from_pretrained(EMBED_MODEL_NAME)
        _embed_model = AutoModel.from_pretrained(
            EMBED_MODEL_NAME,
            torch_dtype=torch.float32,
        ).to(device)
        _embed_model.eval()
        print("[model_loader] Embedding model loaded.")


def get_llm():
    if _llm is None:
        load_models()
    return _llm


def get_llm_tokenizer():
    if _llm_tokenizer is None:
        load_models()
    return _llm_tokenizer


def get_embed_model():
    if _embed_model is None:
        load_models()
    return _embed_model


def get_embed_tokenizer():
    if _embed_tokenizer is None:
        load_models()
    return _embed_tokenizer


@torch.no_grad()
def embed_texts(texts: List[str]) -> np.ndarray:
    """
    Turn a list of texts into vector embeddings using the Granite embedding model.
    Returns a numpy array of shape (len(texts), dim).
    """
    model = get_embed_model()
    tokenizer = get_embed_tokenizer()
    device = _get_device()

    encoded = tokenizer(
        texts,
        padding=True,
        truncation=True,
        return_tensors="pt",
    ).to(device)

    outputs = model(**encoded)
    # Typical approach: mean pooling over sequence dimension
    last_hidden = outputs.last_hidden_state  # (batch, seq, dim)
    attention_mask = encoded["attention_mask"].unsqueeze(-1)  # (batch, seq, 1)
    masked = last_hidden * attention_mask
    summed = masked.sum(dim=1)
    counts = attention_mask.sum(dim=1)
    embeddings = summed / torch.clamp(counts, min=1e-9)

    embeddings = embeddings.cpu().numpy().astype("float32")
    return embeddings
