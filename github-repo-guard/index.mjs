import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import { Octokit } from '@octokit/core';
import retry from 'async-retry';
import HTTPError from './HTTPError.mjs';

export default async function (context, req) {
  try {
    const signature = getSignature(req);
    if (!verifySignature(req.body, process.env.GITHUB_WEBHOOK_SECRET, signature)) {
      throw new HTTPError('Invalid signature', 401);
    }

    const payload = req.body;
    if (payload.action !== 'created') {
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN is not set');
    }

    const mentionUser = process.env.MENTION_USER;
    if (!mentionUser) {
      throw new Error('MENTION_USER is not set');
    }

    const octokit = new Octokit({ auth: githubToken });
    
    const repository = payload.repository;

    if (process.env.ENABLE_PROTECTION_FOR_PRIVATE_REPOS !== 'true' && repository.private) {
      context.res = {
        status: 200,
        body: 'Repository is private, skipping'
      };
      return;
    }

    const repoDetails = {
      owner: repository.owner.login,
      repo: repository.name,
      branch: repository.default_branch
    };

    const branchProtectionOptions = buildBranchProtectionOptions();
    await retry(async () => {
      await enableBranchProtection(octokit, repoDetails, branchProtectionOptions);
    }, {
      retries: 3,
    });

    const issueBody = `@${mentionUser}

Branch protection has been enabled for the \`${repository.default_branch}\` branch.

_This is an automated message from the GitHub Repo Guard bot._`;

    const defaulTitle = 'Branch protection for {branch} enabled';
    const issueTitle = process.env.ISSUE_TITLE ? process.env.ISSUE_TITLE.replace('{branch}', repository.default_branch) : defaulTitle.replace('{branch}', repository.default_branch);
    const issueOptions = buildIssueOptions(issueTitle, issueBody);
    const issue = await createIssue(octokit, repoDetails, issueOptions);

    const closeIssueAfterCreation = process.env.CLOSE_ISSUE_AFTER_CREATION === 'false' ? false : true;
    if (closeIssueAfterCreation) {
      await closeIssue(octokit, repoDetails, issue.number);
    }

    context.res = {
      status: 200,
      body: 'OK'
    };
  } catch (err) {
    if (err instanceof HTTPError) {
      context.res = {
        status: err.statusCode,
        body: err.message
      };
      return;
    }

    context.log.error(err);
    context.res = {
      status: 500,
      body: 'Internal server error'
    };
  }
}

function getSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    throw new HTTPError('No signature found on request', 400);
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256') {
    throw new HTTPError(`Unsupported algorithm ${algorithm}`, 400);
  }

  return hash;
}

function verifySignature(body, githubWebhookSecret, signature) {
  const expectedHash = crypto.createHmac('sha256', githubWebhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');

  return signature === expectedHash;
}

function buildBranchProtectionOptions() {
  return {
    required_status_checks: null,
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      required_approving_review_count: 1
    },
    restrictions: null
  };
}

function enableBranchProtection(octokit, repoDetails, options) {
  const { owner, repo, branch } = repoDetails;
  return octokit.request('PUT /repos/{owner}/{repo}/branches/{branch}/protection', {
    owner,
    repo,
    branch,
    ...options
  });
}

function buildIssueOptions(title, body) {
  return {
    title,
    body
  };
}

async function createIssue(octokit, repoDetails, options) {
  const { owner, repo } = repoDetails;
  const response = await octokit.request('POST /repos/{owner}/{repo}/issues', {
    owner,
    repo,
    ...options
  });

  return response.data;
}

function closeIssue(octokit, repoDetails, issueNumber) {
  const { owner, repo } = repoDetails;
  return octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
    owner,
    repo,
    issue_number: issueNumber,
    state: 'closed'
  });
}