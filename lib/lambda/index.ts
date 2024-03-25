import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const body = JSON.parse(event.body ?? "{}");
    const workflowJob = body?.workflow_job ?? {};
    const repo = body?.repository.name ?? "";
    const owner = body?.repository.owner.login ?? "";
    const labels: string[] = workflowJob?.labels ?? [];
    const runId: string = workflowJob?.run_id ?? "undefined_run_id";
    console.log(workflowJob)

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
    if (!labels.includes("arm")) {
        const message = `Skip because it is not a \`arm\` architecture: ${runId}`;
        console.log(message)
        return response_from(200, message)
    }

    // ToDo: verify token
    // cf. https://qiita.com/bigmac/items/6e7decbfb734ba1551bd

    try {
        const jitConfig = await generateJitConfig(
          owner,
          repo,
          labels,
          runId
        )
        return await runs_on_code_build(jitConfig)
    } catch (err: any) {
        console.error(err?.message);
        return response_from(500, `Failed to start: ${err?.message}`)
    }
};

import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { Octokit } from "@octokit/core";

const generateJitConfig = async (owner: string, repo: string, labels: string[], runId: string): Promise<string> => {
    const auth = process.env.GITHUB_TOKEN ?? ''
    if (!auth) {
        new Error("GITHUB_TOKEN is not provided.")
    }

    const octokit = new Octokit({ auth })
    const response = await octokit.request(`POST /repos/${owner}/${repo}/actions/runners/generate-jitconfig`, {
        owner: owner,
        repo: repo,
        name: `${runId}`,
        runner_group_id: 1,
        labels: labels,
        work_folder: '_work',
        headers: {
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
    return response.data.encoded_jit_config
}

// CodeBuild で self-hosted runner を起動する
const runs_on_code_build = async (jitConfig: string) => {
    const client = new CodeBuildClient({ region: "ap-northeast-1" });
    const response = await client.send(new StartBuildCommand({
        projectName: 'GitHubSelfHostedRunners',
        environmentVariablesOverride: [
            {
                name: 'ENCODED_JIT_CONFIG',
                value: jitConfig,
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
