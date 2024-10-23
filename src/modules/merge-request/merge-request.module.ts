import { Module } from '@nestjs/common';
import { DatabaseModule } from 'app/modules/database/database.module';
import { DiscordModule } from 'app/modules/discord/discord.module';
import { GitlabModule } from 'app/modules/gitlab-client.module';
import { MergeRequestController } from 'app/modules/merge-request/merge-request.controller';
import { MergeRequestApprovedService } from 'app/modules/merge-request/services/merge-request-approved.service';
import { MergeRequestClosedService } from 'app/modules/merge-request/services/merge-request-closed.service';
import { MergeRequestOpenedService } from 'app/modules/merge-request/services/merge-request-opened.service';
import { MergeRequestUpdatedService } from 'app/modules/merge-request/services/merge-request-updated.service';
import { MergeRequestValidationService } from 'app/modules/merge-request/services/merge-request-validation.service';
import { MergeRequestMergedService } from './services/merge-request-merged.service ';

@Module({
  imports: [DatabaseModule, DiscordModule, GitlabModule],
  providers: [
    MergeRequestValidationService,
    MergeRequestOpenedService,
    MergeRequestUpdatedService,
    MergeRequestClosedService,
    MergeRequestApprovedService,
    MergeRequestMergedService,
  ],
  controllers: [MergeRequestController],
})
export class MergeRequestModule {}
