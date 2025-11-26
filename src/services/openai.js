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

  const systemPrompt = `You are a concise meeting summarizer. Output valid Markdown with exactly three headings. Keep total response under 150 words. Be specific and actionable.`;

  const userPrompt = `Summarize this call transcript into three sections:

## Key Topics
(3-5 bullet points of main discussion items)

## Action Items
(Specific next steps with owners if mentioned)

## Sentiment
(One sentence: positive/neutral/negative + brief reason)

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
