import mongoose, { Schema, type Document } from 'mongoose';

export interface IEvent {
  type: string;
  timestamp: Date;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface IResume {
  latexSource: string;
  pdfBinary: Buffer;
  pdfSizeBytes: number;
  folderName: string;
  generatedAt: Date;
}

export interface IJob extends Document {
  title: string;
  company: string;
  url: string;
  location?: string;
  salaryRange?: string;
  jobType?: string;
  description: string;
  requirements: string[];
  niceToHaves: string[];
  platform?: string;

  extraction: {
    method: string;
    hadJsonLd: boolean;
    rawTextLength: number;
    iframeUrls: string[];
    crawlServerUsed: boolean;
  };

  analysis: {
    fitScore: number;
    confidence: number;
    recommendedBase: string;
    baseReasoning: string;
    keyMatches: string[];
    gaps: string[];
    gapMitigation: string[];
    tailoringPriorities: string[];
    atsKeywords: string[];
    redFlags: string[];
    estimatedCompetition: string;
    applyRecommendation: string;
  };

  models: {
    grok: string;
    claude: string;
    claudeExtendedThinking: boolean;
  };

  timing: {
    extractionMs?: number;
    crawlMs?: number;
    grokMs?: number;
    claudeSubmitMs?: number;
    claudeResponseMs?: number;
    pdfMs?: number;
    totalMs?: number;
  };

  claudePrompt?: string;
  claudeResponse?: string;
  claudeChatUrl?: string;

  resume?: IResume;

  status: string;
  appliedAt?: Date;
  notes?: string;

  events: IEvent[];

  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    durationMs: Number,
    metadata: Schema.Types.Mixed,
  },
  { _id: false }
);

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    location: String,
    salaryRange: String,
    jobType: String,
    description: { type: String, required: true },
    requirements: [String],
    niceToHaves: [String],
    platform: String,

    extraction: {
      method: String,
      hadJsonLd: Boolean,
      rawTextLength: Number,
      iframeUrls: [String],
      crawlServerUsed: Boolean,
    },

    analysis: {
      fitScore: { type: Number, min: 0, max: 100 },
      confidence: { type: Number, min: 0, max: 100 },
      recommendedBase: { type: String, enum: ['gen_ai', 'mle', 'mix'] },
      baseReasoning: String,
      keyMatches: [String],
      gaps: [String],
      gapMitigation: [String],
      tailoringPriorities: [String],
      atsKeywords: [String],
      redFlags: [String],
      estimatedCompetition: { type: String, enum: ['low', 'medium', 'high'] },
      applyRecommendation: {
        type: String,
        enum: ['strong_yes', 'yes', 'maybe', 'no'],
      },
    },

    models: {
      grok: String,
      claude: String,
      claudeExtendedThinking: Boolean,
    },

    timing: {
      extractionMs: Number,
      crawlMs: Number,
      grokMs: Number,
      claudeSubmitMs: Number,
      claudeResponseMs: Number,
      pdfMs: Number,
      totalMs: Number,
    },

    claudePrompt: String,
    claudeResponse: String,
    claudeChatUrl: String,

    resume: {
      latexSource: String,
      pdfBinary: Buffer,
      pdfSizeBytes: Number,
      folderName: String,
      generatedAt: Date,
    },

    status: {
      type: String,
      default: 'analyzed',
      enum: [
        'analyzed',
        'resume_created',
        'applied',
        'phone_screen',
        'technical',
        'onsite',
        'offer',
        'rejected',
        'withdrawn',
        'ghosted',
      ],
    },
    appliedAt: Date,
    notes: String,

    events: [EventSchema],
  },
  { timestamps: true }
);

JobSchema.index({ status: 1 });
JobSchema.index({ 'analysis.fitScore': -1 });
JobSchema.index({ company: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ 'analysis.recommendedBase': 1 });

export const Job =
  mongoose.models.Job || mongoose.model<IJob>('Job', JobSchema);
