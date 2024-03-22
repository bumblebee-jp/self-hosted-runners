import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";

export const handler = async (
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
    const body = JSON.parse(event.body ?? "{}");
    const workflowJob = body?.workflow_job ?? {};
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
    if (!labels.includes("arm")) {
        const message = `Skip because it is not a \`arm\` architecture: ${runId}`;
        console.log(message)
        return response_from(200, message)
    }

    // ToDo: verify token
    // cf. https://qiita.com/bigmac/items/6e7decbfb734ba1551bd

    const htmlUrl = body?.repository.html_url ?? "";
    try {
        return await runs_on_code_build(htmlUrl, labels)
    } catch (err: any) {
        console.error(err?.message);
        return response_from(500, `Failed to start: ${err?.message}`)
    }
};

import {CodeBuildClient, StartBuildCommand, StartBuildCommandInput} from "@aws-sdk/client-codebuild";

// CodeBuildでself-hosted runnersを開始する
const runs_on_code_build = async (htmlUrl: string, labels: string[]) => {
    const client = new CodeBuildClient({ region: "ap-northeast-1" });
    const buildParams: StartBuildCommandInput = {
        projectName: 'GitHubSelfHostedRunners',
        environmentVariablesOverride: [
            {
                name: 'REPO_URL',
                value: htmlUrl,
                type: 'PLAINTEXT',
            },
            {
                name: 'LABELS',
                value: labels.join(','),
                type: 'PLAINTEXT',
            },
            {
                name: 'EPHEMERAL',
                value: '1',
                type: 'PLAINTEXT',
            },
        ],
    };

    const response = await client.send(new StartBuildCommand(buildParams));
    return response_from(200, `Started CodeBuild project: ${response.build?.id}`);
};

const response_from = (statusCode: number, message: string) => {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    };
}
