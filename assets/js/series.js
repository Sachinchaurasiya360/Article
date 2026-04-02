// Central data for all series - used by index.html, article.html, series pages
const SERIES = [
  {
    id: "Machine-Learning",
    title: "Machine Learning",
    icon: "cpu", iconColor: "#8b5cf6",
    color: "purple",
    gradient: "linear-gradient(135deg,#8b5cf6,#6366f1)",
    description: "Linear regression to production ML platforms. Every algorithm built from scratch, then with PyTorch and scikit-learn.",
    level: "Beginner → Production",
    parts: 20,
    articles: Array.from({length:20},(_,i)=>({
      num: i,
      file: `Machine-Learning/ml-deep-dive-part-${i}.md`,
      titles: [
        "The ML Landscape - What ML Actually Is (And Isn't)",
        "The Math You Actually Need",
        "Linear Regression from Scratch",
        "Classification - Logistic Regression and Evaluation",
        "Trees and Forests - Decision Trees to XGBoost",
        "The Algorithm Zoo - SVMs, KNN, Naive Bayes",
        "Unsupervised Learning - Clustering and PCA",
        "Feature Engineering",
        "Neural Networks from Scratch",
        "PyTorch Fundamentals",
        "CNNs - Teaching Machines to See",
        "Sequence Models - RNNs and LSTMs",
        "Training Deep Networks - Optimizers and Debugging",
        "Transfer Learning",
        "NLP with Transformers and BERT",
        "Advanced Computer Vision - Detection, GANs, ViT",
        "Model Evaluation and Selection",
        "ML System Design",
        "MLOps - Notebook to Production",
        "The Capstone - Production ML Platform"
      ][i]
    }))
  },
  {
    id: "AI-Memory",
    title: "AI Memory Systems",
    icon: "brain", iconColor: "#3b82f6",
    color: "blue",
    gradient: "linear-gradient(135deg,#3b82f6,#2dd4bf)",
    description: "How machines remember, retrieve, and reason. Attention, embeddings, vector databases, and autonomous agents.",
    level: "Beginner → Production",
    parts: 20,
    articles: Array.from({length:20},(_,i)=>({
      num: i,
      file: `AI-Memory/ai-memory-deep-dive-part-${i}.md`,
      titles: [
        "What Is Memory in AI?",
        "How Machines Represent Information - Tokens, Numbers, Vectors",
        "Neural Networks as Memory Systems",
        "The Attention Mechanism - Teaching AI to Focus",
        "Transformers and Context Windows",
        "The Memory Wall and Breaking Through",
        "External Memory - When Context Isn't Enough",
        "Embeddings - Teaching Machines to Understand Meaning",
        "Building and Understanding Vector Databases",
        "Retrieval-Augmented Generation",
        "Chunking and Retrieval Optimization",
        "Short-Term vs Long-Term Memory in AI Agents",
        "Memory Compression and Summarization",
        "Updating and Editing Memory",
        "Personalization - Memory That Knows You",
        "Multi-Modal Memory - Beyond Text",
        "Autonomous Agents With Memory",
        "Scaling Memory Systems in Production",
        "Research-Level Memory Architectures",
        "Capstone - Production AI Memory Platform"
      ][i]
    }))
  },
  {
    id: "Voice-Agents",
    title: "Voice Agents",
    icon: "mic", iconColor: "#10b981",
    color: "green",
    gradient: "linear-gradient(135deg,#10b981,#3b82f6)",
    description: "Audio processing, ASR, TTS, voice cloning, real-time pipelines, WebRTC, and telephony integration.",
    level: "Beginner → Production",
    parts: 20,
    articles: Array.from({length:20},(_,i)=>({
      num: i,
      file: `Voice-Agents/voice-agent-deep-dive-part-${i}.md`,
      titles: [
        "The Voice AI Landscape",
        "Audio Fundamentals - Sound, Signals, and Digital Audio",
        "Audio Signal Processing - Spectrograms and MFCCs",
        "Speech Recognition - From Sound Waves to Text",
        "Real-Time ASR and Wake Word Detection",
        "Speech Synthesis - Teaching Machines to Talk",
        "Voice Cloning and Custom Voices",
        "Real-Time Audio Pipelines - Streaming and WebSockets",
        "WebRTC and Telephony",
        "Your First Voice Agent - ASR + LLM + TTS",
        "Dialog Management - Turn-Taking and Interruptions",
        "Voice Agent Memory",
        "Frameworks - LiveKit, Pipecat, and Vocode",
        "Phone Call Agents - Twilio and SIP",
        "Multi-Language and Emotion",
        "Advanced Voice Features",
        "Latency Optimization",
        "Production Infrastructure",
        "Security, Testing, and Compliance",
        "Capstone - Production Voice Agent Platform"
      ][i]
    }))
  },
  {
    id: "RAG",
    title: "RAG",
    icon: "search", iconColor: "#f59e0b",
    color: "orange",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    description: "Retrieval-Augmented Generation from scratch - chunking, embeddings, vector search, and production deployment.",
    level: "Intermediate → Production",
    parts: 10,
    articles: Array.from({length:10},(_,i)=>({
      num: i,
      file: `RAG/rag-deep-dive-part-${i}.md`,
      titles: [
        "What Is RAG? Foundations and Why It Matters",
        "Text Preprocessing and Chunking Strategies",
        "Embeddings - The Heart of RAG",
        "Vector Databases and Indexing",
        "Retrieval Strategies - Basic to Advanced",
        "Building Your First RAG Pipeline",
        "Advanced RAG Patterns - HyDE, Re-ranking, Fusion",
        "Evaluation and Debugging RAG Systems",
        "Production RAG - Scaling and Monitoring",
        "Multi-Modal RAG, Agentic RAG, and The Future"
      ][i]
    }))
  },
  {
    id: "Kafka",
    title: "Apache Kafka",
    icon: "zap", iconColor: "#ef4444",
    color: "red",
    gradient: "linear-gradient(135deg,#ef4444,#f59e0b)",
    description: "Distributed logs, replication internals, stream processing, performance tuning, and production operations.",
    level: "Intermediate → Advanced",
    parts: 11,
    articles: Array.from({length:11},(_,i)=>({
      num: i,
      file: `Kafka/kafka-deep-dive-part-${i}.md`,
      titles: [
        "The Foundation You Need Before Going Deep",
        "Why Kafka Exists - The Distributed Log",
        "Architecture Internals - Brokers and KRaft",
        "Replication - ISR, Leader Election, Durability",
        "Consumer Groups and Offset Management",
        "Storage Engine - Segments and Log Compaction",
        "Producers - Batching, Idempotence, Transactions",
        "Performance Engineering",
        "Stream Processing - Kafka Streams and Flink",
        "Production Operations and Monitoring",
        "Advanced Patterns - Event Sourcing, CDC, CQRS"
      ][i]
    }))
  },
  {
    id: "Redis",
    title: "Redis",
    icon: "database", iconColor: "#ec4899",
    color: "pink",
    gradient: "linear-gradient(135deg,#ec4899,#f59e0b)",
    description: "Architecture internals, data structure encodings, persistence, clustering, and production engineering.",
    level: "Intermediate → Advanced",
    parts: 9,
    articles: Array.from({length:9},(_,i)=>({
      num: i,
      file: `Redis/redis-deep-dive-part-${i}.md`,
      titles: [
        "The Foundation You Need Before Going Deep",
        "Architecture and Event Loop Internals",
        "Data Structures - Internal Encoding and Complexity",
        "Memory Management and Persistence",
        "Networking Model and Performance Engineering",
        "Replication, HA, and Sentinel",
        "Redis Cluster and Distributed Systems",
        "Advanced Use Cases and Patterns",
        "Production Engineering and Scaling"
      ][i]
    }))
  },
  {
    id: "LangChain",
    title: "LangChain",
    icon: "link-2", iconColor: "#14b8a6",
    color: "teal",
    gradient: "linear-gradient(135deg,#14b8a6,#3b82f6)",
    description: "Build LLM-powered apps: chains, prompts, agents, tools, memory, LangSmith, and production best practices.",
    level: "Intermediate",
    parts: 3,
    articles: Array.from({length:3},(_,i)=>({
      num: i,
      file: `LangChain/langchain-deep-dive-part-${i}.md`,
      titles: [
        "LangChain Fundamentals - Chains, Prompts, and Models",
        "Agents, Tools, Memory, and Advanced RAG",
        "Production LangChain - LangSmith and Deployment"
      ][i]
    }))
  },
  {
    id: "Agentic-AI-Interview",
    title: "Agentic AI Interview",
    icon: "bot", iconColor: "#7c3aed",
    color: "violet",
    gradient: "linear-gradient(135deg,#7c3aed,#ec4899)",
    description: "Complete interview prep for Agentic AI & LLM systems - fundamentals, RAG, agents, multi-agent, tool use, safety, and system design.",
    level: "Intermediate → Advanced",
    parts: 10,
    articles: [
      { num: 1, file: "Agentic-AI-Interview/01-ai-llm-fundamentals.md", titles: "AI & LLM Fundamentals" },
      { num: 2, file: "Agentic-AI-Interview/02-prompt-engineering.md", titles: "Prompt Engineering" },
      { num: 3, file: "Agentic-AI-Interview/03-embeddings-vector-databases.md", titles: "Embeddings & Vector Databases" },
      { num: 4, file: "Agentic-AI-Interview/04-rag.md", titles: "Retrieval-Augmented Generation (RAG)" },
      { num: 5, file: "Agentic-AI-Interview/05-agentic-ai-basics.md", titles: "Agentic AI Basics" },
      { num: 6, file: "Agentic-AI-Interview/06-multi-agent-systems.md", titles: "Multi-Agent Systems & Orchestration" },
      { num: 7, file: "Agentic-AI-Interview/07-tool-use-function-calling.md", titles: "Tool Use, Function Calling & APIs" },
      { num: 8, file: "Agentic-AI-Interview/08-memory-planning-reasoning.md", titles: "Memory, Planning & Reasoning" },
      { num: 9, file: "Agentic-AI-Interview/09-evaluation-guardrails-safety.md", titles: "Evaluation, Guardrails & Safety" },
      { num: 10, file: "Agentic-AI-Interview/10-system-design-production.md", titles: "System Design & Production AI Systems" }
    ]
  },
  {
    id: "Python-FastAPI",
    title: "Python & FastAPI",
    icon: "terminal", iconColor: "#3b82f6",
    color: "blue",
    gradient: "linear-gradient(135deg,#3b82f6,#06b6d4)",
    description: "Python fundamentals to production FastAPI - interview preparation covering core Python, advanced patterns, APIs, databases, and system design.",
    level: "Beginner → Production",
    parts: 7,
    articles: [
      { num: 1, file: "Python-FastAPI/01-python-fundamentals.md", titles: "Python Fundamentals" },
      { num: 2, file: "Python-FastAPI/02-intermediate-python.md", titles: "Intermediate Python" },
      { num: 3, file: "Python-FastAPI/03-advanced-python.md", titles: "Advanced Python" },
      { num: 4, file: "Python-FastAPI/04-fastapi-fundamentals.md", titles: "FastAPI Fundamentals" },
      { num: 5, file: "Python-FastAPI/05-fastapi-advanced-production.md", titles: "FastAPI Advanced & Production" },
      { num: 6, file: "Python-FastAPI/06-databases-caching-async.md", titles: "Databases, Caching & Async Systems" },
      { num: 7, file: "Python-FastAPI/07-system-design-architecture.md", titles: "System Design & Architecture" }
    ]
  },
  {
    id: "SQL-Database",
    title: "SQL & Databases",
    icon: "table-2", iconColor: "#f97316",
    color: "orange",
    gradient: "linear-gradient(135deg,#f97316,#eab308)",
    description: "SQL fundamentals to advanced database internals, query optimization, NoSQL, and real-world system design scenarios.",
    level: "Beginner → Advanced",
    parts: 5,
    articles: [
      { num: 1, file: "SQL-Database/01-sql-fundamentals.md", titles: "SQL Fundamentals" },
      { num: 2, file: "SQL-Database/02-intermediate-sql.md", titles: "Intermediate SQL & Query Optimization" },
      { num: 3, file: "SQL-Database/03-advanced-sql.md", titles: "Advanced SQL & Database Internals" },
      { num: 4, file: "SQL-Database/04-nosql.md", titles: "NoSQL & Modern Databases" },
      { num: 5, file: "SQL-Database/05-system-design.md", titles: "System Design & Database Scenarios" }
    ]
  },
  {
    id: "DevOps",
    title: "DevOps",
    icon: "container", iconColor: "#0ea5e9",
    color: "sky",
    gradient: "linear-gradient(135deg,#0ea5e9,#8b5cf6)",
    description: "DevOps fundamentals, Linux, Docker, CI/CD pipelines, cloud infrastructure, monitoring, and production system design.",
    level: "Beginner → Production",
    parts: 7,
    articles: [
      { num: 1, file: "DevOps/01-devops-fundamentals.md", titles: "DevOps Fundamentals" },
      { num: 2, file: "DevOps/02-linux-networking.md", titles: "Linux & Networking" },
      { num: 3, file: "DevOps/03-docker-fundamentals.md", titles: "Docker Fundamentals" },
      { num: 4, file: "DevOps/04-advanced-docker.md", titles: "Advanced Docker & Containerization" },
      { num: 5, file: "DevOps/05-cicd-pipelines.md", titles: "CI/CD Pipelines & Automation" },
      { num: 6, file: "DevOps/06-cloud-monitoring.md", titles: "Cloud, Monitoring & Infrastructure" },
      { num: 7, file: "DevOps/07-system-design.md", titles: "System Design & Real-World DevOps" }
    ]
  },
  {
    id: "WebSockets-WebRTC",
    title: "WebSockets & WebRTC",
    icon: "radio", iconColor: "#06b6d4",
    color: "cyan",
    gradient: "linear-gradient(135deg,#06b6d4,#10b981)",
    description: "Real-time communication from WebSocket fundamentals to advanced WebRTC - scaling, peer-to-peer, and video/audio system design.",
    level: "Intermediate → Advanced",
    parts: 4,
    articles: [
      { num: 1, file: "WebSockets-WebRTC/01-websockets-fundamentals.md", titles: "WebSockets Fundamentals & Real-time Basics" },
      { num: 2, file: "WebSockets-WebRTC/02-advanced-websockets.md", titles: "Advanced WebSockets & Scaling" },
      { num: 3, file: "WebSockets-WebRTC/03-webrtc-fundamentals.md", titles: "WebRTC Fundamentals" },
      { num: 4, file: "WebSockets-WebRTC/04-webrtc-advanced.md", titles: "WebRTC Advanced - Video/Audio System Design" }
    ]
  },
  {
    id: "Web-Scraping",
    title: "Web Scraping",
    icon: "globe", iconColor: "#22d3ee",
    color: "cyan",
    gradient: "linear-gradient(135deg,#22d3ee,#3b82f6)",
    description: "From HTTP basics to production data pipelines - Requests, BeautifulSoup, Selenium, Playwright, Scrapy, and async scraping.",
    level: "Beginner → Production",
    parts: 6,
    articles: Array.from({length:6},(_,i)=>({
      num: i,
      file: `Web-Scraping/web-scraping-deep-dive-part-${i}.md`,
      titles: [
        "Foundations - HTTP, Ethics, and the Scraping Landscape",
        "BeautifulSoup & Requests - Parsing and Extraction",
        "Dynamic Content & Browser Automation",
        "Scrapy Framework - Crawling at Scale",
        "Anti-Scraping & Advanced Techniques",
        "Production Scraping - Async, Scheduling, Monitoring"
      ][i]
    }))
  },
  {
    id: "Scalable-Code",
    title: "Scalable Code",
    icon: "trending-up", iconColor: "#a855f7",
    color: "purple",
    gradient: "linear-gradient(135deg,#a855f7,#ec4899)",
    description: "Writing scalable code from day one - frontend and backend foundations, traffic spikes, and production scaling for 100K+ users.",
    level: "Intermediate → Advanced",
    parts: 3,
    articles: [
      { num: 1, file: "scalable-code-day-one.md", titles: "Writing Scalable Code from Day 1" },
      { num: 2, file: "scalable-code-traffic-spikes.md", titles: "Handling Sudden Traffic Spikes" },
      { num: 3, file: "scalable-code-production-scaling.md", titles: "Scaling Systems in Production for 100K+ Users" }
    ]
  },
  {
    id: "Security",
    title: "Security & Bug Bounty",
    icon: "shield", iconColor: "#e11d48",
    color: "rose",
    gradient: "linear-gradient(135deg,#e11d48,#f59e0b)",
    description: "Offensive and defensive security - IDOR, JWT attacks, SQLi, XSS, SSRF, race conditions, AWS misconfigs, privilege escalation, and vulnerability chaining.",
    level: "Intermediate → Advanced",
    parts: 19,
    articles: [
      { num: 0, file: "Security/security-deep-dive-part-0.md", titles: "Advanced IDOR Vulnerabilities and Broken Access Control" },
      { num: 1, file: "Security/security-deep-dive-part-1.md", titles: "Payment Manipulation and Ecommerce Logic Abuse" },
      { num: 2, file: "Security/security-deep-dive-part-2.md", titles: "Advanced JWT Attacks" },
      { num: 3, file: "Security/security-deep-dive-part-3.md", titles: "SQL Injection and NoSQL Injection for Modern Applications" },
      { num: 4, file: "Security/security-deep-dive-part-4.md", titles: "XSS Attacks in Modern Frontends" },
      { num: 5, file: "Security/security-deep-dive-part-5.md", titles: "CSRF, Session Fixation, and Authentication Bypass" },
      { num: 6, file: "Security/security-deep-dive-part-6.md", titles: "File Upload Vulnerabilities" },
      { num: 7, file: "Security/security-deep-dive-part-7.md", titles: "SSRF and Internal Network Access" },
      { num: 8, file: "Security/security-deep-dive-part-8.md", titles: "Path Traversal, LFI, and Internal File Disclosure" },
      { num: 9, file: "Security/security-deep-dive-part-9.md", titles: "GraphQL Security Testing" },
      { num: 10, file: "Security/security-deep-dive-part-10.md", titles: "Advanced API Security Testing" },
      { num: 11, file: "Security/security-deep-dive-part-11.md", titles: "Race Conditions and Business Logic Vulnerabilities" },
      { num: 12, file: "Security/security-deep-dive-part-12.md", titles: "AWS Security Misconfigurations for Bug Bounty Hunters" },
      { num: 13, file: "Security/security-deep-dive-part-13.md", titles: "Linux Privilege Escalation for Bug Bounty and Labs" },
      { num: 14, file: "Security/security-deep-dive-part-14.md", titles: "Internal Logs, Debug Endpoints, and Source Code Disclosure" },
      { num: 15, file: "Security/security-deep-dive-part-15.md", titles: "Chaining Vulnerabilities Together" },
      { num: 16, file: "Security/security-deep-dive-part-16.md", titles: "Bug Bounty Methodology for Modern SaaS Applications" },
      { num: 17, file: "Security/security-deep-dive-part-17.md", titles: "Building Your Own Vulnerable Lab" },
      { num: 18, file: "Security/transformer-attention-is-all-you-need.md", titles: "Attention Is All You Need - Complete Transformer Architecture Deep Dive" }
    ]
  },
  {
    id: "Standalone-Guides",
    title: "Standalone Guides",
    icon: "book-open", iconColor: "#d946ef",
    color: "fuchsia",
    gradient: "linear-gradient(135deg,#d946ef,#f43f5e)",
    description: "In-depth standalone interview and career guides - communication mastery, Next.js, vector databases, and more.",
    level: "All Levels",
    parts: 3,
    articles: [
      { num: 1, file: "interview-communication-mastery.md", titles: "Interview & Communication Mastery" },
      { num: 2, file: "nextjs-interview-guide.md", titles: "Next.js Interview Guide - Zero to Advanced" },
      { num: 3, file: "vector-databases-deep-dive.md", titles: "Vector Databases - The Engine Behind Modern AI Search" }
    ]
  }
];

// Helper: find series by id
function getSeriesById(id) {
  return SERIES.find(s => s.id === id);
}

// Helper: find prev/next article across the same series
function getNeighbors(seriesId, partNum) {
  const s = getSeriesById(seriesId);
  if (!s) return { prev: null, next: null };
  const prev = s.articles.find(a => a.num === partNum - 1) || null;
  const next = s.articles.find(a => a.num === partNum + 1) || null;
  return { prev, next, series: s };
}
