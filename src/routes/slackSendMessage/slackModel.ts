import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export type SlackSentStatus = z.infer<typeof SlackSentStatusSchema>;
export const SlackSentStatusSchema = z.object({
  message: z.string(),
  status: z.string(),
});
