/**
 * OpenAI API integration
 * Generates meeting summaries from transcripts
 */

const axios = require('axios');
const { log } = require('./logger');

/**
 * Generate a structured summary from a transcript
 * @param {string} transcript - The meeting transcript
 * @param {object} config - Configuration object
 * @returns {string} - Markdown-formatted summary
 */
async function generateSummary(transcript, config) {
  const { model, temperature, maxTokens } = config.openai;

  // Truncate very long transcripts to avoid token limits
  const maxTranscriptLength = 12000;
  const truncatedTranscript = transcript.length > maxTranscriptLength
    ? transcript.substring(0, maxTranscriptLength) + '\n\n[Transcript truncated]'
    : transcript;

  const systemPrompt = `You are an expert sales call analyzer and meeting summarizer. Your job is to create comprehensive, detailed meeting notes that capture all important information from the call. Output valid Markdown. Be thorough and specific - include names, numbers, dates, and specific details mentioned.`;

  const userPrompt = `Create a detailed summary of this sales/business call. Include ALL relevant information discussed:

## Meeting Overview
(Who was on the call, what company they represent, and the purpose of the meeting)

## Key Discussion Points
(Detailed bullet points covering ALL major topics discussed - include specific numbers, pain points, challenges, and context shared)

## Prospect/Client Background
(What did we learn about their business, current situation, challenges, budget, team size, tools they use, etc.)

## Interest & Objections
(What are they interested in? What concerns or objections did they raise? Price sensitivity?)

## Action Items & Next Steps
(Specific follow-ups needed, who owns each action, any timelines mentioned)

## Sales Intelligence
(Deal potential, likelihood to close, recommended follow-up timing, key leverage points)

## Sentiment & Relationship
(Overall tone of the call, rapport level, buying signals or red flags)

Be thorough - this summary will be used as the primary record of this conversation.

TRANSCRIPT:
${truncatedTranscript}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const summary = response.data.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('OpenAI returned empty response');
    }

    return summary;

  } catch (error) {
    log('error', 'OpenAI API error', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    throw error;
  }
}

module.exports = { generateSummary };
