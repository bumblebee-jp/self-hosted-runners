# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Fine-grained personal access token
- generate/rotate
- stored in `arn:aws:ssm:ap-northeast-1:479008436101:parameter/GitHub/PersonalAccessToken/SelfHostedRunners`
- This token has access to all repositories owned by the organization.
- Read access to metadata
- Read and Write access to workflows

## Repository Webhooks settings
- URL = https://y0n3kxqihk.execute-api.ap-northeast-1.amazonaws.com/prod/
- Content type = `application/json`
- `Workflow jobs` events trigger the webhook