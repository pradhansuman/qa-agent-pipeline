#!/usr/bin/env python3
"""
Multi-Agent Council
===================
5 AI agents collaborate, debate, and guardrail each other before answering.

Roles
-----
  Researcher   — gathers facts, sets the knowledge baseline
  Creative     — proposes novel ideas and unconventional angles
  Critic       — challenges assumptions, pokes holes
  Safety Guard — hard guardrail: can VETO any unsafe/unethical direction
  Synthesizer  — reads the full debate and delivers the final answer

Discussion Flow
---------------
  Round 1  → each of the first 4 agents gives an opening position
  Round 2  → agents respond directly to each other (cross-talk)
  Guardrail→ Safety Guard reviews EVERYTHING, can block or correct
  Final    → Synthesizer produces the user-facing answer
"""

import os
import sys
import textwrap
from dataclasses import dataclass, field
from typing import Optional

try:
    import anthropic
except ImportError:
    sys.exit("Run: pip install anthropic")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL   = os.environ.get("QA_AGENT_MODEL", "claude-haiku-4-5-20251001")
MAX_TOK = 600          # tokens per agent response
WIDTH   = 72           # terminal wrap width

client  = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from environment


# ---------------------------------------------------------------------------
# Agent definitions
# ---------------------------------------------------------------------------

@dataclass
class Agent:
    name:   str
    emoji:  str
    color:  str          # ANSI escape
    system: str


RESET  = "\033[0m"
BOLD   = "\033[1m"
AGENTS: list[Agent] = [
    Agent(
        name  = "Researcher",
        emoji = "🔍",
        color = "\033[36m",      # cyan
        system = textwrap.dedent("""\
            You are the Researcher in a 5-agent council answering a user's question.

            Your job:
            • State the most relevant, accurate facts about the topic.
            • Clarify what is known vs. uncertain.
            • Keep it to 3-5 bullet points — dense and useful.

            Address the other agents directly if you see their names in the discussion.
            Start your reply with "RESEARCHER:"."""),
    ),
    Agent(
        name  = "Creative",
        emoji = "💡",
        color = "\033[33m",      # yellow
        system = textwrap.dedent("""\
            You are the Creative thinker in a 5-agent council answering a user's question.

            Your job:
            • Build on what Researcher said, then add unexpected angles or fresh ideas.
            • Think laterally — propose approaches others might overlook.
            • 2-4 short, punchy ideas.

            Address the other agents by name when you build on or push back against them.
            Start your reply with "CREATIVE:"."""),
    ),
    Agent(
        name  = "Critic",
        emoji = "🔬",
        color = "\033[35m",      # magenta
        system = textwrap.dedent("""\
            You are the Critic (devil's advocate) in a 5-agent council.

            Your job:
            • Challenge the Researcher's facts — are any incomplete or misleading?
            • Push back on Creative's ideas — are they realistic? Any risks?
            • Ask the hardest questions the user should consider.
            • Be sharp and precise, not dismissive.  2-4 points.

            Name the agents you are critiquing.
            Start your reply with "CRITIC:"."""),
    ),
    Agent(
        name  = "Safety Guard",
        emoji = "🛡️",
        color = "\033[31m",      # red
        system = textwrap.dedent("""\
            You are the Safety Guard (hard guardrail) in a 5-agent council.

            Your job — review the ENTIRE discussion so far and check for:
            • Harmful, dangerous, or illegal advice
            • Significant factual errors that could mislead the user
            • Ethical concerns or bias
            • Privacy or security risks

            If you find problems:
              → Start with "⚠️  FLAGGED by Safety Guard:"
              → List each issue clearly
              → Tell the Synthesizer what to avoid or correct

            If everything is fine:
              → Start with "✅  CLEARED by Safety Guard:"
              → One sentence explaining what you checked.

            Be strict. A single serious issue must be flagged even if the rest is good.
            Start your reply with "SAFETY GUARD:"."""),
    ),
    Agent(
        name  = "Synthesizer",
        emoji = "⚡",
        color = "\033[32m",      # green
        system = textwrap.dedent("""\
            You are the Synthesizer — the final voice of the 5-agent council.

            The council has debated the user's question across two rounds.
            Safety Guard has reviewed everything.

            Your job:
            • If Safety Guard flagged anything: address those issues first.
            • Weave together the strongest points from all agents.
            • Produce a clear, direct, well-reasoned answer the USER can act on.
            • Do NOT just list what each agent said — synthesize into a unified answer.
            • Length: as long as the answer needs, no filler.

            Start with "SYNTHESIZER — FINAL ANSWER:" then give the answer."""),
    ),
]

# Convenient lookup
RESEARCHER   = AGENTS[0]
CREATIVE     = AGENTS[1]
CRITIC       = AGENTS[2]
SAFETY_GUARD = AGENTS[3]
SYNTHESIZER  = AGENTS[4]


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

@dataclass
class Turn:
    agent:   Agent
    round_n: int         # 1 = opening, 2 = cross-talk, 0 = special (guard/synth)
    text:    str


def _call(agent: Agent, user_question: str, history: list[Turn]) -> str:
    """Send a prompt to one agent, return its text reply."""

    # Build the conversation context the agent sees
    lines = [f'USER QUESTION: "{user_question}"\n']

    if history:
        lines.append("─" * 50)
        lines.append("COUNCIL DISCUSSION SO FAR:\n")
        for turn in history:
            label = f"[Round {turn.round_n}] {turn.agent.name}" if turn.round_n else turn.agent.name
            lines.append(f"{label}:\n{turn.text}\n")
        lines.append("─" * 50)

    lines.append(f"\nIt is now your turn as the {agent.name}. Respond.")

    response = client.messages.create(
        model      = MODEL,
        max_tokens = MAX_TOK,
        system     = agent.system,
        messages   = [{"role": "user", "content": "\n".join(lines)}],
    )
    return response.content[0].text.strip()


def _print_turn(turn: Turn) -> None:
    a = turn.agent
    tag = f"Round {turn.round_n}" if turn.round_n else "Special"
    header = f"{a.emoji}  {a.color}{BOLD}{a.name.upper()}{RESET}  [{tag}]"
    print(f"\n{header}")
    print("─" * WIDTH)
    # Wrap long lines for readability
    for line in turn.text.splitlines():
        if line.strip():
            print(textwrap.fill(line, width=WIDTH, subsequent_indent="    "))
        else:
            print()
    print()


# ---------------------------------------------------------------------------
# The deliberation engine
# ---------------------------------------------------------------------------

def deliberate(user_question: str) -> None:
    """
    Run the full council deliberation:
      Round 1  — Researcher, Creative, Critic each give opening statements
      Round 2  — same three agents respond to each other (cross-talk)
      Guardrail— Safety Guard reviews all 6 statements, may veto
      Final    — Synthesizer produces the answer
    """

    print(f"\n{'═' * WIDTH}")
    print(f"  🏛️   COUNCIL IN SESSION")
    print(f"  Question: {user_question[:WIDTH - 14]}")
    print(f"{'═' * WIDTH}")

    history: list[Turn] = []

    # ── Round 1: opening positions ──────────────────────────────────────────
    print(f"\n{BOLD}── Round 1: Opening Positions ──────────────────────────────{RESET}")
    for agent in [RESEARCHER, CREATIVE, CRITIC]:
        print(f"  {agent.emoji}  {agent.name} is drafting opening statement...", end="\r")
        text = _call(agent, user_question, history)
        turn = Turn(agent=agent, round_n=1, text=text)
        history.append(turn)
        _print_turn(turn)

    # ── Round 2: cross-talk ─────────────────────────────────────────────────
    print(f"{BOLD}── Round 2: Cross-Talk (agents respond to each other) ──────{RESET}")
    for agent in [RESEARCHER, CREATIVE, CRITIC]:
        print(f"  {agent.emoji}  {agent.name} is drafting rebuttal/response...", end="\r")
        text = _call(agent, user_question, history)
        turn = Turn(agent=agent, round_n=2, text=text)
        history.append(turn)
        _print_turn(turn)

    # ── Guardrail: Safety Guard ─────────────────────────────────────────────
    print(f"{BOLD}── Guardrail: Safety Guard reviewing all 6 statements ───────{RESET}")
    print(f"  🛡️   Safety Guard is auditing the discussion...", end="\r")
    sg_text = _call(SAFETY_GUARD, user_question, history)
    sg_turn = Turn(agent=SAFETY_GUARD, round_n=0, text=sg_text)
    history.append(sg_turn)
    _print_turn(sg_turn)

    flagged = "⚠️" in sg_text or "FLAGGED" in sg_text.upper()
    if flagged:
        print(f"  ⚠️   {BOLD}Safety Guard raised concerns — Synthesizer must address them.{RESET}\n")

    # ── Final answer: Synthesizer ────────────────────────────────────────────
    print(f"{BOLD}── Final Answer: Synthesizer ────────────────────────────────{RESET}")
    print(f"  ⚡  Synthesizer is writing the final answer...", end="\r")
    synth_text = _call(SYNTHESIZER, user_question, history)
    synth_turn = Turn(agent=SYNTHESIZER, round_n=0, text=synth_text)
    history.append(synth_turn)
    _print_turn(synth_turn)

    print(f"{'═' * WIDTH}\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

DEMO_RESPONSES: dict[tuple[str, int], str] = {
    # (agent_name, round) → canned reply used when --demo flag is set
    ("Researcher", 1): (
        "RESEARCHER:\n"
        "• Python and JavaScript are the two most popular beginner languages in 2025.\n"
        "• Python dominates data science, AI/ML, automation, and scripting; syntax is "
        "clean and readable — ideal for learning fundamentals.\n"
        "• JavaScript is the only language that runs natively in the browser; it is "
        "mandatory for front-end web development and also runs on servers via Node.js.\n"
        "• Both have massive communities, free learning resources, and strong job markets.\n"
        "• Key unknown: the user's goal (web UI, AI, automation, general CS?) changes the answer."
    ),
    ("Creative", 1): (
        "CREATIVE:\n"
        "• Researcher nailed the basics, but here's a reframe: don't ask which is 'better' — "
        "ask which one gives you a visible win faster. Python lets you print a sorted list or "
        "scrape a website in 10 lines; JavaScript lets you make a button change colour on a "
        "real webpage. Pick whichever demo excites YOU.\n"
        "• Unconventional take: learn both simultaneously but at different layers. Use Python "
        "for 'thinking in code' exercises and JavaScript for 'making things appear' projects. "
        "The overlap reinforces concepts without doubling the workload.\n"
        "• Wildcard: if the user's goal is AI/automation, Python wins by a decade. "
        "If goal is 'get a job at a startup fast', JavaScript + React is the faster path."
    ),
    ("Critic", 1): (
        "CRITIC:\n"
        "• Researcher says 'both have strong job markets' — partially misleading. "
        "JavaScript/TypeScript roles outnumber Python roles significantly in most job boards "
        "because every web team needs JS. Python roles are concentrated in data/AI teams.\n"
        "• Creative's 'learn both simultaneously' idea sounds elegant but contradicts learning "
        "science: split attention slows mastery. Beginners benefit from depth-first, not breadth.\n"
        "• Neither agent addressed the elephant in the room: the user's goal. "
        "Recommending Python for someone who wants to build a website, or JS for someone who "
        "wants to automate spreadsheets, would be actively harmful advice."
    ),
    ("Researcher", 2): (
        "RESEARCHER (Round 2):\n"
        "Critic makes a fair point about job market nuance — I'll sharpen: Python is dominant "
        "in data/AI roles; JS/TS dominates web. The key correction: goal MUST be established "
        "before a language recommendation can be responsible.\n"
        "Responding to Creative: I like the 'visible win' framing. Evidence supports it — "
        "motivation is the #1 dropout factor for self-taught programmers. Quick wins matter."
    ),
    ("Creative", 2): (
        "CREATIVE (Round 2):\n"
        "Critic is right that simultaneous learning is risky — I retract that idea for "
        "absolute beginners. Replace it with: pick one, reach a small project milestone "
        "(a CLI tool in Python or a to-do app in JS), THEN explore the other.\n"
        "Adding a new angle Critic and Researcher both missed: tooling matters. "
        "Python's setup (virtual environments, pip) confuses beginners more than people admit. "
        "JavaScript in the browser has zero install friction — just open DevTools and type."
    ),
    ("Critic", 2): (
        "CRITIC (Round 2):\n"
        "Acknowledging Creative's concession on simultaneous learning — that's the right call.\n"
        "However, Creative's 'JS has zero install friction' point cuts both ways: browser JS "
        "is also a minefield of DOM quirks and async callbacks that baffle newcomers. "
        "Python's friction is front-loaded (setup once); JS friction is spread across the "
        "entire learning journey (scope, callbacks, event loops, 'undefined is not a function').\n"
        "Final challenge: the council should not give a one-size answer. The honest answer "
        "is conditional on the user's stated goal."
    ),
    ("Safety Guard", 0): (
        "SAFETY GUARD:\n"
        "✅  CLEARED by Safety Guard: Reviewed 6 agent statements across 2 rounds.\n"
        "No harmful content, no dangerous advice, no misinformation detected. "
        "The Critic's push to ask about the user's goal before recommending is ethically "
        "correct — giving a definitive answer without knowing intent could mislead. "
        "Synthesizer should honour that nuance in the final answer."
    ),
    ("Synthesizer", 0): (
        "SYNTHESIZER — FINAL ANSWER:\n\n"
        "The honest answer is: it depends on your goal — but here's the decision tree.\n\n"
        "Choose Python if you want to:\n"
        "  • Work in AI, data science, or machine learning\n"
        "  • Automate repetitive tasks (files, spreadsheets, web scraping)\n"
        "  • Learn programming concepts with the cleanest syntax\n\n"
        "Choose JavaScript if you want to:\n"
        "  • Build websites or web apps (the only language browsers understand)\n"
        "  • Get a front-end or full-stack job quickly\n"
        "  • Start coding with zero install — just open your browser's DevTools\n\n"
        "If you genuinely have no preference yet: start with Python. "
        "Its syntax mirrors how algorithms are taught in textbooks, which builds stronger "
        "foundational thinking. You can always add JavaScript later — and many people do. "
        "Reach one small milestone first (a working script you're proud of), then expand."
    ),
}


def _demo_call(agent: Agent, round_n: int) -> str:
    """Return a canned demo response so the council runs without an API key."""
    return DEMO_RESPONSES.get((agent.name, round_n), f"[{agent.name} demo response]")


def deliberate_demo(user_question: str) -> None:
    """Run the council with canned responses (no API key required)."""
    print(f"\n{'═' * WIDTH}")
    print(f"  🏛️   COUNCIL IN SESSION  [DEMO MODE]")
    print(f"  Question: {user_question[:WIDTH - 14]}")
    print(f"{'═' * WIDTH}")

    history: list[Turn] = []

    print(f"\n{BOLD}── Round 1: Opening Positions ──────────────────────────────{RESET}")
    for agent in [RESEARCHER, CREATIVE, CRITIC]:
        text = _demo_call(agent, 1)
        turn = Turn(agent=agent, round_n=1, text=text)
        history.append(turn)
        _print_turn(turn)

    print(f"{BOLD}── Round 2: Cross-Talk ──────────────────────────────────────{RESET}")
    for agent in [RESEARCHER, CREATIVE, CRITIC]:
        text = _demo_call(agent, 2)
        turn = Turn(agent=agent, round_n=2, text=text)
        history.append(turn)
        _print_turn(turn)

    print(f"{BOLD}── Guardrail: Safety Guard ──────────────────────────────────{RESET}")
    sg_text = _demo_call(SAFETY_GUARD, 0)
    sg_turn = Turn(agent=SAFETY_GUARD, round_n=0, text=sg_text)
    history.append(sg_turn)
    _print_turn(sg_turn)

    print(f"{BOLD}── Final Answer: Synthesizer ────────────────────────────────{RESET}")
    synth_text = _demo_call(SYNTHESIZER, 0)
    synth_turn = Turn(agent=SYNTHESIZER, round_n=0, text=synth_text)
    _print_turn(synth_turn)

    print(f"{'═' * WIDTH}\n")


def main() -> None:
    demo_mode = "--demo" in sys.argv

    if not demo_mode and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit(
            "Set ANTHROPIC_API_KEY first:\n"
            "  export ANTHROPIC_API_KEY=sk-ant-...\n\n"
            "Or run a demo (no key needed):\n"
            "  python3 council.py --demo"
        )

    print(f"\n{'═' * WIDTH}")
    print("  🏛️   MULTI-AGENT COUNCIL" + ("  [DEMO MODE]" if demo_mode else ""))
    print("  5 AI agents debate, guardrail, and synthesize your answer.")
    print(f"{'═' * WIDTH}")
    print("\nAgents in this council:")
    for a in AGENTS:
        print(f"  {a.emoji}  {a.color}{a.name:14}{RESET}  {a.system.splitlines()[2].strip().lstrip('•').strip()}")
    if demo_mode:
        print(f"\n[DEMO MODE — using canned responses, no API key required]")
    else:
        print(f"\nModel: {MODEL}")
    print("Type 'quit' to exit.\n")

    while True:
        try:
            question = input("Your question: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nCouncil adjourned. Goodbye!")
            break

        if not question:
            continue
        if question.lower() in ("quit", "exit", "q"):
            print("Council adjourned. Goodbye!")
            break

        try:
            if demo_mode:
                deliberate_demo(question)
            else:
                deliberate(question)
        except anthropic.APIError as exc:
            print(f"\n❌  API error: {exc}\n")


if __name__ == "__main__":
    main()
