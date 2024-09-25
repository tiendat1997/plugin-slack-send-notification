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
    const { summarizedDocument, slackChannel } = _req.body;
    if (!slackChannel) {
      const validateServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        '[Validation Error] slack channel is required!',
        'Please confirm the Slack channel for sending the message.',
        StatusCodes.BAD_REQUEST
      );
      return handleServiceResponse(validateServiceResponse, res);
    }

    if (!summarizedDocument) {
      const validateServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        '[Validation Error] Summarized document is required!',
        "Please confirm the document you'd like to summarize.",
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

      const slackResponse = await app.client.chat.postMessage({
        token: env.SLACK_BOT_TOKEN,
        channel: slackChannel,
        blocks: blocks,
      });
      console.log('Slack RESPONSE', slackResponse);
      const serviceResponse = new ServiceResponse(
        ResponseStatus.Success,
        'Service is healthy',
        `Summary has been sent to the #${slackChannel} channel.`,
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error) {
      const errorMessage = (error as Error).message;
      let responseObject = 'I cannot do that...';
      if (errorMessage.includes('channel_not_found')) {
        responseObject = `Sorry, we couldn't find the Slack channel: ${slackChannel}.`;
      }
      const errorServiceResponse = new ServiceResponse(
        ResponseStatus.Failed,
        `Error fetching transcript ${errorMessage}`,
        responseObject,
        StatusCodes.INTERNAL_SERVER_ERROR
      );
      return handleServiceResponse(errorServiceResponse, res);
    }
  });
  return router;
})();
