import type { TailoredResume } from './types.js';

/**
 * Parses Claude's response from claude.ai.
 *
 * Expected output format (defined by the prompt templates):
 *   ## CHAT TITLE
 *   [Company] - [Role] Resume Analysis
 *   ---
 *   ## ANALYSIS
 *   [analysis content]
 *   ---
 *   ## TAILORED RESUME
 *   [resume content]
 *   ---
 *   ## CHANGELOG
 *   [changelog content]
 */
export function parseClaudeResponse(
  rawResponse: string,
  company: string,
  title: string
): TailoredResume {

  // Extract chat title
  const chatTitleMatch = rawResponse.match(/##\s*CHAT\s*TITLE\s*\n+\*?\*?(?:MUST[^:]*:\s*)?([^\n*]+)/i);
  const chatTitle = chatTitleMatch?.[1]?.trim() || `${company} - ${title} Resume Analysis`;

  // Extract tailored resume section
  let tailoredText = '';
  const resumePatterns = [
    /##\s*TAILORED\s*RESUME\s*\n([\s\S]*?)(?=\n---\s*\n##\s*CHANGELOG|$)/i,
    /##\s*TAILORED\s*RESUME\s*\n([\s\S]*?)(?=\n##\s*CHANGELOG|$)/i,
    /---TAILORED RESUME---([\s\S]*?)---/,
  ];

  for (const pattern of resumePatterns) {
    const match = rawResponse.match(pattern);
    if (match?.[1]?.trim()) {
      tailoredText = match[1].trim();
      // Remove trailing formatting markers
      tailoredText = tailoredText.replace(/\*\*\s*Only make resume changes.*$/i, '').trim();
      break;
    }
  }

  // Fallback: if no markers found, treat the whole response as resume
  if (!tailoredText) {
    tailoredText = rawResponse.trim();
  }

  // Extract changelog / customization notes
  let notes = '';
  const changelogMatch = rawResponse.match(/##\s*CHANGELOG\s*\n([\s\S]*?)$/i);
  if (changelogMatch?.[1]) {
    notes = changelogMatch[1].trim();
  }

  // Extract analysis for interview prep hints
  const prep: string[] = [];
  const analysisMatch = rawResponse.match(/##\s*ANALYSIS\s*\n([\s\S]*?)(?=\n---\s*\n##\s*TAILORED)/i);
  if (analysisMatch?.[1]) {
    // Extract gap analysis items as interview prep topics
    const gapRows = analysisMatch[1].match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
    if (gapRows) {
      for (const row of gapRows) {
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 3 && !cells[0].startsWith('JD') && !cells[0].startsWith('---')) {
          prep.push(`Be ready to discuss: ${cells[0]}`);
        }
      }
    }
  }

  return {
    chat_title: chatTitle,
    tailored_text: tailoredText,
    customization_notes: notes,
    interview_prep: prep,
  };
}
