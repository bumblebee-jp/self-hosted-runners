import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as api from 'aws-cdk-lib/aws-apigateway';
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";

export class GitHubWebhookStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, 'ghcr.io/actions/actions-runner', {
      repositoryName: 'ghcr.io/actions/actions-runner',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // ToDo: use CfnProject for ARM
    const project = new codebuild.Project(this, `SelfHostedRunnerCodeBuild`, {
      projectName: `GitHubSelfHostedRunners`,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'run.sh --jitconfig $ENCODED_JIT_CONFIG'
            ],
          },
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromEcrRepository(repository),
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
        environmentVariables: {
          ACCESS_TOKEN: {
            type: codebuild.BuildEnvironmentVariableType.PARAMETER_STORE,
            value: '/GitHub/PersonalAccessToken/SelfHostedRunners',
          },
        },
      },
    });

    const webhook = new nodejs.NodejsFunction(this, 'Webhook', {
      entry: 'lib/lambda/index.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(15),
    });

    // ToDo: least privilege
    webhook.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole', 'codebuild:*'],
        resources: [project.projectArn]
      })
    );

    // ToDo: least privilege
    const restApi = new api.LambdaRestApi(this, 'WebhookFunctionAPI', {
      handler: webhook,
      proxy: false,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'],
            conditions: {
              // cf. https://api.github.com/meta
              NotIpAddress: {
                'aws:SourceIp': [
                  '192.30.252.0/22',
                  '185.199.108.0/22',
                  '140.82.112.0/20',
                  '143.55.64.0/20',
                ],
              },
            },
          }),
        ],
      }),
    });
    restApi.root.addMethod('POST');
  }
}
