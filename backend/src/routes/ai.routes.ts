import { Router, Request, Response } from 'express';
import { claudeService } from '../services/claude.service.js';
import { openaiService } from '../services/openai.service.js';
import { categorizationService } from '../services/categorization.service.js';
import type { APIResponse, SuggestionRequest, SuggestionResponse, Interaction, InteractionLabels } from '../types/index.js';

const router = Router();

// Generate AI suggestions
router.post('/suggest', async (req: Request<{}, {}, SuggestionRequest>, res: Response<APIResponse<SuggestionResponse>>) => {
  try {
    const request = req.body;

    // Validate request
    if (!request.context?.originalMessage) {
      res.status(400).json({
        success: false,
        error: 'context.originalMessage is required',
      });
      return;
    }

    if (!request.provider || !['claude', 'openai'].includes(request.provider)) {
      res.status(400).json({
        success: false,
        error: 'provider must be "claude" or "openai"',
      });
      return;
    }

    let suggestions: string[];

    if (request.provider === 'claude') {
      suggestions = await claudeService.generateSuggestions(request);
    } else {
      suggestions = await openaiService.generateSuggestions(request);
    }

    res.json({
      success: true,
      data: {
        suggestions,
        provider: request.provider,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate suggestions',
    });
  }
});

// Categorize a single interaction
router.post('/categorize', async (req: Request<{}, {}, { interaction: Interaction }>, res: Response<APIResponse<InteractionLabels>>) => {
  try {
    const { interaction } = req.body;

    if (!interaction?.id || !interaction?.content) {
      res.status(400).json({
        success: false,
        error: 'interaction with id and content is required',
      });
      return;
    }

    const labels = await categorizationService.categorizeInteraction(interaction);

    res.json({
      success: true,
      data: labels,
    });
  } catch (error) {
    console.error('Error categorizing interaction:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to categorize interaction',
    });
  }
});

// Categorize multiple interactions
router.post('/categorize-batch', async (req: Request<{}, {}, { interactions: Interaction[] }>, res: Response<APIResponse<Interaction[]>>) => {
  try {
    const { interactions } = req.body;

    if (!interactions?.length) {
      res.status(400).json({
        success: false,
        error: 'interactions array is required',
      });
      return;
    }

    const labeled = await categorizationService.categorizeMultiple(interactions);

    res.json({
      success: true,
      data: labeled,
    });
  } catch (error) {
    console.error('Error categorizing interactions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to categorize interactions',
    });
  }
});

// Health check for AI services
router.get('/health', async (_req: Request, res: Response) => {
  // In mock mode (no real keys), both providers are "available" via mock data
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const claudeConfigured = !claudeKey || claudeKey === 'your_anthropic_api_key' ? true : !!claudeKey;
  const openaiConfigured = !openaiKey || openaiKey === 'your_openai_api_key' ? true : !!openaiKey;

  const status = {
    claude: { configured: claudeConfigured },
    openai: { configured: openaiConfigured },
  };

  res.json({
    success: true,
    data: status,
  });
});

export default router;
