import type {Agent} from './agents';
export function sampleResult(agent:Agent,prompt:string,skill:string){
 const intro='WORKFLOW SAMPLE — not AI-generated or researched results.';
 const steps:Record<string,string>={research:'1. Clarify the question and its scope.\n2. Retrieve primary sources and check their dates.\n3. Compare findings and attach source links.\n4. Flag anything that cannot be verified.',write:'1. Identify the audience, purpose, and format.\n2. Outline the supplied brief.\n3. Draft in the selected tone.\n4. Ask for review before publishing.',document:'1. Read the supplied text.\n2. Extract key points with supporting passages.\n3. List action items and open questions.\n4. Avoid claims beyond the document.',
 summarize:'1. Read the whole text.\n2. Write a one-line TL;DR.\n3. List the key points.\n4. Pull out action items with owners when stated.',
 translate:'1. Detect the source language and tone.\n2. Translate while keeping names and formatting.\n3. Flag phrases without a direct equivalent.',
 brainstorm:'1. Clarify the problem.\n2. Generate distinct ideas.\n3. Rank them by impact and effort.',
 code:'1. Read the code and its purpose.\n2. Explain the flow step by step.\n3. Note bugs and edge cases.',
 monitor:'1. Find the address in the task (or use your linked wallet).\n2. Read its balances at the latest block.\n3. Compare with the last check and list HARVEX transfers.\n4. Report what changed, never inventing a number.',
 whales:'1. Take the server\'s record of the HARVEX token.\n2. Look at the biggest transfers of the last 24 hours and the new holders.\n3. Set them against the biggest holders and the supply.\n4. Report what moved, never guessing an owner or a price.',
 chat:'1. Read the message and the conversation so far.\n2. Answer briefly in the agent\u2019s own voice.\n3. Ask back when something is unclear.',
 planner:'1. Break the goal into steps.\n2. Order them and estimate time.\n3. Flag risks and dependencies.'};
 return `${intro}\n\nYour task: ${prompt}\n\nAgent plan\n${steps[skill]||steps.research}\n\nConnect an AI service to execute this work. No web search or external action has been performed.`;
}
