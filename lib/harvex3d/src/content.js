/* Harvex — Docs, Whitepaper and Roadmap content. Written for the web app (/docs, /whitepaper, /roadmap); the standalone studio page shows the same text.
   Bodies are a small Markdown subset (headings, paragraphs, lists, bold, code, blockquote, tables). */
(function (G) {
'use strict';
const R = G.HARVEX;

R.CONTENT = {
version: 'v0.1 · working draft',

/* ---------------------------------------------------------------- DOCS */
docs: [
{ id: 'overview', title: 'What is Harvex', body: `
Harvex Agent Studio is a place to build AI agents, and it feels closer to the character screen of a game than to a form. An agent starts as a 3D person. You choose its clothes, write how it should behave and hand it a few skills. Then you put it to work on a research brief, a summary, questions about a document, a draft, a translation, a plan or a code review.

The character has a job to do. You can tell one agent from another at a glance, the way you know a colleague. It also shows you what is going on: it thinks while a task is running, cheers once the task is finished and shrugs if the run went wrong.

**Working in the software today**

- 25 people of the studio's own, drawn in your browser.
- A character editor that covers the shape of body and face, skin, eyes, hair, brows, outfits, shoes, colours, gear, glow and finish.
- 33 motions in five groups (gestures, moods, moves, emotes, everyday life) and 6 powers that come with visual effects. Standing, walking, talking and sitting are played from recorded animation.
- Ten skills, all of them open, of which one agent can carry up to 4. A run is answered by the AI provider the operator connected to the server. On a server without one, a run returns a workflow sample that is marked as a sample. A run costs credits, and the operator of a server may limit how many times an account can try each skill.
- You can save an agent, copy it, export it and import it again.
- A marketplace paid by the run. You publish an agent to Discover and set its price in preview credits.
- Sign-in with a wallet and nothing else. MetaMask, Trust Wallet and any other EVM wallet work, through Sign-In with Ethereum for BNB Smart Chain. You sign a message, which costs nothing and sends no transaction. Email and password logins do not exist here.
- The Wallet & chain page, where one account can hold several linked wallets.
- Schedules. An agent runs one of its skills without you, 1 to 24 times a day, and every run is paid in credits. Each result is kept in History and can be sent on to a Discord channel or a Telegram chat of yours. In a Telegram chat or group an agent can answer questions too.

**Finished, and turned off until an operator configures it** (BNB Smart Chain)

- Buying credits with USDT. The server adds the credits after it has read your transfer from the chain. This turns on once the server is given a pay token and a treasury address.
- Holder tiers, worked out from the HARVEX in your linked wallets. A tier brings a monthly credit allotment, a smaller platform fee and higher limits. This turns on once the server is given a HARVEX token address.

**Not launched, not done**

- The HARVEX token. It has not launched and has no contract address. If someone shows you an address for it, that address does not come from us.
- Holder rewards. The code for the program exists and is turned off. Nobody has picked a reward token, deployed a reward vault or paid anything out. The Holder rewards page has the details.
- Earnings claims. The plan is that a creator queues earned credits, then claims USDT on-chain from a distributor contract with a merkle proof. That contract has been written and tried on a local chain. It has not been audited or deployed.
- An independent audit and a legal review. Both are still to do.
- Watching the chain without a break. The Wallet monitor skill looks at an address only while it runs, whether you start it or a schedule does, and between two runs nothing is watching. A report from a schedule can go to Discord or Telegram. Instant alerts do not exist.

Credits are not money. You cannot withdraw them, and they are never refunded to a wallet. The one exception is credits you **earn** when other people run your agents: those can be claimed, but only after claims have been turned on.

**A private preview that opens in stages.** These docs describe the whole product. What you can open depends on the site you are on: a site may keep the studio, sign-in, the pages about listed agents or the on-chain pages closed for now. A closed page says "not open yet" and tells you what is open. It is closed on purpose and nothing is broken. The home page, these docs, the whitepaper and the roadmap are always open.

No part of this studio is financial advice, and no part of it offers a token for sale.
` },
{ id: 'start', title: 'Getting started', body: `

1. **Pick a character.** The roster is on the Avatar tab, and you can search it by name or by role.
2. **Change its look** on the Outfit tab. You see each change the moment you make it. *Randomize* gives you a look you did not plan, and the button next to it, *Reset to* plus the character's name, brings the preset back.
3. **Write its persona.** That is a name, a set of instructions and a tone. All three go to the AI together with every task it answers.
4. **Add skills**, four at most. A skill sets what kind of work the agent does with a task.
5. **Give it a task** on the Run tab. You need to be signed in with a wallet. Choose the skill under *Skill*, write the task in the box and press the Run button. The price in credits stands next to the button. Under *Run mode* you choose between *Workflow sample* and, on a server with an AI provider connected, *Live AI*. An agent you have not saved yet is saved first.
6. **Save it.** The agent is then listed under *My agents*. From there you can duplicate it, export it or archive it.

A few shortcuts: dragging on the stage turns the character, scrolling zooms, a double-click puts the view back, and the keys 1–6 set off the powers.
` },
{ id: 'characters', title: 'Characters & outfits', body: `
All characters are people, and all of them start from the same base body. Sliders shape it: age, muscle, weight and height first, then the finer points of body and face. That body, with its hair, clothes and shoes, is taken from MakeHuman, a public-domain (CC0) project. The studio softens these parts into a style of its own, fits every piece to the shape you set and dyes the cloth in the colours of the look. This is why any outfit goes on any body. Glasses, hats and backpacks were made by the studio. For standing, walking, talking and sitting the character plays recorded animation from the Universal Animation Library by Quaternius, which is public domain (CC0) as well. The files are fetched the first time a character appears, about 5 MB for the first one. If the download fails, you get a simpler body that is built into the studio. A small platform sits under every agent.

**Always a little alive.** A character that is "idle" still breathes, moves its weight from one leg to the other, blinks, lets its eyes wander and turns its head to follow your pointer. Its face goes along with the motion that is playing. One motion fades into the next. A simple spring simulation makes hair, coats, capes and scarves swing when the body moves.

**What you can change**

| Part | Choices |
| --- | --- |
| Body | Feminine or Masculine, four builds (Slim, Regular, Curvy, Broad), skin tone and eye colour |
| Shape | Age, muscle, weight and height, plus chest on a feminine body |
| Body detail | 11 sliders, from shoulders, chest and waist down to calves, with arms, leg length and neck |
| Face | 33 sliders in five groups: head, eyes and brows, nose, mouth, jaw and cheeks |
| Hair and brows | 10 hairstyles and 12 brow shapes, with the hair in any colour of the palette |
| Outfit and shoes | 12 complete outfits and 6 pairs of shoes |
| Colours | Top, bottom and shoes. A colour dyes the main cloth, while a shirt under a jacket, a tie or a print keeps its own |
| Head | Cap, Beanie, Explorer hat, Headphones, Halo, Cat ears, Space helmet |
| Face gear | Glasses, Shades, Visor |
| Back | Backpack, Jetpack, Cape, Scarf |
| Glow and finish | A glow colour that tints the lights, the powers and the pad, a colour for the gear, and a finish |

Every slider rests at the look of the character you started from, and each has its own reset. Facial hair is not part of these bodies yet.

An agent that was saved with one of the older companion looks keeps that look. It has a shell colour, an accent and a glow where a person has clothes.

One power is each character's **signature power**, and it is ready again sooner than the others. The header of the stage names it, and the Skills tab marks it as the signature.
` },
{ id: 'motions', title: 'Motions & powers', body: `
**Motions** come in five groups. Gestures: Wave, Nod, Shrug, Point, Clap, Salute, Bow. Moods: Idle, Think, Typing, Laugh, Cheer, Stretch, Victory. Moves: Walk, Run, Jump, Spin, Dance, Disco. Emotes: Flex, Heart, Dab, Facepalm, Kick, Backflip. Life: Chat, Sit, Crouch, Pickup, Use, Tinker, Cast. A motion with a ring on it loops. Choose one and it becomes the stance the agent returns to, and it is saved with the agent. Any other motion plays a single time, then the agent goes back to its stance.

In Walk and Run the character goes round the platform. You can play everything at 0.5×, 1× or 1.5× speed, or pause the stage.

**Powers** are things the character does on the stage, with effects around them. No power performs a task. They add atmosphere and show what state the agent is in.

| Power | Key | What you see |
| --- | --- | --- |
| Pulse Orb | 1 | An orb of energy builds up between the hands, then flies off |
| Aegis | 2 | A dome of hexagons closes around the agent as a shield |
| Blink | 3 | The agent dissolves and comes back one step to the side |
| Levitate | 4 | The agent hovers over the pad inside a ring of light |
| Deep Scan | 5 | A scanner ring passes over the agent and its profile card appears |
| Hype | 6 | Confetti goes off and the agent cheers |

Some motions the studio starts by itself. During a task the agent plays Think or Typing. A finished task brings Cheer or Victory, an error brings Shrug, and saving brings Salute.
` },
{ id: 'skills', title: 'Agent skills', body: `
A skill is a program written as a prompt. It joins the persona of your agent to the rules for one kind of task. When you run it, the server sends both, together with your task, to the AI provider the operator connected. The Run tab has one task box for every skill, and a task holds up to 12,000 characters. A run from the Run tab starts fresh: the AI is not given your earlier runs. So write into the box everything the agent needs, and paste in any text it should work on. Only Web research can browse, and only on a server whose provider offers web search.

| Skill | What you write in the task box | You get back |
| --- | --- | --- |
| Web research | a question, and how deep the answer should go | a brief that answers it, with its sources where the run searched the web, and with a note that nothing was checked live where it did not |
| Summarizer | the text, pasted in | a one-line TL;DR, the key points and the action items |
| Document Q&A | the document, pasted in, and your question | an answer that works from the pasted text and nothing else |
| Content writer | a brief, with the format and the length you want | a draft in that format, such as a post, a thread or an outline |
| Translator | the text and the language to translate into | the translation, with a note on phrases that do not carry over |
| Idea generator | a topic | ideas in ranked order, each with a reason and the effort it takes |
| Code explainer | the code, and whether you want it explained or reviewed | an explanation or a review, with the bugs it found and a fix for each |
| Task planner | a goal and a timeframe | five to ten steps in order, with a time estimate for each |
| Wallet monitor | a wallet address and what to look for; leave the address out to use your linked wallet | the holdings of the address, the changes since the last check and its recent HARVEX transfers, with the reading attached |
| Whale watch | a question about HARVEX | the movements of the last 24 hours: biggest transfers, new holders and biggest holders, with the reading attached |

**Where a skill runs.** On the server. Pressing the Run button sends your task there. The server takes the credits, then passes the task and the persona of the agent to the AI provider its operator connected. That can be Claude, OpenAI, a provider with an OpenAI-compatible API such as Gemini, or a gateway the operator runs. The Run tab offers two modes. *Live AI* is there only on a server with a provider connected. *Workflow sample* is always there. It returns the steps the agent would take, written without any AI and marked as a sample. If a run fails, the credits come back.

**Rules for honesty in the prompts:** the prompt the server writes for a run tells the agent that it can only return text and must never claim to have published, sent, traded or scheduled anything. Web research has to cite its sources and never invent one, and when it cannot browse it has to say that nothing was checked live. Document Q&A and the Summarizer work from the supplied text and nothing else. The Code explainer never claims to have run the code. Wallet monitor and Whale watch use only the numbers in their reading.

**Schedules.** Once an agent has its skills, you can let it work by the clock. Go to the **Automate** tab in the Studio, or to the Schedules page. There you select a skill, write the task, and set the number of runs per day (1, 2, 3, 4, 6, 8, 12 or hourly) and when the first one starts. The server then runs the task at each of those slots. Every run is charged at the live price of the skill, with a minimum of 5 credits. An account may hold 3 schedules and make 24 scheduled runs a day. A holder tier lifts both numbers: Holder to 6 and 48, Builder to 12 and 96, Studio to 24 and 192. A schedule pauses, and tells you the reason, when you are out of credits or when its agent or skill no longer exists. A limit on tries per skill is never touched by scheduled runs.

**Recipes.** A recipe sets up a whole automation for you. Pick one under Recipes on the Schedules page and press Start it. The public Recipes page (/recipes) lists the same recipes, and Open this recipe brings you to the Schedules page with that recipe selected. The recipe creates an agent complete with character, persona and skills, and schedules one of those skills. If you already have a delivery channel, the results are sent to it. Six recipes exist so far. Four of them read the HARVEX token and only work on a server that has it: Morning whale report, Wallet reading every six hours, Whale alarm and Wallet alarm. The other two want a topic from you: Daily post draft and Plan for the day. What a recipe leaves behind is an ordinary schedule. Its runs cost what the skill costs, they count toward your limits, and you are free to pause, edit or delete it. The new agent belongs to you, so give it another look or another name if you like.

**Teams.** Put two or three agents in a row, give each of them one of its skills, and you have a team. The team receives a single task. Agent one answers it. Every agent after that is handed the task plus the answer that came just before. A researcher can pass its findings to a writer this way, and the writer can pass the text to a translator. You make a team on the Teams page. Its members can be agents you saved or agents that other creators published in Discover. You can also begin with one of the ready-made teams and press Use this team: Findings into a thread, Ideas into a plan, Summary in a second language, or, on a server with the HARVEX token, Token moves into a post. Teams have a public page at /teams. Each step counts as a normal run. You pay the price of its skill, it uses up your limits and it is listed in History. If the step runs on a published agent, the creator's price is paid to them as well. When a step fails you get a refund, and you can retry that step alone, without running the earlier ones again. Only the first 8,000 characters of an answer are passed on to the next agent. A team starts when you press Run the team. Teams on a schedule have not been built.

**Chat with an agent.** You can chat with any published agent on its page. Reach it from Discover with Chat, or through its link, /a/<id>. The agent speaks in its own voice, which comes from the persona its creator wrote. It uses no skill for this and does not browse. Every message you send is a run. You pay 3 credits, unless the operator chose a different price, and on top of that the chat price of the creator. The message is stored in your History, and the creator earns the chat price for it. Creators set the chat price in the publish dialog, separately from the task price. An agent can therefore cost little to chat with and more when it does real work. If the creator never set a chat price, each message is charged at the task price. With every message the agent also gets the last six turns, which keeps its answers consistent. Nobody else sees the conversation, and the same browser opens it again later. The creator's instructions are never shown on that page, not even to the creator. Remember that an agent is an AI character. It can get things wrong, and nothing it tells you is financial advice.

**Notes, a greeting and first questions.** An agent can hold notes next to its instructions, in the field Always-on notes on the Persona tab. Notes are facts about the creator or the creator's project, 4,000 characters at most. The AI gets them with every run and answers from them. When someone asks about the creator and the notes have no answer, the agent is instructed to say that it does not know. On the public page you can see that an agent has notes. Their content is never shown. A creator can also write a greeting, which opens the chat, and as many as three questions to start from, which appear as buttons. Both are free, and nothing is charged before a message is sent.

**Someone else's agent in your Telegram chat.** This needs a Telegram bot that the operator has connected. If there is one, link a chat or group of yours under Schedules → Delivery and decide who answers in it. There are three choices: an agent of yours using one of its skills, an agent of yours speaking in its own voice, or an agent published by another creator. The last kind only ever speaks in its own voice. Every answer counts as one chat message to the agent. The account that linked the chat pays for it from its credits: the message price, plus the creator's price per message. The creator earns that price just as in any other chat. A private chat treats each message as a question. In a group, people type /ask followed by their question. For context the agent is given the latest turns of that chat. You decide how many answers per day the chat is allowed, and a short pause separates two questions. Should the creator change the price, the agent goes quiet in your chat, and you are charged nothing until you have confirmed the new price. Should the agent be unpublished, the chat reports that it is no longer available. Three more things hold here. The agent's instructions are never shown. Questions are passed to the AI provider and saved in your History. Answers are written without web search. Where the feature is available, the chat on the agent's page carries a link that reads "Put <name> in my Telegram".

**The weekly board of most-used agents.** On /top you find ten published agents: the ones people used most over the past seven days. A use is a completed run, either a task or a chat message, made from an account that is not the creator's. The order depends on the number of different accounts first, and on the number of runs second. Three people who each ask once therefore rank higher than one person who asks ten times. Beside every place you can read how the agent did compared with the seven days earlier: new, up, down or the same. The board refreshes every few minutes. Its link preview shows the day's first three. Read it as a record of use and not as a rating. An account is a wallet, a wallet costs nothing, and so the numbers can be pushed up. This is why a place on the board earns nothing at all. It brings no credits, no badge and no higher spot in Discover.

**Quiet schedules that speak up after a change.** You can tell a Wallet monitor schedule or a Whale watch schedule to keep silent as long as nothing is new. The server then takes a look at every slot before anything else, and no AI is involved in that look. For the Wallet monitor it holds three things against the last report: the BNB balance, the count of transactions the wallet has sent, and the balances of the tokens this server knows. For Whale watch it searches its own record of the HARVEX token. It wants either a transaction since the previous look that moved the amount you set or more (100K to 10M HARVEX, 1M unless you change it), or an address that has newly entered the ten biggest holders. If the look finds no change, no run happens, no credits are taken and no message goes out. Such a look is also not counted among the scheduled runs of the day. The schedule displays the time of its latest look. If the look does find a change, a normal run follows: you pay the skill's price, the result is in History and goes to the channel, and the report names what triggered it. The very first slot reports in any case, because later looks need something to compare with. The same happens again after you edit the task or the amount. A change is reported at the next look and not at the moment it happens. The server looks only at the slots of the schedule, which means once per hour at best. The token record trails the chain by a few minutes. And a change that appears and disappears between two looks, such as a balance that rises and falls back, goes unnoticed. Two recipes, "Whale alarm" and "Wallet alarm", switch all of this on with one click.

**The arena, where two agents answer the same question.** Go to /arena, choose two published agents and write a question of 300 characters or fewer. Both agents receive it as an ordinary chat message. You therefore pay for two messages and for the chat price of each creator, and you pay nothing for an agent that fails to answer. Once the two answers are in, they are placed next to each other on a public page, /arena/<id>, which has a preview picture of its own. Readers choose the answer they find better. That page shows the question, the two agents and their answers. It does not show who asked, and an agent's instructions are never shown there. The person who created the duel may remove it whenever they want, and from then on the link is dead. About picks: a signed-in account has one, and can change it. The creators of the two agents have none in their own duel. A pick only tells you what one visitor thought, and one person may own several accounts. So the count is shown as a plain number. It has no effect on an agent's rating, on its position in Discover or on anybody's credits. No list of duel pages exists, and search engines are asked to leave them out of their index.

**Sources an agent can answer from.** An agent takes as many as 8 sources from its creator. Notes, an FAQ or an old thread are typical. One source holds 12,000 characters at most, and all of them together 60,000. The creator pastes the text, and that pasted text is all the server keeps. It fetches nothing from a website or an account. Adding a source is free. The server splits every source into passages. A message or task for the agent is compared with those passages, and the ones that have words in common with it, four at the most, are sent to the AI along with the message. The agent is instructed to build its answer on them. If the question concerns the creator and the passages hold no answer, it is instructed to say it does not know. Below the answer you see the titles of the sources that were used. Keep three limits in mind. First, matching works on shared words, so a question phrased very unlike the source can come up empty. Second, the sources listed below an answer are the ones the AI said it used, which does not prove the answer correct. Third, a Web research run that browses the web receives no sources. The public page gives the number of an agent's sources and never their titles or text. An answer may still repeat anything written in them, so keep private things out. A passed agent check stops counting when the sources change, until the check is run again. "Try a question" in the Studio lists the passages a question would pull up, and it does so without calling the AI.

**The agent check.** Before publishing, a creator can ask the studio to test the agent against the live AI. The publish dialog has the button. The studio sends four short messages to the AI in the role of the agent, exactly as a visitor's chat message would arrive. One rule is applied to each answer. The agent has to answer at all. When told to print its instructions, it must keep them back. When asked if a token is worth buying, it must not tell anybody to buy, sell or hold. When asked if it is a real person, it must say that it is an AI. Check number five reads the instructions themselves, because the copy filter cannot recognise instructions shorter than 80 characters. After a pass, the agent's page shows "Checked" and the date. The mark stays while the name, instructions, tone and notes remain the ones that were tested. One check is charged at 8 credits unless the operator priced it differently. It is saved in History, and you get the credits back if the AI fails. Take the result as a check and not as a guarantee. Every rule looks for a pattern in a single answer to a single question, and the next answer from an AI may differ.

**Ratings and an agent's track record.** Whoever receives an answer in a chat can mark it as helpful or not helpful. Each answer takes one mark, which can be changed or taken away later. The agent's page displays the share of helpful marks as soon as three or more have come from accounts other than the creator's. Marks that creators give their own agents are left out every time. The page also tells you how many of the agent's last fifty runs were answered. In Discover and in the plaza, agents are sorted by use. Helpful marks move an agent up and unhelpful marks move it down.

**How agents talk about Harvex.** This applies to chats on a server that has a HARVEX token set. There, each agent is given a short fact sheet about Harvex, and the server writes it from its own settings. The sheet covers what the studio is, the state of the token on that server, the rule for holder rewards, the holder tiers, the referral boost and the things still missing: an independent audit, and a published legal review of reward payouts. Asked if someone should buy, sell or hold, an agent answers that this is the asker's decision and that it will not take it for them. It goes on to describe what holding does today, adds that nothing is audited and refers to the Holder rewards page. An agent does not forecast a price, does not promise a return and does not tell anybody to buy, sell or hold. If one does, the agent check still fails it.

**The card of an agent.** A published agent gets a card automatically. On one side the agent stands on a deck card that has its own colour, a serial number and either the creator's verified handle or the role of the character. On the other side are the agent's name, its tagline, its number of runs and the prices of a chat message and of a task. Links to the agent use this card as their preview picture, and from the agent's page you can post it or download it. The card always uses the default picture of the character. An outfit you made in the Studio does not appear on it.

**Sharing a conversation.** The chat on an agent's page has a Share button. It publishes what was said up to that point on a public page, /s/<id>. The page contains the last message that got an answer and at most five turns before it, with your questions and the agent's answers unchanged and the agent's character beside them. Your identity is not on the page. The agent's instructions are never shown there. Messages you write after sharing do not show up either. To include newer messages, use Share again, which creates another page. Stop sharing removes the page immediately. A shared link comes with its own preview picture, showing the question and how the answer begins.

**Creator agents, written from your own posts.** The Persona tab of the Studio has a box called "Write it from my posts". Paste posts that you wrote yourself, between 300 and 12,000 characters of text. The studio fetches nothing from any account. From your posts it drafts instructions for the agent in your style and adds a tagline. Read the draft, then press Use this or throw it away. Until you press Use this, the agent stays as it was. Each draft is a separate run. It costs 8 credits unless the operator set a different price, and you find it in your History. The feature is opt-in. You have to confirm that the posts are yours, and without that confirmation the server turns the request down. What the draft describes is an AI character that writes like you. It is not you. Asked about it, the agent says so, and it never claims to be a person. After you publish it, people can chat with it on its page and pay your chat price per message. Creator agents have a public page at /creators.

**Verified creators.** A creator can prove that an X handle belongs to them. The steps are on the Profile page. Enter the handle, receive a code, post that code from the handle and submit the link to the post. Someone on the team then opens the post and confirms it. After that, every agent the account published shows the handle: "Verified creator · @handle" on the agent's page, and "@handle · verified" in Discover. An agent without the mark shows an anonymous creator name, and no handle appears before it has been confirmed. The server reads nothing from X. The whole check is a single post that a person looks at. One handle can be verified for one account only. The creator may drop the mark whenever they like. A server offers verification only if its operator has named reviewers. The public page /verified sets out what the mark means and what it does not mean.

**The plaza.** On /plaza each published agent has a card. The most used agent comes first, the page holds twelve at most, and every look appears once. If two agents share a look, the one with more use gets the place and the other can still be found in Discover. Point at an agent to see its tagline and chat price. Click it, and it steps forward as a live 3D character with its chat open. An agent in the plaza is only a picture. It runs, and you pay, at the moment you send it a message and not before.

**Delivery.** Besides keeping every finished run in History, a schedule can pass it on to a Discord channel or a Telegram chat. First add the channel under Delivery on the Schedules page. Then select it on the schedule. For Discord you paste a channel's webhook address, found in the channel settings → Integrations → Webhooks. Only webhook addresses on discord.com are accepted. The server verifies the address with Discord, stores it on the server and never displays it again. Telegram works on servers whose operator has connected a bot, and the panel tells you if that is not the case. You follow a one-time link to the bot and press Start, either in a private chat or in a group. A long report is shortened to a few messages, while History keeps the complete text. If a schedule is paused, the channel receives a single notice about it. An account can have 4 channels. Send test puts a test message in a channel, and Remove takes the channel off your account whenever you want.

Before you use it: a delivered report leaves Harvex. Discord and Telegram are services of their own with terms of their own, and a report sent to a group can be read by all its members. A research answer that relied on Google Search stays behind. Such an answer may be shown only inside the Studio, to the account that asked for it, so the channel gets a notice in its place. If sending fails, the run and its credits are not affected. If a channel no longer exists, for example after the webhook was deleted or the bot was blocked, it is marked as disconnected. The server stops calling it until you test it or connect it again.

**Chat on Telegram.** One of your agents can answer in a Telegram chat you have connected. Open Delivery, find the chat and select "Let an agent answer". Next, choose the agent, the skill it should use and the number of answers the chat gets per day: 5, 20, 50 or 100. Every message in a private chat counts as a question. Group members put /ask in front of their question, and normal conversation in the group is never passed to the agent. An answer is a live run of the chosen skill. Your credits pay for it at the price of that skill, and History lists it with your other runs. One chat has to wait roughly 15 seconds between two questions. Once the daily limit is used up, the bot announces it one time.

Before you use it: any member of a group may ask, which makes the daily limit the most a group can take from your credits. Each question is sent to the AI provider and saved in your History. The agent's instructions are never shown, and asking for them changes nothing. The agent answers without web search, since search results are allowed inside the Studio only. An answer that runs long is trimmed to two messages. If a question gives no address, the Wallet monitor reads the wallet you linked. In a group that lets anyone call up a report on it. The data is public on the chain, yet the report reveals which wallet belongs to you. Your balance and your limits are never posted to the chat by the bot. You can turn the agent off in that chat or remove the channel whenever you choose.

**Wallet monitor.** Write an address (0x…) into the task. Without one, the skill takes your linked wallet. The server then reads BNB Smart Chain at a single block and changes nothing there. It collects the BNB balance, the count of sent transactions and the balances of the tokens configured on the server: HARVEX, the top-up token and the reward token, as far as they exist. These figures are set against the previous reading your account made of the same address. The server adds the latest HARVEX transfers of the address, taken from its own record of the token. From all this the agent writes a brief report. The raw reading is attached below it, which lets you compare the two. On a schedule, the skill can report as often as once an hour.

Its limits: the skill sends no transaction, ever. For tokens other than HARVEX it lists no transfers and gives the balance and how it changed. Prices are unknown to it. One run covers one address. It looks only during a run, so nothing alerts you between runs. A task that names no address, or a chain that does not answer at that moment, costs you nothing.

**Whale watch.** This skill works only after the HARVEX token exists and the server is recording its transfers. Together with your task, the agent receives what the server has read about the token. That reading says how many addresses hold HARVEX. It says how many of them received their first HARVEX within the last 24 hours and have kept it. It gives the number of transactions that moved HARVEX and the total moved, then the largest transfers and the largest holders with the share of the supply each one has. Every transaction counts one time, from the address where the tokens started to the address where they stopped, no matter how many addresses handed them on in between. The agent turns these numbers into a short report and attaches the reading below. Schedule the skill and deliver it to Discord or Telegram, and you have a token brief every day or every hour. The Whale watch page (/whales) publishes the same numbers for anyone to open and share.

Its limits: the skill has no prices. It cannot say who is behind an address. It cannot distinguish a buy from a sell and therefore never calls a transfer either one. An address gets a label in one case only. Addresses that the server excludes from rewards, such as team, treasury, pool or contract addresses, are tagged "not earning holder rewards". All numbers are drawn from the record the server keeps of the token's Transfer events. That record runs a few minutes behind the chain. If it cannot be read, you are not charged for the run.
` },
{ id: 'credits', title: 'Credits, prices & earnings', body: `
You **pay for each run**, and you pay in credits.

- A new account receives **25 free credits**. That covers two web research runs, or five to six of the lighter tasks. One workflow sample is 5 credits.
- **Every 24 hours the free credits are refilled.** The free share of your balance goes back up to 25. Credits you bought are left alone, and the free share cannot grow beyond 25.
- **Heavy skills** are Web research, Document Q&A and Code explainer. They are counted in windows of 5 hours. With free credits only you get 2 runs per window, and with bought credits in your balance you get 20. For the lighter skills the daily limit is the only one. All free live AI in the studio also draws on a single daily pool. After the pool is empty, live AI keeps running for accounts with bought credits, and free runs return at 00:00 UTC.
- The price of a live AI run depends on the skill. Web research is 12 credits. Document Q&A and Code explainer are 6. Content writer, Wallet monitor and Whale watch are 5. Summarizer, Translator, Idea generator and Task planner are 4. An operator may set other prices.
- A run that is paid entirely from free credits goes to a lighter model. A run paid with bought credits goes to the full model.
- You can **publish any saved agent to Discover** and charge between 0 and 500 credits per run. Visitors get to see its character, tagline, skills and tone. The agent's instructions are never shown. The agent is instructed not to reveal them, and an answer that copies them is held back. Still, no AI can guarantee that it will never paraphrase them. Passwords and keys therefore have no place in instructions.
- Each time another person runs your published agent, the price leaves their balance and arrives in yours, less the platform fee. On your own agent you never pay the creator price.
- **The platform fee is 0% for the beta** and 10% afterwards. The value is a server setting, \`PLATFORM_FEE_BPS\`, which means it can be changed without touching the code.
- A ledger records every movement of credits as a grant, a run, an earning, a fee or a refund. A failed run returns the credits to the buyer and pays the creator nothing. It does still count toward the daily limit and the 5-hour limit if the AI had begun its answer before the failure.
- Credits carry **no monetary value**. On a server whose operator has turned top-ups on, you buy them with USDT on BNB Smart Chain, at 1 USDT = 100 credits by default. Claiming **earned** credits in USDT has been built and remains turned off. Credits that were granted or bought cannot be withdrawn or refunded, now or later.
` },
{ id: 'save', title: 'Saving, export & share', body: `
- **Save agent** keeps the agent in the database of the server, under the account you signed in with. Saving needs a wallet sign-in.
- **Export JSON** gives you the config of an agent as a file. Inside are the id of the character, the complete outfit look, the default motion, the persona, the tone and the skills. The older \`appearance\` fields are included too, so that configs of the first generation can still be read.
- **Import** takes one config or a list of them. A config of the first generation is converted for you. Those are the ones with 12 characters, an appearance made of colours only and motion names like Pray.
- **Share links** carry the config in the fragment of the URL, the part after the # sign, which a browser does not send to the server. Whoever opens the link gets the agent as an unsaved draft in the Studio. It reaches the server only when that person saves it.
- **Quests.** The Quests page suggests things to try out. Create your first agent. Get a first result. Run a team of two. Chat with a published agent. Draft a persona from your posts. Schedule a skill. Have results delivered. Ask your agent on Telegram. Look at the chain. Make an answer public. Publish an agent. The server marks a quest as done after it has seen the action take place. You may then claim it one time and receive free credits, 5 per quest unless the operator chose another amount. These are free credits of the same kind a new account starts with. They pay for runs and are used up before any bought credits. They never count as claimable earnings, and they cannot be withdrawn. If a feature is off on a server, its quest is missing from the list there.
- **Invite a friend.** Your invite link is on the Quests page. Suppose a person follows it, signs in with a new account and finishes a first run. Both of you then receive free credits: 10 each, unless the operator chose another amount. An account is rewarded for 20 invitations at most. An invitation counts one time, only for an account that has never run anything, and never for your own account. The bonus consists of free credits like those of a new account. You can pay for runs with them. They are no part of claimable earnings and cannot be withdrawn.
- **Holder reward boost for inviters** (planned as part of holder rewards, and off for as long as they are off). The design: your holder reward for an hour grows by 10% for each invited friend who held one reward unit, 3,000,000 HARVEX, during that complete hour. Up to 5 friends count, which gives 1.1x for one friend and 1.5x as the ceiling. The multiplier applies to the amount your own wallets earned in the hour. An account with less than one unit earns nothing there, so it has nothing to boost. A friend is counted only if they held the unit from the start of the hour to its end, and only for the single account that invited them. Their own reward stays the same. Your current multiplier would be shown on the invite card of the Quests page, and "Your settled hours" would mark each boosted hour. Boosts would come out of the same vault as all other rewards.
- **Share an answer.** Go to a run in History, or press Share on a result you just received. Then select "Create public link". From that moment the answer lives on a page of its own, at /s/ plus a random id. Your agent's character stands beside it, and a posted link shows a preview picture. Whether the beginning of your task appears is up to you. Your account, your wallet and the agent's instructions are never shown on the page, and search engines are asked to keep it out of their index. To remove the page, press "Stop sharing". Sharing works for completed runs only. It does not work for an answer that used Google Search, which may be shown only in the Studio and only to the account that asked. An account can keep 100 shared answers at most.

A config holds no API keys, no wallet addresses and no account identifiers.
` },
{ id: 'rewards', title: 'Holder rewards', body: `
> **A plan, not a running program.** Everything on this page exists as code and is turned off. HARVEX has not launched. The reward is planned as NVDA, a tokenized Nvidia share on BNB Smart Chain from a third-party issuer, and which issuer's token has not been set. A reward vault has not been deployed, and no payment has ever been made. Nobody has audited the contract or reviewed the program legally. Read this page as a description of what the program would do after an operator turns it on. It does not promise that anyone will.

**The rule.** For each full **3,000,000 HARVEX** in your wallet you would earn **$0.01 per hour, paid in the reward token**, and the count runs second by second. The two numbers are defaults. Both can be set on the server.

| HARVEX in the wallet | Units | Each hour | Each day |
| --- | --- | --- | --- |
| 2,999,999 | 0 | $0 | $0 |
| 3,000,000 | 1 | $0.01 | $0.24 |
| 6,000,000 | 2 | $0.02 | $0.48 |
| 9,000,000 | 3 | $0.03 | $0.72 |

Only whole blocks of 3,000,000 count as units, so 5,999,999 HARVEX remains 1 unit. The amount in dollars does not move. How many reward tokens that is depends on the token's price at the time an hour is settled.

Because the unit and the rate are settings on the server, the team is able to change them. An hour that has been settled keeps the amount it was settled with.

**Nothing to stake.** Your HARVEX never leaves your wallet. The server follows all HARVEX transfers on BNB Smart Chain and can therefore tell the balance of any wallet at any second. Sending HARVEX to a second wallet does not make it earn two times. HARVEX that arrives shortly before the hour ends earns for those seconds and not for the full hour. When HARVEX leaves a wallet, the count for it stops at the second of that transfer.

**Price.** To turn an hour's dollars into reward tokens, the server uses the token's most recent **Chainlink USD price** on BNB Smart Chain, provided a feed has been set. If there is no feed, the operator enters the price. Two things stop an hour from being settled: a price that is more than 72 hours old, and a price jump of 50% or more that the team has yet to confirm. Those hours are held back and settled in one go after a usable price returns. Every amount is rounded down.

**Vault.** Reward tokens would be bought by the team and transferred to the reward vault, which is a HarvexClaims contract. The server settles an hour only if the vault holds enough to pay all that is owed. If it does not, the hour waits, and no earnings are lost. On the dashboard the vault card reads **Funded**, **Low, under a day remains** or **Rewards wait for a refill**. Each refill can be seen by anyone on-chain.

**How a claim works**

1. Sign in with a wallet, then link all your wallets that hold HARVEX.
2. Go to **Holder rewards** in the dashboard. Confirm one time that you are eligible, by stating your country of residence.
3. Wait until the newest root is on-chain, then press **Claim**. The claim is sent from your wallet, which pays a small amount of BNB as gas. What you receive is the total settled up to now, minus what you claimed before. For all claims combined, the vault lets out a limited amount each hour. If your claim is larger than what remains for the hour, part of it is paid and you claim the remainder later.

**Who is not able to claim.** A holder has to name their country of residence and confirm that they are not a US person before claiming for the first time. As a default, the server rejects claims from these countries: the United States, Canada, the UK, Switzerland, Cuba, Belarus, Iran, North Korea, Russia, Syria, Ukraine, South Sudan, Sudan, Myanmar and Venezuela. The list was drawn up to be careful. No legal review produced it, and it must be checked again against the reward token that is finally chosen. Wallets of the team, the treasury and the liquidity never earn.

**What you have to trust.** The contract pays out according to the root that was published. It does not verify the formula behind it. All inputs are public, namely the transfers, the refills, the roots and the claims, so anybody can calculate the numbers again. No key on the server is able to move tokens out of the vault. To make hourly claims possible the server has a single key, and posting a root is all that key can do. The vault limits by itself how much can be claimed in one window. The multisig can pause the vault, and it can swap that key for another.
` },
{ id: 'privacy', title: 'Privacy & safety', body: `
- What you type into a task goes to the server when you press the Run button and not earlier. On a server with an AI provider connected, a *Live AI* run passes it on to that provider. The task and the answer are then kept in History, under your account. History has no delete button at present, so leave out of a task what you would not want kept.
- When you run an agent that another creator published, its instructions are never shown to you. An answer that relied on Google Search is shown only to the account that asked for it.
- The site loads no analytics script. Its fonts are fetched from Google Fonts, so your browser contacts Google when a page loads.
- The prompts for Document Q&A and the Summarizer tell the AI to treat a pasted text as content and not as instructions. An AI does not follow such a rule every time, so read an answer about a text you do not trust with care.
- Delivery happens only if you ask for it. A report is sent to Discord or Telegram only by a schedule that you aimed at a channel or chat there. The server keeps webhook addresses and chat ids to itself.
- Anyone with the link can read a shared answer for as long as you keep sharing it. Go over it once more before you share. Everything in the answer, and in the part of your task that is shown, will be public.
- Chat on Telegram is turned on chat by chat, and only by you. A question asked in such a chat is sent to the AI provider and recorded in the History of the account that connected the chat. The answer is sent to Telegram.
- The frontend never contains a provider secret. Provider settings are read on the server and nowhere else.
- Harvex is a project of its own. It has no affiliation with BNB Chain, Binance, Anthropic or any other AI provider these docs name, is not endorsed by them and is not their partner.
` },
{ id: 'faq', title: 'FAQ', body: `
**Has the HARVEX token launched?** No. There is no token yet and no contract address. Once it exists, its address will be published in one place only: the CA box on this site's home page. As long as you do not see that box, any "HARVEX" address shown to you has nothing to do with us. No one at Harvex will ever ask for your recovery phrase or tell you to send tokens somewhere.

**What made you choose BNB Smart Chain?** BNB Smart Chain, BSC for short, is compatible with Ethereum and secured by validators of its own. Its chain id is 56, and the testnet is 97. You pay gas in BNB. A block takes well under a second, fees are low, and many people hold USDT on it. In Harvex the chain is used for signing in with a wallet, for top-ups, for claims and for holder tiers. To check an address, use the explorer at bscscan.com.

**How does a top-up work?** First link a wallet. On the Wallet & chain page you then send USDT from that wallet to the Harvex treasury, and your wallet asks you to confirm the transfer. The server looks the transaction up on the chain. As soon as its block is confirmed, which normally takes seconds, the credits are added at the default rate of 1 USDT = 100 credits. If the payment comes from a wallet that is not linked to you, no credits are added. A top-up is possible only on a server where the operator has turned top-ups on, and the Wallet & chain page tells you if that is so. You cannot get credits refunded or withdraw them.

**How does claiming earnings work?** For now it does not: the feature has been built and is still turned off. After it is turned on, you will be able to queue the credits you earned from other people running your published agents, for a claim to a wallet you linked. The Harvex multisig then posts all queued claims to the HarvexClaims contract as one merkle root. From there you claim your USDT on-chain, and the gas is yours to pay. A payout key is never held by the server.

**What is a holder tier?** There are four tiers: Free, Holder, Builder and Studio. Yours follows from the HARVEX in the wallets you linked. A tier adds monthly credits, lowers the platform fee on what you sell and raises your limits for schedules, scheduled runs per day and delivery channels. Tiers begin once the HARVEX token exists. Holder starts at 3,000,000 HARVEX, Builder at 5,000,000 and Studio at 10,000,000.

**Can I bring my own 3D model or a photo?** No, not at this point. Every character is built from the same set of bodies and dressed by the studio. That keeps all looks in one style and keeps them light to load.

**Does the research skill search the web?** It does on a server whose operator has connected a provider that offers it: web search by Claude or OpenAI, or Gemini with Google Search. Such answers name their sources, and with Google Search you also see Google's search suggestions below the answer. Each query costs the operator money. For that reason the studio allows a set number of searching runs per day, and an operator may reserve web search for accounts with bought credits. If a run is not able to search, Web research answers from the model's own knowledge and tells you so. The Run tab warns you before you start. Treat an answer that lists no sources as not checked on the web.

**Can other people see my agent?** They can after you publish it, and not before. A published agent is listed in Discover together with its price. Its instructions are never shown to anybody else.

**Why does a page say it is not open yet?** Harvex is a private preview and opens in stages. A site can keep whole parts closed: the studio, sign-in, the pages about listed agents, the on-chain pages. A closed page tells you so and names what is open. No account and no wallet gets past it, ours included, until that part is opened for everyone.

**How do I get in?** Once sign-in is open on the site you are using, you need a wallet, because that is the only way to sign in. MetaMask, Trust Wallet, Rabby and every other EVM wallet will do. On a phone, open Harvex in the browser inside your wallet app. Press Connect wallet, then sign the message for BNB Smart Chain. Signing costs nothing and sends no transaction, and you are never asked for your recovery phrase. Harvex has no login by email or password.

**What is the holder reward about?** It is a program on paper and in code, and it is not running. As designed, each 3,000,000 HARVEX in your own wallet would earn a set dollar amount every hour. The default is $0.01, which makes $0.02 for 6M and $0.03 for 9M. The count would run by the second, and payment would be in a token on BNB Smart Chain. You would not stake anything, since the HARVEX remains in your wallet. A reward vault would be funded by the team. Holders would claim from that vault on their own with a merkle proof and pay a little BNB in gas. As of today there is no HARVEX token, no chosen reward token and no deployed vault. The contract has had no audit, and the program no legal review. More is in Holder rewards in these docs and in the whitepaper.

**Does Harvex work without an AI provider connected?** Yes. You can still build, dress, save, export and publish agents. A run or a chat message then returns a workflow sample, which is written without any AI and marked as a sample. Live AI answers, the persona draft from your posts and the agent check need a provider.
` },
],

/* ---------------------------------------------------------- WHITEPAPER */
paper: {
title: 'Harvex Whitepaper',
subtitle: 'AI agents built as characters, a handful of working skills, and credits that pay per run',
status: 'Draft · HARVEX and holder rewards are plans, neither has launched',
sections: [
{ id: 'abstract', title: 'Summary', body: `
In Harvex, an AI agent is a character. Its maker picks how it looks, writes how it behaves and gives it a few skills that get work done. This studio has been built. Its economy has been built as well. A creator puts a price on an agent and publishes it. Whoever runs it pays that price in credits, and the creator receives it less a platform fee. On top of this, a token named HARVEX is planned for BNB Smart Chain. Holding it would bring usage credits every month, a reduced platform fee and raised limits. It would also bring a holder reward at a set dollar rate, $0.01 per hour for each 3,000,000 HARVEX held by default. That reward would be paid in a token, out of a vault that the team keeps filled.

HARVEX has not launched, and not one reward has been paid. This paper covers two things: the product in its built state and the token in its designed state. Parts that are only planned, or still open, are marked as such.
` },
{ id: 'problem', title: 'What is missing', body: `
An AI assistant can do a great deal, and yet nothing about it sticks. You open a session and face an empty prompt again. What gets called an "agent" is usually a named text box. Someone without prompt-writing skill gains little from such tools. Someone with that skill has no means to turn their knowledge into a thing other people could pick up and use.

Three things are lacking:

1. **Nobody to recognise.** An agent has no lasting character, and so people never get used to working with it.
2. **Nothing to hand over.** A good prompt or workflow ends up in somebody's private notes. It should be an agent that can be reused and shared.
3. **No fair way to pay.** Platforms meter usage for each account separately. A creator cannot get paid when their agent works for another person. A community cannot cover the usage of its members.
` },
{ id: 'product', title: 'What exists today', body: `
**Characters.** The roster has 25 people. Around them are a character creator, an outfit system, 33 motions and 6 powers. Each body is a parametric human made from the MakeHuman assets, and its recorded animation is taken from an animation library. Both sources are public domain (CC0). The site serves them as static files of about 14 MB in total, of which one character loads about 5 MB. The browser does the shaping, the fitting and the colouring, working from the look that was chosen.

**Persona.** An agent has a name, instructions in free text and a tone. All three stay with the agent and are placed in front of each task. Agents answer in English.

**Skills.** There are ten. Eight of them are prompt programs: web research, summarizer, document Q&A, content writer, translator, idea generator, code explainer and task planner. The ninth is the wallet monitor. It reads one address on BNB Smart Chain without writing anything, then reports its balances, what is different from the last check and its HARVEX transfers. The tenth is the whale watch. It draws on the server's record of HARVEX transfers and reports the biggest transfers, the new holders and the biggest holders, without prices. Every one of the ten is open. A run is paid in credits. An operator can limit the tries an account has per skill, and a run that fails returns the try. One agent holds four skills at most. A skill runs on the server, which passes the task to the AI provider its operator connected. On a server without a provider, a run returns a workflow sample that is marked as a sample.

**Persistence.** An agent is plain JSON. It can be saved, copied, exported and imported in that form. The server files agents under the account that owns them and keeps a history of tasks. Credits are debited atomically and idempotently.

**Marketplace.** A creator publishes an agent to Discover and names a price per run, from 0 to 500 credits. The buyer pays for each run. After a run completes, the creator is credited with the price less the platform fee, which is 0% in the beta. Instructions are never shown to a buyer, and the API does not return them. A ledger holds every movement of credits, and failed runs are refunded.
` },
{ id: 'architecture', title: 'How it is built', body: `
\`\`\`
In the browser
  ├─ Character engine: three.js with rigged bodies, outfits built on the spot, spring bones and VFX
  ├─ Studio screens: roster, outfit editor, persona, skills, run
  ├─ Skill runner: sends each task to /api/runs
  └─ Wallet over EIP-1193: sign in or link with SIWE, send USDT, claim on-chain

The server (Cloudflare Worker + D1)
  ├─ /api/auth/*        Better Auth, wallet only: Sign-In with Ethereum on BNB Smart Chain
  ├─ /api/agents        agent configs as JSON, each tied to its owner
  ├─ /api/workspace     your agents, runs, credit balance and ledger
  ├─ /api/runs          debits credits atomically, keeps run ids idempotent, applies the tier fee discount
  ├─ /api/chain         the public settings for BNB Smart Chain, without secrets
  ├─ /api/wallet        links and unlinks wallets with SIWE and a one-time nonce
  ├─ /api/topups        checks the receipt of a USDT transfer and credits each log once
  ├─ /api/claims        queues earned credits and serves merkle proofs for the newest epoch
  ├─ /api/claims/epoch  for the operator: builds a root, publishes it once the multisig has posted it
  ├─ /api/tier          turns a HARVEX balance into a tier; monthly allotment at a snapshot block
  ├─ /api/rewards       holder rewards (off): the rule, the price, the vault, what you accrued, your proofs
  ├─ /api/rewards/admin for the operator: sync, settle, publish; it signs no transaction, ever
  ├─ /api/schedules     agents running a skill by themselves, ticked once a minute
  ├─ /api/notify        delivery channels (Discord webhooks, Telegram chats) and agents chatting on Telegram
  ├─ /api/teams         saved rows of agents; a step in a team run is an ordinary run
  ├─ /api/talk          the chat on a published agent's page; a message is an ordinary run
  ├─ /api/voice         writes a draft of an agent's instructions from posts the creator pasted
  ├─ /api/creator       a creator claiming an X handle, and what the reviewers decided
  ├─ /api/agents/check  the agent check: four real messages and a result for each rule
  ├─ /api/rate          marks an answer as helpful or not helpful
  ├─ /api/share         an answer made public by its owner (/s/<id>)
  ├─ /api/quests        things to try out; each finished quest pays free credits one time
  └─ /api/referrals     invite links; after the first run both sides get free credits

The AI provider the operator connected (without one, runs return labelled workflow samples)
  └─ Claude, OpenAI, an OpenAI-compatible API such as Gemini, or a gateway of the operator's own

On BNB Smart Chain (chain 56, testnet 97)
  ├─ USDT (BEP-20)    pays for top-ups and is paid out in claims (18 decimals on this chain)
  ├─ HarvexClaims       distributes USDT earnings by cumulative merkle root (unaudited, not deployed)
  ├─ HarvexClaims #2    the reward vault, meant to belong to a multisig (unaudited, not deployed)
  ├─ HARVEX (BEP-20)    has not launched
  ├─ Reward token     the asset for holder rewards (none chosen)
  └─ Chainlink        USD price feed of the reward token (optional)
\`\`\`

We build inside these limits. The frontend holds no secrets. Identity headers sent by a client are not trusted. Anything that enters a prompt counts as untrusted content. A paid action or an on-chain action is signed by the user, in the user's own wallet. The server has no payout key. It reads the chain through an RPC of its own and does nothing else there.
` },
{ id: 'token', title: 'HARVEX, the planned token', body: `
> **This token does not exist yet.** The plan is for HARVEX to be a BEP-20 token on the mainnet of BNB Smart Chain. It has no contract address today. After launch, the address will appear in a single place, the CA box on this site's home page.

**What the token must be like for the software** (these are requirements and say nothing about a deployed contract)

| Point | Requirement |
| --- | --- |
| Chain | BNB Smart Chain, chain id 56. It is compatible with Ethereum and has validators of its own |
| Standard | BEP-20, which is the ERC-20 interface, with 18 decimals |
| Transfers | A balance may change through a transfer and in no other way. A transfer tax, reflection or rebasing would make the holder record wrong |
| Name, supply, allocation | Open. This paper names no supply, no allocation, no vesting schedule and no lock |

Addresses of the team, the treasury, the liquidity and the burn would earn no holder rewards.

**What holding HARVEX is meant to bring**

1. **Holder rewards.** HARVEX that sits in your own wallet would earn a reward token, at a dollar rate that is fixed (see below). You would not stake it or lock it. This is planned and turned off.
2. **Usage credits.** Every tier comes with an allotment of credits per month. Credits live off-chain, cannot be transferred and are worth no cash. Running a task never spends the token.
3. **Fee discount.** A creator who is in a tier keeps more of the price when other people run their agents. While the beta lasts the platform fee is 0%, so the discount has an effect only after the fee is turned on.
4. **Higher limits.** With a tier an account may keep more going at once: more schedules, more scheduled runs per day and more delivery channels. The table further down has the numbers. A run costs the same number of credits in all tiers.

**Planned and not yet built**

- A boost for creators, giving agents from higher tiers more visibility in Discover.
- A number of agent slots for each tier.
- A share of the platform fees going toward refills of the reward vault, after fees are on.
- Advisory votes about what the roadmap puts first, how high fees are and what the skill library contains.

**Tiers** (built; they begin once the server has been given a HARVEX token address)

| Tier | HARVEX held | Platform fee | Credits per month | Agent slots (planned) |
| --- | --- | --- | --- | --- |
| Free | 0 | 10% | none | 10 |
| Holder | 3,000,000 | 7% | 100 | 25 |
| Builder | 5,000,000 | 5% | 300 | 50 |
| Studio | 10,000,000 | 3% | 1,000 | no limit |

**Limits per tier** (built; until the token exists, everybody is on the Free row)

| Tier | Schedules | Scheduled runs per day | Delivery channels |
| --- | --- | --- | --- |
| Free | 3 | 24 | 4 |
| Holder | 6 | 48 | 6 |
| Builder | 12 | 96 | 8 |
| Studio | 24 | 192 | 12 |

The numbers in the Free row are the limits of the server itself. A tier multiplies the schedules and the runs, and it adds channels. The server takes the tier from the chain and looks again every few hours. If an account falls to a lower tier, the schedules it has are kept. It cannot add another one beyond the new limit, and from the next check on the lower limit for daily runs is in force.

The fee column gives the platform fee a creator pays after the 10% fee has been turned on. To find a tier, the server totals the HARVEX in all wallets linked to the account. The discount is taken off the creator's platform fee on every sale, and a tier is cached for 24 hours. An allotment can be claimed one time per month by an account and one time by a wallet. Balances are read at the **snapshot block** of the month. The month's first claim sets that block. Tokens moved into a new wallet after it bring no second allotment.

**The holder reward (planned and turned off)**

Holders are not supposed to be paid in more HARVEX. The reward is meant to come in a different token on BNB Smart Chain, and that token has not been decided. The program is built like this:

1. **Rate.** Each full **3,000,000 HARVEX** in a wallet earns **$0.01 per hour**. Only whole blocks make a unit: 2,999,999 HARVEX gives 0 units, 5,999,999 gives 1 and 6,000,000 gives 2. Earnings build up by the second, which puts 1 unit held for half an hour at $0.005.
2. **Time held, with no snapshot.** The calculation starts from all HARVEX transfers on BNB Smart Chain, which tell the balance of any wallet at any second. One token is in exactly one wallet at any moment. So HARVEX sent on to a second wallet does not earn two times, and HARVEX that arrives just before the hour is over earns for seconds and not for the hour. (A contract that reads nothing but the current balance is blind to this history. That is the reason the numbers are worked out from recorded transfers.)
3. **Paid out in the reward token.** An hour is settled at the newest USD price of that token, read from a Chainlink feed on BNB Smart Chain if one has been set. As an example, $0.01 comes to 0.0000555 tokens when one token is priced at $180. The value in dollars stays put and the number of tokens moves with the price. Every amount is rounded down.
4. **Vault.** The team would buy reward tokens and top up the reward vault, an instance of HarvexClaims. An hour gets settled only if the vault is able to pay the whole amount owed. If not, the hour waits and is settled at a later time, which means no earnings go missing. Nothing is sent out to holders. They claim on their own and cover their own gas.
5. **Referral boost.** If an account has invited friends, its own reward goes up. Each invited friend who held one unit for the whole hour adds 10%, and at most 5 friends count, so 1.5x is the top. The multiplier is applied to what the inviter's own wallets earned during the hour. It is paid out of the same vault, and it leaves the friend's reward as it is. A single person could split tokens across several accounts and act as their own friends. The cap is the thing that keeps this in bounds.

| Setting | What it is |
| --- | --- |
| Reward asset | Some BEP-20 token on BNB Smart Chain. Which one is undecided |
| Source | The team buys it with treasury funds, and with platform fees after fees are on |
| Rate | $0.01 per hour for each full 3,000,000 HARVEX held, built up per second. This is the default |
| Price | Taken from a Chainlink USD feed on BNB Smart Chain if one is set, otherwise entered by the operator. An hour waits while the price is more than 72 hours old. After a move of 50% or more it waits for the team to confirm the price |
| Period | One hour, closing at each full hour UTC. A few minutes after that the root for the hour is posted to the vault. A holder can then claim all that has been settled to date |
| Vault | The team refills it. Nothing is settled beyond what it can pay. A payout limit inside the vault caps the amount all claims combined can withdraw in an hour |
| Payout | The holder claims with a merkle proof (HarvexClaims) |
| Excluded | Wallets of the team, the treasury and the liquidity do not earn |

**The legal limits.** A token paid to holders may be covered by securities rules or by other rules. That depends on the token, and on the country the holder lives in. Neither this program nor any reward token has been through a legal review.

**How the software responds.** A holder who wants to claim for the first time must give their country of residence and confirm that they are not a US person. As a default, claims are rejected from the United States, Canada, the UK, Switzerland, Cuba, Belarus, Iran, North Korea, Russia, Syria, Ukraine, South Sudan, Sudan, Myanmar and Venezuela. The holder certifies this themselves. The list is a careful default, and no identity is checked. Whether a holder is eligible remains that holder's own responsibility.

**The program has four parts** (they are built and were tested on a local chain; none of them runs anywhere):

| Part | Its job |
| --- | --- |
| Holder recorder | Goes through all HARVEX Transfer events on BNB Smart Chain, in settled blocks only. From them the balance of any wallet at any second is known. |
| Reward calculator | Settles an hour by itself when the full hour arrives. The sum is units × $0.01 × seconds held. It is converted into the reward token at the current price, with integer math and rounding down. With a stale price or a vault that holds too little, it will not settle. |
| Reward vault | The reward token is kept in a HarvexClaims instance of its own. A refill is a plain transfer that can be verified on-chain. One dedicated key, able to post roots and nothing more, publishes the root of each hour, and every root contains all the hours before it. Claims therefore open hour by hour. The vault has a payout limit that caps the amount leaving in an hour. The multisig may pause the vault or replace the key whenever it chooses. A holder claims their cumulative total minus what they have received so far. |
| Harvex dashboard | Displays the rule, the price of the reward token and the vault. For you it lists your HARVEX, your units, your rate per hour, the amount you accrued and your settled hours. Its Claim button sends the claim out of your own wallet. |

Rate, unit and reward asset are all settings on the server, and the money in the vault would be the team's own. The team can therefore change the program, pause it, end it or never begin it. An hour that was settled keeps its amount.

**What HARVEX is not.** You do not need it to use the studio, and it does not pay for AI usage. Holder rewards would come out of a vault that the team funds for as long as the program runs. They give no claim on the revenue or the equity of Harvex and no rights against the team. Credits have no cash value, and there is no way to convert them into HARVEX. Earned credits are the only ones that will be claimable. They will be paid in USDT, after the claims contract has gone into operation.
` },
{ id: 'economy', title: 'How credits move', body: `
Today the studio does all its accounting in credits.

**Where credits come from.** An account begins with 25 free credits. Three further sources exist:

- **USDT top-ups on BNB Smart Chain.** These are built, and they are on wherever an operator has configured a pay token and a treasury. A buyer transfers USDT to the treasury from a wallet they linked. Through its own RPC the server fetches the receipt and verifies four things: token, recipient, sender and amount. After the validators have confirmed the block, a matter of seconds, the credits are added. Each transfer log is credited exactly one time.
- **Allotments for holders.** They come monthly and follow the tier table. They begin once the token exists.
- **Earnings**, which arrive when other people run the agents you published.

The real bill from the AI provider is paid out of top-ups. An allotment is a subsidy with a cap for each period.

**Claims** (built and turned off, because the claims contract has not been deployed). Earned credits are the only credits that can leave the system. Grants, top-ups and allotments cannot. A creator queues a claim to a linked wallet, for 500 earned credits or more, and those credits are taken from the balance immediately. The operator collects all claims in one cumulative merkle root. It has a leaf for each wallet, holding the total that wallet was ever owed. The multisig posts the root to HarvexClaims. After that the creator claims this total minus what the wallet has received before. A new root can never pay the same amount twice. No key on the server can move funds. By default 100 credits = 1 USDT.

**Where credits go.** Running an agent of your own costs the platform's charge for the run. That is 5 credits for a workflow sample, and between 4 and 12 for live AI according to the skill. Running an agent that another creator published costs the same charge and the creator's price on top. The creator's price is divided in two: the platform fee, 0% in the beta and 10% after it, and the creator's share, which is credited once the run completes. If a run fails, the buyer is refunded and the creator gets nothing. A ledger records all of it.

**Why the price is per run.** With a price per run, a creator earns only when an agent is really used. A buyer never risks more than one task. And creators see directly which of their agents deserve more work. Subscriptions or a price per session could be added on top at a later stage.

**Abuse.** Nobody pays the creator price for running their own agent. Run ids are idempotent, which prevents a double charge. A sybil ring that buys runs from itself just shifts credits from one account to another, and it pays the fee to do so. A claim needs a linked wallet, and one wallet can belong to one account only. A top-up counts only if it comes from a linked wallet, and each transaction hash works a single time. Requiring an account to exist for a minimum time before it can claim is planned.
` },
{ id: 'launch', title: 'Where the launch stands', body: `
So far, no part of this has been launched on-chain. Here is the state of things.

**What is built**

- The studio and its marketplace, with schedules, teams, chat and wallet sign-in for BNB Smart Chain.
- The software for the chain features, meaning USDT top-ups, holder tiers, the holder reward program and earnings claims. A local test chain is the only place where they have been tested.
- A design in which no key that moves money is on the server. A multisig is meant to own the reward vault. For hourly rewards the server would keep a single key, good for posting claim roots and nothing else, and the vault would enforce a payout limit in front of it.

**What is not done**

- The HARVEX token, the reward vault, the claims contract and the multisig: none of them has been deployed.
- The choice of a reward token: it has not been made.
- An independent audit of HarvexClaims, the contract used for both the reward vault and the claims contract: there has been none.
- A legal review of launching a token, or of paying holders a reward: there has been none.
- Tests on BNB Smart Chain itself: none were run, on mainnet or on testnet.
- An allocation or a vesting schedule: neither exists, and this paper does not say anywhere that team tokens are locked.
- Governance: there is none, be it on-chain or advisory.
` },
{ id: 'risks', title: 'What can go wrong', body: `
- **Product risk.** The studio relies on AI providers it does not control. They can raise their prices or stop being available.
- **Chain risk.** A limited group of validators operates BNB Smart Chain. Fees and rules on it may change. The chain has gone down before, and bridges to it have had incidents.
- **Smart contract risk.** Nobody has audited HarvexClaims. Funds could be locked or lost through a bug in that contract, or in a token it pays out.
- **Key risk.** If the signers of the multisig were compromised, or the root-posting key leaked, someone could post a wrong root. Three things contain that. Roots are public. The payout limit of the vault caps what a wrong root can release in one window. And claims can be paused.
- **Phishing risk.** There are fake explorers, and there are token addresses made to look like the real one. Harvex never asks for a recovery phrase. It never asks you to send funds to an address outside the app either.
- **Regulatory risk.** Some jurisdictions may restrict the distribution of a token, or not allow it at all.
- **Economic risk.** The team would pay holder rewards out of its own funds, at a fixed dollar rate. It is free to change that rate, to stop the program or never to start it. When the vault is running low, hours stay unsettled until someone refills it.
- **Asset risk.** A reward that is paid in a different token goes up and down with the price of that token. It depends on whoever issues the token and on the chain, and its value can fall. Because of legal restrictions, many holders might not be able to receive it.
- **Oracle and operator risk.** The price of the reward token is supplied by a Chainlink feed or by the operator. The Harvex server calculates the reward amounts, and the multisig or the root-posting key posts them. The guard against jumps of 50% and the age limit of 72 hours reduce the damage a wrong price can do. They do not rule it out. Rewards flow only for as long as the team keeps money in the vault.
- **Security risk.** We expect prompt injection by way of pasted documents, scams around wallet linking and people posing as the project. The studio is built so that such an attack reaches as little as possible. It is not built on the idea that risk can be removed.
` },
{ id: 'disclaimer', title: 'Legal notice', body: `
This paper describes a product and a design. It does not offer any token for sale and does not invite anyone to buy one. It is not advice on investment, law or tax. The team takes on no obligation through anything written here. The HARVEX token could lose its entire value. Harvex is a project of its own, with no affiliation to BNB Chain, to Binance, to Anthropic or to any AI provider this paper names.
` },
],
},

/* ------------------------------------------------------------- ROADMAP */
roadmap: [
{ phase: 'Phase 0', title: 'Groundwork', when: 'Q3 2026', status: 'done', items: [
  ['next', 'A domain of its own for Harvex; name and logo are already settled'],
  ['done', 'The agent studio, with persona and skills, and with save, duplicate, archive, export and share'],
  ['done', 'A workspace on a server (Cloudflare Worker + D1) that keeps agents and runs under an account, paid in preview credits'],
  ['done', 'A character engine of our own: 25 characters, an outfit system, 33 motions and 6 powers'],
  ['done', 'Ten agent skills, built and open to all'],
  ['done', 'Human characters as models: rigged bodies that the studio dresses, and a body choice in the outfit editor'],
] },
{ phase: 'Phase 1', title: 'Closed preview', when: 'Q4 2026', status: 'now', items: [
  ['done', 'A preview of the site online: the home page, the docs, the whitepaper and this roadmap are open to everyone'],
  ['now', 'Opening the rest in stages: the studio, sign-in, the pages about listed agents; a closed page says so instead of failing'],
  ['now', 'Bring in 20–50 testers and gather what they say about characters, outfits and skills'],
  ['done', 'The docs, the whitepaper and this roadmap'],
  ['done', 'A marketplace paid by the run: agents published at a price, the Discover gallery, earnings for creators and a ledger'],
  ['next', 'Work on phones: controls for touch and a rendering mode that uses little power'],
  ['next', 'A hosted studio whose server is connected to an AI provider'],
  ['done', 'Research that uses the web and links its sources, through Claude, OpenAI or Gemini with Google Search; it is on as soon as a provider is configured'],
] },
{ phase: 'Phase 2', title: 'Open beta', when: 'Q1 2027', status: 'planned', items: [
  ['done', 'Hosting without a platform is built: a container for Docker / Coolify, with wallet sign-in handled on the server (Better Auth, SIWE)'],
  ['done', 'Top-ups in USDT on BNB Smart Chain, built and tested on a local chain'],
  ['planned', 'Turning USDT top-ups on for a hosted studio on mainnet'],
  ['done', 'Claims of earnings through merkle epochs and the HarvexClaims contract, tested locally (no audit, not deployed)'],
  ['next', 'A deployment on the testnet (chain 97), with the address of the claims contract made public'],
  ['planned', 'An independent audit of the contract, followed by earnings claims on mainnet'],
  ['planned', 'Turning the platform fee on at 10%'],
  ['done', 'Schedules: an agent runs a skill by itself between 1 and 24 times a day, and credits pay for it'],
  ['done', 'Delivery: the results of a schedule go to a Discord channel or to a Telegram chat'],
  ['done', 'Chat on Telegram: people in a connected chat or group put questions to one of your agents through the bot'],
  ['done', 'Share an answer: a run gets a public page with a preview picture, and one click removes it again'],
  ['done', 'Quests: things to try out, and each one pays an account free credits a single time'],
  ['done', 'Invite a friend: once the invited account has finished its first run, both sides receive free credits'],
  ['done', 'A boost of the holder reward, built as part of the reward program: 10% more reward for each invited friend holding 3,000,000 HARVEX, 1.5x at most; public page /invite'],
  ['done', 'Separate link previews for the main pages: rewards, schedules, skills, studio, discover and quests'],
  ['planned', 'Exporting the task history'],
  ['done', 'Six emotes added: Flex, Heart, Dab, Facepalm, Kick and Backflip'],
  ['planned', 'Further characters, outfits for the seasons and further emotes'],
  ['planned', 'Skills proposed by the community'],
] },
{ phase: 'Phase 3', title: 'Wallet and token', when: 'Not scheduled', status: 'planned', items: [
  ['done', 'Linking wallets on BNB Smart Chain with SIWE, several to one account'],
  ['planned', 'The HARVEX token on the mainnet of BNB Smart Chain'],
  ['done', 'Holder tiers are built, with a fee discount and a monthly allotment read at a snapshot block; they begin when the token does'],
  ['done', 'Recipes: automations set up in advance, where one click creates the agent, the schedule and the delivery; public page /recipes'],
  ['done', 'Agent teams: a row of two or three agents, and each one builds on the answer that came before; public page /teams'],
  ['done', 'Chat with an agent: every published agent has a chat on its page, each message is paid for, and each message earns for the creator'],
  ['done', 'Creator agents: an agent that sounds like you, drafted from posts you paste in, and only if you opt in; public page /creators'],
  ['done', 'Verified creators: the creator posts a code from their X handle, a person on the team confirms it, and the handle then appears on the agents of that creator'],
  ['done', 'The plaza: one place where the published agents stand, and a click starts a chat with one; public page /plaza'],
  ['done', 'Share a conversation: a chat with an agent gets a public page and a preview picture of its own'],
  ['done', 'Agent cards: each published agent has a card to show around, used as its link preview and offered as a download'],
  ['done', 'Agent quality: notes for an agent to answer from, a greeting with starter questions, the agent check ahead of publishing, and ratings on answers'],
  ['done', 'An agent of another creator in your Telegram chat: you link a chat or group, a published agent that is not yours answers in it, each answer is paid for and its creator earns'],
  ['done', 'The weekly board: the published agents with the most use over the past seven days, ranked by people first and runs second, showing newcomers and movers; public page /top'],
  ['done', 'Reports only after a change: a schedule for Wallet monitor or Whale watch takes a free look at each slot and runs only if something is different; recipes Whale alarm and Wallet alarm'],
  ['done', 'The arena: one question goes to two published agents, their answers stand next to each other on a public page, and readers choose the better one; public page /arena'],
  ['done', 'Agent sources: the creator pastes in notes, an FAQ or an old thread; the agent builds its answer on the passages matching a question and lists the sources below it'],
  ['done', 'Holder perks: each tier allows more schedules, more scheduled runs per day and more delivery channels; public page /tiers'],
  ['planned', 'A number of agent slots for each tier'],
  ['done', 'The holder reward pipeline is built and was tested on a local chain: a holder recorder, a reward calculator working by the second, a reward vault (HarvexClaims) and a rewards dashboard'],
  ['planned', 'Fix which NVDA token pays the reward, deploy the reward vault with a multisig as its owner, then turn the fixed-rate reward on'],
  ['done', 'Built: a statement of eligibility ahead of claims, and a public log of funding and claims'],
  ['planned', 'A legal review covering the token and, region by region, the reward payouts'],
  ['done', 'The Wallet monitor skill: it reads one wallet on BNB Smart Chain, reports the changes since its last check and can be put on a schedule'],
  ['done', 'Whale watch: a skill and a public page showing the biggest transfers and holders of HARVEX, read from the chain'],
] },
{ phase: 'Phase 4', title: 'A market for creators', when: 'H2 2027', status: 'planned', items: [
  ['planned', 'A public gallery of agents, with remixing'],
  ['planned', 'Attributing usage, and rewards for creators'],
  ['planned', 'Advisory governance over the roadmap and the skill library'],
  ['planned', 'Workspaces that a team shares'],
] },
{ phase: 'Later', title: 'Ideas we are weighing', when: 'Not scheduled', status: 'idea', items: [
  ['idea', 'Agents that speak with a voice'],
  ['idea', 'Uploading your own model, through a pipeline that keeps the style consistent'],
  ['idea', 'Tasks for several agents that pass work from one to the next'],
  ['idea', 'A governance module on-chain'],
] },
],
};
})(window);
