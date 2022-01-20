GitHub Repo Guard
=================

Description
-----------

This project implements a webhook as Azure Function to enable branch protection on the default branch (usually `main`) of a GitHub repository. After enabling an issue is being created to mention and notify a user of your choice.

Configuritation
--------------

The following options can or must be set in order to control how the repo guard works.

|Variable | Description | Required? | Default|
|---------|-------------|:---------:|--------|
| GITHUB_WEBHOOK_SECRET | The secret that is used to sign the payload of the webhook | ✅ | |
| GITHUB_TOKEN | The personal access token for the user that enables the branch protection and creates the issue | ✅ | |
| MENTION_USER | The username of the user that is being mentioned in the issue | ✅ | |
| ISSUE_TITLE | The title of the issue that is being created. `{branch}` will be replaced by the actual branch name | ❌ | `Branch protection for {branch} enabled` |
| CLOSE_ISSUE_AFTER_CREATION | Decides wether the issue is being closed after its creation | ❌ | `true` |
| ENABLE_PROTECTION_FOR_PRIVATE_REPOS | If set to `true` branch protection will be enabled even if the repo is private | ❌ | `false` |

> **Note**
> 
> If you use the a personal access token from a user that you also want to mention then the user won't get notified by default. In order to turn this feature on then you can do that by enabling `Include your own updates` in GitHub under **Settings -> Notifications -> Email notification preferences** for the specific account.

Development
-----------

### Set up dev environment

In case you want to develop and test this project locally you need the following dependencies to be installed:

- [Node.js v14](https://nodejs.org/en/download/)
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Function Core Tools >= v4.0](https://github.com/Azure/azure-functions-core-tools/releases)
- [ngrok](https://ngrok.com/download)

After installing the dependencies you can download npm packages with

```bash
$ npm install
```

Next you either need to create a file called `.env` in your root folder with at least all the required environment variables or put them into the [`local.settings.json`](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local#local-settings) file. The format of the `.env` file is as follows:

```
GITHUB_WEBHOOK_SECRET=<your-secret>
GITHUB_TOKEN=<your-personal-access-token>
MENTION_USER=<username-to-mention>
...
```

To create a personal access token you can follow this [documention](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

You can then start the development environment by executing the following command in the root folder:

```bash
$ func start
```

To make the function reachable from the internet you can use ngrok:

```sh
$ ngrok http 7071
```

This will create a tunnel via a ngrok subdomain that forwards all HTTP/S traffic to your local machine on port 7071 (your function runtime must be listening on that port).

On GitHub side you need to configure an organization webhook to receive repository events. You can do that on the GitHub portal via \<Your Organization\> -> Settings -> Webhooks -> Add Webhook

Enter the ngrok URL into the **Payload URL** field and append the path `/api/github-repo-guard`. The **Content type** should be `application/json`. Use a random string generator for the **Secret**. This secret needs to be set in your `.env` file as `GITHUB_WEBHOOK_SECRET`. Instead of listening for all events select only the `Repositories` events from the list of individual events. Be sure that the webhook is enabled and add it.

Your function should now be triggered whenever there is a new repository.

### Linting

You can lint the code with the following command. Note that this will also run `shellcheck` against any `.sh` script in the `util` folder.

```sh
$ npm run lint
```

### Adjust the branch protection config

Currently the applied branch protection is static and can't be changed via settings but rather by changing the code. This is something to be added sooner in case it's needed or to make this function more flexible.

In order to change these settings the `buildBranchProtectionOptions` function needs to be changed. You can find the available options [here](https://docs.github.com/en/rest/reference/branches#update-branch-protection).

Deployment
----------

Since this is an Azure Function you need to have an Azure account to deploy the code to a function app. In the `util` folder there is a script called `create-az-function.sh` that is a helper to create the function app, deploy the function and set the environment variables. In order to run it you need to install the following tools:

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Function Core Tools >= v4.0](https://github.com/Azure/azure-functions-core-tools/releases)

Adjust the variables in the head of the script to fit your environment and run the script with the following command:

```sh
$ . util/create-az-function.sh
```

In the output you should find the `Invoke url` that you can copy and paste into the **Payload URL** field in GitHub for the webhook. Use the same secret as you've chosen in the script itself.

TODO
----

- Adjust branch protection via config