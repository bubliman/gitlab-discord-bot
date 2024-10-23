import { UserSchema } from '@gitbeaker/core/dist/types/types';
import { Injectable } from '@nestjs/common';
import { GitlabClient } from 'app/libs/gitlab/client';
import { MrApprovedWebhookPayload } from 'app/libs/gitlab/dtos/mr-approved.interface';
import { logger } from 'app/libs/logger';
import { DatabaseClient } from 'app/modules/database/database.service';
import { DiscordService } from 'app/modules/discord/discord.service';
@Injectable()
export class MergeRequestApprovedService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly discord: DiscordService,
    private readonly gitlab: GitlabClient,
  ) {}

  async notifyAssigneesForApproval(
    author: Omit<UserSchema, 'created_at'>,
    projectName: string,
    mrTitle: string,
    mrUrl: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const channel = this.discord.mrChannel!;
    const gitlabUsernames = [author.username] as string[];
    for (const gitlabUsername of gitlabUsernames) {
      logger.log(
        `Notifying assignee ${gitlabUsername} for '${projectName}/${mrTitle}' approval`,
      );

      const trackers = await this.db.tracker.findMany({
        where: {
          gitlabUsername,
        },
        include: { user: true },
      });

      const idsToNotify = trackers
        // .filter(
        //   (tracker) =>
        //     !(
        //       tracker.gitlabUsername === author.username &&
        //       tracker.user.gitlabUsername === author.username
        //     ),
        // )
        .map((tracker) => tracker.user.discordId);
      // Create a string with pings for each reviewer

      const emoji = ':white_check_mark: ';
      const messageText = ` I've been approved, you can merge me! ${emoji} MR: **[${mrTitle} - ${mrUrl
        .split('')
        .slice(mrUrl.length - 2, mrUrl.length)
        .join('')}](${mrUrl})** by ${author.name}`;
      channel.send({
        content: `${
          idsToNotify.length
            ? idsToNotify.map((id) => `<@${id}>`)
            : gitlabUsername
        } ${messageText}`,
      });
      for (const id of idsToNotify) {
        const pingMessage = id ? `<@${id}>` : gitlabUsername;

        logger.log(`Notifying ${id}`);
        const user = this.discord.users.cache.get(id);

        if (user) {
          logger.log(`Notifying user ${id} for mr ${mrTitle}`);

          user.send({
            content: pingMessage + messageText,
            // embeds: [
            //   new MessageEmbed()
            //     .setTitle(
            //       `Merge request ${mrTitle} approved by ${author.username}`,
            //     )
            //     .setColor('#409bd7')
            //     .setDescription(
            //       `A merge request your are assigned on **${projectName}** has been approved.\n\n**[${mrTitle} - ${mrUrl
            // .split('')
            // .slice(mrUrl.length - 2, mrUrl.length).join('')}](${mrUrl})**`,
            //     )
            //     .setThumbnail(
            //       'https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png',
            //     )
            //     .setTimestamp(),
            // ],
          });
        } else {
          logger.warn(`User ${id} not in cache`);
        }
      }
    }
  }

  async handleMergeRequestApproved(payload: MrApprovedWebhookPayload) {
    const { object_attributes, project } = payload;

    const author = await this.gitlab.Users.show(object_attributes.author_id);

    this.notifyAssigneesForApproval(
      author,
      project.name,
      object_attributes.title,
      object_attributes.url,
    );
  }
}
