# Syndrome — Payment Review

Track: Wildcard

Demo: https://possible-populations-orientation-slideshow.trycloudflare.com/
Public endpoint: https://possible-populations-orientation-slideshow.trycloudflare.com/api/wildcard/review
Method: POST, application/json
Repository: https://github.com/HydraSql/syndrome-agent-games

## Use case

Syndrome is a read-only payment policy reviewer for operators and agent developers. It compares a proposed EVM transfer against a caller-supplied policy before an operator signs anything. It checks recipient, asset, chain, positive amount, spending cap and expiry, and returns a structured decision with each check's result.

A mismatch produces REJECT. Passing all checks produces REQUIRES_HUMAN_APPROVAL, never an automatic payment approval. Reviewers can use the public demo without connecting a wallet. Included presets are explicitly synthetic; the endpoint evaluates the submitted JSON rather than playing back preset answers.

## Build context

TypeScript and Fastify provide the public API. Amounts use BigInt decimal base units to avoid floating-point precision errors. EVM addresses and chain IDs are checked before comparison. The UI shows the actual backend response. Input digests help identify normalized inputs but are not cryptographic attestations of authenticity or ZK proofs.

A separate signed Agent Games Gatekeeper handler uses the official Groth16 artifacts. Official practice task practice_f27a6927-d3fb-4f96-9ed3-e4780ef90f7a received CORRECT DECISION / Proof VERIFIED for RECIPIENT_MISMATCH, latency 2139 ms. This is evidence of that practice result, not a claim that this public reviewer verifies chain state or that all competition scenarios pass.

## Limitations

The public reviewer does not retrieve chain data, validate balances, simulate contracts, sign transactions or transfer assets. Caller-supplied policy is not independently authenticated. It is a deterministic review component rather than an autonomous LLM researcher. Public reviewer responses do not include ZK proofs. No finalized on-chain proof reference is claimed.

The HTTPS demo currently uses an ephemeral Cloudflare tunnel and requires the local service to remain running. Stable hosting is needed for continuous judging availability. Wildcard source has been published to the GitHub repository. The local service is managed by systemd with restart-on-failure; this does not make the ephemeral tunnel URL permanent.

## Verified checks

Eleven local tests pass, including actual local Groth16 proving and HTTP replay tests in the separate Gatekeeper handler. TypeScript check passes. Public browser test: matching input required human approval; wrong recipient plus over-cap input rejected with both rule failures. The snarkjs test runner produced a MaxListeners warning; this remains a limitation of the current proof test setup.

Submission status: submitted as Syndrome - Payment Review; dashboard readback showed PENDING. Demo media: docs/syndrome-demo.gif and docs/syndrome-demo.mp4.
