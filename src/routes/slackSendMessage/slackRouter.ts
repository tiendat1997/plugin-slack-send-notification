import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { YoutubeTranscript } from 'youtube-transcript';

import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { ResponseStatus, ServiceResponse } from '@/common/models/serviceResponse';
import { handleServiceResponse } from '@/common/utils/httpHandlers';

import { SlackSentStatusSchema } from './slackModel';
import Slack from "@slack/bolt";

export const slackMessageRegistry = new OpenAPIRegistry();
slackMessageRegistry.register('SlackSender', SlackSentStatusSchema);

export const slackMessageRouter: Router = (() => {
  const router = express.Router();

  slackMessageRegistry.registerPath({
    method: 'get',
    path: '/send',
    tags: ['Slack Push Message To Channel'],
    responses: createApiResponse(SlackSentStatusSchema, 'Success'),
  });

  router.get('/', async (_req: Request, res: Response) => {
    const { summarizedDocument } = _req.query;

    if (!summarizedDocument) {
      return new ServiceResponse(
        ResponseStatus.Failed,
        'Please provide document you want to summarize',
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    try {
      const app = new Slack.App({
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        token: process.env.SLACK_BOT_TOKEN
      });
      const summarizedContent = summarizedDocument;
      const blocks = [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": ":fire: New document published from TypingMind \n\n *Please check it down below:*"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": summarizedContent,
            "emoji": true
          }
        }
      ];
    
      await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN ?? "",
        channel: process.env.SLACK_CHANNEL ?? "",
        blocks: blocks,
        // text: "This is a summarized document."
      })
      const serviceResponse = new ServiceResponse(
        ResponseStatus.Success,
        'Service is healthy',
        "Sent!",
        StatusCodes.OK
      );
      handleServiceResponse(serviceResponse, res);
    } catch (error) {
      const errorMessage = `Error fetching transcript $${(error as Error).message}`;
      return new ServiceResponse(ResponseStatus.Failed, errorMessage, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });
  return router;
})();
