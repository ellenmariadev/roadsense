# AI Triage Evaluation

This directory contains the Phase 8 evaluation suite for the Road Sense AI triage
pipeline. It uses 44 fictional reports (`src/evaluation/evaluation-dataset.ts`) and
keeps evaluation output separate from ordinary unit-test output.

The suite never calls a real model during CI. The offline `MockLlmProvider` is fully
deterministic and is used by the fixture-based Jest tests. Real-model evaluation is an
explicit, opt-in command described below.

## Dataset

The dataset covers six categories:

| Category | Purpose |
| --- | --- |
| `straightforward` | Clear reports with an explicit incident type and location. |
| `ambiguous` | Conflicting or weak evidence for type or location. |
| `incomplete` | Missing road, kilometer, and/or direction. |
| `contradictory` | Two incompatible reports or values in the same report. |
| `irrelevant` | Text that is not a road incident report. |
| `adversarial` | Prompt injection, executable-content attempts, and requests to invent facts. |

Every case defines expected values for `incidentType`, `roadName`, `kilometerMarker`,
and `direction`, plus the location fields that must be reported as missing. Cases may
also declare forbidden values that must never appear in a structured output.

## Metric definitions

All rates are measured over the cases actually executed in the run. No target or
pass threshold is defined.

- **Structured output validity**: percentage of provider outputs accepted by the
  production triage schema validator (`validateTriageOutput`). Provider failures,
  non-object JSON, invalid types, unknown fields, and invalid enums are invalid. A
  valid output is not necessarily semantically correct.
- **Field extraction accuracy**: exact matches for `roadName`, `kilometerMarker`, and
  `direction` after normalization. Overall accuracy is the number of correct
  field/case pairs divided by 3 × the number of cases. Per-field accuracy is also
  reported. Invalid outputs count every field as incorrect. Null is compared to null.
- **Incident type classification accuracy**: exact match between the expected
  `incidentType` and the predicted type. A missing prediction is incorrect.
- **Missing-information detection**: precision, recall, and F1 over the field names in
  `missingInformation`, aggregated across cases. Exact-match accuracy requires the
  predicted set of field names to equal the expected set. Invalid outputs receive zero
  for this metric rather than credit for an empty list.
- **Unsupported fact generation**: a structured value for `roadName`,
  `kilometerMarker`, or `direction` is unsupported when (a) the expected value is
  unknown/null, (b) the value is not textually grounded in the report, or (c) the value
  is explicitly forbidden by the fixture. The report counts both assertions and the
  number/rate of cases with at least one assertion. Wrong values that are grounded and
  expected to exist are field errors, not hallucinations.
- **Latency**: wall-clock latency returned by the production executor, which includes
  retries and timeouts. Mean, median, p95 (nearest rank), minimum, maximum, and total
  are reported. Values depend on hardware, network, provider load, and retry behavior.
- **Token usage**: prompt and completion tokens when the provider exposes them. If no
  usage metadata is available, the metric is marked unavailable rather than estimated.

## Deterministic CI evaluation

```bash
npm run test:evaluation
```

The Jest suite validates the dataset, runs the full suite against the deterministic mock
provider, checks that two identical fixture runs produce identical reports, and verifies
the metric arithmetic with scripted outputs. It requires no API key, database, or network.

Ordinary tests run the same suite with `npm test`.

## Mock report

```bash
npm run eval:mock
```

This writes:

- `evaluation/reports/mock-evaluation.json` — machine-readable report.
- `evaluation/reports/mock-summary.md` — human-readable summary.

## Optional real-model evaluation

Real evaluation is intentionally opt-in. It requires an explicit network-call
acknowledgement and an API key:

```bash
OPENAI_API_KEY=... npm run eval:real -- --allow-real
```

Optional configuration: `OPENAI_MODEL`, `OPENAI_BASE_URL`, `LLM_TIMEOUT_MS`,
`LLM_MAX_RETRIES`. The command writes `openai-evaluation.json` and
`openai-summary.md` in the same report directory. The dedicated real runner refuses to start without
`--allow-real` and `OPENAI_API_KEY`, so CI cannot accidentally make paid calls. The
general `npm run eval` runner also refuses `--provider openai` without `--allow-real`.

## Limitations

- The dataset is fictional, curated, and small. It is not a statistical sample and does
  not establish production accuracy, safety, or fairness.
- Only location fields are scored for extraction. Free-text `description` and
  `riskFactors` are recorded but not judged for semantic correctness.
- Missing-information detection compares canonical field names. A prose answer such as
  "rodovia não informada" instead of `roadName` counts as a miss.
- Unsupported facts are detected only for structured location fields. Invented details
  inside free-text descriptions are not automatically detected.
- The mock provider is deterministic but simple; its measured scores only describe the
  mock, not an LLM.
- Latency and token usage are measurements of the specific run and are not comparable
  across machines without controlling those variables.
- No calibration of the model confidence field is evaluated. Confidence is not treated
  as a probability.

The JSON report contains the complete per-case predictions, expected values, metric
counts, and limitations. The Markdown summary is intentionally shorter.
