# <img src="./logo.png" width="48" height="48" valign="middle"> Hire Sphere

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blue?logo=google-gemini)](https://ai.google.dev/)

**Hire Sphere** is an advanced AI agent prototype designed to revolutionize the recruitment process. By leveraging Large Language Models (LLMs) and semantic matching, it assists HR teams in evaluating, scoring, and ranking candidates with unprecedented efficiency and transparency.

---

## 🌟 Overview

In the modern job market, HR teams routinely screen hundreds of applications per role, leading to fatigue, inconsistency, and unconscious bias. **Hire Sphere** standardizes this evaluation process, highlighting skill gaps and surfacing the best-fit candidates faster—all while keeping a human in the loop for final decisions.

### Core Features

-   **JD Parser**: Automatically extracts key requirements—skills, experience, and qualifications—from Job Descriptions.
-   **Multi-Format Ingestion**: Accepts PDF/DOCX resumes and LinkedIn profile data (JSON/Scraped).
-   **Semantic Matching Engine**: Uses LLM reasoning and embeddings to compare candidate profiles against JD requirements.
-   **Structured Scoring Rubric**: Produces a detailed score across 5 key dimensions with transparent justifications.
-   **Shortlist Reporting**: Generates ranked tables (PDF/HTML/JSON) with hire/no-hire recommendations.
-   **Human-in-the-Loop**: Allows HR professionals to override or flag candidate scores with recorded reasons.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React](https://reactjs.org/) (Vite)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [GSAP](https://greensock.com/gsap/) & [Framer Motion](https://www.framer.com/motion/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Real-time**: [Socket.io-client](https://socket.io/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose)
- **AI Engine**: [Google Gemini API](https://ai.google.dev/) (`@google/generative-ai`)
- **Storage**: [Cloudinary](https://cloudinary.com/) & [Firebase](https://firebase.google.com/)
- **Parsing**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **Real-time**: [Socket.io](https://socket.io/)

---

## 📊 Scoring Rubric

The agent evaluates candidates based on a weighted multi-dimensional rubric:

| Dimension | Weight | 0 - Poor | 5 - Average | 10 - Excellent |
| :--- | :---: | :--- | :--- | :--- |
| **Skills Match** | 30% | < 30% skills match | 50–70% skills match | > 85% skills match |
| **Experience Relevance** | 25% | Unrelated domain | Adjacent domain | Exact domain & seniority |
| **Education & Certs** | 15% | Does not meet minimum | Meets minimum | Exceeds + extra certs |
| **Project / Portfolio** | 20% | No evidence | 1–2 generic projects | Strong relevant portfolio |
| **Communication Quality**| 10% | Poor structure/grammar | Adequate clarity | Crisp, structured, impactful |

*The agent provides dimension-level scores, a weighted total, and a one-line justification per dimension.*

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Google Gemini API Key
- Cloudinary & Firebase Credentials (for storage)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Hire_Sphere
   ```

2. **Setup Backend**:
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run dev
   ```

3. **Setup Frontend**:
   ```bash
   cd ../client
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run dev
   ```

---

## 📂 Project Structure

```
Hire_Sphere/
├── client/             # Vite + React Frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Main application pages
│   │   └── ...
├── server/             # Node.js + Express Backend
│   ├── src/
│   │   ├── controllers/# Business logic
│   │   ├── models/     # Mongoose schemas
│   │   ├── routes/     # API endpoints
│   │   └── ...
│   ├── server.js       # Entry point
└── logo.png            # Project Branding
```

---

---

## 🚀 Sample Output & Dashboard

Experience the power of Hire Sphere's AI-driven analysis. We have prepared a comprehensive sample analysis document showcasing parsed Job Descriptions, candidate scoring, and system metrics.

👉 **[View Detailed Sample Output & System Analysis](./SAMPLE_OUTPUT.md)**

### Quick Preview:
- **Parsed JDs**: Automatic extraction of skills and experience.
- **AI Scoring**: Multi-dimensional evaluation (Skills, Experience, Education, etc.).
- **Ranked Dashboards**: Real-time ranking of top candidates.
- **API Responses**: Professional JSON outputs for enterprise integration.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` (or `server/package.json`) for more information.

---

