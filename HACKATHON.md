# The Digital Twin definition — one paragraph

> This system satisfies the engineering definition of a Digital Twin — the
> definition used for aircraft engines and factories, not the marketing one.
> Each person is represented by a **persistent state object** of ~30 derived
> attributes that exists independently of any query or session. That state is
> **continuously updated**: every financial event passes through a single
> mutation gateway (`apply_event`) that transforms State A into State B and
> re-derives all dependent attributes in one pass — an explicit **state
> transition**, stored and exposed with a semantic diff of what changed and
> why. The Twin carries **memory**: a timeline of the salary changes, loans,
> defaults, and shocks that shaped it, extracted from history and extended by
> every live event. Its **behavior model** — financial personality with
> confidence, spending volatility, income stability — is inferred from
> engineered features, not labeled by rules of thumb. And because the Twin
> has state and dynamics, it supports true **simulation**: hypothetical
> futures run forward on a copy of the state, validated against consistency
> invariants before any result is returned. A dashboard has none of these
> properties; a chatbot has at most the last one, without state.

---

# Why this is a true Financial Digital Twin — not a dashboard, not a chatbot

*The 90-second technical answer for judges.*

## The test that separates a twin from a dashboard

A dashboard **describes the past**: it aggregates transactions and draws
charts. A chatbot **retrieves and rephrases**: it answers questions over
the same raw data. A digital twin does something neither can:

> **It maintains a stateful model of the person that evolves with every
> event and can be run forward in time under hypothetical conditions.**

That is the same definition used for aircraft engine twins: a virtual
object with state, memory, and simulatable dynamics — not a report.

## How our system meets that definition

**1. State, not queries.** Each person is a `FinancialTwin` object with
~30 derived attributes (health score, debt ratio, emergency-fund runway,
spending volatility, financial personality…). After construction, **no
component ever touches raw transactions again** — simulations,
recommendations, and forecasts all read Twin state. This is enforced by
architecture, not convention: the simulation layer has no import path to
the transaction store.

**2. Memory.** The Twin carries a timeline of significant life events —
detected salary and salary changes, loans granted and their outcomes,
large purchases, first overdraft — extracted from history, and every new
live event appends to it. Ask the Twin "what happened to this person?"
and it answers from its own memory.

**3. Dynamics.** `apply_event()` is the single mutation gateway: a new
loan, a subscription, a salary change — each event updates the state and
re-derives every dependent attribute (savings rate → health score →
personality → risk level → 24-month balance forecast) in one pass.

**4. Simulation.** What-if scenarios run on a deep copy of the Twin and
return *before state → event → after state* with the exact attributes
that changed. Multi-scenario comparison ranks decisions by their effect
on the person's projected health — e.g. "car on loan vs. cash vs. invest
the installment" produces three future versions of the same person.

**5. Explainability by construction.** Every recommendation includes a
WHY generated mechanically from the state diff — "Health dropped 27.7 →
13.0 because the loan adds 302/month in obligations, raising your DTI to
19.2% and emptying your emergency fund." The explanation cannot
contradict the numbers because it is computed from them.

**6. Validated against reality.** Built on 1,056,320 real bank
transactions (4,500 clients, Berka/PKDD'99). The dataset records the real
outcome of 682 loans. Our Health Score — which never sees loan outcomes —
scores clients whose loans went into distress at **22.8** vs **42.8** for
clients who repaid successfully. The Twin predicts real financial
distress from behavior alone.

## One sentence

> A dashboard tells you what you spent; a chatbot tells you what your
> data says; **our Twin tells you who you will be in 24 months if you
> make this decision — and shows exactly which parts of your financial
> self change and why.**
