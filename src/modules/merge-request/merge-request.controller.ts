import { Controller, Post, Req } from '@nestjs/common';
import { MrApprovedWebhookPayload } from 'app/libs/gitlab/dtos/mr-approved.interface';
import { MrMergedWebhookPayload } from 'app/libs/gitlab/dtos/mr-merged.interface';
import { MrOpenedWebhookPayload } from 'app/libs/gitlab/dtos/mr-opened.interface';
import { MrUpdateWebhookPayload } from 'app/libs/gitlab/dtos/mr-updated.interface';
import { logger } from 'app/libs/logger';
import { MergeRequestApprovedService } from 'app/modules/merge-request/services/merge-request-approved.service';
import { MergeRequestClosedService } from 'app/modules/merge-request/services/merge-request-closed.service';
import { MergeRequestOpenedService } from 'app/modules/merge-request/services/merge-request-opened.service';
import { MergeRequestUpdatedService } from 'app/modules/merge-request/services/merge-request-updated.service';
import { MergeRequestValidationService } from 'app/modules/merge-request/services/merge-request-validation.service';
import { MergeRequestMergedService } from './services/merge-request-merged.service ';

type WebhookRequest = Express.Request & { body: any };

@Controller('/merge-request')
export class MergeRequestController {
  constructor(
    private readonly mergeRequestValidationService: MergeRequestValidationService,
    private readonly mergeRequestOpenedService: MergeRequestOpenedService,
    private readonly mergeRequestUpdatedService: MergeRequestUpdatedService,
    private readonly mergeRequestClosedService: MergeRequestClosedService,
    private readonly mergeRequestApprovedService: MergeRequestApprovedService,
    private readonly mergeRequestMergedService: MergeRequestMergedService,
  ) {}

  @Post()
  async onMergeRequestWebhook(@Req() req: WebhookRequest) {
    if (
      this.mergeRequestValidationService.shouldHandle(req.body) &&
      this.mergeRequestValidationService.validatePayload(req.body)
    ) {
      const { object_attributes } = req.body;
      const { action } = object_attributes;
      logger.log(`Received mr event with action ${action}`);

      if (action === 'open' || action === 'reopen') {
        const body = req.body as MrOpenedWebhookPayload;
        await this.mergeRequestOpenedService.handleMrOpenedWebhook(body);
      }

      if (action === 'update') {
        const body = req.body as MrUpdateWebhookPayload;
        await this.mergeRequestUpdatedService.handleMrUpdatedWebhook(body);
      }

      // if (action === 'close') {
      //   const body = req.body as MrClosedWebhookPayload;
      //   await this.mergeRequestClosedService.handleMergeRequestClosed(body);
      // }

      if (action === 'approved') {
        const body = req.body as MrApprovedWebhookPayload;
        await this.mergeRequestApprovedService.handleMergeRequestApproved(body);
      }

      if (action === 'merged') {
        const body = req.body as MrMergedWebhookPayload;
        await this.mergeRequestMergedService.handleMrMergedWebhook(body);
      }
    }
  }
}
