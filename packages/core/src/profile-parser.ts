import type { ParsedProfile } from './types.js';

// Comprehensive skill dictionary — canonical name → regex patterns
// Skills appearing in all 3 resumes = expert, 2 = proficient, 1 = familiar
const TECH_SKILLS: Array<{ canonical: string; patterns: RegExp[] }> = [
  // Languages
  { canonical: 'python', patterns: [/\bpython\b/i] },
  { canonical: 'c++', patterns: [/\bc\+\+\b/i] },
  { canonical: 'cuda', patterns: [/\bcuda\b/i] },
  { canonical: 'sql', patterns: [/\bsql\b/i] },
  { canonical: 'rust', patterns: [/\brust\b/i] },
  { canonical: 'golang', patterns: [/\bgolang\b/i] },
  { canonical: 'java', patterns: [/\bjava\b/i] },
  { canonical: 'javascript', patterns: [/\bjavascript\b/i] },
  { canonical: 'typescript', patterns: [/\btypescript\b/i] },

  // ML Frameworks
  { canonical: 'pytorch', patterns: [/\bpytorch\b/i, /\btorch\b/i] },
  { canonical: 'tensorflow', patterns: [/\btensorflow\b/i] },
  { canonical: 'jax', patterns: [/\bjax\b/i] },
  { canonical: 'scikit-learn', patterns: [/\bscikit-learn\b/i, /\bsklearn\b/i] },
  { canonical: 'xgboost', patterns: [/\bxgboost\b/i] },
  { canonical: 'opencv', patterns: [/\bopencv\b/i] },
  { canonical: 'triton', patterns: [/\btriton\b(?!\s*server)/i] },

  // LLM / GenAI
  { canonical: 'transformers', patterns: [/\btransformers?\b/i, /\btransformer architectures?\b/i] },
  { canonical: 'hugging face', patterns: [/\bhugging\s*face\b/i, /\bhuggingface\b/i] },
  { canonical: 'llm', patterns: [/\bllms?\b/i, /\blarge language model/i] },
  { canonical: 'rag', patterns: [/\brag\b/i, /\bretrieval.augmented.generation\b/i] },
  { canonical: 'langchain', patterns: [/\blangchain\b/i] },
  { canonical: 'langgraph', patterns: [/\blanggraph\b/i] },
  { canonical: 'crewai', patterns: [/\bcrewai\b/i] },
  { canonical: 'peft', patterns: [/\bpeft\b/i] },
  { canonical: 'lora', patterns: [/\blora\b/i] },
  { canonical: 'rlhf', patterns: [/\brlhf\b/i, /\breinforcement learning from human feedback\b/i] },
  { canonical: 'dpo', patterns: [/\bdpo\b/i, /\bdirect preference optimization\b/i] },
  { canonical: 'ppo', patterns: [/\bppo\b/i, /\bproximal policy optimization\b/i] },
  { canonical: 'knowledge distillation', patterns: [/\bknowledge distillation\b/i, /\bdistillation\b/i] },
  { canonical: 'flash attention', patterns: [/\bflash attention\b/i] },
  { canonical: 'prompt engineering', patterns: [/\bprompt engineering\b/i] },
  { canonical: 'embeddings', patterns: [/\bembeddings?\b/i] },
  { canonical: 'fine-tuning', patterns: [/\bfine.?tuning\b/i, /\bfine.?tuned?\b/i] },
  { canonical: 'generative ai', patterns: [/\bgenerative ai\b/i, /\bgen.?ai\b/i] },

  // Inference & Serving
  { canonical: 'vllm', patterns: [/\bvllm\b/i] },
  { canonical: 'tensorrt', patterns: [/\btensorrt\b/i] },
  { canonical: 'triton server', patterns: [/\btriton server\b/i] },
  { canonical: 'onnx', patterns: [/\bonnx\b/i] },
  { canonical: 'bentoml', patterns: [/\bbentoml\b/i] },
  { canonical: 'ray serve', patterns: [/\bray serve\b/i] },

  // Training
  { canonical: 'deepspeed', patterns: [/\bdeepspeed\b/i] },
  { canonical: 'fsdp', patterns: [/\bfsdp\b/i, /\bfully sharded data parallel\b/i] },
  { canonical: 'mixed precision', patterns: [/\bmixed.?precision\b/i] },
  { canonical: 'model parallelism', patterns: [/\bmodel parallelism\b/i] },

  // ML Core
  { canonical: 'computer vision', patterns: [/\bcomputer vision\b/i] },
  { canonical: 'object detection', patterns: [/\bobject detection\b/i] },
  { canonical: 'sensor fusion', patterns: [/\bsensor fusion\b/i] },
  { canonical: 'reinforcement learning', patterns: [/\breinforcement learning\b/i] },
  { canonical: 'feature engineering', patterns: [/\bfeature engineering\b/i] },
  { canonical: 'nlp', patterns: [/\bnlp\b/i, /\bnatural language processing\b/i] },
  { canonical: 'deep learning', patterns: [/\bdeep learning\b/i] },
  { canonical: 'machine learning', patterns: [/\bmachine learning\b/i] },
  { canonical: 'quantization', patterns: [/\bquantization\b/i, /\bint8\b/i, /\bfp16\b/i] },
  { canonical: 'pruning', patterns: [/\bpruning\b/i] },
  { canonical: 'edge deployment', patterns: [/\bedge deployment\b/i, /\bedge devices?\b/i] },
  { canonical: 'a/b testing', patterns: [/\ba\/b testing\b/i] },

  // Vector DBs
  { canonical: 'faiss', patterns: [/\bfaiss\b/i] },
  { canonical: 'pinecone', patterns: [/\bpinecone\b/i] },
  { canonical: 'weaviate', patterns: [/\bweaviate\b/i] },
  { canonical: 'chromadb', patterns: [/\bchromadb\b/i, /\bchroma\b/i] },
  { canonical: 'vector databases', patterns: [/\bvector db/i, /\bvector database/i] },

  // Data
  { canonical: 'spark', patterns: [/\bspark\b/i, /\bapache spark\b/i] },
  { canonical: 'kafka', patterns: [/\bkafka\b/i] },
  { canonical: 'airflow', patterns: [/\bairflow\b/i] },
  { canonical: 'dbt', patterns: [/\bdbt\b/i] },
  { canonical: 'snowflake', patterns: [/\bsnowflake\b/i] },
  { canonical: 'bigquery', patterns: [/\bbigquery\b/i] },
  { canonical: 'redshift', patterns: [/\bredshift\b/i] },
  { canonical: 'postgresql', patterns: [/\bpostgresql\b/i, /\bpostgres\b/i] },
  { canonical: 'mongodb', patterns: [/\bmongodb\b/i, /\bmongo\b/i] },
  { canonical: 'redis', patterns: [/\bredis\b/i] },
  { canonical: 'elasticsearch', patterns: [/\belasticsearch\b/i] },
  { canonical: 'duckdb', patterns: [/\bduckdb\b/i] },
  { canonical: 'pandas', patterns: [/\bpandas\b/i] },
  { canonical: 'numpy', patterns: [/\bnumpy\b/i] },

  // Cloud
  { canonical: 'aws', patterns: [/\baws\b/i, /\bamazon web services\b/i] },
  { canonical: 'gcp', patterns: [/\bgcp\b/i, /\bgoogle cloud\b/i] },
  { canonical: 'azure', patterns: [/\bazure\b/i] },
  { canonical: 'sagemaker', patterns: [/\bsagemaker\b/i] },
  { canonical: 'vertex ai', patterns: [/\bvertex ai\b/i] },
  { canonical: 'ec2', patterns: [/\bec2\b/i] },
  { canonical: 's3', patterns: [/\bs3\b/i] },
  { canonical: 'lambda', patterns: [/\blambda\b/i] },

  // DevOps / MLOps
  { canonical: 'docker', patterns: [/\bdocker\b/i] },
  { canonical: 'kubernetes', patterns: [/\bkubernetes\b/i, /\bk8s\b/i] },
  { canonical: 'terraform', patterns: [/\bterraform\b/i] },
  { canonical: 'ci/cd', patterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i] },
  { canonical: 'github actions', patterns: [/\bgithub actions\b/i] },
  { canonical: 'mlflow', patterns: [/\bmlflow\b/i] },
  { canonical: 'weights & biases', patterns: [/\bweights\s*[&and]+\s*biases\b/i, /\bwandb\b/i] },

  // Web / API
  { canonical: 'react', patterns: [/\breact\b/i] },
  { canonical: 'next.js', patterns: [/\bnext\.js\b/i, /\bnextjs\b/i] },
  { canonical: 'node.js', patterns: [/\bnode\.js\b/i, /\bnodejs\b/i] },
  { canonical: 'fastapi', patterns: [/\bfastapi\b/i] },
  { canonical: 'flask', patterns: [/\bflask\b/i] },
  { canonical: 'rest api', patterns: [/\brest api\b/i, /\brestful\b/i] },
  { canonical: 'graphql', patterns: [/\bgraphql\b/i] },
  { canonical: 'grpc', patterns: [/\bgrpc\b/i] },

  // General
  { canonical: 'git', patterns: [/\bgit\b/i] },
  { canonical: 'linux', patterns: [/\blinux\b/i] },
  { canonical: 'agile', patterns: [/\bagile\b/i] },
];

function extractSkillsFromText(text: string): Set<string> {
  const found = new Set<string>();
  for (const skill of TECH_SKILLS) {
    for (const pattern of skill.patterns) {
      if (pattern.test(text)) {
        found.add(skill.canonical);
        break;
      }
    }
  }
  return found;
}

function extractYearsOfExperience(story: string): number {
  // Try explicit "X+ years of experience" patterns
  const explicit = story.match(/(\d+)\+?\s*years?\s*(?:of)?\s*(?:professional\s+)?(?:experience|in\s+(?:tech|software|AI|ML|machine learning|the industry))/i);
  if (explicit) return parseInt(explicit[1]);

  // Look for first employment date (joined/started at a company, not university)
  const workPatterns = [
    /(?:joined|started at|began at|began working)\s+(?!.*(?:university|college|school|UNC|program)).*?(20\d{2})/gi,
    /(?:When I joined)\s+(?!.*(?:university|college|school|UNC))(\w+).*?(20\d{2})/gi,
  ];

  let earliestWork = Infinity;
  for (const pattern of workPatterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      const yearStr = match[0].match(/20\d{2}/);
      if (yearStr) {
        const year = parseInt(yearStr[0]);
        if (year >= 2015) { // Reasonable start of career
          earliestWork = Math.min(earliestWork, year);
        }
      }
    }
  }

  if (earliestWork < Infinity) {
    return new Date().getFullYear() - earliestWork;
  }

  // Fallback: look for "Jun YYYY" style dates in experience sections
  const expDates = story.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+20\d{2}/gi);
  if (expDates?.length) {
    const years = expDates.map(d => {
      const m = d.match(/20\d{2}/);
      return m ? parseInt(m[0]) : Infinity;
    }).filter(y => y >= 2015);
    if (years.length) {
      return new Date().getFullYear() - Math.min(...years);
    }
  }

  return 0;
}

function extractTitles(story: string): string[] {
  // Look for explicit job title patterns in the career story
  const titlePatterns = [
    /\*\*([^*]*(?:Engineer|Scientist|Developer|Architect)[^*]*)\*\*/gi,
    /(?:Senior|Staff|Lead|Principal)?\s*(?:ML|Machine Learning|AI|Data|Software|Backend|Full.?Stack)\s*(?:Engineer|Scientist|Developer|Architect)/gi,
  ];
  const titles = new Set<string>();
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      const title = (match[1]?.trim() || match[0].trim())
        .replace(/\.$/, '')
        .replace(/\s*\|.*$/, '') // Remove "| Company" part
        .trim();
      if (title.length > 5 && title.length < 60) {
        titles.add(title);
      }
    }
  }
  return [...titles];
}

function extractTargetTitles(story: string): string[] {
  // Look for explicit "looking for X role" patterns, not generic "interested in" phrases
  const patterns = [
    /(?:looking for|targeting|seeking)\s+(?:roles?\s+(?:as|in)\s+)?["']?([^"'\n.]{5,50}(?:Engineer|Scientist|Developer|Architect|Lead|Manager)[^"'\n.]{0,20})/gi,
  ];
  const titles: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      titles.push(match[1].trim());
    }
  }
  return titles;
}

function extractIndustries(story: string): string[] {
  const known = [
    'fintech', 'healthcare', 'e-commerce', 'saas', 'ai',
    'robotics', 'autonomous', 'defense', 'education', 'media',
    'gaming', 'logistics', 'pharmaceutical', 'financial services',
    'real-time analytics', 'data infrastructure',
  ];
  const lower = story.toLowerCase();
  return known.filter(i => lower.includes(i));
}

function extractDealBreakers(story: string): string[] {
  // Only match explicit preference/requirement statements, not narrative context
  const breakers: string[] = [];
  const patterns = [
    /(?:deal.?breaker|won't consider|refuse to work)\s*[:\-]\s*([^\n.]+)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(story)) !== null) {
      breakers.push(match[1]?.trim() || match[0].trim());
    }
  }
  return breakers;
}

function extractLocationPrefs(story: string): Record<string, boolean> {
  const lower = story.toLowerCase();
  return {
    remote: /remote/i.test(lower),
    hybrid: /hybrid/i.test(lower),
    onsite: /on.?site/i.test(lower),
  };
}

export function parseProfile(
  careerStory: string,
  resumes: { gen_ai: string; mle: string; mix: string }
): ParsedProfile {

  // Extract skills from each resume
  const skillSets = {
    gen_ai: extractSkillsFromText(resumes.gen_ai),
    mle: extractSkillsFromText(resumes.mle),
    mix: extractSkillsFromText(resumes.mix),
  };

  // Count occurrences across resumes
  const skillCounts = new Map<string, number>();
  for (const skills of Object.values(skillSets)) {
    for (const skill of skills) {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    }
  }

  // Categorize by frequency across the 3 resumes
  const expert: string[] = [];
  const proficient: string[] = [];
  const familiar: string[] = [];

  for (const [skill, count] of skillCounts) {
    if (count >= 3) expert.push(skill);
    else if (count === 2) proficient.push(skill);
    else familiar.push(skill);
  }

  // Parse career story for metadata
  const years = extractYearsOfExperience(careerStory);
  const titles = extractTitles(careerStory);

  return {
    skills_expert: expert.sort(),
    skills_proficient: proficient.sort(),
    skills_familiar: familiar.sort(),
    experience_years: years,
    titles_held: titles,
    target_titles: extractTargetTitles(careerStory),
    target_industries: extractIndustries(careerStory),
    deal_breakers: extractDealBreakers(careerStory),
    location_preferences: extractLocationPrefs(careerStory),
  };
}
