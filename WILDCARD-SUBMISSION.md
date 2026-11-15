# Syndrome — Payment Review

Track: Wildcard

Demo: https://syndrome.kydra.my.id/
Public endpoint: https://syndrome.kydra.my.id/api/wildcard/review
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

The demo now uses the permanent hostname syndrome.kydra.my.id through a Cloudflare named tunnel. API and tunnel start automatically and restart on failure. The host still needs power and Internet access. The original temporary URL remains active because the pending submission has no visible edit control. Use the domain links above for current access.

## Verified checks

Eleven local tests pass, including actual local Groth16 proving and HTTP replay tests in the separate Gatekeeper handler. TypeScript check passes. Public browser test: matching input required human approval; wrong recipient plus over-cap input rejected with both rule failures. The snarkjs test runner produced a MaxListeners warning; this remains a limitation of the current proof test setup.

Submission status: submitted as Syndrome - Payment Review; dashboard readback showed PENDING. Demo media: docs/syndrome-demo.gif and docs/syndrome-demo.mp4.
