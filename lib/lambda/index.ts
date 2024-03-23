import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const body = JSON.parse(event.body ?? "{}");
    const workflowJob = body?.workflow_job ?? {};
    const repositoryName = body?.repository.full_name ?? "";
    const jobId = workflowJob?.id;
    const labels: string[] = workflowJob?.labels ?? [];
    const runId: string = workflowJob?.run_id ?? "undefined_run_id";

    // expect queued event
    if (body?.action !== "queued") {
        const message = `Skip because it is not a \`queued\` event: ${runId}`;
        console.log(message)
        return response_from(200, message)
    }

    // expect self-hosted label
    if (!labels.includes("self-hosted")) {
        const message = `Skip because it is not a \`self-hosted\` event: ${runId}`;
        console.log(message)
        return response_from(200, message)
    }

    // expect arm label
    // if (!labels.includes("arm")) {
    //     const message = `Skip because it is not a \`arm\` architecture: ${runId}`;
    //     console.log(message)
    //     return response_from(200, message)
    // }

    // ToDo: verify token
    // cf. https://qiita.com/bigmac/items/6e7decbfb734ba1551bd

    const jitconfig = await generateJitConfig(
      repositoryName,
      labels,
      jobId
    )

    try {
        return await runs_on_code_build(jitconfig)
    } catch (err: any) {
        console.error(err?.message);
        return response_from(500, `Failed to start: ${err?.message}`)
    }
};

import {CodeBuildClient, StartBuildCommand, StartBuildCommandInput} from "@aws-sdk/client-codebuild";
import * as https from "https";

const generateJitConfig = async (repositoryFullName: string, labels: string[], id: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const request = https.request({
              method: "POST",
              host: 'api.github.com',
              port: "443",
              headers: {
                  "Accept": "application/vnd.github+json",
                  "X-GitHub-Api-Version": "2022-11-28",
                  "Authorization": `Bearer ${process.env["GITHUB_TOKEN"]}`,
                  "User-Agent": "awslambda"
              },
              path: `/repos/${repositoryFullName}/actions/runners/generate-jitconfig`,
          }, (response) => {
              let data = '';

              response.on('data', (chunk) => {
                  data += chunk;
              });
              response.on('end', () => {
                  try {
                      resolve(JSON.parse(data));
                  } catch (err) {
                      let message
                      if (err instanceof Error) message = err.message
                      else message = String(err)
                      reject(new Error(message));
                  }
              });
          }
        );
        request.on('error', err => {
            reject(new Error(err.message));
        });
        request.write(JSON.stringify({
            "name": `CodeBuild-${id}`,
            "runner_group_id": 1,
            "labels": labels,
            "work_folder": "work"
        }));
        request.end();
    })
}

// CodeBuild で self-hosted runner を起動する
const runs_on_code_build = async (jitconfig: string) => {
    const client = new CodeBuildClient({ region: "ap-northeast-1" });
    const response = await client.send(new StartBuildCommand({
        projectName: 'GitHubSelfHostedRunners',
        environmentVariablesOverride: [
            {
                name: 'ENCODED_JIT_CONFIG',
                value: jitconfig,
                type: 'PLAINTEXT',
            },
        ],
    }));
    return response_from(200, `Started CodeBuild project: ${response.build?.id}`);
};

const response_from = (statusCode: number, message: string) => {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    };
}
