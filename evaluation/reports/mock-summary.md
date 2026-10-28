# Road Sense AI Evaluation Summary

- Generated: 2026-10-28T17:03:02.623Z
- Execution: mock / mock / mock-triage-v1
- Dataset: roadsense-fictional-incidents-v1 (44 fictional reports)
- Categories: straightforward=10, ambiguous=8, incomplete=8, contradictory=6, irrelevant=6, adversarial=6

## Measured results

| Metric | Result |
| --- | --- |
| Structured output validity | 100.00% (44/44) |
| Field extraction accuracy | 89.39% (118/132) |
| Incident type accuracy | 95.45% (42/44) |
| Missing information P / R / F1 | 100.00% / 83.13% / 90.79% |
| Missing information exact match | 79.55% (35/44) |
| Cases with unsupported facts | 20.45% (9/44) |
| Unsupported fact assertions | 14 |
| Latency mean / p95 | 0.09 ms / 1.00 ms |
| Token usage | 4418 total (44 cases) |

### Field extraction by field

| Field | Accuracy |
| --- | --- |
| roadName | 88.64% (39/44) |
| kilometerMarker | 86.36% (38/44) |
| direction | 93.18% (41/44) |

## Results by category

| Category | Cases | Valid output | Field accuracy | Type accuracy | Missing F1 | Missing exact | Unsupported cases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| straightforward | 10 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| ambiguous | 8 | 100.00% | 95.83% | 100.00% | 97.30% | 87.50% | 12.50% |
| incomplete | 8 | 100.00% | 100.00% | 100.00% | 100.00% | 100.00% | 0.00% |
| contradictory | 6 | 100.00% | 61.11% | 83.33% | 63.16% | 16.67% | 83.33% |
| irrelevant | 6 | 100.00% | 88.89% | 83.33% | 94.12% | 83.33% | 16.67% |
| adversarial | 6 | 100.00% | 77.78% | 100.00% | 81.82% | 66.67% | 33.33% |

Cases with unsupported facts: A05, C01, C02, C03, C05, C06, R06, X01, X02

## Notes and limitations

- Field extraction is scored only for roadName, kilometerMarker and direction. Free-text description and riskFactors are retained in the report but not scored for correctness.
- Missing-information detection compares the field names reported by the model. Synonym or prose answers (for example "rodovia" instead of "roadName") count as misses.
- An unsupported fact is a non-empty structured location value when the expected value is unknown/null, not textually grounded in the report, or explicitly forbidden by the fixture. Wrong values that are textually grounded and expected to exist are scored as field errors, not hallucinations.
- Structured-output validity means the raw provider output passed the production triage schema validator. It does not prove semantic correctness.
- Latency is wall-clock time for this run and depends on hardware, network, provider load and retry behavior. Token counts are reported only when the provider exposes them.
- The dataset is fictional, small and curated for demonstration. It is not a statistical sample and does not establish production accuracy or fairness.
- No pass threshold is defined or implied. Results are measurements of the exact run recorded in this report.
- These are measured results for the run above. No target threshold is asserted or implied.
