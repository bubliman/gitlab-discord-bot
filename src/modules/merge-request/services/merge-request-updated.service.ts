import { Injectable } from '@nestjs/common';
import { gitlabClient } from 'app/libs/gitlab/client';
import { logger } from 'app/libs/logger';
import { MrUpdateWebhookPayload } from '../../../libs/gitlab/dtos/mr-updated.interface';
import { MergeRequestOpenedService } from './merge-request-opened.service';

@Injectable()
export class MergeRequestUpdatedService {
  constructor(
    private readonly mergeRequestOpenedService: MergeRequestOpenedService,
  ) {}

  async handleMrUpdatedWebhook(payload: MrUpdateWebhookPayload) {
    const {
      project,
      object_attributes: mr,
      assignees,
      repository,
      reviewers,
      changes,
    } = payload;
    const undrafted =
      changes.title && !changes.title.current.includes('Draft:');

    const author = await gitlabClient.Users.show(
      payload.object_attributes.author_id,
    );
    if (!assignees?.length || !reviewers?.length) {
      logger.log(`no assignees or reviewers in the MR, no notification sent`);
      return undefined;
    }
    if (undrafted) {
      this.mergeRequestOpenedService.notifyChannelForMR(
        author,
        repository.name,
        mr.title,
        mr.url,
        assignees,
        reviewers,
      );

      this.mergeRequestOpenedService.notifyAssigneesForMR(
        assignees,
        reviewers,
        author,
        repository.name,
        mr.title,
        mr.url,
      );
    } else if (changes.assignees || changes.reviewers) {
      this.mergeRequestOpenedService.notifyChannelForMR(
        author,
        repository.name,
        mr.title,
        mr.url,
        changes?.assignees?.current ?? assignees,
        changes?.reviewers?.current ?? reviewers,
      );
      this.mergeRequestOpenedService.notifyAssigneesForMR(
        changes?.assignees?.current ?? assignees,
        changes?.reviewers?.current ?? reviewers,
        author,
        project.name,
        mr.title,
        mr.url,
      );
    }
  }
}
