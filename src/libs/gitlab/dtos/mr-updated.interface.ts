import {
  MergeRequest,
  Project,
  Repository,
  User,
} from 'app/libs/gitlab/dtos/common';

export interface MrUpdateWebhookPayload {
  object_kind: 'merge_request';
  event_type: 'merge_request';
  user: User;
  project: Project;
  object_attributes: MergeRequest;
  labels: any[];
  changes: {
    assignees?: { previous: User[]; current: User[] };
    reviewers?: { previous: User[]; current: User[] };
    title?: {
      previous: string;
      current: string;
    };
  };
  repository: Repository;
  assignees?: User[];
  reviewers?: User[];
}
