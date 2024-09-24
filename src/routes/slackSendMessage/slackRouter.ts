import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { App } from '@slack/bolt';
import express, { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { env } from '@/common/utils/envConfig';
import { handleServiceResponse } from '@/common/utils/httpHandlers';

import { SlackSentStatusSchema } from './slackModel';

export const slackMessageRegistry = new OpenAPIRegistry();
slackMessageRegistry.register('SlackSender', SlackSentStatusSchema);

export const slackMessageRouter: Router = (() => {
  const router = express.Router();

  slackMessageRegistry.registerPath({
    method: 'post',
    path: '/send-message',
    tags: ['Slack Push Message To Channel'],
    responses: createApiResponse(SlackSentStatusSchema, 'Success'),
  });

  router.post('/send-message', async (_req: Request, res: Response) => {
    const { summarizedDocument } = _req.body;
    if (!summarizedDocument) {
      const validateServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        'Please provide document you want to summarize',
        'I cannot do that...',
        StatusCodes.BAD_REQUEST
      );
      return handleServiceResponse(validateServiceResponse, res);
    }

    if (!env.SLACK_SIGNING_SECRET || !env.SLACK_BOT_TOKEN) {
      const validateServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        'Missing Slack API keys',
        'I cannot do that…',
        StatusCodes.BAD_REQUEST
      );
      return handleServiceResponse(validateServiceResponse, res);
    }

    try {
      const app = new App({
        signingSecret: env.SLACK_SIGNING_SECRET,
        token: env.SLACK_BOT_TOKEN,
      });
      const summarizedContent = summarizedDocument;
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':fire: New document published from TypingMind \n\n *Please check it down below:*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: summarizedContent,
            emoji: true,
          },
        },
      ];

      await app.client.chat.postMessage({
        token: env.SLACK_BOT_TOKEN,
        channel: env.SLACK_CHANNEL,
        blocks: blocks,
      });
      const serviceResponse = new ServiceResponse(
        ResponseStatus.Success,
        'Service is healthy',
        'Message Sent!',
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error) {
      const errorMessage = `Error fetching transcript $${(error as Error).message}`;
      const errorServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        errorMessage,
        'I cannot do that...',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
      return handleServiceResponse(errorServiceResponse, res);
    }
  });
  return router;
})();
