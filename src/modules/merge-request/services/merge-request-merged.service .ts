import { UserSchema } from '@gitbeaker/core/dist/types/types';
import { Injectable } from '@nestjs/common';
import { GitlabClient } from 'app/libs/gitlab/client';
import { User } from 'app/libs/gitlab/dtos/common';
import { logger } from 'app/libs/logger';
import { DatabaseClient } from 'app/modules/database/database.service';
import { DiscordService } from 'app/modules/discord/discord.service';
import { MrMergedWebhookPayload } from '../../../libs/gitlab/dtos/mr-merged.interface';
@Injectable()
export class MergeRequestMergedService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly discord: DiscordService,
    private readonly gitlab: GitlabClient,
  ) {}

  async getMessage(
    id: string,
    author: Omit<UserSchema, 'created_at'>,
    mrTitle: string,
    mrUrl: string,
  ) {
    // Fetch the corresponding Discord IDs from the database

    // Create a string with pings for each reviewer
    const pingMessage = id ? `<@${id}>` : author.username;

    const emoji = ':partying_face::checkered_flag:';

    // Review request

    return `${pingMessage} MERGED!!! ${emoji} MR: **[${mrTitle} - ${mrUrl
      .split('')
      .slice(mrUrl.length - 2, mrUrl.length)
      .join('')}](${mrUrl})** by ${author.name}`;
  }

  async notifyChannelForMR(
    author: Omit<UserSchema, 'created_at'>,
    projectName: string,
    mrTitle: string,
    mrUrl: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const channel = this.discord.mrChannel!;

    // Extract GitLab usernames from the reviewers array
    // const gitlabUsernames = reviewers.map((reviewer) => reviewer.username);
    const gitlabUsernames = [author.username] as string[];
    // Fetch the corresponding Discord IDs from the database
    const pings = await this.db.user.findMany({
      where: {
        gitlabUsername: {
          in: gitlabUsernames,
        },
      },
      select: {
        discordId: true,
      },
    });

    // Create a string with pings for each reviewer
    const pingMessage = pings.length
      ? pings.map((user) => `<@${user.discordId}>`).join(', ')
      : gitlabUsernames.join(', ');

    const emoji = ':checkered_flag: ';

    const messageText = `${pingMessage} MERGED!!! ${emoji} MR: **[${mrTitle} - ${mrUrl
      .split('')
      .slice(mrUrl.length - 2, mrUrl.length)
      .join('')}](${mrUrl})** created by ${author.name}`;

    // Send the message to the Discord channel
    channel.send({
      content: messageText,
      // embeds: [
      //   new MessageEmbed()
      //     .setTitle(`New merge request merged by ${author.username}`)
      //     .setColor('#409bd7')
      //     .setDescription(
      //       `A new merge request has been merged on repository **${projectName}**.\n\n**[${mrTitle} - ${mrUrl
      // .split('')
      // .slice(mrUrl.length - 2, mrUrl.length).join('')}](${mrUrl})**
      //       Reviewers: ${pingMessage}
      //       `,
      //     )
      //     .setThumbnail(
      //       'https://about.gitlab.com/images/press/logo/png/gitlab-icon-rgb.png',
      //     )
      //     .setTimestamp(),
      // ],
    });
  }
  async notifyAssigneesForMR(
    assignees: User[],
    reviewers: User[],
    author: Omit<UserSchema, 'created_at'>,
    projectName: string,
    mrTitle: string,
    mrUrl: string,
  ) {
    logger.log(JSON.stringify(assignees));
    logger.log(`Notifying watchers of author ${author.username}`);
    const gitlabUsername = author.username;
    const trackers = await this.db.tracker.findMany({
      where: {
        gitlabUsername,
      },
      include: { user: true },
    });
    // We don't want to specify one very specific case of assignee: The author of the MR assigns himself on it.
    // So we filter every tracker where the username in the tracker is the same as the one of the author, AND
    // the tracker is attached to a user who is the author
    const idsToNotify = trackers
      // .filter(
      //   (tracker) =>
      //     !(
      //       tracker.gitlabUsername === author.username &&
      //       tracker.user.gitlabUsername === author.username
      //     ),
      // )
      .map((tracker) => tracker.user.discordId);

    for (const id of idsToNotify) {
      logger.log(`Notifying ${id}`);
      const user = this.discord.users.cache.get(id);
      if (user) {
        logger.log(`Notifying user ${id} for mr ${mrTitle}`);
        user.send({
          content: await this.getMessage(id, author, mrTitle, mrUrl),
          // embeds: [
          //   new MessageEmbed()
          //     .setTitle(`Assigned on a merge request by ${author.username}`)
          //     .setColor('#409bd7')
          //     .setDescription(
          //       `A new merge request has been merged on repository **${projectName}**.\n\n**[${mrTitle} - ${mrUrl
          // .split('')
          // .slice(mrUrl.length - 2, mrUrl.length).join('')}](${mrUrl})**`,
          //     )
          //     .setThumbnail([assignees.map((a) => a.username), author.name].tlab.com/images/press/logo/png/gitlab-icon-rgb.png',
          //     )
          //     .setTimestamp(),
          // ],
        });
      } else {
        logger.warn(`User ${id} not in cache`);
      }
    }
  }

  async handleMrMergedWebhook(payload: MrMergedWebhookPayload) {
    const { object_attributes: mr, project, assignees, reviewers } = payload;

    const author = await this.gitlab.Users.show(mr.author_id);
    this.notifyChannelForMR(author, project.name, mr.title, mr.url);

    this.notifyAssigneesForMR(
      assignees,
      reviewers,
      author,
      project.name,
      mr.title,
      mr.url,
    );
  }
}
