#!/usr/bin/env node
import assert from "node:assert/strict";

const expected = ["exact packed Core", "starter lockfiles", "starter safety"];
const testSha = "a".repeat(40);

if (process.argv[2] === "--self-test") {
  assert.equal(state(run(expected.map(pass)), testSha), "success");
  assert.equal(state(run([...expected.map(pass), job("optional", "failure")], { conclusion: "failure" }), testSha), "success");
  assert.equal(state(run([pass(expected[0])], { status: "in_progress", conclusion: "" }), testSha), "missing");
  assert.equal(state(run([pass(expected[0])]), testSha), "failure");
  assert.equal(state(run([...expected.map(pass), job(expected[2], "", "in_progress")], { status: "in_progress", conclusion: "" }), testSha), "pending");
  assert.equal(state(run([job(expected[0], "failure")]), testSha), "failure");
  assert.equal(state(run([...expected.map(pass), job(expected[2], "cancelled")]), testSha), "failure");
  assert.equal(state(run([...expected.map(pass), job(expected[2], "skipped")]), testSha), "failure");
  assert.equal(state(run([...expected.map(pass), job(expected[0], "", "in_progress")], { status: "in_progress", conclusion: "" }), testSha), "pending");
  assert.equal(state(run(expected.map(pass), { event: "push" }), testSha), "failure");
  assert.equal(state(run(expected.map(pass), { workflowName: "optional" }), testSha), "failure");
  assert.equal(state(run(expected.map(pass), { headSha: "b".repeat(40) }), testSha), "failure");
  console.log("release check state self-test passed");
  process.exit(0);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
console.log(state(JSON.parse(input || "{}"), process.argv[2]));

function state(workflowRun, headSha) {
  if (
    workflowRun.headSha !== headSha
    || workflowRun.workflowName !== "validate"
    || workflowRun.event !== "pull_request"
    || !Array.isArray(workflowRun.jobs)
  ) return "failure";

  const required = expected.map((name) => workflowRun.jobs.filter((item) => item.name === name));
  if (required.some((matches) => matches.some((item) => item.status === "completed" && item.conclusion !== "success"))) {
    return "failure";
  }
  if (required.some((matches) => matches.length === 0)) {
    return workflowRun.status === "completed" ? "failure" : "missing";
  }
  if (required.every((matches) => matches.every((item) => item.status === "completed" && item.conclusion === "success"))) {
    return "success";
  }
  return workflowRun.status === "completed" ? "failure" : "pending";
}

function run(jobs, overrides = {}) {
  return {
    headSha: testSha,
    workflowName: "validate",
    event: "pull_request",
    status: "completed",
    conclusion: "success",
    jobs,
    ...overrides,
  };
}

function pass(name) {
  return job(name, "success");
}

function job(name, conclusion, status = "completed") {
  return { name, status, conclusion };
}
