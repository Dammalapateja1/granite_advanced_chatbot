📘 Granite Advanced Chatbot
⚡ A Fully Local, Multi-Modal RAG Chatbot Powered by IBM Granite 3.1–2B

This project is an end-to-end, locally running AI chatbot featuring:

✔ Multi-modal input (PDF, DOCX, TXT, Images)
✔ RAG (Retrieval-Augmented Generation)
✔ Voice input + Text-to-Speech
✔ Multiple chat sessions
✔ Export chat to TXT / DOCX / PDF
✔ Modern UI (HTML/CSS/JS)
✔ Fully offline — no cloud required
✔ Built with IBM Granite + FastAPI

🚀 Features
🔍 1. Retrieval-Augmented Generation (RAG)

Upload any of the following:

PDFs

DOCX files

TXT

PNG/JPG images (OCR)

The system extracts text → creates vector embeddings → stores them → lets Granite answer with context.

📝 2. Multiple Export Formats

Export your chat session as:

TXT

DOCX

PDF (cleanly formatted)

🎤 3. Voice Input + Output

Speak to the chatbot

It transcribes your voice

Granite answers

Response is read aloud using TTS

🧠 4. Multi-Session Memory

You can create multiple chat sessions:

ai task

research project

coding help

general chat

Each session has isolated memory.

💾 5. Works Entirely Offline

No API key

No cloud calls

No internet needed

Local Granite 3.1–2B model

🏗️ System Architecture
Frontend (HTML/CSS/JS)
     |
FastAPI Backend (Python)
     |--- Model Loader (Granite)
     |--- RAG Engine (FAISS)
     |--- Memory Handler
     |--- Export Engine (txt/docx/pdf)
     |
Vector Store (FAISS + Docs)

📦 Technologies Used
🎛 Backend

FastAPI

Transformers (IBM Granite)

Torch

FAISS

Pydantic

PyPDF

python-docx

ReportLab

Pillow + Tesseract OCR

🎨 Frontend

HTML

CSS (Dark UI Theme)

Vanilla JS

🛠️ Installation & Setup
1️⃣ Clone the repo
git clone https://github.com/Dammalapateja1/granite_advanced_chatbot.git
cd granite_advanced_chatbot/backend_core

2️⃣ Install Python dependencies
pip install -r requirements_core.txt

3️⃣ Run the backend
uvicorn app_server:app --reload

4️⃣ Open the UI

Open:

backend_core/frontend_ui/index_ui.html

📁 Project Structure
granite_advanced_chatbot
│
├── backend_core
│   ├── app_server.py
│   ├── memory_handler.py
│   ├── model_loader.py
│   ├── rag_engine.py
│   ├── utils_core.py
│   ├── requirements_core.txt
│   ├── vector_store/
│   └── frontend_ui/
│       ├── index_ui.html
│       ├── style_ui.css
│       └── app_ui.js
│
└── README.md

🎯 Future Enhancements (Roadmap)
🔹 Phase 1 — Multi-agent support

Allow multiple Granite agents with different skills.

🔹 Phase 2 — User authentication

Login + Cloud sync (optional).

🔹 Phase 3 — Fine-tuning Granite

Custom training on user data.

🔹 Phase 4 — Add database

Integrate PostgreSQL / MongoDB for conversations + metadata.

🔹 Phase 5 — Desktop App

Convert into a standalone EXE using Electron or PyInstaller.

🙌 Acknowledgements

IBM Granite open-source models

HuggingFace Transformers

FastAPI community

🧑‍💻 Author

Teja Dammalapati
GitHub: https://github.com/Dammalapateja1

🎉 Done!