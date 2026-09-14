export interface ContentContext {
  contactName?: string;
  dealName?: string;
  companyName?: string;
  dealValue?: number;
  currency?: string;
  purpose?: string; // e.g. "follow-up", "check-in", "proposal nudge"
  tone?: 'professional' | 'friendly' | 'concise';
  reason?: string; // why the AI is prompting this content, e.g. "no activity for 8 days"
  senderName?: string;
  objections?: string[];
  /** Real, recent Activity/Conversation history summarized in plain language — grounds the draft in actual history rather than generic filler. */
  recentActivitySummary?: string;
  /** Which proposal section to generate, e.g. "executive_summary" | "scope" | "pricing" | "timeline" | "why_us". */
  section?: string;
}

function money(ctx: ContentContext) {
  if (!ctx.dealValue) return '';
  const currency = ctx.currency || 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(ctx.dealValue);
}

/** Deterministic, personalized email drafting — used by the local AI provider and as a base for the LLM provider. */
export function generateEmailTemplate(ctx: ContentContext): { subject: string; body: string } {
  const name = ctx.contactName || 'there';
  const deal = ctx.dealName || 'our conversation';
  const sender = ctx.senderName || 'the team';
  const tone = ctx.tone || 'professional';

  const subject =
    ctx.purpose === 'proposal nudge'
      ? `Following up on the proposal for ${deal}`
      : `Checking in on ${deal}`;

  const opener =
    tone === 'friendly'
      ? `Hi ${name}, hope you're doing well!`
      : `Hi ${name},`;

  // `reason` is sometimes a lowercase clause fragment ("the deal has gone quiet...") meant to be
  // wrapped in "I wanted to reach out since {reason}.", and sometimes already a complete,
  // capitalized sentence (e.g. from the anomaly-detection/next-best-action pipeline). Wrapping
  // the latter reads as broken grammar ("since No activity..." with a trailing double period),
  // so a reason that already ends in sentence punctuation is used standalone instead.
  const trimmedReason = ctx.reason?.trim();
  const reasonIsFullSentence = trimmedReason ? /[.!?]$/.test(trimmedReason) : false;
  const bodyReason = trimmedReason
    ? reasonIsFullSentence
      ? trimmedReason
      : `I wanted to reach out since ${trimmedReason}.`
    : 'I wanted to check in and see how things are progressing on your end.';

  const activityLine = ctx.recentActivitySummary ? ` ${ctx.recentActivitySummary}` : '';
  const valueLine = ctx.dealValue ? ` As we discussed, this would cover ${money(ctx)} for ${deal}.` : '';

  const closing =
    tone === 'friendly'
      ? `Would love to grab 15 minutes this week — let me know what works.\n\nBest,\n${sender}`
      : `Would you have 15 minutes this week for a quick call to discuss next steps?\n\nBest regards,\n${sender}`;

  const body = `${opener}\n\n${bodyReason}${activityLine}${valueLine}\n\n${closing}`;
  return { subject, body };
}

/** Short, conversational WhatsApp message drafting. */
export function generateWhatsAppTemplate(ctx: ContentContext): { body: string } {
  const name = ctx.contactName || 'there';
  const deal = ctx.dealName;
  const reason = ctx.reason ? ` — ${ctx.reason}` : '';
  const body = deal
    ? `Hi ${name}! Just checking in on ${deal}${reason}. Do you have a few minutes this week to connect? 🙂`
    : `Hi ${name}! Just checking in${reason}. Let me know if you have a few minutes this week!`;
  return { body };
}

export interface CallScript {
  opening: string;
  context: string;
  discoveryQuestions: string[];
  objectionHandling: { objection: string; response: string }[];
  closing: string;
}

/** Structured call script: opening, context, discovery, objection handling, closing. */
export function generateCallScriptTemplate(ctx: ContentContext): CallScript {
  const name = ctx.contactName || 'the contact';
  const deal = ctx.dealName || 'the opportunity';
  const company = ctx.companyName ? ` at ${ctx.companyName}` : '';

  const objections = ctx.objections?.length
    ? ctx.objections
    : ['The price is too high', "We need to think about it", 'We are happy with our current solution'];

  return {
    opening: `Hi ${name}, this is ${ctx.senderName || '[your name]'} calling about ${deal}. Do you have a few minutes?`,
    context: ctx.reason
      ? `I'm reaching out because ${ctx.reason}. I wanted to make sure we're still aligned and see how I can help move things forward${company}.`
      : `I wanted to check in on where things stand with ${deal} and see if there's anything blocking a decision${company}.`,
    discoveryQuestions: [
      'What has changed on your end since we last spoke?',
      'Who else is involved in making this decision?',
      'What would need to be true for this to move forward this quarter?',
      'Is there anything currently holding this back?',
    ],
    objectionHandling: objections.map((objection) => ({
      objection,
      response: buildObjectionResponse(objection, ctx),
    })),
    closing: `Based on what we've discussed, the next step would be [propose concrete next step]. Does that work for you?`,
  };
}

function buildObjectionResponse(objection: string, ctx: ContentContext): string {
  const lower = objection.toLowerCase();
  if (lower.includes('price') || lower.includes('cost') || lower.includes('expensive')) {
    return `I understand budget is a real concern. Let's look at the ROI over the contract term${ctx.dealValue ? ` — at ${money(ctx)}, ` : ' — '}and see if there's a phased approach that works better for you.`;
  }
  if (lower.includes('think') || lower.includes('time')) {
    return `Totally fair — what specifically would help you feel confident moving forward? I can put together anything that's missing.`;
  }
  if (lower.includes('current') || lower.includes('happy')) {
    return `Glad to hear your current setup is working. Can I ask what would need to improve for you to consider a change?`;
  }
  return `That's a fair point — let's dig into what's behind that so I can address it directly.`;
}

/** Personalized proposal section generation — content varies by the requested section, all grounded in real deal fields. */
export function generateProposalSection(ctx: ContentContext): { title: string; content: string } {
  const company = ctx.companyName || 'your organization';
  const deal = ctx.dealName || 'this engagement';
  const section = ctx.section || 'executive_summary';

  switch (section) {
    case 'pricing':
      return {
        title: 'Investment',
        content: ctx.dealValue
          ? `${deal} is proposed at ${money(ctx)}${ctx.recentActivitySummary ? `, reflecting the scope discussed in our recent conversations` : ''}. Pricing includes onboarding and the agreed service level for ${company}.`
          : `Pricing for ${deal} will be finalized once scope is confirmed with ${company}.`,
      };
    case 'timeline':
      return {
        title: 'Timeline',
        content: `We propose an implementation timeline for ${deal} that begins immediately upon signature, with a kickoff call scheduled within the first week and initial value delivered to ${company} within the first 30 days.`,
      };
    case 'scope':
      return {
        title: 'Scope of Work',
        content: `This section outlines the scope of ${deal} for ${company}${ctx.recentActivitySummary ? ` — informed by ${ctx.recentActivitySummary.toLowerCase()}` : ''}. Deliverables are scoped to directly address the priorities ${company} has raised.`,
      };
    case 'why_us':
      return {
        title: 'Why This Solution',
        content: `Based on our conversations with ${company}, this solution was scoped specifically around the outcomes discussed for ${deal}, rather than a generic package.`,
      };
    case 'executive_summary':
    default:
      return {
        title: `Proposal for ${company}`,
        content: `This proposal outlines ${deal} for ${company}${ctx.dealValue ? `, valued at ${money(ctx)}` : ''}.${
          ctx.recentActivitySummary ? ` ${ctx.recentActivitySummary}` : ''
        } Based on our conversations, this solution addresses your stated priorities and is scoped to deliver measurable value within your timeline.`,
      };
  }
}
