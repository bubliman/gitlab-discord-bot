import { UserSchema } from '@gitbeaker/core/dist/types/types';
import { Injectable } from '@nestjs/common';
import { GitlabClient } from 'app/libs/gitlab/client';
import { User } from 'app/libs/gitlab/dtos/common';
import { MrOpenedWebhookPayload } from 'app/libs/gitlab/dtos/mr-opened.interface';
import { logger } from 'app/libs/logger';
import { DatabaseClient } from 'app/modules/database/database.service';
import { DiscordService } from 'app/modules/discord/discord.service';
@Injectable()
export class MergeRequestOpenedService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly discord: DiscordService,
    private readonly gitlab: GitlabClient,
  ) {}

  async getMessage(
    id: string | undefined,
    assignee: User,
    reviewer: User,
    author: Omit<UserSchema, 'created_at'>,
    mrTitle: string,
    mrUrl: string,
    pings?: string,
  ) {
    // Fetch the corresponding Discord IDs from the database

    // Create a string with pings for each reviewer

    const idBackup = pings ?? assignee.username;
    const pingMessage = id ? `<@${id}>` : idBackup;

    const emojis = [
      ':innocent:',
      ':innocent:',
      ':innocent:',
      ':innocent:',
      ':innocent:',
      ':innocent:',
      ':face_holding_back_tears:',
      ':flushed:',
      ':sunglasses:',
      ':rolling_eyes:',
    ];

    // Review request
    if (reviewer.username === assignee.username) {
      return `${pingMessage} Review me please! ${
        emojis[Math.floor(Math.random() * emojis.length)]
      } MR: **[${mrTitle} - ${mrUrl
        .split('')
        .slice(mrUrl.length - 2, mrUrl.length)
        .join('')}](${mrUrl})** by ${author.name}`;
    }
    // Fix request
    if (author.username === assignee.username) {
      return `${pingMessage} Fix me please! ${
        emojis[Math.floor(Math.random() * emojis.length)]
      } MR: **[${mrTitle} - ${mrUrl
        .split('')
        .slice(mrUrl.length - 2, mrUrl.length)
        .join('')}](${mrUrl})** by ${author.name}`;
    }
    // Assigned request
    else {
      return `${pingMessage} Assigned to you ${
        emojis[Math.floor(Math.random() * emojis.length)]
      } MR: **[${mrTitle} - ${mrUrl
        .split('')
        .slice(mrUrl.length - 2, mrUrl.length)
        .join('')}](${mrUrl})** by ${author.name}`;
    }
  }

  async notifyChannelForMR(
    author: Omit<UserSchema, 'created_at'>,
    projectName: string,
    mrTitle: string,
    mrUrl: string,
    assignees: User[],
    reviewers: User[],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const channel = this.discord.mrChannel!;

    // Extract GitLab usernames from the reviewers array
    // const gitlabUsernames = reviewers.map((reviewer) => reviewer.username);
    const gitlabUsernames = assignees.map((a) => a.username);
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
      : assignees.map((a) => a.username).join(', ');

    const messageText = await this.getMessage(
      undefined,
      assignees[0],
      reviewers[0],
      author,
      mrTitle,
      mrUrl,
      pingMessage,
    );

    // Send the message to the Discord channel
    channel.send({
      content: messageText,
      // embeds: [
      //   new MessageEmbed()
      //     .setTitle(`New merge request opened by ${author.username}`)
      //     .setColor('#409bd7')
      //     .setDescription(
      //       `A new merge request has been opened on repository **${projectName}**.\n\n**[${mrTitle} - ${mrUrl
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
    for (const assignee of assignees) {
      for (const reviewer of reviewers) {
        logger.log(`Notifying watchers of assignee ${assignee.username}`);
        const gitlabUsername = assignee.username;
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
              content: await this.getMessage(
                id,
                assignee,
                reviewer,
                author,
                mrTitle,
                mrUrl,
              ),
              // embeds: [
              //   new MessageEmbed()
              //     .setTitle(`Assigned on a merge request by ${author.username}`)
              //     .setColor('#409bd7')
              //     .setDescription(
              //       `A new merge request has been opened on repository **${projectName}**.\n\n**[${mrTitle} - ${mrUrl
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
  }

  async handleMrOpenedWebhook(payload: MrOpenedWebhookPayload) {
    const { object_attributes: mr, project, assignees, reviewers } = payload;

    const author = await this.gitlab.Users.show(mr.author_id);
    const isDraft = mr.title.includes('Draft:');

    if (!isDraft) {
      this.notifyChannelForMR(
        author,
        project.name,
        mr.title,
        mr.url,
        assignees,
        reviewers,
      );

      if (assignees) {
        this.notifyAssigneesForMR(
          assignees,
          reviewers,
          author,
          project.name,
          mr.title,
          mr.url,
        );
      }
    } else {
      logger.warn(`Skipping merge request ${mr.id} because it is drafted`);
    }
  }
}
