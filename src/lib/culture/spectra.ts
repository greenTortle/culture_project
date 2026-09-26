/**
 * 256 ordered lines per tree, most Biblical → most permissive.
 *
 * Each line is one statement a respondent rates. The poll is a search for the point
 * on this ladder where a person stops agreeing — their line — so the ordering is the
 * whole mechanism: line 0 must be the strictest position anyone could hold in the
 * category and line 255 the most permissive, with every step in between moving in one
 * direction only. A single out-of-order line makes the search converge on the wrong
 * place, so treat the ordering as load-bearing when editing.
 *
 * Lines are composed from two ordered axes rather than written out 256 times:
 *
 *   stems   — 16 behaviours, strictest → most permissive. This is the moral content.
 *   degrees — 16 framings, most settled → most unreflective. This is the conviction
 *             the behaviour is held with.
 *
 * The stem is the primary sort key, so the ladder walks the whole conviction range at
 * one behaviour before moving to the next. That is deliberate: near a person's line the
 * distinctions that matter are about how firmly a position is held, not about jumping to
 * a different act.
 *
 * Two rules for writing stems:
 *
 *  1. PRESENT TENSE, describing what someone actually does — "I hold my tongue when
 *     someone cuts me off in traffic", never "I would hold my tongue". A hypothetical
 *     invites people to answer about the person they intend to be; the present tense
 *     asks about the person they are.
 *  2. OBSERVABLE BEHAVIOUR, not a trait or a virtue. "I stay patient with a slow
 *     cashier when I am already late" is answerable; "I am a patient person" is a
 *     self-image question and nearly everyone agrees with it.
 *
 * Known limit: the degree axis is monotone for restraint stems (being less committed to
 * a restraint is more permissive) but not strictly so for indulgence stems, where doing
 * something thoughtlessly and doing it deliberately are both permissive. The effect is
 * bounded at ±15 of 256 positions — about 1.4 points on the −12…12 scale — and is
 * dominated by the stem in every case.
 */

const STEM_COUNT = 16;
const DEGREE_COUNT = 16;

function grid(stems: string[], degrees: string[]) {
  if (stems.length !== STEM_COUNT) {
    throw new Error(`Expected ${STEM_COUNT} stems, got ${stems.length}`);
  }
  if (degrees.length !== DEGREE_COUNT) {
    throw new Error(`Expected ${DEGREE_COUNT} degrees, got ${degrees.length}`);
  }
  const out: string[] = [];
  for (let s = 0; s < STEM_COUNT; s++) {
    for (let d = 0; d < DEGREE_COUNT; d++) {
      out.push(degrees[d]!.replace("{x}", stems[s]!));
    }
  }
  return out;
}

/**
 * Private conviction, firmest → most unreflective. Present tense throughout: these ask
 * what a person does, not what they imagine they would do.
 */
const PRIV = [
  "I {x}. That is settled for me, and I do not revisit it.",
  "I {x}, even when it costs me something real.",
  "I {x}, even when no one ever finds out.",
  "I {x}, including when I am completely alone.",
  "I {x} as a matter of course, without weighing it each time.",
  "I {x} in ordinary daily life.",
  "I {x}, and I count the exceptions as failures.",
  "I usually {x}, with a few exceptions I do not defend.",
  "I mostly {x}, though I am not consistent about it.",
  "I {x} more often than not.",
  "I {x}, when it is easy enough to.",
  "I {x}, when it suits me.",
  "I {x}, whenever I feel like it.",
  "I {x} freely, without much inner resistance.",
  "I {x}, without hesitation.",
  "I {x}, and see nothing here worth weighing.",
];

/** Resistance to company, most independent → most absorbed. */
const SOC = [
  "I {x}, and nothing about the company I keep changes that.",
  "I {x}, even when it makes me the odd one out.",
  "I {x}, even when it costs me the group.",
  "I {x}, unless a mentor I trust makes a careful case otherwise.",
  "I {x}, though a close friend can make me pause.",
  "I {x}, though I feel the pull the whole time.",
  "I {x}, unless the people I live with treat the opposite as normal.",
  "I {x}, and I notice my friends' habits shaping that.",
  "I {x}, partly to avoid an awkward moment.",
  "I {x}, if it keeps me inside the group I want.",
  "I {x}, rather than have to explain myself.",
  "I {x}, whenever the people I want to belong with already do.",
  "I {x}, to keep someone's good opinion of me.",
  "I {x}, without resistance, when my circle expects it.",
  "I {x}, before anyone even asks me to.",
  "I {x}, and do not notice I have decided anything.",
];

export const SPECTRA: Record<string, string[]> = {
  "alcohol:individualistic": grid(
    [
      "refuse any alcoholic drink in any setting",
      "refuse alcohol everywhere except a communion cup",
      "limit myself to a sip of wine in a clearly religious context",
      "accept a single ceremonial toast at a wedding or a funeral",
      "allow myself one drink at a formal dinner and stop there",
      "drink socially, stopping well short of feeling it",
      "drink alone only while staying fully in control",
      "drink alone to take the edge off a hard day",
      "go drinking by myself",
      "drink alone often enough that it is simply part of my routine",
      "get noticeably intoxicated when I am alone",
      "drink alone well past the point where I meant to stop",
      "drink until I cannot remember the night, when I am alone",
      "drink alone heavily enough to lose the following day to it",
      "use a recreational drug when I am alone and unlikely to be caught",
      "use a hard drug alone and accept whatever it does to me",
    ],
    PRIV,
  ),
  "alcohol:communal": grid(
    [
      "refuse a drink even when every friend at the table is having one",
      "refuse a drink even when refusing makes the whole evening awkward",
      "accept a drink only when a mentor I respect offers it",
      "hold a drink I have no intention of finishing so that I blend in",
      "drink more readily when a close friend is drinking",
      "accept a second drink because the round has already been bought for me",
      "go drinking when my friend is going",
      "go out on a night I meant to stay in, because the group is going",
      "match my friends drink for drink to stay part of the group",
      "drink faster than I want to so I am not the one holding things up",
      "get drunk when the people I want to belong with are doing so",
      "stay drunk with a group rather than leave and look like I cannot keep up",
      "keep going past my limit because the table has not stopped",
      "let a group talk me into drinking after I have already said no",
      "try a drug when a trusted friend insists it is safe",
      "take whatever the group is taking rather than be the only one who did not",
    ],
    SOC,
  ),
  "character:individualistic": grid(
    [
      "hold my tongue when someone cuts me off in traffic, and let it go completely",
      "stay patient with a slow cashier when I am already late",
      "apologize first after an argument, even when I was the one wronged",
      "keep my voice level with a relative who is deliberately provoking me",
      "follow through on a favour after it turns out to be far more work than I expected",
      "go out of my way to help someone who cannot return it",
      "let most rude remarks pass without a comeback",
      "snap at the people closest to me when I am tired, then apologize afterward",
      "go quiet and withdraw for a day or two when someone upsets me",
      "let irritation show in my tone with people who cannot do anything about it",
      "say the cutting thing I thought of, and tell myself they had it coming",
      "carry a grudge for weeks over something small",
      "leave someone waiting on a commitment because I no longer feel like keeping it",
      "raise my voice in an argument to end it faster",
      "say the thing I know will wound, in the moment I am angry",
      "keep score of what people owe me and collect when I get the chance",
    ],
    PRIV,
  ),
  "character:communal": grid(
    [
      "defend someone by name when a group chat turns on them",
      "say plainly that a conversation has turned unkind, in front of everyone",
      "stay kind to someone my friends have decided to find annoying",
      "keep a promise to one friend when the rest of the group makes it inconvenient",
      "stay quiet rather than laugh along, and accept looking humourless",
      "change the subject when the group starts in on someone's reputation",
      "let my sense of humour get sharper and meaner around certain friends",
      "laugh at something cruel rather than be the one who did not",
      "join the eye-roll about someone who has just left the room",
      "add the detail that makes the mockery land, to stay inside the joke",
      "repeat something told me in confidence because the group half knew already",
      "let my patience with my family run out faster when my friends are watching",
      "go along with freezing someone out because the group has decided to",
      "say something cruel about someone to prove I am on the group's side",
      "drop a friend the group has turned on, without ever asking why",
      "lead the pile-on myself, to be sure I am not the next one",
    ],
    SOC,
  ),
  "practice:individualistic": grid(
    [
      "lead a Bible study and prepare for it through the week",
      "read Scripture on my own every day, whether or not I feel like it",
      "pray at a fixed time each day, not only when something is wrong",
      "attend a midweek study on top of Sunday, most weeks",
      "attend church every Sunday and serve somewhere in it",
      "attend church every Sunday, though I am not involved beyond that",
      "put worship music on in the car when I am driving alone",
      "read Scripture a few times a week, when the week allows it",
      "attend church most Sundays, and skip when something else comes up",
      "pray mainly when I want something or something has gone wrong",
      "read Scripture only when a study or a sermon puts it in front of me",
      "attend church once or twice a month, whenever the morning is free",
      "go a month at a time without opening a Bible, and not notice",
      "attend church only at Christmas and Easter",
      "keep the label and the holidays, and give the rest of it no time",
      "go years without praying, reading, or attending anything",
    ],
    PRIV,
  ),
  "practice:communal": grid(
    [
      "go to a study alone when the friends I usually go with have all dropped out",
      "invite a friend to church even when I am fairly sure they will say no",
      "keep my Sunday commitment when my friends plan something for that morning",
      "pray out loud in a group when no one else volunteers",
      "say grace in a restaurant when I am with people who do not",
      "go to church more readily in the weeks a friend is going too",
      "need someone to come with me before I will commit to a study",
      "put worship music on alone in the car, then switch it off when someone gets in",
      "let a friend's weekend plans decide whether my week has any worship in it",
      "leave church out of the answer when someone asks what I did on the weekend",
      "match how much I talk about faith to whoever is in the room",
      "stop going to a study once the friend who brought me stops going",
      "let my attendance lapse entirely once no one is expecting me",
      "downplay how much my faith matters to me when saying so costs me standing",
      "laugh along when my circle makes fun of religious people",
      "make those jokes myself, to be sure no one counts me among them",
    ],
    SOC,
  ),
  "sex:individualistic": grid(
    [
      "keep sexual intimacy for marriage, including in what I watch and read",
      "keep filters and accountability on my own devices, and leave them there",
      "close something out the moment it turns sexual, even when I am alone",
      "date only with marriage as the actual question on the table",
      "keep the physical limits I set before the relationship began",
      "end a relationship that is pulling me past lines I set for myself",
      "date without any particular view toward marriage",
      "let the physical side of a relationship move by feel rather than by any line",
      "look at pornography occasionally when I am alone",
      "stay in a relationship I know is going nowhere because I do not want to be single",
      "sleep with someone I am serious about, without expecting it to last",
      "look at pornography regularly, and arrange my evenings around it",
      "treat casual encounters as a private matter of preference",
      "keep someone interested for longer than I mean it, to keep the access",
      "keep more than one person on the line at once without telling either",
      "treat someone else's reluctance as an obstacle rather than an answer",
    ],
    PRIV,
  ),
  "sex:communal": grid(
    [
      "keep my standards when the person I am seeing asks me not to",
      "say no to someone I am afraid of losing",
      "leave the room rather than watch something sexual with everyone else",
      "tell a friend plainly that the way they are treating someone is wrong",
      "keep a limit even after a partner tells me I am being ridiculous",
      "let a partner's confidence settle something I was unsure about",
      "keep quiet about a limit because raising it spoils the mood",
      "compare my relationship to what my friends say theirs are like, and adjust",
      "move faster physically because I assume everyone else already has",
      "stay in something that costs me my standards rather than be single",
      "sleep with someone I am dating when they make it a condition of staying",
      "join in when my friends talk about people as though they were disposable",
      "hide a relationship from the people who tell me the truth about things",
      "cheat on someone when the opportunity is easy and private",
      "pressure someone else because that is how my circle treats it",
      "go along with a group that treats someone's reluctance as a joke",
    ],
    SOC,
  ),
  "campus:individualistic": grid(
    [
      "keep a hobby going that leaves me better than it found me, and protect the time for it",
      "choose what I do with a free evening by whether it is worth the hours",
      "put a book, an instrument, or a workshop project in the hours I could spend scrolling",
      "stop a hobby at a set point rather than letting it run into the night",
      "keep rest as rest, and pick the work back up when it is time",
      "spend most of my free time on things I am glad to describe to anyone",
      "drift into whatever is already on rather than choosing how the evening goes",
      "lose an evening to scrolling and remember none of it afterward",
      "let a hobby eat into my sleep on a work night",
      "spend money on a hobby past what I can reasonably afford",
      "skip something I committed to because I was deep in a game or a project",
      "watch or play things I quietly close when someone walks in",
      "let a hobby take hours I owe to people who are counting on me",
      "build my week around a hobby and fit everything else into the gaps",
      "keep going with something that stopped being fun, because stopping feels impossible",
      "let what I watch and play shape how I think, and not care what it makes of me",
    ],
    PRIV,
  ),
  "campus:communal": grid(
    [
      "keep a hobby that no one in my circle shares or finds interesting",
      "invite someone into something worth doing rather than default to what the group does",
      "leave a session when it is time, even with the group still going",
      "say no to a late night of gaming when I have something in the morning",
      "take up a hobby because my friends do, and come to enjoy it on its own terms",
      "keep quiet about a hobby my friends find dull",
      "stay in a session far longer than I meant to because the group has not stopped",
      "let my group decide how nearly every free evening gets spent",
      "drop something I actually enjoy because it is not what my friends are into",
      "watch whatever the room puts on, whatever it happens to be",
      "spend on a hobby to keep pace with what my friends are spending",
      "let a group pull me into content I do not choose on my own",
      "stay out with the group on a night I owed someone my attention",
      "laugh along with content that degrades people, because everyone else is",
      "spend nearly all my free time with the people who ask the least of me",
      "let the group's tastes decide entirely what I watch, play, and find funny",
    ],
    SOC,
  ),
  "academics:individualistic": grid(
    [
      "do my own work fully, even where a shortcut goes unnoticed",
      "report my own error to a professor after the grade has already been given",
      "cite every source carefully and refuse to pad my work",
      "rewrite something in my own words rather than lean on a source I half understand",
      "study with diligence even in courses I do not enjoy",
      "do the reading properly even when the exam will not test it",
      "do enough to pass and look competent, without extra care",
      "hand something in half-finished and hope it is not read closely",
      "cut corners on readings and labs when I can still get the grade",
      "lean on a summary or a generated answer instead of doing the thinking myself",
      "plagiarize a paragraph when I am sure it will not be caught",
      "hand in work that is mostly not mine and call it mine",
      "fabricate data or citations to save time",
      "invent a reason for an extension that never happened",
      "buy the grade outright when I can do it privately",
      "have someone else do the work for me from start to finish",
    ],
    PRIV,
  ),
  "academics:communal": grid(
    [
      "refuse to share answers even when a friend is desperate",
      "say no to a friend's request in a way that may cost me the friendship",
      "study honestly even when my study group is sloppy",
      "leave a group chat that has started trading answers",
      "let a friend copy notes I have already finished",
      "walk a friend through an answer closely enough that it is really mine",
      "collaborate past the allowed line when the cohort treats it as normal",
      "work together on something the syllabus said to do alone, because everyone does",
      "use a shared answer key when my friends already have it",
      "pass on a question I remember from an earlier sitting of the exam",
      "cheat on an exam when the people around me are cheating",
      "let someone copy from me during an exam rather than refuse in the moment",
      "lie to a professor to cover a friend",
      "sign an attendance or integrity statement I know to be false, for a friend",
      "run a cheating ring because that is how my circle gets ahead",
      "sell work to other students because that is what my circle does",
    ],
    SOC,
  ),
  "work:individualistic": grid(
    [
      "tell the truth in every financial and labor dealing, even when it costs me",
      "correct an invoice in the client's favour when no one has caught it",
      "keep my word on hours, invoices, and credit for work",
      "name the person whose idea it actually was, in the room where it counts",
      "do assigned work thoroughly when no supervisor is watching",
      "finish properly rather than to whatever standard will actually be checked",
      "do what is required, and little more, when I am not being measured",
      "let the clock run on work I am not really doing",
      "shade a timesheet or expense when I feel underpaid",
      "round hours and expenses my own way and treat it as owed to me",
      "take credit for others' work when I can do it quietly",
      "stay silent while someone else is blamed for my mistake",
      "mislead a client or employer when it increases my pay",
      "sell something I know will not do what the buyer expects of it",
      "steal or defraud in business when I am confident I will not be caught",
      "build the deception into how I work and treat it as ordinary business",
    ],
    PRIV,
  ),
  "work:communal": grid(
    [
      "refuse a dishonest workplace practice even when it is 'how we do things'",
      "raise it a second time after being told once to leave it alone",
      "speak up when a team is about to mislead a client",
      "put an objection in writing knowing it will be held against me",
      "go along with small padding of hours when my team already does",
      "stay quiet about a practice I cannot defend when asked directly",
      "match the ethical shortcuts of the office I want to stay in",
      "work out where the line is here and settle just inside it",
      "hide a mistake for a colleague when loyalty seems to require it",
      "let a client stay wrong about something because correcting it is awkward",
      "join in taking credit from someone quieter on the team",
      "let a junior colleague absorb blame the whole team had earned",
      "help the group lie to a client when my job seems to depend on it",
      "put my name to a document I know misrepresents the work",
      "participate in fraud when that is the price of remaining in the firm",
      "help bring someone else into the practice so the risk is shared",
    ],
    SOC,
  ),
};
