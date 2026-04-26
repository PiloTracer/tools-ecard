# Integrating external applications with SeaweedFS (S3-compatible API)

This tutorial is for **any application** (another service, a worker, a mobile backend, a different repo) that must store or read objects in **SeaweedFS** using its **S3 gateway**. It is **not** specific to the E-Cards codebase.

For **E-Cards + Tools Dashboard** (minted keys, compose in this monorepo), use **[STORAGE_SEAWEED_AND_TOOLS_DASHBOARD_INTEGRATION.md](./STORAGE_SEAWEED_AND_TOOLS_DASHBOARD_INTEGRATION.md)**.

Official reference: [SeaweedFS S3 API](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API).

---

## 1. What you are integrating with

| Component | Typical role | Default (container) |
|-----------|--------------|---------------------|
| **S3 API** | `PutObject`, `GetObject`, `DeleteObject`, `ListObjects`, multipart, presigned URLs | Port **8333** inside Seaweed’s network |
| **Filer / volume** | File layout behind buckets; often reached via a **reverse proxy** for public reads | e.g. filer **8888** (varies by deployment) |
| **Host publish** | Other stacks reach Seaweed via **published** host ports (e.g. `18333:8333`) or a **TLS hostname** | Depends on your compose / ingress |

Your app needs a **single base URL** for the S3 API (the “endpoint”) and **credentials** accepted by that gateway’s config.

---

## 2. Choose an integration pattern

### Pattern A — Direct S3 (most common)

- Your app uses an **AWS S3 SDK** (Go, Java, Node, Python `boto3`, etc.) with:
  - `endpoint_url` / custom endpoint = Seaweed S3 base URL  
  - `access_key_id` / `secret_access_key` from Seaweed S3 config  
  - **`forcePathStyle: true`** (or equivalent “path-style” URL mode) — required for many S3-compatible backends including Seaweed  
  - `region`: often a placeholder (e.g. `us-east-1`) if Seaweed ignores it  

**Best for:** server-side uploads/downloads, workers, private objects.

### Pattern B — Public HTTP reads only

- Objects are **world-readable** through a URL prefix (e.g. `https://your-domain/storage/bucket/key`) served by **nginx** → filer.  
- Your app **does not** need S3 keys to **read** if policy allows anonymous GET.  
- **Writes** still normally go through **S3 API** (Pattern A) unless your platform exposes a dedicated upload API.

**Best for:** static assets, CDNs, public templates.

### Pattern C — Via a parent platform (no raw S3 keys)

- Some products only issue **opaque integration tokens** and a small **HTTP API** (e.g. metadata + `public_files_base_url`) instead of Seaweed access keys.  
- **Writes** may still require either extended APIs on that platform or delegated S3 credentials you never embed in the browser.

**Best for:** multi-tenant “app library” style products. Align with that platform’s docs; do not assume Seaweed credentials appear in the first metadata response unless documented.

---

## 3. Integration steps (Pattern A — direct S3)

1. **Confirm the S3 gateway URL** your app can reach (from its network):  
   - Same Docker network: `http://seaweedfs-s3:8333` (service name varies).  
   - Different network / host: `http://HOST:18333` if mapped `18333:8333`, or `https://s3.yourcompany.com` in production.

2. **Obtain credentials** that match the Seaweed **S3 config** (not filer-only secrets unless filer auth is separate).

3. **Configure the SDK**  
   - Set **path-style** addressing.  
   - Disable virtual-hosted-style bucket DNS if your SDK defaults to it.  
   - Use TLS for anything leaving a trusted network.

4. **Buckets**  
   - Create buckets with `CreateBucket` (or pre-create in ops).  
   - Align **bucket names** across writers and readers (upload service, batch worker, etc.).

5. **Object keys**  
   - Define a key layout (`tenant/id/file.ext`) to avoid collisions and to support lifecycle rules later.

6. **Private vs public**  
   - **Private:** clients should not rely on raw `https://endpoint/bucket/key` in the browser without **presigned GET** or your **own download API** that streams from Seaweed server-side.  
   - **Public:** you may return CDN/filer URLs only if your nginx (or equivalent) actually allows unauthenticated read for those paths.

7. **Production**  
   - Use **TLS**, **least-privilege** keys, **network policies**, and **separate** endpoints for internal vs external if needed.  
   - Your app and Seaweed **do not** need to share the same Docker network if routing and DNS are correct.

---

## 4. Checklist — verify the integration

### Connectivity and config

- [ ] From the **runtime** host/container of your app: TCP reachability to the S3 endpoint (e.g. `curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 "$ENDPOINT/"` — expect non–connection-refused; `403`/`404` on `/` is common for S3 gateways).
- [ ] **HTTPS** (or VPN-only HTTP) in production if traffic crosses an untrusted network.
- [ ] SDK uses **path-style** (or path-style URLs) for this Seaweed version.
- [ ] **Region** set to whatever your Seaweed deployment expects (often fixed string).

### Credentials and buckets

- [ ] Access key and secret match the Seaweed S3 **config** (no typos, no expired rotation drift).
- [ ] **Bucket** exists (or creation is allowed and your bootstrap creates it).
- [ ] **IAM-style policies** (if any) on the gateway allow the operations you need (`s3:PutObject`, `s3:GetObject`, …).

### Functional tests

- [ ] **Put** a small object; **Head** or **Get** it back; **Delete** it (or lifecycle policy matches your test).
- [ ] **List** with a prefix if your app depends on listing.
- [ ] **Multipart** or large upload: only if you use it — confirm Seaweed version supports your part sizes.
- [ ] **Presigned URL**: generate a GET URL, fetch it before expiry from a client that has no AWS signing (e.g. `curl`).

### Browser / CORS (only if the browser talks to Seaweed directly)

- [ ] Prefer **avoiding** direct browser → Seaweed for private data; use your **backend** or **presigned** URLs.  
- [ ] If you must use direct browser uploads to Seaweed, configure **CORS** on the S3 gateway per Seaweed docs.

### Operations

- [ ] **Monitoring**: log S3 error codes, latency, and 5xx from the gateway (no secrets in logs).  
- [ ] **Backup / DR**: documented outside this tutorial; Seaweed replication is an ops concern.

---

## 5. Common pitfalls

| Pitfall | What to do |
|---------|------------|
| Wrong port | Host maps **18333→8333** → client endpoint must use **18333** on the host, not 8333 unless you publish 8333. |
| “Works in Postman, fails in Docker” | DNS / `extra_hosts` / bridge: use the hostname **visible from the container** that owns the client. |
| Virtual-hosted bucket URLs | Force **path-style**: `https://endpoint/bucket/key` not `https://bucket.endpoint/key`. |
| Browser cannot read “public” URL | Object is still **private** at S3 layer; use presigned or proxy. |

---

## 6. Optional: same ecosystem as Tools Dashboard / E-Cards

If your app is a **registered application** on a Tools Dashboard that exposes:

- `GET {ORIGIN}/api/integrations/app-library/storage` with `Authorization: Bearer tdsk_…`

…then read that product’s response for **`public_files_base_url`** and any **documented** upload or storage APIs. Do **not** assume Seaweed S3 keys are returned unless the contract says so.

---

## 7. Related in this repo

| Topic | Document |
|--------|-----------|
| E-Cards env, compose, Tools Dashboard keys, private URL policy | [STORAGE_SEAWEED_AND_TOOLS_DASHBOARD_INTEGRATION.md](./STORAGE_SEAWEED_AND_TOOLS_DASHBOARD_INTEGRATION.md) |
| S3 feature internals (this monorepo) | `.claude/features/s3-bucket.md`, `api-server/src/features/s3-bucket/README.md` |
