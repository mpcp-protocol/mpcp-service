# Machine Payment Control Protocol

**MPCP** is a cryptographically enforced pipeline for autonomous and software-controlled payments. Machines—vehicles, robots, IoT devices, AI agents—can spend within policy-defined bounds, without per-transaction human approval.

MPCP authorizes machine payments through a chain of signed artifacts: PolicyGrant → BudgetAuthorization → PaymentAuthorization → Settlement.

## Why MPCP?

Traditional payment systems assume a human approves every transaction. Machine economies need a different model:

- **Bounded authorization** — Pre-authorized spending envelopes instead of wallet popups
- **Offline-capable** — Payments complete when the network is unavailable
- **Verifiable** — Every settlement can be independently verified against the authorization chain
- **Rail-agnostic** — XRPL, EVM, Stripe, hosted—one authorization model, any settlement rail

## Get Started

| I want to… | Go to |
|------------|-------|
| Understand MPCP | [What is MPCP?](overview/what-is-mpcp.md) |
| See how it differs from x402, AP2 | [Comparison](overview/comparison-with-agent-protocols.md) |
| Build a machine wallet | [Build a Machine Wallet](guides/build-a-machine-wallet.md) |
| Integrate fleet payments | [Fleet Payments](guides/fleet-payments.md) |
| Use the SDK or API | [Reference](reference/) |

## Documentation

- [Overview](overview/) — Problem, comparison, introduction
- [Protocol](protocol/) — Artifacts, hashing, verification, anchoring
- [Guides](guides/) — Machine wallet, fleet payments, dispute resolution
- [Examples](examples/) — Parking, charging, fleet
- [Reference](reference/) — SDK, service API, CLI

## Specification

The full protocol specification is in the [MPCP specification](../doc/protocol/mpcp.md). The [reference implementation](https://github.com/naory/mpcp-service) is available on GitHub.
