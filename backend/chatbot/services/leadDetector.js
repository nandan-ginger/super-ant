'use strict';
const logger = require('../../common/utils/logger');

/**
 * Lead Detection Service
 *
 * Scans user messages for intent signals that indicate a potential sales lead.
 * Uses keyword + phrase pattern matching (no ML needed at MVP scale).
 *
 * Intent categories:
 *   - pricing     : asking about cost, plans, pricing
 *   - demo        : requesting a demo, trial, or POC
 *   - contact     : asking to be contacted or to speak with someone
 *   - purchase    : expressing intent to buy or implement
 *   - consultation: asking for advice, proposal, or consultation
 */

const INTENT_PATTERNS = [
  {
    intent: 'pricing',
    patterns: [
      /how much (does|is|would|will)/i,
      /\bpric(e|ing|ed)\b/i,
      /\bcost\b/i,
      /\bplan(s)?\b/i,
      /\bsubscription\b/i,
      /\bfee(s)?\b/i,
      /\bbilling\b/i,
      /\bafford/i,
      /\bdiscount\b/i,
      /\bquote\b/i,
      /how (much|many|expensive)/i,
      /what('s| is| are) the (cost|pric|fee|charge)/i,
    ],
  },
  {
    intent: 'demo',
    patterns: [
      /\bdemo\b/i,
      /\btrial\b/i,
      /\bpilot\b/i,
      /\bproof of concept\b/i,
      /\bpoc\b/i,
      /\bfree (trial|version|plan)\b/i,
      /\btry (it|this|the|your)\b/i,
      /can (i|we) (see|try|test|use)\b/i,
    ],
  },
  {
    intent: 'contact',
    patterns: [
      /contact (me|us|you|someone)/i,
      /speak (with|to) (someone|a person|a human|an agent|your team)/i,
      /talk to (someone|a person|sales|support)/i,
      /get in touch/i,
      /reach (out|me)/i,
      /call (me|us|back)/i,
      /someone (call|contact|reach)/i,
      /\bsupport team\b/i,
      /\bsales team\b/i,
    ],
  },
  {
    intent: 'purchase',
    patterns: [
      /\bbuy\b/i,
      /\bpurchase\b/i,
      /\bimplement(ation|ing)?\b/i,
      /\bdeploy\b/i,
      /\bintegrat(e|ion)\b/i,
      /\broll out\b/i,
      /need (this|it) for (my|our|the) (company|team|business|org)/i,
      /want to (use|get|have|start)\b/i,
      /interested in (getting|using|buying|starting)/i,
    ],
  },
  {
    intent: 'consultation',
    patterns: [
      /\bconsult(ation|ant)?\b/i,
      /\bproposal\b/i,
      /\bmeeting\b/i,
      /\bschedule\b/i,
      /\bbook (a|an)\b/i,
      /\badvice\b/i,
      /\brecommend\b/i,
      /\bcustom(ize|ization|ised)?\b/i,
      /\benterprise\b/i,
    ],
  },
];

/**
 * Analyse a user message for lead signals.
 *
 * @param {string} message  The user's raw message text
 * @returns {{ leadDetected: boolean, intent: string | null, matchedPatterns: string[] }}
 */
function detectLeadIntent(message) {
  if (!message || typeof message !== 'string') {
    return { leadDetected: false, intent: null, matchedPatterns: [] };
  }

  for (const { intent, patterns } of INTENT_PATTERNS) {
    const matched = patterns.filter((p) => p.test(message));
    if (matched.length > 0) {
      logger.debug(`Lead detected: intent="${intent}"`, { message: message.slice(0, 80) });
      return {
        leadDetected: true,
        intent,
        matchedPatterns: matched.map((p) => p.source),
      };
    }
  }

  return { leadDetected: false, intent: null, matchedPatterns: [] };
}

module.exports = { detectLeadIntent, INTENT_PATTERNS };
