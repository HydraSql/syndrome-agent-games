# Agent Games dual-track workbench — BLOCKED / NOT COMPETITION READY

Targets: Proof Gatekeeper and Steal the VFY. No registration, deployment, paid proof submission or account changes have occurred.

Implemented: TypeScript/Fastify local handler, raw-body authentication using an explicitly provisional HMAC-SHA256 hex convention, timestamp/deadline rejection, deterministic payment field checks, and fail-closed readiness responses. Health reports competitionReady=false; preflight deliberately returns 503 until actual proof support is implemented. This is not a working competition agent yet. Do not register this endpoint.

Verified locally: npm test passes two tests, npm run build passes. Both official proving keys parsed successfully and exported verification keys through snarkjs. No witness or Groth16 decision proof has been generated. Local fixtures use synthetic shortened identifiers and are not platform practice results.

Official downloads in artifacts/: gatekeeper.wasm, gatekeeper_final.zkey, vfy-policy.wasm, vfy-policy_final.zkey, exported verification keys, manifest.json with exact byte sizes and SHA256 hashes. Source .circom URLs at the matching public paths returned 404.

Sources inspected:
- https://agentgames.zkverify.io/build (including both starter prompt tabs)
- https://agentgames.zkverify.io/api/circuit-info
- https://agentgames.zkverify.io/guide

Blocking information:
1. Circuit witness input names, dimensions, public signal order and policy parameter semantics are not documented in the inspected pages. No canonical input fixture has been provided.
2. Exact HMAC digest algorithm/header encoding needs confirmation; SHA256 hex in this workbench is an assumption, not platform-verified compatibility.
3. Incoming-proof lookup/finality semantics need an authoritative API/schema and practice envelope. No proof_tx is trusted merely because it is present.
4. Duel strategy parameters, Poseidon commitment inputs/order, and salt format need circuit-level confirmation. No commitment or strategy is registered.
5. Platform-issued secret and public HTTPS hosting are required later. Do not paste secrets into chat.
6. npm audit reports three high dependency advisories through snarkjs/bfj/jsonpath/underscore. npm audit fix did not resolve them. Do not deploy before reviewing/remediating the chain.

Next required artifact: official circuit source or canonical witness examples for both tracks and exact signing specification, potentially available through the registered dashboard or organizer support. User login may be required. No proof output, successful preflight or competition readiness should be claimed until validated against platform practice.

Run local checks:

    cd /home/syndrome/agent-games
    /usr/bin/npm test
    /usr/bin/npm run build

Local service requires AGENT_GAMES_HMAC_SECRET from environment and runs on loopback port 5180 with npm start. No secret is embedded or stored here.
