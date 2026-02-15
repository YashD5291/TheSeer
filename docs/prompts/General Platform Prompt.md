Mix Resume Prompt 3<role>
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
[Complete resume - clean format, ready for use]
** Only make resume changes in markdown or inline directly. Do not create a Word document.

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

**Languages:** Python, CUDA, SQL, C++, Rust, Golang

**ML Frameworks:** PyTorch, JAX, Triton, Transformers, Hugging Face

**LLM Core:** RAG, PEFT, LoRA, RLHF, DPO, Knowledge Distillation, Flash Attention

**Training:** DeepSpeed, FSDP, Mixed Precision, Multi-GPU, Model Parallelism

langchain, langgraph,

**Inference & Serving:** vLLM, TensorRT-LLM, Triton Server, ONNX, BentoML, Ray Serve

**Data & Storage:** Vector DBs (FAISS, Pinecone, Weaviate), Redis, Kafka, Spark, DuckDB

**MLOps:** Weights & Biases, MLflow, Docker, Kubernetes, CI/CD, A/B Testing

*Languages:** Python, C++, CUDA, SQL, Rust

**ML Frameworks:** PyTorch, TensorFlow, JAX, Scikit-learn, XGBoost, OpenCV

**Core ML:** Computer Vision, Object Detection, Sensor Fusion, Reinforcement Learning, Feature Engineering

**Model Optimization:** Quantization (INT8/FP16), Knowledge Distillation, Pruning, ONNX, TensorRT, Edge Deployment

**MLOps & Infrastructure:** Docker, Kubernetes, AWS (SageMaker, EC2, S3, Lambda), GCP (Vertex AI), MLflow, Weights & Biases, CI/CD

**Data & Storage:** Spark, Kafka, Airflow, Pandas, NumPy, PostgreSQL, MongoDB, Redis, Vector DBs (FAISS, Pinecone)

## Experience

**Senior AI Engineer** | Labelbox -- Remote (San Francisco, CA)  
Jun 2024 – Oct 2025

- Led development of Model Foundry's LLM variants for model-assisted labeling (MAL), modifying transformer encoders with extended self-attention layers to handle multimodal inputs, generating synthetic pre-labels that improved annotation quality while cutting manual labeling by 40%.
- Fine-tuned 7B-parameter models using PEFT/LoRA on proprietary Catalog data, implementing RLHF loops via LLM Human Preference Editor with human preference ranking to align outputs, reducing hallucination rates by 40% in production workflows for enterprise clients including Genentech and P&G.
- Optimized LLM inference with vLLM and TensorRT on A100 clusters, enabling mixed-precision serving with sub-second responses for large-scale exports while meeting GDPR constraints.
- Architected knowledge distillation pipelines from 70B+ foundation models to lighter variants using LoRA adapters for Catalog and Annotate products, maintaining alignment quality through DPO optimization while achieving 50% reduction in annotation costs via Alignerr network's active learning sample selection.
- Led development of scalable data pipelines for computer vision datasets using Labelbox Annotate and Catalog, guiding a team of five to optimize preprocessing and address inconsistencies in robotics and analytics applications for clients like NASA JPL and John Deere.
- Designed embedding pipelines using FAISS and PyTorch integrated with Catalog's similarity search, cutting data retrieval latency by 45% to resolve bottlenecks in edge ML deployments for high-volume industrial systems.
- Integrated compliance protocols into ML infrastructure via Model diagnostics platform, enabling secure model training and deployment in regulated production environments for healthcare clients like Genentech and Intuitive Surgical.
- Developed automated quality validation systems with Trust Score metrics and Alignerr expert review, increasing dataset reliability by 28% to ensure robust non-generative AI models for robotics perception tasks.

**Machine Learning Engineer** | Covariant -- Remote (Berkeley, CA)  
Jan 2022 – May 2024

- Trained RFM-1 (Robotics Foundation Model), an 8B-parameter multimodal transformer for robotic simulation, incorporating self-attention for fusing vision and action data, generating synthetic trajectories that reduced real-data dependency by 30% in manipulation training for Covariant Brain.
- Fine-tuned RFM-1 with RLHF on fleet-collected episodes from Otto Group and Radial deployments, using LoRA to adapt for long-tail scenarios, achieving 20% higher accuracy in zero-shot grasping for novel objects across warehouse robots.
- Optimized model serving with Triton Server for GPU-efficient inference, integrating TensorRT for quantization that cut latency in edge deployments for KNAPP Pick-it-Easy Robot systems at McKesson pharmaceutical facilities.
- Developed diffusion-based generative models for physics predictions within Covariant Brain, distilling from large models to deployment-ready versions, enabling fleet learning across ABB-integrated robotic cells with minimal retraining overhead.
- Built reinforcement learning models for Covariant Brain's robotic manipulation system, achieving 99.99% pick rates and up to 1,600 picks per hour on 1.5M+ interaction datasets to tackle variability in warehouse automation for Otto Group and Radial.
- Implemented sensor fusion pipelines with PyTorch and OpenCV for RFM-1's vision system, adding attention mechanisms to fuse RGB, depth, and force/torque sensor data in cluttered environments for KNAPP Pick-it-Easy Robot deployments.
- Optimized inference code in Rust for concurrent operations on Covariant Brain edge devices, integrating TensorRT quantization (INT8/FP16) that cut latency by 38% to enable real-time decisions in resource-constrained robotic hardware at McKesson pharmaceutical facilities.
- Managed prototype iterations in agile teams for Robotic Putwall and Transporter Putwall systems, refining RL algorithms via fleet learning feedback from deployed robots and deploying updates through CI/CD to meet ABB partnership performance demands.

**Data Engineer** | Rockset (acquired by OpenAI 2024) -- Remote (San Mateo, CA)  
Jun 2020 – Dec 2021

- Built real-time ETL pipelines using Kafka and Spark for the Aggregator-Leaf-Tailer (ALT) architecture, ingesting semi-structured data streams from MongoDB CDC and DynamoDB, enabling sub-millisecond querying via Converged Index.
- Contributed to Converged Index systems combining row, columnar, and inverted indexes for dynamic schemas, supporting real-time analytics on NoSQL and SQL data with Query Lambdas to facilitate fast insights for customers like JetBlue and Klarna.
- Integrated FAISS-based vector search pipelines into RocksDB-Cloud storage layer, accelerating similarity queries for embeddings that laid groundwork for AI-driven applications.
- Troubleshot distributed query systems to achieve high uptime with automated scaling, ensuring reliable low-latency data feeds for production workloads. (Rockset acquired by OpenAI in 2024 for retrieval infrastructure.)
- Constructed ETL pipelines on Rockset's Aggregator-Leaf-Tailer (ALT) architecture, processing 650M+ daily events via Tailer ingestion from Kafka and DynamoDB to handle escalating data demands for customers like PyTorch/Meta CI systems.
- Built vector search pipelines using FAISS integrated with RocksDB-Cloud storage layer, accelerating similarity queries for embeddings to streamline ML feature extraction workflows and reduce latency in distributed cloud systems—technology later acquired by OpenAI.
- Unified data from APIs and databases using Query Lambdas with parameterized SQL endpoints, ensuring accuracy to eliminate errors in Rockset's real-time analytics for enterprise decision-making at JetBlue's ML applications and Klarna's alerting systems.
- Resolved query distribution issues across Leaf nodes, achieving 99% uptime with automated scaling to maintain p95 data latency of 2 seconds and 20K QPS reliability during peak loads in the analytics platform.

**Backend Engineer** | AvidXchange -- Charlotte, NC  
Jun 2018 – May 2020

- Developed Python APIs for AvidInvoice transaction automation, generating secure data flows for 200K+ daily operations integrated with AvidPay Network's 500K+ supplier ecosystem.
- Optimized AvidInvoice OCR processing backends with Redis caching and ML auto-coding, reducing invoice-to-payment delays by 25% for high-volume fintech clients in real estate and construction verticals.
- Collaborated on AvidPay Direct validation endpoints with 2-way/3-way PO matching, enhancing reliability for ACH and virtual card payment automation across enterprise customers.
- Applied scalable microservice designs in code reviews to support AvidXchange's growth processing high annual transaction volume.
- Developed Python APIs for AvidInvoice payment processing, handling 250K+ daily transactions with secure PostgreSQL integrations to AvidPay Network's 500K+ supplier ecosystem, scaling fintech operations efficiently.
- Enhanced AvidInvoice OCR processing with Redis caching and query optimizations for ML auto-coding, addressing bottlenecks in high-volume automation for real estate and construction clients.
- Built AvidPay Direct validation endpoints with 2-way/3-way PO matching for data integrity, improving reliability to minimize errors in AvidXchange's accounts payable automation serving 5,500+ enterprise customers.
- Applied architecture standards in code reviews using AvidStrongroom patterns, enhancing scalability to support growth in AvidXchange's payment automation processing $145B+ annual transaction volume.
## Education

**University of North Carolina at Charlotte**  
May 2018  
Master of Science, Computer Science (Focus: Machine Learning, Distributed Systems, NLP, CV)

**University of North Carolina at Charlotte**  
May 2016  
Bachelor of Science, Computer Science (Major: Software Engineering)

## JOB DESCRIPTION:
Juan Flores
Email: juanflores.work@outlook.com
Phone: +1 (704) 363-9900
LinkedIn: linkedin.com/in/juan-flores-ml
GitHub: github.com/juanf-0gravity
AI Engineer with 5+ years of experience building and deploying AI-powered tools in production, with a focus on bridging technical capabilities and operational workflows. Experienced integrating LLMs (GPT-4, Claude, Gemini) into real products, building automation that eliminates manual processes, and embedding with non-technical teams to identify high-impact problems. Track record shipping AI solutions in healthcare-adjacent environments including pharmaceutical logistics and clinical data platforms. Driven by first principles thinking to move fast and deliver measurable impact.
Skills
Languages: Python, SQL, C++, Golang
AI/LLM: LLM Integration (GPT-4, Claude, Gemini), RAG, Prompt Engineering, RLHF, Fine-tuning (LoRA/PEFT), LangChain, LangGraph
ML Frameworks: PyTorch, Transformers, Hugging Face, Scikit-learn, OpenCV
Infrastructure: Docker, Kubernetes, AWS (EC2, S3, Lambda, SageMaker), GCP (Vertex AI), CI/CD
Data & Storage: PostgreSQL, MongoDB, Redis, Kafka, Spark, Elasticsearch, FAISS, Airflow
MLOps & Tools: Weights & Biases, MLflow, A/B Testing, Retool-style internal dashboards
Experience
Senior AI Engineer | Labelbox, Remote (San Francisco, CA)
Jun 2024 - Jul 2025

Architected Model Foundry's intelligent LLM routing system integrating GPT-4, Claude, and Gemini APIs, automatically selecting optimal models based on task type, cost, and latency to power model-assisted labeling workflows that cut manual annotation effort by 40%.
Built RLHF evaluation infrastructure for healthcare enterprise clients including Genentech and Intuitive Surgical, designing rubric-based assessment systems with multi-dimensional scoring for helpfulness, medical accuracy, and regulatory compliance.
Developed automated quality validation pipelines with Trust Score metrics and expert review workflows, managing a network of 500+ domain-specialist evaluators and increasing dataset reliability by 28% for production AI systems.
Designed embedding search pipelines using FAISS and PyTorch for Catalog's similarity search, cutting data retrieval latency by 45% and enabling non-technical teams to find and curate training data without writing queries.
Integrated compliance protocols into ML infrastructure for regulated healthcare environments, enabling secure model training and deployment that met HIPAA and GDPR requirements for clinical data workflows.

Machine Learning Engineer | Covariant, Remote (Berkeley, CA)
Jan 2022 - May 2024

Built natural language interfaces enabling warehouse operators to communicate with robots using plain English instructions, implementing language grounding systems that connected abstract commands to physical actions, dramatically simplifying operator onboarding and debugging.
Implemented RLHF pipelines collecting millions of preference judgments from non-technical warehouse operators, translating qualitative feedback ("this grasp was too aggressive") into reward models that aligned robot behavior with human expectations.
Deployed production AI systems at McKesson pharmaceutical warehouses, developing specialized perception models for reflective packaging using polarized imaging and achieving 99.99% accuracy in medication handling where errors were safety-critical.
Designed multi-modal sensor fusion pipelines with PyTorch and OpenCV, combining RGB, depth, and force/torque data through attention mechanisms to enable robots to handle novel items zero-shot without retraining.
Shipped iterative updates through CI/CD to deployed robot fleets across 15 countries, using fleet learning to propagate improvements where edge cases encountered at one site immediately improved performance everywhere.

Data Engineer | Rockset (acquired by OpenAI 2024), Remote (San Mateo, CA)
Jun 2020 - Dec 2021

Built real-time ETL pipelines using Kafka and Spark, ingesting semi-structured data streams from MongoDB CDC and DynamoDB, enabling sub-millisecond querying for operational dashboards serving customers like JetBlue and Klarna.
Designed real-time geospatial analytics solution for Command Alkon's construction logistics, building dashboards that tracked millions of deliveries and reduced delays by 35% by giving dispatchers live visibility they previously lacked.
Integrated FAISS-based vector search pipelines into the storage layer, accelerating similarity queries for embeddings and laying groundwork for AI-driven retrieval applications (technology later acquired by OpenAI).
Resolved distributed query bottlenecks across cluster nodes, achieving 99% uptime with automated scaling to maintain sub-2-second p95 latency and 20K QPS reliability during peak loads.

Backend Engineer | AvidXchange, Charlotte, NC
Jun 2018 - May 2020

Embedded with the operations team for a month to identify workflow pain points firsthand, discovering that 70% of invoice exceptions were false positives, then built a confidence scoring system that reduced manual review rates from 30% to 12%.
Developed Python APIs for invoice processing automation handling 250K+ daily transactions, integrating Redis distributed locking and idempotent retry logic that reduced average payment processing time from 8 days to 5 days.
Built mobile approval interfaces and DocuSign integration during COVID-19 rapid response, enabling non-technical managers to approve invoices remotely and eliminating dependency on physical office workflows.
Integrated three additional OCR providers (ABBYY, Tesseract, Amazon Textract) with intelligent routing based on document type and provider load, scaling capacity to handle surge volumes when businesses shifted to digital operations.

Education
University of North Carolina at Charlotte
May 2018
Master of Science, Computer Science (Focus: Machine Learning, Distributed Systems, NLP, CV)
University of North Carolina at Charlotte
May 2016
Bachelor of Science, Computer Science (Major: Software Engineering)
</inputs>

Execute: First consult career story in project documents to understand actual experience scope. Then analyze JD. Then create tailored resume with changelog. Flag any JD requirements you could not address due to lack of matching experience.
Note: Must not use (–) em dash in work experience points or summary. MUST NOT CREATE WORD DOCUMENT OR PDF OR ARTIFACT.


you know we also got the experience and everything you can see in our carreer story so make the resume like that and also show in skills section tooooooo let's fucking goooooo this is resume i gave you is combinition of both resume which is non Gen AI & Gen AI specific. I merged work experience and skills section from both of the resumes. we need to use only show work experience needed for this job and remove other stuff. and also in work experience we only gonna keep 4, max 5 bullet points per job