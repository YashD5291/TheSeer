GEN AI Resume Prompt 1<role>
Elite resume strategist specializing in surgical resume tailoring for tech roles. You decode job descriptions to identify what companies truly value, then adapt resumes to resonate with hiring managers while maintaining strict authenticity.
</role>

<context>
You have access to:
1. **CAREER STORY** (in project documents) - The candidate's detailed work history, actual projects, and real accomplishments. THIS IS YOUR SOURCE OF TRUTH.
2. **BASE RESUME** (provided in prompt) - The starting template to modify
3. **JOB DESCRIPTION** (provided in prompt) - The target role

Your task: Create a tailored resume that maximizes interview chances while ONLY claiming work actually performed.
</context>

<critical_constraints>
**AUTHENTICITY IS NON-NEGOTIABLE:**

1. **REFERENCE THE CAREER STORY**: Before modifying any bullet point, verify the claim exists in the career story. If you cannot find supporting evidence, DO NOT include it.

2. **REFRAME, NEVER FABRICATE**:
   - ✅ ALLOWED: Highlighting different aspects of real work that align with JD
   - ✅ ALLOWED: Using JD's terminology to describe actual work done
   - ✅ ALLOWED: Reordering bullets to emphasize relevant experience
   - ❌ FORBIDDEN: Claiming research work if none was done
   - ❌ FORBIDDEN: Claiming open-source contributions if none exist
   - ❌ FORBIDDEN: Adding skills/tools never actually used
   - ❌ FORBIDDEN: Inventing metrics or outcomes

3. **HANDLING GAPS**: When JD requires experience the candidate lacks:
   - Find the CLOSEST related experience from career story
   - Highlight transferable aspects WITHOUT claiming the exact skill
   - If no related experience exists, leave that area unaddressed—do not fabricate

4. **NO COMPANY MENTIONS**: Never reference target company name, products, or anything making it obvious this resume targets them specifically.

5. **PRESERVE STRUCTURE**: Same sections and format as base resume.
</critical_constraints>

<formatting_rules>
**STRICT FORMATTING REQUIREMENTS:**

1. **NO EM DASHES**: Never use em dashes (–) or (—) anywhere in the resume. Use hyphens (-), commas, or restructure sentences instead.
   - ❌ WRONG: "Reduced latency – improving performance by 40%"
   - ✅ CORRECT: "Reduced latency, improving performance by 40%"
   - ✅ CORRECT: "Reduced latency and improved performance by 40%"

2. **CONSISTENCY**: Maintain consistent punctuation and formatting throughout all bullet points.
</formatting_rules>

<analysis_framework>
## 1. COMPANY DNA
- Culture/values (based on language)
- Tone: formal↔casual, technical↔business
- Emphasis: individual excellence↔team collaboration
- Orientation: metrics-driven↔narrative-driven

## 2. ROLE REQUIREMENTS
- **MUST-HAVE**: Explicitly required skills
- **NICE-TO-HAVE**: Preferred/bonus skills
- **Core problems** this role solves
- **Seniority level** implied

## 3. GAP ANALYSIS
| JD Requirement | Career Story Evidence | Action |
|----------------|----------------------|--------|
| [requirement] | [evidence or "NO MATCH"] | [reframe existing / highlight related / SKIP] |

## 4. TONE CALIBRATION (1-10)
- Technical depth: _/10
- Culture emphasis: _/10  
- Formality: _/10
- Innovation vs Stability: _/10
- Individual vs Team: _/10
</analysis_framework>

<modification_strategy>
## SUMMARY (Modify: 60-80%)
- Echo JD's language patterns
- Front-load 2-3 most relevant qualifications FROM ACTUAL EXPERIENCE
- Match energy and emphasis of JD

## SKILLS (Modify: 20-40%)
- Reorder: JD-mentioned skills first
- Add: Only skills verifiable in career story
- Remove: Irrelevant skills to reduce noise

## WORK EXPERIENCE (Modify: 10-20%)
For each bullet, choose ONE action:
| Action | When to Use |
|--------|-------------|
| KEEP | Directly relevant, well-phrased |
| REPHRASE | Relevant but needs JD terminology |
| REORDER | Move relevant bullets up |
| CONDENSE | Less relevant, combine/shorten |
| SKIP | Cannot verify in career story |

**Rephrasing rules:**
- Swap synonyms with JD's exact terms (only if meaning is equivalent)
- Adjust emphasis based on what JD values
- Reframe same achievement to highlight JD-relevant aspect

## EDUCATION (Modify: 0%)
- Leave unchanged
</modification_strategy>

<output_format>
---
## CHAT TITLE
**MUST USE THIS TITLE FOR THE CHAT TITLE NO MATTER WHAT:** [Company Name] - [Position Title] Resume Analysis
You MUST use this title for the chat title.
---
## ANALYSIS

### Company DNA
[2-3 sentences]

### Role Requirements
**Must-Have:** [list]
**Nice-to-Have:** [list]

### Gap Analysis
| JD Requirement | Career Story Evidence | Action |
|----------------|----------------------|--------|
| | | |

### Tone Calibration
- Technical depth: _/10
- Culture emphasis: _/10
- Formality: _/10
- Innovation vs Stability: _/10
- Individual vs Team: _/10

**Tone Strategy:** [1 sentence]

---
## TAILORED RESUME

[Complete resume - clean format, ready for use]

---
## CHANGELOG

| Section | Original | Modified | Rationale |
|---------|----------|----------|-----------|
| Summary | "[original text]" | "[new text]" | [why] |
| Skills | "[original order/items]" | "[new order/items]" | [why] |
| [Job] Bullet X | "[original]" | "[modified]" | [why] |
| ... | | | |

**Modifications Made:** X/Y bullets changed (Z%)
**Gaps Not Addressed:** [List any JD requirements skipped due to no matching experience]
</output_format>

<inputs>
## BASE RESUME:
# Juan Flores

**Email:** juanflores.work@outlook.com  
**Phone:** +1 (704) 363-9900  
**LinkedIn:** linkedin.com/in/juan-flores-ml  
**GitHub:** github.com/juanf-0gravity

Machine Learning Engineer with 5+ years of experience developing, training, and deploying generative AI models for production. Expertise in transformer architectures, RLHF/DPO alignment, and inference optimization, with skills in building scalable data pipelines and vector databases. Proven track record shipping foundation models including Covariant's RFM-1 and Labelbox's Model Foundry platform. Skilled in end-to-end LLM workflows from pretraining to deployment. Driven by first principles thinking to break down complex problems and deliver measurable impact.

## Skills

**Languages:** Python, CUDA, SQL, C++, Rust

**ML Frameworks:** PyTorch, JAX, Triton, Transformers, Hugging Face

**LLM Core:** RAG, PEFT, LoRA, RLHF, DPO, Knowledge Distillation, Flash Attention

langchain, langgraph, crewai
**Training:** DeepSpeed, FSDP, Mixed Precision, Multi-GPU, Model Parallelism

**Inference & Serving:** vLLM, TensorRT-LLM, Triton Server, ONNX, BentoML, Ray Serve

**Data & Storage:** Vector DBs (FAISS, Pinecone, Weaviate), Redis, Kafka, Spark, DuckDB

**MLOps:** Weights & Biases, MLflow, Docker, Kubernetes, CI/CD, A/B Testing

## Experience

**Senior AI Engineer** | Labelbox -- Remote (San Francisco, CA)  
Jun 2024 – Oct 2025

- Led development of Model Foundry's LLM variants for model-assisted labeling (MAL), modifying transformer encoders with extended self-attention layers to handle multimodal inputs, generating synthetic pre-labels that improved annotation quality while cutting manual labeling by 40%.
- Fine-tuned 7B-parameter models using PEFT/LoRA on proprietary Catalog data, implementing RLHF loops via LLM Human Preference Editor with human preference ranking to align outputs, reducing hallucination rates by 40% in production workflows for enterprise clients including Genentech and P&G.
- Optimized LLM inference with vLLM and TensorRT on A100 clusters, enabling mixed-precision serving with sub-second responses for large-scale exports while meeting GDPR constraints.
- Architected knowledge distillation pipelines from 70B+ foundation models to lighter variants using LoRA adapters for Catalog and Annotate products, maintaining alignment quality through DPO optimization while achieving 50% reduction in annotation costs via Alignerr network's active learning sample selection.

**Machine Learning Engineer** | Covariant -- Remote (Berkeley, CA)  
Jan 2022 – May 2024

- Trained RFM-1 (Robotics Foundation Model), an 8B-parameter multimodal transformer for robotic simulation, incorporating self-attention for fusing vision and action data, generating synthetic trajectories that reduced real-data dependency by 30% in manipulation training for Covariant Brain.
- Fine-tuned RFM-1 with RLHF on fleet-collected episodes from Otto Group and Radial deployments, using LoRA to adapt for long-tail scenarios, achieving 20% higher accuracy in zero-shot grasping for novel objects across warehouse robots.
- Optimized model serving with Triton Server for GPU-efficient inference, integrating TensorRT for quantization that cut latency in edge deployments for KNAPP Pick-it-Easy Robot systems at McKesson pharmaceutical facilities.
- Developed diffusion-based generative models for physics predictions within Covariant Brain, distilling from large models to deployment-ready versions, enabling fleet learning across ABB-integrated robotic cells with minimal retraining overhead.

**Data Engineer** | Rockset (acquired by OpenAI 2024) -- Remote (San Mateo, CA)  
Jun 2020 – Dec 2021

- Built real-time ETL pipelines using Kafka and Spark for the Aggregator-Leaf-Tailer (ALT) architecture, ingesting semi-structured data streams from MongoDB CDC and DynamoDB, enabling sub-millisecond querying via Converged Index.
- Contributed to Converged Index systems combining row, columnar, and inverted indexes for dynamic schemas, supporting real-time analytics on NoSQL and SQL data with Query Lambdas to facilitate fast insights for customers like JetBlue and Klarna.
- Integrated FAISS-based vector search pipelines into RocksDB-Cloud storage layer, accelerating similarity queries for embeddings that laid groundwork for AI-driven applications.
- Troubleshot distributed query systems to achieve high uptime with automated scaling, ensuring reliable low-latency data feeds for production workloads. (Rockset acquired by OpenAI in 2024 for retrieval infrastructure.)

**Backend Engineer** | AvidXchange -- Charlotte, NC  
Jun 2018 – May 2020

- Developed Python APIs for AvidInvoice transaction automation, generating secure data flows for 200K+ daily operations integrated with AvidPay Network's 500K+ supplier ecosystem.
- Optimized AvidInvoice OCR processing backends with Redis caching and ML auto-coding, reducing invoice-to-payment delays by 25% for high-volume fintech clients in real estate and construction verticals.
- Collaborated on AvidPay Direct validation endpoints with 2-way/3-way PO matching, enhancing reliability for ACH and virtual card payment automation across enterprise customers.
- Applied scalable microservice designs in code reviews to support AvidXchange's growth processing high annual transaction volume.

## Education

**University of North Carolina at Charlotte**  
May 2018  
Master of Science, Computer Science (Focus: Machine Learning, Distributed Systems, NLP, CV)

**University of North Carolina at Charlotte**  
May 2016  
Bachelor of Science, Computer Science (Major: Software Engineering)

## JOB DESCRIPTION:
Staff ML Engineer, Applied AI
Boulder, CO, Charlotte, NC or Remote
WHO WE ARE

TIFIN builds AI-powered financial technology that personalizes and improves financial advice across consumers, advisors, workplaces, and institutions. Our modular platform embeds finance-tuned AI to deliver dynamic, tailored guidance at scale—without added complexity. Combining proprietary models, specialized data, and a fast-paced engineering culture, we create secure, compliant tools that power real outcomes. Other differentiators include:

Speed: Our ability to stand up businesses at 2-4x the speed of typical fintech companies (building MVPs in 3 months and production-ready products in 6-12 months)
Track Record: Previous exits include 55ip (acquired by J.P. Morgan) and Paralel
Strategic Partners: Partners include J.P. Morgan, Franklin Templeton, Morningstar, Broadridge, Hamilton Lane, Motive Partners and SEI. 
World-Class Team: Complimentary financial services & technical expertise from Google, Microsoft, Uber, PayPal, eBay, Techstars, BlackRock, LPL, Franklin Templeton, Morgan Stanley, Broadridge and more. 
OUR VALUES: Go with your GUT

Grow at the Edge. We are driven by personal growth fueled by a beginner’s mindset. We get out of our comfort zone and keep egos aside. With self-awareness and integrity we strive to be the best we can possibly be. No excuses.
Understanding through Listening and Speaking the Truth. We communicate with authenticity, precision and integrity to create a shared understanding. We identify opportunities within constraints and propose solutions in service to the team.
I Win for Teamwin. We believe in staying within our genius zones to succeed and taking accountability for driving results. We are all individual contributors first and always thinking about what can be better.
ROLE OVERVIEW

As a Staff ML Engineer on the Applied AI team, you will own and lead projects across our various generative AI product lines. We are looking for individuals who have worked end-to-end and have experience building generative AI products where LLMs are a core component. Expertise with fine-tuning and reinforcement learning is critical. This is an individual contributor and technical leadership role reporting into the Head of AI.

PROJECTS

AI Agent Orchestrator: Multi-agent systems that automate tasks and streamline workflows, driving measurable improvements in operational efficiency.
Human-in-the-Loop Collaboration: AI-powered co-pilot for advisors and other user personas, streamlining workflows across business workflows such as prospecting, conversion, onboarding, and client servicing.
Fine-Tuned Models: Purpose-tuned models for financial services to handle complex, multi-turn interactions with actionability in low-latency environments.
Seamless Legacy Tech Integration: Designed to navigate and optimize legacy systems for streamlined operations with computer use models.
WHAT YOU’LL DO

Design and fine-tune open source and proprietary LLMs for various tasks such as answering questions, summarization, reasoning and planning, etc.
Build advanced Retrieval Augmented Generation (RAG) pipeline including rewriting, embedding fine-tuning, hybrid search, reranking, knowledge graphs, etc.
Experience shipping generative AI products powered by LLMs: designing and implementing agentic workflows and multi-agent systems that enable autonomous AI behaviors, leveraging the latest state-of-the-art research 
Apply reinforcement learning techniques—including reinforcement learning fine tuning (e.g., PPO, DPO, GRPO)—to continuously optimize model performance.
Implement a comprehensive evaluation framework and metrics for model performance
Deploy models into production environments and ensure low latency, reliability, and scalability.  
Collaborate with product team and software engineering team to build end-to-end product systems.
WHAT YOU’LL BRING

5+ years of experience (post-BS/MS) in applied AI/ML engineering 
Experience shipping generative AI products powered by LLMs: designing and implementing agentic workflows that enable autonomous AI behaviors, leveraging the latest state-of-the-art research 
Hands-on experience in various LLM fine-tuning techniques (e.g. LORA), LLM inference frameworks (e.g. vLLM), advanced RAG pipelines
Solid expertise in reinforcement learning fine tuning methodologies and frameworks to optimize AI models
Resilience and adaptability - experience working at early-stage startups is a plus
COMPENSATION RANGE

$190,000 - $225,000 USD
</inputs>
Execute: First consult career story in project documents to understand actual experience scope. Then analyze JD. Then create tailored resume with changelog. Flag any JD requirements you could not address due to lack of matching experience.
Note: Must not use (–) em dash in work experience points or summary. MUST NOT CREATE WORD DOCUMENT OR PDF OR ARTIFACT.