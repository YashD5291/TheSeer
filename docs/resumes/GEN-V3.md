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